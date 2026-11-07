# H-08B historical shift retrieval: owner approval proposal

**Proposal only.** Do not apply SQL, change grants/RLS, or mount historical retrieval until the owner explicitly approves the role scope and a separate implementation authorization. The financial policy decision sheet remains unsigned; no refund or net-sales rule is chosen here.

## Decision card

Approve or revise: (1) active Cashier reads only their own closed shifts; (2) active Manager reads closed shifts across cashiers on a separate Manager route; (3) deactivated accounts read none; (4) closure fields remain immutable as saved; (5) later receipt status is shown, if at all, separately and dated, with no retroactive settlement recomputation. Decide retention duration and whether Manager may filter by cashier. Do not infer these permissions from the currently broad `cashier_shifts` table SELECT/RLS policy.

## Least-privilege contract to implement after approval

`public.get_closed_cashier_shifts(p_from_ended_at timestamptz default null, p_before_ended_at timestamptz default null, p_cashier_id uuid default null, p_cursor_ended_at timestamptz default null, p_cursor_id uuid default null, p_limit integer default 25)`; `RETURNS TABLE` of `shift_id`, `cashier_id`, `terminal`, `opening_cash`, `expected_cash`, `actual_cash`, `variance`, `variance_reason`, `notes`, `started_at`, `ended_at`, `closed_by`, `manager_approved_by`, `manager_approved_at`. No payment/receipt/customer data, no service key, no `SELECT *`. Use `SECURITY INVOKER`, fixed `search_path`, authenticated EXECUTE only, and explicit active `profiles.role` check from `auth.uid()`. Reject unauthenticated, inactive, or non-Cashier/Manager callers with 42501. Cashier predicate is always `s.cashier_id = auth.uid()` and rejects any different `p_cashier_id`; Manager may supply a cashier filter or read all. Keep `s.status='closed'` mandatory.

Require `1 <= p_limit <= 50`; invalid bounds or half-supplied cursor are errors. Apply `ended_at >= p_from_ended_at` and `< p_before_ended_at`, `ORDER BY ended_at DESC, id DESC`, and keyset continuation `(ended_at,id) < (p_cursor_ended_at,p_cursor_id)`. Return at most limit rows; an optional one-extra-row fetch can generate `has_more` without a total count. UI date controls convert Manila calendar days into UTC timestamp boundaries before calling; start is inclusive, end is exclusive, and shifts are assigned by `ended_at`, not a midnight split of receipt rows. Add a bounded index on `(cashier_id, ended_at DESC, id DESC)` plus `(ended_at DESC, id DESC)` only if query plans justify them.

This invoker RPC still inherits current table grants/RLS. To enforce deactivated-cashier denial against **direct table** reads, change the existing `cashier_shifts_select_staff` SELECT policy in the same reviewed migration so its own-cashier branch requires an active Cashier profile. Review/reduce `anon` SELECT and authenticated write grants on this table as part of that approved permission change, checking all RPC dependencies first. An RPC alone cannot close the direct-read bypass. If the owner instead approves existing direct RLS access without stricter active-account semantics, a frontend-only paged `cashier_shifts` projection may suffice; document that access exception explicitly before implementing.

## Frontend after authorization

Add a separate historical fetch to `shiftApi.ts`; validate numeric and timestamp fields and fail closed on malformed rows. Keep server-fetched history separate from `CashierState.shifts` local cache so prototype/old browser rows cannot masquerade as authoritative. On fresh login, show only fetched closed records in an explicitly labeled historical section; retain the current open-shift flow. Provide loading, empty, retryable error, and next-page states. Show saved expected, actual, variance, reason, and closure time. Avoid locally derived `cashSales`, `gcashSales`, transaction count, and pending-at-close labels on historical rows. Do not hydrate closed-shift transactions from the open-shift RPC or recalculate snapshots from current receipts. Manager audit route requires `RequireAuth role="manager"` plus server authorization; a Cashier URL must never provide broader access.

## Threat model and tests

- Direct API call with another cashier UUID or forged route state: zero rows/42501; manager-only filter inaccessible to Cashier.
- Deactivated cashier/Manager, anonymous client, unrelated staff role, and stale role token: deny at database; validate against current active profile, not user-editable metadata.
- Excessive page size, negative/invalid date range, cursor manipulation, and enumeration: bounded results and stable ordering; no ID-based bypass.
- XSS/localStorage tampering: fetched rows carry an authoritative-source marker and are never trusted from browser persistence; clear history on logout/account switch.
- Later paid cancellation: saved shift row hash and saved expected/actual/variance unchanged; current receipt status may differ without historical restatement.
- Manila midnight/DST-independent date bounds, refresh/new browser, empty/error states, and role route gates: authenticated local browser plus same-database comparisons.

Use a **new disposable synthetic local stack** for authorization and browser regression, preserving all retained H-07/demo resources. Create two synthetic Cashiers and one Manager, close one shift with a deliberate cash variance, and run the later cancellation scenario separately. Prove isolated JWT/PostgREST and browser behavior as well as SQL RLS; inspect a full-row hash before/after read tests. Include rollback of the new migration's function/grants/policy/index in the deployment runbook, with a tested isolated restore and pre-change backup before any hosted change. Do not edit or squash the original 51 migrations. Hosted Supabase remains read-only until the separate release/recovery gates and explicit approval are satisfied.
