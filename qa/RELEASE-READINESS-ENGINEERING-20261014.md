# Controlled release-readiness engineering — 2026-10-14

**Gate: BLOCKED** for local technical clean-install reproducibility. This is not a production deployment decision. Existing successful local flows remain valid within their previously tested environments, but the current migration chain cannot build a fresh environment.

## Exact changes and reproducible commands

| File | Change |
| --- | --- |
| `scripts/check-clean-migration-prerequisites.mjs` | New read-only migration dependency detector; counts Phase 2A IDs absent before that migration, checks seed presence and later enum fields, exits 1 when blocked. No network or database connection. |
| `qa/MIGRATION-REPRODUCIBILITY-RESOLUTION-20261014.md` | Updated root cause, provenance, current 51-file replay evidence, and approval-dependent repair path. |
| `qa/RELEASE-READINESS-GATES-20261014.md` | Updated PASS/FAIL/NOT TESTED gate matrix. |
| This report | Added implementation and checkpoint evidence. |

From the canonical repo, run `node scripts/check-clean-migration-prerequisites.mjs`. Expected current exit is 1 and `cleanReplayPrerequisites: BLOCKED`; it reports 51 migrations, 12 before Phase 2A, 18 relationships, 10 missing menu IDs, 12 missing inventory IDs, and two later unqualified enum fields. Repeat runs are read-only and deterministic.

The disposable replay at `C:\Users\Janmari\Downloads\RRJ-Migration-Replay-20261014-51` copied only `supabase/config.toml` and all 51 `supabase/migrations/*.sql`. Only that copy's project ID and ports changed to 64321/64322 and companion 643xx ports. Every copied SQL SHA-256 matched canonical source. `npx.cmd --yes supabase@2.120.0 start` with nonessential services excluded failed at Phase 2A statement 0, SQLSTATE `23503`, then stopped that stack. Its sanitized `replay.log` contains no recipe SQL, secrets, credentials, customer information, or amounts. No reset, clean, stash, migration repair, hosted call, or business-data mutation was performed against an existing environment.

The current canonical web checks passed: `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run verify:quality` (11 checks). Rider was unchanged and its prior typecheck and 8/8 tests were not rerun. No fresh-stack functional tests were possible because the schema failed to install. Prior preserved-stack browser, API/RPC/RLS and proof results are documented in `REMAINING-REGRESSION-CLOSURE-20261014.md` and the module reports; they are not fresh-install evidence.

## Security, provenance, and scope

The first remote-schema file defines foreign keys but does not version the required master data. The preserved isolated database has the missing UUID as a historical Chicken/kg row, but no source-controlled insertion or authorized baseline establishes that row's provenance. It was read, never exported or injected. The failed migration contains confidential recipe mappings; its raw error was omitted from the retained failure log. No credentials, customer PII, or recipe amounts appear in these reports.

The first failure occurs before current Customer modifier, KDS v2, grants/MAINTAIN, Production policy, and trigger cleanup migrations. No clean-stack comparison of versions, roles, RLS, RPCs, or constraints is possible. Existing local Auth/Storage checks remain separate from schema replay. Hosted state and behavior are NOT TESTED here.

## Forward and rollback checkpoint

Obtain one accountable data-owner decision: an approved, dated, checksummed historical master-data and recipe provenance package for the exact Phase 2A identities, with explicit zero opening stock unless a separately approved physical opening record exists. Review a history-safe pre-Phase-2A bootstrap and later enum compatibility treatment. Then replay all unchanged historical migrations on a newly named unlinked stack and run the synthetic Customer, Cashier, KDS, Manager/Receiving, Production, Rider, RLS, payment-state, Auth/Storage, and schema-comparison matrix. Do not substitute local live rows, invented stock, disabled foreign keys, skipped migrations, or repaired history. A later forward migration cannot fix the earlier failure.

The gate script and QA text are reversible file edits requiring no database rollback. Any future hosted migration or promotion needs separate approval and a separately reviewed forward/rollback plan. The canonical dirty worktree and preserved local test stack remain intact.
