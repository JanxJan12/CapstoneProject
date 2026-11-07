# CAPSTONE-INT-01 current-contract isolated rehearsal — 28 October 2026

## Scope and environment

This is one synthetic, unlinked local contract journey. It used only API `127.0.0.1:65221` (through a loopback bridge on `61321` for the Rider app), local web `127.0.0.1:5175`, a separate `RRJ_Current_Contract` Android emulator data image, and the October 27 **schema-only** backup. No hosted Supabase endpoint or business row was used. The older `rrj_track_a_targeted_20261026` containers were stopped; their volume was preserved. The original signed Rider app and its AVD data were preserved.

The backup contains no business rows. The disposable fixture added four `@example.invalid` Auth users (Customer, Cashier, Manager, Rider), one approved Rider, one synthetic menu item with a 2-pc recipe, one inventory item with 100 pcs, a KDS terminal, private proof buckets, a random quote signing key, and the backup's eight exact `storage.objects` policies. This is **not** a clean chronological migration replay or hosted schema parity proof.

The current Rider source built as an internal debug-signed APK with `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:61321` and demo sign-in. The installed APK's JS bundle contained that local address and no hosted Supabase project hostname. Rider typecheck and 21/21 tests passed. Vite's served Supabase client used `127.0.0.1:61321` and no hosted URL. The Rider app rendered the defense-demo banner. No product source module or migration file was changed; all database mutations occurred in the new local fixture. Private scripts, credentials, AVD data, and APK are under `.tmp/current-contract-integration-20261028/`.

## Same-ID results

| Check | Result | Observed evidence |
| --- | --- | --- |
| Customer signed quote and accepted writer | **PASS — local authenticated API** | `quote_customer_order` returned a signed token; `place_customer_order_confirmed` created `ORD-000001`, order `2da371ac-0fb0-4da6-89f1-8df4b8ccc45a`. Subtotal ₱120 + delivery ₱50 = ₱170. |
| Customer private proof and payment submission | **PASS — local authenticated API/Storage** | One private payment proof upload; `submit_customer_payment` created payment `671edd60-40a5-4644-b459-a3f307ced3b0`, initially pending. The GCash reference is fictional; no external transfer occurred. |
| Cashier verification | **PASS — local authenticated API** | An active synthetic Cashier shift verified that same payment; it became `verified` and the order became `confirmed`. |
| KDS | **PASS — local authenticated terminal API** | `get_kds_queue_v2` contained that order. `advance_kds_order` moved it `confirmed → preparing → ready`. |
| Cashier release and offer | **PASS — local authenticated API** | `release_ready_order` and `offer_order_to_next_rider` produced assignment `0d496209-b602-4a3f-bc99-cd95255f7dc0`, offered to the fixture Rider. |
| Rider Android lifecycle | **PASS — isolated emulator UI** | Current internal APK signed in to local Auth, displayed `ORD-000001`, and accepted, picked up, started, and completed delivery with a synthetic photo selected through Android's picker. The dashboard then showed one completed delivery. |
| Customer ownership and reconciliation | **PASS — local authenticated API/SQL** | The same Customer can read the Delivered order and payment. Assignment is `delivered`, proof object count is 1, payment remains `verified`, and one `issuance` inventory transaction changed the ingredient from 100 to 98 pcs (`-2`). Status history ends in `delivered`. |
| Customer, Cashier, and Kitchen browser screens | **NOT RUN** | The local web server was verified reachable and configured for the local API, but browser actions were not executed. This run proves their authenticated server contracts, not rendered browser acceptance. |
| Hosted, real payment, physical delivery, push/Realtime, map/GPS | **NOT RUN** | The minimal local stack excluded Realtime/push services; the Rider screen showed “Updates paused” and refreshed explicitly. The synthetic destination had no valid map pin. No real money, courier, or hosted data was involved. |

The local status trail was `waiting_payment_verification, waiting_payment_verification, confirmed, preparing, ready, waiting_for_rider, rider_accepted, picked_up, out_for_delivery, delivered`. The duplicate initial waiting status reflects the recorded order/payment events and was not treated as a second order. There was exactly one order-linked inventory issuance and one delivery assignment for this order.

Android evidence: [local Rider sign-in](capstone-int-01-current-contract-20261028/rider-signed-in.png), [same order offered](capstone-int-01-current-contract-20261028/rider-offer.png), [accepted assignment](capstone-int-01-current-contract-20261028/rider-accepted.png), [proof picker state](capstone-int-01-current-contract-20261028/rider-proof-screen.png), and [one completed delivery](capstone-int-01-current-contract-20261028/rider-completed.png). The private journey script and `journey-state.json` in `.tmp/current-contract-integration-20261028/` retain the exact IDs and replay guards.

## Fixture recovery during execution

The first quote returned a null token because a schema-only backup correctly omitted the private signing-key row. A random key was inserted only into the disposable local fixture. The first proof upload was denied because a fresh local Storage service lacked the backup's `storage.objects` policies; the eight exact policy definitions were restored to the local fixture. No product-source change was inferred from either fixture gap. After these fixture corrections, the same order completed the journey above.

The local proof image was a screenshot of the synthetic Rider offer, selected to exercise the app's picker/upload path. It does not attest to a physical handoff. The internal APK is debug-signed and is not a production release artifact.
