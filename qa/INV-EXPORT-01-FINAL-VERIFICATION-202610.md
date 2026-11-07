# INV-EXPORT-01 — Final verification (23 October 2026)

## Decision

**ACCEPTED for the local Inventory Requests export milestone.** The two scoped P2 defects are corrected. Evidence is from synthetic immutable snapshots in a local browser fixture and browser-generated PDFs; no hosted order, request, Receiving, or inventory data was changed.

## Root causes and contract

1. `ManagerRequestsPage.tsx` built Copy Text, Download Text, and PNG from a separate text formatter that omitted `inventory_item_id`; `requestPrintHtml` included it. The paths now use one `RequestDocumentData` built from the saved `RequestSnapshot`.
2. The issued PDF model accepted the live request-register `status`, so the printed badge could change as Receiving progressed. The model now derives the fixed label `Issued revision N` from the saved revision. The Manager's live fulfillment badge remains in the operational interface.

`RequestSnapshot` in `inventoryRequestApi.ts` contains the issued request number, revision, issuer and timestamps, priority, destination, and each line's inventory item ID, name, quantity, and unit. `20261012181744_manager_inventory_request_documents.sql` stores revision snapshots separately from the mutable request register. Export functions use the snapshot; they do not edit either record.

## Changes

| File | Scoped change |
| --- | --- |
| `src/modules/manager/inventory/requestDocument.ts` | Added `issuedRequestDocument` and `requestDocumentText`; issued print title/status use the revision; retained HTML escaping and draft warning; reduced print cell padding from 3 mm to 2 mm so the long-document footer remains on its final item page. |
| `src/modules/manager/inventory/ManagerRequestsPage.tsx` | Copy, text download, PNG, current PDF, and prior-revision display/download use the same issued snapshot model. PNG wraps measured text and sizes its canvas to the resulting lines. |
| `scripts/fixtures/manager-focused-mocks.ts`, `scripts/fixtures/manager-focused.tsx` | Added synthetic Rev 1/Rev 2 export and draft print routes, with simulated current fulfillment states. |
| `scripts/verify-inv-export-browser.mjs`, `scripts/verify-inv-export-pdf.mjs` | Added focused browser, download, print, pagination, and PDF-content checks. PDF text inspection used `pdfjs-dist@4` installed under a temporary directory, outside the repository. |

## Cross-format and historical comparison

Synthetic Rev 2 was `PR-SYNTHETIC-EXPORT`, issued 19 Oct 2026, 12:15 AM Manila by Synthetic Manager, needed 21 Oct 2026, 8:00 AM Manila, priority `priority`, destination Production. Copy Text and Download Text were byte-identical. Their issued label, number/revision, dates, item IDs, quantities, and units matched the PNG and print/PDF content. Examples:

| Line | Text and PNG | PDF/print |
| --- | --- | --- |
| Chicken | `Chicken — 2.125 kg`; `Item ID: ...0001` | Chicken, `...0001`, `2.125`, `kg` |
| Rice | `Rice — 12 packs`; `Item ID: ...0002` | Rice, `...0002`, `12`, `packs` |
| Special name | `Long & <special> 'quoted'... — 0.375 L`; `...0003` | Escaped HTML rendered as text, `...0003`, `0.375`, `L` |

The operational detail changed between **Issued**, **Partially received**, and **Fulfilled**. Copy Text content remained exactly equal in all three states; the Export PDF button produced exactly equal print HTML in all three states. Neither export contained a live fulfillment label. Rev 1 retained its original Chicken `1 kg` line and ID; Rev 2 retained Chicken `2.125 kg` plus its additional lines. No current-register accepted/remaining values were substituted for issued quantities.

The draft print route remained `Draft · Not issued`, displayed `DRAFT PREVIEW — Not issued or sent`, and did not receive an issued-revision heading. Exporting still does not send a Messenger message or post Receiving.

## Rendered evidence

- [Short issued PNG](inv-export-01-rendered-20261023/issued-short.png): actual downloaded 1200 px image; three lines, IDs, precision, and notice are legible with no visible clipping or overlap.
- [Long issued PNG](inv-export-01-rendered-20261023/issued-long.png): actual downloaded 1200 × 3678 px image; 36 lines and all IDs visible, with notice after line 36.
- [Issued print HTML capture](inv-export-01-rendered-20261023/issued-print-html.png), [long print HTML capture](inv-export-01-rendered-20261023/long-print-html.png), and [draft print HTML capture](inv-export-01-rendered-20261023/draft-print-html.png) show the browser-rendered document templates.
- Chrome `Page.printToPDF` generated [issued.pdf](inv-export-01-rendered-20261023/issued.pdf) and [long.pdf](inv-export-01-rendered-20261023/long.pdf). PDF text extraction confirmed the request reference/revision, fixed status, all 3/36 IDs, fractional and integer quantities, and row identity on each page. The short document is one page; the long document is three pages. Each long page retains item/table context; the footer is on the final item page. [PDF verification summary](inv-export-01-rendered-20261023/pdf-verification.json).

An auxiliary Node PDF raster-preview attempt could not display text with its local canvas renderer. The browser-generated PDFs themselves were inspected through extracted page text and text coordinates, and the source print layout was inspected visually in Chrome. This is not a physical-printer or manual Save as PDF dialog test.

## Checks

| Check | Result |
| --- | --- |
| Focused browser fixture: copy, text download, PNG, three current statuses, Rev 1/2, draft, print button | **PASS** |
| Browser-generated PDF content and pagination (3 and 36 lines) | **PASS** |
| Existing `verify-manager-focused-refinements.mjs` | **PASS** |
| Existing `verify-h23-request-workflow.mjs` | **PASS**, 40 checks |
| `npm.cmd run verify:quality` | **PASS**, 11 checks |
| `npm.cmd run typecheck` | **PASS** |
| `npm.cmd run build` | **PASS** |
| Browser fixture network and runtime | **PASS**: loopback GET/HEAD only; no external requests, writes, or browser exceptions |
| Hosted authenticated export and real Messenger/physical print | **NOT TESTED**; outside this local synthetic verification |

No migration or deployment was run. No hosted business data was written. Existing issuance, Receiving, stock, authorization, and historical database snapshots were not modified. The worktree's pre-existing uncommitted changes were preserved.
