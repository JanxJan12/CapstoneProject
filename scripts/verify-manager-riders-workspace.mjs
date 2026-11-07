import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manager = read("../src/modules/manager/index.tsx");
const page = read("../src/modules/manager/riders/RidersPage.tsx");
const dialog = read("../src/modules/manager/riders/RiderApplicationDialog.tsx");
const api = read("../src/modules/manager/api/managerPhase2Api.ts");
const applicationSql = read(
  "../supabase/migrations/20260918010000_manager_rider_approval_workflow.sql",
);
const transitionSql = read(
  "../supabase/migrations/20260918030000_fix_manager_rider_approval_ambiguity.sql",
);
const storageSql = read(
  "../supabase/migrations/20260918000000_rider_application_foundation.sql",
);

assert.match(manager, /case "riders":\s*return <RidersPage \/>;/);
assert.equal((page.match(/View application/g) ?? []).length, 2);
assert.match(page, /setSelectedRiderId\(rider\.id\)/);
assert.match(
  page,
  /loadedForSession === session\?\.id &&\s*session\?\.role === "manager"/,
);
assert.match(page, /"Approval",\s*"Availability",\s*"Deliveries"/);
assert.match(page, /setManagerRiderApprovalStatus|SuspendRiderDialog/);
assert.doesNotMatch(page, /ID \{rider\.id\}/);
assert.match(dialog, /getManagerRiderApplication\(riderId\)/);
assert.match(dialog, /let cancelled = false/);
assert.match(dialog, /path=\{application\.validIdPath\}/);
assert.match(dialog, /path=\{application\.orCrDocumentPath\}/);
assert.match(dialog, /path=\{application\.riderPhotoPath\}/);
assert.match(dialog, /Access unavailable/);
assert.match(dialog, /Not submitted/);
assert.match(dialog, /Preview unavailable/);
assert.match(dialog, /Retry documents/);
assert.match(api, /Promise\.allSettled\(\[/);
assert.match(api, /parts\[0\] !== riderId/);
assert.match(api, /\.createSignedUrl\(/);
assert.match(storageSql, /'rider-documents',\s*'rider-documents',\s*false/);
assert.match(storageSql, /manager_read_rider_application_documents/);
assert.match(applicationSql, /profile\.role = 'manager'::public\.user_role/);
assert.match(transitionSql, /role = 'customer'::public\.user_role/);
assert.match(transitionSql, /role = 'rider'::public\.user_role/);
assert.match(transitionSql, /'offered'::public\.delivery_assignment_status/);
assert.match(
  transitionSql,
  /'out_for_delivery'::public\.delivery_assignment_status/,
);

console.log("Manager Riders source contracts: 26 assertions passed.");
