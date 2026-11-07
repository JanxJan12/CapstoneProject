import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const evidence = join(import.meta.dirname, "cashier-receipt-01-evidence-20261030");
const heights = new Map();
for (const name of ["cash", "many", "gcash"]) {
  const pdf = readFileSync(join(evidence, `${name}-print.pdf`), "latin1");
  const count = Number(pdf.match(/\/Count (\d+)/)?.[1]);
  const box = pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  assert.ok(box, `${name}: missing page dimensions`);
  const widthMm = Number(box[1]) * 25.4 / 72;
  const heightMm = Number(box[2]) * 25.4 / 72;
  assert.equal(count, 1, `${name}: unexpected blank or split page`);
  assert.ok(widthMm >= 79.5 && widthMm <= 80.5, `${name}: not an 80 mm print page`);
  assert.ok(heightMm >= 50 && heightMm <= 400, `${name}: unexpected roll length`);
  heights.set(name, heightMm);
}
assert.ok(heights.get("many") > heights.get("cash"), "Many-item receipt did not grow vertically");
console.log("Cashier RECEIPT-01 synthetic Chromium 80 mm PDF dimensions and page counts: PASS");
