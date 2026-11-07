# MGR-REC-05 — Unified Receiving Documents

**Date:** 2026-10-24  
**Scope:** Manager Receiving frontend only  
**Recommendation:** Accept the frontend change for hands-on Manager acceptance testing. Authenticated hosted behavior remains untested in this assignment.

## Starting state and problem

The canonical repository had a large pre-existing dirty worktree across Manager, Cashier, Customer, Kitchen, app, and QA files. The MGR-REC-04 queue showed an Awaiting Production Delivery section and a separate Receiving Documents section, requiring the Manager to choose between two receiving entry points. Existing Receiving and Request Center changes, including untracked MGR-REC-04 fixture files, were preserved.

## Implementation

- The queue now has one **Receiving Documents** area. Issued or partially received requests with an eligible next delivery appear as virtual `request:<request.id>` rows. Persisted receipt records remain `receipt:<report.id>` rows; no database records or statuses were added.
- The adapter uses the existing `requestWorkflow` eligibility and authoritative request register. A linked open draft is represented by its request row with **Resume Receiving**. A standalone receipt row for that same draft is suppressed in the primary view, with **Show all receipt records** exposing it. Posted receipts, including multiple linked receipts, and Supplier/Emergency receipts remain separate records.
- **Record Delivery** re-reads the request register, checks the current revision and draft, and then presents an explicit **Start Receiving** step. The existing linked-draft RPC, retry UUID, conflict recovery, and focused workspace are reused. List loading and refresh do not create a draft. The pre-existing hosted draft `RR-20261024-E3761566` was neither read nor changed; synthetic tests exercised the same draft-resume shape.
- The focused workspace immediately shows requested item, unit, original quantity, previously accepted quantity for an open draft, current outstanding, and this receipt's delivered/accepted/rejected values. The inline review also shows requested, delivered, accepted, rejected, outstanding now, and projected outstanding after posting. Existing inspection validation, save, review, post, and posted read-only paths remain in place.

## Search, filters, and history

Request numbers are searched against the full returned request register. Receipt number and source-reference search, status/source/received-date filters, and 20-record receipt pages continue through `get_manager_receiving_documents`. A receipt-number search shows a linked draft even when its request row is normally primary. The four status views are All, Awaiting Delivery, Draft, and Posted. Partially received requests that can take another delivery remain visible in All and Awaiting Delivery.

The receipt page count and Next/Previous controls refer only to server-paginated receipts. No combined total or global ordering is claimed. Received-date filters apply only to receipts and hide virtual request rows, because a request's **needed date** is a different field. The UI states this explicitly. For an old posted receipt, the request register cannot establish how much had been accepted *before that particular receipt* if later receipts exist; its compact quantity view points to receipt history rather than inventing a previous balance. Hosted authentication and large-data pagination were not exercised.

## Before and after

| Before | After |
| --- | --- |
| Separate Awaiting Production Delivery and Receiving Documents sections | One Receiving Documents register with explicit request and receipt types |
| Open request needed a separate card section | Eligible request is the primary delivery action row |
| Linked draft and request could compete as tasks | One operational row; actual draft available through history, search, or full-record toggle |
| Requested quantities were in a collapsed follow-up area | Requested and current inspection quantities appear at the top of the focused workspace |

## Files changed for MGR-REC-05

- `src/modules/manager/inventory/StockReceivingPage.tsx` — unified queue connection and quantity presentation.
- `src/modules/manager/inventory/UnifiedReceivingDocuments.tsx` — register UI and guarded start/resume.
- `src/modules/manager/inventory/unifiedReceivingModel.ts` — typed virtual request and actual receipt identities/grouping.
- `scripts/fixtures/mgr-rec-04.config.ts`, `scripts/fixtures/mgr-rec-04-mocks.ts` — local fixture interception and a synthetic supplier receipt. These fixture files existed untracked before this assignment.
- `scripts/verify-mgr-rec-05-model.mjs`, `scripts/verify-mgr-rec-05-browser.mjs` — focused synthetic tests.
- `qa/mgr-rec-05-rendered-20261024/` — screenshots and browser result.
- This report.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Adapter and request workflow | PASS | `node scripts/verify-mgr-rec-05-model.mjs`; `node scripts/verify-h23-request-workflow.mjs` (40 checks) |
| Mocked browser | PASS | `node scripts/verify-mgr-rec-05-browser.mjs`: issued, partial, full/closed, draft grouping/resume, prior receipt history, search, status/source filters, receipt pagination, error view, posted read-only, no browser exception, no external request or network write |
| TypeScript | PASS | `npm.cmd run typecheck` |
| Production build | PASS | `npm.cmd run build` |
| Hosted Manager acceptance | NOT TESTED | No hosted business data was read or written; no authenticated session test was run |

The browser uses local synthetic services. It called the mocked start function once after explicit confirmation and zero times on page load or draft resume. No stock movement was simulated before posting. The posted receipt had no visible inspection editor or review/post control. Existing rejection, expiry, and duplicate-post enforcement was preserved in the unchanged form/RPC path; those policies were not revalidated against hosted data here.

## Rendered screenshots

- [Unified desktop](mgr-rec-05-rendered-20261024/unified-list-1280.png), [tablet](mgr-rec-05-rendered-20261024/unified-list-820.png), [mobile](mgr-rec-05-rendered-20261024/unified-list-390.png)
- [Awaiting request](mgr-rec-05-rendered-20261024/awaiting-request.png) and [existing draft](mgr-rec-05-rendered-20261024/existing-draft-1280.png)
- [Focused inspection desktop](mgr-rec-05-rendered-20261024/inspection-workspace-1280.png) and [mobile](mgr-rec-05-rendered-20261024/inspection-workspace-390.png)
- [Posted read-only receipt](mgr-rec-05-rendered-20261024/posted-readonly.png)

## Acceptance boundary

Managers can resume hands-on acceptance in the existing authenticated environment, starting with the existing linked draft and using real inventory only according to their normal operational procedure. This assignment performed no hosted business mutation, migration, or deployment. The frontend behavior is ready for that acceptance; hosted correctness is not claimed from synthetic tests.
