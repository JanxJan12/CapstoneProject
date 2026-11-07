# Adviser demo readiness — 29 October 2026

**Recommendation: CONDITIONAL GO for an evidence-backed walkthrough. Live current-contract Customer → Cashier → KDS → Rider execution is NOT READY in the present workstation state.** This check was read-only; no application action, hosted write, migration, deployment, dependency install, rebuild, session reset, or delivery action occurred.

## Current environment and preservation

| Surface | Current observation | Boundary |
| --- | --- | --- |
| Main web source | `Capstone Project` at `9748bde`, with **331 pre-existing worktree entries**. `dist/index.html` is dated 28 Oct; its JS contains the hosted project reference. `.env.local` points to `https://zhzluhqvysvsadwuugpa.supabase.co`. | Default local Vite/`dist` must be treated as **hosted**, even on localhost. No web build or source edit was made. |
| Rider source/build | Standalone Rider folder has no `.git`. Current internal `android/app/build/outputs/apk/release/app-release.apk` is dated 29 Oct, SHA-256 `3B0E09CCD2EF32F8741471C4DA52518F0B5E8FD0ECB4BA6D4F7C2A7E465A91DC`; its JS bundle contains the hosted project reference. | Build was identified, not installed. The Pixel 8 Pro still has the older production package installation dated 20 Oct. Existing session was untouched. |
| Isolated backend | Unlinked current-contract Supabase containers are healthy on `127.0.0.1:65221` (API) and `65222` (database); Auth and REST health return HTTP 200. Read-only counts: 4 local Auth users, 1 order, 1 payment, 1 Rider, 1 Cashier shift, 1 KDS terminal, 1 inventory item, **0 request documents and 0 receiving reports**. | This is the previously verified synthetic fixture from [CAPSTONE-INT-01 current-contract rehearsal](CAPSTONE-INT-01-CURRENT-CONTRACT-ISOLATED-20261028.md). Its existing order was completed; do not replay it as a new transaction. |
| Isolated web/Android | The required `61321 → 65221` loopback bridge and `127.0.0.1:5175` Vite instance are **not listening**. A separate local Rider APK exists in `.tmp/current-contract-integration-20261028/`, SHA-256 `09B134FCBD370E805D46ECFBE89266CF58928B5A0D6CA5F7FE79A9DF36CD2392`; its JS bundle contains `10.0.2.2:61321` and no hosted project reference. | That APK is a 28 Oct internal demo build, separate from the latest 29 Oct production build. Its dedicated demo emulator is not running. The only connected emulator is `Pixel_8_Pro` (`emulator-5554`); its authenticated installation was preserved. |
| Browser | Existing Chrome window is a Supabase dashboard, not a Rider or capstone app screen. Computer-use browser access reports “browser access host is unavailable.” | No Customer, Cashier, Kitchen, or Manager browser screen was opened in this check. No browser authentication was attempted. |

The CLI confirms the local API is `127.0.0.1:65221`; the web client allows defense mode only with `127.0.0.1:61321`, `62321`, or `63321` (`src/lib/supabase.ts`). The older `scripts/demo/start-defense-web.ps1` targets a different demo slot and **must not** be assumed to start this current-contract stack. Automatic approval review rejected the attempted bridge/Vite launcher, so it was not retried by another method. The local backend can be reused for read-only evidence, but the full interactive demo needs explicit preparation and target verification before sign-in.

## Focused module status

| Module | Status | What is demonstrable now |
| --- | --- | --- |
| Customer | **CONDITIONAL** | The 28 Oct isolated API run passed signed quote, order, payment proof, and Delivered ownership for one synthetic order. Current browser UI/data load **NOT RUN**; local web absent. |
| Cashier | **CONDITIONAL** | The same isolated API run passed payment verification and release/offer. One local shift exists. Current browser UI/data load **NOT RUN**. |
| Kitchen/KDS | **CONDITIONAL** | Local terminal API passed queue and Confirmed → Preparing → Ready. One terminal exists. Current browser UI/terminal sign-in **NOT RUN**. |
| Manager | **CONDITIONAL** | Historical isolated Manager request/Receiving evidence exists in [14 Oct readiness](DEFENSE-DEMO-READINESS-20261014.md). This current fixture has no request or receiving records; current Manager browser UI/data load **NOT RUN**. Use historical evidence with its date, not a live claim. |
| Rider Android | **CONDITIONAL** | [28 Oct local Rider screenshots](capstone-int-01-current-contract-20261028/rider-offer.png) and the rehearsal report show one actual isolated emulator delivery. The current connected Pixel has the production package and preserved session; the separate local demo emulator is not running. Current local Android UI **NOT RUN**. The [29 Oct Today visual acceptance](../../RRJ-Food-House-Rider/qa/RIDER-TODAY-VISUAL-03-20261029.md) is synthetic/offline only. |

**No module earned READY from a fresh rendered screen in this check.** The 28 Oct integration PASS is prior local authenticated API/Android evidence, not a new browser or hosted PASS. The older 14 Oct continuous browser-to-Android run predates current quote/modifier contracts and cannot be represented as the current live flow.

## Presenter sequence: reliable fallback for today

Keep the private local role card, terminal secret, payment proof bytes, and any hosted credentials off the projector. Do not use the default hosted-targeting web build to create demo orders.

| Order | Screen/evidence to show | Role needed if a verified isolated web session becomes available | Expected explanation |
| --- | --- | --- | --- |
| 1 | This readiness sheet and the [current-contract rehearsal](CAPSTONE-INT-01-CURRENT-CONTRACT-ISOLATED-20261028.md), environment section | None | Identify the isolated API, synthetic accounts, and difference between recorded evidence and live UI. |
| 2 | Customer `/customer` only on a verified `127.0.0.1:5175` demo build; otherwise the rehearsal's quote/order/payment results | Local synthetic Customer | Signed server quote created the one recorded synthetic order; proof was an internal payment claim, not a real transfer. |
| 3 | Cashier `/cashier` Pending Payments/Orders only on the verified isolated build; otherwise the recorded verification/release results | Local synthetic Cashier with local shift | Verification moved the recorded order into the kitchen path; release later produced its Rider offer. |
| 4 | Kitchen `/kitchen` only on the verified isolated build; otherwise the recorded KDS result | Local KDS terminal credential | The recorded order advanced Confirmed → Preparing → Ready through terminal API. |
| 5 | [Rider offer](capstone-int-01-current-contract-20261028/rider-offer.png) → [accepted](capstone-int-01-current-contract-20261028/rider-accepted.png) → [proof screen](capstone-int-01-current-contract-20261028/rider-proof-screen.png) → [completed](capstone-int-01-current-contract-20261028/rider-completed.png) | Local synthetic approved Rider only if the dedicated emulator is separately prepared | These are **recorded 28 Oct isolated Android screens**, not a live delivery today. Proof was a synthetic gallery image. |
| 6 | Return to the rehearsal's Delivered/stock reconciliation table | Local synthetic Customer if live | One Delivered order, verified internal payment, one private proof object, one issuance; fictional stock moved 100 → 98 pcs. |
| 7 | [14 Oct Manager readiness](DEFENSE-DEMO-READINESS-20261014.md) request/Receiving row; optionally explain the current Manager `/manager` route without opening it | Local synthetic Manager only on a verified isolated build | Manager request and partial Receiving were demonstrated in an **older** isolated fixture. Current fixture has no request/receiving row. |

If the isolated web and dedicated emulator are later prepared, use **separate local Customer, Cashier, Manager, Rider and KDS identities** from the private local account card. The existing current-contract record is `ORD-000001` and is already Delivered. It is suitable for history/read-only explanation, not fresh checkout or offer actions. A new live lifecycle would require new synthetic local records and a separate deliberate rehearsal; this readiness check did not create them.

## Before any optional live interaction

1. Have the operator restore the **loopback-only** `61321 → 65221` bridge and start Vite on `127.0.0.1:5175` with `RRJ_DEFENSE_DEMO=1`, `VITE_DEMO_MODE=true`, local URL `http://127.0.0.1:61321`, and the local **anon/publishable** key obtained directly from the local CLI. Do not use `.env.local`, the existing `dist`, or the older demo launcher. Confirm the served client contains only the local target and displays the synthetic demo banner **before** local sign-in. The automatic approval review blocked this launch during this check, so these are prerequisites, not completed steps.
2. Start the dedicated isolated Android data image and install/verify the 28 Oct **local** demo APK there only. Keep `Pixel_8_Pro` and its production Rider session untouched. Verify the emulator can reach `10.0.2.2:61321` before local Rider sign-in.
3. Open `/auth`, `/customer`, `/cashier`, `/kitchen`, and `/manager` as appropriate; verify each role's data load. Do not put private local credentials on screen. If any route, backend target, or role fails verification, fall back immediately to the recorded evidence sequence above.

**Emergency recovery:** Refresh a failed read-only web page once after checking both `5175` and `61321`; do not switch to the default hosted instance. If the dedicated emulator fails, show the four recorded Rider images. If the local backend fails, stop live actions and use the 28 Oct report; do not reset the fixture or point a demo client at hosted Supabase. If a session expires, have the owner sign in manually using the private local role card; do not clear existing emulator data.

**Overall: CONDITIONAL GO for an honest, evidence-backed adviser walkthrough. Live current-contract E2E: NOT READY.** No new PASS was inferred from historical results.
