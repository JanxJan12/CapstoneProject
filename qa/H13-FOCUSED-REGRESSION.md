# H-13 focused regression — 2026-10-16 Manila

| Check | Result | Evidence and limit |
| --- | --- | --- |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit` exited 0 after the Receiving list edit. |
| `npm.cmd run build` | **PASS** | Vite built 3,017 modules and `prepare-sites-build.mjs` exited 0. Compilation is not a rendered browser check. |
| `npm.cmd run verify:quality` | **PASS** | Existing non-workflow quality baseline: 11 checks. It does not exercise this Receiving failure path. |
| Source contract review | **PASS, static only** | Confirmed active Manager mount, service RPC names/parameters, and locally versioned Manager role checks. No new RPC or SQL was added. |
| Whole-checkout `git diff --check` | **FAIL, pre-existing unrelated** | Reports trailing whitespace in already-dirty `supabase/config.toml` and `supabase/tests/verify_receiving_batch_foundation.sql`; neither was edited for H-13. Untracked H-13 files are not covered by this Git check. |
| Filter/page/classification failure → stale rows disappear → same-query retry → valid results return | **NOT TESTED (browser/API)** | Requires a controlled failing read and authenticated Manager session. Defer to the consolidated local acceptance campaign under the H-12 development-first plan. Static build does not prove this interaction. |
| Receiving post, stock ledger, role denial and hosted parity | **NOT TESTED in H-13** | No writer or permission change; prior H-01/H-09 local evidence remains scoped to its own fixture. Hosted release stays **NO-GO**. |

No Docker stack or container was created, reset, stopped or inspected; no hosted query/write, browser-heavy QA, migration edit, fixture mutation or Rider repository edit occurred. The dirty checkout and historical evidence remain in place.
