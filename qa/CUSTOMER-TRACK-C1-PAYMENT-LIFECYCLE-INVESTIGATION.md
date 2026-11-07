# Customer Track C.1 — payment lifecycle investigation

**Date:** 2026-11-03 (Asia/Manila)  
**Scope:** Read-only source and hosted-catalog investigation. No order, payment, proof, migration, RPC, or application source was changed. `ORD-000080` was neither read by identifier nor acted on.

## 1. Executive summary

**PARTIAL overall.** The source and deployed contracts establish a coherent authority chain: Customer quotes and creates an order in `waiting_payment_verification`, submits one private GCash proof and a `pending` payment claim, Cashier alone verifies or rejects it, and only a verified payment advances the order to `confirmed` for Kitchen. A rejected claim stays attached to the same waiting order and may be resubmitted with new proof. Customer tracking reads an ownership-checked payment RPC and refreshes after order/history events; it offers an inline resubmission form. These are **PASS for source/catalog agreement**, not fresh runtime acceptance.

**FAIL at source-level presentation:** Tracking tells a Customer with a waiting order but no payment to “Submit your GCash payment to continue,” yet has no payment-entry action. Its payment card says “Not available,” which does not identify “not submitted.” A resubmission success banner is stored locally and is not cleared when a later refresh shows verified, voided, or rejected payment. A cancelled order with a rejected payment can still show “Needs resubmission,” although resubmission is disabled by the order-status guard. These are conditional UI defects established by branch conditions, not observed hosted sessions. No new Customer Pending Payments page is justified; a guarded action and state-aware copy in the existing tracking/checkout surfaces are the smaller candidate.

## 2. Active architecture and ownership

`src/app/routes.tsx` lazy-loads `CustomerApp` for `/customer`. The active Home, Menu, customization, Cart, Checkout, Tracking, History, and Profile are rendered from `src/modules/customer/index.tsx`. The files under `src/modules/customer/{landing,menu,cart,checkout,tracking}/` are disconnected prototypes; editing their similarly named components would not affect this flow. Active helpers include `customerQuoteState.ts`, `customerPaymentInput.ts`, `customerFinancialDisplay.ts`, `customerTrackingRefresh.ts`, `customerTrackingUrl.ts`, `customerBatch1.ts`, and `components/CustomerStatusBadge.tsx`.

Track A–B already changed quote and confirmation wording, unified GCash reference normalization/100-character checking, documented the JPG/PNG 5 MiB contract, and renamed the fulfillment card to “Service type” ([Track A–B](CUSTOMER-TRACK-AB-SCOPED-REFINEMENT.md)). This investigation did not repeat or replace those edits. Earlier Customer acceptance and quote reports give fixture, guest-browser, and disposable database evidence, with their own limits; they are not fresh Track C.1 payment acceptance.

## 3. Actual state-transition matrix

| Step / precondition | Authoritative transition and owner | Customer sees / can do | Failure and evidence classification |
| --- | --- | --- | --- |
| Review current cart, delivery details, configured merchant, signed-in active Customer | `quote_customer_order(...)` returns signed, session/request/terms-bound amounts; no order write | “Review Final Price,” then Order summary with server subtotal, delivery fee, total | **PASS source + hosted RPC**; stale/expired quote requires another review. Prior quote fixture tests exist; fresh hosted UI **BLOCKED**. |
| Confirm current quote | `place_customer_order_confirmed(...)` creates `orders.current_status=waiting_payment_verification`, items and status history; Customer writer | “Confirm order” creates an order and opens GCash instructions with recorded total | **PASS source + hosted RPC**; request ID and quote token guard replay, amount/terms drift. Fresh state-changing acceptance **BLOCKED**. |
| Order exists, proof not submitted | No `payments` row yet; `get_customer_order_payment(order_id)` returns no row | Checkout offers reference/proof fields while still mounted. Tracking shows waiting order, payment “Not available,” and instruction to submit, but no pay action | **FAIL source-level recovery/discoverability** after leaving checkout; an unchanged saved cart/request may permit checkout replay, but that path is not a dedicated, proven recovery action. |
| Enter reference and choose image | Customer-only client validation; private `payment-proofs` upload under `<customer>/<order>/<uuid>.<extension>` with `upsert:false` | One JPG/PNG screenshot, 5 MiB maximum; field and file errors inline | **PASS source + hosted bucket/policy**; native picker, actual bytes/upload failure **BLOCKED**. |
| Submit claim | `submit_customer_payment(uuid,text,text)` inserts or returns one `payments.status=pending` record; order stays waiting; Customer RPC | “Payment submitted”; same-order tracking link; pending card “Awaiting Cashier verification” | **PASS source + hosted RPC**; proof uploaded before RPC, and retry reuses stored path while mounted. A failed/ambiguous RPC response stays on same order. Live retry **BLOCKED**. |
| Cashier review | `get_cashier_online_payments()` supplies active Cashier queue; private proof uses five-minute signed URL | Customer has no decision control; tracking can refresh and shows waiting | **PASS source + hosted RPC/policy**; merchant transaction must be checked by Cashier. Proof viewing/decision not performed here. |
| Cashier verifies pending full amount with open shift | `verify_customer_gcash_payment(request_id,payment_id)` changes payment `pending→verified`, order `waiting→confirmed`, creates one completed Cashier transaction/receipt and history | Tracking payment “Verified,” order “Confirmed,” then preparation stages | **PASS hosted contract**; never equate uploaded proof with verified money. Live verification **BLOCKED**. |
| Cashier rejects pending claim | `reject_customer_gcash_payment(payment_id,reason,notes)` changes payment `pending→rejected`; order remains waiting; history records reason | Tracking shows “Payment needs resubmission,” reason/optional notes, inline new reference and proof fields | **PASS source + hosted contract**; eligible only while same order is waiting and payment rejected. Live rejection **BLOCKED**. |
| Customer resubmits rejected claim | Same `submit_customer_payment` RPC, same payment row, fresh proof path, status `rejected→pending`; reason/notes/actor cleared | “Payment resubmitted and awaiting verification”; Cashier queue gets updated version | **PASS source + hosted contract**; old proof rejected, duplicate reference to another payment rejected. Live resubmission **BLOCKED**. |
| Verified order progresses | Terminal-authorized Kitchen `confirmed→preparing→ready`; online delivery may auto-offer Rider and become `waiting_for_rider`, then Rider stages to `delivered` | Existing tracking timeline shows persisted order status; no Customer completion button | **PASS hosted contract**; payment-pending orders are absent from Kitchen queue. Full operational sequence **BLOCKED** in this investigation. |

## 4. Customer actions, messages, and refresh

Checkout validates details/config/auth/cart, requests a quote, and requires an explicit second confirmation. `place_customer_order_confirmed` creates the order before payment; the GCash step displays the returned order number and grand total. Initial payment submission checks reference and proof, then uploads once and calls `submit_customer_payment`. It checks the returned order, amount, status, reference, and path before showing success. On upload/RPC uncertainty it keeps the created order and, while the component remains mounted, the uploaded path for retry.

Tracking loads the order, items, and history via ownership-scoped table reads, and payment via `get_customer_order_payment`. It subscribes to order UPDATE and order-status-history INSERT, with manual “Refresh status,” reconnect/focus refresh, stale-state messaging, and a guarded refresh queue. The RPC writes a waiting-history event on submission/rejection/resubmission; verification changes the order and writes confirmed history, so these paths provide refresh signals. There is no independent `payments` Realtime subscription and no evidence of Customer push, SMS, or email delivery. “Customer notified” in the Cashier success toast must not be treated as proof of an out-of-app message.

Tracking displays the rejection category and notes, allows a new image and reference only when `order.current_status=waiting_payment_verification` and `payment_status=rejected`, then rereads payment/order/history after an acknowledged RPC. Other failures remain visible and retryable through the existing form. History lists orders and links to tracking; it does not itself expose payment controls.

## 5. Pending Payments UX assessment

| State | Existing presentation | Decision |
| --- | --- | --- |
| Waiting order, no payment row | Order waiting; payment “Not available”; next-step copy asks submission, with no tracking action | **Simplify + add guarded inline action in implementation.** The state is distinct from a read error because an empty owned-payment RPC result means no row. Do not create a separate page. |
| Proof submitted, pending | Confirmation card; tracking order waiting, payment “Awaiting Cashier verification,” next-step explains preparation gate | **Keep.** Two cards represent separate records; avoid another duplicate banner. |
| Rejected, still payable | Reason/notes and same-order resubmission form; payment card “Needs resubmission” | **Keep, simplify duplicate instructions if rendered evidence confirms crowding.** Never call it an order rejection. |
| Verified | Payment “Verified”; order advances to `confirmed` and later stages | **Keep.** Clear a stale local resubmission-success notice when authoritative status changes. |
| Cancelled/no longer payable | Resubmission form is correctly hidden; next-step says no further steps | **Simplify.** A rejected payment card can still say “Needs resubmission”; make its wording order-aware. A paid cancellation shows voided payment as “Refund recorded.” |

The existing checkout plus tracking are sufficient for the Customer workflow. The Cashier Pending Payments page is a separate staff decision queue and should remain untouched. A new Customer page would duplicate the owned order list, tracking data, and payment actions without resolving the missing state guard.

## 6. Rejection, resubmission, and confirmed defects

The hosted rejection RPC accepts the controlled reasons `Wrong Amount`, `Unreadable Proof`, `Duplicate Payment`, `Invalid Proof`, `Reference Not Found`, and `Other`; notes are required for `Other` and capped at 300 characters. It validates active Cashier role, pending payment, waiting order, proof path/object, and locks payment then order. It records the rejection and status-history event without changing the order status. The Customer reads both reason and notes through the owned RPC. Resubmission requires a new proof path; it updates the same payment row and clears rejection fields. Verification of that new pending version is again a Cashier decision.

Source-level **FAIL** findings:

1. `TrackingPage` has no submission form/action for `waiting_payment_verification` with `payment=null`, despite the explicit “Submit your GCash payment” instruction (`index.tsx`, payment status/next-step branch near lines 3942–3965 and tracking body near 4120–4280). The checkout's `pendingPaymentSubmission` is component state; after navigation/reload the Customer must discover a route back through the cart/quote flow. This does not prove the backend cannot recover the same request, only that tracking provides no direct action.
2. `resubmissionSuccess` is set after an acknowledged resubmission (near line 3854) and rendered whenever nonnull (near line 4120). Ordinary tracking refresh updates `payment` but does not clear this notice. A later verified/rejected/voided state can coexist with “awaiting verification.”
3. `paymentStatusLabel` maps any rejected payment to “Needs resubmission” (near line 3947), while the form requires the waiting order (near line 3902). Hosted `cancel_order` allows an order with a rejected, unpaid payment to become cancelled; that combination would show an unavailable action as needed.

These are conditional source/contract findings. No production order was inspected to determine prevalence, and no rendered reproduction was performed. A separate **PARTIAL** wording concern is that “Not available” can also mask other missing-payment explanations; the fetch function already distinguishes an empty result from an RPC error.

## 7. Financial, authorization, and race safeguards

- The hosted quote is tied to customer, session, request ID, terms, price payload, expiry, and signature. Confirmed placement rechecks price/terms and has a unique `(customer_id, customer_request_id)` index. Order writer returns an existing request's order before creating another.
- Hosted reference validation trims whitespace, requires nonempty text, and caps at 100 characters. There is no fixed-digit or punctuation restriction. A unique normalized GCash-reference index prevents cross-payment reuse. The Customer helper mirrors the supported limit.
- `payment-proofs` is private, with 5,242,880-byte and JPG/PNG bucket limits. Hosted Storage INSERT checks active Customer, ownership, and waiting order; SELECT lets an owner read own proof or active Cashier/Manager read staff proof. Payment RPC checks the customer/order path and object existence. Cashier proof viewer obtains a 300-second signed URL. No policy was changed.
- Hosted `get_customer_order_payment` requires active Customer role and ownership of the requested order. `payments` has table-level SELECT grants but no direct SELECT RLS policy in the inspected policy set; the RPC is the Customer read path. Order/items/history SELECT policies restrict owned rows. `authenticated` EXECUTE alone is not authorization; the function bodies perform role/ownership checks.
- Verification requires active Cashier and an open shift, locks the shift/payment/order, checks pending/waiting, GCash proof existence/ownership, and equality of `payments.amount` and `orders.grand_total`. A request-ID retry returns its own completed transaction; a different transaction for the same payment/order is denied. Unique transaction request/payment/order/receipt indexes back this rule. The Cashier UI also blocks overlapping decisions, reconciles uncertain outcomes, and refreshes a stale queue. Rejection locks payment/order and refuses nonpending/no-longer-waiting states.
- Ordinary `cancel_order` is active Cashier/Manager only and refuses pending or verified payment and existing financial transaction; rejected unpaid payment can be cancelled. Manager-only `settle_paid_order_cancellation` requires a verified full linked sale, confirmed refund details and original method, checks preparation/rider custody, then records paid cancellation, voids payment/transaction, and cancels order. Customer tracking maps `voided` to “Refund recorded.” These are distinct workflows, not Customer payment decisions.

## 8. Hosted reconciliation

Read-only Supabase catalog inspection on project `zhzluhqvysvsadwuugpa` confirmed the deployed signatures for `quote_customer_order`, `place_customer_order_confirmed`, `submit_customer_payment`, `get_customer_order_payment`, `get_cashier_online_payments`, `verify_customer_gcash_payment`, `reject_customer_gcash_payment`, `get_kds_queue_v2`, `advance_kds_order`, `release_ready_order`, Rider transitions, `cancel_order`, and `settle_paid_order_cancellation`. Each is `SECURITY DEFINER` in the inspected catalog. The Customer/payment/staff functions deny `anon` EXECUTE and grant `authenticated`; the Kitchen terminal RPCs are callable by `anon` but validate the terminal ID, active flag, and secret inside the function. A callable signature is not proof of a successful role-specific call.

Hosted `order_status` includes waiting, confirmed, preparing, ready, rider stages, delivered/completed, cancelled/rejected; `payment_status` includes pending, verified, rejected, voided. Relevant ledger entries include `20260830020000 submit_customer_payment`, `20260831010000 customer_gcash_rejection_resubmission`, `20261022115601 customer_preorder_quote`, `20261031192355 cashier_remove_transaction_number`, `20261101213344 kitchen_ready_delivery_offer`, and `20261101233254 replace_fake_screenshot_rejection_reason`. The function bodies and bucket/RLS metadata were checked directly, because ledger names alone do not prove current definitions. No hosted business rows were queried or changed.

## 9. Cross-module lifecycle dependencies

The deployed `get_kds_queue` includes only `confirmed`, `preparing`, and `ready`, so a waiting-payment order is not eligible. Terminal-authorized `advance_kds_order` handles `confirmed→preparing→ready`. For a ready online delivery it requires a verified GCash payment equal to the order total, attempts an automatic Rider offer, and reaches `waiting_for_rider` when an offer succeeds; with no eligible Rider it remains `ready` for retry. The Cashier/Manager `release_ready_order(uuid)` is also ready-only and can perform a delivery handoff/offer; it completes a non-delivery ready order. This is a fallback/role-specific handoff contract, not a request to change Release.

An approved available Rider accepts an offered assignment (`waiting_for_rider→rider_accepted`), advances to `picked_up` and `out_for_delivery`, then supplies private delivery proof to `complete_rider_delivery` for `delivered`. Customer tracking presents these persisted statuses. There is no Customer “confirm received” writer in the active flow. Kitchen/Rider/Release redesign and the meaning of delivered versus customer acknowledgment belong to C.2–C.3.

## 10. Findings by classification

| Finding | Result |
| --- | --- |
| Customer order/claim and Cashier-only verification/rejection source matches deployed RPCs | **PASS** (catalog/source); runtime not exercised here. |
| Private proof size/MIME/ownership and owned payment read | **PASS** (catalog/source); object-byte and signed-session behavior not exercised. |
| Rejection and same-row resubmission contract | **PASS** (catalog/source); live transition not exercised. |
| Tracking refresh through order/history events and manual retry | **PARTIAL**; source path exists, but live Realtime/offline behavior not rerun. |
| No-payment tracking recovery action | **FAIL** (source-level UX). |
| Stale resubmission-success notice after later status change | **FAIL** (source-level conditional presentation). |
| Cancelled rejected-payment wording | **FAIL** (source/hosted state combination). |
| Hosted signed-in Customer/Cashier payment, proof, race, cancellation/refund acceptance | **BLOCKED** by read-only/no-production-action scope; no synthetic isolated runtime was provisioned. |

## 11. Minimal Customer-only implementation recommendation

For a separately authorized C.1 implementation, keep Checkout and Tracking. First, make the owned `waiting_payment_verification` + no-payment state show an explicit **Pay for this order** action that uses that order ID and server-recorded total, validates current ownership/status through the existing read path, and reuses existing Customer upload/submission behavior. It must never create a second order, infer an amount from the cart, or present this action for pending/verified/rejected/cancelled states. Confirm retry behavior after refresh/logout and stale status changes in an isolated fixture before shipping.

Second, derive the resubmission-success notice and payment-card copy from the latest authoritative `order.current_status` plus `payment.payment_status`; clear or hide “awaiting verification” once the record is no longer pending, and do not ask a cancelled order to resubmit. Retain the existing rejection reason/notes and same-payment retry semantics. These are narrow Customer-only changes; a backend contract change, new queue page, or Cashier redesign is not presently justified.

## 12. Deferred decisions

Customer delivery acknowledgment needs a precise owner, state, evidence, and dispute meaning before any new button/RPC. Release already has Kitchen-auto and staff-ready paths; C.2–C.3 must decide whether adviser feedback concerns operational handoff or merely Customer wording. Manager successful-delivery reporting and receipt format require separate artifact definitions. No such work is included here.

## 13. Inspection evidence and commands

Read-only repository commands used (PowerShell): `git status --short -- src/modules/customer`; `rg -n 'quote_customer_order|place_customer_order_confirmed|submit_customer_payment|verify_customer_gcash_payment|reject_customer_gcash_payment|release_ready_order|advance_kds_order|complete_rider_delivery' src/modules/customer src/modules/cashier src/modules/kitchen src/modules/rider`; targeted `Get-Content` ranges of `src/modules/customer/index.tsx`, Cashier Pending Payments/API files, `supabase/migrations/20260831010000_customer_gcash_rejection_resubmission.sql`, `20261101213344_kitchen_ready_delivery_offer.sql`, and Track A–B/earlier Customer QA. No graph existed at `graphify-out/graph.json`, so direct source lookup was used. `npm` tests/build were not rerun: no production code changed, and prior results remain dated evidence.

Read-only hosted SQL inspected `pg_proc` identities/ACLs/`pg_get_functiondef`, `pg_enum`, `pg_policies`, `pg_indexes`, `pg_trigger`, `storage.buckets`, and named `supabase_migrations.schema_migrations` rows. Representative exact queries:

```sql
select p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef,
  has_function_privilege('anon',p.oid,'EXECUTE'),
  has_function_privilege('authenticated',p.oid,'EXECUTE')
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('submit_customer_payment','get_customer_order_payment',
   'verify_customer_gcash_payment','reject_customer_gcash_payment');

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='payment-proofs';

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public'
  and tablename in ('orders','payments','order_items','order_status_history');
```

No table rows from `orders`, `payments`, `cashier_transactions`, or Storage objects were selected. No authenticated browser, proof upload, payment action, or migration deployment was run.

## 14. Proposed acceptance criteria

In a disposable authenticated fixture with current RPC/Storage shape: (1) quote remains read-only; one confirmation creates one waiting order with the quoted amount; (2) no-payment tracking clearly identifies **Not submitted** and pays that same owned order once, including after refresh; (3) invalid file/reference receives feedback before upload; (4) pending proof is visible only to authorized owner/Cashier/Manager, and only Cashier with open shift can verify; (5) verification creates exactly one receipt and `confirmed` order, while rejection leaves waiting and exposes reason/notes/new-proof resubmission; (6) retries/concurrent Cashier decisions cannot create duplicate payment/receipt or overwrite a newer submission; (7) tracking notices and cards agree after pending, verified, rejected, voided, and cancelled transitions; (8) Kitchen sees only eligible paid confirmed orders and later Rider stages reflect authoritative records; (9) mobile/desktop keyboard, focus, error, empty, and stale/offline states are inspected in a rendered browser; (10) no production order or `ORD-000080` is touched.

## 15. C.1 decision

**Recommend a bounded Customer-only implementation later:** repair the no-payment tracking action and contradictory transient/status copy, then verify against an isolated current-contract fixture. Keep the staff queue and backend authority as they are. Stop here for this read-only investigation; do not start C.1 implementation, C.2, or C.3 from this report.
