/**
 * DOM-based verification test — no BFF interception.
 * Invalid = InputField_error_1 OR Notification_boxPopupContainer appears after submit
 * Valid   = neither appears within 8 seconds
 */

const { Builder, By, until, Key } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')
const { normalizeAndDedupe } = require('./utils/normalizePhone')

const LYCA_URL = 'https://www.lycamobile.us/en/quick-top-up/'

// Extract numbers from the concatenated string
const raw = '3472616097347582910662817439509153078462402689153778624590185598301746214975608368134275903476031984973518204630586472914172936850832150974664672938155083614927347286463334749320507198452630267930514895418273603856712409520493817674381692503472335679'
const phones = normalizeAndDedupe([raw])
console.log(`Extracted ${phones.length} numbers:`, phones, '\n')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function humanType(element, text) {
  for (const char of text) {
    await element.sendKeys(char)
    await sleep(40 + Math.random() * 60)
  }
}

function buildDriver() {
  const opts = new chrome.Options()
  opts.addArguments(
    // '--headless=new',  // visible for debugging
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,800',
    '--disable-extensions',
    '--no-first-run',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
  )
  opts.excludeSwitches(['enable-automation'])
  return new Builder().forBrowser('chrome').setChromeOptions(opts).build()
}

async function verifyNumber(driver, phone) {
  await driver.get(LYCA_URL)
  await sleep(3000)

  let input
  try {
    input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 12000)
  } catch (_) {
    await driver.get(LYCA_URL)
    await sleep(4000)
    input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 12000)
  }

  await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input)
  await sleep(300)
  await driver.executeScript('arguments[0].click()', input)
  await sleep(150)
  await driver.executeScript("arguments[0].value = ''", input)
  await input.sendKeys(Key.CONTROL, 'a')
  await input.sendKeys(Key.DELETE)
  await sleep(150)

  await humanType(input, phone)
  await sleep(1000)

  const btn = await driver.findElement(By.css('div[class*="formContainer"] button'))
  await driver.executeScript('arguments[0].click()', btn)

  // Poll up to 8s for invalid signals
  // Valid = no invalid signal detected within the window
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    await sleep(400)

    // INVALID: error text div under input
    const errorDivs = await driver.findElements(By.css('div[class*="InputField_error_1"]'))
    if (errorDivs.length > 0) {
      return false
    }

    // INVALID: notification popup (match by class, ignore dynamic nth-child)
    const popups = await driver.findElements(By.css('div[class*="Notification_boxPopupContainer"]'))
    if (popups.length > 0) {
      return false
    }
  }

  // No invalid signal found — valid
  return true
}

async function main() {
  const driver = await buildDriver()
  await driver.executeScript("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")

  console.log('=== DOM Verification Test ===\n')

  const valid = []
  const invalid = []

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i]
    process.stdout.write(`[${i + 1}/${phones.length}] Testing ${phone}... `)
    const result = await verifyNumber(driver, phone)
    console.log(result ? 'VALID ✓' : 'INVALID ✗')
    if (result) valid.push(phone); else invalid.push(phone)
  }

  console.log(`\n=== Results ===`)
  console.log(`Valid (${valid.length}):`, valid)
  console.log(`Invalid (${invalid.length}):`, invalid)

  await driver.quit()
}

main().catch(e => {
  console.error('Test failed:', e.message)
  process.exit(1)
})
