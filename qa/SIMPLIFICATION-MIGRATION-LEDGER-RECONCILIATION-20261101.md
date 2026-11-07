# Hosted simplification migration ledger reconciliation — 2026-11-01

Scope: Supabase project `zhzluhqvysvsadwuugpa`; canonical repository `C:\Users\Janmari\Downloads\Capstone Project`. No schema, business-data, or ledger write was made during this reconciliation.

## Ordered candidate package

SHA-256 values below are from current canonical file bytes. The prior deployment report lists the same hashes for the nine unchanged files and the original seventh file. Eight accessible ChatGPT SQL attachments independently matched their original canonical bytes; the attachments for versions `20261031155629` and `20261031194915` were not available to this run. The earlier ChatGPT conversation reports that all ten uploaded files matched the deployment report, but that claim cannot replace direct inspection of the two unavailable uploads.

| # | Version | Canonical file suffix | SHA-256 |
| ---: | --- | --- | --- |
| 1 | 20261026232229 | six_table_dependency_harmonization.sql | 256d39c2a558fd90b780b6e9d91692bc9282f3c60372cedbec7d341b22c8476b |
| 2 | 20261031155629 | cashier_db_03a_remove_redundant_profile_rider_objects.sql | 4f07e02ef83d6292a985256287d1bd05304af8d15d9ee4a184a013b26dcbe688 |
| 3 | 20261031172100 | document_payment_rejection_fields.sql | bf48bab5b1cdc62cbae933b9dc0a10263e8eae361485fedb4c189edf1d47cdac |
| 4 | 20261031184718 | cashier_retire_unused_shift_approval_storage.sql | e63c6e3bb340161d4f736687ca011401ba220daab5f02fb09b8995e0da7e6347 |
| 5 | 20261031190000 | cashier_closed_shift_snapshot_prerequisite.sql | 4e797152482a04c36e088036254ab7cc55af5e74b4998270ee1f0c3cf50e7088 |
| 6 | 20261031191307 | cashier_remove_shift_explanation_fields.sql | 7703cf10b65deb6c122402a7c632b2196b10234d6f121a78d9ce9e0fc9a8498f |
| 7 | 20261031192355 | cashier_remove_transaction_number.sql | 69a451e729c37f6c989a0dc68650546460003145f7a9207ce93202afe634a509 |
| 8 | 20261031193813 | remove_unapproved_order_discount_table_and_notes.sql | 6440029c84cc983424db66d4876dbf3818afd48091cfa5584e94b8af29620906 |
| 9 | 20261031194915 | remove_general_receiving_and_purchase_order_notes.sql | 929ccdddde224b5672d48080161553ac21acc5e585024a7d63a450057e0ce094 |
| 10 | 20261101053045 | remove_release_order_freeform_notes.sql | cc385e84ab8840620198dc70372732881a362ed264aa9ed9f956edd3b6443b9b |

For version `20261031192355`, the original uploaded and pre-correction canonical SHA-256 was `c457975008ebb8af7e4f90008a13264fcf63851b0aa24eaa4a3a41a39f37c2af`. The current canonical file removes exactly the two `ALTER FUNCTION ... OWNER TO supabase_admin;` lines at original lines 1047 and 1375, as the user reports doing in SQL Editor. No other SQL changed. The corrected byte hash above is a reproducible reconstruction from that reported edit, not a hash of a recovered executed SQL Editor query.

## Hosted read-only evidence before repair

- Ledger: 68 rows; latest version `20261030042437`; version/name fingerprint `md5(string_agg(version||':'||coalesce(name,''),',' order by version)) = 0f9cd246a03488aeb9712aeefd5b0fed`. All ten versions above are absent. The separate hosted history-reader version `20261030042437` remains present.
- Public catalog: 30 tables, 340 columns, 125 functions, 32 noninternal triggers, 63 foreign keys, 26 unique constraints, 114 indexes, 18 policies. These match the package's expected postflight totals.
- The six retired tables, `cashier_transactions.transaction_number`, legacy transaction-number sequence, old profile/rider duplicate triggers, and extra profile policy are absent. The receipt-number column and sequence and the closed-shift snapshot trigger exist. Current `create_walk_in_sale`, `verify_customer_gcash_payment(uuid,uuid)`, and `release_ready_order(uuid)` are owned by `postgres`.

## Repair method and blocker

Installed Supabase CLI is 2.33.9. Its `supabase migration repair --help` supports positional versions with `--status applied` and `--linked` or `--db-url`. The [official CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-repair) says this records selected versions as applied without executing their SQL. Its [migration list reference](https://supabase.com/docs/reference/cli/supabase-migration-list) says it compares timestamps only, not SQL bodies. No `db push`, migration replay, direct ledger insert, or repair was run.

Ledger repair is held because the two SQL attachments above are unavailable for direct comparison, the exact corrected SQL Editor query is unavailable for byte verification, and this session has no direct database connection credential for `--db-url`. Using the linked CLI may refresh the hosted `cli_login_postgres` role; the requested write boundary is ledger only. The missing executed artifact or equivalent trustworthy execution record and a ledger-only supported connection route are needed before marking these versions applied.

Final read-only ledger recheck: 68 rows; latest `20261030042437`; the same fingerprint `0f9cd246a03488aeb9712aeefd5b0fed`. All ten targeted versions remain absent and no unrelated version changed.

## Focused continuation and completed repair — 2026-11-01

The preceding blocker describes the earlier attempt. The owner subsequently authorized a state-based reconciliation of the ten already executed SQL Editor migrations, including the known correction to `20261031192355`. The exact SQL Editor query text remains unavailable. The two original upload copies for `20261031155629` and `20261031194915` were not recovered locally; their canonical SHA-256 hashes still match the earlier deployment package record above. This is semantic/state verification, not a claim of byte-for-byte executed-text provenance.

Immediately before repair, a fresh hosted read-only check confirmed 68 ledger rows, none of the ten target versions, unchanged original fingerprint `0f9cd246a03488aeb9712aeefd5b0fed`, and public catalog totals `30/340/125/32/63/26/114/18` (tables/columns/functions/triggers/FKs/unique constraints/indexes/policies). The 12 specifically retired columns and six retired tables were absent; obsolete walk-in, Receiving and release RPC signatures, duplicate profile/rider timestamp triggers, and the extra profile policy were absent. Replacement RPC signatures, owners and relevant `anon`/`authenticated`/`service_role` EXECUTE privileges matched the intended state. The closed-shift snapshot trigger and replacement body checks were present. Hosted business counts were 63 orders, 44 payments and 42 Cashier transactions, with zero broken transaction-to-order/payment links. These checks found no material mismatch.

The canonical repository's linked project ref was `zhzluhqvysvsadwuugpa`. Installed CLI v2.33.9 `migration repair --help` and the official CLI reference were checked. The single bounded command was:

```text
supabase migration repair 20261026232229 20261031155629 20261031172100 20261031184718 20261031190000 20261031191307 20261031192355 20261031193813 20261031194915 20261101053045 --status applied --linked --yes
```

The command reported all ten versions repaired as applied. It did not replay migration SQL. Post-repair hosted checks found exactly **78** ledger rows, all **10** target versions once each, zero duplicate versions, and the original 68 rows' version/name fingerprint still `0f9cd246a03488aeb9712aeefd5b0fed`. The latest version is `20261101053045`. The new rows have the canonical migration names and CLI-populated `statements` fields; a ledger entry records the reviewed file but does not prove the SQL Editor's exact prior bytes.

Public catalog totals remained `30/340/125/32/63/26/114/18`. Business counts remained 63 orders, 44 payments and 42 transactions; zero broken links and the receipt-number column remained. No business-schema migration or business-data statement was executed by repair.

**Linked-connection side effect:** CLI output said `Initialising cli_login_postgres role...`. Before repair, the already existing role had `rolvaliduntil = 2026-10-26 23:24:07.581273+00`; afterwards it was `2026-11-01 07:00:24.726885+00`. Its checked login, superuser, create-db, create-role, replication and bypass-RLS flags were unchanged. Thus the operation was not literally ledger-only: it also refreshed this CLI login role's expiry. No direct database credential for a `--db-url` route was used.

No canonical migration or application source was edited in this continuation. This report is the only local file updated. The pre-existing dirty worktree was preserved.
