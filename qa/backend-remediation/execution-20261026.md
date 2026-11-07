# Backend remediation execution — 2026-10-26

## Scope and baseline

Canonical worktree: `C:\Users\Janmari\Downloads\Capstone Project`; heavily dirty at start (314 `git status --short` entries: 15 deleted, 104 modified, 195 untracked). Existing work was preserved. Hosted project: `zhzluhqvysvsadwuugpa`, inspected with read-only catalog/ledger queries only. No hosted schema, data, grants, RLS, Storage, migration ledger, or business record was written; no deployment, local stack reset, or historical migration edit occurred. Baseline audit: [Phase 1](../BACKEND-AUDIT-REMEDIATION-PHASE1-20261026.md).

## Implemented local change

The Phase 2 provenance gate previously accepted two baseline files while required `menu_items.category_id` parents remained unchecked. `scripts/recovery/validate-provenance.mjs` now requires separately hashed category, menu, and inventory baselines, explicit category-source approval, valid unique UUIDs, nonempty names/units, and a category parent for every supplied menu row. It still checks the ten recipe menu IDs, twelve inventory IDs, one Chicken/kg identity, 18-tuple digest, approved opening-stock decision and private file confinement. A structurally valid synthetic manifest returns only `REVIEW_REQUIRED`; it never writes data or establishes historical truth. The private contract text was updated in the two directly relevant owner/provenance documents. `scripts/recovery/provenance-self-test.mjs` exercises the valid-structure, missing-parent and missing-category-approval branches using temporary synthetic files.

The [candidate prerequisite register](phase2-prerequisites-20261026.md) records the exact 10 menu, 12 inventory and five category UUIDs, names/units and menu-category links seen in the later export. All are explicitly **candidates**. The owner approval fields remain unsigned; no private historical approval manifest was created or copied into the repository.

## Phase status and evidence

| Phase | Status | Evidence and next dependency |
| --- | --- | --- |
| 2. Historical bootstrap and clean replay | **BLOCKED** | Phase 2A unchanged, SHA-256 `f06983ed7e9ba60f48654f8df97f177ff8802a0c74297300b851b0226180a5d0`; 12 predecessor files provide zero of 10 required menu and 12 inventory IDs. Five category parents are an additional FK dependency. Previous untouched disposable replay failed at Phase 2A SQLSTATE `23503`. No approved original rows, recipe review or opening-stock decision; replay and full database SQL regression therefore not rerun. Isolated enum review variant prepared with exactly two qualifications: source `2032b4799a197e95292179f264af47726b758f82453a08aeb2f0464d2b4200fc`, variant `7f8c3b83ff3382d0324661c0f6a578c74535c980132058ce16db61eba3e48cd3`; review only. |
| 3. Migration reconciliation and recovery | **PARTIAL / BLOCKED** | Fresh hosted read-only migration list has 63 entries; local directory has 64. Existing reconciliation identifies 48 common versions, 15 hosted-only, 16 local-only and 10 same-name cross-version candidates. Name equality is not applied-SQL or object equivalence. No independently verified current encrypted database/Auth/private-Storage copy or restore authorization. No ledger mutation. |
| 4. Integrity and historical exceptions | **PARTIAL / BLOCKED** | Fresh read-only `information_schema.triggers` query found both `profiles_set_updated_at` and `trg_profiles_set_updated_at` on `profiles`, and both `riders_set_updated_at` and `trg_riders_set_updated_at` on `riders`, all BEFORE UPDATE. Local cleanup migration exists but is local-only and was not applied. Earlier audit's delivered orders lacking settlement links and five `no_history` inventory rows remain evidence-dependent; no synthetic correction. Current-state comprehensive inventory/request/Receiving reconciliation was **NOT RUN** in this execution. |
| 5. Security | **NOT COMPLETE** | Existing audit identifies privileged-function review needs. No six-role authenticated/RLS test or complete function matrix was run here; production access was not changed. |
| 6. End-to-end workflows | **NOT TESTED in this execution** | Write-based lifecycle scenarios require a fully installed isolated database with test identities. Hosted write tests were prohibited. |
| 7. Architecture and performance | **NOT COMPLETE** | No retirement migration or performance claim; no production workload/explain comparison. |
| 8. Production acceptance | **NO-GO** | Clean replay, authoritative provenance, complete independent recovery and security/workflow acceptance remain open. No deployment approval or action. |

## Actual checks

| Check | Result | Detail |
| --- | --- | --- |
| `node scripts/recovery/provenance-self-test.mjs` | **PASS** | Synthetic valid structure yields `REVIEW_REQUIRED`; missing category parent and category approval fail closed. |
| `node scripts/recovery/validate-provenance.mjs` without private manifest | **BLOCKED as designed**, exit 1 | Lists 10 absent menu and 12 absent inventory IDs; no authoritative approval. |
| `node scripts/check-clean-migration-prerequisites.mjs` | **BLOCKED as designed**, exit 1 | 64 files, 12 predecessors, 18 tuples, 10/12 absent IDs and two later unqualified enum fields. |
| Isolated enum variant generator | **PASS for generation only** | Two replacements, hashes above; file under `%TEMP%`, not applied. |
| `node scripts/recovery/reconcile-migration-ledger.mjs` | **PASS for version inventory only** | Uses the Phase 1 hosted snapshot; fresh live ledger count of 63 was independently checked read-only. |
| `node scripts/recovery/preflight-self-test.mjs` | **FAIL**, exit 1 | Existing `check-release-preflight.mjs` expects a 52-file tail and pinned KDS hash `0ed925...`; current dirty tree has 64 files and KDS file hash `5cf18b1d...`. The mismatch was not suppressed or re-pinned without review. |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit`. |
| `npm.cmd run verify:quality` | **PASS** | 11 non-workflow checks. |
| `npm.cmd run build` | **PASS** | Vite production build; does not prove database or hosted workflows. |
| `git diff --check` across the dirty tree | **FAIL** | Existing trailing whitespace in `supabase/config.toml:124` and `supabase/tests/verify_receiving_batch_foundation.sql:13`; both are outside this change and were preserved. Git also warned about line-ending conversion in unrelated files. |
| Full pristine replay, SQL suite, six-role and end-to-end checks, restore | **NOT RUN / BLOCKED** | Missing approved historical source and/or independently authorized isolated recovery material. |

## Next controlled action

The accountable owner reviews the existing [unsigned package](../M3-2C-A-OWNER-APPROVAL-PACKAGE.md) against original dated records and supplies a private, signed category/menu/inventory baseline, recipe-digest decision and opening-stock decision. Engineering then independently reviews exact fields and FK insertion order, prepares a new-environment-only bootstrap, runs a pristine unlinked replay with the reviewed enum variant, and records SQL regression results. Separately review the changed KDS migration bytes and the preflight's 52-file release scope before updating any pin; do not infer equivalence from matching names. Hosted changes and recovery operations need their own explicit approval.
