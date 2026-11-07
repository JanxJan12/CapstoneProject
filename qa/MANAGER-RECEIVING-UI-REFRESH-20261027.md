# Manager Receiving workspace UI refresh — 2026-10-27

## Scope and result

Updated the mounted `StockReceivingPage` draft screen in one focused pass. At wide desktop widths, requested items, inspection inputs, and draft status/saved lines/delivery details occupy three columns. The existing two-column layout applies at intermediate widths, and the workspace stacks at tablet and mobile widths. The mobile Inspect → Review → Post header now stays on one row. Requested-item selection has a pressed state and an item-specific accessible name; the draft shows a saved-item count and progress bar. The line action reads **Save Line to Draft**.

The existing controls still handle delivered, accepted, calculated rejected, secondary quantities, lot, expiry, rejection reason, notes, document details, line edit/removal, draft save/reopen, linked requests, and provenance. Posting remains in the Review stage behind the existing readiness checks and confirmation dialog. No Post action was added to Inspect. The mockup's compact right rail is approximated with the existing saved-line cards and delivery-details section; these retain their full operational fields. The queue, posted view, and other roles were not redesigned.

Files changed for this pass: `src/modules/manager/inventory/StockReceivingPage.tsx`, `src/styles/theme.css`, and the two Receiving verifiers whose literal button label/current emergency-entry expectation needed updating. No schema, migration, Supabase hosted data, or infrastructure changes were made.

## Verification

- `npm run typecheck` — passed.
- `npm run build` — passed.
- `node scripts/verify-receiving-draft-authoring.mjs` — 65/65 passed after updating the button-label assertion.
- `node scripts/verify-receiving-posting.mjs` — 42/42 passed.
- `node scripts/verify-receiving-batch-foundation.mjs` — 48/48 passed.
- `node scripts/verify-request-proposal-contract.mjs` — passed.
- `node scripts/verify-h23-request-workflow.mjs` — 40 checks passed.
- `node scripts/verify-mgr-rec-ux-02-browser.mjs` — passed against the repository's disposable, mocked local Vite fixture at **1440, 1280, 820, and 390 px**. It exercised register → linked draft, selection, validation, save/edit, Review, synthetic post, posted read-only state, focus, and no document overflow. It made no network writes. The verifier was updated for the new label, added 1440 px, and aligned its emergency-entry assertion with the currently mounted source selector.
- `git diff --check` for changed source and verifier files — passed.

Screenshots: [1440 draft](manager-receiving-ui-refresh-20261027/inspect-1440.png), [1280 draft](manager-receiving-ui-refresh-20261027/inspect-1280.png), [820 draft](manager-receiving-ui-refresh-20261027/inspect-820.png), [390 draft](manager-receiving-ui-refresh-20261027/inspect-390.png), [Review](manager-receiving-ui-refresh-20261027/review-1440.png), [posted](manager-receiving-ui-refresh-20261027/posted-1440.png).

## Limits and follow-up

The browser run used synthetic, in-memory fixture data. It does not establish hosted Manager authentication, real draft persistence, or a real exactly-once stock posting outcome. The source and fixture checks cover the corresponding UI and service contracts without writing hosted data. The reported missing-name Start Receiving case was not independently reproduced in this bounded UI pass, so no speculative behavior change was made. Reproduce that case with its exact request/document and Manager session before changing the start flow.
