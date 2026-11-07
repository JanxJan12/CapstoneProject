# H-16G — post-reboot Manager Lifecycle reversible stop result

**2026-10-16, approximately 11:12–11:14 Asia/Manila. Outcome: 5/5 authorized containers stopped.** This is a retained-container pause, not a deletion or H-16 scenario run. The owner's approval covered exactly the five `rrj_manager_lifecycle_20261014` containers below. No other stop, start, Docker Desktop restart, cleanup, database write, migration, or hosted operation was issued.

## Live checks before the stop

Fresh `docker inspect` returned the exact five full IDs below, all `running`, with the expected service names, `com.docker.compose.project` and `com.supabase.cli.project` both equal to `rrj_manager_lifecycle_20261014`, `unless-stopped` restart policies, and only the dedicated `supabase_network_rrj_manager_lifecycle_20261014` network. Fresh network inspection showed precisely those five members. Volume-filtered Docker lists showed only the Manager DB mounting `supabase_db_rrj_manager_lifecycle_20261014` and only Manager Storage mounting `supabase_storage_rrj_manager_lifecycle_20261014`. Kong published 52321 and DB 52322; REST, Auth, and Storage had no published host port. This confirmed the documented Docker resource separation from protected stacks at execution time; it does not establish absence of external clients. The owner accepted interruption of the historical Manager service.

Before stopping, H-09 (56321) and canonical demo (61321) Auth settings and REST root each returned HTTP 200 using bounded loopback probes. Windows free physical/virtual memory was 757,332/11,355,136 KiB. No current running-count or Docker VM memory/swap baseline was taken before the stop, to avoid the pre-stop checks that stalled H-16F.

## Commands actually issued and result

Each command ran separately with a 15-second Docker grace period and a 25-second client bound. Each returned exit 0 and the full requested ID; an immediate inspect reported `exited` before the next command. Docker printed only a deprecation notice for `--time`.

| Order | Service | Exact command | Immediate state |
| --- | --- | --- | --- |
| 1 | Kong | `docker stop --time 15 7088583f5d03bdec2f2221bdc2aeca0643b983132a160f3b97b64b99d4eb9ef8` | exited |
| 2 | REST | `docker stop --time 15 dcdd656c805d1e506bfbd830729d0f7aaecb7813665b4e676c5009e8f42d186f` | exited |
| 3 | Auth | `docker stop --time 15 caca8252418a42261e360969151cb1a324b7557676ac0a5beb9fac0591c5e4bf` | exited |
| 4 | Storage | `docker stop --time 15 b7f9e3a021fe2e5f6acdb33b7de6fe3681b958774a6ecbaf9d714f7aecf43332` | exited |
| 5 | PostgreSQL | `docker stop --time 15 8d75e1ef2533f727c21e995151131520fce81f15abdb4256f0078c4ebac04086` | exited |

There was no partial stop or timeout. A final inspect reported all five `exited` with code 0. After the stop, Docker listed 99 total and 89 running containers. The historical 94 running count was **not** a fresh pre-stop baseline; the observed five successful state transitions establish the exact stop result without relying on that historical count.

## Post-stop protected health and resources

H-09 and canonical demo Auth settings and REST root again each returned HTTP 200. Their existing DB containers each answered read-only `select 1` with `1`. These are narrow availability checks, not authenticated workflow, Storage, or full SQL health proof. No protected service degradation was observed in these checks, so rollback was not invoked.

Windows free physical memory fluctuated to 187,984 KiB immediately after the stop and 441,992 KiB on a later reading; free virtual memory was 11,061,856 then 10,881,640 KiB. Both physical readings were below the 757,332 KiB pre-stop reading. One post-stop Docker VM reading showed `MemAvailable` 1,017,756 kB and `SwapFree` 310,428 kB of 2,097,152 kB total swap (`MemTotal` 7,990,484 kB). There is no same-run pre-stop VM reading. **No host or VM memory gain is established or attributed to this stop.** Memory pressure remains material; these samples do not forecast the effect of any other stop.

## Retention and rollback

All five containers, their metadata, the two named DB/Storage volumes, dedicated network, images, and private fixture files were retained. For a needed rollback, inspect current identities/states first and start only these originally running containers that remain stopped, in dependency order: DB `8d75e1ef...`, Auth `caca8252...`, REST `dcdd656c...`, Storage `b7f9e3a0...`, Kong `7088583f...`; check DB readiness before dependent services and Auth/REST/Storage before Kong. Use the full IDs in the table or H-16C, never the abbreviated IDs in this sentence. No automatic restart or other stack action is authorized by this note.

The H-16 test campaign was not run. Its historical **0 PASS / 0 FAIL / 59 BLOCKED** remains unchanged. Further stops or removals require separate authorization.
