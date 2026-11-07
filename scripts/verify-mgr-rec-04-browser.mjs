// Historical MGR-REC-04 assertions are preserved in scripts/historical.
// UX-02 replaced the queue/workspace layout; this entry point runs the active
// four-view browser gate, including the migrated focus, resume, error and pagination checks.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const verifier = fileURLToPath(new URL("./verify-mgr-rec-ux-02-browser.mjs", import.meta.url));
const result = spawnSync(process.execPath, [verifier], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
