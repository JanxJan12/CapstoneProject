# Historical Receiving browser verifiers

`verify-mgr-rec-04-browser.mjs` and `verify-mgr-rec-06-browser.mjs` are the original scripts for layouts replaced by MGR-REC-UX-02. They remain here as an audit reference. Their selectors for the old queue, split register, and stages are intentionally not used as current acceptance criteria.

Run the entry points in `scripts/` or `verify-mgr-rec-ux-02-browser.mjs` against `scripts/fixtures/mgr-rec-04.config.ts`. The entry points execute the active four-view verifier and return its failure status if it fails. The active verifier retains the distinct behavioral checks described in the MGR-REQ-UX-03C QA report.
