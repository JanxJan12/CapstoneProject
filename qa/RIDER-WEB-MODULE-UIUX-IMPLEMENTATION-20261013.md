# Rider web UI/UX implementation — 2026-10-13

Active `/rider` implementation is `src/modules/rider/index.tsx`; the old files under `screens/` are disconnected and were not edited. The active app now checks the server-side Rider approval state before opening Home, Offers, History, or Profile. Pending, rejected, suspended, approved, loading, and error/retry states have distinct copy. The existing Rider RPC authority for availability, offers, status transitions, and proof completion is unchanged.

Order items now read the existing `order_items.modifiers` snapshot through Rider's assigned-order RLS and display selected names with special instructions in offers and active delivery. The directions screen says it opens the address in Google Maps and asks the Rider to check the route there. Camera/Gallery file inputs remain private proof uploads and are keyboard reachable with a visible focus state.

| Result | Evidence |
| --- | --- |
| PASS | `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run verify:quality` (11 checks). |
| PASS | `node qa/rider-web-browser-20261013/run-local.mjs`: isolated authenticated Rider pending, rejected, suspended, approved states and Home at 390×844, 768×1024, 1440×900 with no document overflow. The synthetic local identity was removed. |
| PASS | `node qa/remaining-modified-order-integration-20261013.mjs`: authenticated isolated Rider offer, accept, pickup, out-for-delivery, private proof upload, completion, and assigned-order RLS read of the `Extra rice` modifier snapshot. Evidence: `qa/remaining-modified-order-integration-20261013.json`. |
| NOT TESTED | Newly rendered modifier names on an assigned modified order in authenticated Rider browser; offer rejection branch; physical device, camera permission, live routing, and hosted behavior. |

Screenshots: `qa/rider-web-browser-20261013/desktop-pending.png`, `desktop-rejected.png`, `desktop-suspended.png`, `mobile-home.png`, `tablet-home.png`, and `desktop-home.png`.

No hosted writes or database migrations were made. Release remains blocked by the historical pristine replay failure at `20260904000000_inventory_phase_2a_recipe_deduction.sql`.
