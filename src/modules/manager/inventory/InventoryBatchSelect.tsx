import type { ManagerInventoryBatch } from "./inventoryApi";
import {
  formatInventoryQuantity,
  getBatchStatus,
  manilaToday,
} from "./inventoryMutationUi";

const receivedFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const useByFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function InventoryBatchSelect({
  id,
  batches,
  selectedBatchId,
  onChange,
  disabled,
  unit,
}: {
  id: string;
  batches: ManagerInventoryBatch[];
  selectedBatchId: string;
  onChange: (id: string) => void;
  disabled: boolean;
  unit: string;
}) {
  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);
  const today = manilaToday();
  const selectedStatus = selectedBatch
    ? getBatchStatus(selectedBatch, today)
    : null;
  const descriptionId = `${id}-description`;

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        Physical batch <span className="text-red-500">*</span>
      </label>
      <select
        id={id}
        value={selectedBatchId}
        disabled={disabled}
        required
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Select physical batch…</option>
        {batches.map((batch) => {
          const status = getBatchStatus(batch, today);
          return (
            <option key={batch.id} value={batch.id}>
              {batch.batchCode} · {status} ·{" "}
              {formatInventoryQuantity(batch.quantityOnHand, unit)} · Received{" "}
              {receivedFormatter.format(new Date(batch.receivedAt))} · Use by{" "}
              {batch.useByDate
                ? useByFormatter.format(
                    new Date(`${batch.useByDate}T00:00:00Z`),
                  )
                : "not set"}
            </option>
          );
        })}
      </select>
      <div id={descriptionId}>
        {batches.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No physical batches are recorded for this item.
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Choose the physical batch you counted. Batches are never selected
            automatically.
          </p>
        )}
      </div>
      {selectedBatch ? (
        <div className="rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-foreground">
              {selectedBatch.batchCode}
            </p>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                selectedStatus === "Expired"
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {selectedStatus}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wide">
                Current batch
              </dt>
              <dd className="mt-0.5 font-bold text-foreground">
                {formatInventoryQuantity(selectedBatch.quantityOnHand, unit)}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wide">
                Received
              </dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {receivedFormatter.format(new Date(selectedBatch.receivedAt))}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-wide">
                Use by
              </dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {selectedBatch.useByDate
                  ? useByFormatter.format(
                      new Date(`${selectedBatch.useByDate}T00:00:00Z`),
                    )
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
