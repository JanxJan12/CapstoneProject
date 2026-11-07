# H-16 local acceptance preflight — 2026-10-16 Manila

**Later 11:20 Manila continuation:** The 07:01 BLOCKED decision below is historical. The existing named H-09 stack was reverified, an existing synthetic Manager authenticated, and ten Manager request/Receiving/stock scenarios were executed with independent SQL reconciliation. Current results and resource limits are in [the matrix](H16-MASTER-ACCEPTANCE-MATRIX.md) and [live evidence](H16-LIVE-ACCEPTANCE-20261016.json). No rendered browser or two-session run was started under low memory/swap headroom.

## Decision: BLOCKED before fixture creation; 07:01 Manila retry

On the user-requested retry, Docker server 29.8.2 responded. Six `rrj_h09_order_flow_20261015` services were running under the matching Compose and Supabase project labels and `.tmp/h09-stack-20261015` workdir. H-09 Kong and PostgreSQL bound only to loopback ports 48321 and 48322; DB and Storage mounted their separately named H-09 volumes. The protected demo used separate 61321/61322 listeners and was untouched. H-09 Auth health and REST root each returned HTTP 200. A read-only PostgreSQL query returned `postgres|postgres|f|53` (database, user, recovery state, migration-ledger count). The 53-entry local diagnostic ledger is not clean historical replay proof.

**The retry is still BLOCKED for synthetic fixture testing.** The Docker VM reported 7,803 MiB total memory, only **375 MiB available**, and **2,048/2,048 MiB swap used**. Windows reported about 0.58 GiB free physical memory. This is inadequate headroom for the specified browser and multi-session acceptance campaign, especially given the H-12/H-14 resource history. Effective RPC signatures/grants, approved role credentials, and new-fixture isolation were not completed after this safety failure. No Auth sign-in, browser acceptance, fixture creation, or business RPC mutation occurred. One additional read-only SQL probe guessed `public.inventory_requests` and returned `relation does not exist`; that name was not established from the schema and is **not** a workflow or schema defect finding. No further runtime probe followed the resource decision.

The table and outage account below preserve the **earlier H-16 attempt**, when the Docker Linux-engine pipe was absent. They are historical for this retry, not the current availability result.

The existing H-09 synthetic environment could not be positively identified in this session. `docker info --format '{{json .ServerVersion}}'` and `docker ps --format '{{json .}}'` both exited 1 because `npipe:////./pipe/dockerDesktopLinuxEngine` was absent. A read-only Windows listener query returned no listeners on 48321/48322 (candidate H-09) or 61321/61322 (protected defense demo). Per the H-16 stop rule, no further runtime attempts, credentials, browser session, SQL connection, or synthetic write followed. An unavailable test environment is **not** an application workflow failure.

| Preflight requirement | Current observation | Result |
| --- | --- | --- |
| Repository identity | `main...origin/main`; HEAD `9748bdef6d31a96282b88dc67f02724b8fd05819`; extensive pre-existing tracked and untracked work preserved. | PASS, read-only |
| Local migration inventory | 52 `.sql` files under `supabase/migrations`; file count does not prove effective DB state or clean replay. | PASS, file count only |
| Docker Linux engine | Both bounded read-only commands failed: Linux-engine named pipe absent. | BLOCKED |
| H-09 identity, ownership, mounts, protected-stack separation | No live container list or inspect possible. Historical labels, IDs, and ports were not reused as proof. | BLOCKED |
| Host listeners | No matching listeners returned for 48321, 48322, 61321, 61322. | BLOCKED |
| Auth, REST, SQL read health and effective RPC contracts | Not attempted after engine/identity failure. | BLOCKED |
| Authorized synthetic credentials, fixture isolation, resource headroom | Not established in this session; no private values were opened or printed. | BLOCKED |

## Source baseline and historical boundary

Current mounted Manager routes in `src/modules/manager/index.tsx` render formal Requests, Receiving, Stock Movements, adjustments, and waste. The H-15 Receiving `workspaceLoadVersion`/failed-report retry, H-15B request-register readiness/version guard and Try again, and H-15C synchronous pagination claim/ledger-ID check are present. The `/production`, `/kitchen`, and `/cashier` source paths and their versioned service RPC names were located, but none were authenticated or executed here. The versioned source contains request, Receiving, stock, batch, movement, order-deduction, Production, Kitchen, and Cashier contracts. Effective local database definitions could not be checked.

The 2026-10-16 H-14 report's later read-only retry recorded healthy H-09 Auth/REST/SQL and two authenticated read RPCs at that earlier time, but also recorded zero Receiving reports and zero historical Production requests plus low Docker VM memory/swap headroom. H-12 identifies H-09 as a candidate reusable backend and protects the defense demo, recovery stacks, unrelated applications, and their volumes. Those observations are historical, not current H-16 acceptance. H-13 through H-15C reported source/compile checks and deferred the new authenticated interaction cases.

## Actionable acceptance manifest

Before any later H-16 synthetic write, a new bounded preflight must establish, in order: responsive Docker Linux engine; exact H-09 Compose/Supabase project identity, six service owners, current IDs, port bindings and DB/Storage mounts; explicit separation from protected demo/recovery/unrelated stacks; Auth and REST health; read-only SQL `SELECT 1`, local migration ledger and required RPC signatures/grants; legitimate approved synthetic Manager, Production, Cashier, Customer and KDS identities without printing secrets; sufficient observed host/VM memory and swap headroom; and a fixture ledger identifying newly allocated H-16 records and protected prior evidence. Then record before-state and execute the master matrix in small groups through authenticated UI/RPC paths, with independent read-only SQL after every mutation. Preserve generated fixtures and audit records. If any gate fails, stop without repair, stack creation, or fixture mutation.

No Docker container, volume, network, hosted Supabase project, SQL object, application source file, or prior synthetic fixture was modified by this preflight.
