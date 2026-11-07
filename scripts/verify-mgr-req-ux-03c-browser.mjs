import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const output = path.resolve(process.env.RRJ_REQ_CAPTURE_DIR ?? "qa/mgr-req-ux-04-rendered-20261025");
const profile = await mkdtemp(path.join(tmpdir(), "rrj-mgr-req-ux-03c-"));
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
  throw new Error(`Timed out: ${expression}; ${await evaluate("document.body.innerText.slice(0,900)")}; ${errors.join(" | ")}`);
};
const click = (label) => evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.getClientRects().length&&node.textContent.includes(${JSON.stringify(label)}));if(!button)return false;button.click();return true})()`);
const setInput = (selector, value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
const setSelect = (selector, value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const toggle = (label) => evaluate(`(()=>{const node=[...document.querySelectorAll('input[type=checkbox]')].find(node=>node.getClientRects().length&&node.getAttribute('aria-label')===${JSON.stringify(label)});if(!node)return false;node.click();return true})()`);
const screenshot = async (name) => {
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(output, name), Buffer.from(shot.data, "base64"));
};
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
  await mkdir(output, { recursive: true });
  for (const width of [1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    if (width === 1280) {
      await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&longItemName=1" });
      await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
      assert.equal(await click("Prepare Request"), true);
      await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 4");
      await screenshot("after-four-1280.png");
    }
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&longItemName=1&sixItems=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    await waitFor("document.body.innerText.includes('Suggested items to review')");
    const rowSelector = width < 900 ? ".manager-request-mobile-line" : ".manager-request-edit-table tbody tr";
    assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length`), 6, `${width}: proposal rows shown before selection`);
    assert.equal(await evaluate("document.body.innerText.includes('0 selected items')"), true, `${width}: no auto selection`);
    assert.equal(await evaluate(`(()=>{const rows=[...document.querySelectorAll(${JSON.stringify(rowSelector)})];return rows.every(row=>row.querySelector('input[data-request-item-id]'))})()`), true, `${width}: every suggested row has an editable quantity before selection`);
    assert.equal(await evaluate(`(()=>[...document.querySelectorAll(${JSON.stringify(rowSelector)})].every(row=>!row.querySelector('button[aria-label^="Remove "]')))()`), true, `${width}: untouched suggestions expose no Remove action`);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'));return row?.querySelector('input[data-request-item-id]')?.value})()`), "0", `${width}: true zero gap is displayed`);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Soy Sauce'));return row?.querySelector('input[data-request-item-id]')?.value})()`), "0.06", `${width}: backend gap keeps its precision before selection`);
    if (width === 1280) assert.equal(await evaluate("(()=>{const rows=[...document.querySelectorAll('.manager-request-edit-table tbody tr')];return rows.every(row=>row.getBoundingClientRect().height>=44 && Number(getComputedStyle(row.querySelector('.manager-request-item-name')).fontWeight)<=400 && Number(getComputedStyle(row.querySelector('input[data-request-item-id]')).fontWeight)<=400)})()"), true, "readable rows and normal-weight ordinary table text, including wrapped names");
    if (width === 1280) assert.equal(await evaluate("(()=>{const wrap=document.querySelector('.manager-request-table-wrap'),table=wrap?.querySelector('table'),row=table?.querySelector('tbody tr'),pill=row?.querySelector('.manager-request-status-pill'),info=row?.querySelector('.manager-request-guidance');return wrap?.getAttribute('role')==='region'&&wrap.scrollWidth<=wrap.clientWidth+1&&parseFloat(getComputedStyle(row.cells[1]).fontSize)>=13&&parseFloat(getComputedStyle(row.cells[7].querySelector('input')).fontSize)>=14&&pill.getBoundingClientRect().right<=info.getBoundingClientRect().left+1&&row.cells[1].getBoundingClientRect().left>=wrap.getBoundingClientRect().left&&row.cells[9].getBoundingClientRect().right<=wrap.getBoundingClientRect().right+1})()"), true, "readable item, quantity, status, and action columns fit together without table scrolling");
    if (width === 1280) assert.equal(await evaluate("(()=>{const name=[...document.querySelectorAll('.manager-request-item-name')].find(el=>el.textContent.includes('extended community'));return name&&name.getBoundingClientRect().height>20&&name.scrollWidth<=name.clientWidth+1})()"), true, "long item name wraps in the visible item column");
    assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-add-item input[type=search]'))"), true, "manual catalog search retained");
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'));return row?.textContent.includes('bottles')&&row?.textContent.includes('Expiry unverified')&&row?.querySelector('summary')?.getAttribute('aria-label').includes('Open requests cover the current shortage')})()`), true, `${width}: catalog unit and accessible zero-gap advisory`);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Food packs for the extended'));return Boolean(row&&row.textContent.includes('packs'))})()`), true, `${width}: long catalog name and unit`);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'));return row?.querySelectorAll('details').length===1 && !row.querySelector('details').open && row.textContent.includes('0')})()`), true, `${width}: one collapsed guidance disclosure with zero gap`);
    if (width === 1280) assert.equal(await evaluate("(()=>{const rows=[...document.querySelectorAll('.manager-request-edit-table tbody tr')];return rows.every(r=>r.querySelector('.manager-request-status-pill'))&&rows.filter(r=>!r.textContent.includes('extended community')).every(r=>r.getBoundingClientRect().height<=52)})()"), true, "compact aligned status rows");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: no page overflow`);
    if (width < 1280) await evaluate(`document.querySelector(${JSON.stringify(rowSelector)})?.scrollIntoView({block:'center'})`);
    await screenshot(`suggestions-${width}.png`);
    if (width === 1280) {
      assert.equal(await evaluate("(()=>{const wrap=document.querySelector('.manager-request-table-wrap');const first=wrap.querySelector('tbody tr td:first-child').getBoundingClientRect(),name=wrap.querySelector('tbody tr td:nth-child(2)').getBoundingClientRect(),edge=wrap.getBoundingClientRect();return wrap.scrollLeft===0&&Math.abs(first.left-edge.left)<3&&Math.abs(name.left-first.right)<3})()"), true, "selection and item identity align at the table edge");
      await screenshot("scrolled-table-1280.png");
      await evaluate("document.querySelector('.manager-request-table-wrap').scrollLeft=0");
      assert.equal(await evaluate("(()=>{const input=document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]');input.focus();return document.activeElement===input})()"), true, "quantity can receive keyboard focus before selection");
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38 });
      await waitFor("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value === '0.061'");
    }
    assert.equal(await setInput("input[aria-label='Soy Sauce requested quantity (L)']", "0.07"), true);
    await waitFor(`document.querySelector(${JSON.stringify(rowSelector + " input[aria-label='Soy Sauce requested quantity (L)']")})?.value === '0.07'`);
    assert.equal(await evaluate("document.body.innerText.includes('0 selected items')"), true, `${width}: quantity edit alone does not select`);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    await waitFor("document.body.innerText.includes('1 selected item')");
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(rowSelector + " input[aria-label='Soy Sauce requested quantity (L)']")})?.value`), "0.07", `${width}: edit before selection is retained`);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    await waitFor("document.body.innerText.includes('0 selected items')");
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    await waitFor("document.body.innerText.includes('1 selected item')");
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(rowSelector + " input[aria-label='Soy Sauce requested quantity (L)']")})?.value`), "0.07", `${width}: deselect and reselect retain edit`);
    assert.equal(await setInput("input[aria-label='Soy Sauce requested quantity (L)']", "0.06"), true);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    await waitFor("document.body.innerText.includes('0 selected items')");
    if (width === 1280) {
      for (const label of ["Select Soy Sauce (L)", "Select Vinegar (L)", "Select Rice (kg)"]) assert.equal(await toggle(label), true);
      await waitFor("document.body.innerText.includes('3 selected items')");
      assert.equal(await evaluate("(()=>{const button=document.querySelector('button[aria-label=\"Remove Soy Sauce from request\"]');button?.focus();return button&&document.activeElement===button})()"), true, "selected row Remove receives keyboard focus");
      assert.equal(await evaluate("(()=>{const rows=[...document.querySelectorAll('.manager-request-edit-table tbody tr')];return rows.filter(r=>r.querySelector('input[type=checkbox]')?.checked).length===3&&rows.filter(r=>!r.textContent.includes('extended community')).every(r=>r.getBoundingClientRect().height<=52)})()"), true, "three valid selections keep compact rows; intentionally long name may wrap");
      await screenshot("selected-valid-1280.png");
      assert.equal(await setInput("input[aria-label='Buko Juice requested quantity (bottles)']", "2"), true);
      assert.equal(await click("Review request"), true);
      await waitFor("Boolean(document.querySelector('.manager-request-review'))");
      assert.equal(await evaluate("(()=>{const rows=[...document.querySelectorAll('.manager-request-review table tbody tr')];return rows.length===3 && rows.every(row=>!row.textContent.includes('Buko Juice')) && rows.some(row=>row.textContent.includes('Soy Sauce')&&row.textContent.includes('0.06'))})()"), true, "unselected edited quantity stays out of review");
      assert.equal(await evaluate("window.__issuePayload === undefined"), true, "review does not issue");
      assert.equal(await click("Back to edit"), true);
      await waitFor("Boolean(document.querySelector('.manager-request-edit-table'))");
      assert.equal(await setInput("input[aria-label='Buko Juice requested quantity (bottles)']", "0"), true);
      for (const label of ["Select Soy Sauce (L)", "Select Vinegar (L)", "Select Rice (kg)"]) assert.equal(await toggle(label), true);
      await waitFor("document.body.innerText.includes('0 selected items')");
    }
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'));const details=row?.querySelector('details');details?.querySelector('summary')?.click();return details?.open&&details.textContent.includes('Usable at need')&&details.textContent.includes('Recorded minimum')&&details.textContent.includes('Open requests')&&details.textContent.includes('Provisional gap')})()`), true, `${width}: actual-value guidance opens`);
    await evaluate(`[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'))?.scrollIntoView({block:'center'})`);
    await screenshot(`guidance-${width}.png`);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'));row?.querySelector('summary')?.click();return !row?.querySelector('details')?.open})()`), true, `${width}: guidance closes`);
    assert.equal(await evaluate("window.__issuePayload === undefined"), true);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    await waitFor("document.body.innerText.includes('1 selected item')");
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(rowSelector)}+' input[aria-label="Soy Sauce requested quantity (L)"]')?.value`), "0.06", `${width}: scale-aware suggestion`);
    assert.equal(await toggle("Select Buko Juice (bottles)"), true);
    await waitFor("document.body.innerText.includes('2 selected items')");
    assert.equal(await click("Review request"), true);
    await waitFor("document.body.innerText.includes('Buko Juice: enter a positive quantity')");
    assert.equal(await evaluate(`(()=>{const input=[...document.querySelectorAll('input[aria-label="Buko Juice requested quantity (bottles)"]')].find(n=>n.getClientRects().length);return input?.getAttribute('aria-invalid')==='true'&&input?.getAttribute('aria-describedby')&&document.getElementById(input.getAttribute('aria-describedby'))?.textContent.includes('Enter a quantity greater than 0.')})()`), true, `${width}: input-linked quantity error`);
    await evaluate(`[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'))?.scrollIntoView({block:'center'})`);
    await screenshot(`invalid-${width}.png`);
    if (width === 1280) assert.equal(await evaluate("(()=>{const row=[...document.querySelectorAll('.manager-request-edit-table tbody tr')].find(r=>r.textContent.includes('Buko Juice'));return row?.getBoundingClientRect().height<=52})()"), true, "invalid quantity does not expand desktop row");
    assert.equal(await setInput("input[aria-label='Buko Juice requested quantity (bottles)']", "2.5"), true);
    assert.equal(await click("Review request"), true);
    await waitFor("document.body.innerText.includes('Buko Juice: enter a positive quantity with at most 0 decimals')");
    assert.equal(await setInput("input[aria-label='Buko Juice requested quantity (bottles)']", "2"), true);
    assert.equal(await click("Review request"), true);
    await waitFor("document.body.innerText.includes('Buko Juice: explain the suggested quantity override')");
    if (width === 1280) assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Buko Juice'));const summary=row?.querySelector('.manager-request-override summary');summary?.click();return Boolean(summary&&row.querySelector('.manager-request-override')?.open&&row.querySelector('input[aria-label="Buko Juice override reason"]')?.getClientRects().length)})()`), true, "desktop override explanation opens visibly");
    assert.equal(await setInput("input[aria-label='Buko Juice override reason']", "Manager reviewed the zero gap"), true);
    assert.equal(await toggle("Select Buko Juice (bottles)"), true);
    await waitFor("document.body.innerText.includes('1 selected item')");
    assert.equal(await evaluate("window.__issuePayload === undefined"), true, "selection and review validation do not issue");
    if (width === 1280) {
      assert.equal(await evaluate("(()=>{const summary=[...document.querySelectorAll('.manager-request-edit-table .manager-request-guidance summary')].find(n=>n.closest('tr')?.textContent.includes('Buko Juice'));summary.focus();return document.activeElement===summary})()"), true, "guidance summary keyboard focus");
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await waitFor("[...document.querySelectorAll('.manager-request-edit-table tbody tr')].find(r=>r.textContent.includes('Buko Juice'))?.querySelector('.manager-request-guidance')?.open");
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await waitFor("![...document.querySelectorAll('.manager-request-edit-table tbody tr')].find(r=>r.textContent.includes('Buko Juice'))?.querySelector('.manager-request-guidance')?.open");
      assert.equal(await evaluate("(()=>{const checkbox=document.querySelector('input[aria-label=\"Select Buko Juice (bottles)\"]');checkbox.focus();return document.activeElement===checkbox})()"), true, "checkbox can receive keyboard focus");
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await waitFor("document.querySelector('input[aria-label=\"Select Buko Juice (bottles)\"]').checked");
      assert.equal(await toggle("Select Buko Juice (bottles)"), true);
      assert.equal(await setSelect(".manager-request-add-item select", "flour"), true);
      assert.equal(await click("Add item"), true);
      await waitFor("document.querySelector('.manager-request-edit-table')?.textContent.includes('All-Purpose Flour')");
      assert.equal(await evaluate("document.querySelector('input[aria-label=\"Select All-Purpose Flour (kg)\"]')?.checked"), true, "non suggested catalog item remains manually addable");
      assert.equal(await evaluate("document.querySelectorAll('.manager-request-edit-table tbody tr').length"), 7, "manual row joins proposal-backed workspace");
      assert.equal(await evaluate("window.__issuePayload === undefined"), true);
    }
    await screenshot(`selected-${width}.png`);
    checks.push({ width, proposalRows: true, longName: true, consolidatedWarning: true, guidanceDisclosure: true, checkboxSelection: true, quantityValidation: true, noOverflow: true });
  }
  for (const width of [1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&coveredGaps=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    const rowSelector = width < 900 ? ".manager-request-mobile-line" : ".manager-request-edit-table tbody tr";
    await waitFor(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length === 6`);
    assert.equal(await evaluate(`[...document.querySelectorAll(${JSON.stringify(rowSelector)}+' input[data-request-item-id]')].every(input=>input.value==='0')`), true, `${width}: genuine zero gaps remain zero`);
    assert.equal(await evaluate("!document.body.innerText.includes('All displayed suggested gaps are 0') && document.body.innerText.includes('0 selected items')"), true, `${width}: no repeated zero-gap banner or automatic selection`);
    assert.equal(await evaluate(`(()=>{const help=[...document.querySelectorAll('.manager-request-gap-help')].find(node=>node.getClientRects().length);help?.querySelector('summary')?.click();return help?.open&&help.textContent.includes('A zero gap can still mean low or no usable stock.')})()`), true, `${width}: zero-gap explanation is available on demand`);
    await screenshot(`covered-gaps-help-${width}.png`);
    assert.equal(await evaluate("(()=>{const help=[...document.querySelectorAll('.manager-request-gap-help')].find(node=>node.getClientRects().length);help?.querySelector('summary')?.click();return !help?.open})()"), true, `${width}: zero-gap help closes without changing selections`);
    assert.equal(await evaluate("(()=>{const rows=[...document.querySelectorAll('.manager-request-edit-table tbody tr, .manager-request-mobile-line')].filter(row=>row.getClientRects().length);const noStock=rows.find(row=>row.textContent.includes('Food packs'));const covered=rows.find(row=>row.textContent.includes('Soy Sauce'));return noStock?.querySelector('.manager-request-status-pill')?.textContent==='No usable stock'&&covered?.querySelector('.manager-request-status-pill')?.textContent==='Open requests'})()"), true, `${width}: status separates physical stock from open requests`);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: zero-gap view has no page overflow`);
    await screenshot(`covered-gaps-${width}.png`);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Soy Sauce'));return row?.querySelector('.manager-request-status-pill')?.textContent==='Open requests' && row?.querySelector('input[data-request-item-id]')?.getAttribute('aria-invalid')!=='true'})()`), true, `${width}: selecting a zero suggestion does not turn the row into an error`);
    assert.equal(await click("Review request"), true);
    await waitFor("document.body.innerText.includes('Soy Sauce: enter a positive quantity')");
    assert.equal(await evaluate("Boolean(document.querySelector('.manager-request-review'))"), false, `${width}: zero selected quantity cannot enter review`);
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1&visualShell=1" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  assert.equal(await click("Prepare Request"), true);
  await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
  for (const label of ["Select Soy Sauce (L)", "Select Vinegar (L)", "Select Rice (kg)"]) assert.equal(await toggle(label), true);
  await waitFor("document.body.innerText.includes('3 selected items')");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, "full Manager shell has no horizontal overflow");
  await pause(700);
  await screenshot("selected-valid-shell-1280.png");
  await send("Emulation.setDeviceMetricsOverride", { width: 1502, height: 856, deviceScaleFactor: 1, mobile: false });
  await pause(200);
  assert.equal(await evaluate("(()=>{const wrap=document.querySelector('.manager-request-table-wrap'),row=wrap?.querySelector('tbody tr');return wrap&&wrap.scrollWidth<=wrap.clientWidth+1&&row.cells[1].getBoundingClientRect().left>=wrap.getBoundingClientRect().left&&row.cells[9].getBoundingClientRect().right<=wrap.getBoundingClientRect().right+1})()"), true, "1502px item and action columns fit without table scrolling");
  assert.equal(await evaluate("(()=>{const side=document.querySelector('.manager-request-authoring-side').getBoundingClientRect();return [...document.querySelectorAll('.manager-request-details input,.manager-request-details select')].every(el=>el.getBoundingClientRect().right<=side.right+1)})()"), true, "request detail controls stay inside the right panel");
  await screenshot("selected-valid-shell-1502.png");
  const visualBounds = await evaluate(`(()=>{const selectors=['.manager-request-sheet','.manager-request-authoring-main','.manager-request-authoring-side','.manager-request-add-item','.manager-request-table-wrap','.manager-request-edit-table tbody tr'];return Object.fromEntries(selectors.map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return [s,r?{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}:null]}))})()`);
  assert.equal(await toggle("Select Soy Sauce (L)"), true);
  assert.equal(await setInput("input[aria-label='Vinegar requested quantity (L)']", "0.08"), true);
  await evaluate("window.__proposalSoyAtNeed = 0.03");
  assert.equal(await click("Refresh suggestions"), true);
  await waitFor("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.value === '0.07'");
  assert.equal(await evaluate("document.querySelector('input[aria-label=\"Vinegar requested quantity (L)\"]')?.value"), "0.08", "manual edit survives refreshed guidance");
  assert.equal(await evaluate("document.querySelector('input[aria-label=\"Soy Sauce requested quantity (L)\"]')?.closest('tr')?.textContent.includes('0.07')"), true, "untouched quantity follows refreshed backend gap");
  for (const width of [1280, 820, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1" });
    await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
    assert.equal(await click("Prepare Request"), true);
    const rowSelector = width < 900 ? ".manager-request-mobile-line" : ".manager-request-edit-table tbody tr";
    await waitFor(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length === 6`);
    await screenshot(`before-working-copy-${width}.png`);
    assert.equal(await setInput("input[aria-label='Soy Sauce requested quantity (L)']", "0.08"), true);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Soy Sauce'));row?.querySelector('button[aria-label="Remove Soy Sauce from request"]')?.click();return Boolean(row)})()`), true);
    await waitFor(`document.querySelector(${JSON.stringify(rowSelector + " input[aria-label='Soy Sauce requested quantity (L)']")})?.value === '0.06'`);
    assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length`), 6, `${width}: suggested row remains after remove`);
    assert.equal(await click("Undo remove"), true);
    await waitFor(`document.querySelector(${JSON.stringify(rowSelector + " input[aria-label='Soy Sauce requested quantity (L)']")})?.value === '0.08'`);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('Soy Sauce'));row?.querySelector('button[aria-label="Remove Soy Sauce from request"]')?.click();return Boolean(row)})()`), true);
    assert.equal(await click("Undo remove"), true);
    await waitFor(`document.querySelector(${JSON.stringify(rowSelector + " input[aria-label='Select Soy Sauce (L)']")})?.checked`);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(rowSelector + " input[aria-label='Soy Sauce requested quantity (L)']")})?.value`), "0.08", `${width}: undo restores selected quantity`);
    assert.equal(await toggle("Select Soy Sauce (L)"), true);
    assert.equal(await setSelect(".manager-request-add-item select", "flour"), true);
    assert.equal(await click("Add item"), true);
    await waitFor(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length === 7`);
    assert.equal(await evaluate(`(()=>{const row=[...document.querySelectorAll(${JSON.stringify(rowSelector)})].find(r=>r.textContent.includes('All-Purpose Flour'));row?.querySelector('button[aria-label="Remove All-Purpose Flour from request"]')?.click();return Boolean(row)})()`), true);
    await waitFor(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length === 6`);
    assert.equal(await click("Undo remove"), true);
    await waitFor(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length === 7`);
    await evaluate("window.confirm=()=>false");
    assert.equal(await click("Clear request"), true);
    assert.equal(await evaluate("document.body.innerText.includes('1 selected item')"), true, `${width}: cancel preserves draft`);
    await evaluate("window.confirm=()=>true");
    assert.equal(await click("Clear request"), true);
    await waitFor(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length === 6`);
    assert.equal(await evaluate("document.body.innerText.includes('0 selected items')"), true, `${width}: clear removes working lines`);
    assert.equal(await setSelect(".manager-request-add-item select", "flour"), true);
    assert.equal(await click("Add item"), true);
    await waitFor(`document.querySelectorAll(${JSON.stringify(rowSelector)}).length === 7`);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), true, `${width}: working copy has no page overflow`);
    await screenshot(`after-working-copy-${width}.png`);
  }
  await send("Page.navigate", { url: "http://127.0.0.1:58435/scripts/fixtures/manager-focused.html?splitWorkspace=1&sixItems=1" });
  await waitFor("Boolean(document.querySelector('[aria-label=\"PR-SPLIT-ISSUED detail\"]'))");
  assert.equal(await click("Prepare Request"), true);
  await waitFor("document.querySelectorAll('.manager-request-edit-table tbody tr').length === 6");
  assert.equal(await setInput("input[aria-label='Buko Juice requested quantity (bottles)']", "2"), true);
  assert.equal(await toggle("Select Soy Sauce (L)"), true);
  await waitFor("document.body.innerText.includes('1 selected item')");
  assert.equal(await click("Review request"), true);
  await waitFor("Boolean(document.querySelector('.manager-request-review'))");
  assert.equal(await click("Issue Request"), true);
  await waitFor("Boolean(window.__issuePayload)");
  assert.equal(await evaluate("window.__issuePayload.lines.length === 1 && window.__issuePayload.lines[0].inventory_item_id === 'soy' && window.__issuePayload.lines[0].quantity === 0.06"), true, "local mock issue receives only the selected line");
  assert.equal(errors.length, 0, `browser exceptions: ${errors.join(" | ")}`);
  assert.ok(requests.every(({ url }) => url.startsWith("http://127.0.0.1:58435/") || url.startsWith("data:") || url.startsWith("blob:")), "external request");
  assert.ok(requests.every(({ method }) => method === "GET"), "network write");
  const result = { result: "PASS", checks, coveredGapsAt1280_820_390: true, zeroQuantityBlockedFromReview: true, editBeforeSelect: true, deselectReselect: true, refreshedSuggestionAndManualEdit: true, unselectedExcludedFromReviewAndLocalIssue: true, visualBounds, browserExceptions: errors.length, externalRequests: 0, networkWrites: 0 };
  await writeFile(path.join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  socket?.close(); chrome.kill(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
