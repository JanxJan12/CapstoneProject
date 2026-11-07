const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require(process.env.HALLMARK_PUPPETEER || path.resolve(__dirname, '../../.codex-temp/hallmark-puppeteer/node_modules/puppeteer-core'));

const sizes = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];
const screens = ['home', 'menu', 'profile', 'orders', 'order-detail'];
const output = path.join(__dirname, 'screenshots');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const failures = [];
  try {
    for (const size of sizes) {
      const page = await browser.newPage();
      await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
      page.on('pageerror', (error) => failures.push(`${size.name}: ${error.message}`));
      for (const screen of screens) {
        await page.goto(`${pathToFileURL(path.join(__dirname, 'index.html')).href}#${screen}`, { waitUntil: 'load' });
        await page.screenshot({ path: path.join(output, `${screen}-${size.name}.png`) });
        const state = await page.evaluate(() => ({
          visible: [...document.querySelectorAll('.screen')].filter((node) => !node.hidden).map((node) => node.dataset.screen),
          overflow: document.documentElement.scrollWidth > innerWidth,
          brokenImages: [...document.images].filter((img) => img.getClientRects().length && img.naturalWidth === 0).map((img) => img.src),
        }));
        if (state.visible.length !== 1 || state.visible[0] !== screen || state.overflow || state.brokenImages.length) failures.push(`${screen}-${size.name}: ${JSON.stringify(state)}`);
      }
      await page.goto(`${pathToFileURL(path.join(__dirname, 'index.html')).href}#menu`, { waitUntil: 'load' });
      const emptyCheckoutDisabled = await page.$eval('#side-checkout', (button) => button.disabled);
      if (!emptyCheckoutDisabled) failures.push(`empty-checkout-${size.name}: enabled`);
      await page.click('[data-screen="menu"] [data-add="chicken-bicol-express"]');
      const firstAdd = await page.evaluate(() => ({ count: document.querySelector('#header-cart-count').textContent, sideTotal: document.querySelector('#side-total').textContent, sideItems: document.querySelectorAll('#side-cart-items li').length }));
      if (firstAdd.count !== '1' || firstAdd.sideTotal !== '₱130.00' || firstAdd.sideItems !== 1) failures.push(`first-add-${size.name}: ${JSON.stringify(firstAdd)}`);
      await page.screenshot({ path: path.join(output, `menu-with-cart-${size.name}.png`) });
      if (size.name !== 'phone') {
        await page.click('#side-checkout');
        await page.waitForSelector('[data-screen="checkout"]:not([hidden])');
        const checkoutFromMenu = await page.$eval('#checkout-subtotal', (node) => node.textContent);
        if (checkoutFromMenu !== '₱130.00') failures.push(`side-checkout-${size.name}: ${checkoutFromMenu}`);
        await page.screenshot({ path: path.join(output, `checkout-from-menu-${size.name}.png`) });
        await page.evaluate(() => { location.hash = '#menu'; });
        await page.waitForSelector('[data-screen="menu"]:not([hidden])');
      }
      await page.click('[data-screen="menu"] [data-add="chicken-bicol-express"]');
      await page.evaluate(() => { location.hash = '#cart'; });
      await page.waitForSelector('[data-screen="cart"]:not([hidden])');
      const cartState = await page.evaluate(() => ({ count: document.querySelector('#header-cart-count').textContent, total: document.querySelector('#cart-total').textContent, rows: [...document.querySelectorAll('#cart-items li')].map((row) => row.textContent) }));
      if (cartState.count !== '2' || cartState.total !== '₱260.00' || cartState.rows.length !== 1 || !cartState.rows[0].includes('2 × Chicken Bicol Express')) failures.push(`cart-${size.name}: ${JSON.stringify(cartState)}`);
      await page.screenshot({ path: path.join(output, `cart-with-items-${size.name}.png`) });
      await page.click('#cart-checkout');
      await page.waitForSelector('[data-screen="checkout"]:not([hidden])');
      const checkoutFromCart = await page.$eval('#checkout-subtotal', (node) => node.textContent);
      if (checkoutFromCart !== '₱260.00') failures.push(`cart-checkout-${size.name}: ${checkoutFromCart}`);
      await page.screenshot({ path: path.join(output, `checkout-from-cart-${size.name}.png`) });
      if (size.name === 'phone') {
        await page.goto(`${pathToFileURL(path.join(__dirname, 'index.html')).href}#home`, { waitUntil: 'load' });
        await page.reload({ waitUntil: 'load' });
        await page.click('[data-screen="home"] [data-add="chicken-bicol-express"] .feature-add');
        const homeAdd = await page.evaluate(() => ({ count: document.querySelector('#mobile-cart-count').textContent, toast: document.querySelector('#cart-toast').textContent }));
        if (homeAdd.count !== '1' || !homeAdd.toast.includes('Chicken Bicol Express added')) failures.push(`home-add-phone: ${JSON.stringify(homeAdd)}`);
        await page.screenshot({ path: path.join(output, 'home-added-phone.png') });
      }
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ screenshots: sizes.length * (screens.length + 3) + 3, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
