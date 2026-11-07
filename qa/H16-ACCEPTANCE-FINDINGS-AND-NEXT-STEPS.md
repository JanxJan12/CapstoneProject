# H-16 acceptance findings and next steps — 2026-10-16 Manila

## Current outcome

**Ten of 59 planned scenarios were executed and passed at authenticated local Manager API/SQL level; zero failed; 49 were not run. Rendered UI execution remains zero.** The existing `rrj_h09_order_flow_20261015` synthetic stack at `127.0.0.1:48321` was reused. Its project labels, workdir, loopback API/DB ports and preserved DB volume matched the H-09 identity; Auth/REST returned HTTP 200. The [master matrix](H16-MASTER-ACCEPTANCE-MATRIX.md) names each scenario and the [live JSON](H16-LIVE-ACCEPTANCE-20261016.json) records the exact request, report, receiving line, batch, movement IDs and before/after observations.

An authenticated Manager issued two-line `PR-20261016-000001`, recorded one **synthetic Manager dispatch event**, and opened linked `RR-20261016-B6B1E3F1`. Drafted lines recorded 3 delivered, 1 accepted and 2 rejected, with reasons. Issue, dispatch and draft each left the selected item balances, batches and ledger unchanged. Posting added exactly 1 to Biryani Chicken - Breast and 0 to Beef; one new batch and one movement link to the accepted line. A repeated post returned HTTP 400 and left the snapshot unchanged. Manager stock summary/detail reads matched independent SQL physical, usable and batch totals. The register showed the request as partially received.

The first chicken line attempt supplied a use-by date contrary to the item's configured shelf-life rule and was rejected with no line or stock effect. The same report was completed using the policy-derived date. This is a corrected test input, **not a confirmed application defect**. No physical goods were inspected, no supplier acknowledged anything, and no external dispatch occurred.

## Evidence boundary and remaining work

The current PASS rows are **local authenticated RPC plus independent SQL**, not browser interaction. No H-16 Production, Kitchen, Cashier, Customer, Rider, payment, recipe order, two-session conflict, fault-injected retry, pagination or role-denial scenario ran. A prior H-09/H-10 result cannot be counted as current H-16 proof. No hosted Supabase, real payment, physical delivery or device test occurred. Restaurant production and hosted release remain **NO-GO** under their separate provenance, recovery, parity and approval gates.

At the end of this run, the Docker VM reported about 726 MiB available memory with only 165 MiB swap free, while Windows reported about 707 MiB free physical memory. A new Vite/Chrome or two-session load was deferred rather than risking the protected H-09 and demo environments. The earlier 07:01 preflight with 375 MiB VM available and full swap, plus the older Docker outage, remain historical observations in [the preflight](H16-LOCAL-ACCEPTANCE-PREFLIGHT.md). They no longer describe the entire H-16 outcome.

The shortest next step is a fresh narrow H-09 health and resource check in a stable window, then rendered Manager request/Receiving/stock review of the preserved H-16 fixture. Follow with a separate undelivered request for revision, two-session posting and read-failure tests, and only then new isolated Production, Kitchen, Cashier and order fixtures. Record each result in the existing matrix and reconcile every mutation with SQL. Do not reuse consumed payments or orders as new fixtures.

## Preservation

Only this synthetic H-16 request/report and its accepted stock effects were written to the existing H-09 database. Prior H-09 evidence was retained. No app source, migration, Auth account, private Storage, hosted project, Docker container/volume/network, canonical demo, recovery environment, or historical Manager Lifecycle container was changed. No Git reset, clean, stash, deployment or real restaurant write occurred.
