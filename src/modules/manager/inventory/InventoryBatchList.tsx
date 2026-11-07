import type { ManagerStockBatch, ManagerStockDetail } from "./inventoryApi";
import { batchDecision, type BatchAvailability } from "./batchDecision";
import { formatInventoryQuantity } from "./inventoryMutationUi";
import { manilaDate, manilaDateTime } from "./StockPresentation";

function BatchCard({
  batch,
  unit,
  label,
  explanation,
}: {
  batch: ManagerStockBatch;
  unit: string;
  label: string;
  explanation: string;
}) {
  return (
    <li className="min-w-0 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <strong className="break-all">{batch.batchCode}</strong>
        <span className="rounded-full border border-border bg-card px-2 py-1 text-xs font-bold">
          {label}
        </span>
      </div>
      <p className="mt-2 font-bold tabular-nums">
        {formatInventoryQuantity(batch.quantityOnHand, unit)} remaining
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Received {manilaDateTime.format(new Date(batch.receivedAt))} · Use by{" "}
        {batch.useByDate
          ? manilaDate.format(new Date(`${batch.useByDate}T00:00:00Z`))
          : "not recorded"}
      </p>
      <p className="mt-2 text-sm text-foreground">{explanation}</p>
    </li>
  );
}

const unavailableExplanation: Record<
  Exclude<BatchAvailability, "eligible">,
  string
> = {
  expired: "Expired by recorded use-by date; excluded from order allocation.",
  "missing-use-by":
    "Use-by date is missing; an expiry-required item cannot use this batch for order allocation.",
  empty: "No quantity remains; excluded from order allocation.",
};

export function InventoryBatchList({ detail }: { detail: ManagerStockDetail }) {
  const { stock, batches } = detail;
  const { next, otherEligible, unavailable, totalsAgree } =
    batchDecision(detail);
  const policy = stock.rotationPolicy === "fefo" ? "FEFO" : "FIFO";
  const reason =
    stock.rotationPolicy === "fefo"
      ? "Earliest recorded use-by date among eligible batches; undated batches follow dated ones when expiry is optional. Receipt time and batch ID break ties."
      : "Oldest receipt among eligible batches; batch ID breaks ties.";

  return (
    <section
      className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="item-batches-heading"
    >
      <div>
        <h2 id="item-batches-heading" className="text-base font-bold">
          Recorded batches and rotation
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {policy} for confirmed-order allocation. The server checks usable
          stock again when an order is confirmed; viewing this page does not
          change stock or certify physical quality.
        </p>
      </div>

      {next ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
            Current batch · next eligible for system allocation
          </p>
          <p className="mt-2 break-all text-lg font-extrabold text-emerald-950">
            {next.batchCode}
          </p>
          <p className="mt-1 font-bold tabular-nums text-emerald-950">
            {formatInventoryQuantity(next.quantityOnHand, stock.unit)} remaining
          </p>
          <p className="mt-1 text-sm text-emerald-950">
            Use by{" "}
            {next.useByDate
              ? manilaDate.format(new Date(`${next.useByDate}T00:00:00Z`))
              : "not recorded (expiry not required)"}
          </p>
          <p className="mt-2 text-sm text-emerald-950">{reason}</p>
        </div>
      ) : (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <strong className="block">
            {!totalsAgree
              ? "Batch balances need review"
              : batches.length === 0
                ? "No available physical batches"
                : "No batch priority available"}
          </strong>
          {!stock.isActive
            ? "This item is inactive and cannot be deducted for confirmed orders."
            : !totalsAgree
              ? "The reported usable total and eligible batch balances do not agree. Refresh and investigate before relying on batch order."
              : batches.length === 0
                ? "The server reports no usable stock or positive-balance batches. Earlier batches, when recorded, can be reviewed in Stock Movements."
                : "The server reports no usable stock for this item. Review recorded batches and refresh before acting."}
        </div>
      )}

      {otherEligible.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold">
            {next
              ? "Other eligible batches, in allocation order"
              : "Other recorded batches · no priority available"}
          </h3>
          <ol className="grid gap-2 md:grid-cols-2">
            {otherEligible.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                unit={stock.unit}
                label="Current"
                explanation={
                  next
                    ? "Follows earlier eligible batches in the server's allocation order."
                    : stock.isActive
                      ? "Recorded as current, but no allocation priority is reliable until the usable total and batch balances agree."
                      : "Recorded batch; item is inactive, so no order allocation priority applies."
                }
              />
            ))}
          </ol>
        </div>
      )}

      {unavailable.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold">Unavailable batch stock</h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {unavailable.map(({ batch, reason: exclusion }) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                unit={stock.unit}
                label={
                  exclusion === "expired"
                    ? "Expired"
                    : exclusion === "missing-use-by"
                      ? "Use-by missing"
                      : "Empty"
                }
                explanation={unavailableExplanation[exclusion]}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
