# Historical migration reproducibility — 2026-10-14

**Decision: FAIL / BLOCKED.** One new, unlinked disposable replay of the current 51-file chain failed at `20260904000000_inventory_phase_2a_recipe_deduction.sql`, statement 0, SQLSTATE `23503`, constraint `menu_ingredients_inventory_item_id_fkey`. All copied SQL files matched canonical source by SHA-256. The failure summary is `C:\Users\Janmari\Downloads\RRJ-Migration-Replay-20261014-51\replay.log`; raw CLI SQL diagnostics were removed to avoid disclosing recipes. Supabase CLI 2.120.0 stopped only that disposable stack. Neither the preserved `127.0.0.1:56321` stack nor hosted `zhzluhqvysvsadwuugpa` was modified.

## Root cause and provenance

- Phase 2A is migration 13 of 51 and inserts 18 recipe relationships requiring 10 menu IDs and 12 inventory IDs. None of these literal IDs occurs in the 12 earlier migration files. The earliest `20260825183637_remote_schema.sql` is DDL/schema, not a master-data export. Its foreign keys are already present before Phase 2A.
- `supabase/seed.sql` does not exist. Even if added, [Supabase's seed order](https://supabase.com/docs/guides/local-development/seeding-your-database) runs it **after** migrations, too late for Phase 2A.
- Git history contains the Phase 2A reference but no versioned insert for the missing inventory ID. A read-only query found that ID as a Chicken/kg row in the preserved isolated local database, with creation timestamp preceding Phase 2A. It is unsourced local data, not an approved business baseline. Its balance was not copied or used.
- `20260923000000_inventory_po_semantics_foundation.sql` later demands exactly one Chicken/kg row. `20260914000000_harden_numeric_inputs.sql` has two unqualified `cashier_shift_status` return fields, an independent later compatibility issue. Neither was reached in the pristine replay.

`node scripts/check-clean-migration-prerequisites.mjs` is a read-only deterministic gate. It found 10 missing menu IDs, 12 missing inventory IDs, and two later unqualified enum fields; it exits 1 with `BLOCKED`. It prints counts, not recipe formulas. This gate does not replace a real replay.

## Remediation decision required

The data owner must provide or explicitly approve a provenance-backed historical master-data baseline covering the exact menu and inventory identities and reviewed recipe mappings, with source, approver, date, and checksum. Opening stock stays zero unless separately supported by an approved physical opening record. That baseline must be applied **before** Phase 2A in a new-environment bootstrap plan, without changing already-applied migration bodies. Engineering must review a history-safe treatment for the two later enum return fields. A post-Phase-2A migration, placeholder row, disabled FK, migration repair, or skipped file would conceal the defect.

After approval: prepare a controlled pre-Phase-2A bootstrap artifact and manifest; replay all canonical migrations once on another empty unlinked stack; compare recorded versions, source hashes, roles/RLS/RPCs/constraints with the preserved tested local schema; then run the fresh synthetic API/Auth/Storage matrix. No such success is claimed today.
