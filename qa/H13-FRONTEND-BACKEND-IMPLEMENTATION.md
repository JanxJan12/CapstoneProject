# H-13 Receiving document list consistency — 2026-10-16 Manila

## Contract and change

The active `/manager` route requires a Manager role and mounts `StockReceivingPage` through Manager Inventory navigation. Its `ReceivingDocumentList` calls `getReceivingDocuments(filters, offset, 20)` in `receivingApi.ts`. That service requests `get_manager_receiving_documents` with search/status/source/Manila-date/offset/limit parameters and, for nonempty pages, `get_receiving_policy_classes` to label formal, historical and emergency reports. The locally versioned definitions are `20261005082921_manager_inventory_workspace_reads.sql` and `20261013053159_production_delivery_policy.sql`. Both functions check an active Manager profile. The read projects `receiving_reports` and report-item counts/totals, with PO/supplier joins; classification uses stored formal/legacy/emergency links. Posting remains `post_receiving_report` and is outside this change.

**Defect:** the component's rejected read set an error but retained its previous `rows` and `hasMore`. A new filter or page could therefore show documents from an earlier successful query beneath the new filter controls. Classification failure had the same effect. The user could select a stale row and had to change filters or leave the page to retry.

**Change:** on a rejected list or classification read, clear the displayed rows and `hasMore`, retain the error, and offer **Try again** for the same filters/page. Do not show the empty-result message on error. An effect-local `active` flag already prevents older responses from overwriting a later query; it continues to cover retry. No table, RPC, grant, stock writer, formal request, or migration was changed.

## Exact H-13 files

| File | H-13 edit |
| --- | --- |
| `src/modules/manager/inventory/ReceivingDocumentList.tsx` | Clear stale page state on failure, add retry trigger/button, distinguish failure from valid empty results. This file was pre-existing and untracked in the dirty checkout; H-13 edited it in place. |
| `qa/H13-FEATURE-COMPLETION-PRIORITIES.md` | Selected/deferred priorities and active contract mapping. |
| `qa/H13-FRONTEND-BACKEND-IMPLEMENTATION.md` | Contract, change and file inventory. |
| `qa/H13-FOCUSED-REGRESSION.md` | Focused checks and remaining acceptance boundary. |
| `qa/FULLSTACK-INCONSISTENCY-REGISTER.md` | One H-13 entry only. |

No backend migration is necessary. Any future additive backend change requires separate review of its SQL, RLS/grants, role denials, clean replay provenance and deployment authorization. Hosted project `zhzluhqvysvsadwuugpa` was not accessed.
