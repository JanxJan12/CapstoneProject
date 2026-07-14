import type { FieldErrors, UseFormRegister } from "react-hook-form";
import {
  Hash,
  PauseCircle,
  RotateCcw,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";
import type { POSForm } from "../schemas";
import type { HeldOrder } from "../types";
import { DINING_TABLES } from "../constants";
import { CashierInput, FieldError, Label } from "../components/CashierUI";

export function POSOrderHeader({
  orderType,
  discountType,
  register,
  errors,
  heldOrders,
  occupiedTables,
  onNew,
  onHold,
  onVoid,
  onReopen,
}: {
  orderType: POSForm["orderType"];
  discountType: POSForm["discountType"];
  register: UseFormRegister<POSForm>;
  errors: FieldErrors<POSForm>;
  heldOrders: HeldOrder[];
  occupiedTables: string[];
  onNew: () => void;
  onHold: () => void;
  onVoid: () => void;
  onReopen: (id: string) => void;
}) {
  return (
    <div className="border-b border-border bg-gradient-to-r from-white via-[#fffaf5] to-orange-50/30 p-3.5 shadow-[0_4px_14px_rgba(67,42,23,0.035)]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1 lg:max-w-[240px]">
          <Label htmlFor="customer-name">
            <span className="flex items-center gap-1">
              <UserRound className="h-3 w-3" />
              Customer
            </span>
          </Label>
          <CashierInput
            id="customer-name"
            placeholder="Walk-in Customer"
            maxLength={80}
            {...register("customerName")}
          />
          <FieldError>{errors.customerName?.message}</FieldError>
        </div>
        <div>
          <Label>Order type</Label>
          <div className="flex min-h-11 items-center rounded-xl border border-border bg-muted/70 p-1 shadow-inner">
            {(["Dine-in", "Take-out"] as const).map((type) => (
              <label
                key={type}
                className={`flex min-h-9 cursor-pointer items-center rounded-lg px-4 text-xs font-black transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${orderType === type ? "bg-white text-primary shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:text-foreground"}`}
              >
                <input
                  type="radio"
                  value={type}
                  className="sr-only"
                  {...register("orderType")}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        {orderType === "Dine-in" && (
          <div className="w-36">
            <Label htmlFor="table-number">
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Table
              </span>
            </Label>
            <select
              id="table-number"
              className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
              {...register("tableNumber")}
            >
              <option value="">Select table</option>
              {DINING_TABLES.map((table) => (
                <option
                  key={table}
                  value={table}
                  disabled={occupiedTables.includes(table)}
                >
                  Table {table}
                  {occupiedTables.includes(table) ? " · Occupied" : ""}
                </option>
              ))}
            </select>
            <FieldError>{errors.tableNumber?.message}</FieldError>
          </div>
        )}
        <div className="min-w-[150px]">
          <Label htmlFor="discount-type">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Discount
            </span>
          </Label>
          <select
            id="discount-type"
            className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
            {...register("discountType")}
          >
            <option>None</option>
            <option>Senior Citizen</option>
            <option>PWD</option>
          </select>
        </div>
        {discountType !== "None" && (
          <div className="min-w-[150px]">
            <Label htmlFor="discount-reference">ID / reference</Label>
            <CashierInput
              id="discount-reference"
              placeholder="Required"
              {...register("discountReference")}
            />
            <FieldError>{errors.discountReference?.message}</FieldError>
          </div>
        )}
        {heldOrders.length > 0 && (
          <div className="min-w-[150px]">
            <Label htmlFor="held-order">Held orders</Label>
            <select
              id="held-order"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) onReopen(event.target.value);
                event.target.value = "";
              }}
              className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-xs font-bold"
            >
              <option value="">Reopen held…</option>
              {heldOrders.map((held) => (
                <option key={held.id} value={held.id}>
                  {held.id} · {held.customerName || "Walk-in"} ·{" "}
                  {held.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  items
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-1">
          <Action label="New" icon={RotateCcw} onClick={onNew} />
          <Action label="Hold" icon={PauseCircle} onClick={onHold} />
          <Action label="Void" icon={XCircle} danger onClick={onVoid} />
        </div>
      </div>
    </div>
  );
}

function Action({
  label,
  icon: Icon,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-black shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-border bg-white text-muted-foreground hover:border-primary/25 hover:bg-amber-50/40 hover:text-foreground"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
