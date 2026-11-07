# Customer Track C.3 — Customer confirms delivery received

**Date:** 2026-11-03 (Asia/Manila)  
**Mode:** Read-only investigation and design. No code, migration, hosted data, button, or workflow was changed.  
**Decision status:** Design recommendation only; owner policy approval and authenticated acceptance remain outstanding.

## 1. Scope and finding

The current `Delivered` event is a Rider assertion backed by an uploaded image whose path and existence are checked by the completion RPC. It is **not** a Customer acknowledgement. There is a legitimate semantic difference between “Rider reports delivery” and “Customer confirms receipt,” especially for disputes, but this investigation found no demonstrated operational requirement to make Customer action a condition of order completion, payment, or Manager sales reporting. The minimal recommended design, **if the owner wants an acknowledgement**, is a separate, optional, auditable Customer receipt signal attached to an already delivered order. It must not rewrite `orders.current_status`, Rider proof, assignment completion, verified payment, or fulfillment revenue. No implementation is authorized by this report.

Evidence is the current local source and migration files, plus the bounded [C.2 investigation](CUSTOMER-TRACK-C2-RELEASE-HANDOFF-INVESTIGATION.md). This worktree contains unrelated uncommitted changes, which were left untouched. C.2 recorded a hosted catalog inspection on this date; C.3 did not repeat hosted SQL or execute an authenticated journey. Migration text alone does not prove current hosted deployment.

## 2. Deferred C.2 defect — record only

The Cashier delivery dialog says “Confirm that the ready order has been handed off” and its action says **“Confirm handoff”**. For a Ready delivery, the described operation moves it to Waiting for Rider and offers it; a Rider has neither accepted nor picked it up. The proposed later wording is **“Make available to Riders”**. The online delivery Cashier UI hides this Release action because Kitchen Ready can create the Rider offer. This is a **deferred C.2 wording defect**, not C.3 work. Do not fix it here, reopen Cashier, or treat this dialog as evidence of Customer receipt. Sources: `src/modules/cashier/orders/OrderDetailsDrawer.tsx:252-315`; `supabase/migrations/20261101213344_kitchen_ready_delivery_offer.sql:151-204`; C.2 §§4, 11.

## 3. Active state and role matrix

The table separates persisted order status, assignment status, and an as-yet nonexistent Customer acknowledgement. These are the online delivery path; non-delivery uses `completed`, not `delivered`.

| Event / state | Actor and authority | Durable evidence | Customer view / implication |
|---|---|---|---|
| Ready → Waiting for Rider, `offered` | Kitchen Ready/retry or permitted staff release; guarded offer path | `orders.current_status`, order history, assignment row | Tracker may pass through Ready quickly; no physical handoff or receipt. |
| `rider_accepted`, assignment `accepted` | Offered, active approved Rider accepts | Assignment and order status/history | Commitment only. |
| `picked_up`, assignment `picked_up` | Assigned Rider calls `advance_rider_delivery` with expected `accepted` | Paired statuses and `picked_up_at` | Rider attests possession; Customer has not acknowledged. |
| `out_for_delivery`, assignment `out_for_delivery` | Same Rider calls guarded progression with expected `picked_up` | Paired statuses and `out_for_delivery_at` | Delivery is underway. |
| `delivered`, assignment `delivered` | Same active approved Rider calls `complete_rider_delivery` from exact out-for-delivery pair | Existing private proof object in Rider/assignment path, `proof_of_delivery_path`, `delivered_at`, order history | Tracker shows Delivered and “This order is complete.” This is Rider completion, not Customer confirmation. |
| Customer receipt acknowledged | **No active event, status, RPC, or button found in inspected Customer and Rider paths** | None | No Customer-originated receipt state is presented. |
| Customer contests/nonreceipt | **No dedicated delivery dispute workflow found in inspected paths** | None | Rider completion remains authoritative under current contract; human resolution would need policy and a scoped record. |

Sources: `src/modules/customer/customerOrderSteps.ts:1-38`; `src/modules/customer/customerTrackingPage.tsx:126-152,461-546,870-980`; `src/modules/rider/services/supabaseRiderService.ts:763-792,802-959`; `src/modules/rider/index.tsx:1703-1805`; `supabase/migrations/20260825183637_remote_schema.sql:1149-1345,4061-4080`; C.2 §3. The later rider replay and cancellation guards are in `supabase/migrations/20260914010000_harden_transition_replay_safety.sql:296-420` and `20261026194712_track_b_cancellation_rider_lock_order.sql:99-151`.

## 4. What the two Rider clients and Customer tracker actually do

**Customer web:** The mounted tracker reads the owned order, history, items, and `get_customer_order_payment`; it subscribes to order updates/history inserts and exposes refresh and stale-state recovery. `delivered` immediately satisfies its terminal state and prints “This order is complete.” It does not read assignments, Rider identity, or proof and has no Customer receipt writer. Its nine-step timeline is backed by order statuses; the separate `tracking/OrderTrackingPage.tsx` is an unmounted prototype. Sources: `src/modules/customer/index.tsx:9-18,816-826`; `src/modules/customer/customerTrackingPage.tsx:91-185,126-152,461-546,575-619`; C.2 §2. Thus a new Customer action cannot safely be inferred from the existing completion copy.

**Rider web:** The UI uploads JPEG/PNG/WebP proof (5 MB limit), then calls completion. While the outcome is uncertain it fetches an assignment/order snapshot and compares status and proof path; it tells the Rider not to resubmit the photo while checking. Sources: `src/modules/rider/index.tsx:1703-1805,1878-1955`; `src/modules/rider/services/supabaseRiderService.ts:802-959`.

**Rider Android:** The separate app uses the same `advance_rider_delivery` and `complete_rider_delivery` RPCs. It requires a selected proof image, uploads to the private bucket, submits the path, and refreshes. It serializes actions and blocks while a refresh is needed. This source parity does not prove behavior on a device, GPS accuracy, customer presence, or a valid physical handover. Sources: `C:/Users/Janmari/Downloads/RRJ-Food-House-Rider/src/deliveryCommands.ts:30-58`; `src/riderApi.ts:286-311`; `App.tsx:375-393,537-569,675-699` in that Rider repo.

**Database:** `complete_rider_delivery` checks `auth.uid()`, active approved Rider, assignment ownership and exact out-for-delivery status, Rider/assignment proof path, object existence in `delivery-proofs`, and matching order status under locks. It then sets assignment `delivered_at` and proof path, order `delivered`, Rider availability, and a Rider-attributed history row in one transaction. A stored image demonstrates that a file exists at the expected path; the code does **not** authenticate its subject, prove the Customer saw or accepted the order, or encode a signature/OTP. Source: `supabase/migrations/20260825183637_remote_schema.sql:1149-1345` (the C.2 hosted inspection also reported this contract). The private bucket's Rider read policy was tightened to active approved owners in `20261026144235_track_b_restrict_rider_assignment_proof_reads.sql:1-38`.

## 5. Authorization and contract boundaries

Customers can SELECT their own order and its status history through ownership RLS. The protected-table ACL revokes direct browser-role INSERT/UPDATE/DELETE on orders, assignments, and history, so Customer receipt cannot be implemented as a direct client update to those rows. Rider reads of assignments/proof are ownership and active-approval gated. The Rider completion function is `SECURITY DEFINER` with explicit actor/ownership/state checks and an authenticated grant; any future receipt RPC would need its own verified Customer identity, active Customer role if required by policy, `orders.customer_id = auth.uid()`, exact delivered order/assignment match, narrow grant, and server-side idempotency. Avoid exposing proof URLs or Rider private storage to the Customer merely to support acknowledgement. Sources: `supabase/migrations/20260825183637_remote_schema.sql:5024-5034,5133,5374-5376`; `20260920000000_harden_protected_table_acl.sql:1-42`; `20261026202747_track_b_orders_read_rls_initplan.sql:1-42`; `20261026144235_track_b_restrict_rider_assignment_proof_reads.sql:1-38`.

The order enum has `delivered` and `completed` but no `customer_received` state (`20260825183637_remote_schema.sql:126-140`). Manager dashboard and sales report count a successful delivery from order `delivered` plus assignment `delivered_at`, and count verified-payment revenue by that fulfillment date; non-delivery uses `completed_at`. Customer acknowledgement as a gate would change those financial/reporting semantics and could strand legitimate deliveries when the Customer is unavailable. Sources: `20260921010000_harmonize_delivered_order_reporting.sql:1-8,125-181,280-359,408-426`; `src/modules/manager/reports/ReportsPage.tsx:122-132,229-261`. The paid-order cancellation path already refuses Rider custody from `picked_up` onward (`20261026194712_track_b_cancellation_rider_lock_order.sql:99-151`); a receipt mechanism must not silently reopen cancellation/refund paths.

## 6. Edge cases and proposed behavior to decide

| Case | Existing behavior | Recommended policy for a future separate receipt signal |
|---|---|---|
| Customer never responds, offline, or unreachable | Rider proof can still make the order Delivered; tracker later refreshes. | Leave Rider-delivered status and fulfillment/finance unchanged; record acknowledgement as absent, never fabricate it or auto-confirm after a timer. Decide whether an optional reminder or expiry is needed. |
| Customer says item was not received | No dedicated dispute event in the inspected Customer path. | Provide a **separate** contested-delivery intake and Manager review policy if required; preserve original Rider claim/proof/time and make outcome explicit. A customer assertion alone should not erase Delivered or reverse payment. |
| Customer receives but Rider proof is missing/failed | Completion RPC refuses missing/wrong proof, so order remains Out for Delivery. | Customer acknowledgement must not bypass the Rider completion guard. Define a Manager exception process separately if operations need one. |
| Rider proof exists but Customer contests it | Current `Delivered` remains. | Keep both contradictory assertions with actor/time and protected evidence; Manager adjudicates under an approved rule. Never convert absence of acknowledgement into a dispute. |
| Duplicate taps, two devices, stale UI, network timeout | No Customer writer exists. Rider RPC rejects duplicate completion; web reconciles uncertain result. | Enforce one receipt decision per order/customer in the database, return the prior result on replay, and refresh after uncertain responses. Define if and how a later dispute can supersede an earlier acknowledgement. |
| Wrong Customer, inactive account, non-delivery order, before Delivered | Own-order read policy does not itself authorize a write. | Reject server-side. Do not accept an order ID from the UI as sufficient proof of ownership. |
| Delivered order later adjusted/refunded | Current finance and cancellation contracts are separate. | Keep receipt evidence immutable or append correction events; any refund or reversal remains an explicit Manager/finance process. |
| Manager wants “successful deliveries” | Current sales report uses Rider delivery timestamp. | Show receipt coverage or disputes as a **separate operational measure**, with clear denominator and pending/contested counts. Do not redefine sales or Rider delivery totals. |

These are design recommendations, not current features. A time window, reminders, escalation owner, photo retention, and dispute evidence handling have no approved rule in the inspected source.

## 7. Business-rule options

| Option | Benefit | Cost / risk | Assessment |
|---|---|---|---|
| A. Keep Rider proof-backed Delivered only; clarify copy after approval | No new state or operational burden. | No Customer attestation; disagreement remains informal. | Valid if the business does not need a Customer-originated record. |
| B. Optional, separate Customer acknowledgement after Delivered | Captures an independent receipt assertion without delaying deliveries, Rider availability, payment, or reports. | Needs a distinct record, access rules, idempotency, privacy, and dispute owner. | **Recommended minimal design if acknowledgement is required.** |
| C. Customer confirmation required before `Delivered` or sales recognition | Stronger Customer sign-off when present. | Unavailable customers stall orders, Rider/Manager metrics and finance; contradictory proof needs adjudication; current status/RPC/report contracts require redesign. | Do not select without explicit owner policy and a broader contract review. |
| D. Automatic receipt after a timeout | Avoids pending acknowledgements. | Misrepresents silence as confirmation and weakens dispute evidence. | Not recommended. Timeout may close a response window only if clearly labelled as *no response*. |

For B, a future design could record `acknowledged_at`, actor, order/assignment reference, and a nonreceipt assertion in a separately authorized, append-only receipt/dispute record. The record should reference the existing proof rather than copy or expose it. This is a conceptual data shape, **not a migration proposal or approval to build UI**. “Acknowledged” must mean the Customer affirmatively pressed an action; silence cannot carry that label. Customer-visible wording should distinguish “Rider marked delivered” from “You confirmed receipt” if both are ever shown.

## 8. Owner decisions required before implementation

1. Is a Customer-originated receipt record needed at all, and for which deliveries (online Customer accounts only, or also walk-in delivery with no authenticated Customer)?
2. Does acknowledgement merely record receipt, or is it intended to determine `Delivered`, payment settlement, Rider completion, or revenue? The recommendation is **record only**.
3. Who handles “not received,” partial/missing items, wrong address/person, and suspicious proof; what evidence is retained, who can view it, and what outcome may alter finance?
4. May a Customer dispute after acknowledging, and within what time window? What happens when there is no response?
5. Is an existing customer support channel sufficient, or is an in-app dispute/reporting surface required? Who owns reminders and Manager review?
6. What exact Manager operational view is needed: receipt coverage, unacknowledged deliveries, disputed deliveries, resolution time, or all of these? Keep sales reporting definitions explicit.

The design should stop here until these rules are approved. A new button would imply an unresolved promise about what confirmation changes.

## 9. Test plan for a later approved implementation

**Database/authorization:** In a disposable environment, prove own delivered delivery accepted exactly once; replay returns the same record; another Customer, anonymous user, inactive/wrong role, other fulfillment type, and pre-delivered states are denied; concurrent taps from two sessions produce one event; no direct order/assignment/history write is granted. Verify post-delivery status, proof path, `delivered_at`, Rider availability, payment and Manager sales result are identical before/after acknowledgement. Test that contested evidence cannot overwrite original proof and that private proof is inaccessible to the Customer without an approved read path.

**Customer UX:** Signed-in tracking of a real paid delivery through Kitchen, offer, Rider accept, pickup, transit, proof upload, and Delivered; fresh/offline/stale/refresh behavior; duplicate taps, timeout and retry; nonresponse, declined/contested state, wrong account, no proof; clear language distinguishing Rider completion from Customer receipt. Test small screen and accessibility labels only if a UI is approved.

**Rider web/Android and Manager:** Real device proof upload and uncertain network completion, then Customer response; verify both Rider clients continue to use the same completion RPC and can finish without Customer availability. Compare Manager dashboard/sales totals and date grouping before and after response; inspect any new operational receipt/dispute queue with authorized Manager account. Exercise an actual dispute procedure with retained proof and a documented resolution, without silently changing payment/refund rules.

**Evidence boundary:** Source inspection and C.2 hosted catalog findings support the current contract; no C.3 hosted read/write, role-impersonation query, authenticated browser, Android device, or end-to-end business journey was run here. All proposed tests are future gates, not claimed pass results.

## 10. Stopping point

This report is the C.3 deliverable. Preserve `Delivered` as proof-backed Rider completion and the existing payment, finance, and reporting contracts. Record the C.2 Cashier wording defect as deferred. Obtain owner decisions above before any acknowledgement schema, RPC, Customer action, dispute surface, or Manager metric work. **Do not implement C.3 or initiate C.4 from this investigation.**
