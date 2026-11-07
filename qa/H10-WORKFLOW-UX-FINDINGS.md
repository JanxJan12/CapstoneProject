# H-10 workflow UX findings — 2026-10-15 (Manila)

## Evidence and priority

Reviewed the H-09E post-commit report and JSON, current dirty source, active `/customer`, `/cashier`, `/kitchen`, `/manager`, `/rider` routes, and Customer Checkout. H-09E's authenticated Chrome and independent SQL confirmed that an order can commit while its HTTP response is lost. The UI then showed `Unable to place your order: TypeError: Failed to fetch`; after refresh the customer reopened Cart and re-entered all delivery details to retry the identical request. The underlying same-request database replay passed and must be preserved.

| Priority | Confirmed inconsistency | Evidence | H-10 action |
| --- | --- | --- | --- |
| P1 | A lost order response is presented as an apparent failure, although the order may exist. | [H-09E screenshot](h09e-browser-20261015/postcommit-lost-response-error.png), [H-09E report](H09E-POSTCOMMIT-IDEMPOTENCY-20261015.md). | Explain uncertainty, tell the customer to retry the same order, and label the retry action accordingly. |
| P2 | Reloading the tab requires reopening Checkout and re-entering details to reproduce the idempotency fingerprint. | H-09E browser sequence and Checkout source. | Restore the attempted delivery fields for the same authenticated customer and request ID; resume Checkout after refresh. |

Cashier, Kitchen, Manager and Rider routes and prior H-09 evidence were checked for scope. No further confirmed defect was selected without repeating H-01–H-09E regressions or changing financial, inventory, fulfillment or formal Manager request rules. Hosted Supabase remains read-only and was not contacted for H-10.

## 2026-10-16 source-only Customer checkout continuation

**P1 Customer feedback improvement implemented in the active `/customer` checkout.** Before this change, order RPC, proof upload, and payment RPC failures could place raw backend error messages in the delivery or payment alert. The current source already has an order confirmation panel, same-request retry guidance, and accessible primary button sizes, so those were preserved rather than duplicated.

`src/modules/customer/index.tsx` now keeps raw failure details in the developer console and shows customer-facing guidance that identifies whether the order or screenshot was saved and directs a retry against the same order. Explicit local validation and progressed-order messages remain visible. Network response uncertainty still marks the existing delivery retry state and retains the `Retry & Check Order` action. Order request IDs, cart fingerprinting, proof path reuse, RPC payloads, server totals, and payment state transitions were not changed.

**PASS, offline static only:** `npm.cmd run typecheck`, `npm.cmd run verify:quality` (11 checks), and `git diff --check -- src/modules/customer/index.tsx`. **NOT TESTED in this continuation:** rendered browser behavior, authenticated Supabase, Docker, device, hosted, payment, and H-16 scenarios. H-16 remains 10 PASS / 0 FAIL / 49 NOT RUN; H-16G's five `rrj_manager_lifecycle_20261014` containers remain intentionally stopped. F-05 KDS session storage risk, F-08 inactive Supplier PO authoring, F-09 H-13 interaction fixes, and production replay/recovery gates remain open for separate work. Restaurant production release remains NO-GO.
