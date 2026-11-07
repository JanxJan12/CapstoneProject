import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cashierHydrationView } from "../src/modules/cashier/cashierHydrationView.ts";

// The first failure must settle into an unavailable state without exposing
// an unhydrated workspace. Clearing the error for Retry restores loading.
assert.deepEqual(
  [
    cashierHydrationView(true, ""),
    cashierHydrationView(true, "Unable to load cashier operations."),
    cashierHydrationView(true, ""),
    cashierHydrationView(false, ""),
  ],
  ["loading", "failed", "loading", "ready"],
);
assert.equal(cashierHydrationView(false, "Refresh failed."), "ready");

const shell = readFileSync("src/modules/cashier/index.tsx", "utf8");
const store = readFileSync("src/modules/cashier/hooks/CashierStore.tsx", "utf8");
assert.match(shell, /cashierHydrationView\(isHydrating, databaseError\)/);
assert.match(shell, /hydrationView === "failed"[\s\S]*?Cashier operations are unavailable\. Use Retry above/);
assert.match(shell, /hydrationView === "loading" && page !== "dashboard"/);
assert.match(shell, /databaseError\s*\? refreshDatabaseState/);
const retry = store.slice(store.indexOf("const refreshDatabaseState = useCallback"), store.indexOf("const actions = useCashierActions"));
assert.match(retry, /setDatabaseRefreshRequest\(\(current\) => current \+ 1\)/);
assert.doesNotMatch(retry, /(?:create|verify|reject|start|close|end)\w*\(/i);

const load = store.slice(store.indexOf("const loadDatabaseState = async"), store.indexOf("void loadDatabaseState();"));
assert.match(load, /setDatabaseError\(""\);[\s\S]*?setIsHydrating\(false\);/);
assert.match(load, /setDatabaseError\(\s*"Unable to load cashier operations/);
assert.doesNotMatch(load, /(?:createWalkInSale|verifyCustomerGcashPayment|rejectCustomerGcashPayment|startCashierShift|closeCashierShift)\(/);
for (const read of [
  "fetchCashierOrders",
  "fetchCurrentShiftCashierSales",
  "fetchCashierOnlinePayments",
  "fetchOpenCashierShift",
  "fetchCashierMenuItems",
]) {
  assert.match(load, new RegExp(`${read}\\(`));
}

console.log("PASS: Cashier initial load, failed load, read-only Retry, and recovery states");
