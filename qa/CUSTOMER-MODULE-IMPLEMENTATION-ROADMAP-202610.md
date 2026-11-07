# Customer module implementation roadmap — 22 October 2026

## Decision and boundaries

This is a proposal for later approval, not implementation authorization. No P0 or P1 defect was established by this audit. Current source/build/cart checks pass; rendered and authenticated acceptance is still incomplete. Keep all changes in the active Customer module unless a reviewed, read-only backend fee contract is genuinely required. Preserve `place_customer_order` idempotency, `submit_customer_payment`, RLS, stored order-line snapshots, Fixed Meal Options, required drink choices, and operational module contracts. Do not restore retired modifier tables or configure Chicken Biryani rice without approved quantities.

## Focused sequence

| Batch / priority | Work and dependencies | Relative effort | Acceptance and regression gate |
|---|---|---|---|
| 0 / evidence gate | Restore an authorized browser surface; record guest and authenticated Customer viewports at 320, 360, 390, 430, 768, 1024, 1440. Use safe navigation only; use disposable data for submit/payment cases. This precedes claims about responsive or visual defects. | Medium | Identifiable screenshots, keyboard/focus/zoom notes, no production transaction. |
| 1 / P2 first | CUST-01: map menu/tracking/history/profile/load errors to safe text with retry/session-specific copy. CUST-02: reconcile open detail with refreshed menu data and keep choice/price selection coherent. | Medium | Inject network, permission, menu price and availability changes in a controlled fixture. UI shows safe recovery and refreshed amount; unchanged RPC payload and server total authority. |
| 2 / P2 | CUST-06 tracking stale/reconnect marker and CUST-04 safe view URL state. Requires Batch 0 browser harness and Batch 1 stable error states. | Medium–Large | Refresh/back and disconnect/reconnect restore owned view, no duplicate channel, no cross-account data. |
| 3 / P2 | CUST-05 fee display: confirm supported source for estimate; if none, present fee as pending until order RPC responds. Extract one Customer data/reconciliation concern at a time to reduce CUST-03 coupling. | Medium | No client financial authority; cart, detail, checkout, tracking, history regression tests and build pass. |
| 4 / P3 | CUST-07 mobile text sizing and measured visual polish from Batch 0. | Small–Medium | 320–1440 px, 200% zoom, WCAG 2.2 AA checks pass for affected views. |

## P0/P1 and future findings

No P0/P1 repair is queued because no such failure was confirmed. If the browser/JWT gate reveals a blocked critical journey, unauthorized read, or wrong charged total, stop this planned sequence, record a new evidence-backed finding, and prioritize that result. A catalog policy is not proof of hostile-session denial.

## First implementation batch to request approval for

**Batch 1: Customer error recovery and current detail pricing.** Likely files: `src/modules/customer/index.tsx` and focused Customer-only test scripts. Touch the shared Supabase client only if a narrow, reviewed change is necessary. User benefit: understandable failure messages and no stale product price/choice display after menu refresh. Regression risks: cart line identity, With/Without Rice pricing, required drink selections, availability refresh, OAuth return, order retry and authoritative RPC totals. Acceptance: source tests for injected error mapping and refresh scenarios, existing three cart checks/typecheck/build, then actual guest/mobile and authenticated browser review once the browser gate is available. No hosted order submission is required for this batch.

## Definition of done for any approved batch

1. Preserve user worktree and document exact diff, changed contracts, and rollback path.
2. Demonstrate the affected state with a real browser or a clearly labeled disposable fixture; never substitute a mock screenshot for rendered evidence.
3. Run Customer checks, typecheck, quality, and build; add targeted tests only for changed business behavior.
4. Recheck guest access, customer role gating, server-authoritative prices, cart variants, checkout request IDs, payment retry, owned tracking/history snapshots, and operational compatibility relevant to the change.
5. Report PASS/FAIL/PARTIAL/NOT TESTED/BLOCKED separately for source, fixture, browser, and hosted evidence. Do not call the Customer journey fully accepted while browser and authenticated end-to-end gates remain open.
