# Adviser manual E2E — Phase 1 environment gate

Date: 2026-10-29. **No manual transactions started.** This report will be extended only after the isolated frontend and Android loopback are verified. Hosted and emulator sessions were preserved.

## Phase 1 result

| Prerequisite | Status | Current evidence |
| --- | --- | --- |
| Isolated Supabase backend | **PASS** | Unlinked current-contract stack at `http://127.0.0.1:65221`; Docker database healthy; Auth and REST HTTP 200. Local CLI confirms the exact API URL and an anon key exists. |
| Isolated frontend | **BLOCKED** | No listener on `127.0.0.1:5175`. The existing `dist` JS and `.env.local` target hosted `zhzluhqvysvsadwuugpa.supabase.co`. Do not use default Vite or `dist` for synthetic transactions. |
| Android loopback bridge | **BLOCKED** | No listener on `127.0.0.1:61321`. The existing local Rider demo APK requires `10.0.2.2:61321`. |
| Rider Android isolated device | **BLOCKED** | Only `Pixel_8_Pro` (`emulator-5554`) is connected; its existing production Rider installation/session was not changed. The dedicated isolated demo data image exists but is not running. |
| Local test identities | **PASS — availability only** | Private local fixture file identifies Customer, Cashier, Manager, Rider, and KDS terminal credentials, without exposing them here. Local Auth has four users and one KDS terminal. No sign-in was attempted. |
| Fresh synthetic order prerequisite | **CONDITIONAL** | Local fixture has one available active menu item, positive active inventory, and an open Cashier shift. Its one existing order is already Delivered. Prior [current-contract isolated rehearsal](CAPSTONE-INT-01-CURRENT-CONTRACT-ISOLATED-20261028.md) passed the signed-quote-to-delivery chain. A **new** quote/order was not executed in this gate, so end-to-end order creation remains NOT RUN. |

APK targets were verified from embedded JS bundles without printing keys: the 29 Oct internal Rider `android/app/build/outputs/apk/release/app-release.apk` targets hosted Supabase (SHA-256 `3B0E09CCD2EF32F8741471C4DA52518F0B5E8FD0ECB4BA6D4F7C2A7E465A91DC`); `.tmp/current-contract-integration-20261028/rrj-rider-local-internal-20261028.apk` targets `10.0.2.2:61321` and contains no hosted project reference (SHA-256 `09B134FCBD370E805D46ECFBE89266CF58928B5A0D6CA5F7FE79A9DF36CD2392`). The older locally installed production package on Pixel was not replaced.

The previous readiness check's attempt to launch the local bridge and Vite service was **rejected by automatic approval review**. No alternate launcher was used. A human operator should start those two local services using the guarded instructions provided separately, then request a fresh target check **before** manual sign-in or order creation.

## Scenario execution

Cashier, KDS, Rider, Manager, and integration manual scenarios: **NOT RUN**. Screenshots, new IDs, defects, and final demo decision are pending the environment gate. Existing historical PASS results are evidence only, not results for this run.

## Later Cashier walkthrough (separate from the Phase 1 isolated gate)

The subsequent user-led Cashier walkthrough and its pending backlog are recorded in [Cashier manual findings and backlog, 30 Oct 2026](CASHIER-MANUAL-FINDINGS-20261030.md). Its reported hosted walk-in cash sale must not be counted as a pass for the isolated E2E scenario above. Kitchen/KDS handoff and the other cross-module scenarios in this report remain **NOT RUN**.
