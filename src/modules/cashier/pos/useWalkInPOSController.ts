import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Toast } from "../components";
import { POS_TAX_ENABLED } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { posSchema, type POSForm } from "../schemas";
import type { MenuItem, Order, OrderItemModifier } from "../types";
import {
  addCartItem,
  calculatePOSTotals,
  getInventoryIssue,
  getNextOrderNumber,
  getOccupiedTables,
  getPlaceOrderAvailability,
  getProductHistory,
  reorderCart,
  setCartLineQuantity,
} from "./posOperations";
import {
  clearPOSDraft,
  createLineId,
  DEFAULT_POS_FORM,
  loadPOSDraft,
  loadPOSFavorites,
  savePOSDraft,
  savePOSFavorites,
} from "./posPersistence";
import type { POSCartLine } from "./types";

export type PendingPOSAction =
  { type: "reset" } | { type: "clear" } | { type: "reopen"; heldId: string };

export function useWalkInPOSController(
  onDirtyChange: (dirty: boolean) => void,
) {
  const {
    state,
    activeShift,
    createWalkInOrder,
    holdOrder,
    removeHeldOrder,
    voidDraftOrder,
  } = useCashierStore();
  const draft = useMemo(loadPOSDraft, []);
  const [cart, setCart] = useState<POSCartLine[]>(draft.cart);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadPOSFavorites);
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
  const form = useForm<POSForm>({
    resolver: zodResolver(posSchema),
    defaultValues: draft.form,
    mode: "onTouched",
  });
  const values = form.watch();

  const occupiedTables = useMemo(
    () => getOccupiedTables(state.orders),
    [state.orders],
  );
  const productHistory = useMemo(
    () => getProductHistory(state.orders),
    [state.orders],
  );
  const orderNumber = useMemo(
    () => getNextOrderNumber(state.orders),
    [state.orders],
  );
  const totals = useMemo(
    () => calculatePOSTotals(cart, values),
    [cart, values],
  );
  const inventoryIssue = useMemo(
    () => getInventoryIssue(cart, state.menuItems),
    [cart, state.menuItems],
  );
  const availability = useMemo(
    () =>
      getPlaceOrderAvailability(
        cart,
        values,
        state.menuItems,
        occupiedTables,
        totals.total,
        totals.tendered,
        inventoryIssue,
      ),
    [
      cart,
      inventoryIssue,
      occupiedTables,
      state.menuItems,
      totals.tendered,
      totals.total,
      values,
    ],
  );
  const isDirty = cart.length > 0;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);
  useEffect(() => savePOSDraft(cart, values), [cart, values]);
  useEffect(() => {
    if (draft.cart.length) {
      Toast.info("Unsaved order restored", {
        description: "Your cart and payment details were recovered.",
      });
    }
  }, [draft.cart.length]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  useEffect(() => savePOSFavorites(favoriteIds), [favoriteIds]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const editing =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable;
      if ((event.key === "/" || event.key === "F2") && !editing) {
        event.preventDefault();
        setTabletPane("menu");
        window.requestAnimationFrame(() => menuSearchRef.current?.focus());
      } else if (event.key === "F3" && !editing) {
        event.preventDefault();
        setTabletPane("order");
        window.requestAnimationFrame(() => checkoutRef.current?.click());
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        !editing
      ) {
        event.preventDefault();
        checkoutRef.current?.click();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const addItem = useCallback(
    (
      menuItem: MenuItem,
      quantity = 1,
      itemNote = "",
      modifiers: OrderItemModifier[] = [],
    ) => {
      setCart((current) => {
        const result = addCartItem(
          current,
          menuItem,
          quantity,
          itemNote,
          modifiers,
        );
        if (result.error) Toast.error(result.error);
        if (result.warning) {
          Toast.warning(result.warning.title, {
            description: result.warning.description,
          });
        }
        return result.cart;
      });
    },
    [],
  );

  const setLineQuantity = useCallback(
    (lineId: string, quantity: number) => {
      setCart((current) =>
        setCartLineQuantity(current, lineId, quantity, state.menuItems),
      );
    },
    [state.menuItems],
  );
  const adjust = useCallback(
    (lineId: string, delta: number) => {
      setCart((current) => {
        const line = current.find((entry) => entry.lineId === lineId);
        if (!line) return current;
        if (line.quantity + delta <= 0) {
          return current.filter((entry) => entry.lineId !== lineId);
        }
        return setCartLineQuantity(
          current,
          lineId,
          line.quantity + delta,
          state.menuItems,
        );
      });
    },
    [state.menuItems],
  );
  const remove = useCallback((lineId: string) => {
    setCart((current) => current.filter((entry) => entry.lineId !== lineId));
  }, []);
  const note = useCallback((lineId: string, value: string) => {
    setCart((current) =>
      current.map((entry) =>
        entry.lineId === lineId ? { ...entry, note: value } : entry,
      ),
    );
  }, []);
  const reorder = useCallback((sourceLineId: string, targetLineId: string) => {
    setCart((current) => reorderCart(current, sourceLineId, targetLineId));
  }, []);
  const toggleFavorite = useCallback((itemId: string) => {
    setFavoriteIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }, []);

  const resetPOS = useCallback(() => {
    setCart([]);
    setCategory("All");
    setSearch("");
    form.reset(DEFAULT_POS_FORM);
    setError("");
    clearPOSDraft();
  }, [form]);
  const guardedReset = useCallback(() => {
    if (isDirty) setPendingAction({ type: "reset" });
    else resetPOS();
  }, [isDirty, resetPOS]);

  const handleHold = useCallback(async () => {
    if (!cart.length) {
      Toast.error("There is no order to hold.");
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
      Toast.success(`${held.id} held`, {
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
  }, [cart, holdOrder, resetPOS, values]);

  const performReopen = useCallback(
    (heldId: string) => {
      const held = state.heldOrders.find((entry) => entry.id === heldId);
      if (!held) return;
      setCart(
        held.items.map(({ id: _id, ...entry }) => ({
          ...entry,
          lineId: createLineId(),
        })),
      );
      form.setValue("customerName", held.customerName ?? "");
      form.setValue("orderType", held.type);
      form.setValue("tableNumber", held.tableNumber ?? "");
      form.setValue("discountType", held.discountType ?? "None");
      form.setValue("discountReference", held.discountReference ?? "");
      form.setValue("orderInstructions", held.orderInstructions ?? "");
      removeHeldOrder(held.id);
      Toast.success(`${held.id} reopened`);
    },
    [form, removeHeldOrder, state.heldOrders],
  );
  const reopenHeld = useCallback(
    (heldId: string) => {
      if (isDirty) setPendingAction({ type: "reopen", heldId });
      else performReopen(heldId);
    },
    [isDirty, performReopen],
  );

  const openConfirmation = form.handleSubmit(() => {
    setError("");
    if (availability.unavailableItem) {
      setError(
        `${availability.unavailableItem.name} is currently unavailable.`,
      );
    } else if (inventoryIssue) {
      setError(`${inventoryIssue} Adjust the quantity to continue.`);
    } else if (availability.selectedTableOccupied) {
      setError(`Table ${values.tableNumber} already has an active order.`);
    } else if (
      values.paymentMethod === "Cash" &&
      totals.tendered < totals.total
    ) {
      setError("Cash tendered is insufficient.");
    } else {
      setConfirmOpen(true);
    }
  });

  const placeOrder = useCallback(async () => {
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
        amountTendered: totals.tendered,
        gcashReference: values.gcashReference,
      });
      setConfirmOpen(false);
      setReceiptOrder(order);
      resetPOS();
      Toast.success(`${order.id} created`, {
        description:
          "Payment, transaction, and kitchen records were created together.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to place the order.";
      setError(message);
      Toast.error("Order could not be placed", { description: message });
    } finally {
      setLoading(false);
    }
  }, [cart, createWalkInOrder, resetPOS, totals.tendered, values]);

  const voidCurrent = useCallback(
    async (reason: string) => {
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
            amountTendered: totals.tendered,
            gcashReference: values.gcashReference,
          },
          reason,
        );
        setVoidOpen(false);
        resetPOS();
        Toast.success("Order voided", {
          description: "A non-destructive audit record was saved.",
        });
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to void the order.",
        );
      } finally {
        setLoading(false);
      }
    },
    [cart, resetPOS, totals.tendered, values, voidDraftOrder],
  );

  const confirmPendingAction = useCallback(() => {
    if (pendingAction?.type === "reopen") performReopen(pendingAction.heldId);
    else if (pendingAction?.type === "clear") setCart([]);
    else if (pendingAction?.type === "reset") resetPOS();
    setPendingAction(undefined);
  }, [pendingAction, performReopen, resetPOS]);
  const setTendered = useCallback(
    (amount: number) =>
      form.setValue("amountTendered", amount, {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [form],
  );

  return {
    state: state,
    activeShift: activeShift,
    cart,
    category,
    setCategory,
    search,
    setSearch,
    favoriteIds,
    selectedItem,
    setSelectedItem,
    tabletPane,
    setTabletPane,
    confirmOpen,
    setConfirmOpen,
    previewOpen,
    setPreviewOpen,
    voidOpen,
    setVoidOpen,
    receiptOrder,
    setReceiptOrder,
    loading,
    error,
    setError,
    pendingAction,
    setPendingAction,
    menuSearchRef,
    checkoutRef,
    register: form.register,
    errors: form.formState.errors,
    values,
    occupiedTables,
    recentIds: productHistory.recentIds,
    bestSellerIds: productHistory.bestSellerIds,
    orderNumber,
    ...totals,
    ...availability,
    taxEnabled: POS_TAX_ENABLED,
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    receiptPayment: state.payments.find(
      (entry) => entry.orderId === receiptOrder?.id,
    ),
    currentSelectedQuantity: cart
      .filter((entry) => entry.menuItemId === selectedItem?.id)
      .reduce((sum, entry) => sum + entry.quantity, 0),
    addItem,
    setLineQuantity,
    adjust,
    remove,
    note,
    reorder,
    toggleFavorite,
    guardedReset,
    handleHold,
    reopenHeld,
    openConfirmation,
    placeOrder,
    voidCurrent,
    confirmPendingAction,
    setTendered,
  };
}
