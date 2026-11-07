# H-11C capacity and fixture schedule — 2026-10-16 Manila

**Outcome: owner-actionable plan; live capacity improvement NOT TESTED.** H-11C inspected the local machine and wrote a review schedule. It stopped or restarted no container and changed no WSL setting. Hosted Supabase was not contacted. The release remains **NO-GO** under the separate migration-13 prerequisite, hosted RPC parity, encrypted off-device DB/Auth/Storage restore, and deployment-approval gates.

## Capacity diagnosis

The Windows host has two 8 GiB RAM modules, **16,106.8 MiB usable physical RAM**, 12 logical processors, and **2,526.8 MiB free physical RAM** at the captured host reading. No user `.wslconfig` exists. Docker reports **7.62 GiB / 8,182,239,232 bytes** and 12 CPUs; Linux `MemTotal` is **7,803 MiB**. This is the current WSL/Docker VM ceiling, not the host's full RAM. During this H-11C inventory WSL available memory was **227, 206, 195 and 179 MiB** at successive readings; **2,048/2,048 MiB swap was used**. Memory pressure `some avg10` rose from **2.10** to **6.54** during the checks. These snapshots are not a long-term trend. Docker still reported **94/99 running** in 16 Compose-label groups. H-10B previously documented a global Linux OOM kill and API timeouts under similar pressure; H-11B passed 12/12 bounded Auth/REST/SQL checks while available memory dropped to 431 MiB. Both pieces matter: a healthy request now does not certify safe headroom.

Instantaneous `docker stats` showed H-08C analytics **728.7 MiB**, phase-8 analytics **869.5 MiB**, and personal todo analytics **856 MiB**. These are current container usage, **not** additive reclaim forecasts. H-11's earlier one-container H-08C analytics trial measured WSL available RAM about **771–822 MiB before** and **1,341–1,461 MiB after** a brief stop, with swap still nearly full; H-11B performed no stop. H-11C measured no before/after pause gain.

## Proposed operating windows

| Profile/window | Retained chain | Review-only pause queue | Headroom evidence and gate |
| --- | --- | --- | --- |
| Daily development | H-09 DB → Auth/REST/Storage → Kong; Mailpit for email work. Choose this synthetic stack only if its data contract matches the task. | First review H-07 finance, H-08B history, Manager lifecycle, phase-3 prefix, then older demo variants. | Current all-running H-11C readings 179–227 MiB available with full swap. No daily reduced-state headroom measured. |
| Focused H-09/H-10 QA | H-09 six-service chain including Mailpit where needed. Keep recovery/delivery proof bytes and test data intact. | Same candidates; H-08C analytics only after separate H-08C owner review. Phase-8 simulation and RC replay need specialized review. | H-11B 12/12 read-only checks over 2m27s passed, but no durability proof. |
| Defense demo | Canonical `rrj_defense_demo_20261014` five-service chain and its 61321/61322 ports. Confirm the fixture before rehearsal. | Older variants r2/r3 only if their owners confirm they are unnecessary; other review candidates as above. | H-11 had 2/2 immediate health samples with 778–800 MiB available in all-running state; prolonged demo stability unproven. |
| All projects | All currently running stacks, including personal app, demo and recovery fixtures. | None. | 94 running and current 179–227 MiB available/full swap; use only when concurrency is actually required. |

This is a **schedule**, not an automatic shutdown. After an owner confirms an exact RRJ fixture's last use and no active browser, job, test or dependent service, approve a bounded time window and record its original running state. Start only what the chosen profile needs, and restore exactly what was paused at the agreed end. Do not use low CPU, old start time or no recent lifecycle event as proof of idleness. The full [matrix](H11C-FIXTURE-ELIGIBILITY-MATRIX.md) contains exact project IDs and blockers; the script's `schedule` output names every proposed service and a restore-manifest template.

## Dependency-safe future sequence

1. Before any approved pause, inspect current labels, aliases, IDs, health, mounted data destinations, active clients/jobs and owner sign-off. Capture port bindings and a restore manifest. Check Windows and WSL memory, swap, Docker responsiveness and the chosen retained stack's Auth/REST/SQL health. Do not begin at today's sub-400 MiB WSL reading; investigate pressure first.
2. For an approved *whole disposable fixture*, close its clients and stop ingress (Kong) first, then feature services, then Auth/REST/Storage, with DB last. Do not infer that a role is independent merely because no Compose `depends_on` label exists. Preserve all volumes and stopped container IDs. No whole-stack stop is implemented by the H-11 script.
3. Before a future start, compare the manifest's ports with current Docker-published bindings and Windows listeners. The replay stack has no current host bind, and H-10B observed separate 60321/60322 collision attempts. Start DB and wait for health, then Auth/REST/Storage, feature services as needed, then Kong. Verify project-label identity, original ports, Auth/REST/SQL, and relevant Studio/log/email features. If a port is occupied, stop the attempt and resolve ownership; do not reassign it silently.
4. Repeat comparable before/after measurements at the same selected workload: Windows free RAM, WSL `MemAvailable`, swap used, pressure `some/full`, Docker count and per-target stats, restart/OOM events, and 12 bounded Auth/REST/SQL samples. Record a 30-minute observation window after an approved change. Do not claim sustained stability from the initial result.

**Engineering gates proposed for a future trial, not proven safety limits:** refuse a new mutation below the script's existing **400 MiB** WSL `MemAvailable` floor, on API/SQL failure, identity mismatch, missing manifest, port collision, restart/OOM event, or unverified idle/approval. Treat **800 MiB** available and **90% swap use** as warning triggers (the script already reports them). For declaring a profile usable, seek at least **1,500 MiB WSL available**, swap below **80% used**, stable restart counts, and all 12 probes passing across a 30-minute window; these targets require calibration and may be unattainable without reducing concurrency.

## WSL capacity option

An owner could separately consider a WSL memory ceiling increase, but **no value is approved or applied**. The host had only 2.47 GiB free at inspection, so simply raising the 7.62 GiB VM ceiling could shift pressure to Windows. First reduce confirmed idle fixture concurrency and measure the host under the intended workload. If the owner later chooses a proposed 9–10 GiB ceiling or swap change, obtain the exact host reserve and disk policy, back up the current setting, schedule a Docker/WSL outage, and compare the same measurements before/after. A WSL setting change requires a VM restart and could disrupt every running project; no restart or config write belongs to this H-11C run. The potential RAM gain is **unknown**.

## Owner decision table

| Decision | Exact target(s) | Current call |
| --- | --- | --- |
| Review for a future pause window | `rrj_h07_financial_20261014`, `rrj_h08b_history_20261015`, `rrj_manager_lifecycle_20261014`, `rrj_phase3_prefix_20261014_a1`, `rrj_defense_demo_20261014_r2`, `rrj_defense_demo_20261014_r3` | Candidate only; owner must attest current idleness, downstream use, and restore window. |
| Specialist review | `rrj_phase8_sim`, `rrj_rc_synthetic_replay_20261013`, `supabase_analytics_rrj_h08c_history_20261015` | Blocked by feature/dependency or recent-use uncertainty. H-08C analytics is the only executable single-service allowlist, but is blocked today. |
| Definitely protected | `rrj_h09_order_flow_20261015`, `rrj_defense_demo_20261014`, both `rrj_recovery_20261014_*` stacks, `isolated-stack`, `my-local-todo-app`, unlabeled rehearsal | Keep running state/data unless separately and explicitly approved by each owner. |
| Optional WSL change | User `.wslconfig` memory/swap setting, currently absent | Separate consent after host-reserve measurement and planned outage; no predicted gain. |

All existing Docker volumes, DB fixtures, backups, dirty worktree, 52 migration files/hashes, H-09/H-10 evidence, Rider artifacts and private proofs were left intact. No application test, payment, business-data write, hosted write, prune, remove, `down -v`, WSL shutdown or WSL configuration change was performed.
