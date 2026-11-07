# Database disposition register — 2026-10-14

Scope: all 34 public application tables and 378 columns. Hosted row counts and catalog metadata come from the 2026-10-13 read-only capture; table/column counts were reconfirmed read-only on 2026-10-14. Exact null and distinct counts were calculated on the preserved isolated restored database, whose synthetic QA rows make them **local only**. No cell values, PII, recipe contents, or secret fields were exported.

The [JSON](DATABASE-DISPOSITION-REGISTER-20261014.json) records each table’s domain, lifecycle, owner/writer, lexical source and SQL-function consumers, PK, full local constraint catalog (including unique/check), incoming/outgoing FKs, hosted indexes and scan counters, RLS, policies, grants, triggers, row counts, classification, justification, and safety/retention gate. The [table CSV](DATABASE-DISPOSITION-TABLES-20261014.csv) and [column CSV](DATABASE-DISPOSITION-COLUMNS-20261014.csv) are machine-readable flat views. Run `node qa/build-database-disposition-20261014.mjs` only against the preserved isolated stack to regenerate local profiles.

A source match is lexical evidence, not proof of a runtime call. RPC consumers may not name their backing tables. Zero rows, all-null fields, and zero index scans are review signals, never removal proof.

| Table | Domain | Hosted rows | Local rows | Source files naming table | SQL functions naming table | Decision |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `cashier_shifts` | sales_payment | 5 | 30 | 0 | 8 | RETAIN |
| `cashier_transactions` | sales_payment | 26 | 60 | 0 | 8 | RETAIN |
| `delivery_assignments` | fulfillment | 14 | 28 | 2 | 13 | RETAIN |
| `inventory_batches` | inventory_ledger | 2 | 23 | 0 | 16 | RETAIN |
| `inventory_items` | inventory_ledger | 18 | 34 | 1 | 36 | RETAIN |
| `inventory_opening_balances` | inventory_ledger | 0 | 0 | 0 | 2 | RETAIN |
| `inventory_request_documents` | requisition_receiving_procurement | 1 | 17 | 0 | 10 | RETAIN |
| `inventory_request_events` | requisition_receiving_procurement | 3 | 66 | 0 | 8 | RETAIN |
| `inventory_request_lines` | requisition_receiving_procurement | 2 | 18 | 0 | 7 | RETAIN |
| `inventory_request_revisions` | requisition_receiving_procurement | 1 | 19 | 0 | 3 | RETAIN |
| `inventory_transaction_batch_allocations` | inventory_ledger | 0 | 0 | 0 | 3 | RETAIN |
| `inventory_transactions` | inventory_ledger | 43 | 128 | 0 | 13 | RETAIN |
| `kds_terminals` | fulfillment | 2 | 16 | 0 | 4 | RETAIN |
| `menu_categories` | catalog_recipe | 5 | 8 | 2 | 2 | RETAIN |
| `menu_ingredients` | catalog_recipe | 28 | 28 | 0 | 7 | RETAIN |
| `menu_item_modifier_groups` | catalog_recipe | 27 | 27 | 0 | 1 | RETAIN |
| `menu_items` | catalog_recipe | 20 | 22 | 2 | 6 | RETAIN |
| `menu_modifier_groups` | catalog_recipe | 6 | 6 | 0 | 1 | RETAIN |
| `menu_modifier_options` | catalog_recipe | 16 | 16 | 0 | 1 | RETAIN |
| `order_items` | sales_payment | 50 | 100 | 4 | 9 | RETAIN |
| `order_status_history` | fulfillment | 223 | 438 | 3 | 17 | RETAIN |
| `orders` | sales_payment | 45 | 95 | 49 | 28 | RETAIN |
| `paid_order_cancellations` | sales_payment | 0 | 0 | 0 | 2 | RETAIN |
| `payments` | sales_payment | 27 | 75 | 31 | 15 | RETAIN |
| `production_replenishment_requests` | requisition_receiving_procurement | 0 | 4 | 0 | 9 | RETAIN |
| `production_replenishment_status_events` | requisition_receiving_procurement | 0 | 13 | 0 | 2 | RETAIN |
| `profiles` | identity | 8 | 149 | 6 | 67 | OPTIMIZE |
| `purchase_order_items` | requisition_receiving_procurement | 0 | 0 | 0 | 8 | RETAIN |
| `purchase_orders` | requisition_receiving_procurement | 0 | 0 | 1 | 6 | RETAIN |
| `receiving_report_items` | requisition_receiving_procurement | 2 | 23 | 0 | 18 | RETAIN |
| `receiving_reports` | requisition_receiving_procurement | 1 | 24 | 0 | 20 | RETAIN |
| `riders` | identity | 2 | 19 | 17 | 12 | OPTIMIZE |
| `supplier_items` | requisition_receiving_procurement | 0 | 0 | 0 | 1 | RETAIN |
| `suppliers` | requisition_receiving_procurement | 0 | 0 | 2 | 4 | RETAIN |

## Column decisions

All 378 columns are **RETAIN** pending column-specific consumer, data-retention, and external integration proof. The column CSV includes physical local null and distinct ratios, including conditional tables with zero rows (ratios intentionally null). All-null in this local restore is flagged as a local observation only. Cached stock and order values remain because their write protocols and historical snapshot meaning differ from source master fields. There is no evidence-backed column drop.

## Immediate optimization

Profiles and riders are marked **OPTIMIZE** solely for the already versioned removal of one duplicate timestamp trigger per table. No table, column, index, history row, grant, or policy is classified REMOVE. Supplier/PO, opening balance, cancellation, request event, and allocation tables remain conditional or historical contracts.
