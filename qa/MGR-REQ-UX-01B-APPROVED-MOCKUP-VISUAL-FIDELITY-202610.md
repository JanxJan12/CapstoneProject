# MGR-REQ-UX-01B — Approved Inventory Requests mockup visual fidelity

**Date:** 2026-10-24 (Asia/Manila)  
**Result:** **ACCEPTED for the local frontend milestone.** Authenticated hosted rendering remains **NOT TESTED**.

## Reference and comparison

The approved `image(20261024-071404).png` was inspected directly and copied, unchanged, to [approved-reference.png](mgr-req-ux-01b-rendered-20261024/approved-reference.png). The local synthetic [fulfilled desktop render](mgr-req-ux-01b-rendered-20261024/fulfilled-1280.png) and [default desktop render](mgr-req-ux-01b-rendered-20261024/default-1280.png) show the implemented content. The focused browser fixture renders the Requests content without the shared Manager sidebar; the sidebar was not edited, but a full-shell pixel comparison is outside this fixture's evidence.

| Approved feature | Implemented result and evidence |
| --- | --- |
| Header and four-stage lifecycle | Green **Prepare Request**, Refresh, compact numbered stages with arrows and short descriptions. Manual Messenger handoff remains expressly manual. [Desktop default](mgr-req-ux-01b-rendered-20261024/default-1280.png). |
| Compact Request Register | Search, status/destination filters, result count, sort, short selectable rows, selected highlight and chevron. The row is one keyboard-operable button. [Register](mgr-req-ux-01b-rendered-20261024/register-1280.png). |
| Selected formal request | Number, revision, status, concise state text, header Actions disclosure, horizontal metadata. [Fulfilled](mgr-req-ux-01b-rendered-20261024/fulfilled-1280.png); [issued](mgr-req-ux-01b-rendered-20261024/default-1280.png). |
| Fulfillment and Receiving | Four compact cards, readable item table with posted acceptance and outstanding amounts, linked draft/posted Receiving records and Open Receiving action. [Linked receipts](mgr-req-ux-01b-rendered-20261024/receipts-1280.png). |
| Audit, document, authoring | Revision and audit disclosures remain available; Actions opens the official document and existing copy/Text/PNG/PDF exports. The document expands in a focus-managed overlay. The existing full-width preparation workspace is retained. [Document](mgr-req-ux-01b-rendered-20261024/document-1280.png); [Prepare](mgr-req-ux-01b-rendered-20261024/prepare-1280.png). |

The reference uses illustrative records, including a Draft register status. The actual guarded request register uses its authoritative issued/partial/fulfilled/closed-short states; no fictional Draft formal-request row was created. Local screenshots use explicitly synthetic records. Visual fidelity here means layout, hierarchy, density and interactions; it is not a claim of pixel identity with the generated reference.

## Behavior and implementation

The active Inventory Requests route opens the register workspace. Once its guarded read completes, the newest issued request is selected deterministically unless a deep link or user choice has priority. An empty register presents Prepare Request. Register/list selection and Back to Requests work on narrow screens. Returning from preparation keeps the in-memory draft and existing unsaved-work guard. Search still operates over the entire returned guarded register; no server pagination or backend search was invented. Sort changes presentation order only.

The principal implementation is in `src/modules/manager/inventory/ManagerRequestsPage.tsx` and scoped rules in `src/styles/theme.css`. The routed default established in MGR-REQ-UX-01 remains in `src/modules/manager/index.tsx`. Focused fixture and checks are `scripts/fixtures/manager-focused.tsx`, `scripts/fixtures/manager-focused-mocks.ts`, and `scripts/verify-mgr-req-ux-01-browser.mjs`. The H-23 source verifier was updated for the approved placement of the Actions menu above fulfillment, while retaining its workflow checks. No Request/Receiving RPC argument, Auth/RLS rule, schema, migration, or server stock rule was changed.

## Verification

| Check | Result | Evidence limit |
| --- | --- | --- |
| `node scripts/verify-mgr-req-ux-01-browser.mjs` | **PASS** | Synthetic browser at 1280/820/390 px: default and deep-link selection, compact keyboard-operable rows, mobile Back/list/detail, filters/sort, partial/fulfilled/multiple receipts, audit/revision, document focus/Escape, empty state, retained authoring, no overflow, browser exception or network write. [Result](mgr-req-ux-01b-rendered-20261024/result.json). |
| `node scripts/verify-inv-export-browser.mjs`; `node scripts/verify-inv-export-pdf.mjs` | **PASS** | Existing Text/PNG/PDF and prior-revision local regressions; 3-line one-page and 36-line three-page rendered PDFs. |
| `node scripts/verify-h23-request-workflow.mjs`; `node scripts/verify-h24-manager-navigation.mjs` | **PASS** | 40 request workflow assertions and 15 mounted Manager destinations. |
| `npm.cmd run typecheck`; `npm.cmd run verify:quality`; `npm.cmd run build` | **PASS** | TypeScript, 11 quality checks, production bundle. |
| Scoped `git diff --check` on active application files | **PASS** | No whitespace errors in the scoped files. Repository-wide check reports pre-existing whitespace in unrelated `supabase/config.toml` and `supabase/tests/verify_receiving_batch_foundation.sql`; neither was edited in this milestone. |
| Authenticated hosted Manager rendering, real request reads and Receiving navigation | **NOT TESTED** | No hosted session, live data change, or deployment was used for this visual milestone. |

Tablet and mobile evidence includes [register 820](mgr-req-ux-01b-rendered-20261024/register-820.png), [selected 820](mgr-req-ux-01b-rendered-20261024/selected-820.png), [register 390](mgr-req-ux-01b-rendered-20261024/register-390.png), [selected 390](mgr-req-ux-01b-rendered-20261024/selected-390.png), and [prepare 390](mgr-req-ux-01b-rendered-20261024/prepare-390.png). Screen-reader and 200% zoom acceptance were not performed.

**Hosted data modifications: NO. Backend migrations: NO. Deployment: NO.** Posted role-play receipt `RR-20261024-D5CCDA2A` and draft `RR-20261024-E3761566` remain untouched. The posted receipt's later authorized reconciliation remains a separate operational decision.
