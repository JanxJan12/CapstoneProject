# M3.2C-A opening-stock reconciliation — owner decision pending

**RRJ's Food-House / RRJS-Foodhouse-Final (`zhzluhqvysvsadwuugpa`). UNSIGNED.** This is a read-only interpretation of a later October 13 export. It does not establish an original physical stock count or authorize any stock entry.

## Source and chain

Source E1: `%LOCALAPPDATA%\RRJ-Private-Backups\Supabase-20261013-062110\data.sql`, 188,003 bytes, SHA-256 `9FD18E166AAEF422F5BF8B7B6178642B1D7D02E61148D984EC29A9B1EF65B114`. The related `public-only-data.sql` in the October 13 recovery supplement has SHA-256 `5783653FD18968C141952FA44F4E3EACBA63D1AD397C6EAF122954FD762E4FB2`; its relevant inventory/master-data COPY sections are byte-identical to E1, so it is a second copy, **not independent evidence**. The main and supplement manifests hash-match, but integrity does not prove historical authenticity.

The `inventory_opening_balances` COPY has **zero rows**. Of 43 `inventory_transactions` rows, exactly these three have `created_at` before 2026-09-04. All refer to Rice, inventory UUID `a3355239-1a21-4459-b80d-a174164872b9`, whose recorded unit is kg. Times are export timestamps in UTC; Manila is UTC+8.

| Source line; transaction UUID | Recorded UTC time (Manila time) | Type and recorded reason | Change; before → after | Linked evidence |
| --- | --- | --- | --- | --- |
| E1:665; `0340ad29-3bc8-457f-ade6-ce82ff453b3d` | Aug 31 15:50:59 (Aug 31 23:50:59) | `receiving`; “Opening stock” | +20 kg; 0 → 20 kg | No purchase-order item, order, batch, opening-balance ID or mutation-request ID. |
| E1:666; `78c0e8ff-bdff-4717-a50f-f57d6d07ac27` | Aug 31 16:01:39 (Sep 1 00:01:39) | `adjustment`; “Physical count correction” | +2 kg; 20 → 22 kg | Same missing links. |
| E1:667; `15a006fe-d8d7-461c-80aa-b9086a9f43c2` | Aug 31 16:03:22 (Sep 1 00:03:22) | `adjustment`; “Physical count correction” | −2 kg; 22 → 20 kg | Same missing links. |

Each row records `performed_by = 67c693f7-5b7a-4429-b41f-cb986c3a4de7`. E1's `profiles` row 359 identifies that UUID as an active `manager` in the later export; this establishes a recorded profile relationship, not who physically counted or received stock. No linked supplier delivery, purchase order, receiving report, signed stock sheet, original actor attestation, or batch/expiry record was found for these three rows in the inspected artifacts. The recorded `reason` labels are user-entered or stored descriptions; the first row's “Opening stock” label does **not** make it an `inventory_opening_balances` record or prove an original 20 kg physical count. The transaction timestamps precede the Phase 2A version date, but their appearance in a later export does not independently authenticate their creation history.

**Arithmetic within E1:** 0 + 20 + 2 − 2 = 20 kg for this three-row sequence. This reconciles the recorded `quantity_before`/`quantity_after` chain only. It is not a reconciliation of all historical receipts, issues, batches, current stock, or physical inventory. The +2/−2 pair nets to zero; its reason is not evidence of the count sheet or why a correction was entered and reversed. The “receiving” row may be a legacy stock initialization entered using that transaction type, but that is an inference requiring owner/source confirmation. No original document was found in the scoped repository, Git history, relevant Downloads artifacts or named backup roots. Unsearched owner paper records and private accounts remain unknown.

## Decision for the accountable restaurant/stock owner

Select **one** after reviewing an original source. Leave blank until an authorized decision is made.

- [ ] **A. Documented historical opening stock.** Attach the dated signed stockroom count/import, Rice ID and kg quantity, person, batch/expiry treatment, and explain how it links to or differs from these three rows. Evidence ID: ______.
- [ ] **B. Zero-opening bootstrap assumption for an isolated replay.** Explicitly accept zero solely as a replay starting assumption, **not** a claim that physical stock was zero on August 31. Explain how the recorded +20 kg row and later corrections are represented or excluded, and the effect on later ledger comparison. Evidence/decision ID: ______.
- [ ] **C. Defer.** Identify the missing count/receiving document and custodian. Evidence to request: ______.
- [ ] **D. Separately documented reconstruction.** Supply independent dated records, a reproducible per-item/unit/batch reconciliation and limitations. This option is not directly represented by the present `validate-provenance.mjs` decision enum; engineering must review the schema/approval contract before using it. Reconstruction is not original fact. Evidence ID: ______.

The current validator accepts only `approved-zero` or `approved-physical-record` with a nonempty `openingStockEvidenceId`. A decision of A or B still needs human review of the evidence and replay implications. C and D cannot be passed to the present gate as approved alternatives. No option authorizes a hosted stock change.

Owner name and role: ______  Decision/date: ______  Source document/date: ______

Owner conditions or rejection: ______  Engineering reconciliation review/date: ______

**All fields remain unsigned and pending.**
