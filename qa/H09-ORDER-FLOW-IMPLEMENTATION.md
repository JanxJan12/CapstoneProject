# H-09 isolated implementation

**Date:** 2026-10-15 Manila. Work was done in the dirty canonical `C:\Users\Janmari\Downloads\Capstone Project` checkout without resetting it. The standalone Rider repository and APK were not changed. Hosted `zhzluhqvysvsadwuugpa` remained read-only.

## Scoped source change

`src/modules/customer/index.tsx` now tracks completion of the initial saved-cart modifier check. On resumed Checkout, the create-order action is disabled until choices are refreshed. An invalid saved option shows a Review cart action; proceeding from Cart invokes the existing option and effective-availability refresh. The handler also checks the gate before `place_customer_order`. An already-created order with pending payment remains retryable because its persisted server snapshot is the authority, not the current cart. No SQL, price formula, payment/stock writer, role grant, or migration changed.

The server still validates required/optional options, availability, price and idempotency. The cart total remains an estimate; only the server response is labelled confirmed. The [regression](H09-ORDER-FLOW-REGRESSION.md) records a rendered authenticated Chrome check of this guard.

## Isolated diagnostic environment

`.tmp/h09-stack-20261015/supabase` uses project ID `rrj_h09_order_flow_20261015`, loopback API/DB ports `48321`/`48322`, and 53 migrations. One extra synthetic historical prerequisite lets the original chain run past Phase 2A for diagnosis; this is not production provenance or clean 51-file replay. All 52 current canonical migration files matched their disposable copies by SHA-256 in the [hash manifest](H09-ORDER-FLOW-MIGRATION-HASHES.json) after a stale copied numeric-input file was replaced with the current canonical byte copy. No canonical migration was changed.

The diagnostic stack contains newly created synthetic Auth identities, private one-pixel PNG proof objects, menu/option fixtures, orders, receipts and assignments. A separate recipe test used a clearly labelled **10-unit synthetic opening batch in this disposable database only**, yielding 9 after one verified sale. These quantities are not a business baseline. Focused probe scripts and sanitized result files remain under `.tmp/h09-stack-20261015`; Customer and partial Cashier screenshots are under `qa/`. Existing demo stacks, volumes, private proof assets, backups and Rider APK were not removed or reset.

Initial startup encountered Docker engine HTTP 500; normal Docker Desktop restart recovered without deleting volumes. Windows had reserved the first candidate port range, so the new stack used 48321/48322. Local Auth later timed out during a broader Cashier browser retry. No forced container cleanup or hosted operation was used.

## Review and rollback

The frontend change is confined to the new checkout validation state, guard and message in `customer/index.tsx`. Reverting those lines restores the prior Checkout timing and its stale-cart UX gap; server checks remain. The disposable H-09 stack can be retained for inspection and rerun; it is not a migration or production recovery artifact. The original 51 migrations and additive H-08C migration remain intact.
