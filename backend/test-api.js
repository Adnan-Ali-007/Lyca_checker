require('dotenv').config()
const { Builder, By, until, Key } = require('selenium-webdriver')
const chrome = require('selenium-webdriver/chrome')

const TEST_NUMBER = '13472781710'

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
async function humanType(element, text) {
  for (const char of text) { await element.sendKeys(char); await sleep(50 + Math.random() * 60) }
}

async function run() {
  const opts = new chrome.Options()
  opts.addArguments('--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--disable-blink-features=AutomationControlled','--window-size=1280,800',
    '--disable-extensions','--no-first-run',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
  )
  opts.excludeSwitches(['enable-automation'])
  opts.setLoggingPrefs({ performance: 'ALL' })

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(opts).build()

  try {
    await driver.executeScript("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")

    // Intercept fetch to capture full request details including body and headers
    await driver.get('about:blank')
    await driver.executeScript(`
      window.__apiLog = [];
      const _fetch = window.fetch;
      window.fetch = async function(input, init={}) {
        const url = typeof input==='string' ? input : input.url;
        const res = await _fetch(input, init);
        const clone = res.clone();
        clone.text().then(body => {
          window.__apiLog.push({
            url,
            method: (init.method||'GET'),
            reqHeaders: init.headers ? JSON.stringify(init.headers) : '',
            reqBody: init.body || '',
            status: res.status,
            resBody: body.substring(0, 1000)
          });
        }).catch(()=>{});
        return res;
      };
    `)

    await driver.get('https://www.lycamobile.us/en/quick-top-up/')
    await sleep(4000)

    // Re-inject after SPA hydration
    await driver.executeScript(`
      window.__apiLog = window.__apiLog || [];
      const _fetch = window.fetch;
      window.fetch = async function(input, init={}) {
        const url = typeof input==='string' ? input : (input.url||String(input));
        const res = await _fetch(input, init);
        const clone = res.clone();
        clone.text().then(body => {
          window.__apiLog.push({
            url, method: (init.method||'GET'),
            reqHeaders: init.headers ? JSON.stringify(init.headers) : '',
            reqBody: typeof init.body==='string' ? init.body : '',
            status: res.status, resBody: body.substring(0,1000)
          });
        }).catch(()=>{});
        return res;
      };
    `)

    const input = await driver.wait(until.elementLocated(By.css('#default-input-field')), 10000)
    await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', input)
    await sleep(400)
    await driver.executeScript('arguments[0].click()', input)
    await sleep(200)
    await driver.executeScript("arguments[0].value=''", input)
    await input.sendKeys(Key.CONTROL, 'a')
    await input.sendKeys(Key.DELETE)
    await sleep(200)

    const dialNumber = TEST_NUMBER.startsWith('1') && TEST_NUMBER.length === 11 ? TEST_NUMBER.slice(1) : TEST_NUMBER
    console.log(`Typing: ${dialNumber}`)
    await humanType(input, dialNumber)
    await sleep(500)

    // Clear log, click verify
    await driver.executeScript('window.__apiLog = []')
    const btn = await driver.findElement(By.css('div[class*="formContainer"] button'))
    await driver.executeScript('arguments[0].click()', btn)
    console.log('Clicked verify...')
    await sleep(6000)

    // Print only the Lyca BFF API call
    const apiLog = await driver.executeScript('return window.__apiLog')
    const lycaCalls = (apiLog||[]).filter(e => e.url.includes('lycamobile') || e.url.includes('bff'))
    
    console.log('\n=== LYCA BFF API CALL DETAILS ===')
    for (const e of lycaCalls) {
      console.log(`\nURL:          ${e.url}`)
      console.log(`Method:       ${e.method}`)
      console.log(`Req Headers:  ${e.reqHeaders}`)
      console.log(`Req Body:     ${e.reqBody}`)
      console.log(`Status:       ${e.status}`)
      console.log(`Res Body:     ${e.resBody}`)
    }

    // Also grab cookies — we may need them for direct API calls
    const cookies = await driver.manage().getCookies()
    console.log('\n=== COOKIES ===')
    for (const c of cookies) {
      console.log(`${c.name}=${c.value.substring(0,60)}`)
    }

    await sleep(3000)
  } finally {
    await driver.quit()
  }
}

run().catch(console.error)
