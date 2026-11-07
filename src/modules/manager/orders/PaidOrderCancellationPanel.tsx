import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/common/Button";
import type { ManagerOrder } from "../api/managerApi";
import {
  getPaidOrderCancellation,
  settlePaidOrderCancellation,
  type InventoryDisposition,
  type PaidOrderCancellation,
} from "../api/paidOrderCancellationApi";

const refundFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const preparedStatuses = new Set([
  "preparing",
  "ready",
  "waiting_for_rider",
  "rider_accepted",
]);

export function PaidOrderCancellationPanel({
  order,
  onSettled,
  actionsAvailable,
}: {
  order: ManagerOrder;
  onSettled: () => Promise<void>;
  actionsAvailable: boolean;
}) {
  const preparationStarted = preparedStatuses.has(order.currentStatus);
  const eligibleStatus =
    order.currentStatus === "confirmed" || preparationStarted;
  const eligiblePayment =
    order.paymentStatus === "verified" &&
    order.paymentAmount === order.grandTotal &&
    order.paymentMethod !== null &&
    order.grandTotal > 0;
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [disposition, setDisposition] = useState<InventoryDisposition>(
    preparationStarted ? "waste" : "restore",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [kitchenConfirmed, setKitchenConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<PaidOrderCancellation | null>(null);

  useEffect(() => {
    if (order.currentStatus !== "cancelled") return;
    let active = true;
    void getPaidOrderCancellation(order.id)
      .then((result) => {
        if (active) setRecord(result);
      })
      .catch(() => {
        if (active) {
          setError(
            "The saved cancellation record could not be loaded. Check your access or connection.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [order.currentStatus, order.id]);

  if (record) {
    return (
      <section className="rounded-xl border border-border bg-muted/20 p-3">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
          Paid order cancellation
        </h2>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {refundFormatter.format(record.refundAmount)} refunded by{" "}
          {record.refundMethod === "gcash" ? "GCash" : "cash"}
        </p>
        <p className="mt-1 break-all text-xs text-muted-foreground">
          Reference: {record.refundReference}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Inventory: {record.inventoryDisposition.replace("_", " ")}
        </p>
        <p className="mt-1 break-words text-xs text-muted-foreground">
          Reason: {record.reason}
        </p>
      </section>
    );
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || outcomeUnknown || !actionsAvailable) return;
    const refundMethod = order.paymentMethod;
    if (!refundMethod) {
      setError(
        "The original payment method is unavailable. Refresh the order before proceeding.",
      );
      return;
    }
    busyRef.current = true;
    setError(null);
    setBusy(true);
    try {
      const settled = await settlePaidOrderCancellation({
        orderId: order.id,
        reason,
        inventoryDisposition: preparationStarted ? disposition : "restore",
        refundMethod,
        refundReference: reference,
        kitchenNotStartedConfirmed: !preparationStarted && kitchenConfirmed,
      });
      setRecord({ ...settled, reason: reason.trim() });
      await onSettled();
    } catch {
      setOutcomeUnknown(true);
      setError(
        "The cancellation outcome could not be confirmed. Check the saved cancellation record before taking any further action; do not issue another refund or submit again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const checkCancellationRecord = async () => {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const saved = await getPaidOrderCancellation(order.id);
      if (saved) {
        setRecord(saved);
        await onSettled();
      } else {
        setError(
          "No saved cancellation record was returned. The outcome remains unconfirmed; verify the order and refund externally before any further action.",
        );
      }
    } catch {
      setError(
        "The cancellation record could not be checked. Verify access or connection before continuing.",
      );
    } finally {
      setChecking(false);
    }
  };

  if (outcomeUnknown) {
    return (
      <section
        className="rounded-xl border border-amber-300 bg-amber-50 p-4"
        aria-label="Cancellation outcome unconfirmed"
      >
        <h2 className="text-sm font-bold text-foreground">
          Cancellation outcome unconfirmed
        </h2>
        <p className="mt-2 text-sm text-foreground" role="alert">
          {error ??
            "Check the saved cancellation record before taking any further action. Do not issue another refund or submit again."}
        </p>
        <Button
          variant="secondary"
          size="md"
          className="mt-3"
          loading={checking}
          onClick={() => void checkCancellationRecord()}
        >
          Check cancellation record
        </Button>
      </section>
    );
  }

  if (!eligibleStatus || !eligiblePayment) {
    return error ? (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    ) : null;
  }

  return (
    <section className="rounded-xl border border-amber-300/70 bg-amber-50/50 p-3">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-foreground">
        Cancel and refund paid order
      </h2>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Return the full {refundFormatter.format(order.grandTotal)} to the
        customer first. This action records the completed refund and cancels the
        order.
      </p>
      <form className="mt-3 space-y-3" onSubmit={(event) => void submit(event)}>
        {!actionsAvailable && (
          <p
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-foreground"
            role="status"
          >
            Refresh the order list successfully before recording a cancellation.
            The displayed order may be outdated.
          </p>
        )}
        <label className="block text-xs font-semibold text-foreground">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={300}
            required
            rows={2}
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card p-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        {preparationStarted ? (
          <label className="block text-xs font-semibold text-foreground">
            Prepared food disposition
            <select
              value={disposition}
              onChange={(event) =>
                setDisposition(event.target.value as InventoryDisposition)
              }
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card p-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="waste">Waste — ingredients remain consumed</option>
              <option value="no_return">
                No return — ingredients remain consumed
              </option>
            </select>
          </label>
        ) : (
          <div className="space-y-2">
            <p className="text-xs leading-5 text-muted-foreground">
              Confirm with Kitchen before proceeding. The original inventory
              batches will be restored exactly; expired stock stays expired.
            </p>
            <label className="flex min-h-11 items-center gap-3 text-sm leading-5 text-foreground">
              <input
                type="checkbox"
                checked={kitchenConfirmed}
                onChange={(event) => setKitchenConfirmed(event.target.checked)}
                className="h-4 w-4 shrink-0"
              />
              Kitchen confirms preparation has not started and stock is still
              physically returnable.
            </label>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Refund method: {order.paymentMethod === "gcash" ? "GCash" : "cash"}
          {order.paymentMethod === "cash" &&
            ". The original cashier shift must still be open."}
        </p>
        <label className="block text-xs font-semibold text-foreground">
          Refund receipt or transfer reference
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            minLength={3}
            maxLength={100}
            required
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card p-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm leading-5 text-foreground">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="h-4 w-4 shrink-0"
          />
          I confirm the full refund has already been given to the customer.
        </label>
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <Button
          variant="secondary"
          size="md"
          disabled={
            !actionsAvailable ||
            !confirmed ||
            (!preparationStarted && !kitchenConfirmed) ||
            busy ||
            reason.trim().length < 3 ||
            reference.trim().length < 3
          }
          loading={busy}
        >
          Record refund and cancel
        </Button>
      </form>
    </section>
  );
}
