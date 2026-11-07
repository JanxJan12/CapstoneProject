# MGR-UX-07 — Connected Inventory Workflow & Operational Clarity

**Date:** 2026-10-24 (Asia/Manila)  
**Scope:** Canonical Manager Receiving frontend and roadmap. No hosted data write or deployment.

## Changes

- Save Line validation and service failures now appear beside the inspection editor as an accessible alert. Invalid fields receive focus; a failed service save leaves the line unsaved and focuses the local error. This addresses the apparent silent failure path without asserting the uncaptured cause of the `PR-20261023-000004` hosted attempt.
- The linked request explanation separates original quantity, previously posted acceptance, current open amount, acceptance in other saved draft lines, and remaining capacity for this line. Saving remains draft-only; posting remains the sole stock action.
- The posted result summarizes accepted quantities and exposes the original Request, Stock and Batches, and Movements destinations. Read-only posted line cards/table offer the two item destinations. Receipt details name the recording Manager, posting Manager, and physical inspector and show **Not recorded** when attribution is unavailable.
- The inspection form describes use-by as item-specific. It requires a date locally only when the selected item's expiry flag requires one and no PO expiry is supplied. It does not assign condiments a universal two-day Ready-to-Cook rule. The overlapping sticky workspace header is now a normal flow header.
- No `SL` unit was found in the inspected Manager source, fixture, or supplied Soy Sauce stock screenshots; the supplied and canonical sample displays use `L`. Units are still rendered from the authoritative item/request/receipt data without a client conversion or rewrite. A hosted `SL` occurrence needs its exact screen/record for correction.

## Evidence

| Check | Result | Limit |
| --- | --- | --- |
| `node scripts/verify-mgr-ux-07-browser.mjs` | **PASS** | Synthetic local fixture at 1280, 820, and 390 px; local save failure alert, capacity wording, normal-flow header, MGR-REC-06 stages, unsaved guard, edit ID, posted read-only, register, no external request or network write. |
| `node scripts/verify-mgr-rec-06-browser.mjs` | **PASS** | Existing synthetic workflow regression. |
| Receiving draft/post source verifiers | **PASS** | 65/65 and 42/42 static checks; these do not execute a hosted RPC. |
| `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run verify:quality` | **PASS** | TypeScript, production bundle, and 11 non-workflow quality checks. |
| Hosted authenticated Save Line/Post and real unit rendering | **NOT TESTED** | No hosted business data was read or mutated during this milestone. The exact hosted Save Line failure cause remains unconfirmed. |
| Hosted reconciliation of `RR-20261024-D5CCDA2A` | **NOT TESTED** | Preserve posted 0.06 L Soy Sauce and 0.04 L Vinegar, batches, and ledger for authorized later review. No automatic adjustment. |
| Draft `RR-20261024-E3761566` | **NOT TESTED** | No hosted interaction; user-reported state remains unposted. |

## Screenshots

- [Save Line error and capacity, desktop](mgr-ux-07-rendered-20261024/save-line-error-desktop.png)
- [Inspection, tablet](mgr-ux-07-rendered-20261024/inspection-820.png) and [mobile](mgr-ux-07-rendered-20261024/inspection-390.png)
- [Posted read-only receipt](mgr-ux-07-rendered-20261024/posted-readonly-desktop.png)

## Follow-up acceptance

An authorized Manager should retry `PR-20261023-000004` through the live UI only as part of a planned operational acceptance, capture the actual response if Save Line fails, and verify that no line or stock movement occurred on failure. The posted `RR-20261024-D5CCDA2A` requires receipt/request/batch/ledger and physical evidence reconciliation before any separately authorized adjustment. Keep `RR-20261024-E3761566` unposted unless the Manager explicitly completes its inspection and posting workflow.
