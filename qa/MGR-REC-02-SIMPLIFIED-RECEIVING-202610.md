# MGR-REC-02 — Simplified linked Receiving entry (23 October 2026)

## Decision

**BLOCKED; no production code changed.** Removing both manual inputs under the existing RPC would require silently asserting who physically inspected the delivery. The available contract verifies the draft creator's active Manager role, but does not verify that this person performed the physical inspection. MGR-REC-02 expressly forbids equating those identities without an approved business policy. The existing MGR-REC-01 entry remains functional and available for local Manager testing.

## Starting state and inspected path

The `main` worktree was already dirty, including a modified `StockReceivingPage.tsx` and untracked MGR-REC-01 `AwaitingProductionDelivery.tsx`, `ManagerRequestsPage.tsx`, API, and QA files. All existing changes were preserved. The active Receiving page mounts `AwaitingProductionDelivery`; it shows an issued/partially received request and its outstanding quantities, then `Record delivery`, the inspector/note form, and `Start linked Receiving draft`. An existing draft uses the resume path. `StockReceivingPage` separately displays the physical inspector and permits optional document and line notes.

## Exact contract and attribution blocker

`start_inventory_request_receiving(uuid, integer, uuid, text, text)` in `supabase/migrations/20261012181744_manager_inventory_request_documents.sql` calls `inventory_request_manager_required()`, which checks `auth.uid()` against an active Manager profile. It writes that authenticated actor to `receiving_reports.received_by` and the event's `actor_id`. Separately, the RPC rejects a blank `p_inspected_by_name` with SQLSTATE `22023` and writes the caller's text to `receiving_reports.inspected_by_name` and the event details. The linked inspector value is immutable after creation. `p_inspection_note` becomes null when blank, so the create-draft note is optional and can be omitted without invented observations.

`AuthProvider` can present a profile first/last name, falling back to user metadata, email, or `RRJ User`. That is a display name for the authenticated account; it does not prove physical inspection. Passing it as `p_inspected_by_name` would still be a client-supplied assertion and could misattribute a delivery. Prior policy evidence in `qa/CHICKEN-DELIVERY-AS-IS-TARGET-GAP-ANALYSIS-20261013.md` explicitly distinguishes physical inspection from Manager posting and says the inspector text is a Manager attestation, not verified trained-staff identity. No reviewed rule establishes that every Manager who starts a linked draft is the physical inspector.

**Smallest required owner decision:** confirm whether the authenticated Manager who selects Start Receiving personally inspects *every* linked delivery and may be recorded as its physical inspector. If yes, separately authorize a server-side contract change that derives the inspector from authenticated identity and records the required attestation. If no, retain collection of the actual inspector at the inspection stage or separately define a deferred, verifiable inspector workflow. The present assignment forbids RPC/schema changes, so neither contract path is implemented here. Removing the note field alone would leave the requested two-field simplification incomplete while still requiring the inspector field.

## Verification and limits

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Existing RPC requirements | **PASS — source inspected** | Active Manager check, nonblank inspector, separate `received_by`, nullable/blank-to-null note, immutable linked inspector. |
| Existing browser and database baseline | **Previously PASS in MGR-REC-01; not rerun** | Prior report records 1280/390 px synthetic browser checks and a targeted disposable PostgreSQL fixture that denied blank inspector, preserved draft idempotency, and posted accepted-only stock. This was not a faithful hosted-schema replay or current MGR-REC-02 execution. |
| New automatic inspector identity | **BLOCKED** | No approved Manager-as-physical-inspector policy or server-verifiable inspector attribution in the existing RPC. |
| Simplified entry, note omission, new/resumed draft, partial delivery, authorization, duplicate posting | **NOT TESTED for MGR-REC-02** | No new implementation was made after the stop rule. Existing MGR-REC-01 evidence remains separate. |
| Desktop/mobile rendering, focused tests, TypeScript, production build | **NOT RUN for MGR-REC-02** | No UI or contract change was made; repeating the already passed baseline would not resolve the attribution decision. |
| Hosted Supabase or business records | **UNCHANGED** | No hosted read/write, migration, deployment, order, stock, or financial operation. |

## Final disposition

| Item | Result |
| --- | --- |
| MGR-REC-02 | **BLOCKED** |
| Manual Inspector Field Removed | **BLOCKED** |
| Manual Condition Note Removed | **NOT IMPLEMENTED** |
| Inspector Attribution Integrity | **BLOCKED for automatic attribution; existing manual attribution preserved** |
| Linked Draft Creation | **NOT TESTED for new path** |
| Existing Draft Resume | **NOT TESTED for new path** |
| Authorization | **NOT TESTED for new path** |
| Stock Posting Integrity | **NOT TESTED for new path** |
| Desktop/Mobile Rendering | **NOT TESTED for new path** |
| Focused Tests | **NOT RUN** |
| TypeScript | **NOT RUN** |
| Production Build | **NOT RUN** |
| Hosted Business Data Modified | **NO** |
| Migrations | **NONE** |
| Deployments | **NONE** |

Only this report was added. Existing local MGR-REC-01 manual Manager acceptance may continue using the current physical-inspector entry; acceptance of the simplified MGR-REC-02 interaction cannot begin until the owner attribution decision and any separately approved contract work are complete.
