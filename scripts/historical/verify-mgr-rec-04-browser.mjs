import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:5173/scripts/fixtures/mgr-rec-04.html";
const output = path.resolve("qa/mgr-rec-04-rendered-20261024");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-rec-04-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map();
const errors = [], requests = [], checks = [];
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
  for (let n = 0; n < 120; n++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,500)")}; ${errors.join(" | ")}`);
};
const shot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
  await writeFile(path.join(output, name), Buffer.from(result.data, "base64"));
};
const click = (label) => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length&&x.textContent.trim()===${JSON.stringify(label)});if(!b)return false;b.click();return true})()`);
const visible = (selector) => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)})?.getClientRects().length)`);
const noOverflow = () => evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1");
const setInput = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);

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
    if (message.method === "Network.requestWillBeSent") requests.push({ url: message.params.request.url, method: message.params.request.method });
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await mkdir(output, { recursive: true });
  for (const width of [1280, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await send("Page.navigate", { url: `${base}?page=stock-receiving&mgrRec=1` });
    await waitFor("document.querySelector('#awaiting-production-heading')?.getClientRects().length && document.body.innerText.includes('PR-20261023-000004')");
    assert.equal(await visible("#receiving-document-details"), false, "editor appears below queue");
    assert.equal(await visible('[aria-label="Receiving documents"]'), true);
    assert.match(await evaluate("document.querySelector('[aria-label=\"Receiving documents\"]').innerText"), /RR-20261012-000002[\s\S]*RR-20261012-000001/);
    if (width === 1280) {
      assert.equal(await click("Draft"), true);
      await waitFor("!document.querySelector('[aria-label=\"Receiving documents\"]')?.innerText.includes('RR-20261012-000001')");
      assert.equal(await click("Posted"), true);
      await waitFor("!document.querySelector('[aria-label=\"Receiving documents\"]')?.innerText.includes('RR-20261012-000002')");
      assert.equal(await click("All"), true);
      await waitFor("document.querySelector('[aria-label=\"Receiving documents\"]')?.innerText.includes('RR-20261012-000002')");
      assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('[aria-label=\"Receiving documents\"] li')].find(x=>x.textContent.includes('RR-20261012-000002'));const b=row?.querySelector('button');if(!b)return false;b.click();return true})()"), true);
      await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length && document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-20261012-000002')");
      assert.equal(await visible("#receiving-line-editor"), true, "existing draft did not open in the editor");
      assert.equal(await click("← Back to queue"), true);
      await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length");
    }
    assert.equal(await noOverflow(), true, `queue overflow at ${width}px`);
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0);
    await shot(`queue-${width}.png`);
    assert.equal(await evaluate("(()=>{const b=[...document.querySelectorAll('li')].find(x=>x.textContent.includes('PR-20261023-000004'))?.querySelector('button');if(!b)return false;b.click();return true})()"), true);
    await waitFor("document.body.innerText.includes('Start linked Receiving · PR-20261023-000004')");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 0, "request selection created a draft");
    assert.equal(await click("Start Receiving"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length && document.body.innerText.includes('RR-SYNTHETIC')");
    await waitFor("document.activeElement?.id === 'receiving-workspace-heading'");
    assert.equal(await visible("#awaiting-production-heading"), false, "queue appears in editor");
    assert.equal(await visible("#receiving-line-editor"), true);
    assert.equal(await visible("#receiving-review"), true);
    assert.equal(await noOverflow(), true, `workspace overflow at ${width}px`);
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1);
    await shot(`draft-${width}.png`);
    assert.equal(await click("← Back to queue"), true);
    await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length && document.body.innerText.includes('Resume Receiving')");
    await waitFor("document.activeElement?.id === 'receiving-queue-heading'");
    assert.equal(await visible("#receiving-document-details"), false);
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1, "back to queue created another draft");
    assert.equal(await click("Resume Receiving"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length && document.querySelector('#receiving-workspace-heading')?.innerText.includes('RR-SYNTHETIC')");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1, "resume created another draft");
    assert.equal(await click("← Back to queue"), true);
    await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length");
    assert.equal(await click("Continue RR-SYNTHETIC"), true);
    await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length");
    assert.equal(await evaluate("(window.__mgrRecStarts||[]).length"), 1, "continuing draft created another draft");
    checks.push({ width, queue: true, workspace: true, draftPreserved: true, overflow: false });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${base}?populated=draft` });
  await waitFor("document.querySelector('#receiving-review')?.getClientRects().length");
  assert.match(await evaluate("document.querySelector('#receiving-review').innerText"), /Accepted quantities that will enter stock[\s\S]*Chicken thigh[\s\S]*\+1 kg/);
  assert.equal(await visible("#receiving-line-editor"), true);
  assert.equal(await setInput("line-delivered", "3"), true);
  assert.equal(await setInput("line-accepted", "2"), true);
  await waitFor("document.querySelector('#receiving-line-editor')?.innerText.includes('1 kg')");
  assert.equal(await evaluate("[...document.querySelectorAll('#receiving-review button')].some(b=>b.textContent.includes('Review & Post')&&b.disabled)"), true, "unsaved inspection was postable");
  assert.equal(await noOverflow(), true);
  await evaluate("document.querySelector('#receiving-review').scrollIntoView()");
  await shot("review-desktop.png");
  await send("Page.navigate", { url: `${base}?populated=posted` });
  await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length && document.body.innerText.includes('Completed delivery record')");
  assert.equal(await visible("#receiving-line-editor"), false, "posted receipt has an editor");
  assert.equal(await visible("#receiving-review"), false, "posted receipt has a post action");
  assert.equal(await visible("#receiving-saved-lines"), true);
  await shot("posted-desktop.png");
  await send("Page.navigate", { url: `${base}?page=stock-receiving&mgrRecError=1` });
  await waitFor("document.querySelector('[aria-labelledby=awaiting-production-heading] [role=alert]')?.getClientRects().length");
  await send("Page.navigate", { url: `${base}?slow=1` });
  await waitFor("document.body.innerText.includes('Loading receiving workspace')");
  await waitFor("document.querySelector('#receiving-queue-heading')?.getClientRects().length");
  assert.equal(await click("Supplier or emergency receipt"), true);
  await waitFor("document.querySelector('#receiving-workspace-heading')?.getClientRects().length && document.body.innerText.includes('Manager emergency exception')");
  assert.equal(await evaluate("Boolean(document.querySelector('#receiving-source option[value=direct_supplier]'))"), true);
  await send("Page.navigate", { url: `${base}?paginate=1` });
  await waitFor("document.querySelector('[aria-label=\"Receiving documents\"]')?.innerText.includes('Page 1')");
  assert.equal(await click("Next"), true);
  await waitFor("document.querySelector('[aria-label=\"Receiving documents\"]')?.innerText.includes('Page 2')");
  assert.equal(await click("Previous"), true);
  await waitFor("document.querySelector('[aria-label=\"Receiving documents\"]')?.innerText.includes('Page 1')");
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "browser made a network write");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:5173/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "external request");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ checks, draftReview: true, postedReadOnly: true, filters: true, pagination: true, focus: true, loading: true, requestError: true, supplierEmergencyEntry: true, errors, externalRequests: [], networkWrites: 0 }, null, 2));
  console.log("PASS: queue/workspace desktop and mobile, draft preservation, review, posted read-only, error, no overflow or network writes");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
