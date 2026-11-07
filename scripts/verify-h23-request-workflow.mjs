import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  requestEventDetailRows,
  requestEventPresentation,
  requestWorkflow,
} from "../src/modules/manager/inventory/requestWorkflow.ts";

const request = (patch = {}) => ({
  revision: 2,
  status: "issued",
  lines: [{ remaining: 5 }],
  receipts: [],
  events: [],
  ...patch,
});

assert.equal(requestWorkflow(request()).next, "delivery");
assert.equal(requestWorkflow(request({ lines: [] })).outstandingLines, 0);
assert.equal(
  requestWorkflow(
    request({ receipts: [{ id: "draft-1", number: "RR-1", status: "draft" }] }),
  ).next,
  "draft",
);
assert.equal(
  requestWorkflow(request({ events: [{ revision: 1, type: "dispatch" }] }))
    .next,
  "delivery",
);
assert.equal(
  requestWorkflow(request({ events: [{ revision: 2, type: "dispatch" }] }))
    .next,
  "delivery",
);
assert.equal(
  requestWorkflow(request({ events: [{ revision: 2, type: "acknowledgment" }] }))
    .next,
  "delivery",
);
assert.equal(
  requestWorkflow(
    request({
      status: "partially_received",
      receipts: [{ status: "posted" }],
      events: [{ revision: 2, type: "dispatch" }],
    }),
  ).postedReceipts,
  1,
);
assert.equal(
  requestWorkflow(request({ status: "fulfilled", lines: [{ remaining: 0 }] }))
    .next,
  "closed",
);
assert.equal(
  requestWorkflow(request({ status: "closed_short" })).next,
  "closed",
);
assert.equal(
  requestWorkflow(
    request({
      receipts: [
        { id: "one", status: "posted" },
        { id: "two", status: "posted" },
      ],
    }),
  ).postedReceipts,
  2,
);
assert.equal(
  requestEventPresentation({ type: "issued" }).title,
  "Request issued",
);
assert.equal(
  requestEventPresentation({ type: "delivery_started" }).note.includes(
    "Stock did not change",
  ),
  true,
);
assert.equal(
  requestEventPresentation({ type: "delivery_posted" }).title,
  "Delivery posted to inventory",
);
assert.match(
  requestEventPresentation({ type: "dispatch" }).note,
  /attestation, not proof/,
);
assert.match(
  requestEventPresentation({ type: "acknowledgment" }).note,
  /outside the app/,
);
assert.match(
  requestEventPresentation({ type: "future_event" }).note,
  /Original event code: future_event/,
);

const requestsPage = readFileSync(
  new URL(
    "../src/modules/manager/inventory/ManagerRequestsPage.tsx",
    import.meta.url,
  ),
  "utf8",
);
const requestApi = readFileSync(
  new URL("../src/modules/manager/inventory/inventoryRequestApi.ts", import.meta.url),
  "utf8",
);
const requestDocument = readFileSync(
  new URL("../src/modules/manager/inventory/requestDocument.ts", import.meta.url),
  "utf8",
);
const receivingPage = readFileSync(
  new URL(
    "../src/modules/manager/inventory/StockReceivingPage.tsx",
    import.meta.url,
  ),
  "utf8",
);
const managerPage = readFileSync(
  new URL("../src/modules/manager/index.tsx", import.meta.url),
  "utf8",
);
const receivingApi = readFileSync(
  new URL("../src/modules/manager/inventory/receivingApi.ts", import.meta.url),
  "utf8",
);
assert.match(
  requestsPage,
  /registerReady && registerVersion === loadVersion\.current/,
);
assert.match(requestsPage, /Promise\.allSettled\(/);
assert.match(
  requestsPage,
  /setRegisterReady\(registerResult\.status === "fulfilled"\)/,
);
assert.match(
  requestsPage,
  /setFresh\(proposalResult\.status === "fulfilled"\)/,
);
assert.match(requestsPage, /if \(canUseRegister\(\)\) onReceive/);
assert.match(receivingPage, /Outstanding if this report posts/);
assert.match(
  receivingPage,
  /Only accepted quantities will be added to inventory when this/,
);
assert.match(receivingPage, /postingRef\.current = true/);
assert.match(receivingPage, /await loadWorkspace\(selectedReport\.id, false\)/);
assert.match(
  receivingPage,
  /current\?\.receivingReportId === reportId \? current : null/,
);
assert.ok(
  requestsPage.indexOf('id="request-export-actions"') <
    requestsPage.indexOf("Requested items and fulfillment"),
);
assert.ok(
  requestsPage.indexOf("Requested items and fulfillment") <
    requestsPage.indexOf("Linked Receiving Documents"),
);
assert.match(requestsPage, /selected\.receipts\.map\(\(receipt\) =>/);
assert.match(
  requestsPage,
  /receipt\.status === "draft" \? "Draft · stock unchanged"/,
);
assert.match(requestsPage, /requestEventPresentation\(event\)/);
assert.doesNotMatch(requestsPage, /Record Messenger dispatch or reply|Record external reply|No external reply recorded/);
assert.doesNotMatch(requestsPage, /selected\.reason|snapshot\.reason|Reason \(required\)|Enter the reason for this request/);
assert.doesNotMatch(requestApi, /p_reason: input\.reason/);
assert.doesNotMatch(requestDocument, /field\("Reason", data\.reason\)/);
assert.deepEqual(
  requestEventDetailRows({
    channel: "Messenger",
    recipient: "Production",
    reference: "",
    receiving_report_id: "report-1",
    future_field: "retained",
  }),
  [
    { key: "channel", label: "Channel", value: "Messenger" },
    { key: "recipient", label: "Recipient or contact", value: "Production" },
    {
      key: "receiving_report_id",
      label: "Receiving report ID",
      value: "report-1",
    },
    { key: "future_field", label: "future field", value: "retained" },
  ],
);
assert.deepEqual(requestEventDetailRows({}), []);
assert.match(requestsPage, /requestEventDetailRows\(event\.details\)/);
assert.match(requestsPage, /Event code: \{event\.type\}/);
assert.match(managerPage, /onSelectReport=\{\(reportId\) => \{/);
assert.match(managerPage, /window\.history\.pushState\(null, "", url\)/);
assert.match(
  receivingPage,
  /loadedReportId\.current === \(initialReportId \?\? null\)/,
);
assert.match(
  receivingPage,
  /await verifyReceivingPolicyAvailable\(\)/,
);
assert.match(
  receivingApi,
  /get_receiving_policy_classes", \{ p_report_ids: \[\] \}/,
);

console.log("H-23 offline request workflow assertions passed (40 checks).");
