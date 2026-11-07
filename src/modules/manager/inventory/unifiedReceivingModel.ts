import type { InventoryRequest } from "./inventoryRequestApi";
import type { ReceivingReportSummary } from "./receivingApi";
import { requestWorkflow } from "./requestWorkflow";

export interface RequestReceivingEntry {
  kind: "request";
  key: string;
  request: InventoryRequest;
  draftId: string | null;
  status: "Awaiting Delivery" | "Draft in Progress" | "Partially Received";
  action: "Record Delivery" | "Resume Receiving" | "Record Additional Delivery";
}

export interface ReceiptReceivingEntry {
  kind: "receipt";
  key: string;
  receipt: ReceivingReportSummary;
}

export function requestReceivingEntries(requests: InventoryRequest[]): RequestReceivingEntry[] {
  return requests.flatMap((request) => {
    const workflow = requestWorkflow(request);
    if (workflow.next !== "draft" && workflow.next !== "delivery") return [];
    const draftId = workflow.draftReceipt?.id ?? null;
    return [{
      kind: "request" as const,
      key: `request:${request.id}`,
      request,
      draftId,
      status: draftId ? "Draft in Progress" as const
        : request.status === "partially_received" ? "Partially Received" as const
          : "Awaiting Delivery" as const,
      action: draftId ? "Resume Receiving" as const
        : request.status === "partially_received" ? "Record Additional Delivery" as const
          : "Record Delivery" as const,
    }];
  });
}

export function receiptReceivingEntries(
  receipts: ReceivingReportSummary[],
  requests: RequestReceivingEntry[],
  showAllRecords: boolean,
): ReceiptReceivingEntry[] {
  const representedDrafts = new Set(requests.map((row) => row.draftId).filter(Boolean));
  return receipts
    .filter((receipt) => showAllRecords || !representedDrafts.has(receipt.id))
    .map((receipt) => ({ kind: "receipt" as const, key: `receipt:${receipt.id}`, receipt }));
}
