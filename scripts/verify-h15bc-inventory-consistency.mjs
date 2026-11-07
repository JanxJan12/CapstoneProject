import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  appendMovementPage,
  claimMovementPageLoad,
  releaseMovementPageLoad,
} from "../src/modules/manager/inventory/movementPage.ts";

const [requests, movements] = await Promise.all([
  readFile(new URL("../src/modules/manager/inventory/ManagerRequestsPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/modules/manager/inventory/InvTransactionsPage.tsx", import.meta.url), "utf8"),
]);

const checks = [
  [
    "register becomes unavailable before refresh and clears stale rows",
    /registerReadyRef\.current = false;[\s\S]*setRegisterReady\(false\);[\s\S]*setRegister\(\[\]\);/.test(requests),
  ],
  [
    "request selection requires a current register",
    /const selected = registerReady && registerVersion === loadVersion\.current\s*\? register\.find/.test(requests),
  ],
  [
    "failed register read exposes retry without replacing search",
    /Current request information could not be retrieved/.test(requests) &&
      /!loading && !registerReady[\s\S]*Try again/.test(requests) &&
      !/setSearch\(""\)/.test(requests),
  ],
  [
    "superseded register reads cannot replace newer results",
    (requests.match(/version !== loadVersion\.current/g) ?? []).length >= 2,
  ],
  [
    "pagination takes a synchronous in-flight guard",
    /claimMovementPageLoad\(moreInFlightVersion, version\)/.test(movements) &&
      /releaseMovementPageLoad\(moreInFlightVersion, version\)/.test(movements),
  ],
  [
    "filter changes invalidate pending pagination",
    /const changeFilters =[\s\S]*requestVersion\.current \+= 1;[\s\S]*cursorRef\.current = null;/.test(movements),
  ],
  [
    "pagination advances cursor only after checked append",
    /const nextRows = appendMovementPage\(rowsRef\.current, page\.rows\);[\s\S]*cursorRef\.current = page\.nextCursor/.test(movements),
  ],
];

for (const [name, passed] of checks) {
  assert.ok(passed, name);
  process.stdout.write(`PASS: ${name}\n`);
}

const first = [{ id: "movement-1" }, { id: "movement-2" }];
assert.deepEqual(appendMovementPage([], first), first);
assert.deepEqual(
  appendMovementPage(first, [{ id: "movement-3" }]).map((row) => row.id),
  ["movement-1", "movement-2", "movement-3"],
);
assert.throws(
  () => appendMovementPage(first, [{ id: "movement-2" }]),
  /repeated stock movement/,
);
assert.throws(
  () => appendMovementPage([], [{ id: "movement-4" }, { id: "movement-4" }]),
  /repeated stock movement/,
);
assert.deepEqual(first.map((row) => row.id), ["movement-1", "movement-2"]);
process.stdout.write("PASS: distinct page append; repeated existing or server page IDs rejected without mutating current rows\n");

const inFlight = { current: null };
assert.equal(claimMovementPageLoad(inFlight, 7), true);
assert.equal(claimMovementPageLoad(inFlight, 7), false);
assert.equal(releaseMovementPageLoad(inFlight, 6), false);
assert.equal(claimMovementPageLoad(inFlight, 8), false);
assert.equal(releaseMovementPageLoad(inFlight, 7), true);
assert.equal(claimMovementPageLoad(inFlight, 8), true);
process.stdout.write("PASS: rapid repeat is blocked and an obsolete completion cannot release a newer page load\n");
