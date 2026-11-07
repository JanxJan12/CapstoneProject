const path = require('node:path');
const puppeteer = require(path.resolve(__dirname, '..', '..', '.codex-temp', 'hallmark-puppeteer', 'node_modules', 'puppeteer-core'));

const base = 'http://127.0.0.1:5174/customer';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sizes = [['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 900]];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickMatching(page, selector, text) {
  const found = await page.evaluate(({ selector, text }) => {
    const node = [...document.querySelectorAll(selector)].find((candidate) => candidate.textContent?.trim() === text);
    if (!node) return false;
    node.click();
    return true;
  }, { selector, text });
  if (found) await sleep(700);
  return found;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const failures = [];
  try {
    for (const [name, width, height] of sizes) {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      page.on('pageerror', (error) => failures.push(`${name}: ${error.message}`));
      await page.goto(base, { waitUntil: 'networkidle2' });
      await sleep(1100);
      await page.screenshot({ path: path.join(__dirname, `home-${name}.png`) });
      if (!await clickMatching(page, 'button', 'Menu')) failures.push(`${name}: Menu navigation missing`);
      await page.screenshot({ path: path.join(__dirname, `menu-${name}.png`) });
      if (name === 'phone') {
        await page.type('input[aria-label="Search menu"]', 'Chicken Bicol Express');
        const resultCount = await page.evaluate(() => [...document.querySelectorAll('.customer-food-row')].length);
        if (resultCount !== 1) failures.push(`phone: menu search yielded ${resultCount} rows`);
        await page.click('button[aria-label="Clear search"]');
      }
      if (!await clickMatching(page, 'button', 'View item')) failures.push(`${name}: available item action missing`);
      await page.screenshot({ path: path.join(__dirname, `detail-${name}.png`) });
      const added = await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('Add to Cart'));
        if (!button) return false;
        button.click();
        return true;
      });
      if (!added) failures.push(`${name}: add-to-cart action missing`);
      await sleep(700);
      if (name === 'phone') await page.screenshot({ path: path.join(__dirname, 'added-toast-phone.png') });
      await sleep(1700);
      if (width < 768) {
        const cartButton = await page.$('.customer-mobile-bottom-nav button[aria-label^="Cart"]');
        if (!cartButton) failures.push(`${name}: Cart navigation missing`);
        else { await cartButton.click(); await sleep(700); }
      } else {
        const opened = await page.evaluate(() => { const button = document.querySelector('button[aria-label^="Open cart"]'); button?.click(); return Boolean(button); });
        if (!opened) failures.push(`${name}: Cart header action missing`);
        await sleep(700);
      }
      await page.screenshot({ path: path.join(__dirname, `cart-${name}.png`) });
      const checkout = await clickMatching(page, 'button', 'Continue to checkout') || await clickMatching(page, 'button', 'Checkout');
      if (!checkout) failures.push(`${name}: checkout action missing`);
      await page.screenshot({ path: path.join(__dirname, `checkout-${name}.png`) });
      const state = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, bottomNav: innerWidth >= 768 || getComputedStyle(document.querySelector('.customer-mobile-bottom-nav')).display !== 'none' }));
      if (state.overflow || !state.bottomNav) failures.push(`${name}: ${JSON.stringify(state)}`);
      if (name === 'phone') {
        if (!await clickMatching(page, '.customer-mobile-bottom-nav button', 'Track')) failures.push('phone: Track navigation missing');
        await page.screenshot({ path: path.join(__dirname, 'tracking-guest-phone.png') });
        if (!page.url().includes('/auth?portal=customer')) failures.push(`phone: guest tracking did not require sign-in: ${page.url()}`);
        await page.goto(base, { waitUntil: 'networkidle2' });
        await sleep(500);
        await page.click('button[aria-label="More customer options"]');
        await sleep(300);
        const drawerOpen = await page.$eval('#customer-mobile-navigation', (node) => node.getAttribute('aria-modal') === 'true');
        if (!drawerOpen) failures.push('phone: More drawer did not open');
        await page.screenshot({ path: path.join(__dirname, 'more-phone.png') });
        await page.click('button[aria-label="Close navigation"]');
      }
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ screenshots: sizes.length * 5, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });

