# Track B — active SECURITY DEFINER RPC audit (27 October 2026)

## Scope and decision

Canonical checkout: `C:\Users\Janmari\Downloads\Capstone Project`. Hosted project: `zhzluhqvysvsadwuugpa`, **read-only**. I inspected current `pg_proc` definitions, owners, `EXECUTE` grants, and selected unique indexes/constraints with `SELECT` only. I traced mounted React callers and their nested RPCs in the checkout. No hosted business RPC, DML, DDL, Storage operation, migration, or deploy was run. The dirty checkout was preserved.

**No supported defect was established in this bounded audit.** Consequently, there is no security migration or code fix to claim. The only new file is this report. The relevant failure mode to test next is a possible cancellation/Rider lock-order deadlock; its impact and frequency are unproven, and a deadlock that rolls one transaction back is not evidence of an authorization bypass or double posting.

Supabase's [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) explains why the caller's `authenticated` grant and UI route guard do not substitute for checks in a privileged function. All 13 targeted hosted functions inspected are `SECURITY DEFINER` owned by `postgres`; the 12 public entry points permit `authenticated`, deny `anon`, and the nested `mutate_inventory_batch_quantity` helper denies both. These grants are broad at the role level, so the function bodies are the authorization boundary.

## Ranked shortlist and observed guards

| Priority | Active path and source caller | Hosted authorization / integrity evidence | Assessment |
| --- | --- | --- | --- |
| 1 — payment verification | `verify_customer_gcash_payment`, `src/modules/cashier/api/customerGcashVerificationApi.ts:233` | Requires active Cashier; shares profile lock; locks request row, own open shift, payment, and linked order; checks online/GCash/pending/ownership proof path and Storage object; unique request, payment, order, receipt, and transaction indexes prevent duplicate receipts. Client also rejects a replay whose current payment/order status is no longer verified/confirmed. | No confirmed bypass or duplicate settlement. Hosted role-specific execution and concurrent retry were not run. |
| 2 — paid cancellation versus Rider handoff | `settle_paid_order_cancellation`, `src/modules/manager/api/paidOrderCancellationApi.ts:74`; Rider `advance_rider_delivery`, `src/modules/rider/services/supabaseRiderService.ts:774` | Cancellation requires active Manager, locks order, rejects custody and unsupported status, locks verified payment and completed cashier sale, checks refund and restoration conditions, and relies on unique settlement/reference indexes. Rider advance requires active approved Rider and ownership, locks assignment then order, checks exact expected statuses. The opposite lock orders could cause a deadlock if the calls overlap. | **Unconfirmed concurrency concern**. A deadlock would abort a transaction; no evidence of inconsistent committed state. Needs a two-session disposable test. |
| 3 — formal Receiving post | `post_receiving_report`, `src/modules/manager/inventory/receivingApi.ts:893` | Requires active Manager, locks report and lines, rejects repost, locks PO lines/items, validates source, PO ownership, accepted/rejected quantities, expiry and secondary amounts, and posts accepted quantity only. Hosted unique `(receiving_report_id, purchase_order_item_id)` and `(purchase_order_id, inventory_item_id)` rules refute the suspected same-PO-line double count in one report. | No confirmed double post or overreceipt. Formal Request → external Messenger → linked Receiving and accepted-only posting were not altered. |
| 4 — batch waste/adjustment and aggregate inventory | `record_batch_inventory_waste`, `adjust_inventory_batch_stock`, `receive_inventory_stock`, `adjust_inventory_stock`, `record_inventory_waste`; `src/modules/manager/inventory/inventoryApi.ts:539,568,841,871,977` | Batch entry points call the non-client-executable mutation helper. It checks active Manager, finite/scale-valid quantity, exact batch ownership and expected balance, item/batch locks, consistency, actor/request advisory lock, replay payload, and unique `(performed_by, mutation_request_id)`. Aggregate entry points check active Manager and reject batch-enabled items. | No confirmed role bypass, stale-balance mutation, or duplicate ledger entry in the inspected definitions. |
| 5 — cashier shifts and Rider completion | `start_cashier_shift`/`close_cashier_shift`, `src/modules/cashier/api/shiftApi.ts:63,120`; `complete_rider_delivery`, `src/modules/rider/services/supabaseRiderService.ts:938` | Shifts require active Cashier and finite cash; closure locks the actor's open shift and serializes pending GCash checks with an advisory lock. Partial unique indexes allow only one open shift per Cashier and per normalized terminal. Completion requires active approved Rider, owned out-for-delivery assignment, exact Rider/assignment proof path and existing private Storage object, then locks matching order. | No confirmed privilege crossing or duplicate completion. Cross-workflow concurrency remains untested. |

The root cause of **no change** is evidentiary: the inspected role and state checks plus database uniqueness guards ruled out the concrete candidates examined. It would be unsafe to alter a financial or stock RPC solely because it is privileged. This audit is not a proof that every possible schedule or input is safe.

## Changes and verification

| Check | Result |
| --- | --- |
| Hosted `pg_proc` definitions, grants, and selected constraints/indexes | **PASS** — read-only inspection; no hosted write. |
| `node scripts/verify-receiving-posting.mjs` | **PASS** — 42/42 source-contract checks. Does not execute SQL. |
| `node scripts/verify-batch-aware-waste-adjustment.mjs` | **PASS** — 47/47 source-contract checks. Does not execute SQL. |
| `node scripts/verify-protected-table-acl.mjs` | **PASS** — 96/96 source-contract checks. Does not execute SQL. |
| `npm run typecheck`; `npm run build` | **PASS** on the current combined dirty tree. |
| Positive/negative role-specific and duplicate/concurrency regression in a disposable DB | **NOT RUN** — no correction selected; `supabase status` failed because `supabase_db_Capstone_Project` does not exist. This is not a passing database test. |
| Hosted authenticated business calls, hosted concurrency, migration/deploy | **NOT RUN** — hosted read-only boundary. |

No historical August order research, migration/DR replay, Production Queue work, or frontend redesign was performed. No source, migration, or test file was changed; pre-existing dirty work remains intact.

**One bounded next action:** build an isolated disposable two-session fixture for the existing hosted `settle_paid_order_cancellation` and `advance_rider_delivery` definitions, force simultaneous cancellation and Rider pickup, and record whether PostgreSQL returns a deadlock and rolls back cleanly. Only a reproduced harmful outcome should justify a narrowly scoped local correction and role/duplicate/concurrency regression.
