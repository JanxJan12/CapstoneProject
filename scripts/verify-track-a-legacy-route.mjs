import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const routes = read("../src/app/routes.tsx");
const roles = read("../src/data/accountRole.ts");
const legacyApi = read("../src/modules/manager/inventory/replenishmentApi.ts");
const managerRequests = read("../src/modules/manager/inventory/ManagerRequestsPage.tsx");
const receiving = read("../src/modules/manager/inventory/StockReceivingPage.tsx");
const smoke = read("./demo/browser-smoke.mjs");
const provisioning = read("./demo/provision-defense-demo.mjs");

assert.match(routes, /path: "manager"[\s\S]*?<RequireAuth role="manager">/);
assert.doesNotMatch(routes, /path: "production"/);
assert.doesNotMatch(roles, /"production"/);
const productionModule = new URL("../src/modules/production/", import.meta.url);
assert.ok(!existsSync(productionModule) || readdirSync(productionModule).length === 0);
assert.doesNotMatch(legacyApi, /createReplenishmentRequest|create_replenishment_request|advance_replenishment_request/);
assert.match(legacyApi, /get_replenishment_requests/);
assert.match(legacyApi, /start_replenishment_receiving/);
assert.match(managerRequests, /<ReplenishmentPage onReceive=\{onReceiveLegacy\}/);
assert.match(receiving, /getReplenishmentRequests\(\)/);
assert.doesNotMatch(smoke, /'production'/);
assert.doesNotMatch(provisioning, /'production'/);
console.log("PASS Track A route and role boundary; Manager legacy read/Receiving remains mounted");
