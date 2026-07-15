import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Hash, UserRound, Utensils } from "lucide-react";
import {
  CashierInput,
  CashierSelect,
  CashierTextarea,
  FieldError,
  Label,
} from "../components/CashierUI";
import { DINING_TABLES } from "../constants";
import type { POSForm } from "../schemas";

export function POSOrderDetails({
  orderNumber,
  orderType,
  discountType,
  occupiedTables,
  register,
  errors,
}: {
  orderNumber: string;
  orderType: POSForm["orderType"];
  discountType: POSForm["discountType"];
  occupiedTables: string[];
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
}) {
  return (
    <section className="pos-order-details shrink-0 border-b px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="pos-order-number flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black">
            <Hash className="h-3.5 w-3.5" /> {orderNumber.replace("ORD-", "")}
          </span>
          <div>
            <p className="text-xs font-black">Order details</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {orderType}
            </p>
          </div>
        </div>
        <span className="text-[9px] font-bold text-muted-foreground">
          Unsaved draft
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="pos-table-number">
            <Utensils className="h-3 w-3" /> Table number
          </Label>
          <CashierSelect
            id="pos-table-number"
            disabled={orderType !== "Dine-in"}
            aria-invalid={Boolean(errors.tableNumber)}
            {...register("tableNumber")}
          >
            <option value="">
              {orderType === "Dine-in" ? "Select table" : "Not required"}
            </option>
            {DINING_TABLES.map((table) => (
              <option
                key={table}
                value={table}
                disabled={occupiedTables.includes(String(Number(table)))}
              >
                Table {table}
                {occupiedTables.includes(String(Number(table)))
                  ? " · Occupied"
                  : ""}
              </option>
            ))}
          </CashierSelect>
          <FieldError>{errors.tableNumber?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="pos-customer-name">
            <UserRound className="h-3 w-3" /> Customer name
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
      </div>

      <details className="pos-order-options mt-2">
        <summary className="flex min-h-10 cursor-pointer items-center justify-between rounded-lg px-2 text-[10px] font-black">
          Discount and special instructions
          <span className="normal-case text-primary">
            {discountType === "None" ? "Optional" : discountType}
          </span>
        </summary>
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="pos-discount-type">Discount</Label>
              <CashierSelect
                id="pos-discount-type"
                {...register("discountType")}
              >
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
                placeholder={discountType === "None" ? "Not required" : "Required"}
                aria-invalid={Boolean(errors.discountReference)}
                {...register("discountReference")}
              />
              <FieldError>{errors.discountReference?.message}</FieldError>
            </div>
          </div>
          <div>
            <Label htmlFor="order-instructions">Special instructions</Label>
            <CashierTextarea
              id="order-instructions"
              maxLength={300}
              placeholder="Instructions for the entire order…"
              className="min-h-16 text-xs"
              aria-invalid={Boolean(errors.orderInstructions)}
              {...register("orderInstructions")}
            />
            <FieldError>{errors.orderInstructions?.message}</FieldError>
          </div>
        </div>
      </details>
    </section>
  );
}
