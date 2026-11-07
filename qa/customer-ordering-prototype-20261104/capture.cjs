const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const puppeteerPath = process.env.HALLMARK_PUPPETEER;
if (!puppeteerPath) throw new Error('Set HALLMARK_PUPPETEER to the installed puppeteer-core module directory.');
const puppeteer = require(puppeteerPath);
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = __dirname;
const output = path.join(root, 'screenshots');
const sizes = [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 900 }];
const screens = ['menu', 'detail', 'cart', 'checkout', 'tracking'];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const failures = [];
  try {
    for (const size of sizes) {
      const page = await browser.newPage();
      await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
      page.on('pageerror', (error) => failures.push(`${size.name}: ${error.message}`));
      for (const screen of screens) {
        await page.goto(`${pathToFileURL(path.join(root, 'index.html')).href}#${screen}`, { waitUntil: 'load' });
        await page.screenshot({ path: path.join(output, `${screen}-${size.name}.png`) });
        const state = await page.evaluate(() => ({
          visible: [...document.querySelectorAll('.screen[data-screen]')].filter((node) => !node.hidden).map((node) => node.dataset.screen),
          overflow: document.documentElement.scrollWidth > innerWidth,
          logoLoaded: document.querySelector('.brand img').naturalWidth > 0,
        }));
        if (state.visible.length !== 1 || state.visible[0] !== screen || state.overflow || !state.logoLoaded) failures.push(`${screen}-${size.name}: ${JSON.stringify(state)}`);
      }
      if (size.name === 'phone') {
        await page.goto(`${pathToFileURL(path.join(root, 'index.html')).href}#menu`, { waitUntil: 'load' });
        await page.click('[data-category="Viands"]');
        await page.type('#dish-search', 'Chicken');
        const matches = await page.evaluate(() => [...document.querySelectorAll('#dish-list .dish')].filter((node) => !node.hidden).map((node) => node.dataset.name));
        if (matches.length !== 1 || matches[0] !== 'Chicken Bicol Express') failures.push(`filter interaction: ${JSON.stringify(matches)}`);
        await page.click('a[aria-label="View Chicken Bicol Express"]');
        await page.click('[data-screen="detail"] .qty-plus');
        await page.click('#detail-add');
        const cartTotal = await page.$eval('#cart-subtotal', (node) => node.textContent);
        if (cartTotal !== '₱260.00') failures.push(`quantity interaction: ${cartTotal}`);
        await page.click('[data-screen="cart"] .primary-action');
        const checkoutVisible = await page.$eval('[data-screen="checkout"]', (node) => !node.hidden);
        if (!checkoutVisible) failures.push('checkout navigation');
      }
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ screenshots: sizes.length * screens.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
