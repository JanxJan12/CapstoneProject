# KDS modifier and channel contract completion — 2026-10-14

## Change

Added `supabase/migrations/20261013162631_kds_queue_modifier_channel_v2.sql`. `get_kds_queue_v2(uuid,text)` calls the unchanged terminal-authorized v1 function and enriches only its returned tickets with `orders.order_channel` and each `order_items.modifiers` purchase-time JSON snapshot. The v2 function has a fixed empty search path, explicit object names, `SECURITY DEFINER`, and explicit `anon`, `authenticated`, and `service_role` execution grants matching v1. No table SELECT grant or new table was added. It was applied directly to the preserved **unlinked local** stack at `127.0.0.1:56321` for runtime testing; this direct installation does not establish migration-ledger replay.

The active `kdsTerminalService.ts` calls v2, maps legacy missing/empty modifiers to `[]`, and passes channel to `KitchenQueue.tsx`. Tickets display Online/Walk-in alongside fulfillment type, selected option names and price snapshots, item instructions, and order instructions. Existing queue error/retry, refresh, loading, and duplicate advance guards were preserved.

Changed source: `supabase/migrations/20261013162631_kds_queue_modifier_channel_v2.sql`, `src/modules/kitchen/services/kdsTerminalService.ts`, and `src/modules/kitchen/queue/KitchenQueue.tsx`. Added rollback-only contract test `supabase/tests/verify_kds_queue_v2_local.sql` and the two one-shot KDS browser/fixture scripts under `qa/`. Migration version `20261013162631` was installed as SQL on the local stack; it has **not** been proven through the migration ledger or deployed to hosted Supabase.

## Evidence

| Status | Check |
| --- | --- |
| **PASS** | `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run verify:quality` (11 checks). |
| **PASS** | Rollback-only `supabase/tests/verify_kds_queue_v2_local.sql` as `anon`: v1/v2 ticket counts match; online and walk-in Extra rice snapshots are present; legacy `[]` projects; sensitive order/payment fields are absent; wrong secret is denied. |
| **PASS** | `node qa/kds-browser-ticket-setup-20261014.mjs` prepared fresh synthetic local Customer `ORD-000090` and walk-in `ORD-000091` tickets for the final browser run. |
| **PASS** | `node qa/kds-contract-browser-20261014.mjs`: ten checks. Invalid terminal secret denied, v1 shape/ticket set preserved, v2 option/channel displayed on both real local tickets, focusable Refresh, network-error state cleared stale tickets and Retry recovered, no document overflow at 390×844, 768×1024, 1440×900, browser drove walk-in Confirmed→Preparing→Ready, and duplicate advance was denied. |
| **PASS** | `supabase/tests/verify_customer_modifiers_local.sql` completed both rollback-only blocks on the isolated local schema. |
| **NOT TESTED** | Hosted migration/application, physical kiosk, screen reader, and offline timing. |

Evidence JSON: `qa/kds-contract-browser-20261014/result.json`, `qa/kds-browser-ticket-setup-20261014.json`. Screenshots in `qa/kds-contract-browser-20261014/`: `mobile-customer-ticket.png`, `mobile-walk-in-ticket.png`, corresponding tablet/desktop captures, and `desktop-terminal-gate.png`. The local screenshots visibly show Extra rice (+₱35.00), the item price, Online/Walk-in channel, and the walk-in “No onions” note. No hosted request or mutation was made.

Safe fallback is to point the KDS client back to existing v1; this removes channel/modifier display until v2 is available. Retire v2, if needed, with a reviewed forward migration. Do not alter v1 or historical migration bodies.
