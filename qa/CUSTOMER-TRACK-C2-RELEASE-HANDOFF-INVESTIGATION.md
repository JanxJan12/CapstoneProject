# Customer Track C.2 — Release, handoff, and delivery investigation

**Date:** 2026-11-03 (Asia/Manila)  
**Mode:** Read-only source and hosted catalog inspection. No order, payment, assignment, proof, or migration was changed.  
**Verdict:** The live contract separates food readiness, Rider acceptance, pickup, transit, and proof-backed delivery. `Release` is a staff eligibility/dispatch action, not proof of physical custody. For online delivery, Kitchen Ready can already create the Rider offer, so a second staff Release is not part of that active UI path. A separate custody confirmation is not yet justified by executed operational evidence.

## 1. Adviser concern and scope

The October 29 demonstration feedback, “Change workflow of the Release — Needed discussion,” does not specify a missing actor or event. This report reconstructs the active Customer, Cashier, Kitchen, Manager, and Rider paths and distinguishes source behavior from hosted contract shape. The earlier [Customer C.1 investigation](CUSTOMER-TRACK-C1-PAYMENT-LIFECYCLE-INVESTIGATION.md), [C.1A correction](CUSTOMER-TRACK-C1A-CORRECTIVE-IMPLEMENTATION.md), [Customer final acceptance](CUSTOMER-MODULE-FINAL-ACCEPTANCE-202610.md), and [Cashier final QA](CASHIER-QA-FINAL-20261030.md) provide historical or bounded evidence; none proves a current live paid delivery from start to finish.

## 2. Active Customer tracking architecture

**CONFIRMED:** `src/modules/customer/index.tsx:9-18,816-826` mounts `TrackingPage` from `customerTrackingPage.tsx`. `src/modules/customer/tracking/OrderTrackingPage.tsx` is a disconnected hard-coded prototype (`ORD-1047`, fixed step 2), so its nine-stage screen is not the active Customer tracker. The active page reads the owned order, items, status history, and `get_customer_order_payment`; it does not read `delivery_assignments` or Rider identity (`customerTrackingPage.tsx:126-152`, `customerTrackingApi.ts:117-146`). `customerOrderSteps.ts:1-38` lists real `order_status` values, not invented UI-only stages. The hosted enum contains all nine delivery labels, plus `completed`, `cancelled`, and `rejected`.

**CONFIRMED:** Tracking listens for order UPDATE and history INSERT, refreshes after subscription, and offers manual refresh. On channel errors it retries three times; focus/online/visibility can reconnect and refresh after 60 seconds (`customerTrackingPage.tsx:91-185`). A stale snapshot is explicitly marked (`:575-619`). The page uses the current order status for its badge and next step and history rows for reached-step timestamps (`:461-546,838-980`). Its `Map` keeps the latest entry for a repeated status such as a Rider rejection, hiding earlier timestamps in the timeline; the underlying history remains stored. **RISK:** this is a presentation loss for repeated `waiting_for_rider`, not a lost database event. Authenticated browser timing and Realtime delivery were **NOT RUN**.

## 3. Actual state machine and transition matrix

The table is for an **online delivery**. Every named status is persisted in `orders.current_status`; Rider offer state is separately persisted in `delivery_assignments.status`. History rows are audit events, not independent permissions. “Next” means the expected authorized path, not an unrestricted enum transition.

| Current → next | Role and active action | Backend authority and preconditions | Failure/recovery; Customer presentation | Evidence |
|---|---|---|---|---|
| `waiting_payment_verification` → `confirmed` | Cashier verifies a submitted GCash payment | `verify_customer_gcash_payment(request_id,payment_id)`; current pending payment, Cashier/open-shift and amount safeguards | Rejection/resubmission stays waiting; Customer sees payment state and no preparation | `customerTrackingPage.tsx:480-546`; `20261021053249_cashier_pending_payment_shift_closure.sql:93-182`; hosted function catalog inspected |
| `confirmed` → `preparing` | Kitchen Start Preparing | `advance_kds_order(terminal,secret,order,expected_status)`; active secret, exact expected `confirmed`, row lock | Stale/invalid terminal rejected; Customer sees Preparing after refresh | `KitchenQueue.tsx:403-423`; `kdsTerminalService.ts:243`; `20261101213344_kitchen_ready_delivery_offer.sql:107-161` |
| `preparing` → `ready` → possibly `waiting_for_rider` | Kitchen Mark Ready | Same RPC; for online delivery, verified full GCash payment required; in one transaction it sets Ready and attempts an eligible Rider offer | If no Rider: remains Ready and Kitchen retains Retry rider offer. If offer succeeds: order becomes Waiting for Rider and assignment `offered`; Customer may see Ready only as history, not a stable current state | `KitchenQueue.tsx:105-132,425-433`; `20261101213344...sql:163-204` |
| `ready` → `waiting_for_rider` | Kitchen Retry rider offer, or authorized staff Release fallback | Kitchen RPC repeats Ready with expected-state guard; `release_ready_order(uuid)` allows active Cashier/Manager, Ready only, invokes staff offer | Kitchen no-Rider retry remains Ready; staff Release fails and rolls back if no eligible Rider. Customer sees Ready until successful offer | `20261101213344...sql:151-204`; hosted `release_ready_order` body inspected; `supabaseOrderService.ts:137-160` |
| `waiting_for_rider` + `offered` → `rider_accepted` + `accepted` | Offered Rider Accept | `accept_rider_offer(uuid)` verifies active approved and available owner, offered assignment, waiting order, and no other active accepted delivery | Stale/wrong Rider rejected; Rider UI reconciles uncertain acceptance; Customer sees Rider Accepted | `supabaseRiderService.ts:445-490`; hosted function body inspected |
| `rider_accepted` + `accepted` → `picked_up` + `picked_up` | Assigned Rider confirms pickup | `advance_rider_delivery(uuid, expected='accepted')` checks Rider ownership and exact paired statuses under locks; sets `picked_up_at` | Duplicate/stale/wrong order state rejected; UI fetches assignment after ambiguous result. Customer sees Picked Up | `supabaseRiderService.ts:763-792`; `src/modules/rider/index.tsx:986-1121`; hosted function body inspected |
| `picked_up` → `out_for_delivery` | Same Rider starts delivery | Same RPC with expected `picked_up`; exact order/assignment match; sets `out_for_delivery_at` | Stale request rejected; Customer sees Out for Delivery | Same sources as prior row |
| `out_for_delivery` → `delivered` | Same Rider uploads proof and completes | `complete_rider_delivery(uuid,proof_path)` checks approved owner, exact statuses, own Rider/assignment Storage path and existence in private `delivery-proofs`; sets `delivered_at`, path, history | Missing/wrong proof and duplicate completion rejected; Customer sees Delivered and “This order is complete” | `supabaseRiderService.ts:802-959`; `customerTrackingPage.tsx:474-546`; hosted function body inspected |

**CONFIRMED:** `waiting_for_rider` and `rider_accepted` are stored order statuses. `offered` and `accepted` are separate assignment statuses. Kitchen can advance Ready and offer within one RPC call; therefore a customer may never observe Ready as the current status even though its history is recorded. There is no required elapsed time between Rider acceptance, pickup, and out-for-delivery, but the RPCs still require the exact sequence.

## 4. Release action inventory and operational meaning

| Surface | Meaning and role | Persisted effect | Reversible / duplicate? |
|---|---|---|---|
| Cashier “Release ready order” / dialog “Confirm handoff” | Cashier UI for Ready orders **excluding online delivery** (`OrderDetailsDrawer.tsx:252-315`). Backend also permits active Manager even if this Cashier dialog is the visible path. | Delivery: Ready → Waiting for Rider plus offer. Non-delivery: Ready → Completed. History attributes staff actor. | No direct undo. A delivery can be cancelled through the separate paid-order settlement only under its conditions. For online delivery, staff Release would duplicate the Kitchen automatic transition and the UI deliberately hides it. |
| Kitchen “Mark Ready” and “Retry rider offer” | Preparation finished; online delivery is offered automatically or retried (`KitchenQueue.tsx:105-132,403-433`). | Ready history; successful offer moves to Waiting for Rider. | Ready has an explicit offer retry, not a preparation reversal. |
| Cashier “Offer to next rider” | Reoffer an order already Waiting for Rider when no active offer (`OrderDetailsDrawer.tsx:268-278`). | New `offered` assignment; order status stays Waiting for Rider. | Rejection remains waiting; staff may reoffer another eligible Rider. |
| Rider Accept / Pickup | Commitment, then Rider self-attested physical possession (`src/modules/rider/index.tsx:674-747,986-1121`). | Separate accepted then picked-up statuses/timestamps. | Neither is a staff Release. No Rider accepted-assignment cancellation action was identified in the active web path. |

**CONFIRMED source-level terminology defect:** the Cashier dialog says “Confirm that the ready order has been handed off” and offers “Confirm handoff” even when a non-online delivery is merely moved to Waiting for Rider and an offer is created (`OrderDetailsDrawer.tsx:300-314`). A Rider cannot yet possess an order by virtue of that action. The hosted RPC's audit note instead says “Ready order released for rider assignment.” Thus the dialog overstates physical custody for that delivery branch. This does **not** mean online delivery currently requires that dialog.

## 5. Hosted enforcement, authorization, and concurrency

**CONFIRMED hosted catalog on 2026-11-03, project `zhzluhqvysvsadwuugpa`:** current `advance_kds_order(uuid,text,uuid,order_status)`, `release_ready_order(uuid)`, `offer_order_to_next_rider(uuid)`, `accept_rider_offer(uuid)`, `advance_rider_delivery(uuid,delivery_assignment_status)`, `reject_rider_offer(uuid,text)`, and `complete_rider_delivery(uuid,text)` are `SECURITY DEFINER`. The public Rider/staff RPCs deny `anon` EXECUTE and allow `authenticated`; their bodies impose role/ownership checks. Kitchen RPC permits `anon` EXECUTE but requires an active terminal ID and secret hash. `rrj_internal.offer_order_to_next_rider` is private and its schema/function deny client access. These are catalog findings, not executed impersonation tests.

**CONFIRMED:** The internal offer function requires delivery + Waiting for Rider, checks no active assignment, selects an active approved available Rider who has not rejected that order, orders candidates by last assignment, locks candidate with `FOR UPDATE SKIP LOCKED`, and inserts `offered` (`20261101213344...sql:6-79`). The hosted unique partial index `delivery_assignments_one_active_per_order_idx` covers `offered`, `accepted`, `picked_up`, and `out_for_delivery` per order. Row locks and the unique index protect against two active Riders accepting the same order; a live race was **NOT RUN**. `accept_rider_offer` also checks assignment owner and offered status. Pickup cannot precede the accepted order/assignment pair. Completion cannot skip out-for-delivery or the proof existence check.

**CONFIRMED:** Hosted RLS gives Customers SELECT on their own `orders` and their order history; Riders SELECT their own assignments and assigned orders; staff have role-gated order/history reads. This does not itself authorize mutation because the transitions use guarded RPCs. The hosted payment verification function exists with open-shift and confirmation branches; the Kitchen automatic online-delivery branch additionally checks verified full-amount GCash. **LIMIT:** This investigation did not execute unauthorized roles or payment outcomes, and did not prove every possible writer of `orders.current_status` is equally constrained.

## 6. Physical operations and handoff accountability

| Physical event | Current digital event | Assessment |
|---|---|---|
| Payment accepted | Cashier payment verification creates Confirmed | Fits the stated online path; financial acceptance was outside this run. |
| Food prepared | Kitchen Preparing → Ready | Accurate preparation boundary. |
| Dispatch sought | Ready → Waiting for Rider and assignment `offered` | Accurate as availability/offer, not physical release. |
| Rider commits | Offer accepted | Accurate commitment; does not prove possession. |
| Custody transfers | Rider presses pickup, recording `picked_up_at` | One-sided Rider attestation; no separate staff acknowledgment or custody signature. |
| Transport begins | Out for Delivery | Separate explicit transition. |
| Delivery completed | Rider proof path validated and Delivered recorded | Proof-backed Rider completion; no Customer receipt acknowledgment. |

**RISK:** A Rider can self-report pickup after acceptance without staff countersignature. That is an accountability gap if operations require dual acknowledgment; the code alone does not show a real dispute or lost handoff. **INFERENCE:** If the adviser meant that staff should attest physical transfer, a narrowly scoped handoff record could address it, but only after confirming who physically hands food to the Rider and whether Rider pickup alone is considered sufficient. Do not equate the current staff Release or automatic Kitchen offer with custody transfer.

## 7. Customer presentation: Keep / Simplify / Combine / Relocate / Remove

- **Keep:** persisted status card, service type, separate payment card, nine-stage history timeline, next-step copy, refresh, stale/offline indicator, and cancellation/rejection handling (`customerTrackingPage.tsx:461-546,575-619,838-980`). The status source is the order row, not a client-side guess.
- **Simplify:** clarify “Waiting for Rider” as an offer/assignment search if user research shows the label implies a Rider is already secured. The current label is a stored state; this is optional copy work.
- **Combine:** do not add a separate Release timeline stage. Readiness, offer, acceptance, pickup, and transit already have distinct stored states. A new label without a distinct event would duplicate information.
- **Relocate:** if Rider name/ETA is operationally required, source it from a scoped authorized read of assignment data; the current Customer page has none. Do not infer Rider identity from order status.
- **Remove:** the misleading delivery “Confirm handoff” copy from the Cashier fallback dialog in a later approved correction; replace with wording about offering/dispatch eligibility. The disconnected prototype is not evidence of the mounted experience.

**CONFIRMED:** The current Customer tracker has no Rider identity, pickup proof details, or Customer “confirm received” action. It does show `delivered` immediately after Rider proof-backed completion. **RISK:** “This order is complete” may be read as Customer acknowledgment even though none exists. This is a wording/definition question for C.3. A rendered authenticated browser review is **NOT RUN**.

## 8. Cancellation, reassignment, and failure recovery

| Scenario | Existing behavior and classification |
|---|---|
| Ready but no Rider | **CONFIRMED:** Kitchen leaves online delivery Ready and exposes Retry rider offer. Staff Release failure rolls back its status/history. Customer continues to see Ready. |
| Offered Rider rejects | **CONFIRMED:** `reject_rider_offer` permits only the owning active approved Rider and an `offered` assignment; changes assignment to `rejected`, keeps order Waiting for Rider, writes another history row. Cashier can offer next eligible Rider. Automatic reoffer on rejection was not found. |
| Accepted Rider fails to collect | **RISK:** order remains Rider Accepted; no timeout or active accepted-assignment cancellation/reassignment writer was identified in the inspected active paths. Operational recovery needs a decision. |
| Kitchen revises preparation | **CONFIRMED:** KDS RPC only advances Confirmed → Preparing → Ready or retries Ready offer; no reverse preparation transition in it. Any manual exception is **BLOCKED** pending operational policy. |
| Customer cancels after preparation | **CONFIRMED:** ordinary `cancel_order` rejects paid/verified orders; Manager `settle_paid_order_cancellation` is the separate refund route. Current migration permits Ready/Waiting/Rider Accepted only with its refund and inventory conditions and rejects Rider custody (`picked_up`). Customer has no self-cancel in tracking. |
| Released order cancelled | **CONFIRMED:** Release is not directly reversible; Manager paid cancellation can cancel before pickup under its checks. A new offer after a rejected offer is permitted, but an accepted Rider cannot simply be replaced by the reoffer RPC. |
| Pickup/completion network interruption | **CONFIRMED source:** Rider web reconciles assignment snapshots after uncertain acceptance and progression; backend rejects stale duplicate transitions. Native Android uses the same RPC sequence (`RRJ-Food-House-Rider/src/deliveryCommands.ts:30-58`). Actual device/network interruption is **NOT RUN**. |
| Duplicate pickup or delivery | **CONFIRMED contract:** exact expected assignment status and locked order state reject replay. Delivery also requires an existing proof object. Runtime duplicate tests are **NOT RUN**. |
| Rider completion disputed by Customer | **CONFIRMED:** proof-backed Rider completion has no Customer receipt confirmation. Dispute and adjudication behavior is **BLOCKED** pending C.3 policy. |
| Stuck Ready / Waiting | **CONFIRMED:** Ready has Kitchen retry; Waiting after rejected offer has staff reoffer. Monitoring, timeout escalation, and responsibility for an accepted Rider who disappears are **INFERENCE / unconfirmed operations**. |

The web Rider and standalone Android app are distinct clients of the same backend RPCs. Source parity does not establish physical-device GPS, proof upload, app restart, or push delivery behavior.

## 9. C.3 dependency: Customer receipt confirmation

No active Customer writer or hosted function named for Customer receipt acknowledgment was found in this bounded search. Current `delivered` means Rider completion with an existing private proof object, not Customer acknowledgment. C.3 must first define whether a Customer action is an acknowledgment, dispute window, or condition for final settlement, and decide how nonresponse and contradictory proof are handled. No C.3 button, RPC, Manager successful-deliveries list, or status redesign is proposed here.

## 10. Confirmed findings, risks, assumptions, and blocked evidence

| Class | Finding |
|---|---|
| **CONFIRMED** | Online Kitchen Ready can atomically create an offer and move to Waiting for Rider; staff Release is an alternate Ready-only path, and the current Cashier UI hides it for online delivery. |
| **CONFIRMED defect** | The Cashier fallback delivery dialog labels dispatch eligibility as completed physical “handoff.” |
| **CONFIRMED** | Rider acceptance, pickup, out-for-delivery, and proof-backed delivery are separate guarded transitions with audit history and timestamps. |
| **RISK** | Rider pickup is unilateral custody attestation, and accepted-but-uncollected delivery lacks an identified cancellation/reassignment path. |
| **RISK** | Customer timeline collapses repeated same-status events to the latest timestamp; it does not display Rider details. |
| **INFERENCE** | The adviser may want a different physical custody owner; the brief does not establish that requirement. |
| **BLOCKED** | Real authenticated Customer/Cashier/Kitchen/Rider browser and device lifecycle, concurrency races, physical handoff practice, and dispute handling were not executed/observed. |

## 11. Architectural alternatives and recommendation

| Option | Operations and Customer clarity | Accountability/security | Effort, migration, regression, readiness |
|---|---|---|---|
| **A. Preserve flow; clarify labels** | Keeps ready/offer/accept/pickup sequence; corrects Cashier delivery wording and, if needed, Customer next-step copy. | Pickup remains Rider attestation. Existing RPC authorization untouched. | Small UI-only scope; no data migration; lowest cross-module and demo risk. Production still needs end-to-end acceptance. |
| **B. Reassign existing Release action** | Could require staff decision before offer or reinterpret existing button. | Adds staff responsibility, but Kitchen currently offers automatically and current Release is Ready-only. | Requires Kitchen/Cashier/backend coordination, migration or RPC change, and concurrency/regression tests. Higher risk without a demonstrated need. |
| **C. Distinct custody confirmation** | Records staff/Rider handoff as a separate physical event. | Stronger dual accountability if a real custody dispute exists. | New data, permissions, failure/reassignment policy, Android/web changes, and migration; highest demo and production risk. Needs operational evidence first. |

**Recommended minimal decision:** retain the existing state machine. After review, make a narrowly scoped copy correction in the Cashier fallback dialog so “Release” means “make this Ready delivery available for a Rider offer,” not “food handed to Rider.” Consider a Customer wording refinement only after an authenticated rendering check. Do not insert another order status or confirmation now. This recommendation is source and catalog based, not a claim that the physical process has been accepted by staff.

## 12. Cross-module decisions and prerequisites before implementation

1. Restaurant operator/adviser: identify the physical person who hands food to the Rider and whether the Rider pickup tap is sufficient evidence. Decide the expected action when an accepted Rider does not collect.
2. Cashier/Kitchen/Manager: confirm whether online Kitchen automatic offer remains intended, and which role monitors Ready-with-no-Rider and rejected offers. Preserve Cashier payment and refund authority.
3. Rider web/Android: if custody rules change, use the same established RPC path and test both clients; do not introduce a client-side assignment writer.
4. Customer/C.3: define the meaning of Delivered versus Customer receipt acknowledgment before changing final-status copy or adding a confirmation.
5. Any code, schema, hosted data, or deployment change needs a separately reviewed C.2 implementation scope. This report authorizes none.

## 13. Proposed acceptance tests (not executed here)

| Layer | Focus |
|---|---|
| Static/source | Confirm mounted routes, Cashier action eligibility, KDS retry visibility, Customer copy and history mapping, Rider web/Android calls. |
| Read-only hosted | Recheck current function definitions, grants, RLS, enum/index, triggers, ledger version, and private proof policy before a later change. |
| Isolated PostgreSQL/Auth/Storage | Verified payment required before Kitchen; Ready offer success/no Rider; staff Release invalid state; two Riders racing; wrong-role/ownership denials; accept → pickup → transit → proof-backed delivery; stale/replay rejection; Rider rejection/reoffer; Manager paid cancellation before pickup and denial after pickup. |
| Authenticated browser | Customer status/timeline after each real transition; skipped Ready current-state; repeated rejection history, manual refresh, offline/reconnect, stale response, cancellation, service-type and next-step clarity. Cashier/Kitchen/Rider web screens at realistic widths. |
| Physical Android Rider | Fresh login, offer push/refresh, accept, pickup, app restart, proof upload, failed network retry, and completion against isolated data. |

No synthetic, browser, or device scenario above is marked PASS. No hosted state-changing RPC was called, and `ORD-000080` was not read or altered.

## 14. Exact evidence and inspection commands

Primary source: `src/modules/customer/index.tsx:9-18,816-826`; `src/modules/customer/customerTrackingPage.tsx:91-185,461-546,838-980`; `src/modules/customer/customerOrderSteps.ts:1-38`; `src/modules/customer/customerTrackingApi.ts:117-146`; `src/modules/cashier/orders/OrderDetailsDrawer.tsx:252-315`; `src/modules/cashier/services/supabaseOrderService.ts:137-197`; `src/modules/kitchen/queue/KitchenQueue.tsx:105-140,403-433`; `src/modules/kitchen/services/kdsTerminalService.ts:243`; `src/modules/rider/services/supabaseRiderService.ts:445-490,763-959,1243-1280`; `src/modules/rider/index.tsx:986-1121`; standalone `C:\Users\Janmari\Downloads\RRJ-Food-House-Rider\src\deliveryCommands.ts:30-58`.

Database source: `supabase/migrations/20261101213344_kitchen_ready_delivery_offer.sql:6-209`; `20260909120000_release_ready_order_offer_rider.sql`; `20261026194712_track_b_cancellation_rider_lock_order.sql:1-355`; `20260825183637_remote_schema.sql` for baseline Rider RPCs, policies, and partial index. Hosted catalog was queried directly on 2026-11-03 for `pg_get_functiondef`, `pg_get_function_identity_arguments`, `prosecdef`, `has_function_privilege`, `pg_policies`, `pg_enum`, and `pg_indexes`. The current hosted `release_ready_order` has the one-argument signature, so the older two-argument migration is historical. The hosted Kitchen and offer bodies match the relevant current migration shape. No hosted business rows were queried.

Representative read-only commands: `git status --short --branch`; `rg -n 'release_ready_order|advance_kds_order|offer_order_to_next_rider|accept_rider_offer|advance_rider_delivery|complete_rider_delivery' src/modules supabase/migrations`; targeted `Get-Content` ranges for the files above; `rg -n 'customer.*confirm.*deliver|confirm.*receiv' src/modules/customer supabase/migrations`. `graphify-out/graph.json` was absent, so a direct source search was used. No build or tests were run because the task forbids implementation and prior test reports remain dated evidence.

## 15. Next step and stopping point

Discuss the exact physical meaning of Release with the adviser and restaurant operators, then approve or reject the narrow wording correction. If they require two-party custody evidence, specify the actor, failure/reassignment policy, and audit requirement before designing Option C. Stop at this report; no corrective development was started.
