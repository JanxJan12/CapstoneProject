# H-27C — Docker memory attribution and safe recovery plan

**Investigation:** 2026-10-16 18:03–18:06 Asia/Manila. **Mode:** read-only local inspection and planning. **Recovery-plan status: PLAN PARTIALLY READY.** **H-27 Manager browser decision: NO-GO.** No recovery action or browser acceptance was executed.

## A. Executive summary

The immediate pressure is shared between Docker/WSL and several Windows applications. The single Docker statistics sample found three 11-service Supabase projects reporting roughly 1.4 GiB each; their Analytics containers alone reported 730–757 MiB each. Windows also showed `vmmemWSL` at 3.3–3.5 GiB resident, plus substantial Opera, VS Code, ChatGPT, and other application use. Available physical memory declined during the inspection from about 2.40 GiB to 1.83 GiB. At the counter sample, committed memory was about 27.41 GiB against a 31.73 GiB limit. These are observations at different instants, not an additive attribution or a promised amount reclaimable by stopping a container.

Compose metadata establishes distinct Docker networks and named volumes for the measured projects, but does not establish their current human owner, active clients, or safe idle state. The initial safe path is user review of open Windows applications and separate verification of historical project ownership. No Docker project qualifies for an executable stop list yet. The existing Vite process belongs to this checkout but its effective Supabase destination is **BACKEND DESTINATION UNKNOWN**; the default `.env.local` points to hosted Supabase. A future fresh frontend can use the existing defense-demo local-only mechanism after separate authorization and fresh capacity/authentication checks.

## B. Baseline environment and evidence boundary

`git status --short --branch` was inspected first: `main...origin/main` with extensive existing modified and untracked paths. HEAD was `9748bdef6d31a96282b88dc67f02724b8fd05819`. Nothing was reset, staged, stashed, or cleaned. The prior [H-27A report](H27A-DOCKER-ENVIRONMENT-READINESS.md) and [2026-10-16 recheck](H27A-DOCKER-ENVIRONMENT-READINESS-RECHECK-20261016.md) were consulted as historical evidence. The recheck's 373 MiB free memory and HTTP results are **not** used as current measurements.

| Current observation | Value and boundary |
| --- | --- |
| Installed physical RAM | 16,889,200,640 bytes = 15.73 GiB, `Win32_ComputerSystem` |
| Windows visible / free physical | 16,493,360 / 2,296,288 KiB at the 18:04 snapshot (15.73 / 2.19 GiB); an earlier 18:03 observation was 2,514,720 KiB free; 18:05:42 was 1,874 MiB free |
| Windows memory counters | At the 18:04 counter sample: 2,319 MiB available; committed 29,431,439,360 bytes (27.41 GiB); commit limit 34,069,069,824 bytes (31.73 GiB), about 4.32 GiB commit headroom |
| Page file | `C:\pagefile.sys`, 16,384 MiB allocated, 3,302 MiB currently used, 3,675 MiB peak at the sample |
| Docker | `desktop-linux`; 99 containers: 89 running, 10 stopped, 0 paused; Docker engine-reported VM memory limit 8,182,251,520 bytes (7.62 GiB); no `unhealthy` or `restarting` containers returned by the bounded filters |
| WSL | `docker-desktop` running, WSL 2; `wsl --list --verbose` listed no other distribution |
| Local protected endpoints | At 18:05:56–57, H-09 `127.0.0.1:48321` and canonical demo `127.0.0.1:61321` each returned HTTP 200 for `/auth/v1/settings` and `/rest/v1/`. This proves narrow loopback responsiveness only. |

`docker system df` reported 21.1 GB images, 119.3 MB containers, and 1.649 GB local volumes. Those are disk figures; the displayed reclaimable bytes are **not** memory recovery and authorize no cleanup.

## C. Windows memory analysis

Installed RAM is hardware capacity; visible memory is what Windows reports usable. Available physical memory is immediately reusable RAM, and it can move rapidly as caches and applications change. Committed bytes are virtual memory promised backing by RAM or page file; the commit limit is the system's backing ceiling. A process working set is resident pages, including shared pages; private memory is process-specific committed virtual memory, not necessarily resident. Page-file usage reflects backing on disk and is not extra physical RAM. Summing working sets double-counts shared pages and does not equal machine-wide consumption. Docker's 7.62 GiB limit is a Linux-engine limit, not current free Windows RAM.

Process sample at approximately 18:04 (`Get-Process`; MiB rounded). Ownership is inferred only where a command line or known process role confirms it; a process name does not establish idleness.

| Process / PID | Working set | Private | Ownership confidence | Potential future action |
| --- | ---: | ---: | --- | --- |
| `vmmemWSL` / 22896 | 3,345.4 | 8,062.8 | High: running Docker WSL VM; internal attribution requires care | Preserve; no WSL shutdown or limit change |
| `opera` / 25972 | 634.7 | 723.8 | Browser identity high; tab/window owner unknown | User inspect open work and close unneeded tabs/window only by choice |
| `ChatGPT` / 28016 | 523.1 | 657.8 | App identity high; current work dependency possible | Preserve during investigation |
| Memory Compression / 4144 | 443.4 | 7.2 | Windows memory management | Do not touch |
| `Code` / 4368 | 317.8 | 413.0 | Editor identity high; active workspace unknown | User inspect and close unneeded window only by choice |
| `opera` / 25124 | 285.4 | 667.8 | Browser identity high; tab/window owner unknown | Same user review |
| `com.docker.backend` / 18744 | 284.3 | 374.5 | Docker Desktop | Preserve |
| `Code` / 26984 | 274.9 | 487.9 | Editor identity high; workspace unknown | Same user review |
| `MsMpEng` / 7032 | 240.8 | 508.5 | Windows security service | Do not touch |
| `node` / 28876 | 206.8 | 406.9 | High: current checkout Vite process | Preserve existing process in H-27C; no blind termination |

At 18:05:42, grouped process working sets were `opera` 21 processes / 1,945 MiB, `Code` 14 / 1,195 MiB, `ChatGPT` 16 / 1,190 MiB, Docker backend 2 / 331 MiB, Docker Desktop 5 / 245 MiB, and `chrome` 10 / 194 MiB. These grouped figures are prioritization signals, not a total-RAM accounting or evidence that a window is disposable. `steamwebhelper` also had seven processes, 135.5 MiB working set and 955.2 MiB private memory; its active use is unknown. The sample's `vmmemWSL` private figure can reflect VM reservation/commit and must not be added to container figures as separate consumption.

## D. Docker resource analysis

One `docker stats --no-stream` sample completed at 18:04:28 for all 89 running containers. Memory below is the sum of Docker-reported per-container usage for the sample; it is **not** a measured reduction in host RAM if the project stops. Docker can account for cache, sharing, and VM retention differently from Windows. All listed projects carry `com.docker.compose.project` and `com.supabase.cli.project` labels. The project-to-service relationship below is established by matching names, project labels, network membership, and ports; Compose service labels were absent in the sampled containers.

| Project | Running / total | Docker stats sum | Largest measured service | Purpose / confidence |
| --- | ---: | ---: | --- | --- |
| `rrj_phase8_sim` | 11 / 12 | 1,419.9 MiB | Analytics 756.6 MiB | Historical Capstone simulation by prior QA records; active owner unknown |
| `rrj_h08c_history_20261015` | 11 / 12 | 1,415.4 MiB | Analytics 748.2 MiB | Historical cashier-shift QA by project/report; active owner unknown |
| `my-local-todo-app` | 11 / 12 | 1,395.3 MiB | Analytics 730.2 MiB | Other local Supabase project; unrelated owner/activity unknown |
| `rrj_h09_order_flow_20261015` | 6 / 6 | 207.9 MiB | Storage 62.2 MiB | Protected H-09 QA backend |
| `rrj_h08b_history_20261015` | 5 / 5 | 183.7 MiB | Storage 68.9 MiB | Historical QA; owner/activity unknown |
| `rrj_rc_synthetic_replay_20261013` | 5 / 5 | 182.4 MiB | Storage 70.2 MiB | Historical synthetic replay; owner/activity unknown |
| `rrj_defense_demo_20261014` | 5 / 5 | 180.0 MiB | Storage about 61 MiB | Protected canonical demo backend |
| `isolated-stack` | 5 / 6 | 171.3 MiB | Storage 64.1 MiB | Purpose/owner uncertain |
| `rrj_h07_financial_20261014` | 5 / 5 | 170.6 MiB | Storage 61.6 MiB | Historical QA; owner/activity unknown |
| `rrj_defense_demo_20261014_r3` | 5 / 5 | 168.5 MiB | Storage about 60 MiB | Demo variant; active owner/activity unknown |
| `rrj_defense_demo_20261014_r2` | 5 / 5 | 167.5 MiB | Storage 62.0 MiB | Demo variant; active owner/activity unknown |
| `rrj_phase3_prefix_20261014_a1` | 5 / 5 | 165.1 MiB | Storage 62.2 MiB | Historical QA; owner/activity unknown |
| `rrj_recovery_20261014_source` | 5 / 5 | 164.8 MiB | Storage 61.2 MiB | Recovery source; preserve pending owner review |
| `rrj_recovery_20261014_target` | 5 / 5 | 158.8 MiB | Storage about 60 MiB | Recovery target; preserve pending owner review |

The large projects' Realtime services each used roughly 200–214 MiB, Studios 132–136 MiB, and DBs 88–100 MiB. Their 11 running services include Kong, Auth, REST, Storage, DB, Realtime, Analytics, Studio, pg_meta, Inbucket, and Vector; each has an already exited Edge Runtime as a twelfth container. No action is suggested for an already stopped service.

## E. Dependency and preservation map

| Project / service group | Purpose | State and measured memory | Dependencies and isolation evidence | Protection level |
| --- | --- | --- | --- | --- |
| H-09: `rrj_h09_order_flow_20261015` | Existing synthetic QA and historical authenticated Manager/API evidence | Six running; 207.9 MiB; Kong `48321`, DB `48322` | Dedicated `supabase_network_rrj_h09_order_flow_20261015`; DB/Storage dedicated named volumes; Auth, REST, Storage depend on same project DB/gateway | **Protect fully** |
| Canonical demo: `rrj_defense_demo_20261014` | Existing local demo and supported local-only frontend target | Five running; 180.0 MiB; Kong `61321`, DB `61322` | Dedicated network and DB/Storage volumes; same-project Kong/Auth/REST/Storage/DB | **Protect fully** |
| Manager Lifecycle: `rrj_manager_lifecycle_20261014` | Preserved historical test stack | Five exited; no running stats | Dedicated network and DB/Storage volumes per inspect and [H-16G](H16G-MANAGER-LIFECYCLE-POST-REBOOT-STOP-RESULT.md) | **Protect stopped** |
| `rrj_phase8_sim` | Historical Capstone simulation | 11 running; 1,419.9 MiB | `rrj_phase8_loopback`; dedicated DB/Storage/Config volumes; active clients not proved absent | Candidate **only for owner/dependency investigation** |
| `rrj_h08c_history_20261015` | Historical H-08C cashier-shift QA | 11 running; 1,415.4 MiB | Dedicated network and DB/Storage/Config volumes; active clients not proved absent | Candidate **only for owner/dependency investigation** |
| `my-local-todo-app` | Other Supabase project | 11 running; 1,395.3 MiB | Dedicated network and DB/Storage/Config volumes; ownership and clients unknown | **Unrelated; do not touch** without its owner's explicit approval |
| Other historical QA/demo/recovery and `isolated-stack` | Different preserved test/recovery resources | Five running each except `isolated-stack` five of six; 158.8–183.7 MiB per project | Each project has its own named network and DB/Storage volumes; no named volume or network shared across inspected projects. External clients/backup dependencies not excluded. | **Preserve pending owner proof** |

The read-only full-container metadata inspection found no named volume or Docker network shared **across** these project labels. That supports Docker resource separation, but cannot establish no host client, no cross-project API use through published ports, no active workflow, or a restorable database snapshot. Service names alone are insufficient proof of safe idleness. `docker ps --filter health=unhealthy` returned none; several REST services do not display a health designation, so this is not a full health certificate.

## F. Protected containers

Fresh `docker ps -a` showed exactly these five `rrj_manager_lifecycle_20261014` services **exited (0)** approximately seven hours before inspection: `supabase_storage_rrj_manager_lifecycle_20261014`, `supabase_rest_rrj_manager_lifecycle_20261014`, `supabase_auth_rrj_manager_lifecycle_20261014`, `supabase_kong_rrj_manager_lifecycle_20261014`, and `supabase_db_rrj_manager_lifecycle_20261014`. This matches [H-16G](H16G-MANAGER-LIFECYCLE-POST-REBOOT-STOP-RESULT.md). They are not recovery candidates: they already consume no running-container stats and their data must remain preserved. H-09 and canonical demo project labels, isolated networks/volumes, ports, and four narrow loopback HTTP results were checked. No authenticated RPC, DB catalog, Storage, or full workflow test was performed.

## G. WSL analysis

`wsl --list --verbose` showed only `docker-desktop`, running under WSL 2. `vmmemWSL` was the largest single resident process. Docker engine reported a 7.62 GiB memory limit, while Windows observed 3.3–3.5 GiB WSL working set. Different accounting and sampling times prevent direct reconciliation. WSL internal process memory, cache/swap, and reclaim behavior were not inspected inside the distribution because doing so was unnecessary for the read-only decision; no distribution was started, restarted, or reconfigured. A Docker or WSL restart is not a supported first recovery step.

## H. Existing Vite process

One Vite TCP listener was found at `[::1]:5173`, owned by `node.exe` PID 28876 (`C:\Program Files\nodejs\node.exe`). Its safe-to-print command line points to `C:\Users\Janmari\Downloads\Capstone Project\node_modules\vite\bin\vite.js`; parent PID 26812 is `cmd.exe /c vite`, and parent-chain Node PID 21968 ran `npm run dev`. That establishes association with the canonical checkout. The command line does not reveal the process's effective `VITE_*` environment, and its working directory was not independently exposed by these safe checks. No second Vite listener was seen on 5174, 5175, or 4173; this is not a search of every TCP port. Other Node processes are not assumed to be duplicate development servers.

**Classification: BACKEND DESTINATION UNKNOWN.** `.env.local` has a hosted `VITE_SUPABASE_URL` host (`zhzluhqvysvsadwuugpa.supabase.co`), as confirmed in H-27A and checked only by host, without disclosing credentials. Normal Vite loads environment files, but shell/process variables can take precedence and the active process environment was not obtained. Neither a localhost Vite listener nor the default file proves where this already running frontend will send Supabase requests. It was not opened, contacted, stopped, or restarted.

## I. Hosted isolation risks and future frontend design

`src/lib/supabase.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `import.meta.env`. `vite.config.ts` sets `envDir: false` when `RRJ_DEFENSE_DEMO=1`. In that mode, `src/lib/supabase.ts` rejects a `VITE_DEMO_MODE=true` URL outside the approved loopback demo ports `61321`, `62321`, and `63321`. Existing `scripts/demo/start-defense-web.ps1` checks the selected demo stack, supplies the local URL and publishable key from local CLI status, sets both flags, and starts a separate strict-port Vite listener on `127.0.0.1:58440` for canonical slot 1. This mechanism is source-confirmed but was **not run** here. It requires a verified local Manager identity/session; an HTTP 200 from Auth/REST does not grant that identity. Prior [H-16](H16-MASTER-ACCEPTANCE-MATRIX.md) reports a synthetic Manager authenticated at local API/SQL level, not a current browser session or reusable credentials.

Future H-27D should leave PID 28876 intact, launch at most one newly authorized isolated frontend via the existing mechanism after memory headroom is adequate, and verify its effective configuration before any protected route is opened. Inspect its startup output and served configuration locally, then use controlled browser network inspection to verify requests resolve only to the chosen loopback backend; stop immediately if any hosted host appears. Browser acceptance must wait for a legitimate local Manager sign-in and same-database RPC compatibility. No `.env` edit, synthetic credential creation, or hosted request is part of this plan.

## J. Ranked recovery options

| Rank | Option and exact scope | Evidence / expected benefit | Risk, reversibility, and confidence |
| --- | --- | --- | --- |
| 1 | User reviews their Opera windows/tabs (21 `opera` processes at sample; largest PIDs 25972 and 25124) and unneeded VS Code windows (`Code` 14 processes; largest PIDs 4368 and 26984). Close only owner-confirmed idle work through application UI in future H-27D. | Group working sets 1,945 and 1,195 MiB respectively; could lower resident pressure, but saving is unknown. | Lower infrastructure risk; could lose unsaved tabs/editor work. Reopenable only if session/workspace state is preserved. Ownership of individual windows is unverified. **User choice required.** |
| 2 | Check whether any additional frontend server is truly duplicate. | Only one Vite listener at the inspected ports, PID 28876; no supported duplicate shutdown target. | No shutdown proposed. Preserve the current listener. |
| 3 | Investigate owner/activity of `rrj_phase8_sim` and `rrj_h08c_history_20261015` as exact historical project candidates; investigate `my-local-todo-app` only with its separate owner. | Each has 11 running services and about 1.4 GiB Docker-reported memory. Separate network/volumes reduce direct Docker coupling. | High service-interruption risk; current clients, backup/restore, and exact host RAM benefit unproved. **No executable stop target yet.** Preserve all volumes/networks and all protected stacks. |
| 4 | Reconsider Docker Desktop/WSL memory settings only if lower-risk actions fail and independent capacity evidence supports a change. | VM limit 7.62 GiB, `vmmemWSL` working set 3.3–3.5 GiB. | High risk to 89 live services; setting/restart can disrupt all stacks and does not substitute for ownership proof. No change proposed now. |

Do not stop all containers, prune anything, delete stopped containers, remove volumes/networks, reset Docker/WSL, or recreate a Supabase stack. If a later phase approves any single project pause, re-enumerate exact IDs, owner, users, network/volume dependencies, restore path, and host/VM capacity immediately before a narrowly scoped reversible stop. Docker stats are not a guaranteed Windows RAM saving.

## K. Proposed H-27D authorization table

| Proposed action | Exact target | Evidence | Risk | Reversible | Approval required |
| --- | --- | --- | --- | --- | --- |
| Review and optionally close owner-confirmed idle Opera work | Current Opera windows/tabs corresponding to the sampled 21 `opera` processes; identify the actual window before closing, **not** a PID kill list | 1,945 MiB grouped working set; largest PID 25972 at 634.7 MiB | Unsaved forms/tabs/session | Usually reopenable after preserving state; exact RAM gain unknown | New explicit user decision naming the window/tabs and confirming save state |
| Review and optionally close owner-confirmed idle VS Code work | Current VS Code window/workspace corresponding to sampled `Code` processes; identify actual workspace before closing, **not** a PID kill list | 1,195 MiB grouped working set; largest PIDs 4368, 26984 | Unsaved edits, terminals, extension work | Reopenable after saving; exact RAM gain unknown | New explicit user decision naming the workspace |
| Perform read-only owner/client/restore verification for potential historical pause | `rrj_phase8_sim` and `rrj_h08c_history_20261015` as project labels; `my-local-todo-app` only with separate owner participation | About 1.4 GiB each in one Docker sample, separate named networks/volumes | Inspection low risk; a later pause could break users | Read-only investigation fully reversible | Authorization to **stop** must be new and exact after evidence review; this row grants none |
| Start one fresh local-only frontend after capacity and backend/auth gates | Existing `scripts/demo/start-defense-web.ps1 -Slot 1`; loopback `127.0.0.1:58440`, backend `127.0.0.1:61321` | Source-configured local-only guards; canonical demo Auth/REST 200 | Additional memory load; browser traffic risk until verified | Stop only the newly launched, positively identified process if separately authorized | New explicit authorization for H-27D frontend execution and controlled browser work; no change to PID 28876 |

There is **no executable Docker stop list** in H-27C. Before any future container stop, the exact container IDs must be refreshed, the owner must confirm no active client, the project-specific DB/Storage data and restart method must be preserved, a tested restore plan must exist, and protected H-09/demo health must be captured before and after. If a stop times out, health degrades, or memory remains inadequate, halt and reassess; do not escalate to Docker/WSL reset. No approval is inferred from this table.

## L. Future memory budget

| Resource | Measured baseline | Expected additional demand | Recommended reserve / gate | Confidence |
| --- | --- | --- | --- | --- |
| Windows physical memory | 1.83–2.40 GiB available across 18:03–18:05 samples; rapid decline | Browser plus Manager session and viewport work: unknown on this machine | Aim for at least ~3 GiB available **before** new frontend/browser, with stable repeated readings; this is a planning gate, not proof of sufficiency | Baseline high; threshold judgmental |
| Windows commit | 27.41 GiB committed / 31.73 GiB limit at one sample; ~4.32 GiB headroom | New frontend/browser commit unknown | Retain multiple GiB commit headroom after startup; a ~4 GiB pre-start planning floor is prudent and must be remeasured | Baseline high; peak unknown |
| Existing Docker / WSL | 89 running containers, 7.62 GiB VM limit; `vmmemWSL` 3.3–3.5 GiB resident | No new Docker infrastructure planned | H-09 and canonical demo remain accessible; no restart/health regression | Current narrow state high; future peaks unknown |
| Existing/new frontend | Existing Vite PID 28876: 206.8 MiB working set, 406.9 MiB private at sample | One additional local-only Vite process, amount unknown | Only one new isolated listener after host headroom check; keep current process preserved | Existing sample high; incremental unknown |
| Browser | Existing Opera and Chrome processes already present; no H-27 browser launched | One controlled authenticated browser session; amount unknown | Sequential desktop/tablet/mobile viewports in one session; monitor before proceeding between phases | Unknown until authorized controlled test |

The reserve is intentionally larger than the last H-27A low point and is **not** a mathematical guarantee. Browser/Vite peak, WSL cache reclaim, page-fault latency, and simultaneous normal Windows variation cannot be measured safely without a controlled runtime trial. If available RAM drops, commit approaches its limit, or sustained swapping appears during future H-27D, stop adding workload and reassess. A small memory increase alone is not a GO verdict.

## M. Readiness gate and future recheck

| Gate | H-27C finding |
| --- | --- |
| Resource sufficiency | **NOT ESTABLISHED**: recent free RAM 1.83–2.40 GiB and variable; no controlled browser peak. |
| Local backend availability | **NARROW PASS**: protected Auth/REST loopback HTTP 200; current schema, authenticated Manager RPC, Storage, and data suitability not established. |
| Frontend hosted isolation | **FAIL/UNKNOWN** for existing Vite: effective backend unknown; default config host is hosted. Future guarded local process remains unlaunched. |
| Authentication feasibility | **NOT ESTABLISHED** for a current legitimate local browser session. Historical synthetic API login does not prove one now. |
| Preservation | **MAINTAINED IN INSPECTED SCOPE**; 89/10 Docker count and five stopped Manager containers were observed, with no H-27C state-changing commands. |

After separately approved recovery, recheck Docker daemon, exact protected container states, loopback Auth/REST plus needed DB/Manager read capability, stable Windows physical/commit headroom, unrelated service impact, fresh local-only frontend target, legitimate local Manager sign-in, and browser network isolation. Only then consider sequential responsive Manager acceptance. Healthy backend endpoints alone do not change this gate.

## N. H-27C conclusion and acceptance continuity

**PLAN PARTIALLY READY:** the Windows application review is a specific lower-risk first action, and the main Docker memory contributors and protected boundaries are identified. Exact container stop actions remain blocked by owner/activity/restore uncertainty. The current frontend's destination is unknown and resource sufficiency is unproved. **H-27 runtime stays NO-GO.** This investigation is not a Manager functional or visual test. [H-16](H16-MASTER-ACCEPTANCE-MATRIX.md) remains **10 PASS / 0 FAIL / 49 NOT RUN**; [H-26](H26-CONTROLLED-MANAGER-UIUX-ACCEPTANCE.md) controlled-demo readiness remains **NOT ASSESSED**; H-27A remains **NO-GO** for browser acceptance.

## O. Preservation verification and limits

Commands used were read-only Git status/HEAD, local file reads, CIM/process/counter/listener inspection, `wsl --list --verbose`, Docker context/info/ps/inspect/one no-stream stats/system df, and four bounded loopback GETs. No browser was opened or application flow run. No hosted URL was contacted. No container start/stop/restart, volume/network change, WSL operation, process termination, SQL command, backend record mutation, source/config edit, or dependency installation was issued. The only created file is this report. These statements describe commands issued in H-27C, not external concurrent activity. Containers' human ownership, external clients, restore readiness, current Manager credentials, active Vite environment, full DB health, and memory behavior under a new browser remain unverified.

## P. Minimum next action

In a separately authorized H-27D, have the user identify one genuinely idle Opera window or VS Code workspace, preserve its unsaved work, and close it through the application UI; then remeasure physical and committed memory and protected service health. If the user needs all those windows, proceed with **read-only** owner/client/restore verification for `rrj_phase8_sim` and `rrj_h08c_history_20261015` before proposing any exact Docker stop. Do not launch the local-only frontend or browser until the capacity and isolation gates above are met.
