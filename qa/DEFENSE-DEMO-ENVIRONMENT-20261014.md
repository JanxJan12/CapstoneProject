# RRJ’s Food-House defense environment — 14 October 2026

## What is running

The primary demonstration database is the unlinked local Supabase project `rrj_defense_demo_20261014`, with API `http://127.0.0.1:61321` and PostgreSQL `127.0.0.1:61322`. Its private runtime is `.tmp/defense-demo-20261014/` in the canonical checkout. The web presenter URL is `http://127.0.0.1:58440/auth` when `scripts/demo/start-defense-web.ps1` is running. All of these addresses are **loopback only**. The preserved test stack at `56321/56322`, hosted project `zhzluhqvysvsadwuugpa`, and their data were not used as demo write targets.

The demo database started empty with 51 current source migration files, one **demo-only synthetic prerequisite** from the prior diagnostic replay, and two historical compatibility variants confined to the private runtime. Its ledger has 52 entries. This is a functional demo build, **not** a clean replay of the unmodified historical 51-file chain. The latter still fails at Phase 2A with SQLSTATE `23503`. No original migration bytes were changed. The synthetic prerequisite digest is `57D22174104C0DA33DF06E51CDE404BA9BF881500D83A95F5CF6AAEEA75F257D`; it is not approved restaurant master data. The installed fixture began with 20 sample menu rows, 16 sample inventory identities, zero Auth users and zero orders. Provisioning added five role users, one KDS terminal, two private proof buckets, a `₱35` Extra rice option on the sample Fried Chicken Regular menu item, and fictional opening batches for four batch-managed sample inventory items. These names and quantities are **demo samples**; no line in this handoff claims that they are client-confirmed counts, prices, or recipes.

## Recreate and enter

From `C:\Users\Janmari\Downloads\Capstone Project` in PowerShell:

```powershell
.\scripts\demo\prepare-defense-demo.ps1 -Start
node .\scripts\demo\provision-defense-demo.mjs
.\scripts\demo\start-defense-web.ps1
```

The first two commands are fail-closed and rerunnable for the same stack. The third remains in the foreground; open the printed loopback URL in Chrome. The web launcher disables Vite environment-file loading in demo mode and passes only the checked local API and public client key. The client itself refuses demo mode when pointed outside the three approved local demo ports. A yellow **DEFENSE DEMO** banner must be visible on every web route. Stop presenting if it is absent.

The private account card is `.tmp/defense-demo-20261014/role-accounts.private.json`. It contains separate Customer, Manager, Production, Cashier, and Rider email/password pairs plus the KDS terminal ID/secret. It is gitignored, must stay on the presenter laptop, and must never appear on slides, screen share, screenshots, or in chat. The five logins are genuine local Supabase Auth password sessions with profile roles; the KDS uses its own verified terminal secret. The web password form is compiled into the demo build only. The ordinary Google buttons remain separate and Google OAuth is **not** claimed as tested by these local accounts.

Use separate browser profiles or sign out between roles. Show only a role-labeled card to each presenter, with the actual credential supplied privately. Guest-facing examples may say `defense-customer@example.invalid` / `[private password]`; the placeholder is deliberately not a usable credential. The KDS secret should be typed off-screen.

| Surface | Demo route | Account/gate |
| --- | --- | --- |
| Customer | `/auth?portal=customer` → `/customer` | Local Customer Auth |
| Manager | `/auth?portal=staff` → `/manager` | Local Manager Auth |
| Production | `/auth?portal=staff` → `/production` | Local Production Auth |
| Cashier | `/auth?portal=staff` → `/cashier` | Local Cashier Auth and open shift for payment verification |
| Rider web | `/auth?portal=rider` → `/rider` | Approved local Rider Auth |
| Kitchen | `/kitchen` | Private terminal ID and secret; no staff password |

The Rider Android source now has an emulator-only demo gate. Build it through `scripts/demo/build-rider-demo-apk.ps1`, which passes `http://10.0.2.2:61321` and the local public key to the bundle; it does not edit the Rider repo’s existing `.env.local`. The demo Gradle property enables cleartext HTTP only for this emulator APK; ordinary builds default to cleartext disabled. The build checks the packaged manifest and URL. `10.0.2.2` is the Android emulator’s host-loopback alias. A physical phone cannot reach the loopback-bound API using this address. A real handset demonstration would require a separately controlled LAN proxy/network configuration and a new verified build; that path is **NOT TESTED**.

The final installed artifact is `C:\Users\Janmari\Downloads\RRJ-Food-House-Rider\releases\rrj-rider-defense-demo-20261014-v4.apk` (SHA-256 `BA604E5E2E649652DDD7CF0C98FA2DC9458B8FF514FC06C6723859DF7ADE0168`). On the Android emulator it completed local password Auth, offered-order acceptance, pickup, transit, synthetic gallery proof upload, and delivered History on independent `ORD-000013` and continuous browser-created `ORD-000017`. See `qa/DEFENSE-ANDROID-DELIVERY-20261014.json` and `qa/DEFENSE-CONTINUOUS-BROWSER-ANDROID-20261014.json`. A new live demonstration requires a new synthetic offered order; `scripts/demo/create-emulator-offer.mjs` prepares one on slot 1 without accepting it. It must never be used as a real delivery or with a real photo.

## Isolation checks before presenting

1. `docker ps --filter name=rrj_defense_demo_20261014` shows only the named demo containers for this run. The API status must equal `http://127.0.0.1:61321`; never substitute the hosted URL.
2. The web launcher must show the yellow demo banner. The private proof buckets `payment-proofs` and `delivery-proofs` have `public=false`.
3. The before-data database snapshot and SHA-256 manifest live under `.tmp/defense-demo-20261014/`. Preserve that directory and the older test volumes.
4. Show synthetic one-pixel or otherwise invented payment and delivery proofs only. Never ask a guest to pay a real GCash account. No proof image means external settlement; the Cashier action records an internal verification decision only.
5. Do not display private recipe mappings, actual personal data, stored secrets, or the `.tmp` account card in presenter mode.

The public source repository has no Supabase service key or role passwords from this setup. The tested browser checkout shows `NO REAL ACCOUNT` and `DEFENSE DEMO — DO NOT PAY` in demo mode. Existing QA screenshot folders are curated in the readiness document; they show synthetic local content and no password fields. The full Customer/Cashier/KDS/Rider/Customer interface evidence is from fresh `ORD-000017` on Chrome and the emulator; `ORD-000013` is an additional independent Android Rider rehearsal.
