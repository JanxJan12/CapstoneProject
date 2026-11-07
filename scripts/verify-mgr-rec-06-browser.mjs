// Historical MGR-REC-06 assertions are preserved in scripts/historical.
// UX-02 replaced the split register, stage and accordion presentation; this
// entry point runs the active four-view browser gate with the retained behavior checks.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const verifier = fileURLToPath(new URL("./verify-mgr-rec-ux-02-browser.mjs", import.meta.url));
const result = spawnSync(process.execPath, [verifier], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
