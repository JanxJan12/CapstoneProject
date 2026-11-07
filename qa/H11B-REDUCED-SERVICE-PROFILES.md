# H-11B safe reduced-service profiles — 2026-10-16 (Manila)

**Result: PARTIAL.** The local profile tool now provides a labeled, sanitized inventory and four workload views. Its only process-stop allowlist remains `supabase_analytics_rrj_h08c_history_20261015`. No H-11B container was stopped: current H-08C idle status and a complete dependency boundary could not be established. The dry run explicitly blocked the stop. H-09 remained responsive in a longer read-only session; this does not prove a reduced-service resource gain or indefinite OOM avoidance.

## Inventory and ownership boundary

The machine had 94 running of 99 containers in 16 Compose-label groups, including one unlabeled stopped container. The exact per-container state, Compose and Supabase project labels, network names, published ports, mount **types and container destinations only**, and health appear in [H11B-INVENTORY-AND-DRY-RUN.json](H11B-INVENTORY-AND-DRY-RUN.json). No environment values, keys, database rows, host mount sources, or private bytes are recorded. Supabase CLI containers do not expose a `com.docker.compose.service` label in this inventory; the service role can be inferred from container name and network alias but not treated as a declared Compose dependency graph.

| Boundary | State and network evidence | H-11B decision |
| --- | --- | --- |
| H-09 synthetic QA, `rrj_h09_order_flow_20261015` | 6/6 running; API 48321, DB 48322 and mail 48324 on loopback; DB/Auth/REST/Kong/Storage/Mailpit | Retained health target. No service stopped. |
| H-08C historical fixture, `rrj_h08c_history_20261015` | 11/12 running; API 59321, DB 59322, Studio 59323, mail 59324 and analytics 59327 on loopback; edge runtime already exited | Analytics is RRJ-labeled and has no mount, but it started shortly before inspection and feeds log/Studio workflows. Current idle status is unverified. Stop blocked. |
| Canonical defense demo and two demo variants | 5/5 each, loopback APIs 61321, 62321 and 63321 | Preserved. No stop allowlist. |
| Other RRJ financial, history, manager, phase, simulation, replay and recovery fixtures | Labeled inventory in JSON; replay has no host API/DB bind | Preserved. Current ownership/use and complete downstream dependencies unverified. |
| `isolated-stack`, `my-local-todo-app`, unlabeled stopped container | Separate/uncertain owners | Excluded from all mutations. |

The target's exact Docker and Supabase project labels, expected network alias, 59327 loopback binding, Logflare image family, and absence of mounts were verified. H-09 DB/Auth/REST/Kong identity and running state are required before any future opt-out. H-08C Studio/vector/log workflows may degrade when analytics is stopped; their current use cannot be proved absent by low CPU, labels, or health alone. The H-08C target restarted during the preceding H-11 work and was under the script's 30-minute cool-down at H-11B inspection. No other RRJ fixture was added to the stop allowlist.

## Profiles and workflow

| Profile | Retained workload | Allowed opt-out |
| --- | --- | --- |
| `daily` | H-09 synthetic local stack | H-08C analytics only, after current idle verification |
| `h09-qa` | H-09 browser/API stack | Same narrow candidate; no core H-09 service |
| `demo` | Canonical defense demo | None |
| `all-projects` | All current projects | None |

Run `node scripts/h11-local-profile.mjs --help` for commands. `plan --profile h09-qa` prints the live inventory, exact proposed stop and impact; it never mutates. `sample --profile h09-qa --count 12 --interval 12000` checks loopback Kong, Auth HTTP, REST HTTP, read-only SQL, memory/swap and DB/Kong restarts. `stop-optional` and `trial` are dry-run by default. Their `--apply` path additionally needs `--idle-verified`, an operator attestation based on current ownership/use, plus the script's exact target, retained-stack and resource checks. A plan alone never establishes idle status. Use neither command during H-08C history, Studio, log or vector work.

The opt-out journals the exact previously running container ID before `docker stop -t 15` and permits `restore --apply` to start only that same ID. `trial --apply` runs a bounded 12-sample H-09 check and invokes restoration in `finally`; if stop itself errors, it also attempts restoration. If Docker or the process is interrupted, inspect `.tmp/h11-profile-journal.json` and restore when Docker is available. A restored journal is archived locally. No `rm`, `down`, prune, volume, image, network, WSL, database or hosted operation is in the script. This is a single-service tool, not a broad automatic scheduler.

The canonical dirty worktree, 52 canonical migration files, data volumes, demos, backups and Rider artifacts were preserved. No app source was changed. Hosted Supabase was not contacted; release remains **NO-GO** under the previously recorded migration-provenance, parity, recovery and deployment gates.
