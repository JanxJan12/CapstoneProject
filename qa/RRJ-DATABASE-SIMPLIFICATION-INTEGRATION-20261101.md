# RRJ’S FOOD-HOUSE — consolidated local database simplification integration

## 1. Executive summary

**PARTIAL LOCAL ACCEPTANCE.** Ten local simplification migrations applied without skipped statements to a fresh disposable current-schema clone. The final schema removes the approved obsolete structures while retaining orders, payments, receipts, Cashier settlement, inventory requests, Receiving, item instructions, rejection evidence, and Rider delivery structures. Real rollback-only Cashier sale and Manager request/Receiving database fixtures passed. Full authenticated Customer → Kitchen → Rider delivery, GCash verification, browser/device acceptance, and complete disaster recovery were not exercised; they cannot be called passed.

## 2. Tested revision and worktree

Canonical repository: `C:\Users\Janmari\Downloads\Capstone Project`; HEAD `9748bdef6d31a96282b88dc67f02724b8fd05819`. The worktree was already dirty (377 status entries at task start); this integration did not reset, clean, or stash it. Standalone Rider repository: `C:\Users\Janmari\Downloads\RRJ-Food-House-Rider`. The ChatGPT project mirror `sources/` was not edited.

## 3. Hosted baseline and local migration state

Read-only Supabase catalog and migration-ledger queries targeted project `zhzluhqvysvsadwuugpa`. Hosted had 68 ledger versions, latest `20261030042437`, and zero versions of the ten migrations below. Hosted public catalog measured 36 tables, 414 columns, 132 function identities, 43 user triggers, 80 foreign keys, 31 unique constraints, 134 indexes, and 19 policies. No hosted write or linked CLI dump was run.

The unchanged local `current_schema_source` clone had identical measured totals except 131 functions. It lacked `get_cashier_transaction_history(integer,integer,jsonb)`, which exists hosted under version `20261030042437`. The local `20261030034730_cashier_owned_transaction_history_read.sql` supplied that function to the **disposable** baseline before simplification replay, producing the same eight catalog totals as hosted. The local version number and function body must not be mistaken for an exact hosted ledger or definition clone.

## 4. Applied migration inventory

1. `20261026232229_six_table_dependency_harmonization.sql`
2. `20261031155629_cashier_db_03a_remove_redundant_profile_rider_objects.sql`
3. `20261031172100_document_payment_rejection_fields.sql`
4. `20261031184718_cashier_retire_unused_shift_approval_storage.sql`
5. `20261031190000_cashier_closed_shift_snapshot_prerequisite.sql` (narrow local integration repair)
6. `20261031191307_cashier_remove_shift_explanation_fields.sql`
7. `20261031192355_cashier_remove_transaction_number.sql`
8. `20261031193813_remove_unapproved_order_discount_table_and_notes.sql`
9. `20261031194915_remove_general_receiving_and_purchase_order_notes.sql`
10. `20261101053045_remove_release_order_freeform_notes.sql`

## 5. Replay order and outcome

Fresh disposable database `rrj_simplification_final_20261101` was created from untouched `current_schema_source`. After the hosted-present history reader was supplied as a baseline prerequisite, each numbered migration above was applied in chronological order with `psql -X -v ON_ERROR_STOP=1`. **PASS 10/10**, no skipped statements. This is local application only; the hosted ledger remains at zero simplification versions. The earlier diagnostic disposable database stopped first at DB-03A and then at the transaction-history prerequisite; the repaired fresh replay is the acceptance measurement.

## 6. Integration repairs

- DB-03A's policy guard accepted PostgreSQL's equivalent unqualified `uid()` rendering as well as `auth.uid()` while retaining its role, command, and policy-name checks. The first replay had failed with SQLSTATE `P0001` at “own-profile SELECT policy drift”.
- The historical shift explanation migration required a snapshot-protection function and trigger absent from hosted/current baseline. The new forward-only prerequisite installs the previously defined H-08C protection before the explanation columns disappear; the explanation migration then updates its protected field list. The first direct attempt had failed with SQLSTATE `P0001`.
- The Receiving notes migration now tolerates `purchase_orders` already having been retired by the six-table migration; it still drops `notes` on a pre-retirement schema. This preserves both chronological consolidated replay and the standalone pre-retirement path.
- The local current-schema clone lacked the hosted-present Cashier history RPC; applying its existing local migration aligned the disposable baseline count and satisfied the transaction-number migration guard. The first direct attempt had failed with SQLSTATE `P0001`.
- Three retained SQL tests were updated to the new 12-argument Receiving line RPC. The Cashier approval test fixture was corrected to use fresh identifiers and the profile rows created by the Auth trigger.

## 7. Final database-object inventory

The 30 public tables are `cashier_shifts`, `cashier_transactions`, `delivery_assignments`, `drink_choices`, `inventory_audit_items`, `inventory_audits`, `inventory_batches`, `inventory_items`, `inventory_opening_balances`, `inventory_request_documents`, `inventory_request_events`, `inventory_request_lines`, `inventory_request_revisions`, `inventory_transaction_batch_allocations`, `inventory_transactions`, `kds_terminals`, `menu_categories`, `menu_ingredients`, `menu_items`, `order_items`, `order_status_history`, `orders`, `paid_order_cancellations`, `payments`, `profiles`, `receiving_report_items`, `receiving_reports`, `rider_offer_push_outbox`, `rider_push_devices`, and `riders`. The six retired supplier, purchase-order, and production-replenishment support tables are absent.

## 8. Before/after measurements

Counts were measured from the aligned disposable baseline and its final result, using the same `pg_catalog` predicates. The hosted baseline independently returned the same starting totals.

| Public object | Hosted / aligned local before | Consolidated local after | Net |
|---|---:|---:|---:|
| Tables | 36 | 30 | -6 |
| Columns | 414 | 340 | -74 |
| Function identities | 132 | 125 | -7 |
| Noninternal triggers | 43 | 32 | -11 |
| Foreign keys | 80 | 63 | -17 |
| Unique constraints | 31 | 26 | -5 |
| Indexes | 134 | 114 | -20 |
| RLS policies | 19 | 18 | -1 |

## 9. Removed-feature verification

**PASS, disposable catalog and rollback-only SQL checks:** `cashier_shifts.manager_approved_by`, `manager_approved_at`, `notes`, `variance_reason`; `cashier_transactions.transaction_number`; `orders.notes`, `table_number`, `discount_type`, `discount_reference`, `discount_amount`; `receiving_reports.notes`; `receiving_report_items.notes`; and the retired `purchase_orders` table are absent. Legacy walk-in, operational-detail, and release RPC signatures are absent. The approved new signatures exist. The old `release_ready_order(uuid,text)` signature is absent. Active `src/` and Rider `src/`/`tests/` scans found no references to the retired discount, table-number, transaction-number, order-note, release-note, or Receiving-note identifiers.

## 10. Retained operational contracts

**PASS, catalog:** `orders`, `order_items`, `payments`, `cashier_transactions`, `cashier_shifts`, `inventory_request_documents`, `receiving_reports`, `receiving_report_items`, `inventory_batches`, `inventory_transactions`, `delivery_assignments`, and Rider push/proof support remain. `order_items.special_instructions`, `payments.rejection_reason`, `payments.rejection_notes`, `cashier_transactions.receipt_number`, `cashier_transactions.void_reason`, and `receiving_report_items.rejection_reason` remain for distinct product, financial, and inspection responsibilities. `order_status_history.notes` remains historical status evidence. The payment-rejection migration only documents existing evidence columns.

## 11. Cashier verification

**PASS, disposable rollback-only `verify_consolidated_cashier_sale.sql`:** an authenticated Cashier created a cash walk-in sale for 100 with 150 tendered; the returned subtotal, tax, grand total, change, saved payment, item instruction, receipt number, saved receipt detail, history search content, and shift settlement all agreed. Retrying the same request ID returned the same order and receipt with one transaction. No transaction-number field was required. **PASS, `verify_cashier_shift_explanation_removal.sql`:** balanced, shortage, and overage closures without written explanations, saved monetary history, cross-Cashier history denial, Manager close denial, and closed snapshot mutation denial. **PASS, `verify_cashier_shift_approval_retirement.sql`:** own history, Manager-compatible response, and Customer/cross-Cashier denial. **PASS, `verify_phase_7a_paid_order_cancellation.sql`:** synthetic cancellation contract. Cashier history/export/workspace/order-list source checks passed. **NOT RUN:** live GCash verification, pending-payment close, every receipt export rendering path, and full paid-refund browser flow.

## 12. Manager inventory and Receiving

**PASS, disposable rollback-only `verify_manager_inventory_request_documents.sql`:** multi-item issue, revision and historical snapshots, stale revision denial, linked drafts, rejected quantity evidence, split posting, accepted-only stock, batches and ledger movements, duplicate posting denial, and role/ACL checks. **PASS, `verify_mgr_rec_02c_disposable.sql`:** authenticated request/Receiving relationship, inspector evidence, draft isolation, posting, balance/batch/movement creation, and duplicate-post denial. **PASS, `verify_manager_inventory_request_security.sql`:** 8 anonymous RPC denials, 4 RLS table checks, 12 role/RPC denials. **NOT RUN:** separate emergency Receiving lifecycle and authenticated Manager browser. Older `verify_source_neutral_receiving_posting.sql` and `verify_manager_receiving_draft_authoring.sql` fail because their fixtures insert into the deliberately retired `suppliers` table; retained production-team behavior was instead exercised by the current request/Receiving tests. `verify_receiving_batch_foundation.sql` likewise expects retired general-note columns. Those historical verifiers are not evidence of final-schema failure.

## 13. Customer, Kitchen, Rider integration

**PASS, source checks:** Customer batches 1–3 and quote parser; Capstone typecheck and production build; standalone Rider typecheck and all 26 unit tests. **BLOCKED, database KDS fixture:** `verify_kds_queue_v2_local.sql` requires an `extensions` schema absent from this disposable clone. **NOT RUN:** signed-in Customer → payment → KDS → Rider delivery → Manager report browser/device journey, Rider proof upload, and emulator/native behavior. No claim of end-to-end lifecycle acceptance is made.

## 14. Financial integrity

**PASS, tested same sale scope:** order subtotal/grand total 100, saved payment 100, receipt detail 100, opening cash 50 plus cash receipt 100 equals expected/actual 150, zero variance. Item `special_instructions` was retained. **PASS, synthetic paid cancellation verifier:** cancellation/refund restrictions and evidence under its fixture. No hosted financial totals were compared or modified. **NOT RUN:** GCash verification, post-close refund-period reporting, and live Manager financial reports.

## 15. Authorization and RLS

**PASS, disposable:** Customer denied Cashier walk-in sale; Cashier own history and cross-Cashier denial; Customer history denial; Manager prevented from Cashier close; closed shift money update denied; Manager inventory request security verifier passed. Final RLS policy count is 18 after the intended duplicate own-profile policy removal. **NOT RUN:** full signed JWT/PostgREST role matrix and Rider privileged-function matrix.

## 16. Idempotency and concurrency

**PASS, sequential replay:** Cashier sale request ID returned one order/transaction and the same receipt; Manager issue and Receiving post replay protections passed; closed shift snapshot write protection passed. **NOT RUN:** parallel transaction race and real HTTP concurrency.

## 17. Restoration and recovery

**PASS, definition capture only:** a schema-only `pg_dump` of the untouched source public schema was generated inside the disposable container (`/tmp/rrj_simplification_before_public.sql`, 689245 bytes). **NOT RUN:** destructive reverse application, exact function EXECUTE/owner/default-privilege restoration, or full disaster recovery. The dump is a definition capture, not a proven rollback. Previous local ACL restoration limitations remain relevant; no privileges were broadened to simulate recovery.

## 18. Remaining blockers

Hosted and local migration histories differ: the hosted ledger's Cashier-history version is `20261030042437` while the local prerequisite is `20261030034730`. The local source clone also omits hosted `extensions` schema needed by one KDS verifier. Source-only legacy tests still contain retired supplier/general-note assumptions; current retained workflow tests passed. No hosted deployment or migration-ledger repair is authorized by this task. Authenticated browser/device, GCash, emergency Receiving, concurrent requests, and full restoration remain unverified.

## 19. Exact files changed in this integration run

- `supabase/migrations/20261031155629_cashier_db_03a_remove_redundant_profile_rider_objects.sql`
- `supabase/migrations/20261031190000_cashier_closed_shift_snapshot_prerequisite.sql`
- `supabase/migrations/20261031194915_remove_general_receiving_and_purchase_order_notes.sql`
- `supabase/tests/verify_cashier_shift_approval_retirement.sql`
- `supabase/tests/verify_manager_inventory_request_documents.sql`
- `supabase/tests/verify_mgr_rec_02c_disposable.sql`
- `supabase/tests/verify_consolidated_cashier_sale.sql`
- `qa/RRJ-DATABASE-SIMPLIFICATION-INTEGRATION-20261101.md`

Other pre-existing dirty application/migration files were preserved. Rider source was tested but not edited during this integration run.

## 20. Local acceptance decision

**PARTIAL LOCAL ACCEPTANCE.** All applicable simplification migrations apply together to the aligned disposable schema; catalog reductions and critical Cashier cash-sale, settlement, Manager request/Receiving, security, and idempotency checks were measured. Full local acceptance is withheld because the complete authenticated cross-module journey, GCash verification, emergency Receiving, KDS disposable fixture, concurrency, and restoration were not proven.

## 21. Hosted mutation confirmation

**No hosted schema, migration ledger, permissions, or business data were modified.** Hosted access in this run consisted only of read-only catalog and ledger queries. All DDL and synthetic business writes occurred in disposable local databases; test fixtures rolled back.
