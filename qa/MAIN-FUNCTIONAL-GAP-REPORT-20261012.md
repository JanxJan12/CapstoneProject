# Functional gap review — canonical RRJ’S FOOD-HOUSE

**12 October 2026. Scope:** One offline pass over active Manager Inventory operation and its immediate handoffs. The canonical checkout is `C:\Users\Janmari\Downloads\Capstone Project`. Existing harmonization and contract reports were read, not rerun as a broad audit. The checkout was dirty before this pass; no existing changes were reset, staged, or committed.

## What is already present

- Active Manager routing covers Stock Monitor, numbered multi-item Production requests, linked and legacy Receiving, Stock Movements, Waste/Spoilage, Adjustments, and book/ledger Audit (`src/modules/manager/index.tsx:260-342`). Customer, Cashier, KDS, Rider, and Production routes remain bound in `src/app/routes.tsx`; their code was not changed here.
- The new request page issues immutable revisions, exports the issued text/image/PDF for **manual** Messenger delivery, records Manager attestations of sent messages and replies, starts inspected delivery drafts, and shows accepted/rejected/outstanding totals (`ManagerRequestsPage.tsx`). The historical single-item request path remains embedded there.
- Receiving uses the existing draft RPCs and `post_receiving_report` for accepted-only stock posting; Stock Movements reads the ledger through the existing Manager RPC (`receivingApi.ts`, `inventoryApi.ts`). Waste and Adjustment use their existing batch-aware mutation paths. Audit compares book balances with recorded ledger history and explicitly does not claim a physical count.

## Prioritized operational gaps

| Priority | Confirmed behavior and impact | Evidence | Disposition |
| --- | --- | --- | --- |
| 1 | Starting a revision replaces the needed time while leaving the previous proposal marked current. A Manager could review quantities calculated for the wrong date; the server's expected-proposal check would reject the revision after review. | `ManagerRequestsPage.tsx:443-451`; proposal is fetched for `neededInput` at lines 198-216; SQL compares `p_expected` with a fresh proposal in `20261011120154_manager_inventory_request_documents.sql:462-464`. | **Fixed:** revision now requires refreshing suggestions for its needed time. |
| 2 | An older proposal/register refresh can finish after the Manager changes the needed time or starts a newer refresh, and previously could mark those old suggestions current. This can lead to a misleading review and server rejection. | `ManagerRequestsPage.tsx:198-264, 590-615`; the former asynchronous load had no response/time guard. | **Fixed:** only the latest response for the currently selected needed time can update proposal freshness. |
| 3 | Supplier and Purchase Order authoring are outside operational Manager routing; the available PO page is explicitly fixture-backed prototype with disabled creation/receipt. A Manager cannot create a new supplier PO through the active app, although Receiving can consume an eligible existing PO. | `src/constants/index.ts:73-95` labels prototype navigation; `src/modules/manager/purchase-orders/PurchaseOrdersPage.tsx:8-21` states fixture-only; active routing in `src/modules/manager/index.tsx` has no PO page. | **Deferred:** implementing a real PO workflow is beyond a narrow source fix and needs an approved operational contract. No prototype was promoted into live routing. |

The bounded route and source checks established no additional defect in the Customer, Cashier, KDS, Rider, Production, legacy request, Receiving posting, movement, Waste, Adjustment, or Audit seams. They were not full workflow tests. Missing authenticated proof is listed below, not counted as a functional code defect.

## Exact change and recovery

- Changed **only** `src/modules/manager/inventory/ManagerRequestsPage.tsx`: `useRef` guards the selected needed time and newest load; opening a revision invalidates proposal freshness. Its pre-edit SHA-256 was `88159038e6551538fefce2366aa97f8fe74f3bb0cae02b131c17853122b7e93d`; post-edit SHA-256 is `35f1f43bec03318e99549f2c2772215ea93d04c50a149efc1b15ff0891a036c1`. It was already untracked before editing.
- Exact pre-edit backup and restore manifest: `C:\Users\Janmari\Downloads\RRJ-Functional-Gap-Backup-20261012-042159\ManagerRequestsPage.tsx` and `restore-manifest.json`. The backup hash matches the pre-edit hash. Restore by copying that one backup over the target after reviewing any later edits; no Git reset is needed.
- No SQL, schema, auth/RLS, business rule, other runtime module, or hosted target changed. This report is the only other file added by this pass.

## Offline verification and limits

- **PASS:** `npm.cmd run typecheck` and `npm.cmd run build` against the current checkout.
- **PASS:** focused existing Manager Inventory UI verifier, `19/19` checks. The code diff against the exact backup has no whitespace diagnostics. These checks establish compilation and existing UI expectations, not an interactive request revision test.
- **Existing unrelated finding:** full `git diff --check` reports pre-existing trailing whitespace in `supabase/tests/verify_receiving_batch_foundation.sql:13`; that file was untouched.
- **NOT TESTED:** authenticated request issue/revision, Messenger handoff, database permissions, linked receipt → accepted-only ledger movement, physical stock, Customer/Cashier/KDS/Rider/Production end-to-end behavior, Supplier PO operation, hosted/staging/device behavior. The additive request migration was **not applied here**; its effective state on any database remains unverified. No database or hosted Supabase service was contacted. No app was launched with the hosted `.env.local`.

**Next user-facing step:** In a separately approved controlled authenticated environment, have a Manager prepare and revise one real request, manually send its issued snapshot through Messenger, inspect and post one linked receipt, then confirm the resulting Stock Movement and outstanding balance on that same database. **Staging and production remain NO-GO.**
