# H-21 Manager Inventory batch decision support

**Scope:** Source-only Manager Inventory item-detail change on 2026-10-16. No service, browser, database, hosted project, or device was accessed. The H-20 review is [here](H20-MANAGER-OPERATIONAL-UX-QUESTION-REVIEW.md).

## A. Executive summary

The active item detail now answers **which recorded batch is next for automatic confirmed-order allocation, why, and how much remains**, when its existing server read supplies an eligible batch and a usable balance. It separates the next batch, later eligible batches, and excluded physical batches. The recommendation is read-only and explicitly disclaims physical quality certification. It does not select a batch or move stock.

## B. Existing backend allocation rules

`ManagerApp` mounts `InventoryItemDetail` from Stock; that component calls `get_manager_inventory_item_detail` and renders `InventoryBatchList`. [Mount](../src/modules/manager/index.tsx#L259), [detail](../src/modules/manager/inventory/InventoryItemDetail.tsx), [client API](../src/modules/manager/inventory/inventoryApi.ts#L689).

The [Manager detail SQL](../supabase/migrations/20261005082921_manager_inventory_workspace_reads.sql#L77) returns only positive-balance batches, in `rotation_policy` order: FEFO sorts recorded use-by ascending, nulls last, then receipt time and ID; FIFO sorts receipt time and ID. Its `current` badge is insufficient alone for an expiry-required batch with a missing use-by: SQL marks it current, while the allocation predicate excludes the null date. Expired physical batches remain in the detail response.

The [confirmed-order allocator](../supabase/migrations/20261004170254_fifo_batch_aware_sales_consumption.sql#L714) requires a positive batch balance and, when expiry is required, a use-by date on or after the current Manila date. It uses the same policy sort for locking and actual allocation. [Usable quantity](../supabase/migrations/20261004170254_fifo_batch_aware_sales_consumption.sql#L153) sums those eligible positive batches for batch-enabled items; aggregate-only items use the inventory item balance. `inventory_items.quantity_on_hand` is recorded physical book stock, distinct from the usable calculation and per-batch balances. Inactive items cannot be deducted. The read contract does not attest physical quality, location or a verified count. Order confirmation rechecks the rule, so a viewed recommendation can become stale.

## C. Original UX problems

1. The physical list showed its policy caption but did not identify the next eligible batch. An expired FEFO row could precede a usable row in the physical list.
2. A missing use-by on an expiry-required row could appear as `current` in the read response despite being excluded by the allocator.
3. The item summary gave physical/usable figures without explaining that the first is a recorded balance, not a counted measurement, and the second is server-calculated.

These are source-level findings, not reproduced restaurant incidents. [H-20 analysis](H20-MANAGER-OPERATIONAL-UX-QUESTION-REVIEW.md#L105).

## D. Implemented design

The page retains item identity and existing physical/usable quantities, with a concise definition under them. The batch area then presents the **next eligible for system allocation** with code, quantity, use-by, and the actual FEFO/FIFO tie rules. It preserves the server-returned order; it does not sort or calculate allocation order. Later eligible rows and excluded rows remain inspectable. The text explains that merely viewing the page does not change stock and does not establish physical suitability. [Batch presentation](../src/modules/manager/inventory/InventoryBatchList.tsx), [decision function](../src/modules/manager/inventory/batchDecision.ts).

The item read result is now associated with its `itemId`. A render for a different item shows loading until that item's own result arrives, a response for the wrong item ID is rejected, and effect cleanup prevents older async completions from replacing it. Read failure clears the detail and retains the existing Try Again path. [Item detail](../src/modules/manager/inventory/InventoryItemDetail.tsx).

## E. Changed files

| File / function | Previous behavior → new behavior | Contract reused and reason |
|---|---|---|
| [InventoryBatchList.tsx](../src/modules/manager/inventory/InventoryBatchList.tsx), `InventoryBatchList` | Flat physical cards and a policy caption → prioritized callout, later recorded candidates, and explicit excluded records. | Existing ordered Manager detail read; reduces interpretation without a new RPC. |
| [batchDecision.ts](../src/modules/manager/inventory/batchDecision.ts), `batchAvailability` / `batchDecision` | No decision helper → preserves server order and filters only confirmed eligibility conditions. | Detail `status`, quantity, use-by, item expiry/batch/active state and usable balance; no client allocation sort. |
| [InventoryItemDetail.tsx](../src/modules/manager/inventory/InventoryItemDetail.tsx), `InventoryItemDetail` | Physical/usable labels without a definition; separate asynchronous state could temporarily show the previous item → explicit quantity definition and item-keyed read state. | Same detail and movement reads, Refresh and Try Again; prevents stale cross-item guidance. |
| [verify-h21-batch-decision.mjs](../scripts/verify-h21-batch-decision.mjs) | No focused decision test → pure, offline classification/priority checks. | No service or database fixtures. |

## F. Edge cases

| Case | Behavior |
|---|---|
| One or multiple eligible batches | First eligible row in the **server-returned order** is highlighted; remaining candidates retain that order. |
| Expired, missing use-by for expiry-required item, zero/non-finite quantity | Excluded from the recommendation with a specific explanation. The actual read omits zero-balance batches, so movement history is the route to exhausted records. |
| Missing use-by when expiry is optional | May remain eligible; wording notes the date was not recorded, and FEFO's nulls-last behavior is explained. This is not a quality clearance. |
| No eligible rows, including only expired stock | No priority; reported usable quantity and refresh/investigation guidance remain visible. A mismatch between server usable stock and the sum of eligible batch balances suppresses priority and is called out. |
| Inactive item | No order allocation recommendation; recorded batches remain inspectable. |
| Aggregate-only item | Existing “standard stock” message remains; no batch guidance is rendered. |
| Invalid backend data or failed read | Typed client mapping rejects malformed quantities/policy; detail displays the read error and Try Again, without a batch recommendation. |
| Item switch or old async response | Item-keyed state and effect cleanup prevent the previous item's details or priority from appearing under the new item. |
| Record changes after read | Guidance states that the server rechecks on order confirmation; Refresh rereads before a Manager relies on it. |

No separate “unsuitable” quality classification is claimed because the current read contract has no inspection status. No negative stock is displayed as usable: the client read validates nonnegative figures and the decision helper rejects nonpositive/non-finite candidates.

## G. Offline verification

| Check | Result | Evidence / limit |
|---|---|---|
| TypeScript typecheck | **PASS** | `npm.cmd run typecheck` exit 0. |
| Quality baseline | **PASS** | `npm.cmd run verify:quality`, 11 checks. |
| Focused batch decision | **PASS** | `node --experimental-strip-types scripts/verify-h21-batch-decision.mjs`, ten assertions covering expired-first read order, missing use-by, zero quantity, no rows, unusable/mismatched summary, inactive/aggregate-only, and optional expiry. |
| Changed-file whitespace and report links | **PASS** | `git diff --no-index --check -- /dev/null <file>` produced no whitespace diagnostics for each of the five untracked H-21 files; direct offline check found no trailing whitespace or broken local report links. Git returns 1 for a new-file difference, which was treated separately from diagnostics. |
| Rendered and authenticated workflow | **NOT TESTED** | Explicitly deferred by H-21; no Vite, Chrome, Docker, Supabase CLI or hosted call. |

The existing Manager workspace verifier uses Vite's middleware server, so it was not run under this phase's no-Vite rule. H-16 stays **10 PASS / 0 FAIL / 49 NOT RUN**; these source checks do not change its acceptance matrix. [H-16](H16-MASTER-ACCEPTANCE-MATRIX.md#L67).

## H. Security and performance trade-offs

No RPC, RLS, migration, mutation, table grant or direct data path changed. The view continues using the Manager-authorized detail and movement reads. No extra request or inventory write was added. The decision helper is a single pass over the already returned ordered array; React renders its resulting groups. The page does not cache priority across item changes. The remaining trust boundary is the current read RPC's ordered array matching the allocator's policy and snapshot timing; a future backend change to either ordering rule requires a matching contract review. The recommendation is not a physical picking authorization.

## I. Remaining runtime acceptance

Later authorized acceptance should compare the displayed next batch with same-database confirmed-order allocations under FIFO, FEFO, tie dates, undated optional expiry, expired/unknown required expiry, zero balance, and Manila date rollover. It should reconcile aggregate, usable, batch and ledger values on one isolated snapshot; test item switches and lost/failed reads; and inspect desktop/mobile, keyboard focus, screen reader labels and touch sizing. Hosted and physical-stock proof are separate. None of this was executed in H-21.

## J. Next recommended Manager improvement

Make the existing Stock overview's attention counts open the affected filtered items and show an item-specific next step using its current stock summary and request proposal. Preserve provisional request language and all server authority. This is a recommendation only; H-21 did not implement it.
