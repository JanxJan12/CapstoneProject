# Inventory Requests local usability pass — 2026-10-26

## Scope

Frontend-only Prepare Request and Review changes. The approved green/white workspace and quantity-driven inclusion stay in place. Receiving, Auth, RLS, RPCs, schema, hosted data, and deployment were not changed.

## Nine interaction paths

1. Open Prepare Request with zero selected quantities.
2. Type to search eligible items and choose a suggestion by keyboard or pointer.
3. Prevent a manually added item from appearing as a duplicate candidate.
4. Edit a quantity naturally, then normalize leading zeros on blur without losing decimal precision.
5. Reject an invalid quantity precision before Review.
6. Remove a manual row and Undo the removal.
7. Open Clear Request, cancel or Escape without losing work, then confirm the exact reset.
8. Review a draft, return to editing with the quantity preserved, and keep draft export separate from Issue.
9. Require a manager-entered reason for a differing quantity before Issue and send that exact reason in the local synthetic issue payload.

`node scripts/verify-mgr-req-usability-20261026.mjs` passed 92 browser assertions, including keyboard focus after Remove/Undo and Cancel. It captured Prepare, search, added-row, Clear dialog, and Review at 1502, 1280, 820, and 390 px. This test uses local synthetic data and no external request or network write. Screenshots and `result.json` are in this folder.

H-23 passed 40/40. Receiving source guards passed 65/65 and 42/42. The active Receiving browser verifier passed at 1280/820/390, including local synthetic post. Typecheck, quality baseline (11), and build passed. The older `verify-mgr-req-ux-02-browser.mjs` currently expects obsolete checkbox/selected-item text and timed out; it is not evidence of a current UI regression. Repo-wide `git diff --check` reports trailing whitespace in unrelated existing Supabase files.

## Decision blocker

The local Issue and Revise RPC definitions in `20261018204755_remove_inventory_request_reason.sql` reject any positive line quantity different from its provisional gap when `override_reason` is blank. The user rejected the Override Explanation control. Removing the reason input without changing the RPC would prevent these requests from being issued. The frontend therefore retains a conditional reason input under a quieter label and never supplies a fabricated reason. Resolving the rejection fully requires an explicit decision on the server policy or another approved path.

No authenticated hosted, physical-device, real stock, or real Receiving acceptance was run.
