# CASHIER-RECEIPT-01 — thermal receipt implementation

**Date:** 30 October 2026 (Asia/Manila). **Recommendation:** conditional implementation acceptance for 80 mm output; authenticated Cashier print preview and physical thermal printing remain open. No hosted business record or backend contract was changed.

## Executive summary

The Cashier receipt now uses a compact, monochrome 80 mm layout with recorded receipt, transaction, and order identifiers; original transaction time; item snapshots; applicable financial components; and method-specific payment details. The same content and validation model feeds Walk-in POS success, Dashboard reprint, and Receipts & Sales historical reprint. The existing body-level receipt-only print portal remains in place. In local Chrome rendering, three synthetic receipts produced one narrow PDF page each, including a long-item, many-line order.

## Original limitations and direction

The previous receipt used a large colored header and “Official cashier receipt” wording without a basis for a legal receipt claim. It omitted the linked order number, allowed raw order UUID fallback in place of a recorded transaction number, and could show a missing cash tender as exact payment. Whole-receipt page-break avoidance made long receipts fragile. Earlier Stage 1 evidence showed receipt-only output, but on a large page with substantial unused space. The approved direction was a white, black-text, vertically flowing thermal receipt with dashed rules, readable wrapping, compact metadata, clear total/tender/change, and no invented registration or tax claims.

## Architecture and pre-edit impact map

| Entry point / dependency | Existing path and risk | Implemented boundary |
| --- | --- | --- |
| Walk-in sale | `ReceiptPanel` rendered preview and `ReceiptPrintDocument`; the print action opened the browser dialog. | Both use `ReceiptContent` and `prepareReceipt`. Print is disabled until a complete linked sale is available. |
| Dashboard and historical reprint | Dashboard Recent Receipts and Transaction History open `ReceiptDialog` with authorized `get_cashier_sale` data. | Dialog uses the same model and print surface. Original transaction time/number and stored values remain in use. |
| Historical item/payment mapping | Hydration read item snapshots and payment rows, but discarded `line_total` and conflated missing `cash_received` with paid amount. | Retain optional snapshot `lineTotal` and actual `cashReceived`; do not change the RPC, database, or sale creation. |
| Print isolation | A receipt portal is a direct body child and print CSS hides its siblings. | Preserved. Print CSS sets 72 mm content within an 80 mm driver roll with 4 mm margins; it removes whole-receipt break avoidance. |
| Browser/printer | Chrome page size and headers/footers depend on print settings and the printer driver. | Test harness uses a synthetic 80 mm variable-length page. Production CSS does not impose a fixed height that could truncate long orders. |

The worktree already contained extensive Cashier milestone and unrelated changes before this task. They were preserved. No Customer, Kitchen/KDS, Manager, Rider, migration, RLS, or hosted row was edited.

## Shared recorded-data contract

`prepareReceipt` requires a recorded receipt number and exact order/payment/transaction links, a completed or voided status, verified payment, valid timestamp and item snapshot, and cent-consistent item subtotal and financial totals. It uses stored item `line_total` where supplied, with historical unit price × quantity only as a compatibility fallback. It uses recorded subtotal, fee, discount, tax, grand total, payment method, GCash reference, and actual cash tender. Missing cash tender omits tender/change; it is never silently replaced with the total. Missing or inconsistent critical data shows an explanation and disables printing. A voided record can be labeled in preview but cannot print as a valid sale. Current session cashier/terminal values and customer contact/address are omitted because they are not reliable receipt facts or necessary customer print detail. No present-day menu lookup or new receipt identifier is used.

## Layout and print configuration

Use **80 mm thermal roll**, **100% scale**, the driver's narrow paper setting, and **browser headers/footers off**. Keep margins at 4 mm where configurable, or use the printer's safe printable margins. The print content width is 72 mm. The output is black on white without background graphics or external fonts. Item names and choices wrap; line amounts remain right aligned. Only individual item blocks avoid page splits. The receipt height grows with content.

Chrome and printer drivers may ignore named `@page` or choose their own sheet length. Production CSS deliberately sets no fixed height. If a driver paginates a long roll, select its continuous-roll or variable-length paper mode; otherwise it may add a page break or unused paper. The **58 mm variant is not implemented or verified** because no supported printer profile was available to establish readable width and scaling.

## Exact files changed in this task

- Receipt model and UI: `src/modules/cashier/pos/receiptPresentation.ts`, `ReceiptContent.tsx`, `ReceiptPrintDocument.tsx`, `ReceiptPanel.tsx`, `ReceiptDialog.tsx`, `useWalkInPOSController.ts`.
- Recorded-data mapping: `src/modules/cashier/types.ts`, `api/cashierSaleHydrationApi.ts`, `services/supabaseOrderService.ts`.
- Shared print styling: `src/styles/theme.css`.
- QA: `qa/cashier-receipt-01-regression.mjs`, `cashier-receipt-01-render-evidence.mjs`, `cashier-receipt-01-print-regression.mjs`, `cashier-receipt-01-evidence-20261030/`, this report, and appended manual findings.

## Verification and evidence

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck`; `npm.cmd run build` | **PASS**; build transformed 3,044 modules. |
| Receipt recorded-data scenarios | **PASS**: exact/₱200/₱500 cash against ₱130, insufficient cash, multi-item/long-name, original historical time, GCash reference, fee/discount/tax, missing cash tender/IDs/items, mismatched amounts, and voided flag. |
| Focused POS, IA navigation, DATA-01 historical read model | **PASS** local scripts. These are fixture/source checks, not a new signed-in sale. |
| OPT-03 actions, OPT-04 workflow, OPT-05 shift, FIN-01 financial scenarios | **PASS** local scripts; FIN-01 reported 23 scenarios. |
| Older isolated-stack browser regression script | **BLOCKED**: `qa/cashier-browser-regression-20261014.mjs` exited with `Isolated stack unavailable` before browser actions. This does not indicate a current receipt failure. |
| Targeted `git diff --check` and new-file trailing-whitespace scan | **PASS** with no whitespace findings; Git emitted LF-to-CRLF conversion warnings only. |
| Synthetic Chrome screen render | **PASS** visual inspection of [cash](cashier-receipt-01-evidence-20261030/cash-preview.png), [many items](cashier-receipt-01-evidence-20261030/many-preview.png), and [GCash](cashier-receipt-01-evidence-20261030/gcash-preview.png). Text, line wrapping, totals, and footer were visible. |
| Synthetic Chrome print-to-PDF | **PASS**: [cash](cashier-receipt-01-evidence-20261030/cash-print.pdf) 80.1 × 140 mm, [28 items](cashier-receipt-01-evidence-20261030/many-print.pdf) 80.1 × 324.9 mm, [GCash](cashier-receipt-01-evidence-20261030/gcash-print.pdf) 80.1 × 150 mm; one page each. The fixture applies a measured variable page height only for test PDF generation. |
| Print isolation in actual signed-in app, Chrome interactive Preview | **BLOCKED**: no safely verifiable authenticated browser session in this run. The existing body portal and sibling-hide CSS were retained; synthetic PDF page count does not by itself prove a live Dashboard is absent. |
| Physical 80 mm printer, 58 mm printer | **NOT RUN**: no printer was available. |
| Hosted sale/reprint mutation and real payment/shift/Kitchen actions | **NOT RUN** by scope. Historical access remains through the existing authorized read path. |

## Remaining issues and acceptance

Implementation is ready for a controlled signed-in Cashier review, but end-to-end print acceptance remains **open**. Verify Walk-in, Dashboard, and closed-shift Receipts & Sales print dialogs on an 80 mm driver with headers/footers disabled; check the live page for Dashboard/navigation leakage, repeated content, clipping, and blank trailing paper. Confirm long receipts on the actual printer. A 58 mm option requires a separately verified printer configuration. The stricter recorded-data guard may disable printing for inconsistent legacy sales; the UI explains the reason rather than printing a misleading financial receipt. No historical record was changed to make a fixture pass.
