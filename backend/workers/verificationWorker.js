const { Worker } = require('bullmq')
const { makeRedis } = require('../queue/queue')
const { Builder, By, until, Key } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')
const Job = require('../models/Job')
const Number = require('../models/Number')

const LYCA_URL = 'https://www.lycamobile.us/en/quick-top-up/'
const BFF_URL_PATTERN = '/bff/profile/v3/valid/lyca-number'
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || '1', 10)

const HEADLESS = process.env.HEADLESS === 'true'
const WORKER_TIMEOUT_MS = parseInt(process.env.WORKER_TIMEOUT_MS || '90000', 10)

// Headed mode: tile windows in a 2-column grid so you can watch all workers
const WIN_W = 700
const WIN_H = 560
const COLS  = 2

function buildChromeOptions(workerIndex) {
  const opts = new chrome.Options()

  // In Docker, chromium is at /usr/bin/chromium — point selenium at it
  if (process.env.CHROME_BIN) {
    opts.setChromeBinaryPath(process.env.CHROME_BIN)
  }

  if (HEADLESS) {
    // Server / CI — no display available
    opts.addArguments('--headless=new')
  } else {
    // Local — position windows in a grid so they don't stack
    const col    = workerIndex % COLS
    const row    = Math.floor(workerIndex / COLS)
    const startX = col * (WIN_W + 8) + 8
    const startY = row * (WIN_H + 50) + 50
    opts.addArguments(
      `--window-size=${WIN_W},${WIN_H}`,
      `--window-position=${startX},${startY}`,
    )
  }

  // Add proxy if configured
  const proxyUrl = process.env.PROXY_URL
  if (proxyUrl) {
    // Chrome only supports socks5://, not socks5h:// — convert if needed
    // For http:// proxies, Chrome needs the format without protocol prefix
    let chromeProxyUrl = proxyUrl.replace(/^socks5h:\/\//, 'socks5://')
    if (chromeProxyUrl.startsWith('http://')) {
      chromeProxyUrl = chromeProxyUrl.replace(/^http:\/\//, '')
    }
    opts.addArguments(`--proxy-server=${chromeProxyUrl}`)
  }
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
 * Verify one phone number using DOM state — no BFF log interception.
 * Valid   → arrow/next button with img appears inside the form
 * Invalid → InputField_error_1 div appears, OR Notification popup appears
 * Returns true (valid) or false (invalid).
 */
async function verifyNumber(driver, phone) {
  try {
    await driver.get(LYCA_URL)
    await sleep(5000)

    // Dismiss VWO ad popup if it appears
    try {
      const adClose = await driver.findElements(By.css('[id^="vwo-widget"] div.vwo-modal-wrapper button'))
      if (adClose.length > 0) {
        await driver.executeScript('arguments[0].click()', adClose[0])
        await sleep(500)
        console.log(`[worker] ${phone} → dismissed ad popup`)
      }
    } catch (_) {}

    // Wait for input field
    let input
    try {
      input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 25000)
    } catch (_) {
      console.warn(`[worker] page load timeout for ${phone}, retrying...`)
      await driver.get(LYCA_URL)
      await sleep(5000)
      input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 25000)
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

    // Click verify button
    const btn = await driver.findElement(By.css('div[class*="formContainer"] button'))
    await driver.executeScript('arguments[0].click()', btn)

    // Poll DOM for result — up to 12 seconds
    // Valid = no invalid signal within the window
    // Invalid = InputField_error_1 OR Notification popup appears
    let isValid = true
    const deadline = Date.now() + 12000
    while (Date.now() < deadline) {
      await sleep(400)

      // INVALID signal 1: error text div under input
      const errorDivs = await driver.findElements(By.css('div[class*="InputField_error_1"]'))
      if (errorDivs.length > 0) {
        // Confirm it's still there after 1s to avoid transient flashes
        await sleep(1000)
        const errorDivsConfirm = await driver.findElements(By.css('div[class*="InputField_error_1"]'))
        if (errorDivsConfirm.length > 0) {
          console.log(`[worker] ${phone} → invalid (error div confirmed)`)
          isValid = false
          break
        }
      }

      // INVALID signal 2: notification popup (class match, ignores dynamic nth-child)
      const popups = await driver.findElements(By.css('div[class*="Notification_boxPopupContainer"]'))
      if (popups.length > 0) {
        // Confirm after 1s and check input is still present
        await sleep(1000)
        const popupsConfirm = await driver.findElements(By.css('div[class*="Notification_boxPopupContainer"]'))
        const inputs = await driver.findElements(By.css('#default-input-field'))
        if (popupsConfirm.length > 0 && inputs.length > 0) {
          console.log(`[worker] ${phone} → invalid (notification popup confirmed)`)
          isValid = false
          break
        }
        console.log(`[worker] ${phone} → popup detected but not confirmed, skipping signal`)
      }
    }

    if (isValid) console.log(`[worker] ${phone} → valid (no invalid signal in 12s)`)

    // Small random delay between verifications to avoid rate limiting
    await sleep(500 + Math.random() * 1000)

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

function startWorkers() {
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
