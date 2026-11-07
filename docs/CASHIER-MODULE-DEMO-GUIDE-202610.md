# RRJ’S FOOD-HOUSE Cashier Module — Capstone demonstration guide

**Use:** a short, read-only presentation of the implemented Cashier workflow. Confirm the live environment before showing any record; the October 21 observations below may change. Do not create a production sale, verify/reject a real payment, or close a shift for demonstration.

## Preparation checklist

1. Run the application and sign in through the normal flow with an existing **active Cashier** account. Confirm `.env.local` points to project `zhzluhqvysvsadwuugpa`; do not display its keys or session tokens.
2. Check that the Cashier route loads and that data comes from the intended hosted project. Prepare a desktop viewport for tables and a mobile viewport only if the panel asks for responsive behavior.
3. Confirm appropriate existing demonstration records are still present. On October 21, the supplied screenshots showed two completed Cash receipts (`RCP-000041`, `RCP-000042`), one pending online GCash order (`ORD-000061`), an open shift, and five saved closed shifts. Treat these as examples, not guaranteed fixture data.
4. Keep a temporary private download folder ready for CSV. Do not put a real CSV containing customer/financial data in a public repository, slide deck, or shared QA artifact. If a download is unavailable, use the synthetic export test output and explain its scope.
5. Have `qa/CASHIER-POST-DEPLOYMENT-ACCEPTANCE-202610.md` and `docs/CASHIER-MODULE-FINAL-DOCUMENTATION-202610.md` available for evidence and limitations. Prepare only already verified, appropriately redacted screenshots as an offline fallback.

## Recommended live sequence and presenter notes

| Step | Show | Explain in plain language | Safe boundary |
| --- | --- | --- | --- |
| 1. Dashboard | Active shift and work queue/attention cards. | “The dashboard brings the Cashier’s current shift and tasks together. The pending-payment notice directs attention to an unresolved submission.” | Do not infer settlement from a counter. |
| 2. Walk-in POS | Menu, item/modifier selection interface, basket and shift gate. | “For a real sale, the database validates available items and calculates the final recorded total; the screen collects the Cashier’s choices.” | Stop before submitting a new sale. |
| 3. Pending Payments | Existing pending GCash row, details and proof view if suitable for the audience. | “Staff manually compare a submitted proof with merchant records. A customer upload is not an automatic GCash confirmation.” | Do not approve/reject; avoid showing private proof or contact details on a public recording. |
| 4. Order List | Current work, status columns/cards and older backlog view. | “The Cashier can monitor order, payment and fulfillment progress without rewriting historical statuses.” | Do not release, cancel, assign a Rider or edit an order. |
| 5. Transaction History | Completed Cash records, summary, detail drawer, and receipt preview. | “The displayed completed-sales total comes from recorded completed transactions. A pending GCash submission does not count as revenue. Receipt preview is separate from printing.” | Do not invoke Print unless the panel specifically needs the browser dialog and a safe printer is selected. |
| 6. Export CSV | Set a narrow filter, click Export CSV once, inspect the private downloaded file’s header and matching rows. | “The export pages through authorized historical transactions, uses the active filters and recorded amounts/statuses, and protects spreadsheet cells. It reports failure instead of returning a partial file.” | This corrected download has synthetic automated proof but no authenticated hosted-browser result yet; if it fails, state that plainly. Do not publish the CSV. |
| 7. Shift Settlement | Opening/expected cash, pending closure notice, saved shifts and one read-only detail card. | “Closure needs a physical count and backend validation. A pending online GCash item blocks closure; closed shift details are stored settlement facts.” | Do not enter a count or submit Close Shift. |

**Suggested timing:** about 1 minute each for Dashboard/POS/Payments/Order List, 2 minutes for Transaction History and CSV, 2 minutes for Shift Settlement, then questions.

## Questions a panel may ask

| Question | Answer grounded in the implementation |
| --- | --- |
| “Can Cashiers change payment totals from the browser?” | Sale and verification mutations use server RPCs; POS totals and linked records are computed/validated by PostgreSQL. The export reads recorded values. |
| “Does a GCash screenshot mean the money arrived?” | No. It is a submitted proof that requires manual comparison and an authorized verification action. No automatic gateway settlement is implemented. |
| “What prevents duplicate receipts or duplicate closing?” | Server request IDs, unique linked identifiers, state checks and row locks protect sale/payment transitions; the close RPC updates one open shift and a repeat close is rejected in isolated P1 tests. |
| “What happens when a payment is pending at closing time?” | The deployed server-side close RPC rejects the settlement. The UI also warns, but the backend guard is the authoritative restriction. |
| “Why may CSV show more rows than the visible list?” | The visible Transaction History is populated from current-shift hydration; export independently pages all historical rows allowed to that Cashier and applies the selected filters. |
| “Can a deactivated Cashier keep reading records with an old token?” | The deployed direct-read policies consult the current active profile. A disposable PostgreSQL test proved own-row reads disappeared after deactivation with the same claim; a hosted JWT/PostgREST replay was not performed in this finalization. |
| “Are old settlements immutable?” | Their values are stored and read-only in the Cashier interface, but an extra database trigger for stronger closed-snapshot immutability is deferred P2 work. |

## Evidence and fallback plan

- **Internet or Supabase unavailable:** stop live operations. Show redacted, previously verified Cashier screenshots and cite the October 21 acceptance addendum. Identify them as earlier observations, not a live service result.
- **Authentication unavailable:** do not forge a session or use a service-role key. Show the architecture, code-backed workflow and QA report; mark live authenticated demonstration **NOT TESTED**.
- **Payment review unsafe:** keep the existing pending item unchanged. Explain the manual verification steps from the page and the server controls without pressing Verify or Reject.
- **No safe new transaction:** demonstrate the POS interface and existing receipt/transaction records. Existing synthetic QA artifacts can support the sale/idempotency explanation; they are not proof of a new hosted sale.
- **CSV download unavailable:** run or show the output of `node scripts/verify-cashier-transaction-export.mjs` and the export code path. Describe it as synthetic verification; do not claim a successful hosted browser download.
- **Receipt printer unavailable:** use receipt preview only. The Print control opens the browser print dialog; physical paper output was not verified in this pass.

## Final presenter reminder

Keep claims aligned to evidence: local automated checks, isolated PostgreSQL security/concurrency tests, read-only hosted catalog checks, and the owner's authenticated screenshots are different forms of proof. The corrected CSV still needs one genuine authenticated browser download before calling that interaction fully accepted. Older migration-history discrepancies and the deferred P2 snapshot guard remain separate follow-up work.
