# Track B — cancellation versus Rider concurrency (27 October 2026)

## Decision

**Confirmed:** the deployed `settle_paid_order_cancellation` and `advance_rider_delivery` bodies acquire the same two rows in opposite order. A controlled two-session PostgreSQL 17 run returned SQLSTATE **40P01**. PostgreSQL aborted the Manager transaction; the Rider pickup committed. The database retained internally consistent payment, receipt, assignment, order, and audit state, but the failed Manager operation cannot be retried as a cancellation after pickup. Because the Manager RPC requires an attestation that the external refund has already been completed, this transient failure can leave a refunded customer with an uncancelled order. The fixture did not perform or prove any real-world refund.

**Local correction:** one new migration moves the Manager's existing active-assignment `FOR UPDATE` lock immediately before its order `FOR UPDATE` lock. The Rider path remains assignment then order. No authorization, refund, inventory, custody, status, replay, or grant rules were changed. The migration was **not deployed**.

## Source and boundary

- Canonical checkout: `C:\Users\Janmari\Downloads\Capstone Project`; pre-existing dirty work was preserved.
- Hosted Supabase project `zhzluhqvysvsadwuugpa`: `SELECT pg_get_functiondef(...)` only. The hosted definitions of both targeted functions were inspected; their relevant lock, guard, update, and return bodies matched `supabase/migrations/20261007080031_phase_7a_paid_order_cancellation.sql` and `supabase/migrations/20260914010000_harden_transition_replay_safety.sql`. Hosted definition MD5 values returned by PostgreSQL were `f4ee0ef351d3eb7a29824617958c66d2` (Manager) and `5a02c96e0eeb14e1847ce85f2d1d46c0` (Rider).
- Disposable `postgres:17` container with a minimal synthetic schema, separate PostgreSQL `authenticated` and `anon` roles, and Manager/Rider/Cashier profile identities. The fixture contained one `rider_accepted` order, one `accepted` assignment, a verified cash payment, an open cashier shift, and a completed cashier sale with unique transaction and receipt numbers. Both original function bodies were loaded unmodified for the baseline. The local migration was then applied only in the corrected runs. The runner deletes its named container and anonymous volume after each run.
- The controlling prelocks were issued inside the two test transactions before `SET ROLE authenticated`; the RPC calls themselves ran as `authenticated` with distinct `auth.uid()` values. These prelocks force the interleaving at the same row-lock points reached by the functions. No hosted business RPC, DML, DDL, Storage action, migration, or deploy was run.

## SQL trace and committed outcomes

Relevant original order:

```sql
-- Manager: order first, active assignment later
select orders.* into v_order from public.orders orders
where orders.id = p_order_id for update;
-- after payment, receipt, and optional inventory checks:
select assignment.rider_id into v_rider_id
from public.delivery_assignments assignment
where assignment.order_id = p_order_id
  and assignment.status in ('offered', 'accepted')
order by assignment.assigned_at desc, assignment.id desc
limit 1 for update;

-- Rider: assignment first, order later
select da.order_id, da.rider_id, da.status
from public.delivery_assignments da
where da.id = p_assignment_id for update;
select o.current_status from public.orders o
where o.id = v_order_id for update;
```

The baseline controlled sequence was:

```sql
-- Manager session, transaction open: lock the synthetic order.
select id from public.orders where id = '20000000-0000-0000-0000-000000000001' for update;
-- Rider session, transaction open: lock the synthetic assignment.
select id from public.delivery_assignments where id = '30000000-0000-0000-0000-000000000001' for update;
-- Manager call waits on the assignment; pg_stat_activity reported
-- wait_event_type = Lock, wait_event = transactionid, pg_blocking_pids = {Rider PID}.
select public.settle_paid_order_cancellation(
  '20000000-0000-0000-0000-000000000001',
  'Synthetic customer refund', 'no_return', 'cash',
  'TRACK-B-REFUND-1', true, false
);
-- Rider call attempts the order held by Manager.
select * from public.advance_rider_delivery(
  '30000000-0000-0000-0000-000000000001', 'accepted'
);
```

PostgreSQL returned `ERROR: 40P01: deadlock detected` to the Manager. Its detail showed the Manager waiting for a ShareLock on the Rider transaction and the Rider waiting for a ShareLock on the Manager transaction; the context identified Manager's `delivery_assignments ... FOR UPDATE` at function line 260. The Rider call returned `picked_up|picked_up` and committed. After both transactions ended: `orders.current_status=picked_up`, assignment `status=picked_up`, payment `status=verified`, receipt/sale `status=completed`, **zero** cancellation settlements, and **one** Rider status-history row. The Manager retry returned `22023` (“Only a paid order before rider pickup or completion can be settled”); the Rider stale retry was rejected. Thus the losing transaction rolled back without partial financial or audit writes.

The correction keeps the same active-assignment query and moves it before the order query. In the **Manager-first** run, Rider waited on the assignment; Manager committed a single cancellation, voided payment and receipt, and recorded one cancellation history row. Rider's stale transition was rejected. A Manager retry returned `already_recorded=true` with no extra settlement or history row. In the **Rider-first** run, Manager waited on the assignment; Rider committed pickup; Manager rejected cancellation with `22023`. Neither corrected run returned `40P01`.

| Run/check | Result | Observed evidence |
| --- | --- | --- |
| Original two-session opposite-order schedule | **FAIL** | Reproduced `40P01`; Manager rolled back; Rider committed. |
| Corrected Manager-first schedule | **PASS** | Cancelled order/assignment; voided payment/receipt; exactly one settlement and one history row; no deadlock. |
| Corrected Rider-first schedule | **PASS** | Pickup committed; Manager rejected after waiting; verified payment and completed receipt retained; no settlement; no deadlock. |
| Role and retry checks | **PASS** | Rider cancellation rejected `42501`; Manager Rider-transition rejected; `anon` lacked `EXECUTE` on both functions; same-payload cancellation retry was idempotent; stale Rider retry rejected. |
| `npm run typecheck`; `npm run build` | **PASS** | Both completed on the existing combined dirty tree. |
| Full Supabase schema, RLS, triggers, and unrelated workflow interaction | **NOT RUN** | Targeted synthetic schema only; no historical migration replay. |
| Hosted business calls, hosted concurrency, migration, deploy | **NOT RUN** | Hosted project remained read-only. |

## Files and limits

- `supabase/migrations/20261026194712_track_b_cancellation_rider_lock_order.sql` — local-only replacement of the Manager function, generated as a new migration; no historical file was rewritten.
- `qa/track-b-cancellation-rider-concurrency-20261027.mjs` — reproducible three-mode disposable fixture and assertions. Run `node qa/track-b-cancellation-rider-concurrency-20261027.mjs baseline`, `corrected-manager-first`, and `corrected-rider-first` separately from the repo root with Docker available.
- This report.

The fixture uses the real PL/pgSQL bodies and database roles, but its surrounding schema is intentionally minimal. It does not establish behavior with every production trigger, policy, or third concurrent workflow. The correction removes this demonstrated order/assignment cycle for the one-active-assignment path; it cannot make an externally completed refund atomic with Rider pickup. The original schema has a partial unique index allowing only one active assignment per order.

**One next bounded action:** repeat these three synthetic schedules against an isolated clone of the current deployed schema with its triggers and policies enabled, before considering a separately authorized deployment.
