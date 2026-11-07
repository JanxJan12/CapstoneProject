# Defense demo reset and fallback — 14 October 2026

## Safe reset: use a fresh slot

The reset mechanism is **non-destructive**: it creates a second or third isolated stack, keeps every older volume and proof byte, starts with the same explicit demo-only fixture, then provisions new role accounts and fictional opening batches. It does not delete orders, reset sequences, overwrite a database, or change hosted data. Run it from the canonical checkout:

```powershell
.\scripts\demo\new-defense-demo-run.ps1 -Slot 2
.\scripts\demo\start-defense-web.ps1 -Slot 2
```

Slot 2 uses `127.0.0.1:62321` / `62322` and web `127.0.0.1:58441`; slot 3 uses `63321` / `63322` and web `58442`. The private role card is under the corresponding `.tmp/defense-demo-20261014-r2/` or `-r3/` directory. The script refuses a slot that already has a role card. Slot 2 was actually created and provisioned on 14 October; use slot 3 for another fresh rehearsal. Never point the first-slot tests or Rider APK at slot 2 without rebuilding/rechecking their fixed URLs.

Each slot has `before-demo-data.dump`, captured **before** Auth users, stock, or transactions, plus a SHA-256 in `demo-fixture-manifest.private.json`. It is an internal local snapshot, not a full independent disaster-recovery set: private Storage object bytes created later are not in that database dump. The current private runtimes, snapshots, and Docker volumes should all be preserved. To review a snapshot, hash it and compare with the manifest. Do **not** restore it over a running demo stack. A blank rerun should create a new named slot; after all three are used, engineering should add and review another distinct port/name pair before creating it.

Within a slot, `node scripts/demo/provision-defense-demo.mjs` is idempotent. For slots 2 or 3, set `$env:RRJ_DEMO_SLOT='2'` or `'3'` first. It verifies the exact local API and container, migration count, actual password sign-in, profile roles, private buckets, opening balances, and KDS secret. Each scenario test uses fresh UUID request IDs and unique proof paths. Avoid reusing previously consumed orders such as `ORD-000001`, `ORD-000008`, `ORD-000010`, `ORD-000012`, `ORD-000013`, or `ORD-000017` from slot 1; their state has already advanced. `ORD-000014` has an incomplete synthetic claim and `ORD-000015` remains a prior browser checkout; neither is a fresh scenario fixture.

The current Manager browser request `PR-20261014-000003` and linked Receiving `RR-20261014-462B83F3` are also consumed. The latter is posted and cannot be posted again. For a new live Manager sequence, prepare a new request and open its newly assigned Receiving number. Do not modify the posted rows to make an old identifier appear fresh.

The final Android APK is fixed to **slot 1**. `ORD-000013` was also consumed by the actual emulator delivery test. For another slot-1 Rider UI demonstration, run `node scripts/demo/create-emulator-offer.mjs` while slot 1 is healthy. It creates a new fictional Customer order, private synthetic payment proof, internal Cashier verification, KDS Ready state and one offer to the stable Rider; it stops before Rider acceptance. Do not run it as a supposed fresh-run reset, or reuse its resulting order number. A Rider demonstration against slot 2 or 3 needs a separately rebuilt and verified APK for that port.

## Pre-demo checklist

1. Verify Docker Desktop and the chosen named stack are running. Run the prepare command for that slot if containers are stopped; it preserves the existing volume. Confirm the web banner says **DEFENSE DEMO**.
2. Read the *private* role card locally and assign presenters by role. Hide it before screen sharing. Have a second browser profile for Customer and Cashier so sessions do not collide.
3. Open the menu, Manager Requests, Production, Cashier, KDS, and Rider web routes in that order. Keep the Cashier shift open before verifying a submitted payment. Do not use an earlier order that is already verified, rejected, released, or delivered.
4. Use a fictional reference such as `DEMO-<new UUID>` and a synthetic image. Verify that the payment-proofs bucket remains private. No real GCash account or customer address should be entered.
5. Save the selected slot number, newly created order number, request reference, and presenter timing to a private day-of-demo note. Do not record passwords or proof bytes in the public report.

## Failure handling

| Symptom | Safe response |
| --- | --- |
| API or Auth unavailable | Check Docker Desktop, exact demo container and port, then rerun `prepare-defense-demo.ps1 -Start -Slot N`. Preserve volumes. If this is a new slot, rerun provisioning. |
| No yellow demo banner | Stop; use `start-defense-web.ps1` instead of a normal Vite command. Check that the printed URL is one of the three local demo ports. |
| Wrong role or a session follows the last presenter | Sign out and use a separate browser profile; verify the role in the private card. Do not update a profile in the database during the presentation. |
| Cashier verification says a shift is required | Start a new local Cashier shift from its screen. Preserve the pending synthetic payment, then retry it once. |
| Payment already decided / KDS or Rider duplicate denied | That is an expected idempotency guard. Use a newly placed order and new request ID. Do not reset an order row or replay the same consumed test ID. |
| KDS invalid secret | Confirm the selected slot's private terminal ID and secret. The wrong-secret rejection itself is a useful authorization demonstration. |
| Menu unavailable | Check the fictional stock on the selected slot. Do not invent a restaurant count. Choose the pre-provisioned sample item; a new demo slot restores its fictional opening batch. |
| Realtime warning | Manual Refresh and API-backed actions were tested. Do not claim live push if the service is unavailable. |
| Browser/network failure on stage | Use curated screenshots and the presenter script, explicitly saying this is a recorded local fallback. Do not label screenshots as live proof. |
| Android emulator cannot reach backend | The built APK uses `10.0.2.2:61321`, valid only for slot 1 with host loopback forwarding. Switch to Rider web for the live workflow and mark Android interaction **NOT TESTED** or **BLOCKED**, as observed. |

## Fallback evidence order

Show the actual live role route first. If it fails, switch to `qa/defense-demo-browser-20261014/` for role/viewport screenshots, `qa/defense-customer-browser-20261014/` for checkout and delivered tracking, `qa/defense-browser-handoff-20261014/` for Cashier/KDS/release, `RRJ-Food-House-Rider/qa/rider-defense-20261014/browser-order-delivered-history.png` for Rider, and `qa/defense-cashier-browser-20261014/` for POS/receipt. `qa/DEFENSE-CONTINUOUS-BROWSER-ANDROID-20261014.json` records the same-order interface chain; the other JSON files record separate local API and emulator regressions. An older screenshot is historical evidence, never proof that a current live service works. OS printing, external payment settlement, physical Receiving, physical camera, hosted OAuth, and current restaurant stock remain outside this fallback.
