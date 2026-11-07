# Remaining local regression closure — 2026-10-14

`node qa/remaining-regression-closure-20261014.mjs` passed seven new, synthetic, same-database groups on the preserved unlinked stack at `127.0.0.1:56321`. Evidence: `qa/remaining-regression-closure-20261014.json`. It did not reuse consumed `ORD-000076`.

| Status | Case and evidence |
| --- | --- |
| **PASS** | New modified Customer `ORD-000083`: private synthetic payment image, customer denied Cashier verification, Cashier verified GCash submission, and stored Extra rice snapshot checked. No real GCash settlement occurred. |
| **PASS** | KDS v2 returned the same option name/price snapshot and Online channel; wrong terminal secret and duplicate Confirmed advance were denied; Confirmed→Preparing→Ready succeeded. |
| **PASS** | Cashier released the ready order; assigned Rider read its option under RLS, uploaded private synthetic proof, and completed delivery. |
| **PASS** | Separate new modified `ORD-000084`: Rider offer rejection succeeded; customer and duplicate Rider rejection were denied. |
| **PASS** | New modified walk-in `ORD-000085`: server sale/receipt and KDS Walk-in channel, Extra rice, “No onions” instruction, and authoritative price reconciled. |
| **PASS** | New GCash submission `ORD-000086`: customer rejection attempt denied; Cashier rejection succeeded with reason. |
| **PASS** | Cashier shift closed with zero variance; cash sales equaled walk-in sale, GCash sales equaled the two verified modified orders. |
| **PASS** | Fresh KDS browser tickets `ORD-000090` and `ORD-000091` rendered at mobile/tablet/desktop widths; Refresh focus, error/retry, browser walk-in advance, and duplicate denial passed. Screenshots and checks: `qa/kds-contract-browser-20261014/`. |
| **PASS** | The active `src/modules/cashier/services/supabaseOrderService.ts` now selects and maps `order_items.modifiers`, preserving the stored purchase-time snapshot and legacy `[]` items. `PaymentDetails.tsx` already displayed the mapped names. The final `node qa/cashier-browser-regression-20261014.mjs` run passed 13 authenticated browser checks: fresh `ORD-000112` visibly displayed Extra rice and was verified, `ORD-000113` was rejected with a reason, and stale repeat actions were denied. The receipt preview showed the modified line. Evidence: `qa/cashier-browser-regression-20261014/result.json`, `desktop-pending-modified.png`, `desktop-receipt-preview.png`. |
| **PASS** | The authenticated POS browser placed fresh modified cash walk-in `ORD-000114`. The server recorded `walk_in`, Extra rice at ₱35, the synthetic item note, ₱155 grand total, and a verified payment. The completed receipt drawer visibly showed that item, modifier, total, ₱1,000 tender, and ₱845 change (`qa/cashier-browser-regression-20261014/desktop-pos-after-submit.png`). The final script counted the persisted sale as check 13; its case-sensitive text flag for the receipt was false because CSS rendered the heading in uppercase, but the captured state was `receipt` and the screenshot shows it. The script now uses a case-insensitive heading check for future runs. |
| **PASS** | Cashier browser Shift Settlement truthfully blocked closure because other synthetic payments remained pending (`qa/cashier-browser-regression-20261014/desktop-shift-closure-blocked.png`). The separate isolated API shift closed with zero variance as recorded above. |
| **PASS** | `node qa/rider-modified-browser-20261014.mjs` opened a new assigned modified offer `ORD-000098` in an authenticated Rider browser, rendered Extra rice, and had no document overflow at 390×844, 768×1024, or 1440×900. Screenshots: `qa/rider-modified-browser-20261014/`. |
| **PASS** | Main typecheck/build/11 quality checks; unchanged Android source rechecked with typecheck and 8/8 tests. |
| **NOT TESTED** | OS print dialog or paper receipt, Android camera/gallery permission and proof, fresh Google sign-in, and physical-device/screen-reader use. The API/RPC and browser checks do not establish those hardware and hosted paths. |

Receipt creation, server fields, and browser preview passed; printing itself remains **NOT TESTED**. Android APK was built in the prior stage; Android source was not changed in this pass, so no new APK build is claimed. All new data and images are explicitly synthetic and confined to the isolated local stack. Hosted data and schema were untouched.
