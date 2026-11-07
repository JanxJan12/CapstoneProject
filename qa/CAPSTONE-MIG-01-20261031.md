# CAPSTONE-MIG-01 — clean migration replay root cause and repair design

**Investigation:** 1 November 2026, Asia/Manila. **Scope:** read-only repository/hosted inspection, isolated Supabase replay, QA only. **Decision:** **ROOT CAUSE CONFIRMED; history not repaired.** No historical migration, application code, hosted schema or hosted business row was changed.

## 1. Executive diagnosis

The first blocker is a **data-dependent historical migration**. `20260904000000_inventory_phase_2a_recipe_deduction.sql` is migration **13 of 71** and begins with one `INSERT ... ON CONFLICT DO UPDATE` of **18** `public.menu_ingredients` recipe pairs. Those pairs reference **10 fixed `public.menu_items.id` values and 12 fixed `public.inventory_items.id` values**. The first 12 migrations define the tables, primary keys and validated foreign keys but insert **none** of those parent rows; the clean pre-Phase-2A database has zero categories, menu items, inventory items and recipe rows. The first missing inventory parent is `b467aeba-d158-4c6d-b43b-1b71a60910c4`. PostgreSQL correctly rejects the child insert. The schema relationship is valid; the absent **approved master-data baseline before migration 13** is the defect.

Later hosted data cannot make an empty chronological install work. Hosted currently contains all 10 required menu IDs, all 12 inventory IDs and all 18 recipe pairs, but its original source/provenance and timing cannot be established from current rows alone. A later October configuration migration is itself conditional on historical Chicken/Viands identities and cannot run before the September failure. A forward-only migration appended after Phase 2A cannot repair a failure before it is reached. [Supabase seed files run after migrations](https://supabase.com/docs/guides/local-development/seeding-your-database), so a normal `supabase/seed.sql` cannot satisfy this prerequisite either.

## 2. Worktree, tooling, and evidence boundary

The branch is `main...origin/main` with extensive pre-existing dirty source and untracked QA. No reset, stash, stage or cleanup of user work occurred. `supabase/config.toml` specifies PostgreSQL major 17 and the canonical local project ID/ports; CLI v2.33.9 and Docker server 29.9.2 were available. The canonical directory has **71** sorted SQL migrations. The Phase 2A file SHA-256 is **`F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0`**, matching prior investigations. `supabase/seed.sql` does not exist. The first 12 files end at `20260903170000_remove_legacy_confirm_order.sql`.

Reviewed [DB-03A replay](CASHIER-DB-03A-20261031.md), [DB-02B](CASHIER-DB-02B-20261031.md), its replay SQL, [DB-01](CASHIER-DB-01-20261031.md), [manual findings](CASHIER-MANUAL-FINDINGS-20261030.md), prior [migration resolution](MIGRATION-REPRODUCIBILITY-RESOLUTION-20261014.md), [Phase 3 reproducibility](DATABASE-MIGRATION-REPRODUCIBILITY-PHASE3.md), [Phase 2 prerequisite register](backend-remediation/phase2-prerequisites-20261026.md), Phase 2A/6B.2/6B.5C SQL, the remote-schema snapshot, the existing prerequisite/provenance validators, config, README and CLI help. Previous reports already identified this blocker; this milestone independently reproduced its pre-state and error with current files.

## 3. Exact first failure and prerequisite catalog

In a new, unlinked Supabase CLI project, only the **first 12 unchanged migrations** were copied and applied in order. The CLI initialized a clean PostgreSQL **17.4** local development database on loopback port **59522**; the hosted server reports PostgreSQL **17.6**. The prefix ledger contained exactly 12 rows. The relevant local extensions included `pg_graphql`, `pg_stat_statements`, `pgcrypto`, `supabase_vault`, `uuid-ossp` and `plpgsql`. This is Supabase bootstrap, not plain stock PostgreSQL. Version/extension differences remain environment-parity limits, but do not explain the missing parent rows: the relevant objects already existed and the FK fired normally.

| Prerequisite at the end of migration 12 | Required by Phase 2A | Observed clean prefix | Diagnosis |
| --- | --- | --- | --- |
| `public.menu_categories(id)` parent | Menu rows need valid category IDs | Table/key present; **0 rows** | Data absent, not table absent |
| `public.menu_items(id)` primary key | 10 recipe menu UUIDs | PK present; **0 rows** | All 10 parents absent |
| `public.inventory_items(id)` primary key | 12 recipe inventory UUIDs | PK present; **0 rows** | All 12 parents absent |
| `public.menu_ingredients(menu_item_id)` FK | References menu PK, `ON DELETE CASCADE` | FK present and validated; 0 rows | Correct protection |
| `public.menu_ingredients(inventory_item_id)` FK | References inventory PK, `ON DELETE RESTRICT` | FK present and validated; 0 rows | **Constraint reporting the failure** |
| Recipe pair uniqueness and quantity check | Upsert target/positive quantities | Present | Not first failure |

The FK and PK definitions originate in `20260825183637_remote_schema.sql` (inventory table around line 4085, recipe table around line 4151, PKs around 4507/4557, FKs around 4893/4898). The preceding `20260831151352_manager_inventory_mvp.sql` does not insert the 10/12 referenced identities. Source search of all 12 predecessors and the read-only `check-clean-migration-prerequisites.mjs` both found 10/10 menu and 12/12 inventory IDs absent. The only literal `b467...` references in the migration directory before later configuration are in Phase 2A itself. A later `20261004163102_controlled_foodhouse_inventory_menu_configuration.sql` introduces different controlled menu/inventory records and explicitly expects an existing Chicken/kg row, an active Viands category and unchanged historical recipes. Its later date and guards make it an unsuitable first-parent bootstrap.

The unmodified Phase 2A file was copied into the clean prefix container and executed with `psql -v ON_ERROR_STOP=1 -v VERBOSITY=verbose`. It exited **1** at **file line 125, first SQL statement**. Complete concise PostgreSQL diagnostic (recipe amounts omitted):

```text
ERROR: 23503: insert or update on table "menu_ingredients" violates foreign key constraint "menu_ingredients_inventory_item_id_fkey"
DETAIL: Key (inventory_item_id)=(b467aeba-d158-4c6d-b43b-1b71a60910c4) is not present in table "inventory_items".
SCHEMA NAME: public
TABLE NAME: menu_ingredients
CONSTRAINT NAME: menu_ingredients_inventory_item_id_fkey
LOCATION: ri_ReportViolation, ri_triggers.c:2599
```

After failure, `menu_ingredients` remained **0** and the migration ledger remained **12**. This is the first statement of the file, not a failed `CREATE TABLE` or an invalid FK definition. A full 71-file CLI replay in DB-03A independently stopped at the same migration and `23503` before reaching DB-03A. The direct prefix reproduction confirms the cause without changing any canonical migration.

## 4. Root-cause classification and hosted comparison

| Category | Classification | Evidence |
| --- | --- | --- |
| Historical ordering/data dependency | **CONFIRMED** | Child INSERT is migration 13; no parent-data installation in migrations 1–12. |
| Historical schema-definition defect | **EXCLUDED as first cause** | PKs, compatible UUID columns and validated FKs exist; PostgreSQL reports missing parent *row*, not missing key/type/table. |
| Supabase bootstrap or plain-Postgres mismatch | **EXCLUDED as first cause** | Official CLI Supabase bootstrap applied 12 files, relevant objects exist and the FK is operational. Patch-version/extension parity is limited. |
| Migration execution method | **EXCLUDED as first cause** | CLI full replay and direct execution of the unchanged file on its CLI-built prefix both fail at the same first statement. |
| Hosted schema drift/manual change | **UNVERIFIED as historical explanation** | Hosted has parent/child rows now, but current catalog and ledger do not date or prove how original master data arrived. Do not attribute it to an operator. |
| Later forward correction | **EXCLUDED as complete fix** | A later migration cannot be reached while migration 13 fails. |

Hosted read-only catalog shows `inventory_items_pkey`, `menu_items_pkey`, both recipe FKs and `menu_items_category_id_fkey` with the same key relationships. Hosted aggregates show **5 categories, 20 menu rows, 18 inventory rows and 28 recipe rows**; targeted ID checks found **10/10** Phase 2A menu parents, **12/12** inventory parents and **18/18** recipe pairs. Exactly one Chicken/kg row and the cited Chicken UUID exist now. The hosted ledger has **68** version/name entries, including Phase 2A and October 4 configuration, ending at hosted version `20261030042437`; the canonical local directory has 71 files with some later version/name divergence. Ledger identity does not prove SQL-body equivalence. `supabase_migrations.schema_migrations` stores statement arrays, so any later historical-body edit requires explicit source/ledger reconciliation; no such edit is authorized here.

## 5. Independent later blockers — diagnostic copies only

To assess whether Phase 2A is the sole obstacle, a *separate* disposable copy of all 71 files omitted only Phase 2A's first 125-line recipe INSERT statement. This deliberately invalidates the recipe-data portion and is **not** an approved fix or clean replay. It passed Phase 2A's remaining SQL, then stopped at **`20260914000000_harden_numeric_inputs.sql`**, statement 3, SQLSTATE **`42704`**, `type cashier_shift_status does not exist` in `public.start_cashier_shift`'s unqualified `RETURNS TABLE(status cashier_shift_status, ...)`. The same historical file has a second unqualified `status` return declaration. The enum is in `public`; qualification is robust against the runner's effective search path. The precise session-setting cause was not independently captured, so classify this as a confirmed **name-resolution compatibility failure**, not a proven missing enum.

A second run of that same disposable diagnostic copy additionally qualified only those two return declarations to `public.cashier_shift_status`. It advanced through that migration, then stopped at **`20260923000000_inventory_po_semantics_foundation.sql`**, SQLSTATE **`P0001`**: `Phase 6B.2 expected exactly one Chicken inventory item with base unit kg.` Its `SELECT ... INTO STRICT` guard saw none because the diagnostic had intentionally omitted recipe insertion and supplied **no** master-data baseline. This is a second data dependency, not an independently safe repair for Phase 2A. A later October configuration migration similarly requires an existing Chicken/kg identity and an active Viands category, but was **NOT REACHED**; it is a potential downstream gate, not a reproduced third failure in this run. No Chicken ID, category, stock, balance, batch or recipe amount was fabricated in either diagnostic. The complete 71-file chain has **not** passed.

## 6. Remediation alternatives

| Strategy | Clean-install coverage | Hosted/history/data impact | Decision |
| --- | --- | --- | --- |
| Append a forward-only migration after Phase 2A | None for the first failure | Low historical edit risk but unreachable on clean install; could mutate already-correct hosted rows | **Reject as complete solution** |
| Rewrite the deployed Phase 2A file to skip or synthesize the INSERT | Could traverse first failure, but erases required recipes or invents business data | Source/hosted statement divergence, review and recovery burden; financial/stock semantics at risk | **Reject without exceptional historical-change approval** |
| Verified pre-Phase-2A master-data baseline | Supplies exact parents before unchanged recipe INSERT | New-environment only, can keep hosted data untouched; requires provenance and owner approval | **Preferred first increment** |
| Fix CLI/bootstrap/search path alone | May address the later enum lookup | Cannot create 22 missing business parents | **Insufficient for first failure** |
| Versioned baseline/squash with later migrations | Can make one-step install reproducible if all contents verified | Highest history/ledger and recovery complexity; not justified before provenance/full replay | **Defer** |
| Rename/reorder existing migration files | Could change execution order superficially | Conflicts with deployed versions and later business guards; no validated data source | **Reject** |

## 7. Preferred implementation specification — **proposal, not executed**

**Increment 1: approved new-environment baseline.** Reuse the existing read-only `scripts/recovery/validate-provenance.mjs` contract. The accountable owner must provide a private, hashed, dated source/approval manifest for **5 category parent identities, 10 menu identities with category links, 12 inventory identities with units, and the 18 confidential recipe-tuple digest**, plus an explicit opening-stock decision and evidence ID. The current validator returns **BLOCKED** because no authoritative manifest was supplied; a structurally valid manifest would return only `REVIEW_REQUIRED`, never permission to write. The later October 13 export described in the prerequisite register is *candidate provenance evidence*, not an automatic historical baseline. Do not copy its balances or assume a physical opening count.

After owner and security/finance review, implement a **new-install-only bootstrap procedure** (proposed `scripts/recovery/apply-approved-pre-phase2a-baseline.mjs` and a documented runner, exact names subject to next milestone). On an unlinked clean Supabase database, apply the first 12 unchanged migrations, require the approved manifest/hash and exact empty/preexisting-state assertions, then insert approved category parents, menu rows and inventory rows **in FK order in one transaction**. Verify exact IDs, names/units/category links, uniqueness, price/code and quantity constraints, and approved opening-stock state. Do not insert recipes independently: the unchanged Phase 2A migration should remain the authority for its 18 pairs. Then apply remaining migrations with the supported local `supabase migration up --local` workflow and verify every ledger version and object. The existing `scripts/check-clean-migration-prerequisites.mjs` should remain a fail-closed static gate. A normal one-shot `supabase db start`/`db reset` with all files still fails until a reviewed baseline-aware orchestration or equivalently approved installation baseline exists; do not label the split workflow one-shot reproducibility.

The bootstrap's proposed **transaction contract** is: assert ledger contains exactly the first 12 expected versions and no later version; assert the four master/recipe tables are empty; verify the approved manifest digest and 5 category, 10 menu, 12 inventory identities against the Phase 2A parser; insert approved `menu_categories(id,name,...)` first, `menu_items(id,category_id,name,code,price,...)` second and `inventory_items(id,item_name,unit,quantity_on_hand,reorder_level,...)` third; assert every menu category parent and every recipe-referenced ID now resolves; commit only if counts, unique constraints, nonnegative quantities and opening-stock approval all pass. Populate the ellipses **only from approved source fields**; no UUID, price, unit, stock or name should be defaulted by a guess. On any failure, roll back the entire transaction and leave Phase 2A unapplied. This is a procedural specification, not executable seed SQL or an approval to load the later export.

**Increment 2: enum compatibility.** Independently review how to make the two `RETURNS TABLE` declarations in `20260914000000_harden_numeric_inputs.sql` resolve `public.cashier_shift_status` in a clean installation. The diagnostic copy proves qualification traverses that point, but editing the canonical already-deployed file requires an explicit historical-change approval, original/new hashes, hosted statement comparison, team migration-history reconciliation, and fresh replay. An installation-baseline approach that avoids editing old bytes may be preferable if it preserves the existing hosted ledger. No forward migration alone can fix a failure while loading that historical file.

The above is a *design*, not executable SQL or approved business data. A future implementation must compare clean-install and current-hosted states separately. Existing hosted already has all identified parents and pairs, so the bootstrap must **never** run there or against an existing local business database. It must be scoped to a newly created, unlinked target and fail on collisions or a nonempty state. For that target, abort/roll back the baseline transaction on any mismatch and discard only that named disposable environment if replay fails. For an existing hosted system, recovery is its own backup/restore and migration-ledger process; do not call a local bootstrap rollback a production recovery plan.

## 8. Acceptance and impact gates for the next milestone

Before calling history reproducible: approve provenance and opening balances; validate manifest and exact source hashes; test category → menu/inventory insertion in an unlinked environment; run all **71 current files** or a separately approved reconciled baseline/history from empty through the last migration; confirm the later enum/Chicken/Viands gates, ledger order and SQL bodies; compare Auth/RLS, recipes, inventory, payments, Cashier receipts/shifts, Manager reports, KDS and Rider contracts against the current accepted schema; run synthetic API/role and financial checks; demonstrate database **and private Storage** recovery where deployment is in scope. No recipe constraint, FK, financial record or stock ledger should be dropped or invented to achieve a green replay. DB-03A remains **local acceptance only** until those gates pass and hosted work receives separate authorization.

## 9. Verification, uncertainty, and changed files

| Check | Status |
| --- | --- |
| Source/migration order/hash, prerequisite validator, prefix catalog, direct Phase 2A SQLSTATE | **PASS** for diagnosis; clean replay itself **FAIL** |
| Hosted PK/FK, parent IDs, recipe-pair and ledger inspection | **PASS**, read-only |
| Diagnostic downstream `42704` and `P0001` reproduction | **PASS as diagnostic failures**, not a clean migration pass |
| Owner-approved historical master-data provenance/opening balance | **BLOCKED**, no approved manifest |
| End-to-end 71-file clean replay, authenticated app/financial/KDS/Rider integration after remediation | **NOT RUN / BLOCKED** by the first and later gates |
| Typecheck/build | **NOT RUN**; no app/source behavior change and no question about compilation |
| Hosted deployment, hosted business-data write, historical migration edit | **NOT RUN**, outside authorization |

The prefix container and its named disposable data volume were stopped/removed via scoped `supabase stop --project-id rrj_capstone_mig01_prefix_20261101 --no-backup`; diagnostic failure containers also stopped. Existing current-contract containers/volumes were not changed. Two disposable *directory copies* remain in Windows Temp (`rrj_capstone_mig01_prefix_20261101` and `rrj_capstone_mig01_diagnostic_20261101`); they contain copied configuration/migrations, with the diagnostic copies visibly modified, and no running service. They are not canonical artifacts. No private backup or production credentials were used.

**Repository files changed:** this report and an appended section in `qa/CASHIER-MANUAL-FINDINGS-20261030.md` only. No active/historical migration, application file, seed file or tooling script changed. No hosted modification occurred.
