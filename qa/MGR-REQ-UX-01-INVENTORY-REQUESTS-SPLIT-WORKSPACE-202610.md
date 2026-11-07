# MGR-REQ-UX-01 — Inventory Requests split workspace

**Date:** 2026-10-24 (Asia/Manila)  
**Local result:** IMPLEMENTED AND VERIFIED. **Overall acceptance: PARTIAL** until an authenticated Manager session is checked.  
**Scope:** The active Manager Inventory Requests route and focused local fixtures only.

## What changed

The previous screen switched between a full-page unsaved request sheet, a full-page register, and a full-page selected request. The active `replenishment` route now opens a compact Request Register beside the selected formal request at desktop width. At tablet/mobile widths, the register and selected detail switch views with **Back to Requests**; selection, search, and filters remain in state. The existing authoring sheet remains a focused full-width workspace and opens directly when an inventory item is sent from Stock Overview.

The register shows actual number/revision/status, destination, Manila issue and needed dates, line-level outstanding context, and the next supported action. It searches number, item, linked receipt, issuer, and status across the complete currently returned guarded `get_inventory_request_register()` result. Status and destination filters operate on that result. The current RPC returns the complete authorized register without paging; no page-local search is presented as a full-history backend query. Refresh invalidates stale details while the read is pending. A selected request outside active filters stays open with an explicit notice; a missing request is identified as unavailable.

The detail panel preserves current-revision identity, authoritative status, metadata, per-item requested/posted-accepted/rejected/outstanding values, posted receipt count, draft and posted linked receipts, shortfall controls, revision snapshots, and actual event history. Its official document can expand to an opaque, keyboard-dismissible page overlay for long references or multi-item requests. Copy Text, Download Text, PNG, and browser print/PDF remain on the same issued snapshot. The four-stage guide explicitly states that Messenger handoff is manual and exports do not establish delivery.

## Source and contract boundary

Modified application files: `src/modules/manager/inventory/ManagerRequestsPage.tsx`, `src/modules/manager/index.tsx`, and scoped Request styles in `src/styles/theme.css`. The active route was traced to the lazy-loaded `ManagerRequestsPage`; no similarly named legacy page was substituted. The routed default now opens Request History while explicit item preparation opens the existing authoring sheet. Request/detail state remains represented in Manager URL state for deep links and Back/Forward navigation.

The UI reuses `get_inventory_request_proposal`, `get_inventory_request_register`, `issue_inventory_request`, `revise_inventory_request`, and `close_inventory_request_short` through existing `inventoryRequestApi.ts`. No RPC argument, Auth/RLS rule, table, or migration changed. The returned `lines` already calculate accepted and rejected only from **posted** Receiving reports and remaining from requested minus posted accepted; this UI does not recalculate stock or count draft acceptance. The returned `receipts` provide number, status, inspector, and posted time; draft receipt time and per-receipt quantity are not present in this read and are not fabricated. Issuance/revision validation, confirmation, and server authority remain in the established authoring flow.

Focused fixture/test files: `scripts/fixtures/manager-focused.tsx`, `manager-focused-mocks.ts`, and new `scripts/verify-mgr-req-ux-01-browser.mjs`. Fixture records are synthetic and used only in the local browser. Existing uncommitted work was preserved without resetting, stashing, or cleaning.

## Verification

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `node scripts/verify-mgr-req-ux-01-browser.mjs` | **PASS** | 1280/820/390 px local fixture. Register selection and stale-detail switch; number/item search, empty result, status and destination filters; partial and fulfilled quantities; two posted receipts plus one draft; linked receipt callback; actual fixture events and prior revision; expanded document; existing authoring; local mocked multi-item issue only after explicit review/action; no document overflow, browser exception, external request, or network write. |
| `node scripts/verify-inv-export-browser.mjs` | **PASS** | Existing local export regression: issued/partial/fulfilled official content equality, Copy Text, Text and PNG downloads, prior revision, draft, and 3/36-row browser PDF; no writes. |
| `node scripts/verify-inv-export-pdf.mjs` | **PASS** | Rendered local PDF: 3 item lines on one page and 36 item lines across three pages. |
| `node scripts/verify-h23-request-workflow.mjs` | **PASS** | 40 offline Request workflow/source assertions. |
| `node scripts/verify-h24-manager-navigation.mjs` | **PASS** | 15 Manager destinations and audit-to-item continuity assertions. |
| `npm.cmd run typecheck`; `npm.cmd run verify:quality`; `npm.cmd run build` | **PASS** | TypeScript; 11 quality checks; production bundle. |
| Authenticated hosted Manager route, issue/revise, and real linked receipt navigation | **NOT TESTED** | No hosted record was read or mutated for this milestone. Local fixture results do not prove hosted acceptance. |

Screenshots and machine result: [MGR-REQ-UX-01 rendered evidence](mgr-req-ux-01-rendered-20261024/result.json), including `register-1280.png`, `selected-1280.png`, `selected-820.png`, `selected-390.png`, and `document-390.png`. The visual review found and corrected an expanded-document layering defect before the final successful rerun.

## Remaining limits and next action

The authorized register RPC currently returns a complete JSON result. Large-history latency and response size were not measured against hosted data. The local fixture has no real Manager JWT, so authenticated permissions, live request ordering, hosted revision snapshots, and browser interaction with real Receiving documents remain unverified. The approved mockup image itself was not included with this pasted directive or found in the local project references; visual implementation followed its written design requirements, and exact image-to-screen comparison remains unverified. Screen reader and 200% zoom acceptance were not run; the focused browser checks cover keyboard dismissal/focus affordances and page overflow only.

Next, conduct a **read-only authenticated Manager walkthrough** of the active route with existing requests, including a multi-item request and one with multiple receipts. Record render/search timing and confirm the current revision and linked Receiving IDs. Any operational issue, revision, posting, or reconciliation requires its own authorization and safe test context.

**Hosted data changes: NO. Backend migrations: NO. Deployment: NO.** Preserve posted `RR-20261024-D5CCDA2A` linked to `PR-20261023-000003` and unposted `RR-20261024-E3761566` linked to `PR-20261023-000004` without alteration.
