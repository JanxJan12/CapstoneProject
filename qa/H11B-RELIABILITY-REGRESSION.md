# H-11B reliability regression — 2026-10-16 (Manila)

**Overall: PARTIAL.** The profile/inventory and safety block passed. A reduced-service stop/test/restore was **BLOCKED** by unverified H-08C idle status, as required by the task's safety condition. Resource deltas for an H-11B stop are therefore **NOT TESTED**, not zero. H-11's earlier ~0.6 GiB gain is prior evidence only.

| Check | Result | Evidence |
| --- | --- | --- |
| `node --check scripts/h11-local-profile.mjs` | PASS, exit 0 | Syntax check. |
| `--help` | PASS, exit 0 | Profiles, dry-run, exact opt-out, restoration and limits shown. |
| `plan --profile h09-qa` | PASS, exit 0 | Sanitized [inventory and dry-run](H11B-INVENTORY-AND-DRY-RUN.json); 16 groups, 94/99 running; one proposed H-08C analytics candidate with impact and block reasons. |
| `plan --profile demo` and `all-projects` | PASS, exit 0 | Empty stop lists; no service allowlisted for these profiles. |
| `trial --profile demo --apply` | BLOCKED as designed, exit 1 | No trial allowlist. |
| `trial --profile h09-qa --apply` | BLOCKED as designed, exit 1 | No current idle verification. |
| `stop-optional --profile h09-qa` | BLOCKED as designed, exit 1 | Target started within 30 minutes; current owner/idle status uncertain. |
| `restore` without journal | BLOCKED as designed, exit 1 | Refused arbitrary start. |
| H-11B stop/test/restore | NOT PERFORMED | Temporary stop list **empty**; no H-11B restoration needed; Docker remained 94/99 running at inspection. |
| Longer read-only H-09 Auth/REST/SQL check | PASS for bounded availability; [12-sample JSON](H11B-READONLY-SOAK.json) | 12/12 Auth 200, REST 200 and SQL `select 1`; results below. |
| Long-term OOM avoidance, hosted, Rider, payments | NOT TESTED | Separate release/acceptance boundaries. |

Initial H-11B WSL reading: 7,803 MiB RAM, about 668 MiB available, 2,048 MiB swap with only ~0.2 MiB free. Instantaneous H-08C analytics usage was ~585 MiB. The first three H-09 samples returned Auth 200 in 7–41 ms, REST 200 in 59–63 ms, SQL 3/3, with 601–616 MiB available and ~2,048 MiB swap used. These are all-projects-state observations. The longer session uses the same retained H-09 stack and writes no data. Docker resource readings are instantaneous, and no stop means there is no measured before/after resource delta.

The longer session spanned **2 minutes 27 seconds** (01:23:03–01:25:30 Manila). Auth was 200 in **6–45 ms**, REST was 200 in **51–76 ms**, SQL passed **12/12**, and H-09 DB/Kong restart counts stayed **0**. WSL available RAM fell from a sampled high of **606 MiB** to a low of **431 MiB** while swap remained effectively **2,048/2,048 MiB** used. A subsequent plan warned at **398 MiB available** and full swap; a one-sample recheck warned at **416 MiB** but still returned Auth/REST 200 and SQL PASS. These readings reinforce residual capacity risk even though the bounded HTTP/SQL checks passed. The script's 400 MiB mutation floor would refuse a stop at the 398 MiB reading.

The worktree began with many unrelated tracked and untracked changes. H-11B changed only `scripts/h11-local-profile.mjs`, this report, the profile report, the H-11 routine, and two sanitized JSON results. No application source, migration, Docker volume, business fixture, or hosted resource changed. Application typecheck/build and migration hashes were not rerun for this QA-only edit; earlier H-10B results remain prior evidence.
