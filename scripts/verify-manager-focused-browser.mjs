import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html";
const output = path.resolve("qa/manager-focused-rendered-20261023");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-manager-focused-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map();
const errors = [], requests = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  socket.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async (expression) => {
  for (let n = 0; n < 80; n++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,350)")}; errors=${errors.join(" | ")}`);
};
const clickText = (label) => evaluate(`([...document.querySelectorAll('button')].find((button) => button.textContent.trim().includes(${JSON.stringify(label)})))?.click()`);
const setInput = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
try {
  let port;
  for (let n = 0; n < 100; n++) {
    try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]); break; }
    catch { await pause(100); }
  }
  assert.ok(port, "Chrome debugger unavailable");
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args?.map((arg) => arg.value ?? arg.description).join(" "));
    if (message.method === "Network.loadingFailed") errors.push(message.params.errorText);
    if (message.method === "Network.requestWillBeSent") requests.push({ url: message.params.request.url, method: message.params.request.method });
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await mkdir(output, { recursive: true });
  const results = [];
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 900]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    for (const page of ["menu", "requests"]) {
      await send("Page.navigate", { url: `${base}?page=${page}` });
      await waitFor(page === "menu" ? "!!document.querySelector('section[aria-label=\"Meal Options\"] button')" : "!!document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')");
      await pause(200);
      if (page === "menu") {
        await clickText("Configure meal");
        await waitFor("!!document.querySelector('select option[value=\"meal-biryani\"]')");
        const options = await evaluate("[...document.querySelector('section[aria-label=\"Meal Options\"] select').options].map(o => ({value:o.value,text:o.textContent}))");
        assert.deepEqual(options.map((option) => option.value), ["", "meal-biryani", "meal-other"]);
        assert.equal(options[0].text, "Select an eligible meal");
        assert.equal(await evaluate("document.querySelector('section[aria-label=\"Meal Options\"] select').value"), "");
        await evaluate("(() => { const e=document.querySelector('section[aria-label=\"Meal Options\"] select');e.value='meal-biryani';e.dispatchEvent(new Event('change',{bubbles:true})); })()");
        await waitFor("!!document.querySelector('input[value=\"209.00\"]')");
        assert.equal(await evaluate("document.querySelector('input[value=\"209.00\"]')?.value"), "209.00");
        if (width === 390) {
          assert.ok(await setInput('section[aria-label="Meal Options"] .grid label:nth-of-type(2) input', "180"));
          await clickText("Save Meal Options");
          await waitFor("document.body.innerText.includes('Select the Manager-approved rice inventory item')");
        }
        await evaluate("(() => { const e=document.querySelector('section[aria-label=\"Meal Options\"] select');e.value='meal-other';e.dispatchEvent(new Event('change',{bubbles:true})); })()");
        await waitFor("!!document.querySelector('input[value=\"145.00\"]')");
        assert.equal(await evaluate("document.querySelector('input[value=\"120.00\"]')?.value"), "120.00");
        assert.match(await evaluate("document.querySelector('section[aria-label=\"Meal Options\"]').innerText"), /Existing recipe quantity: 0\.2 kg/);
        const selectedShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
        await writeFile(path.join(output, `menu-selected-${width}.png`), Buffer.from(selectedShot.data, "base64"));
        await evaluate("(() => { const e=document.querySelector('section[aria-label=\"Meal Options\"] select');e.value='';e.dispatchEvent(new Event('change',{bubbles:true})); })()");
        assert.equal(await evaluate("!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('Save Meal Options'))"), false);
        const drinkText = await evaluate("document.querySelector('section[aria-label=\"Drink Choices\"]')?.innerText ?? ''");
        assert.match(drinkText, /Mango|Cola|Large/);
        assert.deepEqual(await evaluate("[...document.querySelectorAll('section[aria-label=\"Drink Choices\"] input[type=number]')].map(e=>e.value)"), ["15", "0", "10"]);
        assert.deepEqual(await evaluate("[...document.querySelectorAll('section[aria-label=\"Drink Choices\"] input[type=checkbox]')].map(e=>e.checked)"), [true, true, false]);
        if (width === 390) {
          assert.ok(await setInput('section[aria-label="Drink Choices"] input[type=number]', "17"));
          assert.equal(await evaluate("document.querySelector('section[aria-label=\"Drink Choices\"] input[type=number]').value"), "17");
          await evaluate("document.querySelector('section[aria-label=\"Drink Choices\"] input[type=checkbox]').click()");
          assert.equal(await evaluate("document.querySelector('section[aria-label=\"Drink Choices\"] input[type=checkbox]').checked"), false);
          assert.ok(await setInput('section[aria-label="Drink Choices"] input[type=number]', "0.001"));
          await evaluate("document.querySelector('section[aria-label=\"Drink Choices\"] button').click()");
          await waitFor("document.body.innerText.includes('Enter a valid drink choice price adjustment to two decimal places.')");
        }
      } else {
        const values = await evaluate("[...document.querySelectorAll('input[aria-label$=\"requested quantity (L)\"]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.value)");
        assert.deepEqual(values, ["0.06", "0.04"]);
        assert.match(await evaluate("document.body.innerText"), /gap 0\.06 L/);
        assert.match(await evaluate("document.body.innerText"), /gap 0\.04 L/);
        assert.doesNotMatch(await evaluate("document.body.innerText"), /0\.039999999|0\.060000000/);
        if (width === 390) {
          const editShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
          await writeFile(path.join(output, "requests-edit-390.png"), Buffer.from(editShot.data, "base64"));
          assert.ok(await setInput('input[aria-label="Vinegar requested quantity (L)"]', "0.0399"));
          await clickText("Review request");
          await waitFor("document.body.innerText.includes('Vinegar: enter a positive quantity with at most 3 decimals.')");
          assert.ok(await setInput('input[aria-label="Vinegar requested quantity (L)"]', "0.04"));
          await clickText("Review request");
          await waitFor("document.body.innerText.includes('Review Request')");
          assert.doesNotMatch(await evaluate("document.body.innerText"), /0\.039999999|0\.060000000/);
        }
      }
      const dimensions = await evaluate("({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})");
      assert.ok(dimensions.scroll <= dimensions.width + 1, `${page} ${width}: horizontal overflow`);
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      await writeFile(path.join(output, `${page}-${width}.png`), Buffer.from(shot.data, "base64"));
      results.push({ page, width, ...dimensions });
    }
  }
  await send("Page.navigate", { url: `${base}?page=menu&emptyMeals=1` });
  await waitFor("!!document.querySelector('section[aria-label=\"Meal Options\"] button')");
  await clickText("Configure meal");
  await waitFor("document.body.innerText.includes('No eligible meals are available for configuration.')");
  assert.deepEqual(await evaluate("[...document.querySelector('section[aria-label=\"Meal Options\"] select').options].map(o=>o.value)"), [""]);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${base}?page=requests` });
  await waitFor("!!document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')");
  await clickText("Request history");
  await waitFor("document.body.innerText.includes('PR-SYNTHETIC-001')");
  await clickText("Open details");
  await waitFor("!!document.querySelector('.manager-export-actions')");
  assert.match(await evaluate("document.body.innerText"), /0\.04 L/);
  const downloads = path.join(output, "downloads");
  await mkdir(downloads, { recursive: true });
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await clickText("Download Text");
  await clickText("PNG");
  for (let n = 0; n < 30; n++) {
    if ((await readdir(downloads)).some((name) => name.endsWith(".png"))) break;
    await pause(100);
  }
  const files = await readdir(downloads);
  assert.ok(files.some((name) => name.endsWith(".txt")) && files.some((name) => name.endsWith(".png")), `text/PNG downloads: ${files}`);
  const txt = await readFile(path.join(downloads, files.find((name) => name.endsWith(".txt"))), "utf8");
  assert.match(txt, /Soy Sauce — 0\.04 L/);
  const historyShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(output, "requests-history-1280.png"), Buffer.from(historyShot.data, "base64"));
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "fixture made no writes");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:58435/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "fixture made no external requests");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ evidence: "synthetic Manager-only browser fixture", results, errors, externalRequests: [] }, null, 2));
  console.log(`PASS: ${results.length} focused renders, selection/clear, drink controls, quantity validation, historical details/text/PNG, empty state; no writes`);
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
