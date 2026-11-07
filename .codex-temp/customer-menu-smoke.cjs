const puppeteer = require('./hallmark-puppeteer/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:4174/customer?view=menu', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.customer-food-row-side button');
    await page.click('.customer-food-row h3');
    await new Promise((resolve) => setTimeout(resolve, 300));
    const cartText = await page.$eval('.customer-menu-cart', (element) => element.innerText);
    const stayedOnMenu = new URL(page.url()).searchParams.get('view') === 'menu';
    await page.click('.customer-menu-cart-checkout');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const checkoutView = new URL(page.url()).searchParams.get('view');
    const optionsPage = await browser.newPage();
    await optionsPage.goto('http://127.0.0.1:4174/customer?view=menu', { waitUntil: 'networkidle2' });
    await optionsPage.evaluate(() => {
      const beverageButton = [...document.querySelectorAll('.customer-menu-toolbar button')]
        .find((button) => button.textContent?.trim() === 'Beverages');
      beverageButton?.click();
    });
    await optionsPage.waitForSelector('.customer-food-row-side button');
    const firstBeverageAction = await optionsPage.$eval('.customer-food-row-side button', (element) => element.textContent?.trim());
    const availableBeverage = await optionsPage.$('.customer-food-row-side button:not([disabled])');
    if (availableBeverage) await availableBeverage.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const optionsVisible = await optionsPage.$('.customer-detail-choices') !== null;
    console.log(JSON.stringify({ stayedOnMenu, cartText, checkoutView, firstBeverageAction, availableBeverage: Boolean(availableBeverage), optionsVisible }));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
