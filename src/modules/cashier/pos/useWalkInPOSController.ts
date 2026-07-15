import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Toast } from "../components";
import { POS_RECENT_SEARCH_LIMIT, POS_TAX_ENABLED } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { posSchema, type POSForm } from "../schemas";
import { defaultModifiersFor } from "../constants/modifiers";
import type { MenuItem, Order, OrderItemModifier } from "../types";
import {
  addCartItem,
  calculatePOSTotals,
  duplicateCartLine,
  getInventoryIssue,
  getMealRecommendations,
  getNextOrderNumber,
  getOccupiedTables,
  getPlaceOrderAvailability,
  getProductHistory,
  getPOSWorkflowState,
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
import type { POSCartLine, POSWorkflowState, WalkInOrderType } from "./types";
import type { QuickActionId } from "./POSQuickActions";

export type PendingPOSAction =
  | { type: "clear" }
  | { type: "cancel" }
  | { type: "remove"; lineId: string }
  | { type: "reopen"; heldId: string };

export function useWalkInPOSController(
  onDirtyChange: (dirty: boolean) => void,
) {
  const { state, activeShift, createWalkInOrder, holdOrder, removeHeldOrder } =
    useCashierStore();
  const draft = useMemo(loadPOSDraft, []);
  const [cart, setCart] = useState<POSCartLine[]>(draft.cart);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadPOSFavorites);
  const [recentSearches, setRecentSearches] = useState<string[]>(
    loadPOSRecentSearches,
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem>();
  const [workflowState, setWorkflowState] = useState<POSWorkflowState>(
    getPOSWorkflowState("addItem", draft.cart.length > 0),
  );
  const [tabletPane, setTabletPane] = useState<"menu" | "order">("menu");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingPOSAction>();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const menuSearchRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<HTMLButtonElement>(null);
  const confirmOrderRef = useRef<HTMLButtonElement>(null);
  const previousPaymentMethod = useRef<POSForm["paymentMethod"]>(
    draft.form.paymentMethod,
  );
  const form = useForm<POSForm>({
    resolver: zodResolver(posSchema),
    defaultValues: draft.form,
    mode: "onTouched",
  });
  const values = form.watch();
  const walkInOrderType: WalkInOrderType =
    values.orderType === "Take-out" ? "Take-out" : "Dine-in";

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
  const mealRecommendations = useMemo(
    () => getMealRecommendations(cart, state.menuItems),
    [cart, state.menuItems],
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
    if (receiptOrder || !["checkout", "processing"].includes(workflowState))
      return;
    window.requestAnimationFrame(() =>
      form.setFocus(
        values.paymentMethod === "GCash" ? "gcashReference" : "amountTendered",
      ),
    );
  }, [form, receiptOrder, values.paymentMethod, workflowState]);

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
        else {
          Toast.success(`${menuItem.name} added`, {
            description: "Cart totals updated. Continue building the order.",
          });
        }
        if (result.warning) {
          Toast.warning(result.warning.title, {
            description: result.warning.description,
          });
        }
        return result.cart;
      });
      setWorkflowState(getPOSWorkflowState("addItem", true));
    },
    [],
  );

  const openCustomize = useCallback(
    (item: MenuItem) => {
      setSelectedItem(item);
      setWorkflowState(getPOSWorkflowState("customize", cart.length > 0));
      setTabletPane("order");
    },
    [cart.length],
  );
  const closeCustomize = useCallback(() => {
    const productId = selectedItem?.id;
    setSelectedItem(undefined);
    setWorkflowState(
      getPOSWorkflowState("closeCustomization", cart.length > 0),
    );
    setTabletPane("menu");
    window.requestAnimationFrame(() => {
      const product = productId
        ? document.querySelector<HTMLButtonElement>(
            `#pos-product-${productId} button[aria-label^="Add"]`,
          )
        : undefined;
      product?.focus();
    });
  }, [cart.length, selectedItem?.id]);
  const addCustomizedItem = useCallback(
    (
      item: MenuItem,
      quantity: number,
      itemNote: string,
      modifiers: OrderItemModifier[],
    ) => {
      addItem(item, quantity, itemNote, modifiers);
      setSelectedItem(undefined);
      setWorkflowState(getPOSWorkflowState("addItem", true));
      setTabletPane("menu");
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(
            `#pos-product-${item.id} button[aria-label^="Add"]`,
          )
          ?.focus();
      });
    },
    [addItem],
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
  const removeLine = useCallback((lineId: string) => {
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
  const requestRemove = useCallback(
    (lineId: string) => {
      if (cart.length === 1) {
        setPendingAction({ type: "remove", lineId });
        return;
      }
      removeLine(lineId);
    },
    [cart.length, removeLine],
  );
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

  const selectOrderType = useCallback(
    (orderType: WalkInOrderType) => {
      form.setValue("orderType", orderType, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (orderType !== "Dine-in") {
        form.setValue("tableNumber", "");
      }
      form.setValue("contactNumber", "");
      form.setValue("deliveryAddress", "");
      setError("");
    },
    [form],
  );

  const resetPOS = useCallback(() => {
    setCart([]);
    setCategory("All");
    setSearch("");
    setSelectedItem(undefined);
    setWorkflowState(getPOSWorkflowState("reset", false));
    setTabletPane("menu");
    setNewOrderOpen(false);
    setOptionsOpen(false);
    form.reset(DEFAULT_POS_FORM);
    setError("");
    clearPOSDraft();
  }, [form]);
  const clearCartDraft = useCallback(() => {
    const currentOrderType =
      form.getValues("orderType") === "Take-out" ? "Take-out" : "Dine-in";
    setCart([]);
    setSelectedItem(undefined);
    setWorkflowState(getPOSWorkflowState("reset", false));
    setTabletPane("menu");
    setOptionsOpen(false);
    form.reset({ ...DEFAULT_POS_FORM, orderType: currentOrderType });
    setError("");
    clearPOSDraft();
  }, [form]);
  const guardedReset = useCallback(() => {
    if (isDirty) setNewOrderOpen(true);
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
        contactNumber: values.contactNumber,
        deliveryAddress: values.deliveryAddress,
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
      form.setValue("contactNumber", "");
      form.setValue("deliveryAddress", "");
      form.setValue(
        "orderType",
        held.type === "Dine-in" ? "Dine-in" : "Take-out",
      );
      form.setValue(
        "tableNumber",
        held.type === "Dine-in" ? (held.tableNumber ?? "") : "",
      );
      form.setValue("discountType", held.discountType ?? "None");
      form.setValue("discountReference", held.discountReference ?? "");
      form.setValue("orderInstructions", held.orderInstructions ?? "");
      setWorkflowState(getPOSWorkflowState("addItem", true));
      setTabletPane("menu");
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
    setWorkflowState(getPOSWorkflowState("process", true));
    setError("");
    try {
      const order = await createWalkInOrder({
        customerName: values.customerName,
        contactNumber: values.contactNumber,
        deliveryAddress: values.deliveryAddress,
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
      resetPOS();
      setReceiptOrder(order);
      setWorkflowState(getPOSWorkflowState("showReceipt", false));
      Toast.success(`${order.id} created`, {
        description:
          "Payment, transaction, and kitchen records were created together.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to place the order.";
      setError(message);
      setWorkflowState(getPOSWorkflowState("checkout", true));
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

  const confirmPendingAction = useCallback(() => {
    if (pendingAction?.type === "reopen") performReopen(pendingAction.heldId);
    else if (pendingAction?.type === "remove") {
      removeLine(pendingAction.lineId);
      setWorkflowState(getPOSWorkflowState("reset", false));
    } else if (pendingAction?.type === "clear") clearCartDraft();
    else if (pendingAction?.type === "cancel") resetPOS();
    setPendingAction(undefined);
  }, [clearCartDraft, pendingAction, performReopen, removeLine, resetPOS]);
  const requestCancel = useCallback(() => {
    if (cart.length) setPendingAction({ type: "cancel" });
  }, [cart.length]);
  const setTendered = useCallback(
    (amount: number) =>
      form.setValue("amountTendered", amount, {
        shouldDirty: true,
        shouldValidate: true,
      }),
    [form],
  );
  const openDiscount = useCallback(() => {
    if (!cart.length) {
      Toast.error("Add an item before applying a discount.");
      return;
    }
    setTabletPane("order");
    setWorkflowState(getPOSWorkflowState("checkout", true));
    setOptionsOpen(true);
    window.requestAnimationFrame(() => form.setFocus("discountType"));
  }, [cart.length, form]);
  const focusSearch = useCallback(() => {
    setTabletPane("menu");
    window.requestAnimationFrame(() => menuSearchRef.current?.focus());
  }, []);
  const openCheckout = useCallback(() => {
    if (!cart.length) {
      Toast.error("Add an item before proceeding to checkout.");
      return;
    }
    setTabletPane("order");
    setSelectedItem(undefined);
    setWorkflowState(getPOSWorkflowState("checkout", true));
    setError("");
  }, [cart.length]);
  const backToCart = useCallback(() => {
    if (loading) return;
    setWorkflowState(getPOSWorkflowState("backToCart", cart.length > 0));
    setError("");
  }, [cart.length, loading]);
  const beginCheckout = useCallback(() => openCheckout(), [openCheckout]);
  const closeReceipt = useCallback(() => {
    setReceiptOrder(undefined);
    setWorkflowState(getPOSWorkflowState("reset", false));
    focusSearch();
  }, [focusSearch]);
  const runQuickAction = useCallback(
    (action: QuickActionId) => {
      if (action === "search") focusSearch();
      else if (action === "checkout") beginCheckout();
      else if (action === "discount") openDiscount();
      else if (action === "hold") void handleHold();
      else if (action === "cancel") requestCancel();
      else guardedReset();
    },
    [
      beginCheckout,
      focusSearch,
      guardedReset,
      handleHold,
      openDiscount,
      requestCancel,
    ],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        if (workflowState === "customizingItem") {
          event.preventDefault();
          closeCustomize();
        } else if (["checkout", "processing"].includes(workflowState)) {
          event.preventDefault();
          backToCart();
        } else if (isDirty) {
          event.preventDefault();
          requestCancel();
        }
      } else if (workflowState === "customizingItem") {
        return;
      } else if (event.key === "F2" || (event.key === "/" && !modifier)) {
        event.preventDefault();
        focusSearch();
      } else if (modifier && event.key === "Enter") {
        event.preventDefault();
        if (workflowState === "checkout") confirmOrderRef.current?.click();
        else beginCheckout();
      } else if (event.key === "F3") {
        event.preventDefault();
        beginCheckout();
      } else if (modifier && key === "n") {
        event.preventDefault();
        guardedReset();
      } else if (modifier && key === "d") {
        event.preventDefault();
        openDiscount();
      } else if (modifier && key === "h") {
        event.preventDefault();
        void handleHold();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    backToCart,
    beginCheckout,
    closeCustomize,
    focusSearch,
    guardedReset,
    handleHold,
    isDirty,
    openDiscount,
    requestCancel,
    workflowState,
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
    workflowState,
    openCustomize,
    closeCustomize,
    addCustomizedItem,
    selectOrderType,
    tabletPane,
    setTabletPane,
    newOrderOpen,
    setNewOrderOpen,
    openCheckout,
    backToCart,
    receiptOrder,
    closeReceipt,
    loading,
    error,
    setError,
    pendingAction,
    setPendingAction,
    menuSearchRef,
    checkoutRef,
    confirmOrderRef,
    optionsOpen,
    setOptionsOpen,
    register: form.register,
    errors: form.formState.errors,
    values,
    walkInOrderType,
    occupiedTables,
    recentIds: productHistory.recentIds,
    bestSellerIds: productHistory.bestSellerIds,
    orderNumber,
    ...totals,
    ...availability,
    mealRecommendations,
    taxEnabled: POS_TAX_ENABLED,
    itemCount,
    receiptPayment,
    currentSelectedQuantity,
    addItem,
    setLineQuantity,
    adjust,
    requestRemove,
    duplicate,
    note,
    reorder,
    toggleFavorite,
    reopenHeld,
    submitOrder,
    requestCancel,
    confirmPendingAction,
    resetPOS,
    handleHold,
    setTendered,
    focusSearch,
    runQuickAction,
  };
}
