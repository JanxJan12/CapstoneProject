import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Toast } from "../components";
import { POS_RECENT_SEARCH_LIMIT, POS_TAX_ENABLED } from "../constants";
import { useCashierStore } from "../hooks/CashierStore";
import { posSchema, type POSForm } from "../schemas";
import { drinkChoiceGroupsFor } from "../constants/drinkChoices";
import type { MenuItem, Order, OrderItemModifier } from "../types";
import {
  addCartItem,
  calculatePOSTotals,
  duplicateCartLine,
  filterMenuItems,
  getBestSellerIds,
  getMealRecommendations,
  getNextOrderNumber,
  getOrderSummaryAvailability,
  getPlaceOrderAvailability,
  reorderCart,
  setCartLineQuantity,
  transitionTransactionState,
} from "./posOperations";
import {
  clearPOSDraft,
  clearPendingPOSRequest,
  createLineId,
  DEFAULT_POS_FORM,
  loadPOSDraft,
  loadPendingPOSRequest,
  loadPOSRecentSearches,
  savePOSDraft,
  savePendingPOSRequest,
  savePOSRecentSearches,
} from "./posPersistence";
import type { POSCartLine, WalkInOrderType } from "./types";
import { POSTransactionState } from "./types";

type QuickActionId =
  "search" | "checkout" | "new" | "hold" | "cancel";

export type PendingPOSAction =
  | { type: "clear" }
  | { type: "cancel" }
  | { type: "remove"; lineId: string }
  | { type: "reopen"; heldId: string };

export function useWalkInPOSController(
  onDirtyChange: (dirty: boolean) => void,
) {
  const {
    state,
    activeShift,
    createWalkInOrder,
    recoverWalkInOrder,
    holdOrder,
    removeHeldOrder,
    menuAvailabilityRefreshing,
    refreshMenuAvailability,
  } = useCashierStore();
  const draft = useMemo(loadPOSDraft, []);
  const [cart, setCart] = useState<POSCartLine[]>(draft.cart);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(
    loadPOSRecentSearches,
  );
  const [selectedItem, setSelectedItem] = useState<MenuItem>();
  const [editingLineId, setEditingLineId] = useState<string>();
  const [transactionState, setTransactionState] = useState<POSTransactionState>(
    draft.cart.length ? POSTransactionState.ORDERING : POSTransactionState.IDLE,
  );
  const [orderTypeSelected, setOrderTypeSelected] = useState(
    draft.cart.length > 0,
  );
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order>();
  const [receiptPrinted, setReceiptPrinted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const savedRequestId = useMemo(() => loadPendingPOSRequest(state.cashier.id), [state.cashier.id]);
  const [recoveryStatus, setRecoveryStatus] = useState<"checking" | "unknown" | "unavailable" | "review" | null>(
    savedRequestId ? "checking" : null,
  );
  const recoveryStatusRef = useRef(recoveryStatus);
  const checkoutRequestIdRef = useRef<string | undefined>(savedRequestId ?? undefined);
  const saleInFlightRef = useRef(false);
  const submittedInThisMountRef = useRef(false);
  const lookupInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const [pendingAction, setPendingAction] = useState<PendingPOSAction>();
  const menuSearchRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<HTMLButtonElement>(null);
  const confirmOrderRef = useRef<HTMLButtonElement>(null);
  const form = useForm<POSForm>({
    resolver: zodResolver(posSchema),
    defaultValues: draft.form,
    mode: "onTouched",
  });
  const values = form.watch();
  const walkInOrderType: WalkInOrderType =
    values.orderType === "Take-out" ? "Take-out" : "Dine-in";

  const bestSellerIds = useMemo(
    () => getBestSellerIds(state.orders),
    [state.orders],
  );
  const bestSellerSet = useMemo(() => new Set(bestSellerIds), [bestSellerIds]);
  const searchResults = useMemo(
    () => filterMenuItems(state.menuItems, category, search, bestSellerSet),
    [bestSellerSet, category, search, state.menuItems],
  );
  const activeSearchItem = searchResults[activeSearchIndex];
  const orderNumber = useMemo(
    () => getNextOrderNumber(state.orders),
    [state.orders],
  );
  const totals = useMemo(
    () => calculatePOSTotals(cart, values),
    [cart, values],
  );
  const availability = useMemo(
    () =>
      getPlaceOrderAvailability(
        cart,
        values,
        state.menuItems,
        totals.total,
        totals.tendered,
      ),
    [
      cart,
      state.menuItems,
      totals.tendered,
      totals.total,
      values,
    ],
  );
  const summaryAvailability = useMemo(
    () => getOrderSummaryAvailability(cart, values, state.menuItems),
    [cart, state.menuItems, values],
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
    if (receiptOrder) return;
    setTransactionState((current) => {
      if (
        !orderTypeSelected &&
        !cart.length &&
        current !== POSTransactionState.PAYMENT
      ) {
        return POSTransactionState.IDLE;
      }
      if (orderTypeSelected && current === POSTransactionState.IDLE) {
        return POSTransactionState.ORDERING;
      }
      return current;
    });
  }, [cart.length, orderTypeSelected, receiptOrder]);

  useEffect(() => setActiveSearchIndex(-1), [category, search]);

  const refreshCartAvailability = useCallback(async () => {
    try {
      const menuItems = await refreshMenuAvailability();
      const unavailableNames = [
        ...new Set(
          cart
            .filter(
              (line) =>
                !menuItems.find((item) => item.id === line.menuItemId)
                  ?.available,
            )
            .map((line) => line.name),
        ),
      ];

      if (unavailableNames.length > 0) {
        const message = `${unavailableNames.join(", ")} ${
          unavailableNames.length === 1 ? "is" : "are"
        } no longer available. Remove the affected item${
          unavailableNames.length === 1 ? "" : "s"
        } to continue.`;

        setError(message);
        Toast.warning("Menu availability changed", {
          description: message,
        });
        return false;
      }

      const changedMeal = cart.find((line) => {
        if (!line.mealOption) return false;
        const item = menuItems.find((entry) => entry.id === line.menuItemId);
        return !item || item.withoutRicePrice === undefined ||
          (line.mealOption === "with_rice" ? item.withRiceAvailable === false : item.withoutRiceAvailable === false) ||
          line.unitPrice !== (line.mealOption === "without_rice" ? item.withoutRicePrice : item.price);
      });
      if (changedMeal) {
        const message = `Meal options or prices for ${changedMeal.name} changed. Edit that order item before payment.`;
        setError(message);
        Toast.warning("Meal options changed", { description: message });
        return false;
      }

      return true;
    } catch {
      const message =
        "Unable to confirm current menu availability. Check the connection and try again.";
      setError(message);
      Toast.error("Availability check failed", {
        description: message,
      });
      return false;
    }
  }, [cart, refreshMenuAvailability]);

  const addItem = useCallback(
    (
      menuItem: MenuItem,
      quantity = 1,
      itemNote = "",
      modifiers: OrderItemModifier[] = [],
      mealOption?: "with_rice" | "without_rice",
    ) => {
      if (!orderTypeSelected) {
        Toast.info("Select Dine-in or Take-out before adding menu items.");
        return;
      }
      if (receiptOrder) {
        Toast.info("Start a new order before adding more items.");
        return;
      }
      setCart((current) => {
        if (drinkChoiceGroupsFor(menuItem).length > 0 && modifiers.length === 0) {
          Toast.warning("Choose the required drink options first.");
          return current;
        }
        const normalizedModifiers = modifiers;
        const result = addCartItem(
          current,
          menuItem,
          quantity,
          itemNote,
          normalizedModifiers,
          menuItem.withoutRicePrice !== undefined ? mealOption ?? "with_rice" : undefined,
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
    [orderTypeSelected, receiptOrder],
  );

  const openCustomize = useCallback(
    (item: MenuItem) => {
      if (!orderTypeSelected) {
        Toast.info("Select an order type before opening the menu.");
        return;
      }
      if (receiptOrder) {
        Toast.info("Start a new order before customizing another item.");
        return;
      }
      setEditingLineId(undefined);
      setSelectedItem(item);
    },
    [orderTypeSelected, receiptOrder],
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
      mealOption?: "with_rice" | "without_rice",
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
                    (mealOption === "without_rice" ? item.withoutRicePrice ?? item.price : item.price) +
                    modifiers.reduce(
                      (sum, modifier) => sum + modifier.price,
                      0,
                    ),
                  quantity,
                  note: itemNote.trim() || undefined,
                  modifiers: modifiers.length
                    ? modifiers.map((modifier) => ({ ...modifier }))
                    : undefined,
                  mealOption: item.withoutRicePrice !== undefined ? mealOption ?? "with_rice" : undefined,
                }
              : entry,
          ),
        );
        Toast.success(`${item.name} updated`);
      } else {
        addItem(item, quantity, itemNote, modifiers, mealOption);
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
      setCart((current) => setCartLineQuantity(current, lineId, quantity));
    },
    [],
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
        );
      });
    },
    [],
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
  const updateSearch = useCallback((value: string) => {
    if (value.trim()) setCategory("All");
    setSearch(value);
  }, []);
  const selectCategory = useCallback((value: string) => {
    setSearch("");
    setCategory(value);
  }, []);
  const moveSearchResult = useCallback(
    (direction: 1 | -1) => {
      if (!searchResults.length) return;
      setActiveSearchIndex((current) => {
        if (current < 0) {
          return direction > 0 ? 0 : searchResults.length - 1;
        }
        return (
          (current + direction + searchResults.length) % searchResults.length
        );
      });
    },
    [searchResults.length],
  );
  const quickAddSearchResult = useCallback(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const target =
      searchResults.find(
        (item) => item.code.toLocaleLowerCase() === normalizedSearch,
      ) ??
      activeSearchItem ??
      searchResults[0];

    if (target?.available) {
      if (target.withoutRicePrice !== undefined) openCustomize(target);
      else addItem(target);
    }
  }, [activeSearchItem, addItem, openCustomize, search, searchResults]);
  const resetSearchSelection = useCallback(() => setActiveSearchIndex(-1), []);
  const selectOrderType = useCallback(
    (orderType: WalkInOrderType) => {
      form.setValue("orderType", orderType, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("contactNumber", "");
      form.setValue("deliveryAddress", "");
      setOrderTypeSelected(true);
      setTransactionState(POSTransactionState.ORDERING);
      setError("");
    },
    [form],
  );
const resetPOS = useCallback(() => {
  if (recoveryStatusRef.current || saleInFlightRef.current) return;
  checkoutRequestIdRef.current = undefined;
  submittedInThisMountRef.current = false;

  setCart([]);
    setCategory("All");
    setSearch("");
    setEditingLineId(undefined);
    setSelectedItem(undefined);
    setTransactionState(POSTransactionState.IDLE);
    setOrderTypeSelected(false);
    setNewOrderOpen(false);
    setReceiptOrder(undefined);
    setReceiptPrinted(false);
    form.reset(DEFAULT_POS_FORM);
    setError("");
    clearPOSDraft();
  }, [form]);
const clearCartDraft = useCallback(() => {
  if (recoveryStatusRef.current || saleInFlightRef.current) return;
  checkoutRequestIdRef.current = undefined;
  submittedInThisMountRef.current = false;

  const currentOrderType =
    form.getValues("orderType") === "Take-out" ? "Take-out" : "Dine-in";
    setCart([]);
    setEditingLineId(undefined);
    setSelectedItem(undefined);
    setTransactionState(POSTransactionState.ORDERING);
    form.reset({ ...DEFAULT_POS_FORM, orderType: currentOrderType });
    setError("");
    clearPOSDraft();
  }, [form]);

  const finishConfirmedSale = useCallback((order: Order, requestId: string) => {
    saleInFlightRef.current = false;
    recoveryStatusRef.current = null;
    setRecoveryStatus(null);
    resetPOS();
    clearPendingPOSRequest(state.cashier.id, requestId);
    setReceiptOrder(order);
    setTransactionState(POSTransactionState.RECEIPT);
    Toast.success(`${order.id} created`, {
      description: "The order, payment, and receipt were confirmed from the sale records.",
    });
  }, [resetPOS, state.cashier.id]);

  const checkSaleStatus = useCallback(async () => {
    const requestId = checkoutRequestIdRef.current;
    if (!requestId || lookupInFlightRef.current) return;
    lookupInFlightRef.current = true;
    recoveryStatusRef.current = "checking";
    setRecoveryStatus("checking");
    setError("");
    try {
      const sale = await recoverWalkInOrder(requestId);
      if (!mountedRef.current || checkoutRequestIdRef.current !== requestId) return;
      if (sale?.payment.status === "Verified" && sale.transaction.status === "Completed") {
        finishConfirmedSale(sale.order, requestId);
      } else if (sale) {
        recoveryStatusRef.current = "review";
        setRecoveryStatus("review");
        setError("This sale has a recorded status that needs Cashier or Manager review. Do not submit it again.");
      } else {
        recoveryStatusRef.current = "unknown";
        setRecoveryStatus("unknown");
        setError("No completed sale was found in the current shift. The request may still be processing. Check again or ask a manager to reconcile it before starting another sale.");
      }
    } catch {
      if (!mountedRef.current || checkoutRequestIdRef.current !== requestId) return;
      recoveryStatusRef.current = "unavailable";
      setRecoveryStatus("unavailable");
      setError("The sale status could not be checked. Check the connection and try again; do not start another sale yet.");
    } finally {
      lookupInFlightRef.current = false;
    }
  }, [finishConfirmedSale, recoverWalkInOrder]);

  const checkSaleStatusRef = useRef(checkSaleStatus);
  checkSaleStatusRef.current = checkSaleStatus;
  useEffect(() => {
    const saved = loadPendingPOSRequest(state.cashier.id);
    checkoutRequestIdRef.current = saved ?? undefined;
    recoveryStatusRef.current = saved ? "checking" : null;
    setRecoveryStatus(saved ? "checking" : null);
    if (saved) void checkSaleStatusRef.current();
  }, [state.cashier.id]);
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
        items: cart.map(({ lineId: _lineId, ...entry }, index) => ({
          ...entry,
          id: `HELD-ITEM-${index + 1}`,
        })),
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
      form.setValue("paymentMethod", "Cash");
      form.setValue("gcashReference", "");
      form.setValue("gcashConfirmed", false);
      setOrderTypeSelected(true);
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

  const placeOrder = useCallback(async (reuseRequest = false) => {
  if (saleInFlightRef.current || receiptOrder ||
    (recoveryStatusRef.current && !reuseRequest) ||
    (reuseRequest && (!submittedInThisMountRef.current || !checkoutRequestIdRef.current))) return;
  saleInFlightRef.current = true;
  if (reuseRequest) {
    recoveryStatusRef.current = "checking";
    setRecoveryStatus("checking");
  }
  setLoading(true);
  setError("");
  if (!checkoutRequestIdRef.current) checkoutRequestIdRef.current = crypto.randomUUID();
  const requestId = checkoutRequestIdRef.current;
  if (!savePendingPOSRequest(state.cashier.id, requestId)) {
    saleInFlightRef.current = false;
    setLoading(false);
    setError("This tab cannot preserve the sale request. Enable session storage before submitting.");
    return;
  }
  savePOSDraft(cart, values);
  submittedInThisMountRef.current = true;

  try {
    const order = await createWalkInOrder(
      requestId,
      {
        customerName: values.customerName,
        contactNumber: values.contactNumber,
        deliveryAddress: values.deliveryAddress,
        type: values.orderType,

        items: cart.map(
          ({ lineId: _lineId, ...entry }) => entry,
        ),

        paymentMethod: "Cash",

        amountTendered:
          totals.tendered,

        gcashReference: "",
      },
    );

    if (mountedRef.current && checkoutRequestIdRef.current === requestId) {
      finishConfirmedSale(order, requestId);
    }
  } catch {
    if (mountedRef.current && checkoutRequestIdRef.current === requestId) {
      recoveryStatusRef.current = "checking";
      setRecoveryStatus("checking");
      setError("The sale result could not be confirmed. Checking the transaction status before another sale.");
      await checkSaleStatus();
    }
  } finally {
    saleInFlightRef.current = false;
    if (mountedRef.current) setLoading(false);
  }
}, [
  cart,
  checkSaleStatus,
  createWalkInOrder,
  finishConfirmedSale,
  receiptOrder,
  state.cashier.id,
  totals.tendered,
  values,
]);

  const retrySameSale = useCallback(() => {
    if (recoveryStatusRef.current !== "unknown" || !submittedInThisMountRef.current) return;
    void placeOrder(true);
  }, [placeOrder]);



  const submitOrder = form.handleSubmit(() => {
    if (saleInFlightRef.current || recoveryStatusRef.current || receiptOrder) return;
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
  const showSearch = useCallback(() => {
    if (!orderTypeSelected) return;
    window.requestAnimationFrame(() => menuSearchRef.current?.focus());
  }, [orderTypeSelected]);
  const hideSearch = useCallback(() => {
    setSearch("");
  }, []);
  const backToOrdering = useCallback(() => {
    if (loading) return;
    setTransactionState((current) =>
      transitionTransactionState(current, "backToOrdering", cart.length > 0),
    );
    setError("");
  }, [cart.length, loading]);
  const continueToPayment = useCallback(async () => {
    if (!summaryAvailability.canContinue) {
      setError(
        summaryAvailability.disabledReason ??
          "Complete the order information before payment.",
      );
      return;
    }
    if (!(await refreshCartAvailability())) {
      return;
    }
    setError("");
    setTransactionState((current) =>
      transitionTransactionState(current, "proceedToPayment", true),
    );
    window.requestAnimationFrame(() => form.setFocus("amountTendered"));
  }, [form, refreshCartAvailability, summaryAvailability]);
  const beginPayment = useCallback(() => {
    if (!cart.length) {
      Toast.error("Add an item before taking payment.");
      return;
    }
    if (!summaryAvailability.canContinue) {
      setError(
        summaryAvailability.disabledReason ??
          "Complete the order information before payment.",
      );
      return;
    }
    void continueToPayment();
  }, [
    cart.length,
    continueToPayment,
    summaryAvailability.canContinue,
    summaryAvailability.disabledReason,
  ]);
  const closeReceipt = useCallback(() => {
    resetPOS();
  }, [resetPOS]);
  const printReceipt = useCallback(() => {
    window.print();
    setReceiptPrinted(true);
    Toast.info(
      receiptPrinted ? "Receipt reprint dialog opened." : "Receipt print dialog opened.",
    );
  }, [receiptPrinted]);
  const runQuickAction = useCallback(
    (action: QuickActionId) => {
      if (action === "search") showSearch();
      else if (action === "checkout") beginPayment();
      else if (action === "hold") void handleHold();
      else if (action === "cancel") requestCancel();
      else guardedReset();
    },
    [
      beginPayment,
      guardedReset,
      handleHold,
      requestCancel,
      showSearch,
    ],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (recoveryStatusRef.current || saleInFlightRef.current) return;
      if (
        document.querySelector(
          '[role="dialog"]:not([data-pos-workspace-drawer])',
        )
      )
        return;
      if (!orderTypeSelected) return;
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
        } else {
          beginPayment();
        }
      } else if (event.key === "F3") {
        event.preventDefault();
        if (transactionState === POSTransactionState.PAYMENT) {
          confirmOrderRef.current?.click();
        } else {
          beginPayment();
        }
      } else if (modifier && key === "n") {
        event.preventDefault();
        guardedReset();
      } else if (modifier && key === "h") {
        event.preventDefault();
        void handleHold();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    backToOrdering,
    beginPayment,
    closeCustomize,
    guardedReset,
    handleHold,
    hideSearch,
    isDirty,
    orderTypeSelected,
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
    setCategory: selectCategory,
    search,
    setSearch: updateSearch,
    recentSearches,
    commitSearch,
    searchResultCount: searchResults.length,
    activeSearchResultId: activeSearchItem
      ? `pos-product-${activeSearchItem.id}`
      : undefined,
    activeSearchItemId: activeSearchItem?.id,
    moveSearchResult,
    quickAddSearchResult,
    resetSearchSelection,
    hideSearch,
    selectedItem,
    editingLine: cart.find((entry) => entry.lineId === editingLineId),
    transactionState,
    openCustomize,
    closeCustomize,
    addCustomizedItem,
    editLine,
    selectOrderType,
    orderTypeSelected,
    newOrderOpen,
    setNewOrderOpen,
    backToOrdering,
    beginPayment,
    continueToPayment,
    receiptOrder,
    recoveryStatus,
    checkSaleStatus,
    canRetrySameSale: recoveryStatus === "unknown" && submittedInThisMountRef.current && !saleInFlightRef.current,
    retrySameSale,
    submittingSale: saleInFlightRef.current,
    closeReceipt,
    receiptPrinted,
    printReceipt,
    loading: loading || menuAvailabilityRefreshing,
    error,
    setError,
    pendingAction,
    setPendingAction,
    menuSearchRef,
    checkoutRef,
    confirmOrderRef,
    register: form.register,
    errors: form.formState.errors,
    values,
    walkInOrderType,
    bestSellerIds,
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
