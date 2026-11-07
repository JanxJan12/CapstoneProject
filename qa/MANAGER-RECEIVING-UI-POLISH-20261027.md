# Manager Receiving UI polish — 2026-10-27

## Scope and result

One focused polish of the existing three-column Inspect workspace. Requested-item cards use tighter padding and spacing while retaining requested, previously posted, outstanding, and this-draft quantities. The draft progress rail shows a consistent requested-item fraction alongside saved-line count. Saved Delivery Details show receipt number, linked request, source identity, stock status, and provenance while secondary editable fields and document notes start collapsed behind a native, keyboard-accessible expand control. New-document fields remain open so the required creation inputs are visible. The Review saved lines action sits in the right rail after Saved Receiving Lines at wide desktop widths, rather than as a full-width card below the workspace.

The Inspect → Review → Post sequence and existing validation, draft save/resume, quantity math, provenance, posting controls, and Supabase contracts were not changed. No hosted Supabase, migration, six-table retirement, KDS, or other module was changed. Existing unrelated dirty work was left in place.

## Exact files changed in this pass

- `src/modules/manager/inventory/StockReceivingPage.tsx` — compact cards, progress wording/count, collapsible secondary delivery fields, Review action class.
- `src/styles/theme.css` — card overflow handling and wide-desktop Review action placement.
- `scripts/verify-mgr-rec-ux-02-browser.mjs` — current screenshot output folder and assertions for default collapse, source visibility, Enter-key toggle, and right-rail Review placement.
- `qa/MANAGER-RECEIVING-UI-POLISH-20261027.md` — this report.
- `qa/manager-receiving-ui-polish-20261027/` — generated synthetic browser screenshots and result JSON.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `node scripts/verify-receiving-draft-authoring.mjs` | PASS — 65/65 source checks |
| `node scripts/verify-receiving-posting.mjs` | PASS — 42/42 source checks |
| `node scripts/verify-receiving-batch-foundation.mjs` | PASS — 48/48 source checks |
| `node scripts/verify-request-proposal-contract.mjs` | PASS |
| `node scripts/verify-h23-request-workflow.mjs` | PASS — 40 checks |
| `node scripts/verify-mgr-rec-ux-02-browser.mjs` with `scripts/fixtures/mgr-rec-04.config.ts` | PASS — disposable mocked fixture at 1440, 1280, 820, and 390 px; draft, Review, synthetic Post, overflow, focus, source visibility, keyboard expand/collapse, and placement assertions; zero network writes |
| `git diff --check` on changed source and verifier files | PASS |
| Hosted Manager authentication and real stock posting | NOT RUN — outside this UI-only pass |
| Database or hosted Supabase changes | NOT RUN — outside scope |

Screenshots: [1440 Inspect](manager-receiving-ui-polish-20261027/inspect-1440.png), [1280 Inspect](manager-receiving-ui-polish-20261027/inspect-1280.png), [820 Inspect](manager-receiving-ui-polish-20261027/inspect-820.png), [390 Inspect](manager-receiving-ui-polish-20261027/inspect-390.png), [1440 Delivery Details and Review action](manager-receiving-ui-polish-20261027/details-1440.png).

The browser fixture uses synthetic in-memory data. Its Post checks establish only the local mocked flow; they do not establish hosted exactly-once posting or physical stock results.
