const puppeteer = require('./hallmark-puppeteer/node_modules/puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4174/customer', { waitUntil: 'networkidle2' });
    const selectors = ['.customer-app', '.customer-home-banner h1', '.customer-home-categories button', '.customer-featured-dish h3', '.customer-featured-dish .customer-food-row-side button', '.customer-nav button'];
    const result = await page.evaluate((selectors) => selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const style = getComputedStyle(element);
      return { selector, family: style.fontFamily, weight: style.fontWeight, size: style.fontSize, spacing: style.letterSpacing };
    }), selectors);
    console.log(JSON.stringify(result, null, 2));
    console.log(JSON.stringify(await page.evaluate(() => [...document.fonts].filter((face) => face.family.includes('Manrope')).map((face) => ({ family: face.family, weight: face.weight, status: face.status })))));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
