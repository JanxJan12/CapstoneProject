import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Toast } from "../components";
import {
  POS_PRINT_PREVIEW_DELAY_MS,
  POS_RECENT_SEARCH_LIMIT,
  POS_TAX_ENABLED,
} from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { posSchema, type POSForm } from "../schemas";
import { defaultModifiersFor } from "../constants/modifiers";
import type { MenuItem, Order, OrderItemModifier } from "../types";
import {
  addCartItem,
  calculatePOSTotals,
  duplicateCartLine,
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
  loadPOSRecentSearches,
  savePOSDraft,
  savePOSFavorites,
  savePOSRecentSearches,
} from "./posPersistence";
import type { POSCartLine } from "./types";
import type { QuickActionId } from "./POSQuickActions";

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
  const [recentSearches, setRecentSearches] = useState<string[]>(
    loadPOSRecentSearches,
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem>();
  const [tabletPane, setTabletPane] = useState<"menu" | "order">("menu");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingPOSAction>();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const menuSearchRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<HTMLButtonElement>(null);
  const previousPaymentMethod = useRef<POSForm["paymentMethod"]>(
    draft.form.paymentMethod,
  );
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
  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );
  const currentSelectedQuantity = useMemo(
    () =>
      cart
        .filter((entry) => entry.menuItemId === selectedItem?.id)
        .reduce((sum, entry) => sum + entry.quantity, 0),
    [cart, selectedItem?.id],
  );
  const receiptPayment = useMemo(
    () => state.payments.find((entry) => entry.orderId === receiptOrder?.id),
    [receiptOrder?.id, state.payments],
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
  useEffect(() => savePOSRecentSearches(recentSearches), [recentSearches]);
  useEffect(() => {
    if (previousPaymentMethod.current === values.paymentMethod) return;
    previousPaymentMethod.current = values.paymentMethod;
    if (receiptOrder) return;
    window.requestAnimationFrame(() =>
      form.setFocus(
        values.paymentMethod === "GCash" ? "gcashReference" : "amountTendered",
      ),
    );
  }, [form, receiptOrder, values.paymentMethod]);

  const addItem = useCallback(
    (
      menuItem: MenuItem,
      quantity = 1,
      itemNote = "",
      modifiers: OrderItemModifier[] = [],
    ) => {
      setCart((current) => {
        const normalizedModifiers = modifiers.length
          ? modifiers
          : defaultModifiersFor(menuItem);
        const result = addCartItem(
          current,
          menuItem,
          quantity,
          itemNote,
          normalizedModifiers,
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
    setCart((current) => {
      const index = current.findIndex((entry) => entry.lineId === lineId);
      const removed = current[index];
      if (!removed) return current;
      Toast.info(`${removed.name} removed`, {
        description: "The item can be restored without losing modifiers.",
        action: {
          label: "Undo",
          onClick: () =>
            setCart((latest) => {
              if (latest.some((entry) => entry.lineId === removed.lineId))
                return latest;
              const restored = [...latest];
              restored.splice(Math.min(index, restored.length), 0, removed);
              return restored;
            }),
        },
      });
      return current.filter((entry) => entry.lineId !== lineId);
    });
  }, []);
  const duplicate = useCallback(
    (lineId: string) => {
      setCart((current) => {
        const result = duplicateCartLine(current, lineId, state.menuItems);
        if (result.error) Toast.error(result.error);
        if (result.warning) {
          Toast.warning(result.warning.title, {
            description: result.warning.description,
          });
        }
        return result.cart;
      });
    },
    [state.menuItems],
  );
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
  const commitSearch = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    setRecentSearches((current) =>
      [
        normalized,
        ...current.filter(
          (entry) => entry.toLowerCase() !== normalized.toLowerCase(),
        ),
      ].slice(0, POS_RECENT_SEARCH_LIMIT),
    );
  }, []);

  const resetPOS = useCallback(() => {
    setCart([]);
    setCategory("All");
    setSearch("");
    setOptionsOpen(false);
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
  const submitOrder = form.handleSubmit(() => {
    setError("");
    if (!activeShift) {
      setError("Start a cashier shift before placing an order.");
      return;
    }
    if (!availability.canPlace) {
      setError(
        availability.disabledReason ?? "Review the order before continuing.",
      );
      return;
    }
    void placeOrder();
  });

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
  const previewReceipt = useCallback(() => {
    if (!cart.length) {
      Toast.error("Add an item before previewing the receipt.");
      return;
    }
    setTabletPane("order");
    setPreviewOpen(true);
  }, [cart.length]);
  const openDiscount = useCallback(() => {
    setTabletPane("order");
    setOptionsOpen(true);
    window.requestAnimationFrame(() => form.setFocus("discountType"));
  }, [form]);
  const focusSearch = useCallback(() => {
    setTabletPane("menu");
    window.requestAnimationFrame(() => menuSearchRef.current?.focus());
  }, []);
  const beginCheckout = useCallback(() => {
    setTabletPane("order");
    window.requestAnimationFrame(() => checkoutRef.current?.click());
  }, []);
  const printReceipt = useCallback(() => {
    if (!cart.length) {
      Toast.error("Add an item before printing the receipt preview.");
      return;
    }
    setTabletPane("order");
    setPreviewOpen(true);
    window.setTimeout(() => window.print(), POS_PRINT_PREVIEW_DELAY_MS);
  }, [cart.length]);
  const runQuickAction = useCallback(
    (action: QuickActionId) => {
      if (action === "search") focusSearch();
      else if (action === "checkout") beginCheckout();
      else if (action === "discount") openDiscount();
      else if (action === "print") printReceipt();
      else if (action === "hold") void handleHold();
      else guardedReset();
    },
    [
      beginCheckout,
      focusSearch,
      guardedReset,
      handleHold,
      openDiscount,
      printReceipt,
    ],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === "F2" || (event.key === "/" && !modifier)) {
        event.preventDefault();
        focusSearch();
      } else if (event.key === "F3" || (modifier && event.key === "Enter")) {
        event.preventDefault();
        beginCheckout();
      } else if (modifier && key === "n") {
        event.preventDefault();
        guardedReset();
      } else if (modifier && key === "d") {
        event.preventDefault();
        openDiscount();
      } else if (modifier && key === "p") {
        event.preventDefault();
        printReceipt();
      } else if (modifier && key === "h") {
        event.preventDefault();
        void handleHold();
      } else if (
        event.key === "Escape" &&
        !document.querySelector('[role="dialog"]')
      ) {
        if (!isDirty) return;
        event.preventDefault();
        guardedReset();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    beginCheckout,
    focusSearch,
    guardedReset,
    handleHold,
    isDirty,
    openDiscount,
    printReceipt,
  ]);

  return {
    state,
    activeShift,
    cart,
    category,
    setCategory,
    search,
    setSearch,
    recentSearches,
    commitSearch,
    favoriteIds,
    selectedItem,
    setSelectedItem,
    tabletPane,
    setTabletPane,
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
    optionsOpen,
    setOptionsOpen,
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
    itemCount,
    receiptPayment,
    currentSelectedQuantity,
    addItem,
    setLineQuantity,
    adjust,
    remove,
    duplicate,
    note,
    reorder,
    toggleFavorite,
    reopenHeld,
    submitOrder,
    voidCurrent,
    confirmPendingAction,
    setTendered,
    previewReceipt,
    focusSearch,
    runQuickAction,
  };
}
