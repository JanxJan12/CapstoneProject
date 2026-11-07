# H-11G safe profile regression — 2026-10-16 Manila

| Gate | Result | Evidence and limit |
| --- | --- | --- |
| Worktree preservation | PASS | Existing tracked/untracked changes were inspected and preserved. Only the H-11G reports, status links, and one profile sampler SQL role line were written. No migration or business-data file was edited. |
| Docker and identity | PASS, bounded | Engine 29.8.2 answered; fresh inspection yielded 99 total/94 running, 16 label groups. All 99 names/IDs matched H-11C. No restart/OOM events in the 02:12–02:16 Docker event window. H-08C analytics retains ID prefix `2d9de3b44279`, healthy, 0 restarts, no mounts, loopback 59327. |
| Windows resource reserve | FAIL for trial | Three free-RAM samples: 607, 536, 737 MiB of 16,107 MiB. A host-side app decision belongs to the owner. |
| WSL hard refusal floor | PASS in sampled H-11G window only | Lowest sampled available RAM 638 MiB, 238 MiB above the 400 MiB hard floor. H-11F documented a prior sub-floor dip; this window does not erase it. |
| WSL warning/operating reserve | FAIL | Final swap ~1,965/2,048 MiB, ~96% used; samples below 800 MiB warning and below 1,500 MiB proposed operating target. Sustained stability not established. |
| H-09 read-only profile | PASS, bounded | 6/6 Auth 200, REST 200 and SQL `select 1` over ~31 seconds; WSL available 709–753 MiB; DB/Kong restart counts zero. Normal-load H-09 QA NOT TESTED. |
| Canonical demo read-only profile | PASS, bounded | 3/3 Auth 200, REST 200 and SQL `select 1` over ~13 seconds; WSL available 638–686 MiB; DB/Kong restart counts zero. Concurrent rehearsal NOT TESTED. |
| Recovery SQL | PASS, bounded | One read-only `select 1` each in source and target. Auth/REST, mounts, hashes and full recovery were not repeated in H-11G; see H-11F for earlier bounded evidence. |
| Candidate idleness and dependencies | BLOCKED | H-08C DB had 21 idle client backends. Studio, pg-meta and vector remain running; the external owner/job and log dependence could not be excluded. No Compose dependency label established a safe independent cut. |
| Reversible stop/restore | NOT TESTED | Pre-stop eligibility failed. No journal, `docker stop`, `docker start`, reduced state, measured gain or soak. Final count 94/99 running. |
| Host/WSL configuration | PASS preservation | No process termination, `.wslconfig` edit, WSL shutdown, Docker restart/reset/prune or hosted contact. |

**Script verification:** `node --check scripts/h11-local-profile.mjs` passed. `postgres` read-only `select 1` returned `1` on H-09, canonical demo and both recovery databases. The updated sampler then returned `pass: true` for the 6-sample H-09 and 3-sample demo series. The earlier `supabase_admin` probe prompted for a password in this local stack, so its old `FAIL` would not have been a valid service-health conclusion.

**Decision:** daily-dev/H-09 QA/demo have bounded low-load health only, while capacity acceptance and a reduced-service profile remain **BLOCKED**. The next measurable step is owner-directed host app closure after saving work, followed by repeated host/WSL measurements. A fixture trial still requires exact current-use and dependency evidence, a restore window, pre-stop journal, and the existing 400 MiB refusal guard. Hosted release remains **NO-GO** under separate gates.
