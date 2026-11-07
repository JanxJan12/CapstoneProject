import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { POSOrderSidebar } from "./src/modules/cashier/pos/POSOrderSidebar.tsx";
      import { POSOrderHeader } from "./src/modules/cashier/pos/POSOrderHeader.tsx";
      import { CategorySidebar } from "./src/modules/cashier/pos/CategorySidebar.tsx";
      import { ProductCard } from "./src/modules/cashier/pos/ProductCard.tsx";
      import { addCartItem, calculatePOSTotals, duplicateCartLine, getOrderSummaryAvailability, getPlaceOrderAvailability, setCartLineQuantity, transitionTransactionState } from "./src/modules/cashier/pos/posOperations.ts";
      import { POSTransactionState } from "./src/modules/cashier/pos/types.ts";
      export { React, renderToStaticMarkup, POSOrderSidebar, POSOrderHeader, CategorySidebar, ProductCard, addCartItem, calculatePOSTotals, duplicateCartLine, getOrderSummaryAvailability, getPlaceOrderAvailability, setCartLineQuantity, transitionTransactionState, POSTransactionState };
    `,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});

const bundleDir = await mkdtemp(join(tmpdir(), "rrj-pos-qa-"));
const bundlePath = join(bundleDir, "render.cjs");
await writeFile(bundlePath, bundle.outputFiles[0].contents);
const {
  React, renderToStaticMarkup, POSOrderSidebar, POSOrderHeader,
  CategorySidebar, ProductCard, addCartItem, calculatePOSTotals,
  duplicateCartLine, getOrderSummaryAvailability, getPlaceOrderAvailability,
  setCartLineQuantity, transitionTransactionState, POSTransactionState,
} = createRequire(import.meta.url)(bundlePath);
await rm(bundleDir, { recursive: true, force: true });

const item = { id: "synthetic-item", code: "S1", name: "Synthetic meal", category: "Viands", price: 130, available: true };
const line = { lineId: "line-1", menuItemId: item.id, name: item.name, unitPrice: 130, quantity: 2 };
const noop = () => {};
const sidebar = renderToStaticMarkup(React.createElement(POSOrderSidebar, {
  items: [line], orderNumber: "TEST-1", orderType: "Dine-in",
  subtotal: 260, taxAmount: 0, taxEnabled: false, total: 260,
  shiftOpen: true, busy: false, canContinue: true, expanded: true,
  onToggle: noop, onOpenShift: noop, onAdjust: noop,
  onQuantityChange: noop, onRemove: noop,
  onReorder: noop, onClear: noop, onPayment: noop,
}));
for (const label of [
  "Quantity for Synthetic meal", "Decrease Synthetic meal",
  "Increase Synthetic meal", "Remove Synthetic meal",
  "Clear order", "Take payment", "₱260.00",
]) assert.ok(sidebar.includes(label), `Current Order is missing ${label}`);
assert.ok(!sidebar.includes("Review order"), "Redundant review action remains in Current Order");
assert.ok(!sidebar.includes("Edit choices for Synthetic meal"), "Redundant edit action remains in Current Order");
assert.ok(!sidebar.includes("Duplicate Synthetic meal"), "Duplicate action remains in Current Order");
assert.match(sidebar, /Remove Synthetic meal[^>]*>.*?Remove/);

const collapsed = renderToStaticMarkup(React.createElement(POSOrderSidebar, {
  items: [line], orderNumber: "TEST-1", orderType: "Dine-in",
  subtotal: 260, taxAmount: 0, taxEnabled: false, total: 260,
  shiftOpen: true, busy: false, canContinue: true, expanded: false,
  onToggle: noop, onOpenShift: noop, onAdjust: noop,
  onQuantityChange: noop, onRemove: noop,
  onReorder: noop, onClear: noop, onPayment: noop,
}));
assert.match(collapsed, /2<\/strong>/);
assert.ok(collapsed.includes("₱260.00"));

const header = renderToStaticMarkup(React.createElement(POSOrderHeader, {
  orderType: "Take-out", busy: false, shiftOpen: true, heldOrders: [],
  hasItems: true, canCancel: true,
  search: { value: "", resultCount: 0, recentSearches: [], onChange: noop,
    onCommit: noop, onMove: noop, onEnter: noop, onEscape: noop },
  onNew: noop, onHold: noop, onCancel: noop, onReopen: noop,
  onSelectOrderType: noop,
}));
assert.match(header, /aria-label="Order type"/);
assert.match(header, /aria-pressed="false"[^>]*>.*?Dine-in/);
assert.match(header, /aria-pressed="true"[^>]*>.*?Takeout/);
for (const label of ["New", "Hold", "Cancel draft order"]) {
  assert.ok(header.includes(`aria-label="${label}"`), `Missing action label: ${label}`);
}

const categories = renderToStaticMarkup(React.createElement(CategorySidebar, {
  menuItems: [item], value: "All", showUnavailable: false, onChange: noop,
}));
assert.ok(!categories.includes("Best sellers"));
const product = renderToStaticMarkup(React.createElement(ProductCard, {
  item, quantity: 0, bestSeller: true, keyboardActive: false,
  onSelect: noop, onQuickAdd: noop,
}));
assert.ok(product.includes("Popular"));

assert.equal(getOrderSummaryAvailability([line], {}, [item]).canContinue, true);
assert.equal(getOrderSummaryAvailability([line], {}, [{ ...item, available: false }]).canContinue, false);
assert.equal(
  transitionTransactionState(POSTransactionState.ORDERING, "proceedToPayment", true),
  POSTransactionState.PAYMENT,
);
const secondItem = { ...item, id: "synthetic-second", code: "S2", name: "Second meal", price: 45 };
let cart = addCartItem([], item).cart;
cart = addCartItem(cart, secondItem).cart;
assert.equal(calculatePOSTotals(cart, { orderType: "Dine-in", paymentMethod: "Cash", amountTendered: 0 }).total, 175);
cart = setCartLineQuantity(cart, cart[0].lineId, 3);
assert.equal(calculatePOSTotals(cart, { orderType: "Dine-in", paymentMethod: "Cash", amountTendered: 0 }).total, 435);
cart = setCartLineQuantity(cart, cart[0].lineId, 2);
assert.equal(calculatePOSTotals(cart, { orderType: "Take-out", paymentMethod: "Cash", amountTendered: 0 }).total, 305);
cart = duplicateCartLine(cart, cart[1].lineId, [item, secondItem]).cart;
assert.equal(calculatePOSTotals(cart, { orderType: "Take-out", paymentMethod: "Cash", amountTendered: 0 }).total, 350);
cart = cart.filter((entry) => entry.menuItemId !== secondItem.id);
assert.equal(calculatePOSTotals(cart, { orderType: "Take-out", paymentMethod: "Cash", amountTendered: 0 }).total, 260);
const cashForm = { orderType: "Take-out", paymentMethod: "Cash", amountTendered: 200 };
assert.equal(getPlaceOrderAvailability(cart, cashForm, [item, secondItem], 260, 200).canPlace, false);
assert.equal(getPlaceOrderAvailability(cart, { ...cashForm, amountTendered: 300 }, [item, secondItem], 260, 300).canPlace, true);
assert.equal(getPlaceOrderAvailability(cart, { ...cashForm, amountTendered: 300 }, [{ ...item, available: false }, secondItem], 260, 300).canPlace, false);
assert.equal(calculatePOSTotals([], cashForm).total, 0);
console.log("Cashier POS controlled optimization: PASS");
