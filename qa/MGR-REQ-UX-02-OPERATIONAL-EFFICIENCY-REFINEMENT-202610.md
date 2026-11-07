# MGR-REQ-UX-02 — Inventory Requests operational efficiency refinement

**Date:** 2026-10-25 (Asia/Manila)  
**Result:** **PARTIAL — local frontend implemented and focused checks passed; full acceptance remains unverified.**

## Changes

The active `replenishment` Manager route retains the MGR-REQ-UX-01B split workspace. `src/modules/manager/inventory/ManagerRequestsPage.tsx` now uses shorter Request Register rows with number/revision, full wrapping destination and needed date, status, and selected cue. The selected request keeps its identity and all five metadata fields in a tighter strip, uses three count-based summary metrics, and places one contextual next action before the per-item fulfillment table. The item table continues to show backend-provided requested, posted accepted, rejected delivered, and remaining quantities with actual units. The clarification states that draft acceptance is not stock. Linked Receiving rows are shorter, distinguish drafts from posted receipts, show inspector and posted time when supplied, and keep audit IDs in a secondary disclosure. `src/styles/theme.css` scopes the density and green action styling.

The existing `requestWorkflow` helper supplies draft precedence and outstanding-line counts. An issued or partial request with a linked draft offers **Resume Receiving**. An issued request without a draft offers **Record Delivery**; a partial request without a draft offers **Record Additional Delivery**. A fulfilled request offers **View Completed Receipt** when a posted record exists. Restricted or otherwise non-delivery states offer **View Receiving History**. These buttons navigate using the existing `onReceive` callback. Opening or selecting a request does not create a receipt. The receipt list omits a duplicate action for the same resumable draft. Existing server authorization and Receiving eligibility still govern actual writes.

Request preparation, multi-item review, issue confirmation, revision and shortfall controls, issued document, Text/PNG/PDF exports, audit timeline, legacy Requests, and manual Messenger handoff remain in place. No API, RPC, inventory calculation, schema, migration, or posting authority changed. The local fixture gained a `splitNoDraft` variant, and `scripts/verify-mgr-req-ux-02-browser.mjs` records this milestone's browser checks and screenshots.

## Rendered evidence

All images below are real Chrome renders of **synthetic local fixtures**, not authenticated hosted records. The approved [01B reference](mgr-req-ux-01b-rendered-20261024/approved-reference.png) remains the visual baseline.

| View | Screenshot |
| --- | --- |
| Compact desktop register | [register-1280](mgr-req-ux-02-rendered-20261025/register-1280.png) |
| Partial request with linked draft | [selected-1280](mgr-req-ux-02-rendered-20261025/selected-1280.png) |
| Issued request with linked draft | [default-1280](mgr-req-ux-02-rendered-20261025/default-1280.png) |
| Fulfilled request | [fulfilled-1280](mgr-req-ux-02-rendered-20261025/fulfilled-1280.png) |
| Linked receipts | [receipts-1280](mgr-req-ux-02-rendered-20261025/receipts-1280.png) |
| Partial request without draft, additional delivery action | [partial-additional-delivery-1280](mgr-req-ux-02-rendered-20261025/partial-additional-delivery-1280.png) |
| Preparation | [prepare-1280](mgr-req-ux-02-rendered-20261025/prepare-1280.png) |
| Tablet selected request and action | [selected-820](mgr-req-ux-02-rendered-20261025/selected-820.png), [action-820](mgr-req-ux-02-rendered-20261025/selected-action-820.png) |
| Mobile register, selected request, and action | [register-390](mgr-req-ux-02-rendered-20261025/register-390.png), [selected-390](mgr-req-ux-02-rendered-20261025/selected-390.png), [action-390](mgr-req-ux-02-rendered-20261025/selected-action-390.png) |

The compact header, three summary counts, and next action bring the fulfillment table into the initial desktop view. The 820/390 px layouts retain the register/detail switch and Back to Requests. Browser checks found no horizontal page overflow at these widths.

## Verification

| Command | Result | Scope |
| --- | --- | --- |
| `npm.cmd run typecheck` | **PASS** | TypeScript source. |
| `npm.cmd run build` | **PASS** | Production bundle. |
| `npm.cmd run verify:quality` | **PASS** | 11 non-workflow quality checks. |
| `node scripts/verify-h23-request-workflow.mjs` | **PASS** | 40 Request workflow assertions. |
| `node scripts/verify-h24-manager-navigation.mjs` | **PASS** | 15 Manager destinations and audit-to-item continuity. |
| `node scripts/verify-mgr-req-ux-01-browser.mjs` | **PASS** | Prior split-workspace browser regression at 1280/820/390 px. |
| `node scripts/verify-mgr-req-ux-02-browser.mjs` | **PASS** | Register selection, filters/sort, deep links, partial/fulfilled balances, draft/post distinctions, next actions including explicit additional-delivery callback, multiple receipts, revisions, audit, authoring/issue, no browser exceptions or external/network writes. [Result](mgr-req-ux-02-rendered-20261025/result.json). |
| `node scripts/verify-inv-export-browser.mjs`; `node scripts/verify-inv-export-pdf.mjs` | **PASS** | Text/PNG/PDF exports, revision snapshots, 3-line and 36-line PDFs. |
| `node scripts/verify-mgr-rec-ux-02-browser.mjs` | **PASS** | Separate local Receiving fixture: explicit draft, inspection/save, synthetic post, posted receipt at 1280/820/390 px. |

The browser fixture checks keyboard row selection, visible focus behavior, labels, status text, and no horizontal overflow. **NOT TESTED:** screen reader acceptance, 200% zoom, authenticated hosted Manager rendering, hosted request ordering/permissions, and actual physical delivery/stock posting. These need a separate safe acceptance session. The focused fixtures exclude the shared Manager sidebar from screenshot comparison.

**Hosted business writes: NO. Hosted synthetic receipts: NO. Backend migration: NO. Deployment: NO.** Protected `RR-20261024-D5CCDA2A`, `RR-20261024-E3761566`, `PR-20261023-000004`, and `PR-20261013-000001` were not changed. No concrete local defect remains from these checks; the untested acceptance items above keep the milestone at PARTIAL.
