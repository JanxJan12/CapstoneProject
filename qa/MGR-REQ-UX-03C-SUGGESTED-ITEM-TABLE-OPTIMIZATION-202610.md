# MGR-REQ-UX-03C — Suggested-items table optimization

**Date:** 2026-10-25 (Asia/Manila)  
**Result:** **PARTIAL — local 03C and Receiving regression verification PASS; authenticated hosted acceptance NOT TESTED.**

## Scope and presentation

Changed `src/modules/manager/inventory/ManagerRequestsPage.tsx` and `src/styles/theme.css` for the approved nine-column suggestion table and the corresponding stacked item cards. The selected-item count, explicit checkboxes, manual catalog add, Request Details, refresh, review, and separate issue action remain. The status cell now carries one primary status and an optional secondary cue; the native `details/summary` control exposes actual usable-at-need, minimum, outstanding-request, and gap values. Expiry uncertainty and a zero gap covered by open requests can appear together without implying stock is sufficient. Quantity errors remain linked to their own input by `aria-describedby`; the existing positive-quantity, precision, and override-reason rules are unchanged. The existing official-document Close control also received `autoFocus` so its prior 02A focus regression passes.

Before 03C, the Buko Juice row stacked expiry, zero-suggestion, and details text under the item name, while Status repeated an expiry warning. After 03C, the name cell shows the name; Status reads **Expiry unverified** with **Gap covered by open requests** and one **Why this suggestion?** disclosure. Table cells have tighter padding, right-aligned numeric guidance, non-wrapping numeric values, and a naturally wrapping item name. At 820 and 390 px the established cards present the same information without clipping the table. A synthetic long-name variant was added to `scripts/fixtures/manager-focused-mocks.ts` behind `longItemName=1`, and `scripts/verify-mgr-req-ux-03c-browser.mjs` exercises it. The earlier 03B verifier was updated to assert the equivalent consolidated zero-gap warning and the 820 px card layout.

## Eligibility finding — hosted read only

`get_inventory_request_proposal` returns active `inventory_items` and calculates usable stock at the need time, the recorded minimum, open requests, and expiry verification. The page presents stock-attention items where `reorder_level > 0` and `valid_at_need <= reorder_level`; it also retains manually selected catalog items. It has no QA-name filter.

Read-only queries against hosted project `zhzluhqvysvsadwuugpa` found `ZZ QA ONLY 20261013 - Test Item A` (`2f819963-9019-40b8-ab96-c00adb5315a1`) is **active**, unit `pcs`, quantity scale 0, recorded minimum 5, on-hand and usable-now quantity 3, and open formal request quantity 2. It has one formal request line and one Receiving line. It is eligible under the current active-item rule. Using the observed usable-now value, its open request covers the shortage (5 − 3 − 2 = 0); the selected need time can change proposal values. Its name alone supplies no authority to exclude it, and the displayed stock attention is consistent with the observed below-minimum value. Whether the record was intentionally retained as QA data requires an owner decision; deactivation or cleanup, with historical relationships reviewed, needs separate authorization. No record was hidden, deactivated, deleted, or otherwise changed.

## Rendered evidence

The re-shared approved Prepare Request illustration was used as the composition baseline: left suggestions, nine columns, explicit selection, and right Request Details remain. Pixel-exact comparison of the full authenticated app is **NOT TESTED**; screenshots below use isolated synthetic values, not hosted catalog data.

| View | Screenshot |
| --- | --- |
| Desktop table, 1280 px | [suggestions-1280.png](mgr-req-ux-03c-rendered-20261025/suggestions-1280.png) |
| Multi-selection and manual add, 1280 px | [selected-1280.png](mgr-req-ux-03c-rendered-20261025/selected-1280.png) |
| Expanded guidance, 1280 px | [guidance-1280.png](mgr-req-ux-03c-rendered-20261025/guidance-1280.png) |
| Invalid quantity, 1280 px | [invalid-1280.png](mgr-req-ux-03c-rendered-20261025/invalid-1280.png) |
| Tablet cards, 820 px | [suggestions-820.png](mgr-req-ux-03c-rendered-20261025/suggestions-820.png) |
| Mobile cards, 390 px | [suggestions-390.png](mgr-req-ux-03c-rendered-20261025/suggestions-390.png) |

## Verification

- **PASS:** `node scripts/verify-mgr-req-ux-03c-browser.mjs` at 1280/820/390 px: proposal loading, unselected rows, authoritative units and numeric formatting, long name, combined expiry/covered-gap warning, native disclosure open/close, keyboard Space, selection/counts, zero-gap validation, linked quantity error, manual override, manual catalog add, no page overflow, no browser error, no network write. [Machine result](mgr-req-ux-03c-rendered-20261025/result.json).
- **PASS:** `verify-mgr-req-ux-03b-browser.mjs`, `verify-mgr-req-ux-03-browser.mjs` (including synthetic review and issue), `verify-mgr-req-ux-02a-browser.mjs` (Actions and History & Audit), `verify-mgr-req-ux-02-browser.mjs`, `verify-mgr-req-ux-01-browser.mjs`, and `verify-h23-request-workflow.mjs` (40 checks).
- **PASS:** `verify-mgr-rec-ux-02-browser.mjs` at 1280/820/390 px for Receiving register, draft, inspection/save, review, synthetic post, and posted receipt. `verify-receiving-draft-authoring.mjs` and `verify-receiving-posting.mjs` also pass.
- **PASS (2026-10-25 regression reconciliation):** `verify-mgr-rec-04-browser.mjs` and `verify-mgr-rec-06-browser.mjs` now run the current four-view UX-02 browser gate and propagate its exit status. Each passed. Their superseded implementations are preserved in `scripts/historical/` for reference; they are not separate acceptance gates. This replaces obsolete assertions for `#awaiting-production-heading`, the combined queue/editor, the split register beside detail, and old stage/accordion presentation. It does not turn their prior failures into ignored results.
- **PASS (retained behavior in active Receiving gate):** `verify-mgr-rec-ux-02-browser.mjs` now additionally checks explicit draft resume without a second start, heading focus on entry/back/resume, distinct request/prior-accepted/outstanding quantities, preserved saved-line ID on edit, unsaved-refresh and post guards, receipt-history pagination, request-load error, and a delayed workspace loading state. Its prior 1280/820/390 px inspection, validation, units, save failure, accepted-only synthetic post, posted read-only, route actions, and local-only traffic checks still pass. [Updated machine result](mgr-rec-ux-02-rendered-20261024/result.json).
- **PASS (rerun):** `verify-receiving-draft-authoring.mjs` 65/65 source checks, `verify-receiving-posting.mjs` 42/42 source checks, and `verify-h23-request-workflow.mjs` 40/40 offline checks.
- **PASS:** `npm.cmd run typecheck`; `npm.cmd run verify:quality` (11 checks); `npm.cmd run build`.
- **PASS:** Syntax checks for all three active Receiving verifier entry points and scoped whitespace scan of the edited scripts. A repository-wide `git diff --check` also reported trailing spaces in unrelated pre-existing changes to `supabase/config.toml` and `supabase/tests/verify_receiving_batch_foundation.sql`; neither file was edited in this reconciliation.
- **NOT TESTED:** authenticated hosted Manager browser acceptance, real RPC posting/stock effects in a disposable database, screen reader, native 200% zoom, physical device, and hosted issuance. The local browser fixtures used synthetic data and local-only requests; source checks are not database execution.

This reconciliation changed only verifier entry points, the active browser verifier, and QA documentation. No UI/business logic, Supabase backend code, migration, schema, hosted business data, deployment, or protected Receiving record was changed. The hosted investigation described above was read-only and was not repeated during this reconciliation.
