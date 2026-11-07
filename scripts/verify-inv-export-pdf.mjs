import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const pdfjs = await import(pathToFileURL(path.join(tmpdir(), "rrj-inv-export-pdfcheck/node_modules/pdfjs-dist/legacy/build/pdf.mjs")));
const root = path.resolve("qa/inv-export-01-rendered-20261023");
const results = [];
for (const [name, lineCount] of [["issued", 3], ["long", 36]]) {
  const bytes = await readFile(path.join(root, `${name}.pdf`));
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pageTexts = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pageTexts.push(text);
    assert.ok(content.items.every((item) => item.transform[5] >= 0 && item.transform[5] <= page.view[3]), "text within page height");
  }
  const text = pageTexts.join(" ");
  assert.match(text, /PR-SYNTHETIC-EXPORT/);
  assert.match(text, /Revision 2/);
  assert.match(text, /Issued revision 2/);
  assert.doesNotMatch(text, /Partially received|Fulfilled/i);
  assert.match(text, /2\.125/);
  assert.match(text, /12\s+packs/);
  assert.match(text, /0\.375/);
  assert.match(text, /Long & <special> 'quoted'/);
  for (let index = 1; index <= lineCount; index++) {
    const itemId = `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
    assert.ok(pageTexts.some((page) => page.includes(itemId)), `item ${index} ID on a page`);
    if (index > 3) assert.ok(pageTexts.some((page) => page.includes(`Synthetic item ${index}`) && page.includes(itemId)), `item ${index} remains with ID on same page`);
  }
  assert.ok(pageTexts.every((page) => page.includes("ITEM / ID") || page.includes("Item ID:")), "each printed page retains item context");
  assert.match(pageTexts.at(-1), /Request document only/);
  results.push({ file: `${name}.pdf`, pages: pdf.numPages, lines: lineCount, pageTextCharacters: pageTexts.map((page) => page.length),
    firstAndLastText: pageTexts.map((page) => [page.slice(0, 90), page.slice(-120)]) });
  await pdf.destroy();
}
await writeFile(path.join(root, "pdf-verification.json"), JSON.stringify(results, null, 2));
console.log(`PASS: ${results.map((result) => `${result.file} ${result.pages} page(s), ${result.lines} item lines`).join("; ")}`);
