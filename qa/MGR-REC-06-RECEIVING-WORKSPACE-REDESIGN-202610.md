# MGR-REC-06 — Receiving Document Workspace redesign

**Date:** 2026-10-24  
**Scope:** Manager Receiving frontend only  
**Recommendation:** Accept the local workspace redesign for hands-on Manager acceptance. Authenticated hosted save/post behavior was not tested.

## Starting state

The canonical repository had extensive existing uncommitted changes across the application. `StockReceivingPage.tsx` was modified, and the compact `UnifiedReceivingDocuments.tsx` register, its fixture, and QA files were untracked. Those changes were preserved. The active Receiving workspace displayed the requested quantities, reconciliation, receipt metadata, saved lines, inspection form, and review as vertically stacked panels. The register was already compact and was not redesigned in MGR-REC-06.

## Before and after workflow

| Before | After |
| --- | --- |
| All detail panels in one long document | Controlled **Inspect Items**, **Review Receipt**, and **Document Details** views |
| Requested quantities shown in separate cards above unrelated metadata | One compact requested-item table on desktop, item cards on mobile, followed by the selected item's inspection editor |
| Formal request item selected through a general inventory dropdown | The requested item row opens its saved line or a new line directly; Supplier/Emergency retains the authorized general item selector |
| Saved lines occupied space before inspection | Saved lines and stock impact appear in Review; posted receipt lines remain read-only |

## Implementation

The compact header identifies the receipt, actual Draft/Posted state, linked request revision, source, and received time. The existing Back to Receiving Documents action remains. Details contains editable header fields, provenance, notes, and request reconciliation. The stages change displayed content; they are not anchor links across one long page.

The item table maps authoritative request lines to the current receipt's saved lines by inventory item ID. It displays each item's unit, original request, previously posted acceptance for a draft, current outstanding balance, and current receipt's delivered, accepted, and rejected quantities. Historical posted receipts show **See history** for a precise pre-receipt accepted balance, because the current request aggregate cannot distinguish later receipts. Mixed units remain on separate rows.

Selecting a formal request item loads its existing saved line ID when one exists, or prepares a new line for that item. The existing quantity, rejection, lot, manufacture/use-by, secondary-unit, and notes fields remain. Quality fields are grouped in an expandable per-item region that opens when expiry or rejection details are needed. The existing local validation and authorized `saveReceivingLine` call are unchanged. Switching requested items keeps each unsaved form in local component state; Review and posting remain blocked while any item has unsaved changes. Back, refresh, removal, and document switching retain discard checks. No automatic save or post was added.

Review shows actual saved lines, requested quantities, previous posted acceptance, this receipt's delivered/accepted/rejected quantities, current outstanding, expected outstanding after posting, and expected accepted stock movement with units. The existing confirmation dialog and `postReceivingReport` safeguards remain. Posted receipts have no inspection editor, edit/remove controls, or repost action.

Supplier/Emergency creation still starts in Document Details. Its existing source selector, PO path, emergency evidence, and general item selector remain available; no requested amount is invented for unlinked receipts.

## Files changed for this assignment

- `src/modules/manager/inventory/StockReceivingPage.tsx` — controlled workspace views, compact header and item table, per-item form staging, review quantities, and navigation safeguards.
- `scripts/fixtures/mgr-rec-04-mocks.ts` — opt-in synthetic save fixture for MGR-REC-06. This file was untracked before this assignment; other fixture behavior was retained.
- `scripts/verify-mgr-rec-06-browser.mjs` — focused rendered browser and workflow checks.
- `scripts/verify-receiving-draft-authoring.mjs` — refreshed three stale source assertions to target the active unified register and stage-based workspace. The underlying migration/API assertions were retained.
- `qa/mgr-rec-06-rendered-20261024/` — synthetic screenshots and result JSON.
- This report.

`UnifiedReceivingDocuments.tsx`, Receiving RPCs, schemas, migrations, other modules, and hosted data were not edited for MGR-REC-06.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Synthetic rendered workflow | PASS | `node scripts/verify-mgr-rec-06-browser.mjs`: 1280/820/390 px, two requested items, partial prior acceptance, precision in kg, per-item unsaved state, focus/stage navigation, rejection reason guard, save/edit preserving line ID, two-line review, post gating, posted read-only, register status/page controls, Supplier/Emergency entry, no external request or network write |
| Existing draft/API source assertions | PASS | `node scripts/verify-receiving-draft-authoring.mjs` — 65/65 after updating assertions for the current UI |
| Existing posting source assertions | PASS | `node scripts/verify-receiving-posting.mjs` — 42/42 |
| Request workflow and grouping | PASS | `node scripts/verify-h23-request-workflow.mjs` — 40 checks; `node scripts/verify-mgr-rec-05-model.mjs` — pass |
| TypeScript | PASS | `npm.cmd run typecheck` |
| Production build | PASS | `npm.cmd run build` |
| Hosted authenticated acceptance | NOT TESTED | No hosted business data was read or written |

The browser test uses local synthetic services. Its opt-in save fixture creates and updates in-memory lines only. It checked that a second save reused the same line ID and kept two saved lines. It did not execute a genuine authenticated Supabase save or post. Existing server enforcement of expiry, batch, accepted-only posting, and duplicate-posting remains authoritative; the source tests inspect those contracts, while the browser run verifies only frontend behavior.

## Screenshots

- [Desktop item table](mgr-rec-06-rendered-20261024/inspection-1280.png), [tablet](mgr-rec-06-rendered-20261024/inspection-820.png), [mobile](mgr-rec-06-rendered-20261024/inspection-390.png)
- [Expanded quality details](mgr-rec-06-rendered-20261024/quality-details-desktop.png)
- [Review stage with unsaved guard](mgr-rec-06-rendered-20261024/review-stage-desktop.png), [two saved lines in Review](mgr-rec-06-rendered-20261024/saved-lines-review-desktop.png)
- [Posted read-only receipt](mgr-rec-06-rendered-20261024/posted-readonly-desktop.png)
- [Supplier/Emergency details](mgr-rec-06-rendered-20261024/supplier-emergency-details.png)

## Acceptance boundary

The Manager can resume hands-on acceptance with the existing draft and normal operational safeguards. The local tests do not establish hosted authentication, real receipt persistence, or inventory posting. No hosted business record, migration, or deployment was changed.
