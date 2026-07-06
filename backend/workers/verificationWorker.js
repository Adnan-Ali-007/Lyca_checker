const { Worker } = require('bullmq')
const { makeRedis } = require('../queue/queue')
const { Builder, By, until, Key } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')
const Job = require('../models/Job')
const Number = require('../models/Number')
const proxyChain = require('proxy-chain')

const LYCA_URL = 'https://www.lycamobile.us/en/quick-top-up/'
const BFF_URL_PATTERN = '/bff/profile/v3/valid/lyca-number'
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || '1', 10)

const HEADLESS = process.env.HEADLESS === 'true'
const WORKER_TIMEOUT_MS = parseInt(process.env.WORKER_TIMEOUT_MS || '90000', 10)

// Headed mode: tile windows in a 2-column grid so you can watch all workers
const WIN_W = 700
const WIN_H = 560
const COLS  = 2

// Holds the local proxy-chain server instance (one shared across all workers)
let localProxyUrl = null

/**
 * Start a local anonymous proxy tunnel that forwards to the upstream
 * authenticated proxy. Chrome connects to localhost with no auth needed,
 * proxy-chain handles credential injection to Decodo upstream.
 * Called once before workers start.
 */
async function startProxyTunnel() {
  const upstreamUrl = process.env.PROXY_URL
  if (!upstreamUrl) return null

  const server = new proxyChain.Server({
    port: 0, // pick any free port
    prepareRequestFunction: () => ({
      upstreamProxyUrl: upstreamUrl,
    }),
  })

  await new Promise((resolve, reject) => {
    server.listen((err) => err ? reject(err) : resolve())
  })

  localProxyUrl = `http://127.0.0.1:${server.port}`
  console.log(`[proxy] tunnel started → ${localProxyUrl} → ${upstreamUrl.replace(/:([^@]+)@/, ':***@')}`)
  return server
}

function buildChromeOptions(workerIndex) {
  const opts = new chrome.Options()

  // In Docker, chromium is at /usr/bin/chromium — point selenium at it
  if (process.env.CHROME_BIN) {
    opts.setChromeBinaryPath(process.env.CHROME_BIN)
  }

  if (HEADLESS) {
    opts.addArguments('--headless=new')
  } else {
    // Local — position windows in a 2-column grid
    const col    = workerIndex % COLS
    const row    = Math.floor(workerIndex / COLS)
    const startX = col * (WIN_W + 8) + 8
    const startY = row * (WIN_H + 50) + 50
    opts.addArguments(
      `--window-size=${WIN_W},${WIN_H}`,
      `--window-position=${startX},${startY}`,
    )
  }

  // Route through local unauthenticated tunnel (proxy-chain handles auth)
  if (localProxyUrl) {
    opts.addArguments(`--proxy-server=${localProxyUrl}`)
  }

  opts.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-extensions',
    '--no-first-run',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-dbus',
    '--js-flags=--max-old-space-size=512',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  )
  opts.excludeSwitches(['enable-automation'])
  opts.setLoggingPrefs({ performance: 'ALL' })
  return opts
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function humanType(element, text) {
  for (const char of text) {
    await element.sendKeys(char)
    await sleep(40 + Math.random() * 60)
  }
}

/**
 * Read Chrome performance logs and extract the HTTP status
 * of the Lyca BFF validation call made after clicking verify.
 * Returns 200 for valid, 4xx for invalid, null if not found.
 */
async function getBffStatus(driver) {
  const logs = await driver.manage().logs().get('performance')
  const responses = logs
    .map(l => { try { return JSON.parse(l.message).message } catch { return null } })
    .filter(m => m && m.method === 'Network.responseReceived')
    .filter(m => m.params.response.url.includes(BFF_URL_PATTERN))

  if (responses.length === 0) return null
  return responses[responses.length - 1].params.response.status
}

/**
 * Verify one phone number using BFF network log interception (primary) with
 * DOM error signals as a fast-exit fallback for obvious invalids.
 *
 * Primary:  HTTP 200 from /bff/profile/v3/valid/lyca-number → VALID
 *           HTTP 4xx from the same endpoint              → INVALID
 * Fallback: InputField_error_1 div or Notification popup → INVALID
 *           No BFF response within 15s                   → INVALID
 *
 * Returns true (valid) or false (invalid).
 */
async function verifyNumber(driver, phone) {
  try {
    await driver.get(LYCA_URL)
    await sleep(3000)

    // Dismiss VWO ad popup if it appears
    try {
      const adClose = await driver.findElements(By.css('[id^="vwo-widget"] div.vwo-modal-wrapper button'))
      if (adClose.length > 0) {
        await driver.executeScript('arguments[0].click()', adClose[0])
        await sleep(500)
        console.log(`[worker] ${phone} → dismissed ad popup`)
      }
    } catch (_) {}

    // Wait for input field — use longer timeout when proxied (proxy adds latency)
    const PAGE_WAIT_MS = process.env.PROXY_URL ? 25000 : 12000
    let input
    try {
      input = await driver.wait(until.elementLocated(By.css('#default-input-field')), PAGE_WAIT_MS)
    } catch (_) {
      console.warn(`[worker] page load timeout for ${phone}, retrying...`)
      await driver.get(LYCA_URL)
      await sleep(5000)
      input = await driver.wait(until.elementLocated(By.css('#default-input-field')), PAGE_WAIT_MS)
    }

    // Scroll into view and focus
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input)
    await sleep(300)
    await driver.executeScript('arguments[0].click()', input)
    await sleep(150)

    // Clear field
    await driver.executeScript("arguments[0].value = ''", input)
    await input.sendKeys(Key.CONTROL, 'a')
    await input.sendKeys(Key.DELETE)
    await sleep(150)

    // Type number (10-digit format)
    const dialNumber = phone.startsWith('1') && phone.length === 11
      ? phone.slice(1) : phone

    await humanType(input, dialNumber)
    await sleep(1000)

    // Flush stale performance logs before clicking so we only see THIS request
    await driver.manage().logs().get('performance')

    // Click verify button
    const btn = await driver.findElement(By.css('div[class*="formContainer"] button'))
    await driver.executeScript('arguments[0].click()', btn)

    // Poll for result — up to 15 seconds
    // PRIMARY: BFF HTTP status from Chrome performance logs
    //   200 → valid, 4xx → invalid
    // FAST-EXIT fallbacks (DOM signals for obvious invalids):
    //   InputField_error_1 div or Notification popup → invalid immediately
    let isValid = false
    let decided = false
    const deadline = Date.now() + 15000

    while (Date.now() < deadline) {
      await sleep(400)

      // PRIMARY: check BFF network response in perf logs
      const bffStatus = await getBffStatus(driver)
      if (bffStatus !== null) {
        isValid = bffStatus === 200
        console.log(`[worker] ${phone} → ${isValid ? 'valid' : 'invalid'} (BFF status ${bffStatus})`)
        decided = true
        break
      }

      // FAST-EXIT: error text div under input (confirmed invalid)
      const errorDivs = await driver.findElements(By.css('div[class*="InputField_error_1"]'))
      if (errorDivs.length > 0) {
        await sleep(600)
        const errorDivsConfirm = await driver.findElements(By.css('div[class*="InputField_error_1"]'))
        if (errorDivsConfirm.length > 0) {
          console.log(`[worker] ${phone} → invalid (error div confirmed, no BFF response yet)`)
          isValid = false
          decided = true
          break
        }
      }

      // FAST-EXIT: notification popup
      const popups = await driver.findElements(By.css('div[class*="Notification_boxPopupContainer"]'))
      if (popups.length > 0) {
        await sleep(600)
        const popupsConfirm = await driver.findElements(By.css('div[class*="Notification_boxPopupContainer"]'))
        const inputs = await driver.findElements(By.css('#default-input-field'))
        if (popupsConfirm.length > 0 && inputs.length > 0) {
          console.log(`[worker] ${phone} → invalid (notification popup confirmed, no BFF response yet)`)
          isValid = false
          decided = true
          break
        }
      }
    }

    if (!decided) {
      // Timeout — no BFF response and no DOM error signal
      // Do one final BFF check before giving up
      const finalBffStatus = await getBffStatus(driver)
      if (finalBffStatus !== null) {
        isValid = finalBffStatus === 200
        console.log(`[worker] ${phone} → ${isValid ? 'valid' : 'invalid'} (BFF status ${finalBffStatus} on final check)`)
      } else {
        console.log(`[worker] ${phone} → invalid (timeout — no BFF response in 15s)`)
        isValid = false
      }
    }

    // Small random delay between verifications to avoid rate limiting
    await sleep(1000 + Math.random() * 2000)

    return isValid

  } catch (err) {
    console.error(`[worker] Error verifying ${phone}:`, err.message)
    // Signal caller that browser needs restart or retry
    if (err.message && (err.message.includes('tab crashed') || err.message.includes('invalid session') || err.message.includes('no such session') || err.message.includes('renderer') || err.message.includes('script timeout') || err.message.includes('Timed out receiving message'))) {
      const crashErr = new Error(err.message)
      crashErr.browserCrashed = true
      throw crashErr
    }
    return false
  }
}

async function startWorkers() {
  // Start the proxy tunnel once — all workers share the same local endpoint
  await startProxyTunnel()

  // Each worker adds SIGTERM + SIGINT listeners — raise the limit to avoid warning
  process.setMaxListeners(WORKER_COUNT * 2 + 10)

  for (let i = 0; i < WORKER_COUNT; i++) {
    let driver = null

    const worker = new Worker(
      'verification',
      async (job) => {
        const { phone, jobId } = job.data

        if (!driver) {
          // Stagger worker startups to avoid hammering Lyca simultaneously
          await sleep(i * 4000)
          driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(buildChromeOptions(i))
            .build()
          await driver.executeScript(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
          )
          await driver.get(LYCA_URL)
          await sleep(3500)
          console.log(`[worker ${i}] browser ready`)
        }

        const t0 = Date.now()
        let isValid = false
        try {
          // Enforce 90s max per number — if proxy is too slow, restart and retry
          isValid = await Promise.race([
            verifyNumber(driver, phone),
            new Promise((_, reject) => setTimeout(() => reject(new Error('verification timeout after 90s')), WORKER_TIMEOUT_MS))
          ])
        } catch (err) {
          if (err.browserCrashed) {
            console.warn(`[worker ${i}] browser crashed, restarting...`)
            try { await driver.quit() } catch (_) {}
            driver = null
            // Restart browser
            await sleep(3000)
            driver = await new Builder()
              .forBrowser('chrome')
              .setChromeOptions(buildChromeOptions(i))
              .build()
            await driver.executeScript(
              "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
            )
            await driver.get(LYCA_URL)
            await sleep(3500)
            console.log(`[worker ${i}] browser restarted, retrying ${phone}`)
            try {
              isValid = await verifyNumber(driver, phone)
            } catch (_) {
              console.error(`[worker ${i}] retry failed for ${phone}, marking invalid`)
              isValid = false
            }
          } else {
            console.error(`[worker ${i}] unexpected error for ${phone}:`, err.message)
            isValid = false
          }
        }
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2)
        console.log(`[worker ${i}] ⏱  ${phone} took ${elapsed}s`)

        await Number.findOneAndUpdate({ jobId, phone }, { valid: isValid })

        const update = {
          $inc: {
            completed: 1,
            valid: isValid ? 1 : 0,
            invalid: isValid ? 0 : 1,
          },
        }
        const updatedJob = await Job.findByIdAndUpdate(jobId, update, { new: true })
        if (updatedJob.completed >= updatedJob.total) {
          await Job.findByIdAndUpdate(jobId, { status: 'done' })

          // ── Batch timing summary ───────────────────────────────────────
          const batchMs  = Date.now() - updatedJob.createdAt.getTime()
          const batchSec = (batchMs / 1000).toFixed(1)
          const perNum   = (batchMs / updatedJob.total / 1000).toFixed(2)
          console.log('════════════════════════════════════════')
          console.log(`  ✅ Job ${jobId} complete`)
          console.log(`  Total numbers : ${updatedJob.total}`)
          console.log(`  Valid         : ${updatedJob.valid}`)
          console.log(`  Invalid       : ${updatedJob.invalid}`)
          console.log(`  Wall-clock    : ${batchSec}s`)
          console.log(`  Avg per number: ${perNum}s`)
          console.log(`  Workers used  : ${WORKER_COUNT}`)
          console.log('════════════════════════════════════════')
        }
      },
      {
        connection: makeRedis(),
        concurrency: 1,
        lockDuration: 600000,
        lockRenewTime: 60000,
        maxStalledCount: 0, // don't re-queue stalled jobs — mark them failed instead
      },
    )

    worker.on('failed', (job, err) => {
      console.error(`[worker ${i}] failed for ${job?.data?.phone}:`, err.message)
    })

    const cleanup = async () => {
      if (driver) { try { await driver.quit() } catch (_) {} }
    }
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)

    console.log(`[worker ${i}] started`)
  }
}

module.exports = { startWorkers }
