import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { LayoutGrid, ShoppingBasket } from "lucide-react";
import {
  DISCOUNT_RATE,
  POS_DRAFT_STORAGE_KEY,
  POS_FAVORITES_STORAGE_KEY,
  POS_TAX_ENABLED,
  POS_TAX_RATE,
} from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { posSchema, type POSForm } from "../schemas";
import type { MenuItem, Order, OrderItem, OrderItemModifier } from "../types";
import { CashierConfirmDialog, ErrorBanner } from "../components/CashierUI";
import { MenuGrid } from "./MenuGrid";
import { MenuItemDialog } from "./MenuItemDialog";
import { PaymentPanel } from "./PaymentPanel";
import { PlaceOrderDialog } from "./PlaceOrderDialog";
import { POSCart } from "./POSCart";
import { POSOrderDetails } from "./POSOrderDetails";
import { POSOrderHeader } from "./POSOrderHeader";
import { ReceiptDialog } from "./ReceiptDialog";
import { ReceiptPreviewDialog } from "./ReceiptPreviewDialog";
import type { POSCartLine } from "./types";
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

type StoredCartLine = Omit<OrderItem, "id"> & { lineId?: string };
type PendingPOSAction =
  { type: "reset" } | { type: "clear" } | { type: "reopen"; heldId: string };

let lineSequence = 0;
const createLineId = () => `POS-LINE-${Date.now()}-${++lineSequence}`;

function loadDraft(): { cart: POSCartLine[]; form: POSForm } {
  try {
    const saved = JSON.parse(
      localStorage.getItem(POS_DRAFT_STORAGE_KEY) ?? "null",
    ) as { cart?: StoredCartLine[]; form?: Partial<POSForm> } | null;
    return {
      cart: Array.isArray(saved?.cart)
        ? saved.cart.map((entry) => ({
            ...entry,
            lineId: entry.lineId || createLineId(),
          }))
        : [],
      form: {
        ...defaults,
        ...saved?.form,
        customerName: "",
        tableNumber: "",
        discountType: "None",
        discountReference: "",
      },
    };
  } catch {
    return { cart: [], form: defaults };
  }
}

function loadFavorites(): string[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem(POS_FAVORITES_STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(saved)
      ? saved.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
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
  const [cart, setCart] = useState<POSCartLine[]>(draft.cart);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavorites);
  const [selectedItem, setSelectedItem] = useState<MenuItem>();
  const [tabletPane, setTabletPane] = useState<"menu" | "order">("menu");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingPOSAction>();
  const menuSearchRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<HTMLButtonElement>(null);
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
  const recentIds = useMemo(() => {
    const unique = new Set<string>();
    for (const order of state.orders) {
      for (const item of order.items) unique.add(item.menuItemId);
      if (unique.size >= 8) break;
    }
    return [...unique].slice(0, 8);
  }, [state.orders]);
  const bestSellerIds = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const order of state.orders) {
      if (order.status === "Cancelled") continue;
      for (const item of order.items) {
        quantities.set(
          item.menuItemId,
          (quantities.get(item.menuItemId) ?? 0) + item.quantity,
        );
      }
    }
    return [...quantities.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([id]) => id);
  }, [state.orders]);
  const orderNumber = useMemo(() => {
    const max = state.orders.reduce((current, order) => {
      const parsed = Number(order.id.match(/(\d+)$/)?.[1] ?? 0);
      return Math.max(current, parsed);
    }, 0);
    return `ORD-${max + 1}`;
  }, [state.orders]);
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart],
  );
  const discountAmount =
    values.discountType === "None"
      ? 0
      : Math.round(subtotal * DISCOUNT_RATE * 100) / 100;
  const taxAmount = POS_TAX_ENABLED
    ? Math.round((subtotal - discountAmount) * POS_TAX_RATE * 100) / 100
    : 0;
  const total = subtotal - discountAmount + taxAmount;
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
  const inventoryIssue = useMemo(() => {
    const requested = new Map<string, number>();
    for (const entry of cart) {
      requested.set(
        entry.menuItemId,
        (requested.get(entry.menuItemId) ?? 0) + entry.quantity,
      );
    }
    for (const [menuItemId, quantity] of requested) {
      const menuItem = state.menuItems.find((item) => item.id === menuItemId);
      if (
        menuItem?.inventoryRemaining !== undefined &&
        quantity > menuItem.inventoryRemaining
      ) {
        return `Only ${menuItem.inventoryRemaining} ${menuItem.name} remaining.`;
      }
    }
    return undefined;
  }, [cart, state.menuItems]);
  const canPlace =
    cart.length > 0 &&
    (values.orderType !== "Dine-in" || Boolean(values.tableNumber?.trim())) &&
    !selectedTableOccupied &&
    !unavailableItem &&
    !inventoryIssue &&
    (values.discountType === "None" ||
      Boolean(values.discountReference?.trim())) &&
    (values.paymentMethod === "Cash"
      ? tendered >= total
      : Boolean(values.gcashReference?.trim()));
  const disabledReason = !cart.length
    ? "Add at least one menu item to continue."
    : unavailableItem
      ? `${unavailableItem.name} is no longer available. Remove it to continue.`
      : inventoryIssue
        ? `${inventoryIssue} Adjust the quantity to continue.`
        : values.orderType === "Dine-in" && !values.tableNumber?.trim()
          ? "Select an available table for this dine-in order."
          : selectedTableOccupied
            ? `Table ${values.tableNumber} already has an active order.`
            : values.discountType !== "None" &&
                !values.discountReference?.trim()
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
  useEffect(() => {
    localStorage.setItem(
      POS_FAVORITES_STORAGE_KEY,
      JSON.stringify(favoriteIds),
    );
  }, [favoriteIds]);
  useEffect(() => {
    const focusMenuSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if ((event.key === "/" || event.key === "F2") && !editing) {
        event.preventDefault();
        setTabletPane("menu");
        window.requestAnimationFrame(() => menuSearchRef.current?.focus());
        return;
      }
      if (event.key === "F3" && !editing) {
        event.preventDefault();
        setTabletPane("order");
        window.requestAnimationFrame(() => checkoutRef.current?.click());
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        !editing
      ) {
        event.preventDefault();
        checkoutRef.current?.click();
      }
    };
    window.addEventListener("keydown", focusMenuSearch);
    return () => window.removeEventListener("keydown", focusMenuSearch);
  }, []);

  const addItem = (
    menuItem: MenuItem,
    quantity = 1,
    itemNote = "",
    modifiers: OrderItemModifier[] = [],
  ) =>
    setCart((current) => {
      const currentQuantity = current
        .filter((entry) => entry.menuItemId === menuItem.id)
        .reduce((sum, entry) => sum + entry.quantity, 0);
      const capacity = Math.max(
        0,
        Math.min(
          99 - currentQuantity,
          (menuItem.inventoryRemaining ?? 99) - currentQuantity,
        ),
      );
      if (capacity === 0) {
        toast.error(
          menuItem.inventoryRemaining !== undefined &&
            currentQuantity >= menuItem.inventoryRemaining
            ? `Only ${menuItem.inventoryRemaining} ${menuItem.name} remaining.`
            : "Maximum quantity reached",
        );
        return current;
      }
      const amountToAdd = Math.min(capacity, Math.max(1, quantity));
      if (amountToAdd < quantity) {
        toast.warning(`Quantity limited to ${currentQuantity + amountToAdd}`, {
          description: `The cart now contains the maximum available ${menuItem.name}.`,
        });
      }
      const normalizedNote = itemNote.trim();
      const modifierKey = modifiers
        .map((modifier) => modifier.id)
        .sort()
        .join("|");
      const existing = current.find(
        (entry) =>
          entry.menuItemId === menuItem.id &&
          (entry.note?.trim() ?? "") === normalizedNote &&
          (entry.modifiers ?? [])
            .map((modifier) => modifier.id)
            .sort()
            .join("|") === modifierKey,
      );
      if (existing) {
        return current.map((entry) =>
          entry.lineId === existing.lineId
            ? {
                ...entry,
                quantity: entry.quantity + amountToAdd,
              }
            : entry,
        );
      }
      return [
        ...current,
        {
          lineId: createLineId(),
          menuItemId: menuItem.id,
          name: menuItem.name,
          unitPrice:
            menuItem.price +
            modifiers.reduce((sum, modifier) => sum + modifier.price, 0),
          quantity: amountToAdd,
          note: normalizedNote || undefined,
          modifiers: modifiers.length
            ? modifiers.map((modifier) => ({ ...modifier }))
            : undefined,
        },
      ];
    });
  const setLineQuantity = (lineId: string, quantity: number) =>
    setCart((current) =>
      current.map((entry) => {
        if (entry.lineId !== lineId) return entry;
        const menuItem = state.menuItems.find(
          (item) => item.id === entry.menuItemId,
        );
        const quantityInOtherLines = current
          .filter(
            (candidate) =>
              candidate.menuItemId === entry.menuItemId &&
              candidate.lineId !== lineId,
          )
          .reduce((sum, candidate) => sum + candidate.quantity, 0);
        const maximum = Math.max(
          1,
          Math.min(
            99 - quantityInOtherLines,
            (menuItem?.inventoryRemaining ?? 99) - quantityInOtherLines,
          ),
        );
        return {
          ...entry,
          quantity: Math.min(maximum, Math.max(1, Math.round(quantity))),
        };
      }),
    );
  const adjust = (lineId: string, delta: number) => {
    const line = cart.find((entry) => entry.lineId === lineId);
    if (!line) return;
    if (line.quantity + delta <= 0) {
      setCart((current) => current.filter((entry) => entry.lineId !== lineId));
      return;
    }
    setLineQuantity(lineId, line.quantity + delta);
  };
  const remove = (lineId: string) =>
    setCart((current) => current.filter((entry) => entry.lineId !== lineId));
  const note = (lineId: string, value: string) =>
    setCart((current) =>
      current.map((entry) =>
        entry.lineId === lineId ? { ...entry, note: value } : entry,
      ),
    );
  const reorder = (sourceLineId: string, targetLineId: string) =>
    setCart((current) => {
      const sourceIndex = current.findIndex(
        (entry) => entry.lineId === sourceLineId,
      );
      const targetIndex = current.findIndex(
        (entry) => entry.lineId === targetLineId,
      );
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
        return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  const resetPOS = () => {
    setCart([]);
    setCategory("All");
    setSearch("");
    reset(defaults);
    setError("");
    localStorage.removeItem(POS_DRAFT_STORAGE_KEY);
  };
  const guardedReset = () => {
    if (isDirty) setPendingAction({ type: "reset" });
    else resetPOS();
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
        items: cart.map(({ lineId: _lineId, ...entry }, index) => ({
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
  const performReopen = (heldId: string) => {
    const held = state.heldOrders.find((entry) => entry.id === heldId);
    if (!held) return;
    setCart(
      held.items.map(({ id: _id, ...entry }) => ({
        ...entry,
        lineId: createLineId(),
      })),
    );
    setValue("customerName", held.customerName ?? "");
    setValue("orderType", held.type);
    setValue("tableNumber", held.tableNumber ?? "");
    setValue("discountType", held.discountType ?? "None");
    setValue("discountReference", held.discountReference ?? "");
    setValue("orderInstructions", held.orderInstructions ?? "");
    removeHeldOrder(held.id);
    toast.success(`${held.id} reopened`);
  };
  const reopenHeld = (heldId: string) => {
    if (isDirty) setPendingAction({ type: "reopen", heldId });
    else performReopen(heldId);
  };
  const openConfirmation = handleSubmit(() => {
    setError("");
    if (unavailableItem) {
      setError(`${unavailableItem.name} is currently unavailable.`);
      return;
    }
    if (inventoryIssue) {
      setError(`${inventoryIssue} Adjust the quantity to continue.`);
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
        items: cart.map(({ lineId: _lineId, ...entry }) => entry),
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
          items: cart.map(({ lineId: _lineId, ...entry }) => entry),
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
    <div className="tablet-pos flex h-full min-h-0 flex-col overflow-hidden border">
      <POSOrderHeader
        orderType={values.orderType}
        busy={loading}
        register={register}
        heldOrders={state.heldOrders}
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
      <div
        className="pos-tablet-switch"
        role="tablist"
        aria-label="Point of sale view"
      >
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
        <div
          className={`pos-pane pos-menu-pane min-h-0 min-w-0 flex-1 ${tabletPane === "menu" ? "is-active" : ""}`}
        >
          <MenuGrid
            menuItems={state.menuItems}
            searchRef={menuSearchRef}
            cart={cart}
            category={category}
            search={search}
            recentIds={recentIds}
            bestSellerIds={bestSellerIds}
            favoriteIds={favoriteIds}
            onCategoryChange={setCategory}
            onSearchChange={setSearch}
            onSelect={setSelectedItem}
            onQuickAdd={(item) => addItem(item)}
            onToggleFavorite={(itemId) =>
              setFavoriteIds((current) =>
                current.includes(itemId)
                  ? current.filter((id) => id !== itemId)
                  : [...current, itemId],
              )
            }
          />
        </div>
        <aside
          className={`pos-pane pos-order-pane w-full shrink-0 flex-col overflow-hidden border-t lg:flex lg:w-[390px] lg:border-t-0 ${tabletPane === "order" ? "is-active flex" : "hidden"}`}
        >
          <POSOrderDetails
            orderNumber={orderNumber}
            orderType={values.orderType}
            discountType={values.discountType}
            occupiedTables={occupiedTables}
            register={register}
            errors={errors}
          />
          <POSCart
            items={cart}
            orderNumber={orderNumber}
            orderType={values.orderType}
            onAdjust={adjust}
            onQuantityChange={setLineQuantity}
            onRemove={remove}
            onNoteChange={note}
            onReorder={reorder}
            onClear={() => setPendingAction({ type: "clear" })}
          />
          <PaymentPanel
            subtotal={subtotal}
            discountAmount={discountAmount}
            taxAmount={taxAmount}
            taxEnabled={POS_TAX_ENABLED}
            total={total}
            paymentMethod={values.paymentMethod}
            tendered={tendered}
            register={register}
            errors={errors}
            canPlace={canPlace}
            disabledReason={disabledReason}
            shiftOpen={Boolean(activeShift)}
            checkoutRef={checkoutRef}
            onTenderedChange={(amount) =>
              setValue("amountTendered", amount, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            onPreview={() => setPreviewOpen(true)}
            onConfirm={openConfirmation}
          />
        </aside>
      </div>
      <PlaceOrderDialog
        open={confirmOpen}
        loading={loading}
        itemCount={itemCount}
        orderType={values.orderType}
        total={total}
        paymentMethod={values.paymentMethod}
        onOpenChange={setConfirmOpen}
        onConfirm={placeOrder}
      />
      <ReceiptPreviewDialog
        open={previewOpen}
        orderNumber={orderNumber}
        items={cart}
        orderType={values.orderType}
        tableNumber={
          values.orderType === "Dine-in" ? values.tableNumber : undefined
        }
        customerName={values.customerName}
        instructions={values.orderInstructions}
        subtotal={subtotal}
        discountAmount={discountAmount}
        taxAmount={taxAmount}
        total={total}
        paymentMethod={values.paymentMethod}
        onOpenChange={setPreviewOpen}
        onCheckout={() => {
          setPreviewOpen(false);
          window.requestAnimationFrame(() => checkoutRef.current?.click());
        }}
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
        placed
        onClose={() => setReceiptOrder(undefined)}
      />
      <MenuItemDialog
        item={selectedItem}
        currentQuantity={cart
          .filter((entry) => entry.menuItemId === selectedItem?.id)
          .reduce((sum, entry) => sum + entry.quantity, 0)}
        onClose={() => setSelectedItem(undefined)}
        onAdd={addItem}
      />
      <CashierConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(undefined);
        }}
        title={
          pendingAction?.type === "reopen"
            ? "Replace the current order?"
            : pendingAction?.type === "clear"
              ? "Clear every item?"
              : "Start a new order?"
        }
        description={
          pendingAction?.type === "reopen"
            ? "The active cart will be replaced by the selected held order."
            : pendingAction?.type === "clear"
              ? "All items and item notes will be removed from this cart."
              : "The active cart and payment details will be discarded."
        }
        confirmLabel={
          pendingAction?.type === "reopen"
            ? "Replace cart"
            : pendingAction?.type === "clear"
              ? "Clear cart"
              : "Start new order"
        }
        cancelLabel="Keep current order"
        danger={pendingAction?.type !== "reopen"}
        onConfirm={() => {
          if (pendingAction?.type === "reopen") {
            performReopen(pendingAction.heldId);
          } else if (pendingAction?.type === "clear") {
            setCart([]);
          } else if (pendingAction?.type === "reset") {
            resetPOS();
          }
          setPendingAction(undefined);
        }}
      />
    </div>
  );
}
