# MGR-REQ-UX-02A — Administrative Actions & Audit History

**Date:** 2026-10-25 (Asia/Manila)  
**Result:** **ACCEPTED — LOCAL FRONTEND.** Authenticated hosted and assistive-technology acceptance are **NOT TESTED**.

## Placement and behavior

The selected request retains the approved split workspace, compact header, three fulfillment counts, contextual Next Action, item balances, and linked Receiving list. The previous bottom **Revision and shortfall options** and **Audit timeline** disclosures are removed from the Document view.

The header **Actions** menu keeps View official document, Copy Text, Download Text, PNG, and Export PDF. It now groups the existing administrative workflows below those document actions. **Prepare new revision** appears only for an `issued` or `partially_received` request with no linked receipts. **Close with shortfall** appears for those open statuses; it requires a nonblank reason and remains disabled while any linked Receiving draft exists. The confirmation, request ID, revision, reason, existing RPC, server authorization, and error handling remain the same. Fulfilled and closed requests have no administrative mutation controls. A pending shortfall reason clears when a different request is selected.

**Document** and **History & Audit** are two views within the selected request panel. Document is the default. History & Audit shows the selected request's existing immutable prior revision snapshots and chronological events with timestamp, revision, actor, explanatory text, and optional recorded details. It offers prior revision Text export. Switching views does not change selection or create a request event. Switching request while History & Audit is open shows the newly selected request's history. Deep links still select the requested document. The tab controls support click, focus, Left/Right arrow, Home, and End. The existing event detail disclosure keeps technical codes and IDs secondary.

## Files changed

- `src/modules/manager/inventory/ManagerRequestsPage.tsx` — action placement, history view, tab state, existing closure handler relocation.
- `src/styles/theme.css` — scoped tab and menu styling, mobile menu bounds, opaque scrollable menu.
- `scripts/fixtures/manager-focused-mocks.ts` — isolated revision-eligible and no-draft cases; read-only shortfall call recorder.
- `scripts/verify-mgr-req-ux-02a-browser.mjs` — focused rendered checks and screenshots.
- `scripts/verify-mgr-req-ux-01-browser.mjs`, `scripts/verify-mgr-req-ux-02-browser.mjs`, `scripts/verify-inv-export-browser.mjs` — earlier regressions now open the relocated history view.
- This report and `qa/MANAGER-MODULE-IMPLEMENTATION-ROADMAP-202610.md`.

No API, RPC contract, schema, migration, Receiving implementation, or inventory calculation changed.

## Rendered evidence

All screenshots are actual Chrome renders of **synthetic local fixture data**, without the shared Manager sidebar.

| View | Screenshot |
| --- | --- |
| Document desktop | [selected-1280](mgr-req-ux-02a-rendered-20261025/selected-1280.png) |
| Actions desktop | [actions-1280](mgr-req-ux-02a-rendered-20261025/actions-1280.png) |
| Revision-eligible menu | [revision-eligible-1280](mgr-req-ux-02a-rendered-20261025/revision-eligible-1280.png) |
| Shortfall reason ready | [shortfall-ready-1280](mgr-req-ux-02a-rendered-20261025/shortfall-ready-1280.png) |
| History desktop | [history-1280](mgr-req-ux-02a-rendered-20261025/history-1280.png) |
| Document, Actions, History tablet | [selected-820](mgr-req-ux-02a-rendered-20261025/selected-820.png), [actions-820](mgr-req-ux-02a-rendered-20261025/actions-820.png), [history-content-820](mgr-req-ux-02a-rendered-20261025/history-content-820.png) |
| Document, Actions, History mobile | [selected-390](mgr-req-ux-02a-rendered-20261025/selected-390.png), [actions-admin-390](mgr-req-ux-02a-rendered-20261025/actions-admin-390.png), [history-content-390](mgr-req-ux-02a-rendered-20261025/history-content-390.png) |

The first mobile render exposed a menu positioned partly outside the viewport with transparent content. A scoped left anchor and opaque scrollable background corrected both; the final browser check asserts menu bounds at 1280/820/390 px.

## Verification

| Command | Result | Evidence limit |
| --- | --- | --- |
| `node scripts/verify-mgr-req-ux-02a-browser.mjs` | **PASS** | Actions/export availability; revision eligibility and launch; draft and reason closure guards; exact synthetic shortfall call arguments; fulfilled restriction; selected-specific history, deep links, tab keyboard behavior; responsive bounds, no horizontal overflow, browser exception, or network write. [Result](mgr-req-ux-02a-rendered-20261025/result.json). |
| `node scripts/verify-mgr-req-ux-01-browser.mjs`; `node scripts/verify-mgr-req-ux-02-browser.mjs` | **PASS** | Prior split workspace and efficiency browser regressions at 1280/820/390 px. |
| `node scripts/verify-inv-export-browser.mjs`; `node scripts/verify-inv-export-pdf.mjs` | **PASS** | Document exports, prior revision snapshot, 3-line and 36-line PDF render. |
| `node scripts/verify-h23-request-workflow.mjs`; `node scripts/verify-h24-manager-navigation.mjs` | **PASS** | 40 Request assertions; 15 Manager destinations. |
| `node scripts/verify-mgr-rec-ux-02-browser.mjs` | **PASS** | Separate local Receiving fixture at 1280/820/390 px, including explicit draft, inspection, synthetic post, and posted receipt. |
| `npm.cmd run typecheck`; `npm.cmd run verify:quality`; `npm.cmd run build` | **PASS** | TypeScript, 11 quality checks, production bundle. |

The local shortfall mock records the original call arguments and rejects the operation without changing records. Actual server authorization and hosted administrative actions were **NOT TESTED**. Screen reader use and native 200% zoom were **NOT TESTED**; keyboard tab switching, focus, labels, and viewport bounds were checked in Chrome. No concrete local defect remains from these focused checks.

**Hosted business writes: NO. Protected records changed: NO. Backend migration: NO. Deployment: NO.** `PR-20261023-000004`, `RR-20261024-E3761566`, `RR-20261024-D5CCDA2A`, and `PR-20261013-000001` were not touched.
