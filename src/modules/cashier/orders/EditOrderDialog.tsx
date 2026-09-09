import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createOrderOperationalEditSchema,
  type OrderOperationalEditForm,
} from "../schemas";
import type { Order, OrderOperationalEditInput } from "../types";
import {
  CashierButton,
  CashierDialogContent,
  CashierInput,
  CashierTextarea,
  FieldError,
  Label,
} from "../components";

export function EditOrderDialog({
  order,
  open,
  loading,
  onOpenChange,
  onConfirm,
}: {
  order?: Order;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: OrderOperationalEditInput) => Promise<void>;
}) {
  const validationSchema = useMemo(
    () => createOrderOperationalEditSchema(order?.type ?? "Take-out"),
    [order?.type],
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderOperationalEditForm>({
    resolver: zodResolver(validationSchema),
  });

  useEffect(() => {
    if (!order) return;
    reset({
      customerName: order.customerName,
      contactNumber: order.contactNumber,
      tableNumber: order.tableNumber ?? "",
      deliveryAddress: order.deliveryAddress ?? "",
      orderInstructions: order.orderInstructions ?? "",
    });
  }, [order, reset]);

  if (!order) return null;
  const submit = handleSubmit(onConfirm);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !loading && onOpenChange(value)}
    >
      <CashierDialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {order.id}</DialogTitle>
          <DialogDescription>
            Update operational details without changing the order items or
            payment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-order-customer">Customer</Label>
              <CashierInput
                id="edit-order-customer"
                autoFocus
                aria-invalid={Boolean(errors.customerName)}
                {...register("customerName")}
              />
              <FieldError>{errors.customerName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="edit-order-phone">Phone</Label>
              <CashierInput
                id="edit-order-phone"
                aria-invalid={Boolean(errors.contactNumber)}
                {...register("contactNumber")}
              />
              <FieldError>{errors.contactNumber?.message}</FieldError>
            </div>
          </div>
          {order.type === "Dine-in" && (
            <div>
              <Label htmlFor="edit-order-table">Table number</Label>
              <CashierInput
                id="edit-order-table"
                aria-invalid={Boolean(errors.tableNumber)}
                {...register("tableNumber")}
              />
              <FieldError>{errors.tableNumber?.message}</FieldError>
            </div>
          )}
          {order.type === "Delivery" && (
            <div>
              <Label htmlFor="edit-order-address">Delivery address</Label>
              <CashierTextarea
                id="edit-order-address"
                aria-invalid={Boolean(errors.deliveryAddress)}
                {...register("deliveryAddress")}
              />
              <FieldError>{errors.deliveryAddress?.message}</FieldError>
            </div>
          )}
          <div>
            <Label htmlFor="edit-order-instructions">Order instructions</Label>
            <CashierTextarea
              id="edit-order-instructions"
              {...register("orderInstructions")}
            />
            <FieldError>{errors.orderInstructions?.message}</FieldError>
          </div>
          <DialogFooter>
            <CashierButton
              variant="secondary"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </CashierButton>
            <CashierButton type="submit" loading={loading}>
              Save changes
            </CashierButton>
          </DialogFooter>
        </form>
      </CashierDialogContent>
    </Dialog>
  );
}
