import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/common/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getManagerStockDetail,
  getManagerStockMovements,
  type ManagerStockDetail,
  type ManagerStockMovement,
} from "./inventoryApi";
import { InventoryBatchList } from "./InventoryBatchList";
import type { InventoryWorkspacePage } from "./InventoryWorkspaceNav";
import { StockMovementList } from "./StockMovementList";
import { manilaDate, StockQuantities, stockStatus } from "./StockPresentation";
import {
  getInventoryRequestRegister,
  getRequestProposal,
  type InventoryRequest,
  type RequestProposalItem,
} from "./inventoryRequestApi";
import { formatInventoryQuantity } from "./inventoryMutationUi";

type ItemRead<T> =
  | { itemId: string; status: "loading"; value: null }
  | { itemId: string; status: "ready"; value: T }
  | { itemId: string; status: "error"; value: null; message: string };

const loadingRead = <T,>(itemId: string): ItemRead<T> => ({
  itemId,
  status: "loading",
  value: null,
});

const readError = <T,>(
  itemId: string,
  caught: unknown,
  fallback: string,
): ItemRead<T> => ({
  itemId,
  status: "error",
  value: null,
  message: caught instanceof Error ? caught.message : fallback,
});

export function InventoryItemDetail({
  itemId,
  fromAudit = false,
  onBack,
  onNavigate,
  onAction,
  onOpenRequest,
  onOpenReceipt,
}: {
  itemId: string;
  fromAudit?: boolean;
  onBack: () => void;
  onNavigate: (page: InventoryWorkspacePage) => void;
  onAction: (
    page: "stock-receiving" | "waste-spoilage" | "adjustment" | "replenishment",
    itemId: string,
  ) => void;
  onOpenRequest: (requestId: string) => void;
  onOpenReceipt?: (receiptNumber: string) => void;
}) {
  const [stockRead, setStockRead] = useState<ItemRead<ManagerStockDetail>>(
    loadingRead(itemId),
  );
  const [movementRead, setMovementRead] = useState<
    ItemRead<ManagerStockMovement[]>
  >(loadingRead(itemId));
  const [requestRead, setRequestRead] = useState<ItemRead<InventoryRequest[]>>(
    loadingRead(itemId),
  );
  const [proposalRead, setProposalRead] = useState<
    ItemRead<RequestProposalItem | null>
  >(loadingRead(itemId));
  const [revision, setRevision] = useState(0);
  const [movementRevision, setMovementRevision] = useState(0);
  // Item context can change before the effect runs. Do not show old item data.
  const currentStock = stockRead.itemId === itemId ? stockRead : null;
  const currentMovements = movementRead.itemId === itemId ? movementRead : null;
  const currentRequests = requestRead.itemId === itemId ? requestRead : null;
  const currentProposal = proposalRead.itemId === itemId ? proposalRead : null;
  const detail = currentStock?.status === "ready" ? currentStock.value : null;
  const movements =
    currentMovements?.status === "ready" ? currentMovements.value : [];
  const requests =
    currentRequests?.status === "ready" ? currentRequests.value : [];
  const proposal =
    currentProposal?.status === "ready" ? currentProposal.value : null;
  const newGap = proposal
    ? Math.max(
        0,
        proposal.reorder_level - proposal.valid_at_need - proposal.outstanding,
      )
    : null;

  useEffect(() => {
    let active = true;
    setStockRead(loadingRead(itemId));
    setRequestRead(loadingRead(itemId));
    setProposalRead(loadingRead(itemId));
    void getManagerStockDetail(itemId).then(
      (stock) => {
        if (!active) return;
        if (stock.stock.id !== itemId) {
          setStockRead(
            readError(
              itemId,
              new Error(
                "The server returned stock for a different item. Try again.",
              ),
              "Unable to load item stock.",
            ),
          );
          return;
        }
        setStockRead({ itemId, status: "ready", value: stock });
      },
      (caught: unknown) => {
        if (active)
          setStockRead(readError(itemId, caught, "Unable to load item stock."));
      },
    );
    void getInventoryRequestRegister()
      .then((rows) => {
        if (
          !Array.isArray(rows) ||
          rows.some((row) => !Array.isArray(row.lines))
        )
          throw new Error("The server returned an invalid request register.");
        return rows;
      })
      .then((rows) => {
        if (!active) return;
        setRequestRead({
          itemId,
          status: "ready",
          value: rows.filter(
            (request) =>
              (request.status === "issued" ||
                request.status === "partially_received") &&
              request.lines.some(
                (line) =>
                  line.inventory_item_id === itemId && line.remaining > 0,
              ),
          ),
        });
      })
      .catch((caught: unknown) => {
        if (active)
          setRequestRead(
            readError(itemId, caught, "Unable to load formal requests."),
          );
      });
    const neededAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    void getRequestProposal(neededAt).then(
      (rows) => {
        if (!active) return;
        setProposalRead({
          itemId,
          status: "ready",
          value: rows.find((row) => row.id === itemId) ?? null,
        });
      },
      (caught: unknown) => {
        if (active)
          setProposalRead(
            readError(itemId, caught, "Unable to load request guidance."),
          );
      },
    );
    return () => {
      active = false;
    };
  }, [itemId, revision]);

  useEffect(() => {
    let active = true;
    setMovementRead(loadingRead(itemId));
    void getManagerStockMovements({ itemId }, null, 10).then(
      (history) => {
        if (!active) return;
        if (history.rows.some((row) => row.inventoryItemId !== itemId)) {
          setMovementRead(
            readError(
              itemId,
              new Error("The server returned movements for a different item."),
              "Unable to load stock movements.",
            ),
          );
          return;
        }
        setMovementRead({ itemId, status: "ready", value: history.rows });
      },
      (caught: unknown) => {
        if (active)
          setMovementRead(
            readError(itemId, caught, "Unable to load stock movements."),
          );
      },
    );
    return () => {
      active = false;
    };
  }, [itemId, revision, movementRevision]);

  return (
    <div className="inventory-workspace-page max-w-7xl">
      <header className="manager-page-header mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="manager-page-context">
            Inventory / {fromAudit ? "Audit" : "Stock"} / Item detail
          </p>
          <h1 className="break-words text-foreground">
            {detail?.stock.itemName ?? "Item Stock"}
          </h1>
          {detail && (
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.stock.category ?? "Uncategorized"} · {detail.stock.unit} ·{" "}
              <span className="font-semibold text-foreground">
                {stockStatus(detail.stock)}
              </span>
            </p>
          )}
        </div>
        <Button
          size="md"
          variant="secondary"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh
        </Button>
      </header>
      <div className="mb-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ← {fromAudit ? "Inventory Audit" : "Stock Overview"}
        </button>
      </div>
      {fromAudit ? (
        <p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          Inventory Audit is a read-only ledger check. Review this item's stock
          and movements before recording a separately justified stock change. An
          incomplete history is not a verified physical discrepancy.
        </p>
      ) : null}
      {!currentStock || currentStock.status === "loading" ? (
        <p
          role="status"
          className="rounded-xl border border-border bg-card p-6"
        >
          Loading item stock…
        </p>
      ) : currentStock.status === "error" ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {currentStock.message}
          <Button
            size="md"
            variant="secondary"
            className="ml-2"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try Again
          </Button>
        </div>
      ) : detail ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h2 className="mb-3 text-base font-bold">Recorded stock</h2>
            <StockQuantities stock={detail.stock} />
            <p className="mt-3 text-xs text-muted-foreground">
              On hand is the recorded physical balance, not a verified count.
              Usable is calculated by the server for order consumption.
            </p>
            {detail.stock.batchConsumptionEnabled &&
            detail.stock.nearestUseBy ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nearest current use-by:{" "}
                {manilaDate.format(
                  new Date(`${detail.stock.nearestUseBy}T00:00:00Z`),
                )}
              </p>
            ) : null}
          </section>
          <section
            className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
            aria-labelledby="item-replenishment-heading"
          >
            <h2 id="item-replenishment-heading" className="text-base font-bold">
              Replenishment and next action
            </h2>
            {!detail.stock.isActive ? (
              <p className="mt-2 text-sm text-muted-foreground">
                This item is inactive. Request preparation is unavailable.
              </p>
            ) : (
              <>
                {!currentRequests || currentRequests.status === "loading" ? (
                  <p role="status" className="mt-2 text-sm">
                    Checking existing formal requests…
                  </p>
                ) : currentRequests.status === "error" ? (
                  <p role="alert" className="mt-2 text-sm text-amber-900">
                    Formal request status is unavailable.{" "}
                    {currentRequests.message}
                  </p>
                ) : requests.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-foreground">
                      Replenishment already requested in {requests.length} open
                      formal {requests.length === 1 ? "request" : "requests"}.
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {requests.map((request) => {
                        const remaining = request.lines
                          .filter((line) => line.inventory_item_id === itemId)
                          .reduce((total, line) => total + line.remaining, 0);
                        return (
                          <li key={request.id} className="min-w-0 max-w-full">
                            <Button
                              size="md"
                              variant={
                                newGap !== null && newGap > 0
                                  ? "secondary"
                                  : "primary"
                              }
                              className="max-w-full whitespace-normal break-words text-left"
                              onClick={() => onOpenRequest(request.id)}
                            >
                              Review {request.number} · Rev {request.revision} ·{" "}
                              {formatInventoryQuantity(
                                remaining,
                                detail.stock.unit,
                              )}{" "}
                              remaining
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {!currentProposal || currentProposal.status === "loading" ? (
                  <p role="status" className="mt-3 text-sm">
                    Checking request guidance…
                  </p>
                ) : currentProposal.status === "error" ? (
                  <p role="alert" className="mt-3 text-sm text-amber-900">
                    Request guidance is unavailable. {currentProposal.message}
                  </p>
                ) : proposal ? (
                  <div className="mt-3 space-y-1 text-sm">
                    {proposal.outstanding > 0 && (
                      <p>
                        {formatInventoryQuantity(
                          proposal.outstanding,
                          detail.stock.unit,
                        )}{" "}
                        outstanding in request guidance; this is not on-hand
                        stock.
                      </p>
                    )}
                    <p className="font-semibold">
                      {newGap !== null && newGap > 0
                        ? `Additional ${formatInventoryQuantity(newGap, detail.stock.unit)} suggested for the provisional need time.`
                        : detail.stock.usableQuantity <= 0
                          ? "Usable stock is out, but no additional quantity is suggested for the provisional need time. Check Receiving for a documented delivery or review a justified manual request."
                          : "No additional quantity suggested for the provisional need time."}
                    </p>
                    {!proposal.expiry_verified && (
                      <p className="text-xs text-amber-900">
                        Expiry at the provisional need time is unverified.
                        Review the request sheet before issuing.
                      </p>
                    )}
                    {requests.length === 0 &&
                      proposal.outstanding > 0 &&
                      currentRequests?.status === "ready" && (
                        <p className="text-xs text-muted-foreground">
                          No matching open formal request was returned. The
                          outstanding guidance can include the historical
                          historical replenishment requests.
                        </p>
                      )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    This item is absent from current request
                    guidance.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {newGap !== null && newGap > 0 ? (
                    <Button
                      size="md"
                      onClick={() => onAction("replenishment", itemId)}
                    >
                      Prepare Request
                    </Button>
                  ) : (
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => onAction("replenishment", itemId)}
                    >
                      Request Replenishment
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The request sheet checks guidance for its selected need time.
                  Manual quantities still require the existing justification and
                  review.
                </p>
              </>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                size="md"
                variant="secondary"
                onClick={() => onAction("stock-receiving", itemId)}
              >
                Receive through document
              </Button>
              {detail.stock.isActive ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-extrabold text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      Manage Stock
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="w-72 max-w-[calc(100vw-2rem)] border-border bg-card p-1 shadow-xl"
                  >
                    <DropdownMenuItem
                      className="min-h-11 items-start px-3 py-2 focus:bg-muted"
                      onSelect={() => onAction("adjustment", itemId)}
                    >
                      <span>
                        <span className="block font-semibold">
                          Adjust Stock
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Correct a verified discrepancy.
                        </span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="min-h-11 items-start px-3 py-2 focus:bg-muted"
                      onSelect={() => onAction("waste-spoilage", itemId)}
                    >
                      <span>
                        <span className="block font-semibold">
                          Record Waste / Spoilage
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Record a known loss of accepted stock.
                        </span>
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Stock actions are unavailable for this inactive item.
                </p>
              )}
            </div>
          </section>
          {detail.stock.batchConsumptionEnabled ? (
            <InventoryBatchList detail={detail} />
          ) : (
            <section className="mt-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-base font-bold">Standard stock</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This item has an aggregate balance. Receiving references and
                later changes appear in stock movements; physical batch rotation
                does not apply.
              </p>
            </section>
          )}
        </>
      ) : null}
      <section className="mt-4" aria-labelledby="item-movements-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="item-movements-heading" className="text-base font-bold">
            Stock movement history
          </h2>
          <Button
            size="md"
            variant="secondary"
            onClick={() => onNavigate("inv-transactions")}
          >
            View all movements
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Receiving references and associated batch codes identify recorded
          origins. Issuance allocations identify consumed batches when recorded,
          including batches no longer available. Open all movements for older
          history.
        </p>
        {!currentMovements || currentMovements.status === "loading" ? (
          <p
            role="status"
            className="rounded-xl border border-border bg-card p-5 text-sm"
          >
            Loading recent movements…
          </p>
        ) : currentMovements.status === "error" ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          >
            Recent movements are unavailable. {currentMovements.message}{" "}
            <button
              type="button"
              className="min-h-11 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setMovementRevision((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : movements.length ? (
          <StockMovementList rows={movements} showItem={false} onOpenReceipt={onOpenReceipt} />
        ) : (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            No stock movements were returned for this item.
          </p>
        )}
      </section>
    </div>
  );
}
