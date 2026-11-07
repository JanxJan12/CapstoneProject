# H-16C — one-stack reversible stop readiness

**Assessment:** 2026-10-16, Asia/Manila, approximately 07:12–07:16. **Decision: BLOCKED for a stop today.** This was read-only Docker, host, report and file-metadata inspection. No container or other Docker resource was stopped, started, paused, restarted, removed, or changed. The commands below are a proposal only and require a new, explicit approval after the blockers are closed. All **45 Docker volumes** remain protected; this report requests no container, volume, network, or image deletion.

## Selected group and why

Select **`rrj_manager_lifecycle_20261014`** for this one-stack review. [The October 14 regression](MANAGER-REQUEST-LIFECYCLE-REGRESSION-20261014.md) records a completed local synthetic Manager request, revision, split Receiving, reconciliation, role denial, navigation, and browser recovery run with a final independent database relationship check. Its fixture is named and its private results remain under `.tmp/manager-lifecycle-20261014/`. H-07 has retained finance and later H-08 use; H-08B has unfinished history implementation questions; r2/r3 are demonstration variants with less clear current-use custody. This makes Manager Lifecycle the clearest completed test among H-16B's five candidates, **not proof that no one uses it now**. Its 52-version demo-only schema is not a clean replay of the original migration chain.

## Live identity and scope

Bounded `docker ps -a --no-trunc` and inspect returned promptly. All five containers below were **running** and had `com.docker.compose.project=rrj_manager_lifecycle_20261014`, `com.supabase.cli.project=rrj_manager_lifecycle_20261014`, and `com.supabase.cli.workdir` pointing to `.tmp/manager-lifecycle-20261014`. All had `unless-stopped` restart policy. The `com.docker.compose.service` label was **absent**; the service roles below come from container names, images, ports and the fixture report, not that label. Recheck full IDs and original states immediately before any approved stop.

| Service | Exact full container ID | Current state | Mount / published host port |
| --- | --- | --- | --- |
| Kong | `7088583f5d03bdec2f2221bdc2aeca0643b983132a160f3b97b64b99d4eb9ef8` | running, healthy | no mount; `127.0.0.1` and `::1`:52321 → 8000/tcp |
| REST | `dcdd656c805d1e506bfbd830729d0f7aaecb7813665b4e676c5009e8f42d186f` | running | no mount; internal 3000/tcp |
| Auth | `caca8252418a42261e360969151cb1a324b7557676ac0a5beb9fac0591c5e4bf` | running, healthy | no mount; internal 9999/tcp |
| Storage | `b7f9e3a021fe2e5f6acdb33b7de6fe3681b958774a6ecbaf9d714f7aecf43332` | running, healthy | `supabase_storage_rrj_manager_lifecycle_20261014` → `/mnt`; internal 5000/tcp |
| PostgreSQL | `8d75e1ef2533f727c21e995151131520fce81f15abdb4256f0078c4ebac04086` | running, healthy | `supabase_db_rrj_manager_lifecycle_20261014` → `/var/lib/postgresql/data`; `127.0.0.1` and `::1`:52322 → 5432/tcp |

The only observed network is bridge `supabase_network_rrj_manager_lifecycle_20261014` (ID `b5b02d94e884d326ed17d8d104751ae41e66a5941cd8969293dd0d798e0c6aba`); its inspected membership is exactly these five containers. The two `local` named volumes carry matching project labels and are mounted only by the corresponding Manager DB and Storage containers in the current 99-container mount scan. Their Docker mountpoints are `/var/lib/docker/volumes/supabase_db_rrj_manager_lifecycle_20261014/_data` and `/var/lib/docker/volumes/supabase_storage_rrj_manager_lifecycle_20261014/_data`. No bind mount appeared in the five container inspections. **Retain both volumes, the network, containers, images and `.tmp` fixture/config files.**

H-09 (6/6), canonical demo (5/5), both recovery stacks (5/5 each), `isolated-stack` (5/6), and `my-local-todo-app` (11/12) have separate observed project networks. None appears in the Manager network or mounts either Manager volume. Repository references to this project are the dedicated regression report, H-11/H-12/H-16B inventories, its own `.tmp` config and private harnesses; no H-09 or canonical demo dependency was found in the inspected references. This establishes **Docker resource separation**, but cannot rule out a browser, background job, external client, or human using its loopback ports. A host TCP snapshot showed listeners on 52321/52322 and no established connection; that momentary observation is not an idleness attestation. No `depends_on` service label or active-client audit was available.

## Current use, archive and recovery limits

The completed October 14 regression is the last *documented* Manager Lifecycle test reviewed here. The private harness scripts and result files still exist, so its fixture remains useful for reproduction. There is no owner confirmation that current Manager/Receiving work, a browser session, a job or an external tool no longer depends on 52321/52322. **Verified idle: NO.**

An existing local `.tmp/manager-lifecycle-20261014/before-demo-data.dump` is 1,201,343 bytes, and a small private fixture manifest exists. These are **existing local artifacts**, not an identified, independently verified current full-stack backup. The dump predates the completed regression state; file presence and size do not establish its coverage or restore success. No candidate-specific archive of current PostgreSQL roles/schema/data, Auth, Storage metadata and private bytes/hashes, configuration and fixture provenance was verified. No successful isolated restore **of this Manager stack** was found. [The October 14 restore drill](RESTORE-DRILL-20261014.md) applies to separate synthetic recovery source/target stacks and selected objects; [the disaster recovery report](DATABASE-DISASTER-RECOVERY-PHASE3.md) distinguishes a verified local backup set from an independently restored off-device set. Neither proves that this Manager fixture can be recreated. Stopping retained containers should preserve their volumes and configuration, but restart and data integrity **remain untested for this group**.

## Resource baseline and safety gate

At about 07:13 Manila, Windows reported **16,107 MiB total / 1,665 MiB free physical RAM** and **32,491 / 5,934 MiB total/free virtual memory**. Docker Desktop's WSL VM reported **7,990,476 kB total / 637,024 kB available memory** and **2,097,152 kB swap total / 296 kB free**. The host is below H-11I's proposed 2 GiB Windows and 800 MiB WSL trial reserves, with swap effectively full. Docker's one-shot stats showed DB 39.4, Auth 10.21, REST 15.69, Storage 60.87 and Kong 44.61 MiB, about **170.8 MiB in container accounting**. This is an instantaneous accounting sum, **not a forecast of freed Windows RAM, WSL available RAM, or swap**. H-11I measured no whole-stack pause gain.

Read-only baseline loopback HTTP at this assessment: H-09 Auth settings **200** in 0.142 s, H-09 REST root **200** in 0.623 s, canonical demo Auth settings **200** in 0.147 s. These are narrow reachability checks, not authenticated workflow or SQL proof.

**Stop remains BLOCKED** by unverified current idleness/client dependencies, missing candidate-specific current archive/restore proof, and inadequate stable host/WSL headroom under the H-11I trial gate. The separate requirement for **explicit approval** remains in force even if these are resolved. A low CPU sample, healthy label, isolated network and lack of established TCP connections do not close the idle gate. If Docker/WSL becomes unresponsive during a later fresh assessment, stop inspection; do not force-reset it.

## Proposed reversible procedure — NOT EXECUTED

Before requesting approval, obtain owner/custodian confirmation of a quiet window and no browser, job, test or client using 52321/52322; retain the fixture evidence and verify its current data custody. Refresh the five full IDs, project labels, running states, mounts, network membership and protected stack health. Record a dated external restore journal with all five originally running IDs and the resource baseline. Require a responsive Docker/WSL control plane and adequate reserve; do not bypass H-11I's 400 MiB hard refusal floor. A separate approved stop would use this dependent-first order, one command at a time, checking success and aborting to restart on any error:

```powershell
docker stop --time 15 7088583f5d03bdec2f2221bdc2aeca0643b983132a160f3b97b64b99d4eb9ef8 # Kong
docker stop --time 15 dcdd656c805d1e506bfbd830729d0f7aaecb7813665b4e676c5009e8f42d186f # REST
docker stop --time 15 caca8252418a42261e360969151cb1a324b7557676ac0a5beb9fac0591c5e4bf # Auth
docker stop --time 15 b7f9e3a021fe2e5f6acdb33b7de6fe3681b958774a6ecbaf9d714f7aecf43332 # Storage
docker stop --time 15 8d75e1ef2533f727c21e995151131520fce81f15abdb4256f0078c4ebac04086 # DB
```

For rollback or an approved later restart, start **only IDs that were running before the stop**, in dependency order; wait for DB readiness before dependent services, then Auth/REST/Storage readiness before Kong:

```powershell
docker start 8d75e1ef2533f727c21e995151131520fce81f15abdb4256f0078c4ebac04086 # DB
docker start caca8252418a42261e360969151cb1a324b7557676ac0a5beb9fac0591c5e4bf # Auth
docker start dcdd656c805d1e506bfbd830729d0f7aaecb7813665b4e676c5009e8f42d186f # REST
docker start b7f9e3a021fe2e5f6acdb33b7de6fe3681b958774a6ecbaf9d714f7aecf43332 # Storage
docker start 7088583f5d03bdec2f2221bdc2aeca0643b983132a160f3b97b64b99d4eb9ef8 # Kong
```

After any separately approved stop, record at 1, 5 and 15 minutes: Windows free physical/virtual memory, WSL `MemAvailable`, swap used/free, and Docker stats/counts/states. Compare with the baseline without claiming causality from one reading. Recheck H-09 Auth and REST HTTP, its DB health/read-only `select 1` if already authorized and responsive, plus canonical demo Auth/REST and the untouched recovery/unrelated container states. Abort the trial and restore this exact stack if protected health worsens, the engine stalls, or the candidate was in use. After restart, verify all five original states, loopback 52321/52322, Auth/REST/DB/Storage readiness and retained Manager fixture relationships with **read-only** checks. Do not run synthetic tests or create new fixtures as part of this assessment.

## Exact approval boundary

**Approval requested for a future reversible stop only:** the five full container IDs in the table, as one complete `rrj_manager_lifecycle_20261014` group, after fresh identity and idle/capacity checks. The corresponding `docker start` of those same IDs is the rollback scope. **No approval requested or implied** for the two named volumes, network, images, files, databases, other 94 containers, Docker Desktop/WSL reset, hosted Supabase, or any deletion. Stop after this report and obtain the owner's explicit approval before stopping even one container.
