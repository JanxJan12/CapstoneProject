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
  getOrderSummaryAvailability,
  getPlaceOrderAvailability,
  getProductHistory,
  reorderCart,
  setCartLineQuantity,
  transitionTransactionState,
} from "./posOperations";
import {
  clearPOSDraft,
  createLineId,
  DEFAULT_POS_FORM,
  loadPOSDraft,
  loadPOSRecentSearches,
  savePOSDraft,
  savePOSRecentSearches,
} from "./posPersistence";
import type { POSCartLine, WalkInOrderType } from "./types";
import { POSTransactionState } from "./types";

type QuickActionId =
  "search" | "checkout" | "new" | "discount" | "hold" | "cancel";

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
  const [recentSearches, setRecentSearches] = useState<string[]>(
    loadPOSRecentSearches,
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem>();
  const [editingLineId, setEditingLineId] = useState<string>();
  const [transactionState, setTransactionState] = useState<POSTransactionState>(
    draft.cart.length ? POSTransactionState.ORDERING : POSTransactionState.IDLE,
  );
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const [receiptPrinted, setReceiptPrinted] = useState(false);
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
        totals.total,
        totals.tendered,
        inventoryIssue,
      ),
    [
      cart,
      inventoryIssue,
      state.menuItems,
      totals.tendered,
      totals.total,
      values,
    ],
  );
  const summaryAvailability = useMemo(
    () =>
      getOrderSummaryAvailability(
        cart,
        values,
        state.menuItems,
        inventoryIssue,
      ),
    [cart, inventoryIssue, state.menuItems, values],
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
        .filter(
          (entry) =>
            entry.menuItemId === selectedItem?.id &&
            entry.lineId !== editingLineId,
        )
        .reduce((sum, entry) => sum + entry.quantity, 0),
    [cart, editingLineId, selectedItem?.id],
  );
  const receiptPayment = useMemo(
    () => state.payments.find((entry) => entry.orderId === receiptOrder?.id),
    [receiptOrder?.id, state.payments],
  );
  const receiptTransaction = useMemo(
    () =>
      state.transactions.find(
        (entry) =>
          entry.id === receiptOrder?.transactionId ||
          entry.orderId === receiptOrder?.id,
      ),
    [receiptOrder?.id, receiptOrder?.transactionId, state.transactions],
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
        description: "Your order and payment details were recovered.",
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
  useEffect(() => savePOSRecentSearches(recentSearches), [recentSearches]);
  useEffect(() => {
    if (previousPaymentMethod.current === values.paymentMethod) return;
    previousPaymentMethod.current = values.paymentMethod;
    if (receiptOrder || transactionState !== POSTransactionState.PAYMENT)
      return;
    window.requestAnimationFrame(() =>
      form.setFocus(
        values.paymentMethod === "GCash" ? "gcashReference" : "amountTendered",
      ),
    );
  }, [form, receiptOrder, transactionState, values.paymentMethod]);

  useEffect(() => {
    if (receiptOrder) return;
    setTransactionState((current) => {
      if (!cart.length && current !== POSTransactionState.PAYMENT) {
        return POSTransactionState.IDLE;
      }
      if (cart.length && current === POSTransactionState.IDLE) {
        return POSTransactionState.ORDERING;
      }
      return current;
    });
  }, [cart.length, receiptOrder]);

  const addItem = useCallback(
    (
      menuItem: MenuItem,
      quantity = 1,
      itemNote = "",
      modifiers: OrderItemModifier[] = [],
    ) => {
      if (receiptOrder) {
        Toast.info("Start a new order before adding more items.");
        return;
      }
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
            description: "Running total updated. Continue entering the order.",
          });
        }
        if (result.warning) {
          Toast.warning(result.warning.title, {
            description: result.warning.description,
          });
        }
        return result.cart;
      });
    },
    [receiptOrder],
  );

  const openCustomize = useCallback(
    (item: MenuItem) => {
      if (receiptOrder) {
        Toast.info("Start a new order before customizing another item.");
        return;
      }
      setEditingLineId(undefined);
      setSelectedItem(item);
    },
    [receiptOrder],
  );
  const closeCustomize = useCallback(() => {
    const productId = selectedItem?.id;
    setEditingLineId(undefined);
    setSelectedItem(undefined);
    window.requestAnimationFrame(() => {
      const product = productId
        ? document.querySelector<HTMLButtonElement>(
            `#pos-product-${productId} button[aria-label^="Add"]`,
          )
        : undefined;
      product?.focus();
    });
  }, [selectedItem?.id]);
  const addCustomizedItem = useCallback(
    (
      item: MenuItem,
      quantity: number,
      itemNote: string,
      modifiers: OrderItemModifier[],
    ) => {
      if (editingLineId) {
        setCart((current) =>
          current.map((entry) =>
            entry.lineId === editingLineId
              ? {
                  ...entry,
                  menuItemId: item.id,
                  name: item.name,
                  unitPrice:
                    item.price +
                    modifiers.reduce(
                      (sum, modifier) => sum + modifier.price,
                      0,
                    ),
                  quantity,
                  note: itemNote.trim() || undefined,
                  modifiers: modifiers.length
                    ? modifiers.map((modifier) => ({ ...modifier }))
                    : undefined,
                }
              : entry,
          ),
        );
        Toast.success(`${item.name} updated`);
      } else {
        addItem(item, quantity, itemNote, modifiers);
      }
      setEditingLineId(undefined);
      setSelectedItem(undefined);
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(
            `#pos-product-${item.id} button[aria-label^="Add"]`,
          )
          ?.focus();
      });
    },
    [addItem, editingLineId],
  );

  const editLine = useCallback(
    (lineId: string) => {
      const line = cart.find((entry) => entry.lineId === lineId);
      const menuItem = state.menuItems.find(
        (entry) => entry.id === line?.menuItemId,
      );
      if (!line || !menuItem) return;
      setEditingLineId(lineId);
      setSelectedItem(menuItem);
    },
    [cart, state.menuItems],
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
  const undoLastAdd = useCallback(() => {
    setCart((current) => {
      const last = current.at(-1);
      if (!last) return current;
      Toast.info(`${last.name} addition undone`);
      if (last.quantity > 1) {
        return current.map((entry) =>
          entry.lineId === last.lineId
            ? { ...entry, quantity: entry.quantity - 1 }
            : entry,
        );
      }
      return current.slice(0, -1);
    });
  }, []);
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
    setEditingLineId(undefined);
    setSelectedItem(undefined);
    setTransactionState(POSTransactionState.IDLE);
    setNewOrderOpen(false);
    setOptionsOpen(false);
    setReceiptOrder(undefined);
    setReceiptPrinted(false);
    form.reset(DEFAULT_POS_FORM);
    setError("");
    clearPOSDraft();
  }, [form]);
  const clearCartDraft = useCallback(() => {
    const currentOrderType =
      form.getValues("orderType") === "Take-out" ? "Take-out" : "Dine-in";
    setCart([]);
    setEditingLineId(undefined);
    setSelectedItem(undefined);
    setTransactionState(POSTransactionState.IDLE);
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
        description: "The order can be reopened from the workstation header.",
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
      setTransactionState(POSTransactionState.ORDERING);
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
      setTransactionState((current) =>
        transitionTransactionState(current, "showReceipt", false),
      );
      Toast.success(`${order.id} created`, {
        description:
          "Payment, transaction, and kitchen records were created together.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to place the order.";
      setError(message);
      setTransactionState(POSTransactionState.PAYMENT);
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
    setTransactionState((current) =>
      transitionTransactionState(current, "openReview", true),
    );
    setOptionsOpen(true);
    window.requestAnimationFrame(() => form.setFocus("discountType"));
  }, [cart.length, form]);
  const showSearch = useCallback(() => {
    window.requestAnimationFrame(() => menuSearchRef.current?.focus());
  }, []);
  const hideSearch = useCallback(() => {
    setSearch("");
  }, []);
  const openOrderReview = useCallback(() => {
    if (!cart.length) {
      Toast.error("Add an item before reviewing the order.");
      return;
    }
    setSelectedItem(undefined);
    setTransactionState((current) =>
      transitionTransactionState(current, "openReview", true),
    );
    setError("");
  }, [cart.length]);
  const backToOrdering = useCallback(() => {
    if (loading) return;
    setTransactionState((current) =>
      transitionTransactionState(current, "backToOrdering", cart.length > 0),
    );
    setError("");
  }, [cart.length, loading]);
  const continueToPayment = useCallback(() => {
    if (!summaryAvailability.canContinue) {
      setError(
        summaryAvailability.disabledReason ??
          "Complete the order information before payment.",
      );
      if (values.discountType !== "None" && !values.discountReference?.trim()) {
        window.requestAnimationFrame(() => form.setFocus("discountReference"));
      }
      return;
    }
    setError("");
    setTransactionState((current) =>
      transitionTransactionState(current, "proceedToPayment", true),
    );
    window.requestAnimationFrame(() =>
      form.setFocus(
        values.paymentMethod === "GCash" ? "gcashReference" : "amountTendered",
      ),
    );
  }, [form, summaryAvailability, values]);
  const backToReview = useCallback(() => {
    if (loading) return;
    setError("");
    setTransactionState((current) =>
      transitionTransactionState(current, "backToReview", cart.length > 0),
    );
  }, [cart.length, loading]);
  const beginPayment = useCallback(() => {
    if (!cart.length) {
      Toast.error("Add an item before taking payment.");
      return;
    }
    if (!summaryAvailability.canContinue) {
      openOrderReview();
      setError(
        summaryAvailability.disabledReason ??
          "Complete the order information before payment.",
      );
      return;
    }
    continueToPayment();
  }, [
    cart.length,
    continueToPayment,
    openOrderReview,
    summaryAvailability.canContinue,
    summaryAvailability.disabledReason,
  ]);
  const closeReceipt = useCallback(() => {
    resetPOS();
  }, [resetPOS]);
  const printReceipt = useCallback(() => {
    window.print();
    setReceiptPrinted(true);
    Toast.success(
      receiptPrinted ? "Receipt sent to reprint." : "Receipt sent to print.",
    );
  }, [receiptPrinted]);
  const runQuickAction = useCallback(
    (action: QuickActionId) => {
      if (action === "search") showSearch();
      else if (action === "checkout") beginPayment();
      else if (action === "discount") openDiscount();
      else if (action === "hold") void handleHold();
      else if (action === "cancel") requestCancel();
      else guardedReset();
    },
    [
      beginPayment,
      guardedReset,
      handleHold,
      openDiscount,
      requestCancel,
      showSearch,
    ],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        document.querySelector(
          '[role="dialog"]:not([data-pos-workspace-drawer])',
        )
      )
        return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        if (selectedItem) {
          event.preventDefault();
          closeCustomize();
        } else if (search) {
          event.preventDefault();
          hideSearch();
        } else if (transactionState === POSTransactionState.PAYMENT) {
          event.preventDefault();
          backToReview();
        } else if (transactionState === POSTransactionState.ORDER_REVIEW) {
          event.preventDefault();
          backToOrdering();
        } else if (
          transactionState === POSTransactionState.ORDERING &&
          isDirty
        ) {
          event.preventDefault();
          requestCancel();
        }
      } else if (
        selectedItem ||
        transactionState === POSTransactionState.RECEIPT
      ) {
        return;
      } else if (event.key === "F2" || (event.key === "/" && !modifier)) {
        event.preventDefault();
        showSearch();
      } else if (modifier && event.key === "Enter") {
        event.preventDefault();
        if (transactionState === POSTransactionState.PAYMENT) {
          confirmOrderRef.current?.click();
        } else if (transactionState === POSTransactionState.ORDER_REVIEW) {
          continueToPayment();
        } else {
          beginPayment();
        }
      } else if (event.key === "F3") {
        event.preventDefault();
        if (transactionState === POSTransactionState.PAYMENT) {
          confirmOrderRef.current?.click();
        } else if (transactionState === POSTransactionState.ORDER_REVIEW) {
          continueToPayment();
        } else {
          beginPayment();
        }
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
    backToOrdering,
    backToReview,
    beginPayment,
    closeCustomize,
    continueToPayment,
    guardedReset,
    handleHold,
    hideSearch,
    isDirty,
    openDiscount,
    requestCancel,
    search,
    selectedItem,
    showSearch,
    transactionState,
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
    hideSearch,
    selectedItem,
    editingLine: cart.find((entry) => entry.lineId === editingLineId),
    transactionState,
    openCustomize,
    closeCustomize,
    addCustomizedItem,
    editLine,
    selectOrderType,
    newOrderOpen,
    setNewOrderOpen,
    openOrderReview,
    backToOrdering,
    beginPayment,
    continueToPayment,
    backToReview,
    receiptOrder,
    closeReceipt,
    receiptPrinted,
    printReceipt,
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
    recentIds: productHistory.recentIds,
    bestSellerIds: productHistory.bestSellerIds,
    orderNumber,
    ...totals,
    ...availability,
    canContinueToPayment: summaryAvailability.canContinue,
    summaryDisabledReason: summaryAvailability.disabledReason,
    mealRecommendations,
    taxEnabled: POS_TAX_ENABLED,
    itemCount,
    receiptPayment,
    receiptTransaction,
    currentSelectedQuantity,
    addItem,
    setLineQuantity,
    adjust,
    undoLastAdd,
    requestRemove,
    duplicate,
    note,
    reorder,
    reopenHeld,
    submitOrder,
    requestCancel,
    confirmPendingAction,
    resetPOS,
    handleHold,
    setTendered,
    runQuickAction,
  };
}
