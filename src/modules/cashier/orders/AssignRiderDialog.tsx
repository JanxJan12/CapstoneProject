import { useEffect, useState } from "react";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../app/components/ui/dialog";
import type { Order, Rider } from "../types";
import {
  CashierButton,
  CashierDialogContent,
  CashierSelect,
  FieldError,
  Label,
} from "../components";

export function AssignRiderDialog({
  order,
  riders,
  open,
  loading,
  onOpenChange,
  onConfirm,
}: {
  order?: Order;
  riders: Rider[];
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (riderId: string) => Promise<void>;
}) {
  const [riderId, setRiderId] = useState("");
  const [error, setError] = useState("");
  const eligible = riders.filter(
    (rider) =>
      rider.availability === "Available" || rider.currentOrderId === order?.id,
  );

  useEffect(() => {
    const assigned = riders.find(
      (rider) =>
        rider.currentOrderId === order?.id ||
        rider.name === order?.assignedRider,
    );
    setRiderId(assigned?.id ?? "");
    setError("");
  }, [order, riders]);

  if (!order) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!riderId) {
      setError("Select an available rider.");
      return;
    }
    await onConfirm(riderId);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !loading && onOpenChange(value)}
    >
      <CashierDialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign rider to {order.id}</DialogTitle>
          <DialogDescription>
            Available riders are updated immediately across delivery operations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="assign-order-rider">Rider</Label>
            <CashierSelect
              id="assign-order-rider"
              value={riderId}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setRiderId(event.target.value);
                setError("");
              }}
            >
              <option value="">Select an available rider</option>
              {eligible.map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.name} · {rider.availability}
                </option>
              ))}
            </CashierSelect>
            <FieldError>
              {error ||
                (!eligible.length
                  ? "No riders are currently available."
                  : undefined)}
            </FieldError>
          </div>
          <DialogFooter>
            <CashierButton
              variant="secondary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </CashierButton>
            <CashierButton
              type="submit"
              loading={loading}
              disabled={!eligible.length}
            >
              Assign rider
            </CashierButton>
          </DialogFooter>
        </form>
      </CashierDialogContent>
    </Dialog>
  );
}
