# MGR-UX-08 — Manager Inventory Workflow Refinement & Regression

**Local result: PARTIAL (2026-10-24).** Scoped frontend work and local synthetic regression passed. Authenticated hosted acceptance, including the reported `Spcs` / `SL` display and earlier apparent Save Line failure, remains **NOT TESTED**. No hosted data was changed.

## Scope and evidence

- Preserved the MGR-REC-06 staged workspace, existing request and stock posting contracts, and MGR-UX-07 fixes. The Receiving summary continues to display the backend supplied unit directly after an `en-PH` formatted number. Source inspection found no `S` prefix on this path. A dedicated local fixture rendered `2 pcs`, `0 pcs`, and `0.06 L` in the final Review dialog without `Spcs` or `SL`; existing `kg` cases also passed. **Root cause of the reported hosted display is unconfirmed.** The explicit `receivingQuantity` helper now keeps the number and server unit together in the linked draft strip. No unit conversion or backend data correction was made.
- The saved-lines table remains the compact review preview. The Review stage now gives request number/revision, draft status, recording Manager, an explicit empty-draft reason, and accepted-only posting guidance without repeating each saved line in a second list. The confirmation dialog still shows delivered, accepted, rejected, and remaining request quantity.
- The draft strip now distinguishes original requested, already posted, saved in this draft, additional capacity, and expected remaining after posting. Editing a saved line explains that its editable allowance includes its previously saved acceptance. Arithmetic and server validation are unchanged.
- Save Line uses an immediate pending lock in addition to its disabled/loading button. It announces Saving, Saved, and Failed, keeps failed input values, focuses local validation or service errors, and shows service errors beside the editor. The earlier authenticated apparent failure has **no confirmed root cause**; the fixture confirms visible feedback for a controlled service failure.
- Posted completion now identifies the posted document and links to Stock Overview as well as the existing original request, item stock/batches, and item filtered movements. The item detail is the closest existing batch view; no batch-specific route was invented. Recording/posting Manager, timestamps, and source remain in the completed delivery record. A UUID inspector displays as “Verified Manager · ID available in audit details”; the original ID is available in a disclosure.
- Item expiry remains driven by the item-specific `expiryRequired` flag and manually entered use-by date. The interface does not calculate a universal two-day date for Soy Sauce, Vinegar, or another category. Existing server expiry/batch validation remains authoritative.

## Changed files

`src/modules/manager/inventory/StockReceivingPage.tsx`; `src/modules/manager/index.tsx`; `scripts/fixtures/mgr-rec-04-mocks.ts`; `scripts/verify-mgr-ux-08-browser.mjs`; `scripts/verify-receiving-draft-authoring.mjs` (updated obsolete read-only label assertion); this report; `qa/MANAGER-MODULE-IMPLEMENTATION-ROADMAP-202610.md`. The worktree already contained unrelated edits and files; they were preserved.

## Verification

| Gate | Result |
| --- | --- |
| TypeScript `npm.cmd run typecheck` | PASS |
| Production `npm.cmd run build` | PASS, local build only |
| `npm.cmd run verify:quality` | PASS, 11 checks |
| Draft authoring source verifier | PASS, 65/65 after updating obsolete button-label assertion |
| Receiving posting source verifier | PASS, 42/42 |
| H-23 request workflow | PASS, 40 checks |
| MGR-UX-08 local browser | PASS at 1280/820/390 px; no document overflow; screenshots and machine-readable result in [mgr-ux-08-rendered-20261024](mgr-ux-08-rendered-20261024/result.json) |
| Browser Save Line cases | PASS: missing use-by, accepted greater than delivered, negative and nonnumeric delivered input, remaining capacity, missing rejection reason, controlled service failure/input retention, successful edit, and duplicate-click single submission. The number input coerces nonnumeric text to empty, which the required positive quantity validation rejects. |
| Browser quantity cases | PASS: synthetic `pcs`, `L`, zero, decimal, and existing `kg`; no `Spcs`/`SL` in review dialog. Other backend-supported units were not individually rendered. |
| Manager inventory workspace verifier | Source assertions reported 36/36. Vite dependency scanning logged restart errors both during the concurrent build and on a standalone rerun, despite exit code 0; any browser portion is **INCONCLUSIVE**. |
| Authenticated hosted Receiving and full Request → Receipt → Movement navigation | NOT TESTED; synthetic browser is not hosted acceptance. |

The rendered screenshots include `inspection-1280.png`, `inspection-820.png`, `inspection-390.png`, `units-review-desktop.png`, `save-line-service-failure-desktop.png`, `save-line-success-desktop.png`, and `posted-readonly-desktop.png`. The three-width fixture checked scroll width and normal-flow workspace header. Keyboard focus and error targets were exercised through browser DOM checks; a full assistive-technology pass remains outstanding.

## Safety and next step

**Hosted operations: NONE. Backend migrations: NONE. Deployments: NONE.** No real inventory transaction was used as a test. Preserve posted `RR-20261024-D5CCDA2A` (+0.06 L Soy Sauce, +0.04 L Vinegar), its batches/movements, and draft `RR-20261024-E3761566`. The role-play stock needs a later authorized Manager reconciliation based on physical evidence, not an automatic correction.

Next milestone: a separately authorized, read-only authenticated acceptance of this frontend against the existing Manager records, including a captured Review dialog and inspection of existing Save Line diagnostics without submitting or posting anything. If the extra `S` reappears, record the rendered DOM text and exact backend unit value before changing another code path. Repair the independent inventory workspace verifier's Vite dependency scan if its broader browser evidence is required.
