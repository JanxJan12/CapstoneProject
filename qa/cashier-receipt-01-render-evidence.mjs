import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "qa", "cashier-receipt-01-evidence-20261030");
mkdirSync(output, { recursive: true });
const cssFile = readdirSync(join(root, "dist", "assets"))
  .filter((name) => name.endsWith(".css"))
  .map((name) => ({ name, size: readFileSync(join(root, "dist", "assets", name)).length }))
  .sort((a, b) => b.size - a.size)[0]?.name;
if (!cssFile) throw new Error("Build the app before rendering receipt evidence.");
const css = readFileSync(join(root, "dist", "assets", cssFile), "utf8");
const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom" });
let ReceiptContent;
try {
  ({ ReceiptContent } = await server.ssrLoadModule("/src/modules/cashier/pos/ReceiptContent.tsx"));
} finally {
  await server.close();
}

const baseOrder = {
  id: "ORD-000075", customerName: "Walk-in Customer", type: "Dine-in",
  items: [{ id: "item-1", name: "Chicken Bicol Express", unitPrice: 130, lineTotal: 130, quantity: 1 }],
  subtotal: 130, deliveryFee: 0, taxAmount: 0, total: 130,
};
const basePayment = { id: "payment-1", orderId: baseOrder.id, method: "Cash", amount: 130,
  submittedAmount: 500, cashReceived: 500, status: "Verified" };
const baseTransaction = { id: "transaction-1", orderId: baseOrder.id, paymentId: basePayment.id,
  receiptNumber: "RCP-000054", amount: 130,
  method: "Cash", status: "Completed", createdAt: "2026-10-29T04:00:00Z" };

const fixtures = {
  cash: [baseOrder, basePayment, baseTransaction],
  many: [
    { ...baseOrder, id: "ORD-000076", customerName: "",
      items: Array.from({ length: 28 }, (_, index) => ({ id: `item-${index}`,
        name: index === 0 ? "Special Family Meal with extra long recorded description and meal choices" : `Recorded meal ${index + 1}`,
        unitPrice: 10, lineTotal: 10, quantity: 1,
        modifiers: index === 0 ? [{ name: "Extra sauce" }, { name: "With Rice" }] : [] })),
      subtotal: 280, total: 280 },
    { ...basePayment, orderId: "ORD-000076", amount: 280, submittedAmount: 500, cashReceived: 500 },
    { ...baseTransaction, orderId: "ORD-000076", receiptNumber: "RCP-000055",
      amount: 280 },
  ],
  gcash: [
    { ...baseOrder, id: "ORD-000077", type: "Delivery",
      items: [{ ...baseOrder.items[0], unitPrice: 100, lineTotal: 100 }],
      subtotal: 100, deliveryFee: 30, taxAmount: 0 },
    { ...basePayment, orderId: "ORD-000077", method: "GCash", cashReceived: undefined,
      amount: 130, submittedAmount: 130, referenceNumber: "GC-123" },
    { ...baseTransaction, orderId: "ORD-000077", method: "GCash",
      receiptNumber: "RCP-000056" },
  ],
};
for (const [name, [order, payment, transaction]] of Object.entries(fixtures)) {
  const markup = renderToStaticMarkup(React.createElement(ReceiptContent, { order, payment, transaction }));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt fixture ${name}</title><style>${css}</style><style>
    @media screen { body { background:#ece8e2; padding:24px; } #root { display:none; } }
    @media print { @page cashierReceipt { size: 80mm 250mm; margin: 4mm; } }
  </style><style id="dynamic-paper"></style></head><body><div id="root">DASHBOARD MUST NOT PRINT</div>
    <div class="cashier-print-receipt">${markup}</div>
    <script>window.addEventListener('load', () => {
      const height = document.querySelector('.receipt-paper').getBoundingClientRect().height;
      const millimeters = Math.max(60, Math.ceil(height * 25.4 / 96 + 8));
      document.getElementById('dynamic-paper').textContent =
        '@media print { @page cashierReceipt { size: 80mm ' + millimeters + 'mm; margin: 4mm; } }';
      document.body.dataset.paperHeightMm = String(millimeters);
    });</script></body></html>`;
  const path = join(output, `${name}.html`);
  writeFileSync(path, html);
  console.log(`${name}: ${pathToFileURL(path)}`);
}
