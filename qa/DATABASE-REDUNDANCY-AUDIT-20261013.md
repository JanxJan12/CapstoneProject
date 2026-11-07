# RRJ’S FOOD-HOUSE database redundancy and unused data audit

**Audit date:** 2026-10-13 (Asia/Manila)  
**Hosted target:** `RRJS-Foodhouse-Final`, `zhzluhqvysvsadwuugpa` (confirmed active).  
**Decision:** **NO-GO** for any hosted cleanup. This is a new redundancy assessment, separate from the prior integrity/recovery PASS. Hosted access in this audit was SELECT-only through the Supabase connector. No app code, migration, backup, hosted row, RLS policy, or privilege was changed.

Companion files: [privacy-safe catalog and aggregate evidence](DATABASE-REDUNDANCY-EVIDENCE-20261013.json), [schema supplement](DATABASE-REDUNDANCY-SCHEMA-SUPPLEMENT-20261013.json), and [read-only SQL preview](DATABASE-REDUNDANCY-REVIEW-ONLY-20261013.sql). The evidence records exact public row counts, heap/index sizes, PKs, all 73 public FKs, 122 indexes with scan counters, triggers, public function source-text reference names, and aggregate screens. The supplement records all managed table names with connector row summaries, all public columns, policy predicates, the 46 migration versions, and per-table source creation provenance. For baseline tables, the remote-schema snapshot proves inclusion but does not establish the original creation date. Neither JSON file contains customer values, object paths, secrets, or row IDs.

## Method and evidence boundary

I inspected the current hosted PostgreSQL 17 catalog and exact counts for all 34 `public` tables; inventory of managed `auth`, `storage`, `realtime`, and migration schemas; 46 applied migrations ending at `20261012181744`; deployed Edge Functions (none listed); public FK/index/trigger/RLS/ACL catalog; and source paths in the current canonical React app and standalone Rider app. The live React router reaches Customer, Manager, Production, Cashier, Rider, and KDS. Manager navigation reaches Stock, Requests, Receiving, Movement, Waste, Adjustments, Audit, Menu, orders, riders, and reports. The Rider app directly reads profiles/riders/assignments/orders/items and calls delivery RPCs. Source-only `supabase/functions` is absent and the hosted Edge Function listing is empty. SQL function references below are whole table-name matches in current `pg_proc.prosrc`; this is stronger than a repository grep but can still miss dynamic SQL and does not prove actual invocation frequency. Some UI uses RPCs without naming their backing tables. Deleted source pages and tests were not counted as current routes.

The prior [recovery report](RECOVERY-STABILIZATION-20261013.md) and isolated [order-to-Rider API test](recovery-auth-order-rider-e2e-20261013.mjs) establish one restored local same-database authenticated workflow; the inventory test establishes request → accepted Receiving → batch/ledger reconciliation. They do **not** establish absence of redundancy in hosted data. No synthetic hosted writes were made. No isolated DB test was run in this audit because no schema or data fix was applied.

Concrete current-source trace: `src/app/routes.tsx` mounts the active modules. Customer `src/modules/customer/index.tsx` reads menu, orders, history and profile, and calls order/payment RPCs; Cashier `src/modules/cashier/api/walkInSaleApi.ts`, `onlinePaymentApi.ts`, and `shiftApi.ts` call the sale/payment/shift RPCs; KDS `src/modules/kitchen/services/kdsTerminalService.ts` calls terminal/queue/advance RPCs; Manager `src/modules/manager/inventory/inventoryRequestApi.ts`, `replenishmentApi.ts`, `receivingApi.ts`, and `inventoryApi.ts` call request, Receiving, batch and stock RPCs. `src/modules/rider/services/supabaseRiderService.ts` and standalone Rider `src/riderApi.ts` directly read assignments/orders/items and call delivery RPCs. The full SQL-side function names per table are in the evidence JSON. Literal table-name searches in source can hit types or mocks and miss RPC-backed access; they were not used alone to classify a table unused. Historical migrations and QA tests establish contract/provenance, not current traffic.

## Inventory and classification

Classification means: **active/core** = current business authority or critical path; **supporting** = dependent audit, bridge, security, or conditional path; **legacy suspected** = plausible retirement candidate requiring owner decision and dependency proof; **proven unused** = none; **unknown** = none among public tables at the current evidence level. Function references are counts, not traffic counts. Sizes include table, indexes and TOAST; empty tables still occupy catalog/index pages. All 34 public tables have RLS enabled. A table with zero policies may intentionally be RPC-only.

| Public table | Exact rows | Class | Public function refs | Total bytes | Operational evidence / concern |
| --- | ---: | --- | ---: | ---: | --- |
| `profiles` | 8 | active/core | 67 | 81920 | Auth identity profile; Manager, role gates and audit actor FKs. |
| `riders` | 2 | active/core | 12 | 65536 | Rider application and availability; assignments reference it. |
| `menu_categories` | 5 | active/core | 2 | 49152 | Customer/Cashier menu grouping; menu_items FK. |
| `menu_items` | 20 | active/core | 6 | 122880 | Current sellable catalog; order_items restrict removal. |
| `inventory_items` | 18 | active/core | 36 | 81920 | Stock master and cached on-hand quantity; ledger and recipes depend on it. |
| `menu_ingredients` | 28 | supporting | 7 | 106496 | Recipe bridge used by availability and confirmed-order deduction. |
| `suppliers` | 0 | supporting | 4 | 32768 | Dormant direct-supplier master; PO and Receiving RPCs still reference it. |
| `supplier_items` | 0 | legacy suspected | 0 | 32768 | Empty supplier catalog bridge; no public function-body reference found; FK from suppliers and inventory_items. |
| `purchase_orders` | 0 | supporting | 6 | 81920 | Dormant direct-supplier purchasing path; Receiving links to it. |
| `purchase_order_items` | 0 | supporting | 8 | 90112 | Dormant PO lines; Receiving and ledger can reference them. |
| `orders` | 45 | active/core | 28 | 172032 | Order authority for Customer, Cashier, KDS, Rider and Manager. |
| `order_items` | 50 | active/core | 9 | 90112 | Line snapshot and inventory issuance input; cascade from orders. |
| `payments` | 27 | active/core | 15 | 81920 | Payment evidence/state; separate from receipt journal. |
| `order_status_history` | 223 | supporting | 17 | 114688 | Immutable workflow timeline and confirmed-order stock trigger. |
| `inventory_transactions` | 43 | active/core | 13 | 253952 | Stock ledger and movement audit; preserve lineage. |
| `delivery_assignments` | 14 | active/core | 13 | 98304 | Offer, acceptance and proof metadata; cascade from orders. |
| `kds_terminals` | 2 | supporting | 4 | 49152 | Terminal credential/control table; KDS RPCs need it. |
| `cashier_shifts` | 5 | active/core | 8 | 65536 | Cash reconciliation and cashier transaction grouping. |
| `cashier_transactions` | 26 | active/core | 8 | 114688 | Receipt/settlement journal with unique order/payment links. |
| `menu_modifier_groups` | 6 | supporting | 1 | 24576 | Server-side modifier validation for walk-in RPC; UI also has static definitions. |
| `menu_modifier_options` | 16 | supporting | 1 | 40960 | Server-side modifier options; distinct from order snapshot. |
| `menu_item_modifier_groups` | 27 | supporting | 1 | 24576 | Menu-to-modifier association for walk-in validation. |
| `receiving_reports` | 1 | active/core | 20 | 147456 | Physical receipt header; only post RPC moves accepted stock. |
| `receiving_report_items` | 2 | active/core | 18 | 114688 | Accepted/rejected physical line evidence; feeds batches. |
| `inventory_batches` | 2 | active/core | 16 | 163840 | Physical lot stock and expiry; sales/waste/Receiving dependency. |
| `inventory_opening_balances` | 0 | supporting | 2 | 98304 | One-time cutover ledger provenance; empty now but needed for verified opening counts. |
| `inventory_transaction_batch_allocations` | 0 | supporting | 3 | 73728 | Exact batch issue allocations for batch-aware sales/refunds; empty now. |
| `paid_order_cancellations` | 0 | supporting | 2 | 49152 | Refund and disposition attestations; empty until paid cancellation occurs. |
| `production_replenishment_requests` | 0 | supporting | 9 | 32768 | Production Team request path; empty but live Manager route/RPC exists. |
| `production_replenishment_status_events` | 0 | supporting | 2 | 24576 | Audit log for production request transitions; empty with parent. |
| `inventory_request_documents` | 1 | active/core | 10 | 49152 | Current formal Manager request document and status. |
| `inventory_request_lines` | 2 | supporting | 7 | 49152 | Item-level requested amounts; composite business PK. |
| `inventory_request_revisions` | 1 | supporting | 3 | 32768 | Issued immutable revision snapshots; same document with history. |
| `inventory_request_events` | 3 | supporting | 8 | 49152 | Request activity/audit events; same document with history. |

**Proven unused tables: 0.** The strongest candidate is `supplier_items` (zero rows, zero exact function source references, no active UI direct query), but its FK bridge and purchasing model may be planned or required externally. Owner sign-off and external consumer review are prerequisites. `suppliers`, `purchase_orders`, and `purchase_order_items` are all empty, yet the current Receiving RPC definitions retain direct-supplier/PO branches. `production_replenishment_requests` overlaps `inventory_request_documents` conceptually but is the older Production Team queue, while the latter is the new formal Manager document with revisions and events; the UI and SQL still expose both. Consolidation is a product decision, not a deduplication query.

Managed inventory: `auth` has 27 tables (8 users, 8 identities, 13 sessions, 42 refresh tokens); `storage` has 8 tables (3 buckets, 30 objects: 11 delivery proofs, 16 payment proofs, 3 rider documents); `realtime` has 10 tables including daily message partitions; `supabase_migrations` has one table with 46 versions. Their empty MFA/SSO/OAuth/SCIM/multipart/vector/Realtime tables and partitions are service-owned capabilities, not disposable app tables. Relation storage totals: public 2,760,704 bytes, Auth 1,671,168, Storage 425,984, Realtime 376,832, migrations 319,488. These are relation totals, not an estimate of recoverable space from any cleanup.

## Redundant rows and overlapping state

| Screen / business key | Hosted result | Interpretation |
| --- | --- | --- |
| `orders(customer_id, customer_request_id)`; `orders.order_number` | 0 excess | No replay duplication on the checked keys. |
| `cashier_transactions.order_id` and non-null `payment_id` | 0 excess | Receipt journal is one-per-order/payment on checked keys. |
| `payments(order_id, method, reference)`; payments per order | 0 excess | No duplicate payment grouping observed. |
| `inventory_transactions.mutation_request_id` (non-null) | 0 excess | No repeated mutation request ID observed. |
| `menu_ingredients(menu_item_id, inventory_item_id)` | 0 excess | No duplicate recipe bridge pair. |
| delivery assignments per order, including active offers | 0 excess | 14 assignments represent 14 orders; 11 delivered, 2 rejected, 1 offered. |
| `order_status_history(order_id,status)` | 21 repeated-status rows in 13 groups | 19 are waiting-payment in 11 groups; 2 are waiting-for-rider in 2 groups. All 13 groups have differing notes; none share the same status within the same second. These may be resubmissions/reoffers. **0 proven deletable.** |

The history spans are 1.1 seconds to 6h18m for payment waiting and 1h03m to 1d06h for rider waiting. Status changes can legitimately revisit the same state. The `order_status_history` confirmed-status insert trigger is also the inventory deduction boundary; removing history could corrupt audit and stock explanation.

Several fields are purposefully denormalized: `orders.current_status` and totals cache current commercial state; `order_items.item_name/unit_price/line_total/modifiers` preserve sold-at-time details; `payments` and `cashier_transactions` represent payment lifecycle versus receipt/shift journal; `inventory_items.quantity_on_hand` and `inventory_batches.quantity_on_hand` cache different stock grains; `inventory_transactions.quantity_before/after` records the ledger transition; request lines/revision JSON and event rows preserve what was issued. All 45 order total formulas matched the checked arithmetic. Twelve inventory masters and two batches have nonzero on-hand; a blanket batch-to-master recomputation would be unsafe with historical aggregate stock. Current PO line derived remaining quantity has zero populated rows because the PO path is empty. Redundant storage at column level is possible, but removal would break current reads or erase historical prices, quantities, and approvals.

Marker-only screening found 1 order note, 2 inventory reasons, and 13 status-history notes containing test/demo/QA/example terms. These are **not** proven synthetic hosted records: no verified operator provenance, named test account lineage, or backup comparison was established. Do not delete by labels, date, or low row count. The local recovery test generated synthetic rows only in the isolated stack and cannot be used to label hosted records.

## Schema objects and retention review

The catalog shows **two enabled BEFORE UPDATE triggers on `profiles` calling the same `set_updated_at()` function**: `profiles_set_updated_at` and `trg_profiles_set_updated_at`. Both appear in the baseline remote-schema migration. This is a **confirmed redundant trigger action**, not a redundant table/row. A future single-trigger migration should be reviewed and tested on the isolated restored database, including Auth profile updates and timestamp behavior, before any hosted DDL approval.

There are 122 public indexes. A zero `pg_stat_user_indexes.idx_scan` counter is not proof of obsolescence: statistics reset date is unavailable, this project is small, and unique/PK/FK-related indexes enforce integrity even without scans. Review candidate *non-unique* indexes only after representative query plans and workload capture; examples are `menu_items_is_available_idx` and `inventory_batches_receiving_report_item_id_idx` (the latter overlaps a unique partial index but may serve different predicates/FK work). Unique indexes on order IDs, receipt numbers, request IDs, batch origins, and refund references protect business keys and must not be dropped based on zero scans. No view or materialized view exists in `public`; reporting uses RPCs. No obsolete constraint or policy was proven. Existing hosted `authenticated` MAINTAIN grants on `cashier_shifts`, `cashier_transactions`, and `riders` remain a separate, pending approved permission repair from the prior report.

Retention candidates are old completed/cancelled orders and their status histories, cashier shifts/transactions, inventory movements, request/revision/event history, receiving reports and proof metadata. Hosted order rows span 2026-08-16 to 2026-09-15 UTC, and ledger rows span 2026-08-31 to 2026-10-12 UTC. Their ages do not establish expiration. Agree on accounting, tax, refund/dispute, food traceability, privacy, and backup retention periods before designing an archive. Preserve referential links and proof bytes together; a Storage metadata row is not proof that the underlying private object can be deleted.

Key delete hazards: `orders` cascades to `order_items`, `payments`, `order_status_history`, and `delivery_assignments`; stock transactions referencing an order use SET NULL, losing lineage. `menu_items` cascades recipes and modifier links but order items RESTRICT. `purchase_orders` cascades PO lines, while Receiving and stock references may block or be detached. `profiles` cascades `riders`, and Rider deletion is restricted by assignments. Ledger, batches, allocations, refunds, requests, and receipts have RESTRICT/NO ACTION chains. The evidence JSON enumerates every FK and delete action. No direct table deletion is safe without a dependency-specific archival design.

## Prioritized review-only plan

1. **P0, no cleanup:** rotate the again-disclosed database password privately; make and verify an independent protected off-device backup; keep hosted permission repair pending explicit project-specific approval. Release remains NO-GO until browser and Rider device UI checks complete.
2. **P1, clarify ownership:** decide whether direct-supplier purchasing and `supplier_items` are future capabilities, deprecated modules, or external integration points. Compare production API traffic and deployed clients before designating any table unused.
3. **P1, preserve events:** review the 13 repeated-status groups against payment resubmission and rider reoffer logs privately. Confirm the 21 events' reasons; no row deletion is proposed from the present evidence.
4. **P2, low-risk schema candidate:** in a restored isolated same-database stack, test removing one duplicate `profiles` timestamp trigger and verify Auth/profile behavior, then prepare a separately reviewable migration if it is truly equivalent.
5. **P2, retention policy:** define per-record hold periods and archive restore drills for orders, proofs, cashier and inventory audit records. Archive complete related graphs first; compare counts/checksums and application reports before/after. Do not convert audit trails to counters.
6. **P3, index review:** capture representative `EXPLAIN` plans and stats over an agreed operating window. Propose only individually justified non-unique index changes in a local migration. Recheck grants/policies separately.
7. **Approval gate:** any hosted DDL, DML, archival, Storage deletion, migration, RLS or privilege change needs explicit approval for this named project and an exact reviewed statement set. Re-run the read-only SQL preview immediately before that decision.

**Before/after acceptance for any future cleanup:** preserve a complete recoverable baseline; freeze exact target row criteria; verify counts, business keys, FK closure, proof object availability, financial/stock reconciliation, and current Customer → Cashier → KDS → Rider plus request → Receiving → stock workflows on the isolated restored DB. Then review a reversible migration/archive plan and a restore path. This audit proposes **no hosted deletes or drops** and confirms **zero deletable rows** today.
