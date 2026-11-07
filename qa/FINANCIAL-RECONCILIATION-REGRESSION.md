# H-07 isolated financial reconciliation and regression

**Executed:** 2026-10-14. **Environment:** fresh `.tmp/h07-financial-20261014` Supabase project, database `supabase_db_rrj_h07_financial_20261014` on loopback port 57322. Its migration ledger contained 52 **diagnostic-only** versions: one synthetic historical prerequisite and a copied source chain with the already documented numeric-input compatibility variant. The original 51 source migrations were not edited or replayed as a clean installation. Four SQL test scripts under that runtime use `BEGIN`/`ROLLBACK`; the immediate postcheck found zero `H07-%` orders, zero H-07 synthetic Auth users and zero H-07 settlement rows. A **later** browser setup persisted one synthetic Cashier account and two synthetic date-boundary receipts in this new disposable stack; it did not use a preserved demo stack or hosted database.

## Aggregate scenario result

`reconcile.sql` seeded 12 synthetic orders of distinct states; direct status seeds were for reporting reconciliation, while the two cancellation actions used the actual RPCs. All amounts below are PHP and contain no business/customer record.

| State / invariant | Expected | Observed | Result |
| --- | ---: | ---: | --- |
| Unpaid waiting, pending, rejected are excluded from collected and fulfilled sales | 0 contribution | 0 | **PASS** projection; rejection transition tested separately |
| Pending payment count | 1 | 1 | **PASS** |
| Verified payments on all currently paid orders | 1,020 | 1,020 | **PASS** |
| Paid but not fulfilled confirmed order | 140 collected, 0 fulfilled sales | 140 / 0 | **PASS** distinct grain |
| Six fulfilled paid orders, including delivery and walk-in | 880 total | 880; report `total_orders=6` | **PASS** |
| Fulfillment date split at Manila midnight | prior day 250; current day 630 | 250 / 630 | **PASS** |
| Dashboard current-day fulfilled sales | 630 | 630 | **PASS** |
| Dashboard created-today orders includes unpaid and cancelled | 7 | 7 | **PASS** as currently defined |
| Paid cancellation voids original payment/receipt and creates one settlement; exact retry does not duplicate | 170 voided, one settlement | 170 / one | **PASS** |
| Ordinary cancellation of paid order denied; unpaid cancellation succeeds | deny / cancelled | deny / cancelled | **PASS** |
| Shift closing uses completed verified receipts across shift dates, including unfulfilled, excluding voided | cash 830, GCash 190, seven receipts | 830 / 190 / seven | **PASS** |
| Expected cash and deliberate variance | opening 50 + cash 830 = 880; actual 675; variance −205 | 880 / −205 | **PASS** |

The ₱1,020 current verified collection total and ₱880 Manager report total differ by exactly the ₱140 paid but unfulfilled order. The dashboard's ₱630 today is the fulfilled portion dated today; it is not receipt-day collections. The direct seed intentionally contains no `order_items`, so `top_item_name=null` and top-item correctness is **NOT TESTED**.

`payment-flow.sql` exercised actual `submit_customer_payment`, `reject_customer_gcash_payment`, resubmission and `verify_customer_gcash_payment` RPCs. **PASS:** first pending submit and exact retry kept one payment/no receipt; rejection kept no receipt; same-path resubmission was denied; new-path resubmission reused payment identity; verification created one receipt/confirmed order; same request replay returned the same receipt; a different request was denied. Storage objects were synthetic **metadata stubs only**, with no proof bytes. This proves the RPC state/identity logic under database-simulated `auth.uid()`, not real Storage upload, proof inspection, HTTP JWT behavior, or external GCash settlement.

`pos-flow.sql` exercised `create_walk_in_sale` against one temporary synthetic menu item. **PASS:** Customer role denied, Cashier/open shift created exactly one order/payment/journal, server priced ₱75, cash tender ₱100 returned ₱25 change, and same-request retry retained identities. The item had no recipe, so inventory consumption and genuine configured-menu availability are **NOT TESTED** by this POS case.

`closed-shift-refund.sql` closed a shift containing one GCash receipt, then exercised the permitted Manager paid cancellation. **PASS:** closed shift remained closed and expected cash remained ₱20, while current completed receipt count changed from one to zero. This is a **confirmed historical projection/snapshot divergence**, not a corrupted row: the closed shift is a settlement snapshot, whereas current Cashier history and its local shift totals derive from today's transaction statuses. The owner must decide presentation and accounting treatment before backend change.

## Frontend date correction regression

**Confirmed source defect H-07A:** `useCashierMetrics` used browser-local date components; `useOrderList` and `useTransactionHistory` compared a UTC ISO prefix to local date inputs. At `2026-10-13T16:00:00Z`, Manila is already October 14, so a UTC-prefixed transaction could appear on the wrong day. `utils/exportUtils.ts` now offers `manilaDate`; the Cashier today metric, order/history filters and date-dependent export filenames use it. This matches the Manager SQL's Manila calendar without changing financial RPCs, stock, cancellation or shift logic.

**PASS:** `npm.cmd run typecheck`; `npm.cmd run build`; direct runtime assertions for UTC 15:59:59/16:00:00 and next-day boundaries returned the correct four Manila dates. The earlier local Chrome attempt hit the existing demo-mode port guard, left unchanged, and a later attempt was interrupted by Docker Engine HTTP 500. On 2026-10-14, read-only `docker info` returned Server 29.8.2 and the H-07 DB container inspected as running/healthy. No container, volume or stack was reset, removed or rebuilt. The cause of the transient Engine error is **unconfirmed**; availability recovered without an intervention.

### Authenticated rendered-browser acceptance — local PASS

Fresh headless Google Chrome loaded loopback Vite `127.0.0.1:58447` in normal non-demo mode, signed in to local GoTrue as a synthetic active Cashier, and read the existing H-07 database through loopback Supabase `127.0.0.1:57321`. This was a real rendered application session with its local PostgREST/RPC data, not a mock screenshot. Its fixture account card remains private under `.tmp/h07-financial-20261014`; no credential is included here. The browser requested Google Fonts, but those URLs were blocked in Chrome; no nonloopback HTTP response was observed. A harmless missing local favicon returned 404. A transient local Realtime transport error appeared in an earlier run; the final run rendered without the live-update banner. Realtime availability was not an acceptance target.

| Browser check / exact assertion | Result |
| --- | --- |
| Dashboard loaded under authenticated Cashier and showed expected drawer ₱30 from the two synthetic completed cash receipts | **PASS**; the active Dashboard has no rendered “Sales Today” card or date selector, so that older component's today navigation is **NOT TESTED** |
| Transaction History unfiltered | **PASS**; 2 linked records, ₱30 total |
| Date range from/to `2026-10-14` (Manila Today on test date) | **PASS**; only `H07-BROWSER-after`, 1 completed receipt, Revenue/Cash ₱20 |
| Date range from/to `2026-10-13` | **PASS**; only `H07-BROWSER-before`, 1 completed receipt, ₱10 |
| Date range `2026-10-13` through `2026-10-14` | **PASS**; both linked records |
| Order List date range for each Manila date | **PASS**; each range showed only the corresponding persisted order; the on-page Refresh preserved the prior-day result |
| Full browser reload, Dashboard → Transaction History → Dashboard navigation | **PASS**; authenticated route and unfiltered two-record history recovered after reload |
| Financial state before/after all browser actions | **PASS**; MD5 of ordered full-row JSON for the two orders, their payments, cashier transactions and linked shift was identical; no scoped financial row changed |

Authoritative database comparison (read-only SQL over the **same local database**): `cashier_transactions.created_at AT TIME ZONE 'Asia/Manila'` puts `H07-BROWSER-before` at **2026-10-13 23:55** (UTC 15:55, ₱10) and `H07-BROWSER-after` at **2026-10-14 00:05** (UTC 16:05, ₱20). Both transaction rows are completed; both linked payments are verified and equal their order grand totals. Grouping completed verified receipts by that Manila transaction date yielded one/₱10 and one/₱20, exactly matching the rendered filters and totals. The history hydrator maps `cashier_transactions.created_at` to `transaction.createdAt`; the active order filter uses the order's `created_at`, and these two fixtures deliberately share each order/receipt instant. This proves each active date filter on its intended column for this fixture, not behavior for an order paid on a later day.

Visual evidence: [Cashier Dashboard](H07-CASHIER-DASHBOARD-SYNTHETIC.png), [Transaction History, Manila Today](H07-CASHIER-TODAY-SYNTHETIC.png), [Order List, Manila Today](H07-CASHIER-ORDER-TODAY-SYNTHETIC.png). The images contain only synthetic local records. The disposable browser driver is `.tmp/h07-financial-20261014/browser-date.mjs`; it checks the full-row digest before and after. Screenshots are supporting evidence; the assertions and same-database comparison are the acceptance basis.

## Evidence categories and limitations

- **Verified PASS:** executed local RPC/SQL cases, frontend typecheck/build/date assertions, and authenticated rendered Chrome Transaction History/Order List Manila date filtering with same-database comparison and unchanged financial rows. The report/dashboard reconciliation used the actual Manager SQL RPC with a synthetic Manager claim.
- **Confirmed FAIL:** pre-fix Cashier UTC/browser-local boundary behavior by source and boundary reproduction; corrected locally. No confirmed bad hosted financial row.
- **Potential risk:** historical closed-shift snapshot versus recalculated current receipt list after later GCash settlement. The isolated case confirms divergence; whether it is an accounting defect requires the owner policy in the metric matrix.
- **Not tested:** a currently rendered Dashboard “Sales Today” card (none exists in the active Dashboard); transaction date differing from order creation date; CSV output; actual customer proof bytes/upload; real GCash transfer/refund; end-to-end POS on a configured recipe; multi-line top item; rejected-payment ordinary cancellation; HTTP RLS/JWT authorization for the earlier SQL scenarios; simultaneous duplicate races; hosted current-source reporting parity.
- **Blocked:** hosted release/deployment proof by prior migration/recovery findings. No H-07 hosted write or migration was attempted. The transient local Docker Engine fault's root cause remains unverified; it is no longer blocking this browser test.

**Replay:** run each `.tmp/h07-financial-20261014/{reconcile,payment-flow,pos-flow,closed-shift-refund}.sql` through `docker exec -i supabase_db_rrj_h07_financial_20261014 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -` with stdin. Do not point them at a shared/demo/hosted database. Each SQL script asserts and rolls back. The local runtime is retained; the separate browser fixture is persistent and synthetic. Its private account card stays under `.tmp/h07-financial-20261014` and must not be published.
