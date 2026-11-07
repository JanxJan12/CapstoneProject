# Track B — security and data integrity, phase 1 (26 October 2026)

## Boundary and evidence

Canonical checkout: `C:\Users\Janmari\Downloads\Capstone Project` (substantially dirty before this increment). Hosted project: `zhzluhqvysvsadwuugpa`. Hosted inspection used only `SELECT` queries against `pg_class`, `pg_attribute`, `pg_policies`, `pg_proc`, `information_schema.columns`, and `storage.buckets`, plus the Supabase security advisor. No hosted SQL mutation, API business call, migration apply, Storage mutation, or production data read/write occurred. The local policy test runs in a transaction that ends with `ROLLBACK`.

The [Track A 36-table map](./TRACK-A-BACKEND-ARCHITECTURE-20261026.md) supplied the domain inventory; the [Track A deployment record](./TRACK-A-LEGACY-ACCESS-DEPLOYMENT-EXECUTION-20261026.md) establishes the `20261026132319` access change. Current hosted catalog inspection confirmed all 36 public tables have RLS enabled. There are no public views. Table grants and policies, RPC execute grants and bodies, and the three private Storage buckets were read again for this assessment. [Supabase API security documentation](https://supabase.com/docs/guides/api/securing-your-api) distinguishes object grants from RLS and notes that RLS does not constrain function execution.

## Risk-ranked active access matrix

| Priority / path | Actual client caller and authorization boundary | Hosted grant, policy, and function evidence | Assessment |
| --- | --- | --- | --- |
| **P1 Rider assignment and delivery proof reads** | `/rider` is route guarded by Rider role (`src/app/routes.tsx:171–179`); the service directly selects `delivery_assignments` (`src/modules/rider/services/supabaseRiderService.ts:104,250,510,1052`) and uploads to private `delivery-proofs` (`:879`). Route checks can be bypassed by direct API calls. | `authenticated` has table `SELECT`; the sole `rider_select_own_assignments` RLS policy checked `rider_id = auth.uid()` only. The private `delivery-proofs` bucket is `public=false`; `rider_read_own_delivery_proof` checked path owner and assignment owner, but no active profile, Rider role, or approval. The upload policy *does* require all three. | **Confirmed gap.** A still authenticated, suspended/former Rider with an assignment can read the assignment and its private proof, even though active Rider order reads and upload are denied. Local role test reproduced both reads before the fix. |
| **P2 Customer order and payment data** | `/customer` is mounted publicly (`src/app/routes.tsx:162–168`); customer order quote is called at `src/modules/customer/index.tsx:2328,2381`, and placement/payment calls are in the same mounted module. | `quote_customer_order`, `place_customer_order_confirmed`, and `submit_customer_payment` are `SECURITY DEFINER`, executable by `authenticated` but not `anon`; inspected bodies require `auth.uid()`, active Customer profile, ownership or signed quote/session constraints. `orders` RLS permits own rows; private `payment-proofs` reads are owner/order scoped, with separate active Customer upload policy. | No confirmed bypass in the inspected write bodies. Own-order and own-proof read policies do not check account activity; possible deactivation privacy decision needs a separate focused review. No write attempted. |
| **P2 KDS terminal credential** | `/kitchen` is publicly mounted (`src/app/routes.tsx:183–192`); `src/modules/kitchen/services/kdsTerminalService.ts:128,169,244` calls terminal RPCs. | `get_kds_queue_v2`, `get_kds_queue`, `verify_kds_terminal`, and `advance_kds_order` are executable by `anon` and `authenticated` as `SECURITY DEFINER`. The inspected `get_kds_queue_v2` calls `get_kds_queue`, whose body checks active terminal ID and SHA-256 secret hash; `advance_kds_order` likewise checks the credential. `kds_terminals` has no direct client `SELECT` grant. | Device secret is the intended backend boundary. No credential bypass established; token lifecycle/rate limiting was not tested. |
| **P2 Cashier payment and sale actions** | `/cashier` is role guarded (`src/app/routes.tsx:150–159`); `src/modules/cashier/api/onlinePaymentApi.ts:261` calls the payment RPC. | `get_cashier_online_payments` and `verify_customer_gcash_payment` have `authenticated` execute, no `anon` execute, and the hosted definitions contain active profile and role checks. `cashier_shifts` and `cashier_transactions` are direct `SELECT` only, with RLS limiting Cashier to own rows and Manager to staff rows; no authenticated table writes. | Grant alone is broad, so body checks matter. No bypass found in this bounded inspection; authenticated workflow was not exercised. |
| **P2 Manager Requests, Receiving, inventory** | `/manager` is role guarded (`src/app/routes.tsx:138–147`); `inventoryRequestApi.ts:132` records formal events and `receivingApi.ts:893` posts Receiving. | Formal request and Receiving tables have no `authenticated` direct table privileges. `record_inventory_request_event` calls `inventory_request_manager_required()` and checks open/current revision; `post_receiving_report` is `SECURITY DEFINER` with an active Manager check. Both are callable by `authenticated`, not `anon`. Track A revoked legacy transition execute from `authenticated` in hosted version `20261026132319`. | No bypass found in the representative active writes; accepted-only posting remains Track A scope. No hosted business transaction tested. |

All three Storage buckets (`delivery-proofs`, `payment-proofs`, `rider-documents`) are private. The hosted `storage.objects` policies were inspected for `SELECT` and `INSERT`; no broad anonymous read policy was present. Advisor flags many authenticated `SECURITY DEFINER` functions as potential exposure; these are review prompts, not proof of a bypass. The hosted function body and nested-call checks above are necessary because the frontend route is not a database boundary.

The decisive hosted catalog reads can be repeated without business rows:

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename = 'delivery_assignments')
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select c.relname, c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

select p.oid::regprocedure::text, p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('record_inventory_request_event', 'post_receiving_report',
    'get_cashier_online_payments', 'verify_customer_gcash_payment',
    'quote_customer_order', 'place_customer_order_confirmed',
    'accept_rider_offer', 'advance_rider_delivery',
    'get_kds_queue', 'get_kds_queue_v2', 'advance_kds_order');

select id, public from storage.buckets order by id;
```

## Selected defect and local fix

**P1 within this phase: revoked Rider retains delivery artifact access.** Preconditions: the actor still has a valid authenticated session, owns a prior delivery assignment, and knows its assignment ID or proof path. Manager suspension changes profile role to Customer and rider approval to Suspended (`set_manager_rider_approval_status` hosted body); the existing read policies ignored those fields. Impact is continued access to assignment history and private proof images after revocation. The assignment row includes `proof_of_delivery_path`, so the path is discoverable from the same permissive read. This is a confidentiality defect, not evidence of cross-rider access or an ability to alter delivery status.

Local migration `supabase/migrations/20261026144235_track_b_restrict_rider_assignment_proof_reads.sql` updates exactly the two read policies. Both retain owner checks and now require an active profile with `role='rider'` and `approval_status='approved'`. It does not change writes, KDS, formal Requests, Receiving, or Track A. The migration was created with `supabase migration new` and has **not** been deployed.

Local test `supabase/tests/verify_track_b_rider_read_authorization.sql` creates disposable Auth/profile/Rider/order/assignment/Storage metadata inside one transaction. It uses PostgreSQL `authenticated` role plus `request.jwt.claims` to exercise actual RLS, and rolls back the fixture and policy DDL. Before injecting the migration, the suspended identity could read its assignment and proof. After injection, approved Rider reads pass, unrelated Customer reads deny, suspended Rider reads deny, and inactive Rider reads deny. This is SQL role/JWT simulation, not a successful GoTrue sign-in or Storage HTTP download. The already-running local Track A database has 34 public tables, versus 36 hosted; it contains the two target policies and relevant structures but is not a full current hosted clone.

## Results and limits

| Check | Result |
| --- | --- |
| Hosted table grants/RLS, RPC grant/body sample, private Storage policies/buckets | **PASS — read only.** 36 public tables with RLS; three private buckets. |
| Old-policy defect reproduction with disposable local identity | **PASS.** Suspended identity saw own assignment and proof metadata. |
| Local policy regression: approved success; unrelated Customer, suspended, inactive denials | **PASS.** Transaction completed and rolled back. |
| `npm run typecheck` and `npm run build` | **PASS.** Current combined dirty tree, 26 October. |
| Hosted authenticated role test, hosted Storage download, hosted write/deploy | **NOT RUN.** Read-only boundary and no production credentials/data mutation. |
| Real local GoTrue sign-in and PostgREST/Storage HTTP acceptance | **NOT RUN.** The available local stack is an older targeted fixture; SQL role/JWT simulation is the evidence here. |
| Full review of every RPC body and all 36 tables' business semantics | **NOT RUN.** This was a bounded first increment. |

**Changed files in this increment:** only the new migration, local SQL regression test, and this report. All pre-existing dirty files remain as found. `git diff --check` reported only trailing whitespace in pre-existing `supabase/config.toml` and `supabase/tests/verify_receiving_batch_foundation.sql`; neither was touched here.

**Next minimal Track B increment:** in a current disposable local Supabase clone, sign in disposable approved and suspended Rider accounts and verify the same assignment and private-file reads through PostgREST and Storage HTTP, including a previously issued signed URL's expiry behavior. Then separately inspect Customer deactivation reads. The policy migration remains local until an authorized, narrowly scoped deployment review.
