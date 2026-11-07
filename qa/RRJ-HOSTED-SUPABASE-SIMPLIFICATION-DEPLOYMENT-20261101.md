# RRJ’S FOOD-HOUSE — hosted simplification deployment preparation

**Decision: NO-GO / BLOCKED before hosted DDL.** This is a preparation and rehearsal record, not a deployment record. The required hosted backup and isolated restoration have not been demonstrated, and the currently deployed web/mobile client contract has not been established. No final owner deployment approval has been requested or given for the exact package.

## 1. Project and revision

- Target only: Supabase project `zhzluhqvysvsadwuugpa` (`RRJS-Foodhouse-Final`, healthy, `ap-southeast-1`, hosted PostgreSQL 17.6.1.147).
- Canonical repository: `C:\Users\Janmari\Downloads\Capstone Project`, HEAD `9748bdef6d31a96282b88dc67f02724b8fd05819`, pre-existing dirty worktree preserved.
- Standalone Rider repository: `C:\Users\Janmari\Downloads\RRJ-Food-House-Rider`.
- Installed Supabase CLI: 2.33.9. Its `db dump`, `migration up`, and `migration list` help was inspected. Current CLI/docs are newer; a version-compatible isolated deployment procedure must be confirmed before use. A blind repository-wide `db push` is excluded.

## 2. Local and hosted migration states

The hosted `supabase_migrations.schema_migrations` ledger has **68** rows; latest `20261030042437`. None of the ten simplification versions below is recorded. The hosted Cashier transaction-history reader exists under version `20261030042437`; the local current-schema clone lacked it and used the local `20261030034730` reader only as a disposable baseline prerequisite. That local version is **not** a pending hosted migration. Existing Phase 2A/local-history divergence means the entire local migration directory cannot be replayed against hosted. No ledger repair was run.

Exact pending candidate package, chronological order and local SHA-256:

| Version and file | SHA-256 |
|---|---|
| `20261026232229_six_table_dependency_harmonization.sql` | `256d39c2a558fd90b780b6e9d91692bc9282f3c60372cedbec7d341b22c8476b` |
| `20261031155629_cashier_db_03a_remove_redundant_profile_rider_objects.sql` | `4f07e02ef83d6292a985256287d1bd05304af8d15d9ee4a184a013b26dcbe688` |
| `20261031172100_document_payment_rejection_fields.sql` | `bf48bab5b1cdc62cbae933b9dc0a10263e8eae361485fedb4c189edf1d47cdac` |
| `20261031184718_cashier_retire_unused_shift_approval_storage.sql` | `e63c6e3bb340161d4f736687ca011401ba220daab5f02fb09b8995e0da7e6347` |
| `20261031190000_cashier_closed_shift_snapshot_prerequisite.sql` | `4e797152482a04c36e088036254ab7cc55af5e74b4998270ee1f0c3cf50e7088` |
| `20261031191307_cashier_remove_shift_explanation_fields.sql` | `7703cf10b65deb6c122402a7c632b2196b10234d6f121a78d9ce9e0fc9a8498f` |
| `20261031192355_cashier_remove_transaction_number.sql` | `c457975008ebb8af7e4f90008a13264fcf63851b0aa24eaa4a3a41a39f37c2af` |
| `20261031193813_remove_unapproved_order_discount_table_and_notes.sql` | `6440029c84cc983424db66d4876dbf3818afd48091cfa5584e94b8af29620906` |
| `20261031194915_remove_general_receiving_and_purchase_order_notes.sql` | `929ccdddde224b5672d48080161553ac21acc5e585024a7d63a450057e0ce094` |
| `20261101053045_remove_release_order_freeform_notes.sql` | `cc385e84ab8840620198dc70372732881a362ed264aa9ed9f956edd3b6443b9b` |

The package includes the November 1 policy-guard, snapshot-protection and Receiving dependency repairs. The local files are review candidates, not yet approved hosted artifacts.

## 3. Hosted read-only baseline and affected data

Hosted public catalog: **36 tables, 414 columns, 132 function identities, 43 noninternal triggers, 80 foreign keys, 31 unique constraints, 134 indexes, 19 RLS policies**. Counts are a point-in-time baseline and must be rechecked immediately before deployment.

| Affected storage | Hosted rows | Values requiring attention |
|---|---:|---|
| Six retired supplier, PO, and production-replenishment tables | 0 each | No rows in any of the six; 0 retained Receiving reports or lines have legacy PO/replenishment links. |
| `orders` | 63 | **2 non-null general notes** (21–33 characters); 0 table numbers, discount types/references, or nonzero discounts. The note contents were not copied into this report. |
| `cashier_transactions` | 42 | **42 transaction numbers and 42 receipt numbers**. Receipt numbers and transaction/order/payment links must remain queryable. The removed legacy identifiers require a verified prechange archive. |
| `cashier_shifts` | 6 | 0 manager approvals, 0 shift notes, 0 variance explanations. Saved money fields remain. |
| `receiving_reports` / `receiving_report_items` | 5 / 9 | 0 general notes in either. Inspection rejection evidence remains. |
| `payments` / `paid_order_cancellations` | 44 / 0 | 2 payment rejection evidence rows; refund/cancellation structures remain. |
| `order_items` | 69 | 0 non-null item instructions; the column remains available. |
| `inventory_transactions` / `inventory_batches` | 89 / 4 | Both structures remain. |
| `auth.users` / `storage.objects` | 11 / 36 | Backup must cover Auth data and distinguish Storage metadata from actual files. |

`order_status_history.notes` has 261 non-null historical entries and is **retained** as audit/status evidence. Payment rejection reasons/notes, item instructions, Receiving rejection reasons, Cashier void reasons, prices, payments, receipts, shift money, stock movements and batches are retained. No hosted records were updated, deleted, or exported in this run.

## 4. Backup and restoration gate

**Hosted backup: BLOCKED / not obtained. Hosted restore: NOT RUN.** The available Supabase connector supports read-only SQL and project inspection but does not expose backup listing or download. The checked shell environment and local `.env.local` expose no direct database connection credential. Prior project evidence shows `supabase db dump --linked` creates or refreshes the temporary hosted `cli_login_postgres` role; running it before the requested final checkpoint would itself change hosted role metadata. The current dashboard backup state was not verified. Thus neither an automatic backup's date/coverage nor a downloadable database backup can be claimed.

The precise remediation is a current, securely delivered hosted logical/physical backup or direct read-only dump access, followed by an isolated restore that checks `public`, `auth`, `storage` metadata, data, dependencies, grants/owners and migration history. Actual Storage objects require separate coverage. Supabase's [backup guide](https://supabase.com/docs/guides/platform/backups) says database backups include Storage metadata but not stored objects. The [CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) documents roles/schema/data exports and managed-schema limitations. No backup identifier or recovery point is available yet.

**Local recovery mechanism: PASS, limited.** A full custom-format `pg_dump` of the synthetic disposable database was restored with `pg_restore --exit-on-error` into a second fresh disposable database in the same PostgreSQL 17.11 container. Source and restore matched: 63 orders, 44 payments, 42 Cashier transactions, 6 shifts, 1 synthetic Auth user, 0 Storage objects, 125 public functions, 32 triggers, 18 policies, 63 FKs, 114 indexes, and authenticated Cashier sale EXECUTE permission. A rollback-only Cashier sale passed in the restored copy. This does **not** prove hosted data, external Storage files, cross-version restore, project settings, OAuth, or full disaster recovery.

## 5. Production-shape migration rehearsal

Fresh disposable `rrj_simplification_hosted_shape_20261101` was cloned from `current_schema_source`. The source has the hosted public object totals except one missing Cashier-history function and lacks an `extensions` schema. Synthetic data then reproduced the measured affected Cashier/order counts: 63 orders with 2 general notes, 44 payments, 42 Cashier transactions with transaction and receipt numbers, and 6 closed shifts. No hosted private rows were copied. The locally present Cashier-history reader aligned the baseline function count. All **10/10** pending candidate migrations then applied in order with `ON_ERROR_STOP=1`; none was skipped. Postflight retained 63 orders, 44 payments, 42 transactions, 6 shifts, all 42 transaction→order→payment amount/receipt links, and zero removed order/transaction columns. The expected final public catalog was **30 tables, 340 columns, 125 functions, 32 triggers, 63 FKs, 26 unique constraints, 114 indexes, 18 policies**.

This is a **PASS for a shape-matched synthetic rehearsal**, not an exact production-equivalent hosted data restore. Hosted PostgreSQL is 17.6; the disposable server is 17.11. The local source lacks hosted Auth/Storage records and some managed-schema details. A verified hosted restore remains mandatory before an actual GO decision.

## 6. Runtime and security results

**PASS on populated disposable final schema:** `verify_consolidated_cashier_sale.sql` (cash sale, payment and receipt amounts, request replay, saved receipt, history, shift money, Customer denial), `verify_manager_inventory_request_documents.sql` (multi-item issue/revision, Receiving, accepted-only stock, batches/movements, duplicate-post denial), `verify_unapproved_order_feature_removal.sql`, `verify_general_receiving_notes_removal.sql`, and `verify_manager_inventory_request_security.sql` (anonymous/RLS/cross-role denial). The restored copy also passed the Cashier sale fixture. Earlier consolidated evidence covers balanced/shortage/overage closure, saved money snapshots, and paid cancellation under isolated fixtures; see `qa/RRJ-DATABASE-SIMPLIFICATION-INTEGRATION-20261101.md`.

**NOT RUN or BLOCKED:** authenticated hosted/production-equivalent browser journey, GCash verification, receipt printing, separate emergency Receiving, KDS fixture requiring the missing local `extensions` schema, Rider delivery/proof device test, parallel race checks, and hosted smoke tests. The local web typecheck/build and Rider typecheck/26 tests previously passed; they do not establish deployed runtime compatibility.

## 7. Pre-deployment risks and decision

**NO-GO.** The two order notes and 42 legacy transaction identifiers would be lost from active columns on migration; receipt numbers and financial links remain, but there is no verified hosted backup containing those prechange values. Hosted Auth and Storage scope, exact grants/owners/default privileges after restore, and deployed-client compatibility are unproven. The local-only snapshot prerequisite is necessary because hosted lacks that trigger. The older Phase 2A migration-history gap forbids a repository-wide replay. These are concrete gates, not a request to reopen the approved simplification.

## 8. Owner authorization status

The owner has authorized preparation and rehearsal, **not the first destructive hosted operation**. The requested final deployment checkpoint is withheld because it must contain a backup identifier and verified restoration result, which do not yet exist. No approval for this exact package was inferred from the general intent to deploy.

## 9. Actual hosted migration results

**NOT DEPLOYED.** Hosted migration ledger remains at the read-only observed 68 rows/latest `20261030042437` for this run; no schema-changing SQL, migration apply, history repair, or hosted role bootstrap was performed.

## 10. Final hosted object counts

**NOT AVAILABLE because deployment has not occurred.** The hosted baseline remains 36 / 414 / 132 / 43 / 80 / 31 / 134 / 19 in the table/column/function/trigger/FK/unique/index/policy order. The 30-table/340-column figures are local targets only.

## 11. Data-integrity reconciliation

Hosted read-only counts established zero rows in the six retired tables, zero legacy Receiving links, two non-null order notes, and 42 paired transaction/receipt numbers. The populated synthetic rehearsal retained all 42 receipt/payment/order links and all financial amounts after simplification. **Hosted postchange reconciliation: NOT RUN** because hosted was not changed. Row counts may drift before any future deployment and must be rechecked under the deployment guard.

## 12. Application compatibility and release status

Local Customer/Cashier/Manager/Kitchen/web-Rider source and standalone Rider source have been updated and typechecked in the prior integration. A local build is not a released client. The connected Sites account contains one older `RRJ's Food-Haus Operations` Site, latest saved version 25 from July 2026 with source commit `9e4b0b1...`; no evidence ties that Site to this November canonical checkout. The Rider repository contains earlier APK artifacts, but no installed-device/client rollout inventory was verified. Therefore compatibility of currently used web and mobile clients with the new RPC signatures is **UNKNOWN**. Before hosted DDL, identify the actual active client URL/build and coordinate release or a narrowly scoped compatible rollout; do not assume old clients stop calling retired signatures.

## 13. Remaining limitations and incidents

No hosted backup listing/download/restore; no direct database dump credential in the inspected environment; linked CLI dump would create/refresh a hosted login role; no exact hosted-data clone; managed Auth/Storage and external Storage files unrehearsed; no deployed-client provenance; no complete signed-in cross-module acceptance. The browser backup-page inspection was interrupted by concurrent user window activity, so it supplies no backup evidence. Existing Supabase advisory notices were inspected read-only; their broad unrelated findings were not changed under this narrow deployment task.

## 14. Exact files changed in this deployment-preparation run

- `supabase/tests/seed_simplification_hosted_shape_rehearsal.sql` — synthetic, disposable-only affected-data fixture.
- `qa/RRJ-HOSTED-SUPABASE-SIMPLIFICATION-DEPLOYMENT-20261101.md` — this focused deployment record.

No historical migration, application source, Rider source, hosted schema, hosted role, hosted migration ledger, or hosted business record was changed in this run.
