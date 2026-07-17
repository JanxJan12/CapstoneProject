import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { UserRound, Utensils } from "lucide-react";
import {
  CashierInput,
  CashierSelect,
  CashierTextarea,
  FieldError,
  Label,
} from "../components";
import { DINING_TABLES } from "../constants";
import type { POSForm } from "../schemas";
import type { WalkInOrderType } from "./types";

export interface POSOrderDetailsProps {
  orderType: WalkInOrderType;
  discountType: POSForm["discountType"];
  occupiedTables: string[];
  optionsOpen: boolean;
  onOptionsOpenChange: (open: boolean) => void;
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
}

export function POSOrderDetails({
  orderType,
  discountType,
  occupiedTables,
  optionsOpen,
  onOptionsOpenChange,
  register,
  errors,
}: POSOrderDetailsProps) {
  return (
    <section className="pos-order-details shrink-0 border-t px-4 py-3">
      <div className="mb-3">
        <p className="text-xs font-black">Order information</p>
        <p className="mt-1 text-[9px] font-semibold text-muted-foreground">
          Complete only the details required for this transaction.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {orderType === "Dine-in" ? (
          <div>
            <Label htmlFor="pos-table-number">
              <Utensils className="h-3 w-3" /> Table number
            </Label>
            <CashierSelect
              id="pos-table-number"
              aria-invalid={Boolean(errors.tableNumber)}
              {...register("tableNumber")}
            >
              <option value="">Select table</option>
              {DINING_TABLES.map((table) => {
                const occupied = occupiedTables.includes(String(Number(table)));
                return (
                  <option key={table} value={table} disabled={occupied}>
                    Table {table}
                    {occupied ? " · Occupied" : ""}
                  </option>
                );
              })}
            </CashierSelect>
            <FieldError>{errors.tableNumber?.message}</FieldError>
          </div>
        ) : null}

        <div className={orderType === "Take-out" ? "col-span-2" : ""}>
          <Label htmlFor="pos-customer-name">
            <UserRound className="h-3 w-3" /> Customer name (optional)
          </Label>
          <CashierInput
            id="pos-customer-name"
            placeholder="Walk-in Customer"
            autoComplete="off"
            aria-invalid={Boolean(errors.customerName)}
            {...register("customerName")}
          />
          <FieldError>{errors.customerName?.message}</FieldError>
        </div>

        <div className="col-span-2">
          <Label htmlFor="order-instructions">Order notes (optional)</Label>
          <CashierTextarea
            id="order-instructions"
            maxLength={300}
            placeholder="Notes for the whole order…"
            className="min-h-14 text-xs"
            aria-invalid={Boolean(errors.orderInstructions)}
            {...register("orderInstructions")}
          />
          <FieldError>{errors.orderInstructions?.message}</FieldError>
        </div>
      </div>

      <details
        id="pos-order-options"
        open={optionsOpen}
        onToggle={(event) => onOptionsOpenChange(event.currentTarget.open)}
        className="pos-order-options mt-2"
      >
        <summary className="flex min-h-10 cursor-pointer items-center justify-between rounded-lg px-2 text-[10px] font-black">
          Discount
          <span className="normal-case text-primary">
            {discountType === "None" ? "Optional" : discountType}
          </span>
        </summary>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div>
            <Label htmlFor="pos-discount-type">Discount</Label>
            <CashierSelect id="pos-discount-type" {...register("discountType")}>
              <option value="None">No discount</option>
              <option value="Senior Citizen">Senior Citizen · 20%</option>
              <option value="PWD">PWD · 20%</option>
            </CashierSelect>
          </div>
          <div>
            <Label htmlFor="pos-discount-reference">ID / reference</Label>
            <CashierInput
              id="pos-discount-reference"
              disabled={discountType === "None"}
              placeholder={
                discountType === "None" ? "Not required" : "Required"
              }
              aria-invalid={Boolean(errors.discountReference)}
              {...register("discountReference")}
            />
            <FieldError>{errors.discountReference?.message}</FieldError>
          </div>
        </div>
      </details>
    </section>
  );
}
