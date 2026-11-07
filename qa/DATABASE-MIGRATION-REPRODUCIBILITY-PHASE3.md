# RRJ’S FOOD-HOUSE — Phase 3 migration reproducibility

**Date:** 2026-10-14 (Asia/Manila)  
**Decision:** **FAIL** for a pristine 51-file install; historical data provenance **BLOCKED**. Hosted Supabase `zhzluhqvysvsadwuugpa` was read only. This report extends the [prior migration resolution](MIGRATION-REPRODUCIBILITY-RESOLUTION-20261014.md) and [recovery assessment](DATABASE-REPRODUCIBILITY-RECOVERY-20261014.md); it does not reinterpret the defense demo's synthetic installation as a clean replay.

## Scope and source integrity

The canonical `supabase/migrations` directory contains 51 SQL files, sorted from `20260825183637_remote_schema.sql` to `20261013162631_kds_queue_modifier_channel_v2.sql`. Phase 2A, `20260904000000_inventory_phase_2a_recipe_deduction.sql`, is file 13. The 12 files before it were examined as the only migration prerequisites on a fresh chronological install. No `supabase/seed.sql` exists. The initial remote schema file defines schema, not the restaurant master rows needed by Phase 2A.

The Phase 2A source SHA-256 is `F06983ED7E9BA60F48654F8DF97F177FF8802A0C74297300B851B0226180A5D0`. A filename plus SHA-256 manifest of all 51 sorted files has SHA-256 `941fe8417cc402a6ca45eaee9f084e110145233f800e7aac796898b92aaab922`. All 51 copies in the new replay target matched the canonical files; the 12 prefix copies also matched. These source checks do not establish that every hosted migration body has identical bytes.

The hosted `list_migrations` response contained 46 version/name pairs. All 46 matched the first 46 sorted local version/name pairs; the hosted ledger ends at `20261012181744_manager_inventory_request_documents.sql`. The final five local files are not in that ledger: `20261013000302`, `20261013053159`, `20261013071937`, `20261013105400`, and `20261013162631`. This is ledger identity evidence only. The existing [release gates](RELEASE-READINESS-GATES-20261014.md) and [controlled deployment runbook](CONTROLLED-DEPLOYMENT-RUNBOOK-20261014.md) govern any eventual promotion.

## Tests executed in this phase

| Check | Method and environment | Result | Limit |
| --- | --- | --- | --- |
| Container safety | Read-only Docker/container/volume/network inventory and free-space check before target creation | **PASS** — Docker Engine 29.8.2 available; existing demo, recovery, simulation and unrelated stacks identified and preserved | Does not prove a migration will run |
| Static prerequisite gate | `node scripts/check-clean-migration-prerequisites.mjs` on canonical source | **PASS as blocker detector** — exit 1, `BLOCKED`; 18 recipe tuples reference 10 menu and 12 inventory identities missing from preceding migrations; no seed; two later enum return fields flagged | No master-data provenance supplied |
| Historical approval gate | `node scripts/recovery/validate-provenance.mjs` without a private approved manifest | **BLOCKED as designed** — exit 1; required historical IDs remain absent | A validator cannot approve business meaning |
| Release preflight | `node scripts/recovery/check-release-preflight.mjs` without private approval manifests | **BLOCKED as designed** — five pending source hashes matched, two required approvals absent | Does not authorize hosted work |
| Fresh 51-file replay | New unlinked target `rrj_phase3_replay_20261014_a1`, loopback API/DB ports 63321/63322, seed disabled, Supabase CLI 2.120.0 | **FAIL** — after service dependencies were enabled, replay reached migration 13 and stopped on `menu_ingredients_inventory_item_id_fkey`; migration 12 was the last completed file | Current sanitized output did not retain a SQLSTATE; the independent prior fresh replay captured `23503` at statement 0 on this same migration and constraint |
| Fresh prefix replay | Separate unlinked `rrj_phase3_prefix_20261014_a1`, ports 63221/63222, only the first 12 hash-verified migrations | **PASS for prefix only** — 12 migration ledger rows, ending `20260903170000_remove_legacy_confirm_order.sql` | Does not prove files 13–51 |
| Prefix catalog | Read-only SQL against the new prefix DB | **PASS** — 22 public tables, 34 public functions, 13 public user triggers, RLS on 22/22 tables, 19 policies, 36 public FKs with zero unvalidated, 51 checks, 16 unique constraints | Counts and validation flags do not prove application behavior or every definition's correctness |
| Missing prerequisite rows | Read-only prefix counts | **CONFIRMED FAIL for Phase 2A prerequisite** — `menu_items=0`, `inventory_items=0`, `menu_ingredients=0` while both recipe FKs exist and are validated | A fresh empty prefix is expected to lack rows; the defect is the next migration's dependency on them |

The first two new-target starts used an underspecified service configuration and failed at the initial schema file with `42P01`; those are setup failures, not conclusions about the canonical chain. The target configuration was corrected only in the new disposable directory, and the third run reached the known Phase 2A failure. The failed replay stack was stopped using its own project identity; its test directory and source copies were retained. The successful prefix stack remains isolated for review. No existing volume, container, backup, database or demo stack was reset or deleted.

## Historical dependency and source

Phase 2A inserts 18 recipe relationships whose 10 menu and 12 inventory IDs are absent from all 12 preceding migration files. A validated foreign key rejects the first unsatisfied reference. The dependency is historical restaurant master data, including a reviewed recipe mapping, not merely a missing DDL declaration. The earlier [resolution report](MIGRATION-REPRODUCIBILITY-RESOLUTION-20261014.md) found one referenced inventory identity in a preserved local Chicken/kg row, but its creation history is not an approved business source. That row, its stock and the defense demo's synthetic prerequisites were not copied into this replay.

The source Git history records Phase 2A in commit `6ba695b` (2026-09-10), but no approved pre-Phase-2A menu/inventory baseline was located. An independent later risk is two unqualified `cashier_shift_status` return fields in `20260914000000_harden_numeric_inputs.sql`. That migration was **NOT TESTED** in this pristine run because replay stopped earlier. Other later migration behavior, including the five local-only files, was likewise **NOT TESTED** here.

## Safe resolution path

1. **REQUIRES APPROVAL:** The data owner supplies a private, dated, source-backed baseline for all exact historical identities and recipe relationships. Review names, units, effective dates, recipe quantities and an opening-stock decision. Keep confidential data outside QA and source control. Use the [provenance manifest contract](MASTER-DATA-PROVENANCE-APPROVAL-20261014.md) with hashes and a human sign-off; `REVIEW_REQUIRED` from the machine validator is not approval.
2. Review a deterministic, new-environment bootstrap that runs **before** Phase 2A. Preserve the bodies and hashes of all 51 original files and the existing hosted ledger. Do not substitute placeholder IDs, disable FKs, skip Phase 2A or use later seed data to conceal the failure.
3. Review a separate history-safe compatibility treatment for the later enum fields. Then replay on another independently named empty stack, compare all 51 ledger entries and catalog definitions, and run focused Auth, RPC, RLS, Storage and business regression checks. Record the bootstrap identity and hashes distinctly from the original 51.
4. Keep hosted changes **REQUIRES APPROVAL** under the recovery and release gates. No migration, seed, repair, or production data change was executed in this phase.

**Remaining blockers:** no authoritative historical menu/inventory/recipe baseline, no approved pre-Phase-2A bootstrap, an untested later enum compatibility issue, and no full pristine replay through migration 51. The isolated defense demo remains a separate synthetic **GO**; restaurant production migration reproducibility is **NO-GO**.
