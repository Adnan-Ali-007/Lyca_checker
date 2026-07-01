/**
 * test-visual-parallelism.js
 *
 * Opens N Chrome windows simultaneously, each navigating to the Lyca top-up
 * page and typing a fake phone number — so you can SEE with your own eyes
 * that all browsers are working in parallel, not one-at-a-time.
 *
 * Usage:
 *   node test-visual-parallelism.js          # uses WORKER_COUNT from .env
 *   WORKER_COUNT=2 node test-visual-parallelism.js
 *   WORKER_COUNT=4 node test-visual-parallelism.js
 *
 * Each browser window will:
 *   1. Open  → https://www.lycamobile.us/en/quick-top-up/
 *   2. Type  → a fake 10-digit number
 *   3. Click → the verify button
 *   4. Wait  → 6 seconds so you can observe the result
 *   5. Close → automatically
 *
 * Windows are deliberately positioned in a grid so they don't stack on top
 * of each other — you can watch all of them side-by-side.
 */

require('dotenv').config()
const { Builder, By, until, Key } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')

// ─── Config ────────────────────────────────────────────────────────────────
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || '4', 10)

// Fake numbers — clearly invalid so Lyca won't process anything real
const FAKE_NUMBERS = [
  '2125550001',
  '2125550002',
  '2125550003',
  '2125550004',
  '2125550005',
  '2125550006',
  '2125550007',
  '2125550008',
]

const LYCA_URL    = 'https://www.lycamobile.us/en/quick-top-up/'
const WIN_W       = 640
const WIN_H       = 560
const COLS        = Math.min(WORKER_COUNT, 3) // max 3 windows per row
// ────────────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function buildOptions(winIndex) {
  const opts = new chrome.Options()

  // ── Grid positioning ────────────────────────────────────────────────────
  // Arrange windows in a grid: row × col layout so they don't overlap
  const col    = winIndex % COLS
  const row    = Math.floor(winIndex / COLS)
  const startX = col * (WIN_W + 10) + 10
  const startY = row * (WIN_H + 60) + 60   // leave room for taskbar

  opts.addArguments(
    // NO --headless → visible window
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    `--window-size=${WIN_W},${WIN_H}`,
    `--window-position=${startX},${startY}`,
    '--disable-extensions',
    '--no-first-run',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  )
  opts.excludeSwitches(['enable-automation'])
  return opts
}

async function humanType(element, text) {
  for (const char of text) {
    await element.sendKeys(char)
    await sleep(50 + Math.random() * 70)
  }
}

async function runBrowser(workerId, phone) {
  let driver = null
  const label = `[browser ${workerId}]`

  try {
    console.log(`${label} 🚀 launching (phone=${phone})`)
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(buildOptions(workerId))
      .build()

    // Hide webdriver flag
    await driver.executeScript(
      "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
    )

    // ── 1. Navigate ────────────────────────────────────────────────────────
    console.log(`${label} 🌐 navigating to Lyca...`)
    await driver.get(LYCA_URL)
    await sleep(2500)

    // ── 2. Find input ──────────────────────────────────────────────────────
    let input
    try {
      input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 12000)
      console.log(`${label} ✅ input field found`)
    } catch (_) {
      console.warn(`${label} ⚠️  input not found after 12s, retrying page load...`)
      await driver.get(LYCA_URL)
      await sleep(3500)
      input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 12000)
    }

    // ── 3. Type the number ─────────────────────────────────────────────────
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input)
    await sleep(300)
    await driver.executeScript('arguments[0].click()', input)
    await sleep(150)
    await driver.executeScript("arguments[0].value = ''", input)
    await input.sendKeys(Key.CONTROL, 'a')
    await input.sendKeys(Key.DELETE)
    await sleep(150)

    console.log(`${label} ⌨️  typing ${phone}...`)
    await humanType(input, phone)
    await sleep(800)

    // ── 4. Click verify ────────────────────────────────────────────────────
    const btn = await driver.findElement(By.css('div[class*="formContainer"] button'))
    console.log(`${label} 🖱️  clicking verify...`)
    await driver.executeScript('arguments[0].click()', btn)

    // ── 5. Hold the window open so user can see the result ─────────────────
    console.log(`${label} 👁️  holding open for 6s — watch this window!`)
    await sleep(6000)

    console.log(`${label} ✔  done`)

  } catch (err) {
    console.error(`${label} ✗ error: ${err.message}`)
  } finally {
    if (driver) {
      try { await driver.quit() } catch (_) {}
    }
  }
}

async function main() {
  const count = Math.min(WORKER_COUNT, FAKE_NUMBERS.length)

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  Visual Parallelism Demo — Headed Selenium')
  console.log('══════════════════════════════════════════════════════')
  console.log(`  Launching ${count} Chrome windows SIMULTANEOUSLY`)
  console.log(`  Each window types a different fake number`)
  console.log(`  Watch them all work at the same time!`)
  console.log('══════════════════════════════════════════════════════\n')

  const wallStart = Date.now()

  // Fire ALL browsers at the same time — no await between them
  const tasks = Array.from({ length: count }, (_, i) =>
    runBrowser(i, FAKE_NUMBERS[i])
  )

  await Promise.all(tasks)

  const wallSec = ((Date.now() - wallStart) / 1000).toFixed(2)
  const serialSec = (count * (2.5 + 0.5 + 1 + 0.8 + 6)).toFixed(1) // rough per-browser estimate

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  DONE')
  console.log(`  Wall-clock : ${wallSec}s  (${count} browsers in parallel)`)
  console.log(`  If serial  : ~${serialSec}s  (one browser at a time)`)
  console.log('══════════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
