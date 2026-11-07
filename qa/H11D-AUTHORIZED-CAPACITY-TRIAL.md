# H-11D authorized capacity trial — 2026-10-16 Manila

**H-11F post-boot update:** Docker and protected/recovery stacks now pass bounded checks after the owner-side Windows restart. H-11D remains **BLOCKED** because WSL available memory fell below the 400 MiB refusal floor, swap was nearly full, Windows free RAM was about 567 MiB, and exact idle/dependency/restore conditions for the allowlisted service remain unverified. No trial stop, restore or capacity gain occurred. See [H11F-WINDOWS-RESTART-AND-RECOVERY.md](H11F-WINDOWS-RESTART-AND-RECOVERY.md).

**H-11F continuation:** The planned Windows restart was not issued in this Work session; post-boot recovery remains pending. Fresh Docker inventory failed with the Linux-engine pipe absent, and protected H-09/demo Auth/REST were unavailable. H-11D remains **BLOCKED**; no fixture stop, restore, or capacity gain was measured. See [H11F-WINDOWS-RESTART-AND-RECOVERY.md](H11F-WINDOWS-RESTART-AND-RECOVERY.md).

**H-11E continuation (01:48 Manila):** The owner separately authorized a planned, system-wide graceful Docker Desktop restart. One supported `docker desktop restart --timeout 120` attempt failed during graceful stop with processes still running and `context deadline exceeded`. Post-attempt Docker inventory still timed out and protected H-09/demo HTTP was unavailable. H-11D was **not resumed**; no fixture-specific stop, restore or capacity measurement occurred. See [H11E-GRACEFUL-DOCKER-MAINTENANCE.md](H11E-GRACEFUL-DOCKER-MAINTENANCE.md) and its sanitized JSON. The original H-11D preflight below is retained as historical evidence.

**Result: BLOCKED before mutation.** The owner authorized a bounded reversible trial of verified idle RRJ synthetic fixtures. A live stop was **not eligible** because the required fresh Docker/WSL health preflight failed. No container was stopped or started, and no reduced-state capacity gain or restore success was measured. Hosted Supabase was not contacted.

## Fresh preflight and decision

| Check | H-11D result | Consequence |
| --- | --- | --- |
| Docker server version, 8-second bound | `spawnSync docker ETIMEDOUT`; no server response | Current container IDs, labels, state, ports, mounts, health, and restore capability cannot be trusted. |
| Docker container listing, separate 8-second bound | `spawnSync docker ETIMEDOUT` | Repeated control-plane failure; abort mutation. |
| WSL memory/pressure, 8-second bound | `spawnSync wsl ETIMEDOUT` | Current available RAM, swap and pressure unknown. The H-11C 400 MiB stop floor cannot be checked. |
| WSL status, separate 8-second bound | Returned default distribution `docker-desktop`, WSL version 2 | Status alone does not establish responsive Linux memory or Docker. |
| Windows physical memory | 3,592,868 KiB free of 16,493,360 KiB visible (about 3,509/16,107 MiB) | Windows-only reading; cannot substitute for WSL headroom. |
| Protected H-09 Auth and REST | Loopback requests to 48321 both timed out at about 3 seconds | Required retained-stack health failed. |
| Canonical demo Auth | Loopback request to 61321 timed out at about 3 seconds | Demo health not confirmed. The subsequent REST request did not yield a captured result within the command window. |
| Existing active stop journal | `.tmp/h11-profile-journal.json` absent | No H-11 profile journal requiring restoration was found on disk; Docker state remains unknown. |

Docker Desktop's Windows service and processes appeared running. That is not evidence that its Linux engine or RRJ services are healthy. H-11C had already recorded Docker API 500/timeouts, WSL stalls, 179 MiB available RAM and full swap. H-11D did not reuse that stale state as a current measurement. An OOM or permanent fix cannot be concluded from these checks.

## Candidate decision and restoration boundary

The exact project labels, prior 12-character container IDs, ports, networks, mount **types and destinations**, and health are in [H11C-SANITIZED-INVENTORY.json](H11C-SANITIZED-INVENTORY.json). Those IDs are historical and **not a live manifest**. H-11D could not re-inspect them or establish current last use, active clients/jobs, dependency edges, restart patterns or port ownership. Supabase CLI containers in that inventory had project labels but no Compose service/dependency labels.

| Exact RRJ project | H-11D eligibility | Earlier H-11C service IDs (Storage, REST, Auth, Kong, DB unless noted) |
| --- | --- | --- |
| `rrj_h07_financial_20261014` | Excluded this run: current state/idle/dependencies unknown | `74b5ba6d38ca`, `f8c4f6885aa9`, `d8b130694c1d`, `e8f7b6161dd3`, `db4249c0ec4c` |
| `rrj_h08b_history_20261015` | Excluded this run: same blocker | `1cc9c7088cba`, `4f23e160669b`, `e3685155639e`, `4e7af74404e1`, `c7716c7d279e` |
| `rrj_manager_lifecycle_20261014` | Excluded this run: same blocker | `b7f9e3a021fe`, `dcdd656c805d`, `caca8252418a`, `7088583f5d03`, `8d75e1ef2533` |
| `rrj_phase3_prefix_20261014_a1` | Excluded this run: same blocker | `ae137e6fa583`, `04cf7973e393`, `de14fe3d9d51`, `0129b244cbaa`, `8d9ccc55fd6b` |
| `rrj_defense_demo_20261014_r2` | Excluded this run: variant use and dependencies unverified | `fadb21325353`, `30d5bf2f23a1`, `e133aed5720f`, `56c80a5f8803`, `beec6b1192ca` |
| `rrj_defense_demo_20261014_r3` | Excluded this run: same blocker | `bdd4c001c232`, `a47c5ff84b74`, `92bb64389b29`, `08696de9d4e4`, `85e0d9d47432` |
| `rrj_phase8_sim` | Specialist excluded: simulation/feature use unverified | See H-11C inventory (12 services, 11 previously running). |
| `rrj_rc_synthetic_replay_20261013` | Specialist excluded: replay use and restart ports unverified | See H-11C inventory (five services; previously no host API/DB bind). |
| `rrj_h08c_history_20261015` analytics | Specialist excluded: current Studio/log/vector dependency and use unverified | Prior analytics ID `2d9de3b44279`; historical 59327 loopback bind only. |

Protected H-09 QA, canonical defense demo, both recovery stacks, `isolated-stack`, the personal todo app and the unlabeled rehearsal remain outside this authorization. No candidate was added to the executable allowlist. The existing script still permits only the exact H-08C analytics target after its independent checks; those checks fail or cannot be established now. Its syntax check passed. No new script change was justified by an unresponsive Docker engine.

## Stop, restore, resource comparison

**Stop log:** no `docker stop` or Compose stop issued. **Restore log:** no `docker start` issued because H-11D stopped nothing. Prior state is unknown, so 94/99 from H-11C is not a current count. No before/during/after WSL RAM, swap, container footprint, Auth/REST/SQL latency comparison or 5–10-minute soak is claimable. No active H-11 local profile journal file was present; this does not certify all Docker processes are running.

The owner authorization remains recorded for a future H-11D attempt within the stated RRJ scope. A future attempt must first obtain responsive Docker and WSL preflights, live exact IDs/labels/ports/mounts/network and dependency evidence, current idle/last-use evidence, a pre-stop restore manifest, protected H-09 and demo Auth/REST/SQL health, and a measured stop/restore window. This run made no WSL configuration change or outage. Restaurant production remains **NO-GO** under the separate provenance, hosted parity, recovery and deployment gates.
