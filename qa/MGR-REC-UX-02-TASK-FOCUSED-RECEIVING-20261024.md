# MGR-REC-UX-02 — Task-Focused Receiving Workflow

**Date:** 2026-10-24 (Asia/Manila)  
**Result:** Frontend implemented. Focused local synthetic browser and source/build checks pass. Authenticated hosted acceptance remains **NOT TESTED**.

## Approved four-view fidelity

The referenced ChatGPT conversation confirms approval of the four-view direction. `/mnt/data/a_clean_ui_ux_mockup_dashboard_image_with_multiple.png` was not accessible from this Windows workspace, so pixel-level image comparison is **NOT VERIFIED**. The side-by-side check below uses the user's locked description; synthetic fixture records and quantities are illustrative.

| Approved view | Implemented active route | Rendered evidence |
| --- | --- | --- |
| Receiving Register: full-width compact work queue | Register takes the full content width at all tested sizes, with status/search filters, awaiting requests, draft and posted receipts. Receipt history is expanded initially. A virtual awaiting request requires **Record Delivery → Start Receiving** before an RPC-created draft exists. | [Desktop 1280](mgr-rec-ux-02-rendered-20261024/register-1280.png), [tablet 820](mgr-rec-ux-02-rendered-20261024/register-820.png), [mobile 390](mgr-rec-ux-02-rendered-20261024/register-390.png) |
| Inspect Delivery: dedicated receipt, item list and one contextual inspector | Selecting a draft replaces the register with a full-width receipt. The issued request item list and focused editable line inspector share one view. Delivery details, real revision/inspector context, line validation, expiry policy, and Save Line remain. There is no separate item page or seven-panel accordion stack. | [Desktop](mgr-rec-ux-02-rendered-20261024/inspect-1280.png), [tablet](mgr-rec-ux-02-rendered-20261024/inspect-820.png), [mobile](mgr-rec-ux-02-rendered-20261024/inspect-390.png) |
| Review & Post: saved lines and accepted-only expectation | A dedicated stage leads with saved delivered/accepted/rejected lines and the explicit Review & Post action. Linked balance and multiple-delivery controls remain below. The final confirmation repeats each line and expected accepted-only stock change. Unsaved changes, empty drafts, in-progress saves, and uncertain posting keep the action guarded. | [Desktop](mgr-rec-ux-02-rendered-20261024/review-1280.png), [tablet](mgr-rec-ux-02-rendered-20261024/review-820.png), [mobile](mgr-rec-ux-02-rendered-20261024/review-390.png), [confirmation](mgr-rec-ux-02-rendered-20261024/confirmation-1280.png) |
| Posted Receipt: immutable read-only document | Posted lines and stock links lead, followed by receipt metadata, linked request/delivery balance and audit history. No line editor or post action is visible. Existing Manager route links can open item stock, movements, and original request. | [Desktop](mgr-rec-ux-02-rendered-20261024/posted-1280.png), [tablet](mgr-rec-ux-02-rendered-20261024/posted-820.png), [mobile](mgr-rec-ux-02-rendered-20261024/posted-390.png) |

## Scope and preservation

- The active `StockReceivingPage` and register presentation changed. `ReceivingAccordion` gained a static section mode; its disclosure mode remains available. Existing Receiving RPC calls, server-derived physical inspector, Auth/RLS, request revision, supplier/emergency and partial/multiple-delivery paths were retained.
- Save Line still persists a draft only. `post_receiving_report(uuid)` remains the stock, batch, and ledger authority and the only posting call. The existing pending-post/session lock and uncertain-result reconciliation remain.
- The local fixture blocks an invalid line, saves one corrected line, preserves values after a simulated service failure, guards unsaved navigation, and records one accepted-only synthetic post. It does not prove hosted stock or ledger mutation.
- Posted `RR-20261024-D5CCDA2A` and draft `RR-20261024-E3761566` were not accessed or changed. No hosted data write, migration, or deployment was performed.

## Verification

| Check | Result | Limit |
| --- | --- | --- |
| `node scripts/verify-mgr-rec-ux-02-browser.mjs` | **PASS** | Local fixture at 1280/820/390: four views, no document overflow, explicit draft start, invalid-line guard, saved line, accepted-only synthetic post, posted read-only, unit labels (`pcs`, `L`), save failure/input retention, unsaved navigation, supplier/emergency entry, zero external or write requests. [Result](mgr-rec-ux-02-rendered-20261024/result.json). |
| `node scripts/verify-receiving-draft-authoring.mjs` | **PASS 65/65** | Source/SQL contract assertions; no database execution. The saved-lines title assertion was updated for the new presentation. |
| `node scripts/verify-receiving-posting.mjs` | **PASS 42/42** | Source/SQL contract assertions; no database execution. |
| H-23 request workflow / H-24 Manager navigation | **PASS 40 / 15** | Local source/offline checks. |
| Typecheck / 11 quality checks / production build | **PASS** | Local repository checks. |
| Prior Receiving browser scripts | **Updated 2026-10-25** | MGR-REC-04/06 entry points now run this expanded four-view gate and pass; their original layout assertions are preserved in `scripts/historical/`. MGR-UX-07/08 still describe historical presentation and are not current gates. The active verifier includes the retained item/save/unit/post guards plus resume/focus, edit identity, pagination, error/loading, and unsaved-refresh checks. See the [03C reconciliation](MGR-REQ-UX-03C-SUGGESTED-ITEM-TABLE-OPTIMIZATION-202610.md). |
| Authenticated hosted read-only route inspection | **NOT TESTED** | Still needed to confirm loaded bundle, real request revision and inspector labels, linked receipt/stock/movement destinations, and posted/draft presentation without writing operational data. |
| Authenticated hosted Save Line/Post and real stock/ledger | **NOT TESTED** | Deliberately excluded from this frontend-only milestone. Requires separately authorized isolated acceptance and current recovery safeguards before any hosted write. |

The earlier MGR-REC-UX-01/01B layout descriptions are historical. This milestone replaces their split register and seven document accordions on the active route.
