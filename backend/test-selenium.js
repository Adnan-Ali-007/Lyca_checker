require('dotenv').config()
const { Builder, By, until, Key } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')

const TESTS = [
  { number: '1111111111',  expect: 'INVALID' },
  { number: '13472781710', expect: 'VALID' },
  { number: '13472781710', expect: 'VALID' },   // valid again after valid
  { number: '1111111111',  expect: 'INVALID' },  // invalid again after valid
]

const BFF_URL_PATTERN = '/bff/profile/v3/valid/lyca-number'
const POPUP_CLOSE = 'button[class*="Notification_boxPopupContainer"] button, div[class*="Notification_boxPopupContainer"] > button'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
async function humanType(element, text) {
  for (const char of text) { await element.sendKeys(char); await sleep(50 + Math.random() * 50) }
}

async function getBffStatus(driver) {
  const logs = await driver.manage().logs().get('performance')
  const responses = logs
    .map(l => { try { return JSON.parse(l.message).message } catch { return null } })
    .filter(m => m && m.method === 'Network.responseReceived')
    .filter(m => m.params.response.url.includes(BFF_URL_PATTERN))
  if (responses.length === 0) return null
  return responses[responses.length - 1].params.response.status
}

async function run() {
  const opts = new chrome.Options()
  opts.addArguments(
    '--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,800','--disable-extensions','--no-first-run',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
  )
  opts.excludeSwitches(['enable-automation'])
  opts.setLoggingPrefs({ performance: 'ALL' })

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(opts).build()

  try {
    await driver.executeScript("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
    await driver.get('https://www.lycamobile.us/en/quick-top-up/')
    await sleep(4000)

    for (const { number, expect } of TESTS) {
      const dialNumber = number.startsWith('1') && number.length === 11 ? number.slice(1) : number
      console.log(`\n--- Testing ${dialNumber} (expected: ${expect}) ---`)

      const input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 10000)
      await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input)
      await sleep(300)
      await driver.executeScript('arguments[0].click()', input)
      await sleep(150)
      await driver.executeScript("arguments[0].value=''", input)
      await input.sendKeys(Key.CONTROL, 'a')
      await input.sendKeys(Key.DELETE)
      await sleep(150)
      await humanType(input, dialNumber)
      await sleep(400)

      // Clear perf logs before clicking
      await driver.manage().logs().get('performance')

      const btn = await driver.findElement(By.css('div[class*="formContainer"] button'))
      await driver.executeScript('arguments[0].click()', btn)

      // Poll for BFF response
      let status = null
      const deadline = Date.now() + 8000
      while (Date.now() < deadline) {
        await sleep(500)
        status = await getBffStatus(driver)
        if (status !== null) break
      }

      const result = status === 200 ? 'VALID' : status !== null ? `INVALID (${status})` : 'NO_RESPONSE'
      const pass = (status === 200) === (expect === 'VALID')
      console.log(`BFF status: ${status} → ${result} ${pass ? '✓ PASS' : '✗ FAIL (expected ' + expect + ')'}`)

      // Dismiss invalid popup if present (selector from live page inspection)
      try {
        const popup = await driver.findElement(By.css(POPUP_CLOSE))
        await driver.executeScript('arguments[0].click()', popup)
        console.log('  ↳ dismissed popup')
        await sleep(400)
      } catch (_) {} // no popup = no problem

      // Page stays put — just clear input for next number (no reload needed)
      try {
        await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input)
        await driver.executeScript("arguments[0].value=''", input)
        await input.sendKeys(Key.CONTROL, 'a')
        await input.sendKeys(Key.DELETE)
        await sleep(300)
      } catch (_) {
        console.log('Input stale, reloading...')
        await driver.get('https://www.lycamobile.us/en/quick-top-up/')
        await driver.wait(until.elementLocated(By.css('#default-input-field')), 10000)
        await sleep(2000)
      }
    }

    console.log('\nAll tests done.')
    await sleep(3000)
  } finally {
    await driver.quit()
  }
}

run().catch(console.error)
