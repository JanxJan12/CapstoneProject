# MGR-REC-UX-01 — Simplified Receiving visual redesign

**Date:** 2026-10-24 (Asia/Manila)  
**Scope:** Canonical Manager Receiving frontend, focused local verification

## Implemented

The active Receiving route now places a compact Receiving Register beside the dominant document workspace on desktop. The first existing draft receipt in the returned receipt page opens by default on desktop; if no receipt exists, the document panel explains how to select or start one. At 820 and 390 px, the register and selected document remain separate views with the existing Back action. The register keeps its guarded request and receipt reads, server-paged receipt history, filters, and explicit Start Receiving action. Awaiting requests remain virtual entries; selecting one does not claim that a receipt exists.

The selected document uses **Inspect → Review → Post** as its visual sequence. Document details remain available separately for source, supplier/emergency, and header fields. The item-centered request table, per-item add/edit form, saved-line review, concise readiness state, linked request/revision/receipt count, and posted read-only rendering remain in the workspace. Only the existing confirmed post action can call `post_receiving_report`; the stage strip does not post.

No Receiving API, RPC argument, Auth/RLS rule, migration, stock calculation, item expiry policy, or receipt data was changed. Partial and multiple receipt logic and supplier/emergency authoring remain on their prior handlers.

## Visual evidence

- [Desktop inspection with register](mgr-rec-ux-01-rendered-20261024/inspection-1280.png)
- [Default desktop register and selected receipt](mgr-rec-ux-01-rendered-20261024/register-1280.png)
- [Tablet register](mgr-rec-ux-01-rendered-20261024/register-820.png) and [mobile register](mgr-rec-ux-01-rendered-20261024/register-390.png)
- [Tablet inspection](mgr-rec-ux-01-rendered-20261024/inspection-820.png)
- [Mobile inspection](mgr-rec-ux-01-rendered-20261024/inspection-390.png)
- [Review with unsaved guard](mgr-rec-ux-01-rendered-20261024/review-stage-desktop.png)
- [Posted read-only](mgr-rec-ux-01-rendered-20261024/posted-readonly-desktop.png)
- [Supplier/emergency details](mgr-rec-ux-01-rendered-20261024/supplier-emergency-details.png)

These are local synthetic browser renders without the shared Manager sidebar, not authenticated hosted screenshots. Layout, hierarchy, and interactions follow the accepted Inventory Requests MGR-REQ-UX-01B design; the fixture records are illustrative and were not written to hosted data.

## Verification

| Check | Result | Scope |
| --- | --- | --- |
| `node scripts/verify-mgr-rec-06-browser.mjs` | **PASS** | Synthetic 1280/820/390 browser: register/detail placement, default existing-receipt selection, virtual requests causing no draft creation, three stages, item inspection, unsaved guard, review, posted read-only, supplier/emergency entry, no external or write traffic. |
| `node scripts/verify-receiving-draft-authoring.mjs` | **PASS** | 65 source contract assertions. |
| `node scripts/verify-receiving-posting.mjs` | **PASS** | 42 posting and authority source assertions. |
| `node scripts/verify-mgr-rec-05-model.mjs`; `node scripts/verify-h23-request-workflow.mjs`; `node scripts/verify-h24-manager-navigation.mjs` | **PASS** | Grouping/partial receipt model, 40 request workflow checks, 15 mounted Manager destinations. |
| `npm.cmd run typecheck`; `npm.cmd run verify:quality`; `npm.cmd run build` | **PASS** | TypeScript, 11 quality checks, production bundle. |
| Authenticated hosted Receiving, physical device, real save/post | **NOT TESTED** | No hosted mutation, migration, or deployment was authorized for this visual milestone. |

The older `verify-mgr-rec-compact-browser.mjs` and `verify-mgr-rec-04-browser.mjs` were initially run against the ordinary Vite configuration, where their synthetic service aliases were absent; they failed on unreachable API/port setup. The focused run above used `scripts/fixtures/mgr-rec-04.config.ts`, which binds local synthetic services. Those initial failures are environment setup results, not a hosted or workflow acceptance claim.

Posted `RR-20261024-D5CCDA2A` and draft `RR-20261024-E3761566` were preserved. **Hosted data modifications: NO. Backend migrations: NO. Deployment: NO.**
