# Cashier database simplification — 1 November 2026

**Status:** implemented and tested locally. Hosted schema and business data were not changed.

## Change

`20261031184718_cashier_retire_unused_shift_approval_storage.sql` removes `cashier_shifts.manager_approved_by` and `manager_approved_at`. The obsolete `manager_approved_by` profile FK leaves with its column. The active Cashier close workflow never writes either field, and the current-schema source used for the disposable clone had zero stored approval values. The migration locks the shift table, requires both columns and the expected FK/RPC definition, and aborts if any row contains approval data. It uses no `CASCADE`.

The historical `get_closed_cashier_shifts` RPC retains the same signature, return columns, cashier/manager authorization, owner filter, pagination, and saved financial fields. Its two approval return fields now contain typed nulls. The unused application type fields were removed. Financial, receipt, payment, refund, and shift settlement storage and write functions were not changed. The older `get_current_shift_walk_in_sales()` remains because prior evidence shows external API traffic without client attribution.

## Exact current-schema catalog delta

| Public catalog measure | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Tables | 36 | 36 | 0 |
| Columns | 414 | 412 | 2 |
| Function identities | 131 | 131 | 0 |
| Triggers | 43 | 43 | 0 |
| Foreign keys | 80 | 79 | 1 |
| Indexes | 134 | 134 | 0 |
| RLS policies | 19 | 19 | 0 |

Counts are from a schema-only `auth`/`public` copy of the existing current-contract PostgreSQL database. Restore reported one harmless `public schema already exists` error; the expected 36 tables/414 columns and target objects were present before migration. ACLs were not restored, so relevant grants were supplied only inside the disposable database for role tests. These numbers are a local current-schema comparison, not a hosted reduction.

## Verification

- Migration applied on two disposable current-schema databases with `ON_ERROR_STOP=1`, including the final version with an exclusive table lock and exact RPC drift guard.
- A synthetic row with `manager_approved_by` set made the migration abort. Its transaction rolled back, leaving both columns and no fixture row. With that row absent, migration applied.
- `verify_cashier_p1_security_hardening.sql` passed: pending GCash blocked shift closure, cashier/manager authorization and cross-owner denials remained, and the fixture rolled back.
- `verify_cashier_shift_approval_retirement.sql` passed: saved opening/expected/actual/variance values and historical RPC shape remained, Cashier A could not read Cashier B history, and a Customer was denied. The fixture rolled back.
- Typecheck, production build, OPT-05 shift regression, and FIN-01's 23 settlement scenarios passed. These are local synthetic checks; signed-in browser journeys and hosted financial mutations were not run.

## Files changed for this task

- `supabase/migrations/20261031184718_cashier_retire_unused_shift_approval_storage.sql`
- `supabase/tests/verify_cashier_shift_approval_retirement.sql`
- `supabase/tests/verify_cashier_shift_approval_retirement_guard.sql`
- `src/modules/cashier/types.ts` (two unused fields removed; pre-existing edits preserved)
- `qa/CASHIER-DB-SIMPLIFICATION-20261101.md`
