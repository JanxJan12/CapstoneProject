# Customer Module Batch 2 implementation — 22 October 2026

## Executive summary and status

**COMPLETE for the authorized local implementation; full authenticated runtime acceptance is NOT TESTED.** The active Customer tracker now distinguishes loaded data from confirmed Realtime connectivity, keeps the last successful order snapshot after a refresh failure, offers a read-only manual retry, and refetches after a subscription reconnect. Customer view and optional tracking order ID are represented by validated `/customer?view=...` query state. No database or hosted business record was changed.

## Active architecture and changed files

`src/app/routes.tsx` mounts `CustomerApp` at `/customer`. Its Customer views are local React state; this batch synchronizes supported top-level views with React Router search state. `TrackingPage` reads `orders`, `order_status_history`, `order_items`, and the existing `get_customer_order_payment` RPC. It listens to filtered `orders UPDATE` and `order_status_history INSERT` Realtime changes and then re-reads the authoritative records. The order ID in a URL is a selector only; the existing Supabase authentication, RLS and payment RPC authorization remain the read boundary. No new write path or status transition was added.

- `src/modules/customer/index.tsx`: guarded tracking refresh, subscription status/retry/cleanup, stale snapshot and manual refresh UI, signed-out gate, top-level URL synchronization and sign-in return.
- `src/modules/customer/customerTrackingUrl.ts`: validated view/order query parsing and canonical URL generation.
- `src/modules/customer/customerTrackingRefresh.ts`: coalesced refresh queue with disposal.
- `scripts/verify-customer-batch-2.mjs`: focused deterministic helper tests.
- This report.

The Customer index file had pre-existing uncommitted Batch 1 and earlier changes. They were preserved. No operational module, migration, shared client, or hosted object was edited for Batch 2.

## Tracking connection and refresh behavior

Initial loading displays a loading card. A successful read displays the server's current status, payment, items and timeline; the small indicator says **Updates connected** only after Realtime reports `SUBSCRIBED`. Before that confirmation it says **Checking for updates**. A refresh displays **Updating**. Channel failure or timeout marks cached data stale and schedules at most three spaced reconnect attempts; offline state is based on the browser network signal and is not treated as proof of backend health. A confirmed subscription, including a reconnection, queues a full authoritative refetch. Focus, visibility return and online events recover a missing channel and refresh stale or older data without a polling loop.

One refresh queue coalesces event bursts into one follow-up read. Its disposal, the effect's active guard, and a component key scoped to Customer session and selected order prevent an old request or channel callback from publishing into another order's view. The effect removes its channel, timer and browser listeners on order switch, navigation away, and logout. Manual Refresh status is a read-only action and is disabled while a read is in progress.

After a failed read, the prior order snapshot remains visible with a text warning that its latest status is unconfirmed. Before any successful read, the existing safe Batch 1 error text and retry card appear. An explicit order ID that produces no readable order displays the same **Order unavailable** state whether absent or inaccessible. Completed, delivered, cancelled, and rejected statuses still come from the backend's existing status model. No inferred advancement or delivery estimate is shown. The indicator uses text and `role="status"` with polite announcements; recovery controls retain 44 px minimum height and existing focus styling patterns.

## URL state and ownership

Supported queries are `?view=home|menu|cart|checkout|tracking|history|profile`, and `?view=tracking&order=<UUID>`. Bare `?view=tracking` selects the latest readable order. Malformed UUIDs, unsupported views, duplicate parameters, extra parameters (including token-like keys), and order IDs on other views are rejected before a tracking query; invalid tracking links replace history and show a small explanatory notice. Canonicalization uses `replace`. Internal top-level navigation creates history entries so Back/Forward and reload can restore the view. A direct signed-out protected view shows a sign-in gate, not the data component. Tracking links are stored only as a validated tab-local return query while going through the existing Customer login route, then restored after sign-in. Sign-out clears that pending return and unmounts tracking. No access token, personal contact value, or payment proof path is serialized.

The client never treats URL validity as ownership. An order query still uses the current authenticated Supabase session and RLS. Payment, item and history reads occur only after that order query returns a readable order. A valid but stale/foreign UUID has a uniform unavailable presentation. **Cross-account denial was not executed against an isolated authenticated backend** in this batch; source flow and helper tests do not prove hosted RLS enforcement.

The existing no-query checkout resume/retry state remains the initial-page precedence. A successful checkout's local confirmation is retained after its cart clears. Product detail remains a local subview under its existing Home/Menu navigation and was not converted to a new deep-link format.

## Tests and evidence

| Command or check | Result | What it proves |
|---|---|---|
| `node scripts/verify-customer-batch-2.mjs` | **PASS** | 19 URL parser/canonicalization assertions and 6 refresh-queue assertions: burst coalescing, manual follow-up, disposal, and separate old/new view queues. These are deterministic helper tests, not a mounted React or Realtime test. |
| `node scripts/verify-customer-batch-1.mjs` | **PASS** | Existing safe errors, current product/price/availability and stale-response helper checks. |
| `node scripts/verify-customer-drink-cart.mjs` | **PASS** | Existing Customer ordinary product, required drink, authoritative drink refresh and fixed-meal cart checks. |
| `node scripts/verify-fixed-meal-cart.mjs` | **PASS** | Existing POS fixed-meal cart fixture; compatibility only. |
| `node scripts/verify-drink-choice-cart.mjs` | **PASS** | Existing POS drink-choice cart fixture; compatibility only. |
| `npm.cmd run typecheck` | **PASS** | TypeScript, exit 0. |
| `npm.cmd run verify:quality` | **PASS** | Existing 11-check baseline, exit 0. |
| `npm.cmd run build` | **PASS** | Vite production build, 3,032 modules, exit 0. |
| `git diff --check -- src/modules/customer/index.tsx` | **PASS** | Scoped tracked-file whitespace check; Git emitted its LF/CRLF working-copy warning. New untracked files were separately inspected. |

### Not tested in this environment

- Mounted tracking effect states: initial read, failed initial read, cached-data failure, manual retry, channel status and reconnect, channel cleanup, Back/Forward, reload, and signed-out return in a rendered app. The focused tests cover only the URL and queue helpers used by that effect.
- Authenticated ownership/RLS denial with two synthetic Customer accounts; no hosted account probing or production order was created.
- Actual payment RPC and historical order-line presentation during tracking; prior server contracts were preserved in source but not exercised by this batch.
- Browser viewports 360×800, 390×844, 768×1024, and 1440×900, overflow, scrolling, keyboard focus, and screenshots. `cua.getState()` returned `apps: []`, `browsers: []`; no browser surface was available. No screenshot is claimed.

## Scope and decision

Batch 2 local implementation and available static/helper/regression gates are complete. The browser and isolated authenticated acceptance gates remain open, so this is **not** a full Customer Module production-readiness decision. No SQL deployment or hosted data mutation was performed. The next bounded roadmap priority, after authenticated/browser acceptance, is Batch 3's Customer delivery-fee display contract; it was not started here.
