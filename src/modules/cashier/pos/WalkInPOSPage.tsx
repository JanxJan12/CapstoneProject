import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LayoutGrid, ShoppingBasket } from "lucide-react";
import { DISCOUNT_RATE, POS_DRAFT_STORAGE_KEY } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { posSchema, type POSForm } from "../schemas";
import type { MenuItem, Order, OrderItem } from "../types";
import { ErrorBanner } from "../components/CashierUI";
import { MenuGrid } from "./MenuGrid";
import { MenuItemDialog } from "./MenuItemDialog";
import { PaymentPanel } from "./PaymentPanel";
import { PlaceOrderDialog } from "./PlaceOrderDialog";
import { POSCart } from "./POSCart";
import { POSOrderHeader } from "./POSOrderHeader";
import { ReceiptDialog } from "./ReceiptDialog";
import { VoidOrderDialog } from "./VoidOrderDialog";

const defaults: POSForm = {
  customerName: "",
  orderType: "Dine-in",
  tableNumber: "",
  paymentMethod: "Cash",
  amountTendered: 0,
  gcashReference: "",
  discountType: "None",
  discountReference: "",
  orderInstructions: "",
};

type CartLine = Omit<OrderItem, "id">;

function loadDraft(): { cart: CartLine[]; form: POSForm } {
  try {
    const saved = JSON.parse(
      localStorage.getItem(POS_DRAFT_STORAGE_KEY) ?? "null",
    ) as { cart?: CartLine[]; form?: Partial<POSForm> } | null;
    return {
      cart: Array.isArray(saved?.cart) ? saved.cart : [],
      form: { ...defaults, ...saved?.form },
    };
  } catch {
    return { cart: [], form: defaults };
  }
}

export function WalkInPOSPage({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const {
    state,
    activeShift,
    createWalkInOrder,
    holdOrder,
    removeHeldOrder,
    voidDraftOrder,
  } = useCashierStore();
  const draft = useMemo(loadDraft, []);
  const [cart, setCart] = useState<CartLine[]>(draft.cart);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuItem>();
  const [tabletPane, setTabletPane] = useState<"menu" | "order">("menu");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    watch,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<POSForm>({
    resolver: zodResolver(posSchema),
    defaultValues: draft.form,
    mode: "onTouched",
  });
  const values = watch();
  const occupiedTables = useMemo(
    () =>
      state.orders
        .filter(
          (order) =>
            order.type === "Dine-in" &&
            order.tableNumber &&
            !["Completed", "Cancelled"].includes(order.status),
        )
        .map((order) => String(Number(order.tableNumber))),
    [state.orders],
  );
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );
  const discountAmount =
    values.discountType === "None"
      ? 0
      : Math.round(subtotal * DISCOUNT_RATE * 100) / 100;
  const total = subtotal - discountAmount;
  const tendered = Number(values.amountTendered ?? 0);
  const isDirty = cart.length > 0;
  const selectedTableOccupied =
    values.orderType === "Dine-in" &&
    occupiedTables.includes(String(Number(values.tableNumber)));
  const unavailableItem = cart.find((entry) => {
    const menuItem = state.menuItems.find(
      (item) => item.id === entry.menuItemId,
    );
    return !menuItem?.available;
  });
  const canPlace =
    cart.length > 0 &&
    (values.orderType !== "Dine-in" || Boolean(values.tableNumber?.trim())) &&
    !selectedTableOccupied &&
    !unavailableItem &&
    (values.discountType === "None" ||
      Boolean(values.discountReference?.trim())) &&
    (values.paymentMethod === "Cash"
      ? tendered >= total
      : Boolean(values.gcashReference?.trim()));
  const disabledReason = !cart.length
    ? "Add at least one menu item to continue."
    : unavailableItem
      ? `${unavailableItem.name} is no longer available. Remove it to continue.`
      : values.orderType === "Dine-in" && !values.tableNumber?.trim()
        ? "Select an available table for this dine-in order."
        : selectedTableOccupied
          ? `Table ${values.tableNumber} already has an active order.`
          : values.discountType !== "None" && !values.discountReference?.trim()
            ? "Enter the Senior/PWD ID or reference."
            : values.paymentMethod === "Cash" && tendered < total
              ? "Enter enough cash tendered to cover the total."
              : values.paymentMethod === "GCash" &&
                  !values.gcashReference?.trim()
                ? "Enter the customer's GCash reference number."
                : undefined;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);
  useEffect(() => {
    if (cart.length) {
      localStorage.setItem(
        POS_DRAFT_STORAGE_KEY,
        JSON.stringify({ cart, form: values }),
      );
    } else {
      localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
    }
  }, [cart, values]);
  useEffect(() => {
    if (draft.cart.length) {
      toast.info("Unsaved order restored", {
        description: "Your cart and payment details were recovered.",
      });
    }
  }, [draft.cart.length]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const addItem = (menuItem: MenuItem, quantity = 1, itemNote = "") =>
    setCart((current) => {
      const existing = current.find(
        (entry) => entry.menuItemId === menuItem.id,
      );
      if (existing) {
        const nextQuantity = Math.min(99, existing.quantity + quantity);
        if (nextQuantity === existing.quantity) {
          toast.error("Maximum quantity reached", {
            description: `${menuItem.name} is limited to 99 per order.`,
          });
          return current;
        }
        return current.map((entry) =>
          entry.menuItemId === menuItem.id
            ? {
                ...entry,
                quantity: nextQuantity,
                note: itemNote.trim() || entry.note,
              }
            : entry,
        );
      }
      return [
        ...current,
        {
          menuItemId: menuItem.id,
          name: menuItem.name,
          unitPrice: menuItem.price,
          quantity: Math.min(99, Math.max(1, quantity)),
          note: itemNote.trim() || undefined,
        },
      ];
    });
  const adjust = (menuItemId: string, delta: number) =>
    setCart((current) =>
      current
        .map((entry) =>
          entry.menuItemId === menuItemId
            ? {
                ...entry,
                quantity: Math.min(99, entry.quantity + delta),
              }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  const remove = (menuItemId: string) =>
    setCart((current) =>
      current.filter((entry) => entry.menuItemId !== menuItemId),
    );
  const note = (menuItemId: string, value: string) =>
    setCart((current) =>
      current.map((entry) =>
        entry.menuItemId === menuItemId ? { ...entry, note: value } : entry,
      ),
    );
  const resetPOS = () => {
    setCart([]);
    setCategory("All");
    setSearch("");
    reset(defaults);
    setError("");
    localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
  };
  const guardedReset = () => {
    if (!isDirty || window.confirm("Discard the current unsaved order?"))
      resetPOS();
  };

  const handleHold = async () => {
    if (!cart.length) {
      toast.error("There is no order to hold.");
      return;
    }
    setLoading(true);
    try {
      const held = await holdOrder({
        customerName: values.customerName?.trim() || "Walk-in Customer",
        type: values.orderType,
        tableNumber: values.tableNumber,
        items: cart.map((entry, index) => ({
          ...entry,
          id: `HELD-ITEM-${index + 1}`,
        })),
        discountType:
          values.discountType === "None" ? null : values.discountType,
        discountReference: values.discountReference,
        orderInstructions: values.orderInstructions,
      });
      toast.success(`${held.id} held`, {
        description: "The cart can be reopened from the order header.",
      });
      resetPOS();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to hold the order.",
      );
    } finally {
      setLoading(false);
    }
  };
  const reopenHeld = (heldId: string) => {
    const held = state.heldOrders.find((entry) => entry.id === heldId);
    if (!held) return;
    if (
      isDirty &&
      !window.confirm("Replace the active cart with this held order?")
    )
      return;
    setCart(held.items.map(({ id: _id, ...entry }) => entry));
    setValue("customerName", held.customerName ?? "");
    setValue("orderType", held.type);
    setValue("tableNumber", held.tableNumber ?? "");
    setValue("discountType", held.discountType ?? "None");
    setValue("discountReference", held.discountReference ?? "");
    setValue("orderInstructions", held.orderInstructions ?? "");
    removeHeldOrder(held.id);
    toast.success(`${held.id} reopened`);
  };
  const openConfirmation = handleSubmit(() => {
    setError("");
    if (unavailableItem) {
      setError(`${unavailableItem.name} is currently unavailable.`);
      return;
    }
    if (selectedTableOccupied) {
      setError(`Table ${values.tableNumber} already has an active order.`);
      return;
    }
    if (values.paymentMethod === "Cash" && tendered < total) {
      setError("Cash tendered is insufficient.");
      return;
    }
    setConfirmOpen(true);
  });
  const placeOrder = async () => {
    setLoading(true);
    setError("");
    try {
      const order = await createWalkInOrder({
        customerName: values.customerName,
        type: values.orderType,
        tableNumber: values.tableNumber,
        items: cart,
        discountType:
          values.discountType === "None" ? null : values.discountType,
        discountReference: values.discountReference,
        orderInstructions: values.orderInstructions,
        paymentMethod: values.paymentMethod,
        amountTendered: tendered,
        gcashReference: values.gcashReference,
      });
      setConfirmOpen(false);
      setReceiptOrder(order);
      resetPOS();
      toast.success(`${order.id} created`, {
        description:
          "Payment, transaction, and kitchen records were created together.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to place the order.";
      setError(message);
      toast.error("Order could not be placed", { description: message });
    } finally {
      setLoading(false);
    }
  };
  const voidCurrent = async (reason: string) => {
    setLoading(true);
    setError("");
    try {
      await voidDraftOrder(
        {
          customerName: values.customerName,
          type: values.orderType,
          tableNumber: values.tableNumber,
          items: cart,
          discountType:
            values.discountType === "None" ? null : values.discountType,
          discountReference: values.discountReference,
          orderInstructions: values.orderInstructions,
          amountTendered: tendered,
          gcashReference: values.gcashReference,
        },
        reason,
      );
      setVoidOpen(false);
      resetPOS();
      toast.success("Order voided", {
        description: "A non-destructive audit record was saved.",
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to void the order.",
      );
    } finally {
      setLoading(false);
    }
  };

  const receiptPayment = state.payments.find(
    (entry) => entry.orderId === receiptOrder?.id,
  );
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="tablet-pos flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_18px_45px_rgba(67,42,23,0.09)] ring-1 ring-white/70">
      <POSOrderHeader
        orderType={values.orderType}
        discountType={values.discountType}
        register={register}
        errors={errors}
        heldOrders={state.heldOrders}
        occupiedTables={occupiedTables}
        onNew={guardedReset}
        onHold={handleHold}
        onVoid={() =>
          cart.length
            ? setVoidOpen(true)
            : toast.error("There is no order to void.")
        }
        onReopen={reopenHeld}
      />
      {error && (
        <div className="p-3 pb-0">
          <ErrorBanner message={error} onRetry={() => setError("")} />
        </div>
      )}
      <div className="pos-tablet-switch" role="tablist" aria-label="Point of sale view">
        <button
          type="button"
          role="tab"
          aria-selected={tabletPane === "menu"}
          onClick={() => setTabletPane("menu")}
          className={tabletPane === "menu" ? "is-active" : ""}
        >
          <LayoutGrid className="h-4 w-4" /> Menu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabletPane === "order"}
          onClick={() => setTabletPane("order")}
          className={tabletPane === "order" ? "is-active" : ""}
        >
          <ShoppingBasket className="h-4 w-4" /> Current Order
          <span>{itemCount}</span>
          <strong>
            {total.toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
            })}
          </strong>
        </button>
      </div>
      <div className="pos-workspace flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className={`pos-pane pos-menu-pane min-h-0 min-w-0 flex-1 ${tabletPane === "menu" ? "is-active" : ""}`}>
          <MenuGrid
            menuItems={state.menuItems}
            cart={cart}
            category={category}
            search={search}
            onCategoryChange={setCategory}
            onSearchChange={setSearch}
            onSelect={setSelectedItem}
          />
        </div>
        <aside className={`pos-pane pos-order-pane w-full shrink-0 flex-col overflow-hidden border-t border-border bg-white shadow-[-8px_0_24px_rgba(67,42,23,0.035)] lg:flex lg:w-[390px] lg:border-t-0 ${tabletPane === "order" ? "is-active flex" : "hidden"}`}>
          <POSCart
            items={cart}
            onAdjust={adjust}
            onRemove={remove}
            onNoteChange={note}
            onClear={() => {
              if (window.confirm("Clear all items from the cart?")) setCart([]);
            }}
          />
          <details className="pos-order-notes shrink-0 border-t border-border bg-[#fffdfb]">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Order instructions
              <span className="normal-case tracking-normal text-primary">Add note</span>
            </summary>
            <div className="px-4 pb-3">
              <textarea
                id="order-instructions"
                aria-label="Order instructions"
                placeholder="Special instructions for the whole order…"
                className="min-h-16 w-full rounded-xl border border-border bg-[#fbf8f4] p-3 text-xs outline-none transition focus:border-primary/50 focus:bg-white focus:ring-4 focus:ring-primary/10"
                {...register("orderInstructions")}
              />
            </div>
          </details>
          <PaymentPanel
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            paymentMethod={values.paymentMethod}
            tendered={tendered}
            register={register}
            errors={errors}
            canPlace={canPlace}
            disabledReason={disabledReason}
            shiftOpen={Boolean(activeShift)}
            onTenderedChange={(amount) =>
              setValue("amountTendered", amount, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            onConfirm={openConfirmation}
          />
        </aside>
      </div>
      <PlaceOrderDialog
        open={confirmOpen}
        loading={loading}
        itemCount={itemCount}
        customerName={values.customerName?.trim() || "Walk-in Customer"}
        orderType={values.orderType}
        tableNumber={
          values.orderType === "Dine-in" ? values.tableNumber : undefined
        }
        total={total}
        paymentMethod={values.paymentMethod}
        onOpenChange={setConfirmOpen}
        onConfirm={placeOrder}
      />
      <VoidOrderDialog
        open={voidOpen}
        loading={loading}
        onOpenChange={setVoidOpen}
        onConfirm={voidCurrent}
      />
      <ReceiptDialog
        order={receiptOrder}
        payment={receiptPayment}
        open={Boolean(receiptOrder)}
        onClose={() => setReceiptOrder(undefined)}
      />
      <MenuItemDialog
        item={selectedItem}
        currentQuantity={
          cart.find((entry) => entry.menuItemId === selectedItem?.id)
            ?.quantity ?? 0
        }
        onClose={() => setSelectedItem(undefined)}
        onAdd={addItem}
      />
    </div>
  );
}
