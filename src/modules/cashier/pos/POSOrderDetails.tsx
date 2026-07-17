import type { FieldErrors, UseFormRegister } from "react-hook-form";
import {
  CashierInput,
  CashierSelect,
  CashierTextarea,
  FieldError,
  Label,
} from "../components";
import type { POSForm } from "../schemas";

export interface POSOrderDetailsProps {
  discountType: POSForm["discountType"];
  optionsOpen: boolean;
  onOptionsOpenChange: (open: boolean) => void;
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
}

export function POSOrderDetails({
  discountType,
  optionsOpen,
  onOptionsOpenChange,
  register,
  errors,
}: POSOrderDetailsProps) {
  return (
    <section className="pos-order-details shrink-0 border-t px-4 py-3">
      <div className="mb-3">
        <p className="text-xs font-black">Order options</p>
        <p className="mt-1 text-[9px] font-semibold text-muted-foreground">
          Add a kitchen note or an eligible discount when needed.
        </p>
      </div>

      <div>
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
