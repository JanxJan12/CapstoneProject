import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html";
const output = path.resolve("qa/inv-export-01-rendered-20261023");
const downloads = path.join(output, "downloads");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-inv-export-"));
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
  for (let n = 0; n < 100; n++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,500)")}; errors=${errors.join(" | ")}`);
};
const click = (label) => evaluate(`([...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(label)})))?.click()`);
const screenshot = async (filename, captureBeyondViewport = false) => {
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport });
  await writeFile(path.join(output, filename), Buffer.from(shot.data, "base64"));
};
const names = async () => await readdir(downloads);
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
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});window.open=()=>({document:{open(){},write(html){window.__pdfHtml=html;},close(){}},focus(){},requestAnimationFrame(callback){callback();},print(){window.__printInvoked=true;}});" });
  await mkdir(downloads, { recursive: true });
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });

  const texts = [], pdfHtml = [];
  for (const status of ["issued", "partially_received", "fulfilled"]) {
    await send("Page.navigate", { url: `${base}?page=export&export=1&status=${status}` });
    await waitFor("!!document.querySelector('[aria-label=\"PR-SYNTHETIC-EXPORT detail\"] .manager-export-actions')");
    await click("Copy Text");
    await waitFor("typeof window.__copied === 'string'");
    const copied = await evaluate("window.__copied");
    texts.push(copied);
    assert.match(copied, /FORMAL PRODUCTION REQUEST — ISSUED REVISION 2/);
    assert.match(copied, /Chicken — 2\.125 kg\n\s*Item ID: 11111111-1111-4111-8111-000000000001/);
    assert.match(copied, /Rice — 12 packs\n\s*Item ID: 11111111-1111-4111-8111-000000000002/);
    assert.doesNotMatch(copied, /Fulfilled|Partially received/i);
    assert.match(await evaluate("document.querySelector('[aria-label=\"PR-SYNTHETIC-EXPORT detail\"]').innerText"), new RegExp(status === "issued" ? "Issued" : status === "fulfilled" ? "Fulfilled" : "Partially received", "i"));
    await click("Export PDF");
    await waitFor("typeof window.__pdfHtml === 'string' && window.__printInvoked === true");
    const html = await evaluate("window.__pdfHtml");
    assert.match(html, /Issued revision 2/);
    assert.match(html, /11111111-1111-4111-8111-000000000001/);
    assert.doesNotMatch(html, /Partially received|Fulfilled/i);
    pdfHtml.push(html);
    if (status === "issued") {
      await click("Download Text");
      await waitFor("[...document.querySelectorAll('a')].length >= 0");
      for (let n = 0; n < 40 && !(await names()).some((name) => name.endsWith(".txt")); n++) await pause(100);
      const txt = (await names()).find((name) => name.endsWith(".txt"));
      assert.ok(txt, "text download exists");
      assert.equal(await readFile(path.join(downloads, txt), "utf8"), copied);
      await click("PNG");
      let bytes;
      for (let n = 0; n < 50 && !bytes; n++) {
        const png = (await names()).find((name) => name.endsWith(".png"));
        if (png) {
          const current = await readFile(path.join(downloads, png));
          if (current.length > 24 && current.readUInt32BE(20) < 1500) bytes = current;
        }
        if (!bytes) await pause(100);
      }
      assert.ok(bytes, "short PNG download exists");
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
      assert.equal(bytes.readUInt32BE(16), 1200);
      assert.ok(bytes.readUInt32BE(20) >= 800);
      await writeFile(path.join(output, "issued-short.png"), bytes);
    }
  }
  assert.equal(texts[0], texts[1]);
  assert.equal(texts[1], texts[2]);
  assert.equal(pdfHtml[0], pdfHtml[1]);
  assert.equal(pdfHtml[1], pdfHtml[2]);

  await send("Page.navigate", { url: `${base}?page=export&export=1&status=issued&longExport=1` });
  await waitFor("!!document.querySelector('[aria-label=\"PR-SYNTHETIC-EXPORT detail\"] .manager-export-actions')");
  await click("PNG");
  let longPngBytes;
  for (let n = 0; n < 50 && !longPngBytes; n++) {
    const png = (await names()).find((name) => name.endsWith(".png"));
    if (png) {
      const bytes = await readFile(path.join(downloads, png));
      if (bytes.length > 24 && bytes.readUInt32BE(20) > 3000) longPngBytes = bytes;
    }
    if (!longPngBytes) await pause(100);
  }
  assert.ok(longPngBytes, "long PNG download grows with content");
  assert.equal(longPngBytes.readUInt32BE(16), 1200);
  assert.ok(longPngBytes.readUInt32BE(20) > 3000, "long PNG grows with content");
  await writeFile(path.join(output, "issued-long.png"), longPngBytes);

  await send("Page.navigate", { url: `${base}?page=export&export=1&status=fulfilled` });
  await waitFor("Boolean(document.querySelector('#request-history-tab'))");
  await evaluate("document.querySelector('#request-history-tab').click()");
  await waitFor("document.body.innerText.includes('Previous revision snapshots')");
  const prior = await evaluate("[...document.querySelectorAll('pre')].find(e => e.textContent.includes('ISSUED REVISION 1'))?.textContent");
  assert.match(prior, /Chicken — 1 kg/);
  assert.doesNotMatch(prior, /2\.125 kg|Rice — 12 packs/);

  for (const [long, label] of [[false, "issued"], [true, "long"]]) {
    await send("Page.navigate", { url: `${base}?page=print${long ? "&longExport=1" : ""}` });
    await waitFor("document.querySelectorAll('tbody tr').length >= 3");
    const rows = await evaluate("[...document.querySelectorAll('tbody tr')].map(e=>({text:e.innerText,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}))");
    assert.equal(rows.length, long ? 36 : 3);
    assert.ok(rows.every((row, index) => index === 0 || row.top >= rows[index - 1].bottom - 1), "rows do not overlap");
    assert.match(rows[0].text, /Chicken[\s\S]*11111111-1111-4111-8111-000000000001[\s\S]*2\.125[\s\S]*kg/);
    assert.match(rows[2].text, /Long & <special> 'quoted' item name/);
    const layout = await evaluate("({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,bodyHeight:document.body.scrollHeight})");
    assert.ok(layout.scroll <= layout.width + 1, "print document has no horizontal clipping");
    await screenshot(`${label}-print-html.png`, true);
    const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    const bytes = Buffer.from(pdf.data, "base64");
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    assert.ok(bytes.length > 5000);
    await writeFile(path.join(output, `${label}.pdf`), bytes);
  }
  await send("Page.navigate", { url: `${base}?page=printDraft` });
  await waitFor("document.body.innerText.includes('DRAFT PREVIEW')");
  assert.match(await evaluate("document.body.innerText"), /Draft revision 3[\s\S]*Draft · Not issued[\s\S]*DRAFT PREVIEW/);
  await screenshot("draft-print-html.png", true);
  assert.deepEqual(errors, [], "browser exceptions");
  assert.ok(requests.every((request) => ["GET", "HEAD"].includes(request.method)), "fixture made no writes");
  assert.ok(requests.every((request) => request.url.startsWith("http://127.0.0.1:58435/") || request.url.startsWith("data:") || request.url.startsWith("blob:")), "fixture made no external requests");
  await writeFile(path.join(output, "result.json"), JSON.stringify({ evidence: "synthetic immutable revision browser fixture", statusCopiesEqual: true, statusPdfHtmlEqual: true,
    revision1Distinct: true, pngDownloaded: true, longPngHeight: longPngBytes.readUInt32BE(20), pdfFiles: ["issued.pdf", "long.pdf"], pdfRows: [3, 36],
    errors, externalRequests: [] }, null, 2));
  console.log("PASS: copy/download text, PNG, issued/partial/fulfilled equality, prior revision, draft, 3/36-row browser PDF, no writes");
} finally {
  socket?.close(); chrome.kill(); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
