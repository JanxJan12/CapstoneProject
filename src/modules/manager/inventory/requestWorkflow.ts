import type { InventoryRequest } from "./inventoryRequestApi";

const eventDetailLabels: Record<string, string> = {
  channel: "Channel",
  recipient: "Recipient or contact",
  reference: "External message reference",
  note: "Manager note",
  responder: "Responder",
  response: "Recorded response",
  receiving_report_id: "Receiving report ID",
  rr_number: "Receiving document",
  inspected_by_name: "Inspector",
  reason: "Closure reason",
};

export function requestEventDetailRows(
  details: InventoryRequest["events"][number]["details"],
) {
  return Object.entries(details)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => ({
      key,
      label: eventDetailLabels[key] ?? key.replaceAll("_", " "),
      value,
    }));
}

export function requestEventPresentation(
  event: InventoryRequest["events"][number],
) {
  switch (event.type) {
    case "issued":
      return {
        title: "Request issued",
        note: "The formal request was created. Stock did not change.",
      };
    case "revised":
      return {
        title: "Request revised",
        note: "A new issued revision replaced the prior request details.",
      };
    case "dispatch":
      return {
        title: "Manager recorded external dispatch",
        note: "This is a Manager attestation, not proof that the message was delivered or read.",
      };
    case "acknowledgment":
      return {
        title: "Manager recorded an external reply",
        note: "This is a Manager attestation of a reply received outside the app.",
      };
    case "delivery_started":
      return {
        title: "Delivery recording started",
        note: "A Receiving draft was opened. Stock did not change.",
      };
    case "delivery_cancelled":
      return {
        title: "Delivery draft cancelled",
        note: "The draft was removed without posting stock.",
      };
    case "delivery_posted":
      return {
        title: "Delivery posted to inventory",
        note: "Accepted quantities from the posted Receiving document were reconciled.",
      };
    case "closed_short":
      return {
        title: "Request closed with shortfall",
        note: "The recorded reason explains the unfilled quantity at closure.",
      };
    default:
      return {
        title: "Request activity recorded",
        note: `Original event code: ${event.type}`,
      };
  }
}

export function requestWorkflow(request: InventoryRequest) {
  const draftReceipt = request.receipts.find(
    (receipt) => receipt.status === "draft",
  );
  const outstandingLines = request.lines.filter(
    (line) => line.remaining > 0,
  ).length;
  const postedReceipts = request.receipts.filter(
    (receipt) => receipt.status === "posted",
  ).length;
  const open =
    request.status === "issued" || request.status === "partially_received";
  const next = !open
    ? "closed"
    : draftReceipt
      ? "draft"
      : outstandingLines > 0
        ? "delivery"
        : "reconcile";

  return {
    draftReceipt,
    outstandingLines,
    postedReceipts,
    next,
  } as const;
}

export function requestPastNeededDate(request: InventoryRequest, now = Date.now()) {
  const needed = Date.parse(request.needed_at);
  return (
    (request.status === "issued" || request.status === "partially_received") &&
    request.lines.some((line) => line.remaining > 0) &&
    Number.isFinite(needed) &&
    needed < now
  );
}
