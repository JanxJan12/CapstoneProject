import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (...segments) =>
  fs.readFileSync(path.join(root, ...segments), "utf8").replace(/\r\n/g, "\n");
const migration = read(
  "supabase",
  "migrations",
  "20261003164153_manager_receiving_draft_authoring.sql",
).toLowerCase();
const sqlVerifier = read(
  "supabase",
  "tests",
  "verify_manager_receiving_draft_authoring.sql",
).toLowerCase();
const api = read("src", "modules", "manager", "inventory", "receivingApi.ts");
const page = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "StockReceivingPage.tsx",
).replace(/\s+/g, " ");
const documents = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "ReceivingDocumentList.tsx",
).replace(/\s+/g, " ");
const unifiedDocuments = read(
  "src", "modules", "manager", "inventory", "UnifiedReceivingDocuments.tsx",
).replace(/\s+/g, " ");
const manager = read("src", "modules", "manager", "index.tsx");
const nav = read(
  "src",
  "modules",
  "manager",
  "inventory",
  "InventoryWorkspaceNav.tsx",
);

const checks = [];
const check = (condition, message) =>
  checks.push({ condition: Boolean(condition), message });

check(
  migration.startsWith("begin;") && migration.trimEnd().endsWith("commit;"),
  "migration is atomic",
);

for (const fn of [
  "get_manager_receiving_workspace",
  "update_receiving_report_draft",
  "save_receiving_report_item",
  "remove_receiving_report_item",
  "delete_empty_receiving_report_draft",
]) {
  check(migration.includes(`create function public.${fn}`), `${fn} is defined`);
  check(
    migration.includes(`function public.${fn}`),
    `${fn} has explicit ACL statements`,
  );
}

check(
  (migration.match(/security definer/g) ?? []).length === 6 &&
    (migration.match(/set search_path = public, extensions, pg_temp/g) ?? [])
      .length === 6,
  "all receiving RPCs are SECURITY DEFINER with an explicit search_path",
);
check(
  (migration.match(/v_actor_id uuid := auth\.uid\(\)/g) ?? []).length === 6 &&
    (migration.match(/profile\.role = 'manager'/g) ?? []).length === 6 &&
    (migration.match(/profile\.is_active = true/g) ?? []).length === 6,
  "every receiving RPC requires an authenticated active Manager",
);
check(
  migration.includes(
    "production team drafts cannot reference a purchase order",
  ) &&
    migration.includes("direct supplier drafts require a purchase order") &&
    migration.includes("purchase order is no longer eligible for receiving"),
  "draft headers enforce source-specific PO semantics",
);
check(
  migration.includes("only draft receiving reports can be edited") &&
    migration.includes("only draft receiving reports can be deleted"),
  "posted reports are immutable through draft RPCs",
);
check(
  migration.includes("production team lines require an inventory item") &&
    migration.includes("direct supplier lines require a po item") &&
    migration.includes(
      "purchase_order_item.purchase_order_id = v_report.purchase_order_id",
    ),
  "draft lines enforce source identity and PO ownership",
);
check(
  migration.includes(
    "accepted quantity exceeds the po item remaining quantity",
  ) &&
    migration.includes("rejection reason is required") &&
    migration.includes("expiry-required inventory") &&
    migration.includes("independent secondary receiving quantities"),
  "draft lines retain quantity, rejection, expiry, and independent-unit validation",
);
check(
  migration.includes("on conflict (id) do update") &&
    migration.includes("draft request id was reused with different details"),
  "draft creation and line saves have request-identity retry protection",
);
check(
  !migration.includes("update public.inventory_items") &&
    !migration.includes("insert into public.inventory_batches") &&
    !migration.includes("insert into public.inventory_transactions") &&
    !migration.includes("quantity_received ="),
  "draft migration contains no stock, batch, ledger, or PO-received mutation",
);
check(
  migration.includes("revoke all on function") &&
    migration.includes("from public, anon, authenticated") &&
    migration.includes("to authenticated, service_role"),
  "function execution is denied by default and granted narrowly",
);
check(
  !migration.includes("grant insert") &&
    !migration.includes("grant update") &&
    !migration.includes("grant delete") &&
    !migration.includes("create policy"),
  "direct receiving-table DML and RLS policy posture are unchanged",
);

for (const rpc of [
  "get_manager_receiving_workspace",
  "update_receiving_report_draft",
  "save_receiving_report_item",
  "remove_receiving_report_item",
  "delete_empty_receiving_report_draft",
  "post_receiving_report",
]) {
  check(api.includes(`\"${rpc}\"`), `Manager receiving API calls ${rpc}`);
}
check(
  !api.includes('"create_receiving_report_draft"') &&
    page.includes("createEmergencyProductionReceiving"),
  "new unlinked drafts use the Manager emergency authority, not retired supplier authoring",
);
check(
  api.includes("getFriendlyReceivingError") && !page.includes("error.message"),
  "backend errors are mapped to operational UI messages",
);
check(
  api.includes("rrj_manager_receiving_draft_request_v1") &&
    api.includes("crypto.randomUUID()"),
  "draft creation retries reuse a request UUID",
);
check(
  !page.includes("receiveInventoryStock") &&
    !page.includes("receive_inventory_stock"),
  "normal receiving UI no longer invokes legacy aggregate receiving",
);
check(
  page.includes('<option value="production_team">Production Team</option>') &&
    !page.includes('id="receiving-po"') &&
    !page.includes('id="supplier-reference"'),
  "UI offers Production receiving without retired supplier authoring",
);
check(
  page.includes('title={isPosted ? "Received Items" : "Saved Receiving Lines"}') &&
    page.includes("Save Line to Draft") &&
    page.includes("Update Saved Line") &&
    page.includes("Remove") &&
    page.includes("Review & Post"),
  "UI supports line add, edit, remove, review, and post",
);
check(
  page.includes("Completed delivery record") &&
    page.includes("{isPosted && selectedReport ? (") &&
    page.includes('selectedReport && isDraft && (!activeLinkedDocument || line.inventoryItemId)') &&
    page.includes('selectedReport && isDraft ? (') &&
    page.includes('!isPosted ? <Td>') &&
    page.includes("Stock and batches") &&
    page.includes("Movements") &&
    page.includes("selectedReport.status"),
  "posted reports render as read-only",
);
check(
  page.includes("No receipt selected") &&
    page.includes("Open linked Request") &&
    !page.includes('{ label: "Linked Request"') &&
    !page.includes("View item and movements") &&
    documents.includes('aria-current={selectedId === report.id ? "true" : undefined}') &&
    documents.includes(">Viewing</span>"),
  "receipt selection and linked navigation have a clear, nonduplicated presentation",
);
check(
  page.includes('item.quantityRejected > 0 ? "text-red-700" : "text-muted-foreground"') &&
    page.includes('item.secondaryQuantityRejected > 0 ? "text-red-700" : "text-muted-foreground"'),
  "zero primary and secondary rejected quantities use neutral text",
);
check(
  page.includes("Loading receiving workspace") &&
    page.includes("<UnifiedReceivingDocuments") &&
    unifiedDocuments.includes("Loading Receiving Documents") &&
    unifiedDocuments.includes("No matching Receiving entries"),
  "UI covers loading and empty states",
);
check(
  documents.includes("role=\"alert\"") &&
    documents.includes("Retry documents") &&
    documents.includes("isLoading ? (") &&
    documents.includes(") : error ? null : rows.length === 0 ? (") &&
    documents.includes("!error && !isLoading && (hasMore || offset > 0)") &&
    api.includes('classificationResult.error.code === "PGRST202"') &&
    api.includes("Receiving documents are temporarily unavailable"),
  "classification failure is shown as a retriable error, never as no results",
);
check(
  page.includes("Discard unsaved Receiving changes?") &&
    page.includes("if (!confirmDiscardChanges()) return;") &&
    page.includes("else if (confirmDiscardChanges()) {") &&
    page.includes("setStagedLineForms({});") &&
    page.includes("hasOtherUnsavedLines") &&
    page.includes("lineItemSelectedByManager || lineContentChanged") &&
    page.includes("if (!confirmDiscardLine()) return;") &&
    page.includes("onClick={startNewDraft}") &&
    page.includes("onSelect={(id) => void selectReport(id)}"),
  "switching or refreshing a Receiving draft protects unsaved edits",
);
check(
  manager.includes('label: "Receiving"') && nav.includes('label: "Receiving"'),
  "normal Manager navigation identifies formal Receiving",
);

for (const evidence of [
  "non-manager created a receiving draft",
  "production draft changed stock before posting",
  "supplier draft without a valid po was accepted",
  "production line without inventory identity was accepted",
  "supplier line with a foreign po item was accepted",
  "mixed source identity was accepted",
  "invalid delivered/accepted quantities were accepted",
  "rejected quantity without a reason was accepted",
  "expiry-required line without use-by was accepted",
  "secondary quantities were converted or changed",
  "draft header edit failed",
  "draft line removal failed",
  "posted report was edited",
  "posted line was removed",
  "draft rpc-created report did not post correctly",
]) {
  check(sqlVerifier.includes(evidence), `SQL verifier covers: ${evidence}`);
}
check(
  sqlVerifier.startsWith("--") &&
    sqlVerifier.includes("begin;") &&
    sqlVerifier.trimEnd().endsWith("rollback;"),
  "SQL behavior verification rolls back every write",
);
check(
  sqlVerifier.includes("has_table_privilege") &&
    sqlVerifier.includes("has_function_privilege"),
  "SQL verifier checks direct DML and RPC ACLs",
);

for (const forbidden of [
  "marinated chicken",
  "chicken inasal",
  "deduct_inventory_for_confirmed_order",
  "inventory_locations",
  "stock_transfers",
  "production_batches",
]) {
  check(
    !migration.includes(forbidden),
    `migration excludes out-of-scope behavior: ${forbidden}`,
  );
}

for (const result of checks) {
  console.log(`${result.condition ? "PASS" : "FAIL"}: ${result.message}`);
}

const failed = checks.filter((result) => !result.condition);
console.log(
  `\n${checks.length - failed.length}/${checks.length} checks passed.`,
);
if (failed.length) process.exitCode = 1;
