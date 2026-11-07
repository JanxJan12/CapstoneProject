# CAPSTONE-DB-ARCH-04 — legacy Manager request RPC retirement clearance

**Date:** 1 November 2026 (Asia/Manila). **Decision: INVESTIGATION COMPLETE — RETAIN LEGACY RPCs.** Neither `p_reason` overload has the mandatory external-consumer clearance. No migration or active application edit was made; no disposable database was created. Hosted project `zhzluhqvysvsadwuugpa` was queried read-only for catalog, aggregate business counts and available workload statistics. Its schema, data, Auth, Storage, and migration ledger were not modified. The extensive pre-existing dirty worktree was preserved.

## Objective, prior evidence, and boundary

The structural objective from [ARCH-03](CAPSTONE-DB-ARCH-03-20261101.md) is to remove two old writing interfaces once their supported consumers are migrated, while keeping formal Manager requests, historical revision Reason, linked Receiving, accepted-only stock posting and authorization. Reviewed [DB-01](CASHIER-DB-01-20261031.md) and its object/RPC inventories, [Track A](TRACK-A-LEGACY-BACKEND-CONSOLIDATION-20261026.md), [Manager lifecycle](MANAGER-REQUEST-LIFECYCLE-REGRESSION-20261014.md), [MGR-REC-02C](MGR-REC-02C-INTEGRATED-RECEIVING-ACCEPTANCE-202610.md), [authenticated Manager browser evidence](MAIN-MANAGER-AUTHENTICATED-BROWSER-E2E-20261012.md), [MIG-01](CAPSTONE-MIG-01-20261031.md), the October 12/18 request migrations, current Manager source, Rider source and current tests. Older browser/Receiving passes were on synthetic isolated stacks and are **prior evidence**, not fresh ARCH-04 acceptance. The Phase 2A clean-replay failure is unchanged and was not reinvestigated.

## Gate A — exact deployed function inventory

The four rows below are live `pg_proc`/`pg_get_functiondef` results. `timestamptz` in repository SQL and `timestamp with time zone` in catalog identity denote the same PostgreSQL argument type. All four return **`jsonb`**, are owned by **`postgres`**, are **`SECURITY DEFINER`** with `SET search_path TO ''`, have no function comment, and have exact effective ACL entries `postgres=X/postgres`, `service_role=X/postgres`, `authenticated=X/postgres`; PUBLIC/anon have no EXECUTE. Each is a distinct function identity; names alone are insufficient for a DROP.

| Disposition | Exact identity argument signature | Argument names in order | Hosted definition MD5 / length |
| --- | --- | --- | --- |
| **Retain current** | `public.issue_inventory_request(uuid,text,timestamptz,jsonb,jsonb)` | `p_request_id,p_priority,p_needed_at,p_lines,p_expected` | `c3811f65246f988ef2b7f22b6973b0d9` / 5,311 characters |
| **Retain legacy pending clearance** | `public.issue_inventory_request(uuid,text,timestamptz,text,jsonb,jsonb)` | `p_request_id,p_priority,p_needed_at,p_reason,p_lines,p_expected` | `b43b2b1b017b6ac20686f5b3728873d3` / 1,456 characters |
| **Retain current** | `public.revise_inventory_request(uuid,integer,text,timestamptz,jsonb,jsonb)` | `p_request_id,p_expected_revision,p_priority,p_needed_at,p_lines,p_expected` | `f00e5adaecc8720074ce1771de9466de` / 4,810 characters |
| **Retain legacy pending clearance** | `public.revise_inventory_request(uuid,integer,text,timestamptz,text,jsonb,jsonb)` | `p_request_id,p_expected_revision,p_priority,p_needed_at,p_reason,p_lines,p_expected` | `57bab2da590180d247e24c447abf29aa` / 945 characters |

The old signatures originated in `20261012181744_manager_inventory_request_documents.sql`. `20261018204755_remove_inventory_request_reason.sql` introduced the current signatures, replaced the old bodies with adapters, removed the document Reason column after preserving historical Reason in revision snapshots, and kept the old signatures for prior deployed clients. The deployed old bodies inspected in full are the adapters in that October 18 file at lines 238–290. The deployed current bodies are its issue/revise definitions at lines 57–234, identified above by live definition fingerprints. These source locations plus the fingerprints are the restoration reference; exact definitions and ACLs must be captured again immediately before any later implementation because deployed bodies may drift.

**Behavioral comparison.** Both current writers require an active Manager through `inventory_request_manager_required()`, validate state/lines/quantities/proposal, lock to serialize issues, write formal document/lines/revision/event, and leave stock unchanged until Receiving posting. The current issue writer checks retry identity and input; current revision locks the document, requires its expected revision and no linked Receiving draft, and rejects invalid/stale input. The old issue adapter separately requires nonblank `p_reason`, takes the issue advisory lock, checks any prior revision-1 Reason for retry consistency, invokes the current issue writer, and injects Reason into the new revision-1 JSON snapshot. The old revise adapter separately requires nonblank Reason, invokes the current revise writer, and injects Reason into the new revision JSON. All four return `jsonb`, but an old call has **additional validation and a historical JSON write**; it is not behaviorally identical to a new call for a client that relies on Reason. Both adapters use the same Manager helper and do not bypass current writer authority. No function, trigger, view or catalog dependency was found that needs either old function as a referenced object; text body inspection showed no other public function calling those exact old signatures. This does not clear API consumers.

## Gate B — callers and hosted usage

| Consumer | Evidence and classification |
| --- | --- |
| Current Manager React app | `src/modules/manager/inventory/inventoryRequestApi.ts:100–130` sends issue/revise without `p_reason`. **ACTIVE AND OWNED, already on current signatures.** The `p_reason` at line 159 is the distinct `close_inventory_request_short` contract. No caller edit needed. |
| Repository scripts/tests | Current formal-request tests, `scripts/verify-manager-focused-db.mjs`, Track A fixtures and H-23 assertions use the current signature. October 12/18 migration definitions are **HISTORICAL / ARCHIVED** and must remain unchanged. Other `p_reason` uses concern cancellation, waste, adjustments, Receiving, or shortfall closure. |
| Standalone Rider | Focused `.ts/.tsx/.js/.mjs` search in Rider `src` and `tests` found no issue/revise call. **No known owned Rider caller**; absence does not clear external clients. |
| Database/Edge/Cron | Live `pg_depend` returned no dependent object for either old function. Public function-body search found only the overloads themselves and the separate register Reason read. The single active hosted Edge Function, `rider-offer-push`, contains neither name. No current source Edge directory or known Cron call was found. Dynamic or service-role external calls remain **UNKNOWN**. |
| Old issue PostgREST client | `pg_stat_statements` has query ID `-3932527321666389048`, database role `authenticated`, with **2 cumulative calls** whose PostgREST `json_to_record` argument shape includes `p_reason`. The current five-argument issue shape has **3 calls** (query ID `-7085798282199137485`). **UNKNOWN caller and current support status.** This may be an earlier app, test, or external client; the aggregate cannot identify which. |
| Old revise client | No PostgREST-shaped revise entry in the available `pg_stat_statements` window. **UNKNOWN external compatibility**, not proof of zero lifetime use. No owner-approved retirement decision is recorded. |

`pg_stat_statements_info.stats_reset` is **2026-08-04 04:48:40 UTC**. Its cumulative counters and DB role do **not** provide the call time, JWT user, device, application version, environment, success outcome, or last use. A single available 24-hour unified-log query for either function name returned no matching event; that narrow negative result does not attribute or clear the two cumulative old issue calls. The two observed calls must not be called current usage, but they also cannot be dismissed. No repository-side external-client registry or accepted compatibility-retirement decision was found. Identifying every supported client and explicitly clearing any unattributed use is the **mandatory remaining gate**.

## Gate C — historical Reason and read behavior

Live aggregate: **5 formal request documents**, **5 revision snapshots** (all revision 1), **2 nonblank snapshot `reason` values**, and **5 linked formal Receiving reports**. No IDs, Reason text or private record payloads were extracted. The old issue adapter can add `reason` to a new revision-1 snapshot; the old revise adapter can add it to a later revision. The October 18 migration separately preserved the former document Reason in revision JSON. The aggregate alone cannot attribute either of the two current Reason values to a particular writer or call. The new writers create revisions without a Reason key. `get_inventory_request_register()` still reads `r.snapshot->>'reason'` into its `reason` projection and returns the full revision snapshots; it does not depend on old writer functions to read history. Current `ManagerRequestsPage.tsx` does **not** render a Reason field from the register; thus the historical value is available through the RPC but visible display in the current Manager UI is **not established**. This corrects any stronger inference from ARCH-03. It is outside this retirement scope to add UI or rewrite records. Formal Receiving links by document/revision and quantities, not by the old Reason writer; existing linked reports remain protected.

## Gates D/E — lifecycle equivalence and independent decisions

The supported path remains Manager proposal → multi-item issue → permitted pre-Receiving revision → revision/event history → external replenishment communication → linked Receiving draft → delivered/accepted/rejected lines → single accepted-only post → batch/ledger/stock reconciliation. External communication is not automatically an in-system dispatch event. Current source and prior isolated lifecycle/Receiving tests cover this path with the current signatures. The old adapters add a mandatory header Reason and JSON preservation for legacy callers; no required *current Manager UI* step is missing from the new signatures. That establishes business-path equivalence for the owned app, **not external API equivalence**. Historical values remain readable through register independently of the adapters.

| Exact candidate | Decision | Decisive reason |
| --- | --- | --- |
| Old `issue_inventory_request(uuid,text,timestamptz,text,jsonb,jsonb)` | **RETAIN TEMPORARILY — EXTERNAL CLEARANCE** | Two authenticated PostgREST-shaped calls are unattributed; no accepted decision says their client is retired or migrated. |
| Old `revise_inventory_request(uuid,integer,text,timestamptz,text,jsonb,jsonb)` | **RETAIN TEMPORARILY — EXTERNAL CLEARANCE** | No owned caller or observed PostgREST revise entry, but the exposed authenticated contract may have unknown external consumers and has no independent owner clearance. Lack of calls is not clearance. |

Neither passes the requested local-drop threshold, including as a one-function batch. No placeholder migration, DROP, caller edit, grant change, historical rewrite, or disposable destructive probe was attempted. The precise missing authorization is an evidence-backed owner/API-contract decision identifying supported external clients and retiring or migrating the old signatures; for issue, it must account for the two old-shape calls. If an active client requires a Reason-bearing new request/revision, its business requirement must be resolved before removal. No approval is inferred from silence or elapsed time.

### Captured legacy body logic for future exact-identity review

The hosted `pg_get_functiondef` returned the following operational bodies for the two candidates (its headers, owner, security, search path, return type, ACL and MD5 are recorded in Gate A). These are evidence, **not a migration or restoration script**; a later change must recapture the entire live definition immediately before DDL.

```sql
-- issue_inventory_request(uuid,text,timestamptz,text,jsonb,jsonb)
declare
  v_result jsonb;
  v_prior_reason text;
  v_exists boolean;
begin
  perform public.inventory_request_manager_required();
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Complete request header and lines required.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('inventory_request_issue'));
  select true, r.snapshot->>'reason' into v_exists, v_prior_reason
    from public.inventory_request_documents d
    join public.inventory_request_revisions r
      on r.request_id = d.id and r.revision = 1
    where d.id = p_request_id;
  if coalesce(v_exists, false) and v_prior_reason is distinct from btrim(p_reason) then
    raise exception 'Request ID reused with different details.' using errcode = '22023';
  end if;
  v_result := public.issue_inventory_request(
    p_request_id, p_priority, p_needed_at, p_lines, p_expected
  );
  if not coalesce(v_exists, false) then
    update public.inventory_request_revisions
      set snapshot = jsonb_set(snapshot, '{reason}', to_jsonb(btrim(p_reason)), true)
      where request_id = p_request_id and revision = 1;
  end if;
  return v_result;
end;

-- revise_inventory_request(uuid,integer,text,timestamptz,text,jsonb,jsonb)
declare v_result jsonb;
begin
  perform public.inventory_request_manager_required();
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Current undelivered request and complete revision required.' using errcode = '22023';
  end if;
  v_result := public.revise_inventory_request(
    p_request_id, p_expected_revision, p_priority, p_needed_at, p_lines, p_expected
  );
  update public.inventory_request_revisions
    set snapshot = jsonb_set(snapshot, '{reason}', to_jsonb(btrim(p_reason)), true)
    where request_id = p_request_id and revision = (v_result->>'revision')::integer;
  return v_result;
end;
```

## Verification, scorecard, and restoration

| Check | Status and evidence |
| --- | --- |
| Four exact signatures, owner, security, search path, return type, grants, definition fingerprints | **PASS — hosted read-only catalog.** |
| Known web/Rider/source/test, database-function and Edge caller search | **PASS for inspected sources; UNKNOWN external consumers.** |
| Hosted issue telemetry and revision/Receiving/financial aggregate | **PASS — hosted read-only.** Counts are a point-in-time baseline, not a mutation test. |
| H-23 request workflow source assertions | **PASS — 40 checks**, unchanged source; not a live authenticated transaction. |
| `npm.cmd run typecheck`; `npm.cmd run build` | **PASS**, unchanged source; build transformed 3,046 modules. |
| New local migration, disposable Manager issue/revise/Receiving/stock/role/financial regression | **NOT RUN — clearance gate failed; no migration exists.** Prior synthetic runs cited above are not new acceptance. |
| Exact function-and-grant restoration rehearsal | **NOT RUN — no function was removed.** Captured catalog identities/ACLs/fingerprints and October 18 definitions give a future before-state reference, not a tested restore. |
| Hosted deployment or financial/business-data write | **NOT RUN / PROHIBITED.** |
| Original chronological migration replay | **NOT RUN** here; MIG-01 documents the existing Phase 2A failure. |

| Object measure | Before hosted | After ARCH-04 local | After hosted |
| --- | ---: | ---: | ---: |
| Legacy issue/revise functions | 2 | **2** | **2** |
| Supported issue/revise functions | 2 | 2 | 2 |
| All issue/revise overloads | 4 | 4 | 4 |
| Formal documents / revision snapshots / nonblank Reason snapshots | 5 / 5 / 2 | unchanged | unchanged |
| Public tables / linked formal Receiving reports | 36 / 5 | unchanged | unchanged |
| Functions cleared / locally removed / hosted removed | — | **0 / 0 / 0** | **0** |

No performance or maintenance saving is claimed. Financial payment and Cashier receipt aggregates were observed as 44 and 42 only; no financial transaction was executed, so financial behavioral regression is **NOT RUN**. For a later cleared migration, capture fresh exact `pg_get_functiondef`, owner/ACL/config/comment, preserve both current overloads, drop only independently cleared exact signatures without `CASCADE`, run current-schema authenticated Manager and denial plus Receiving/stock/financial A/B tests with synthetic data, and recreate exact functions/grants in a disposable restoration rehearsal. A successful current-schema test would still leave clean-history, recovery and separate hosted approval gates.

**Changed files:** this report and a brief append to `qa/CASHIER-MANUAL-FINDINGS-20261030.md` only. **Next bounded action:** obtain an owner-approved inventory and retirement decision for clients capable of calling the two old signatures, specifically attributing or dispositioning the two observed old issue calls; then reassess each signature independently. Do not begin another architectural milestone automatically.
