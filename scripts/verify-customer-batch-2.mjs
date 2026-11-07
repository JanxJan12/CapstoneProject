import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile("src/modules/customer/customerTrackingUrl.ts", "utf8");
const code = (await transform(source, { loader: "ts", format: "esm", target: "es2022" })).code;
const { customerViewSearch, isCustomerOrderId, parseCustomerViewSearch } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const queueSource = await readFile("src/modules/customer/customerTrackingRefresh.ts", "utf8");
const queueCode = (await transform(queueSource, { loader: "ts", format: "esm", target: "es2022" })).code;
const { createCustomerTrackingRefreshQueue } =
  await import(`data:text/javascript;base64,${Buffer.from(queueCode).toString("base64")}`);

const ownedOrder = "d6f888c0-f250-4a6f-b1f8-d6c2c536e7e0";
assert.equal(isCustomerOrderId(ownedOrder), true);
assert.equal(isCustomerOrderId("../orders"), false);
assert.equal(parseCustomerViewSearch(`?view=tracking&order=${ownedOrder}`).orderId, ownedOrder);
assert.deepEqual(parseCustomerViewSearch("?view=tracking").view, "tracking");
assert.equal(parseCustomerViewSearch("?view=tracking").orderId, null);
assert.equal(parseCustomerViewSearch("?view=tracking&order=bad").fallback, "history");
assert.equal(parseCustomerViewSearch("?view=tracking&order=bad").invalid, true);
assert.equal(parseCustomerViewSearch("?view=unknown").fallback, "home");
assert.equal(parseCustomerViewSearch("?view=menu&order=" + ownedOrder).invalid, true);
assert.equal(parseCustomerViewSearch("?view=tracking&view=home").invalid, true);
assert.equal(parseCustomerViewSearch(`?view=tracking&order=${ownedOrder}&order=${ownedOrder}`).invalid, true);
assert.equal(parseCustomerViewSearch("?view=tracking%00").invalid, true);
assert.equal(parseCustomerViewSearch("?view=tracking&access_token=secret").invalid, true);
assert.equal(parseCustomerViewSearch("").view, null);
assert.equal(parseCustomerViewSearch("?view=history").view, "history");
assert.equal(parseCustomerViewSearch("?view=menu").canonical, "?view=menu");
assert.equal(customerViewSearch("tracking", ownedOrder), `?view=tracking&order=${ownedOrder}`);
assert.equal(customerViewSearch("tracking", "bad"), "?view=tracking");
assert.doesNotMatch(customerViewSearch("tracking", ownedOrder), /token|email|proof|secret/);

let release;
const firstRead = new Promise((resolve) => { release = resolve; });
const queue = createCustomerTrackingRefreshQueue();
let reads = 0;
const read = async () => { reads += 1; if (reads === 1) await firstRead; };
const initial = queue.request(read);
await queue.request(read);
await queue.request(read);
assert.equal(reads, 1, "overlapping events must not start parallel reads");
release();
await initial;
assert.equal(reads, 2, "event burst must produce one follow-up read");
await queue.request(read);
assert.equal(reads, 3, "manual retry must remain available");
queue.dispose();
await queue.request(read);
assert.equal(reads, 3, "navigation away or logout must stop new reads");

let finishOld;
const oldRead = new Promise((resolve) => { finishOld = resolve; });
const oldView = createCustomerTrackingRefreshQueue();
let oldFollowups = 0;
const inFlight = oldView.request(async () => { await oldRead; });
await oldView.request(async () => { oldFollowups += 1; });
oldView.dispose();
const newView = createCustomerTrackingRefreshQueue();
let newReads = 0;
await newView.request(async () => { newReads += 1; });
finishOld();
await inFlight;
assert.equal(oldFollowups, 0, "an old order response must not start a queued old-order read");
assert.equal(newReads, 1, "the new order uses its own refresh queue");

console.log("PASS Customer Batch 2 URL parsing (19 assertions) and refresh coalescing/disposal (6 assertions)");
