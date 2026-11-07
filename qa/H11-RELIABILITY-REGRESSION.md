# H-11 reliability regression — 2026-10-16 (Manila)

**PARTIAL overall; PASS for the bounded local H-09 service trial.** No Checkout order, payment, receipt, stock movement, assignment, or private proof was created or exported.

| Check | Result | Observation |
| --- | --- | --- |
| Script syntax/help and dry-run | PASS | `node --check`, `--help`, `stop-optional` dry-run exited 0; dry-run named only H-08C analytics and made no mutation. |
| Docker/WSL baseline | PASS for inventory | Engine 29.8.2, 94/99 running, 7,803 MiB WSL RAM; baseline memory 770–822 MiB available and ~1,954 MiB swap used. |
| All-running H-09 baseline | PASS for 4 samples | Four samples across ~13 seconds: Auth 200 in 5–42 ms, REST 200 in 54–62 ms, SQL `select 1` 4/4; no DB/Kong restart increment. |
| Reversible optional stop | PASS | Exact H-08C analytics container/project/image verified; `docker stop -t 15` finished, journal recorded prior running state. No other container stopped. |
| H-09 while opted out | PASS for 6 samples | Six samples across ~32 seconds: Auth 200 in 8–50 ms, REST 200 in 34–96 ms, SQL 6/6; WSL available memory 1,341–1,461 MiB; swap ~1,981 MiB. |
| Restore and immediate H-09 recheck | PASS | Same container ID started, 94/99 running, H-08C analytics subsequently healthy, three H-09 samples: Auth 200 in 6–46 ms, REST 200 in 62–64 ms, SQL 3/3. Available memory 822–845 MiB; swap ~1,981 MiB. |
| Demo smoke through new profile sampler | PASS for 2 samples | Demo Auth 200 in 9/278 ms, REST 200 in 42/522 ms, SQL 2/2. All 94 containers running. |
| Long-term stability / OOM avoidance | NOT TESTED | ~1 minute of bounded checks cannot establish hours of concurrency or prevent future OOM. All-running swap remained high. |
| Hosted, real payment, Rider device | NOT TESTED | Outside H-11; release remains NO-GO. |

The initial baseline already responded, so this trial does not establish a new failure recovery event. The measured ~0.6 GiB available-memory gain is consistent with the stopped container's ~600 MiB resident usage; it is a local observation, not a guaranteed saving. The H-10B OOM diagnosis remains the prior incident evidence. No application quality gate was rerun because application source, migrations, and quality scripts were unchanged; H-10B's typecheck/build/11 checks/52 hashes are prior PASS evidence, not a new H-11 result.

Restoration was checked by Docker running count, exact container identity and health, the archived ignored journal, and subsequent HTTP/SQL samples. The temporary process stop did not remove its container or volume. There is no active stop journal at completion.
