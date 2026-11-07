import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const profile = await mkdtemp(path.join(tmpdir(), "rrj-req-leave-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-proxy-server",
  "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket, id = 0;
const pending = new Map(), errors = [], requests = [], checks = [];
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
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(-700)")}`);
};
const check = (name, actual) => { assert.ok(actual, name); checks.push(name); };
const click = (label) => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&node.textContent.trim()===${JSON.stringify(label)});if(!button)return false;button.click();return true})()`);
try {
  let port;
  for (let n = 0; n < 100; n++) {
    try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]); break; }
    catch { await pause(100); }
  }
  assert.ok(port, "Chrome debugger unavailable");
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
  socket = new WebSocket(targets.find((entry) => entry.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id); pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    else if (message.method === "Network.requestWillBeSent") requests.push({ method: message.params.request.method, url: message.params.request.url });
  });
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-request-shell.html?view=replenishment&requests=sheet&sixItems=1" });
  await waitFor("Boolean(document.querySelector('#request-item-search:not(:disabled)'))");
  check("fresh sheet has no unsaved label", await evaluate("!document.querySelector('.manager-request-unsaved-indicator')"));
  check("manual search", await evaluate("(()=>{const input=document.querySelector('#request-item-search');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'flour');input.dispatchEvent(new Event('input',{bubbles:true}));return true})()"));
  await waitFor("Boolean(document.querySelector('[role=listbox] button'))");
  check("manual add", await evaluate("(()=>{document.querySelector('[role=listbox] button').click();return true})()"));
  await waitFor("Boolean(document.querySelector('.manager-request-unsaved-indicator'))");
  check("sidebar navigation opens leave dialog", await click("Dashboard"));
  await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
  check("stay retains sheet", await click("Stay"));
  await waitFor("!document.querySelector('[role=alertdialog]')");
  check("draft retained after Stay", await evaluate("Boolean(document.querySelector('[aria-label=\"All-Purpose Flour requested quantity (kg)\"]'))"));
  check("browser back opens leave dialog", await evaluate("(()=>{const url=new URL(location.href);url.searchParams.set('view','dashboard');url.searchParams.delete('requests');history.pushState(null,'',url);dispatchEvent(new PopStateEvent('popstate'));return true})()"));
  await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
  check("cancelled back restores request URL", await evaluate("new URLSearchParams(location.search).get('view')==='replenishment'"));
  check("stay after browser back", await click("Stay"));
  await waitFor("!document.querySelector('[role=alertdialog]')");
  check("sidebar navigation reopens dialog", await click("Dashboard"));
  await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
  check("leave confirms navigation", await click("Leave"));
  await waitFor("new URLSearchParams(location.search).get('view')==='dashboard' && !document.querySelector('.manager-request-sheet')");
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-request-shell.html?view=replenishment&requests=sheet&sixItems=1" });
  await waitFor("Boolean(document.querySelector('#request-item-search:not(:disabled)'))");
  check("second sheet accepts quantity edit", await evaluate("(()=>{const input=document.querySelector('#request-item-search');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'flour');input.dispatchEvent(new Event('input',{bubbles:true}));return true})()"));
  await waitFor("Boolean(document.querySelector('[role=listbox] button'))");
  await evaluate("document.querySelector('[role=listbox] button').click()");
  await waitFor("Boolean(document.querySelector('.manager-request-unsaved-indicator'))");
  check("browser back prompts again", await evaluate("(()=>{const url=new URL(location.href);url.searchParams.set('view','dashboard');url.searchParams.delete('requests');history.pushState(null,'',url);dispatchEvent(new PopStateEvent('popstate'));return true})()"));
  await waitFor("Boolean(document.querySelector('[role=alertdialog]'))");
  check("leave after browser back", await click("Leave"));
  await waitFor("new URLSearchParams(location.search).get('view')==='dashboard' && !document.querySelector('.manager-request-sheet')");
  check("no browser exceptions", errors.length === 0);
  check("no external network or writes", requests.every(({ method, url }) => method === "GET" && (url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:"))));
  console.log(`PASS: ${checks.length} shell navigation checks`);
} finally {
  socket?.close();
  chrome.kill();
}
