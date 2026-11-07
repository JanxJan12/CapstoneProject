# H-11 container dependencies and profiles — 2026-10-16 (Manila)

## Live project inventory

Docker `com.docker.compose.project` and `com.supabase.cli.project` labels, current state and port bindings were inspected, rather than assigning ownership from names alone. Counts below include exited containers; 94 of 99 total were running. The one unlabeled stopped container is left alone.

| Compose project / owner boundary | Running / total | Host API / DB ports | Use in H-11 |
| --- | ---: | --- | --- |
| `rrj_h09_order_flow_20261015` — RRJ isolated QA | 6/6 | 48321 / 48322 | Chosen H-09/H-10 health target |
| `rrj_defense_demo_20261014` — RRJ canonical demo | 5/5 | 61321 / 61322 | Demo profile |
| `rrj_h08c_history_20261015` — RRJ history QA | 11/12 | 59321 / 59322 | One analytics container allowed for reversible H-09 opt-out; edge runtime already exited |
| `rrj_defense_demo_20261014_r2`, `_r3` — RRJ variants | 5/5 each | 62321/62322; 63321/63322 | Preserve; no ownership/use decision |
| `rrj_h07_financial_20261014`, `rrj_h08b_history_20261015` | 5/5 each | 57321/57322; 58321/58322 | Preserve |
| `rrj_manager_lifecycle_20261014`, `rrj_phase3_prefix_20261014_a1` | 5/5 each | 52321/52322; 63221/63222 | Preserve |
| `rrj_rc_synthetic_replay_20261013` | 5/5 | no published API/DB port at inspection | Preserve; prior 60321/60322 bind failures were separate from H-09 latency |
| `rrj_recovery_20261014_source`, `_target` | 5/5 each | 65321/65322; 64321/64322 | Recovery fixtures; preserve |
| `rrj_phase8_sim` | 11/12 | 55321/55322 | RRJ simulation; preserve; edge runtime exited |
| `isolated-stack` | 5/6 | 56321/56322 | Private backup rehearsal location; preserve |
| `my-local-todo-app` — unrelated personal | 11/12 | 54321/54322 | Never automated or stopped |
| unlabeled `rrj_recovery_rehearsal_20261013` | 0/1 | none | Unknown owner; preserve |

All published API/DB bindings above were loopback at inspection except the replay stack, which had no host bind. Other ports include 48324 H-09 Mailpit; 59323/59324/59327 H-08C Studio/Mailpit/analytics; 55323/55324/55327 simulation equivalents. No current duplicate host binding was observed. H-10B saw failed attempts to bind 60321/60322 on another stack. A future start can collide with another local listener, so recheck port availability and identity before starting any preserved stack.

## Dependency and resource interpretation

For the tested browser/API workflows: PostgreSQL holds the synthetic data; Auth, PostgREST, and Storage use it; Kong exposes their local HTTP routes. Storage remains required for payment proof and file-backed flows. Mailpit is needed for email verification scenarios. Realtime, Edge Runtime, Studio, pg-meta, vector, and analytics serve their respective specialized features and should be enabled when that feature is being tested. These are workflow dependencies inferred from the local Supabase service roles, not a complete generated compose dependency graph. H-08C Studio/log functions may depend on analytics; its opt-out is limited to H-09 QA.

At inspection, the three analytics containers each used roughly **593–600 MiB** per `docker stats`; H-09's six-container set was roughly **279 MiB**. These are instantaneous resident-memory figures, not additive guaranteed savings. The temporary H-08C analytics stop increased measured WSL available memory from about **771–822 MiB** baseline to **1,341–1,461 MiB** during a short sample. Swap remained nearly full. A single optional service produced useful headroom but cannot establish stability with the rest of the 93 containers. Docker image/volume sizes are disk usage, not RAM.

## Profiles and concurrency

| Profile | Required local services for stated workflow | Optional only when unused | Concurrency and measured headroom |
| --- | --- | --- | --- |
| Capstone development | Select the one RRJ stack matching the work; DB/Auth/REST/Kong/Storage for full workflow | Studio, analytics, vector, Realtime, Edge, Mailpit according to feature | Avoid launching another full stack without checking ports and memory. Current all-running state gave under 1 GiB available. |
| Isolated synthetic H-09/H-10 browser QA | H-09 DB/Auth/REST/Kong/Storage; Mailpit only for email cases | H-08C analytics can be opted out by the H-11 script when H-08C is idle | Short trial with one opt-out gave 1.34–1.46 GiB available and 6/6 health samples. Other projects remained running. |
| Capstone demo | Canonical demo DB/Auth/REST/Kong/Storage on 61321/61322 | No automated opt-out defined | 2/2 immediate Auth/REST/SQL samples passed in the all-running state with 778–800 MiB available; prolonged demo stability unproven. |
| H-08C historical shift QA | H-08C DB/Auth/REST/Kong/Storage; analytics/Studio when inspecting logs | No automated opt-out during its own use | Do not use the H-09 opt-out during this profile. |
| All projects | All existing project-specific services | None presumed dispensable | 94 running, heavy swap and H-10B OOM precedent. Not recommended for long interactive QA until coordinated service ownership and a longer soak prove headroom. |

The script intentionally does not stop any full stack, personal-project service, recovery stack, database, or volume. A broader routine needs explicit confirmation of which RRJ fixtures are idle and whether stopping their service process would disrupt another active test; then extend an exact project-label allowlist and restore journal before action.
