# H-27A read-only readiness recheck — 2026-10-16

This recheck supersedes the **current-state verdict** in [the initial H-27A report](H27A-DOCKER-ENVIRONMENT-READINESS.md) while preserving its earlier observations. **Verdict: NO-GO** for H-27 authenticated, entirely local Manager browser acceptance. Docker recovered between observations without an H-27A start/restart command, but host memory fell to 382,404 KiB free during this recheck. The default frontend configuration still targets hosted Supabase, and the running Vite process's effective target is unverified. No browser acceptance was started.

## A. Executive summary

The selected `desktop-linux` Docker engine now responds. It reports 99 containers: 89 running, 10 stopped, none paused. The five protected `rrj_manager_lifecycle_20261014` containers are all exited with code 0. Existing H-09 and canonical defense-demo Kong, Auth, REST, and DB services are running under separate project labels; bounded loopback Auth/REST probes returned HTTP 200 for both stacks. This establishes narrow service availability, not Manager login, schema/RPC parity, or safe browser readiness. The defense-demo `_r2` and `_r3` stacks are also running under their own distinct labels and ports; they were not treated as the canonical demo.

Windows free physical memory changed from 767,140 KiB at the first retry sample to 938,184 KiB and then 382,404 KiB. At this pressure, launching or using another browser session or making the backend do additional work is not a safe next step. H-16 stays **10 PASS / 0 FAIL / 49 NOT RUN**; its ten authenticated local API/SQL scenarios are historical and do not become rendered UI proof.

## B. Docker inventory

| Finding | Current evidence and limit |
| --- | --- |
| Context and daemon | `desktop-linux` is current; `default` also exists. `docker version` returned Docker Desktop 4.95.0 / Linux Engine 29.8.2. `docker info` returned 99 total, 89 running, 10 stopped, 0 paused, and 8,182,251,520 bytes configured engine memory. |
| Health overview | The `docker ps -a` status inventory showed no `unhealthy` or `Restarting` running row. REST containers do not show a Docker health badge, so this is not an all-service health pass. |
| Protected historical Manager stack | Kong, REST, Auth, Storage, and DB all show `Exited (0) 7 hours ago` under matching Compose and Supabase project labels `rrj_manager_lifecycle_20261014`. No H-27A action changed them. Its DB volume remains mounted to the exited DB container. |
| H-09 stack | `rrj_h09_order_flow_20261015` Kong, Auth, REST, Storage, Inbucket, and DB are running under matching project/workdir labels. Kong is published at loopback `48321`; DB at `48322`. DB, Auth, Kong, Storage, and Inbucket report healthy. The DB mounts `supabase_db_rrj_h09_order_flow_20261015`. |
| Canonical defense demo | `rrj_defense_demo_20261014` Kong, Auth, REST, Storage, and DB are running under matching labels. Kong is at loopback `61321`; DB at `61322`. DB, Auth, Kong, and Storage report healthy. The DB mounts `supabase_db_rrj_defense_demo_20261014`. This is a visibly synthetic demo environment. |
| Other distinct demo stacks | `_r2` and `_r3` each have separately labeled running DB/Auth/REST/Storage/Kong containers, with API/DB ports `62321/62322` and `63321/63322`. They are distinct stacks, not interchangeable with the canonical demo. |
| Other stopped containers | Besides the five Manager containers: `supabase_edge_runtime_rrj_h08c_history_20261015`, `supabase_pg_meta_isolated-stack`, `rrj_recovery_rehearsal_20261013`, `supabase_edge_runtime_rrj_phase8_sim`, and `supabase_edge_runtime_my-local-todo-app`. These were only listed, not touched. |

This inventory is a point-in-time Docker API result. It does not prove that no external actor will change a stack after the read. `docker system df` and broad resource profiling were omitted once host memory fell below 1 GiB.

## C. Resource health

Windows reported 16,493,360 KiB total visible physical memory. Free memory was 767,140 KiB at the retry preflight, 938,184 KiB after bounded health checks, and 382,404 KiB at the final resource sample. `vmmemWSL` showed a roughly 5,996 MiB working set at one sample; Docker reported about 7.62 GiB configured engine memory. These figures do not measure available memory inside the VM or prove a safe browser allowance. Several browser/editor processes were already active. The earlier H-16 run also reported severe Windows/VM swap pressure after API/SQL testing, but that is historical context.

**Resource classification: INSUFFICIENT for starting H-27 browser acceptance now.** The final host sample is about 373 MiB free, well below a defensible margin for an additional controlled browser workload. No stress test or new browser was launched to probe the limit.

## D. Existing local backend

Current named containers and bound ports identify a running H-09 synthetic QA backend and canonical synthetic demo backend. Bounded GET requests to `http://127.0.0.1:48321/auth/v1/settings`, `/rest/v1/`, and the corresponding `61321` paths returned HTTP 200. These probes verify narrow loopback HTTP responsiveness only. The current Manager schema/RPC catalog, authenticated Manager read path, exact data state, and same-database compatibility with the latest working tree were **not tested** under the memory gate. No SQL, database write, or migration command was executed.

H-16 previously authenticated a synthetic Manager and verified ten API/SQL scenarios against the H-09 stack, but that earlier run did not render a browser. Both H-09 and defense-demo use synthetic prerequisites and must remain labeled as diagnostic/demo environments.

## E. Frontend configuration

The `.env.local` `VITE_SUPABASE_URL` host remains the hosted project `zhzluhqvysvsadwuugpa.supabase.co`. Normal Vite uses environment files; `src/lib/supabase.ts` creates its client from that value. A Vite Node process from this checkout is listening on `[::1]:5173`, but its inherited environment and compiled backend destination were not verified. Its command line shows `vite.js` via `cmd.exe /c vite`; no assumption was made from its process name alone. The documented defense-demo launcher supplies explicit loopback variables and disables environment-file loading, but it was not run in H-27A. **The existing Vite page was not opened or contacted.** Hosted traffic cannot yet be excluded for it.

## F. Authentication feasibility

GoTrue's loopback settings endpoint responded, and H-16 has historical proof of a local synthetic Manager login. A valid **current** Manager session and frontend route bound to the same local stack have not been established. No credential file, password, token, or production account was read. An approved local QA password session, if later verified, would not prove Google OAuth end to end. Authenticated Manager UI readiness remains **BLOCKED**.

## G. H-27 prerequisite matrix

| Prerequisite | Current evidence | Status | Required action before H-27 |
| --- | --- | --- | --- |
| Docker daemon accessible | Engine API and `docker info` responded | **PASS** | Recheck if state changes |
| Existing backend containers running | H-09 and demo labeled stacks currently running | **PASS** | Choose one authorized synthetic stack, preserve others |
| Required containers healthy | DB/Auth/Kong healthy; REST HTTP root 200; no restart row | **PASS** for narrow inspected services | Verify remaining required services on selected stack before UI run |
| Local PostgreSQL accessible | DB healthy and published loopback port; no SQL connection | **UNKNOWN** | Bounded read-only DB connection when resources permit |
| Local GoTrue accessible | Auth settings HTTP 200 at H-09/demo loopback | **PASS** for health endpoint | Verify authorized local Manager login later |
| Local PostgREST accessible | REST root HTTP 200 at H-09/demo loopback | **PASS** for root endpoint | Verify authenticated Manager read RPC later |
| Required Manager schema/RPCs present | Historical H-16 H-09 proof; no current catalog check | **UNKNOWN** | Read-only catalog/contract check against selected DB |
| Local Manager authentication available | Historical synthetic account only | **BLOCKED** | Verify approved current login without exposing credentials |
| Frontend configured for localhost | Default `.env.local` hosted; running Vite target unknown | **FAIL** | Establish and prove an approved loopback-only frontend session |
| Sufficient memory for one browser | Final Windows free physical memory 382,404 KiB | **FAIL** | Regain headroom by separately planned, nondisruptive means, then remeasure host and VM |
| No protected-container changes required | Five protected Manager containers remain exited; H-09/demo run | **UNKNOWN** for full H-27 suitability | Confirm selected stack covers required UI contracts without protected changes |
| Hosted traffic safely excluded | Default frontend hosted; running Vite effective target unknown | **FAIL** | Verify effective client destination before any browser request |

## H. Risks

The daemon's recovery does not eliminate resource pressure. The last host sample leaves very little free memory, and the environment has 89 running containers. A browser launch could destabilize existing QA/demo services. Opening the unidentified Vite listener could send traffic to hosted Supabase. Multiple similarly named demo stacks make target confusion possible; project labels, ports, volumes, and synthetic provenance must stay linked. The historical Manager stack is deliberately stopped and must not be restarted for this assessment.

## I. Feasibility verdict

**NO-GO.** Docker and two relevant local HTTP surfaces now respond, but the memory gate fails, the frontend's local-only destination is unverified, and current Manager login/schema/RPC compatibility is incomplete. These blockers prevent safe H-27 browser acceptance now. The result is narrower than a claim that Docker is generally broken, and it does not revise H-16 or authorize H-27 automatically.

## J. Recommended next step

At a separately authorized, resource-safe time, first recover host and Docker VM memory headroom without touching protected stacks or deleting data; then repeat a read-only resource check. If capacity is adequate, select one existing synthetic backend by project label, validate its Manager catalog and permitted local login read-only, and establish a verified loopback-only frontend session. H-27 browser acceptance should be separately authorized only after those gates pass. None of these actions was performed in this recheck.

## K. Preservation verification

This recheck used Git/status reads, Windows process/memory/port reads, Docker `context show`, `context ls`, `version`, `info`, `ps -a`, and targeted `inspect`, plus four bounded loopback HTTP GET probes. It issued no Docker start/stop/restart, container/volume/network mutation, Supabase CLI, browser navigation, authentication, SQL, database write, environment edit, or application source edit. At inspection, all five historical Manager containers were exited and the inspected H-09/demo containers were running. The recheck cannot prove that no other actor changed services between snapshots; it only verifies that H-27A issued no mutating operation. No hosted endpoint was contacted.
