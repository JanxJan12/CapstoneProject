const path = require('node:path');
const puppeteer = require(path.resolve(__dirname, '..', 'hallmark-puppeteer', 'node_modules', 'puppeteer-core'));

const output = __dirname;
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://127.0.0.1:5173/customer';

async function clickButton(page, name) {
  const found = await page.evaluate((label) => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!button) return false;
    button.click();
    return true;
  }, name);
  if (!found) throw new Error(`Button not found: ${name}`);
  await new Promise((resolve) => setTimeout(resolve, 900));
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    for (const [label, width, height] of [['mobile', 390, 844], ['desktop', 1440, 900]]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(base, { waitUntil: 'networkidle2' });
      await new Promise((resolve) => setTimeout(resolve, 1600));
      await page.screenshot({ path: path.join(output, `rrj-home-${label}.png`) });
      await clickButton(page, 'Menu');
      await page.screenshot({ path: path.join(output, `rrj-menu-${label}.png`) });
      const viewItem = await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')]
          .find((candidate) => candidate.textContent?.trim() === 'View item');
        if (!button) return false;
        button.click();
        return true;
      });
      if (viewItem) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        await page.screenshot({ path: path.join(output, `rrj-detail-${label}.png`) });
        await page.evaluate(() => {
          const button = [...document.querySelectorAll('button')]
            .find((candidate) => candidate.textContent?.includes('Add to Cart'));
          button?.click();
        });
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      const cartOpened = await page.evaluate(() => {
        const button = document.querySelector('button[aria-label^="Open cart"]');
        if (!button) return false;
        button.click();
        return true;
      });
      if (cartOpened) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        await page.screenshot({ path: path.join(output, `rrj-cart-${label}.png`) });
        const checkoutOpened = await page.evaluate(() => {
          const button = [...document.querySelectorAll('button')]
            .find((candidate) => /^(Checkout|Continue to checkout)$/.test(candidate.textContent?.trim() ?? ''));
          if (!button) return false;
          button.click();
          return true;
        });
        if (checkoutOpened) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          await page.screenshot({ path: path.join(output, `rrj-checkout-${label}.png`) });
        }
        console.log(JSON.stringify({ label, checkoutOpened }));
      }
      console.log(JSON.stringify({ label, viewItem, cartOpened }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
