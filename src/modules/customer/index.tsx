import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import { Check, ShoppingCart } from "lucide-react";
import { canAddCurrentCustomerProduct, customerErrorMessage, currentCustomerProduct,
  customerProductPricesChanged, isCurrentCustomerMenuResponse } from "./customerBatch1";
import { customerViewSearch, isCustomerOrderId, parseCustomerViewSearch, type CustomerUrlView } from "./customerTrackingUrl";
import { TrackingPage } from "./customerTrackingPage";
import { CustNav } from "./customerNav";
import { HomePage, MenuPage, MenuDetailPage } from "./customerMenuPages";
import { CartPage } from "./customerCartPage";
import { CheckoutPage } from "./customerCheckoutPage";
import { CUSTOMER_ORDER_REQUEST_STORAGE_KEY } from "./customerCheckoutRecovery";
import { CUSTOMER_CART_STORAGE_KEY, CUSTOMER_RESUME_PAGE_STORAGE_KEY } from "./customerStorageKeys";
import { customerLineKey, customerUnitPrice, loadCustomerDrinkChoiceRows, loadCustomerFixedMealPrices, reconcileCustomerCart, fetchCustomerEffectiveAvailability } from "./customerCatalog";
import { HistoryPage } from "./customerHistoryPage";
import { ProfilePage } from "./customerProfilePage";
import type { CustomerPage } from "./customerPageTypes";
import type { CartItem, CustomerDrinkChoiceOption, DatabaseMenuCategory, DatabaseMenuItem, DatabaseMenuEffectiveAvailability, CustomerDatabaseMenuItem } from "./customerTypes";
import "./customer-ui.css";

const CUSTOMER_MENU_AVAILABILITY_FRESHNESS_MS = 5_000;

export function CustomerApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: authLoading } = useAuth();
  const [databaseMenuItems, setDatabaseMenuItems] =
  useState<CustomerDatabaseMenuItem[]>([]);

  const [databaseMenuCategories, setDatabaseMenuCategories] =
  useState<DatabaseMenuCategory[]>([]);

  const [databaseMenuLoading, setDatabaseMenuLoading] =
  useState(true);

  const [databaseMenuError, setDatabaseMenuError] =
  useState<string | null>(null);
  const [choiceRefreshVersion, setChoiceRefreshVersion] = useState(0);
  const [availabilityRefreshing, setAvailabilityRefreshing] =
  useState(false);
  const [availabilityRefreshError, setAvailabilityRefreshError] =
  useState<string | null>(null);
  const [modifierCartError, setModifierCartError] = useState<string | null>(null);
  const [cartPriceNotice, setCartPriceNotice] = useState(false);
  const [modifierCartValidationPending, setModifierCartValidationPending] = useState(true);
  const databaseMenuItemsRef =
  useRef<CustomerDatabaseMenuItem[]>([]);
  const availabilityRefreshInFlightRef =
  useRef<Promise<CustomerDatabaseMenuItem[]> | null>(null);
  const lastAvailabilityRefreshAtRef = useRef(0);
  const menuRevisionRef = useRef(0);
  const [databaseMenuLoadAttempt, setDatabaseMenuLoadAttempt] =
  useState(0);
  const [selectedMenuCategory, setSelectedMenuCategory] =
  useState("All");
  const isCustomerSignedIn =session?.role === "customer";
  const [page, setPage] =
  useState<CustomerPage>(() => {
    const resumePage =
      sessionStorage.getItem(
        CUSTOMER_RESUME_PAGE_STORAGE_KEY,
      );

    if (resumePage === "checkout") {
      sessionStorage.removeItem(
        CUSTOMER_RESUME_PAGE_STORAGE_KEY,
      );

      return "checkout";
    }

    // Keep a retryable checkout visible after a response is lost and the tab reloads.
    if (
      sessionStorage.getItem(CUSTOMER_ORDER_REQUEST_STORAGE_KEY) &&
      sessionStorage.getItem(CUSTOMER_CART_STORAGE_KEY)
    ) {
      return "checkout";
    }

    return "home";
  });
  const [cart, setCart] = useState<CartItem[]>(
  () => {
    try {
      const savedCart =
        sessionStorage.getItem(
          CUSTOMER_CART_STORAGE_KEY,
        );

      if (!savedCart) {
        return [];
      }

      const parsedCart =
        JSON.parse(savedCart) as CartItem[];

      return Array.isArray(parsedCart)
        ? parsedCart.filter((item): item is CartItem =>
            Boolean(item && typeof item.id === "string" &&
              Number.isInteger(item.qty) && item.qty > 0 && item.qty <= 99 &&
              typeof item.name === "string" &&
              Number.isFinite(item.price) && item.price >= 0),
          ).map((item) => {
            const modifiers = Array.isArray(item.modifiers) ? item.modifiers.filter(
              (option) => option && typeof option.id === "string" &&
                typeof option.name === "string" && Number.isFinite(option.price),
            ) : [];
            const modifierIds = modifiers.map((option) => option.id).sort();
            return { ...item, modifiers, modifierIds,
              lineKey: customerLineKey(item.id, modifierIds, item.mealOption) };
          })
        : [];
    } catch {
      return [];
    }
  },
);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  useEffect(() => {
    if (choiceRefreshVersion === 0) return;
    let active = true;
    setModifierCartValidationPending(true);
    void Promise.all([loadCustomerDrinkChoiceRows(), loadCustomerFixedMealPrices()]).then(([rows, fixedPrices]) => {
      if (!active) return;
      const result = reconcileCustomerCart(cartRef.current, rows, fixedPrices);
      if (result.cart.some((line, index) => customerUnitPrice(line) !== customerUnitPrice(cartRef.current[index]))) {
        setCartPriceNotice(true);
      }
      setCart(result.cart);
      setModifierCartError(result.error);
      setModifierCartValidationPending(false);
    }).catch((error) => {
      if (active) {
        setModifierCartError(customerErrorMessage(error, "options"));
        setModifierCartValidationPending(false);
      }
    });
    return () => { active = false; };
  }, [choiceRefreshVersion]);
  const [detailItem, setDetailItem] =
  useState<CustomerDatabaseMenuItem | null>(
    null,
  );
  const [ trackingOrderId, setTrackingOrderId, ] = useState<string | null>(null);
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null);
  const lastSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    const pendingKey = "rrj_customer_tracking_return_v1";
    if (isCustomerSignedIn && !location.search) {
      const pending = sessionStorage.getItem(pendingKey);
      if (pending) {
        sessionStorage.removeItem(pendingKey);
        const restored = parseCustomerViewSearch(pending);
        if (!restored.invalid && restored.view === "tracking") {
          navigate(`/customer${restored.canonical}`, { replace: true });
          return;
        }
      }
    }
    const parsed = parseCustomerViewSearch(location.search);
    if (parsed.invalid) {
      setNavigationNotice("That Customer link is invalid. Choose an order from your history.");
      navigate(`/customer${parsed.canonical}`, { replace: true });
      return;
    }
    if (parsed.canonical && parsed.canonical !== location.search) {
      navigate(`/customer${parsed.canonical}`, { replace: true });
      return;
    }
    if (!parsed.view) {
      if (lastSearchRef.current !== null && lastSearchRef.current !== location.search) {
        setPage("home");
        setTrackingOrderId(null);
      }
      lastSearchRef.current = location.search;
      return;
    }
    lastSearchRef.current = location.search;
    if (parsed.view === "checkout" && cart.length === 0 && !trackingOrderId) {
      setPage("cart");
      navigate(customerViewSearch("cart"), { replace: true });
      return;
    }
    setPage(parsed.view);
    if (parsed.view !== "checkout") {
      setTrackingOrderId(parsed.view === "tracking" && isCustomerSignedIn ? parsed.orderId : null);
    }
  }, [authLoading, cart.length, isCustomerSignedIn, location.search, navigate, trackingOrderId]);
  const navigateCustomerView = (view: CustomerUrlView, orderId?: string | null) => {
    setNavigationNotice(null);
    setPage(view);
    setTrackingOrderId(view === "tracking" ? orderId ?? null : null);
    navigate(`/customer${customerViewSearch(view, orderId)}`);
  };
  const [lastAdded, setLastAdded]   = useState<string | null>(null);
  const toastTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  useEffect(() => () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
  }, []);

  const refreshCustomerMenuAvailability = useCallback(
    (force = false): Promise<CustomerDatabaseMenuItem[]> => {
      const currentItems = databaseMenuItemsRef.current;

      if (currentItems.length === 0) {
        const loadingError = new Error(
          "Menu availability is still loading. Please try again.",
        );

        setAvailabilityRefreshError(customerErrorMessage(loadingError, "availability"));
        return Promise.reject(loadingError);
      }

      if (
        !force &&
        Date.now() - lastAvailabilityRefreshAtRef.current <
          CUSTOMER_MENU_AVAILABILITY_FRESHNESS_MS
      ) {
        return Promise.resolve(currentItems);
      }

      if (availabilityRefreshInFlightRef.current) {
        return availabilityRefreshInFlightRef.current;
      }

      const refreshRequest = (async () => {
        const startingRevision = menuRevisionRef.current;
        setAvailabilityRefreshing(true);
        setAvailabilityRefreshError(null);

        try {
          const [availabilityByItemId, fixedPrices] = await Promise.all([
            fetchCustomerEffectiveAvailability(), loadCustomerFixedMealPrices(),
          ]);
          const itemWithoutAvailability = currentItems.find(
            (item) => !availabilityByItemId.has(item.id),
          );

          if (itemWithoutAvailability) {
            throw new Error(
              `Menu item ${itemWithoutAvailability.id} has no effective availability result.`,
            );
          }

          const refreshedItems = currentItems.map((item) => ({
            ...item,
            available: (availabilityByItemId.get(item.id) ?? false) ||
              fixedPrices.get(item.id)?.withoutRiceAvailable === true,
            price: fixedPrices.get(item.id)?.standard ?? item.price,
            withoutRicePrice: fixedPrices.get(item.id)?.withoutRice,
            withRiceAvailable: fixedPrices.get(item.id)?.withRiceAvailable,
            withoutRiceAvailable: fixedPrices.get(item.id)?.withoutRiceAvailable,
          }));

          if (!isCurrentCustomerMenuResponse(startingRevision, menuRevisionRef.current) || databaseMenuItemsRef.current !== currentItems) {
            return databaseMenuItemsRef.current;
          }
          databaseMenuItemsRef.current = refreshedItems;
          lastAvailabilityRefreshAtRef.current = Date.now();
          setDatabaseMenuItems(refreshedItems);
          setChoiceRefreshVersion((version) => version + 1);

          return refreshedItems;
        } catch (caughtError) {
          const refreshError =
            caughtError instanceof Error
              ? caughtError
              : new Error(
                  "Unable to refresh menu availability. Please try again.",
                );

          if (isCurrentCustomerMenuResponse(startingRevision, menuRevisionRef.current)) {
            lastAvailabilityRefreshAtRef.current = 0;
            setAvailabilityRefreshError(customerErrorMessage(refreshError, "availability"));
          }
          throw refreshError;
        } finally {
          availabilityRefreshInFlightRef.current = null;
          setAvailabilityRefreshing(false);
        }
      })();

      availabilityRefreshInFlightRef.current = refreshRequest;
      return refreshRequest;
    },
    [],
  );

  useEffect(() => {
    let lastFocusRefreshAt = 0;

    const refreshOnFocus = () => {
      if (
        document.visibilityState !== "visible" ||
        databaseMenuItemsRef.current.length === 0
      ) {
        return;
      }

      const now = Date.now();

      if (now - lastFocusRefreshAt < 1_000) {
        return;
      }

      lastFocusRefreshAt = now;
      void refreshCustomerMenuAvailability(true).catch(() => {
        // The existing menu cache stays intact; the UI exposes the refresh error.
      });
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [refreshCustomerMenuAvailability]);

  useEffect(() => {
  let isMounted = true;

  async function loadDatabaseMenu() {
    const startingRevision = ++menuRevisionRef.current;
    setDatabaseMenuLoading(true);
    setDatabaseMenuError(null);
    setAvailabilityRefreshError(null);

    const [
      { data: categories, error: categoriesError },
      { data: items, error: itemsError },
      { data: availability, error: availabilityError },
      { data: fixedOptions, error: fixedOptionsError },
    ] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("menu_items")
        .select(
          `
            id,
            category_id,
            name,
            description,
            price,
            image_path,
            is_available,
            is_active
          `,
        )
        .eq("is_active", true)
        .order("name"),

      supabase.rpc("get_menu_effective_availability"),
      supabase.rpc("get_fixed_meal_options"),
    ]);

    if (!isMounted || !isCurrentCustomerMenuResponse(startingRevision, menuRevisionRef.current)) {
      return;
    }

    if (categoriesError) {
      console.error(
        "Unable to load menu categories:",
        categoriesError.message,
      );

      setDatabaseMenuError(customerErrorMessage(categoriesError, "menu"));

      setDatabaseMenuLoading(false);
      return;
    }

    if (itemsError) {
      console.error(
        "Unable to load menu items:",
        itemsError.message,
      );

      setDatabaseMenuError(customerErrorMessage(itemsError, "menu"));

      setDatabaseMenuLoading(false);
      return;
    }

    if (availabilityError) {
      console.error(
        "Unable to load effective menu availability:",
        availabilityError.message,
      );

      setDatabaseMenuError(customerErrorMessage(availabilityError, "menu"));

      setDatabaseMenuLoading(false);
      return;
    }

    if (fixedOptionsError && fixedOptionsError.code !== "PGRST202") {
      setDatabaseMenuError(customerErrorMessage(fixedOptionsError, "menu"));
      setDatabaseMenuLoading(false);
      return;
    }

    const categoryRows =
      (categories ??
        []) as DatabaseMenuCategory[];
    
    setDatabaseMenuCategories(categoryRows);

    const itemRows =
      (items ?? []) as DatabaseMenuItem[];

    const availabilityRows =
      (availability ??
        []) as DatabaseMenuEffectiveAvailability[];
    const fixedPriceByItem = new Map(
      ((fixedOptions ?? []) as { menu_item_id: string; standard_price: number | string;
        without_rice_price: number | string; with_rice_available: boolean; without_rice_available: boolean }[])
        .map((entry) => [entry.menu_item_id, {
          standard: Number(entry.standard_price), withoutRice: Number(entry.without_rice_price),
          withRiceAvailable: entry.with_rice_available,
          withoutRiceAvailable: entry.without_rice_available,
        }]),
    );
    if ([...fixedPriceByItem.values()].some((price) =>
      !Number.isFinite(price.standard) || !Number.isFinite(price.withoutRice) ||
      price.withoutRice <= 0 || price.withoutRice >= price.standard ||
      typeof price.withRiceAvailable !== "boolean" ||
      typeof price.withoutRiceAvailable !== "boolean")) {
      setDatabaseMenuError(customerErrorMessage(null, "menu"));
      setDatabaseMenuLoading(false);
      return;
    }

    const categoryNameById = new Map(
      categoryRows.map((category) => [
        category.id,
        category.name,
      ]),
    );

    const effectiveAvailabilityByItemId = new Map(
      availabilityRows.map((entry) => [
        entry.menu_item_id,
        entry.effective_available,
      ]),
    );

    const itemWithoutAvailability = itemRows.find(
      (item) =>
        !effectiveAvailabilityByItemId.has(item.id),
    );

    if (itemWithoutAvailability) {
      const message =
        `Menu item ${itemWithoutAvailability.id} has no effective availability result.`;

      console.error(message);
      setDatabaseMenuError(customerErrorMessage(null, "menu"));
      setDatabaseMenuLoading(false);
      return;
    }

    const mappedItems: CustomerDatabaseMenuItem[] =
      itemRows.map((item) => ({
        id: item.id,
        name: item.name,
        desc: item.description ?? "",
        price: fixedPriceByItem.get(item.id)?.standard ?? Number(item.price),
        withoutRicePrice: fixedPriceByItem.get(item.id)?.withoutRice,
        category:
          categoryNameById.get(
            item.category_id,
          ) ?? "Other",
        available:
          (effectiveAvailabilityByItemId.get(item.id) ?? false) ||
          fixedPriceByItem.get(item.id)?.withoutRiceAvailable === true,
        withRiceAvailable: fixedPriceByItem.get(item.id)?.withRiceAvailable,
        withoutRiceAvailable: fixedPriceByItem.get(item.id)?.withoutRiceAvailable,
        imagePath: item.image_path,
      }));

    databaseMenuItemsRef.current = mappedItems;
    lastAvailabilityRefreshAtRef.current = Date.now();
    setAvailabilityRefreshError(null);
    setDatabaseMenuItems(mappedItems);
    setChoiceRefreshVersion((version) => version + 1);
    setDatabaseMenuLoading(false);

  }

  void loadDatabaseMenu().catch((error) => {
    if (!isMounted) return;
    console.error("Unable to load customer menu:", error);
    setDatabaseMenuError(customerErrorMessage(error, "menu"));
    setDatabaseMenuLoading(false);
  });

  return () => {
    isMounted = false;
  };
}, [databaseMenuLoadAttempt]);

  useEffect(() => {
    if (databaseMenuLoading) {
      return;
    }

    const menuItemsById = new Map(
      databaseMenuItems.map((item) => [item.id, item]),
    );
    if (cartRef.current.some((line) => {
      const fresh = menuItemsById.get(line.id);
      return fresh && customerProductPricesChanged(line, fresh);
    })) setCartPriceNotice(true);

    setCart((currentCart) => {
      let changed = false;
      const refreshedCart = currentCart.map((cartItem) => {
        const refreshedItem = menuItemsById.get(cartItem.id);
        const available = refreshedItem?.available ?? false;

        if (
          cartItem.available === available &&
          (!refreshedItem ||
            (cartItem.price === refreshedItem.price &&
              cartItem.name === refreshedItem.name &&
              cartItem.desc === refreshedItem.desc &&
              cartItem.category === refreshedItem.category &&
              cartItem.imagePath === refreshedItem.imagePath &&
              cartItem.withoutRicePrice === refreshedItem.withoutRicePrice &&
              cartItem.withRiceAvailable === refreshedItem.withRiceAvailable &&
              cartItem.withoutRiceAvailable === refreshedItem.withoutRiceAvailable))
        ) {
          return cartItem;
        }

        changed = true;
        return { ...cartItem, ...refreshedItem, available };
      });

      return changed ? refreshedCart : currentCart;
    });

  }, [databaseMenuItems, databaseMenuLoading]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        CUSTOMER_CART_STORAGE_KEY,
        JSON.stringify(cart),
      );
    } catch {
      // Ignore browser storage errors.
    }
  }, [cart]);

  const handleTrackOrder = (
  orderId: string,
) => {
  if (isCustomerOrderId(orderId)) navigateCustomerView("tracking", orderId);
};
  const handleOrderSubmitted = (
  orderId: string,
) => {
  setCart([]);
  setCartPriceNotice(false);
  setTrackingOrderId(orderId);
};

  const handleNavigation = async (
  nextPage: CustomerPage,
  ) => {
    const protectedPages: CustomerPage[] = [
      "tracking",
      "history",
      "profile",
    ];

    if (
      protectedPages.includes(nextPage) &&
      !isCustomerSignedIn
    ) {
      if (nextPage === "tracking") {
        sessionStorage.setItem("rrj_customer_tracking_return_v1", customerViewSearch("tracking"));
      }
      navigate("/auth?portal=customer");
      return;
    }

    if (nextPage === "checkout") {
      if (cart.length === 0) {
        navigateCustomerView("cart");
        return;
      }
      try {
        const [modifierRows, fixedPrices] = await Promise.all([
          loadCustomerDrinkChoiceRows(), loadCustomerFixedMealPrices(),
        ]);
        const reconciled = reconcileCustomerCart(cart, modifierRows, fixedPrices);
        setCart(reconciled.cart);
        setModifierCartError(reconciled.error);
        if (reconciled.error) return;
        const refreshedMenuItems =
          await refreshCustomerMenuAvailability();
        const refreshedAvailabilityByItemId = new Map(
          refreshedMenuItems.map((item) => [item.id, item]),
        );
        const hasUnavailableCartItem = cart.some(
          (item) => {
            const fresh = refreshedAvailabilityByItemId.get(item.id);
            return !fresh?.available ||
              (item.mealOption === "with_rice" && fresh.withRiceAvailable === false) ||
              (item.mealOption === "without_rice" && fresh.withoutRiceAvailable === false);
          },
        );

        if (hasUnavailableCartItem) {
          setModifierCartError("One or more cart items are unavailable. Review your cart before checkout.");
          return;
        }
      } catch (error) {
        setModifierCartError(customerErrorMessage(error, "options"));
        return;
      }
    }

    if (nextPage === "menu" && page !== "menu-detail") {
      setSelectedMenuCategory("All");
    }

    navigateCustomerView(nextPage === "menu-detail" ? "menu" : nextPage);
  };
  const handleBrowseCategory = (category: string) => {
    setSelectedMenuCategory(category);
    navigateCustomerView("menu");
  };
  const retryDatabaseMenu = () => {
    setDatabaseMenuLoadAttempt((attempt) => attempt + 1);
  };

  const addToCart = (
    item: CustomerDatabaseMenuItem,
    qty: number,
    modifiers: CustomerDrinkChoiceOption[],
    mealOption?: "with_rice" | "without_rice",
  ) => {
    const fresh = databaseMenuItemsRef.current.find((product) => product.id === item.id);
    if (!fresh || !canAddCurrentCustomerProduct(item, fresh, mealOption)) {
      setAvailabilityRefreshError("This item changed. Review its latest price and availability before adding it.");
      return false;
    }
    if (cartRef.current.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.qty, 0) + qty > 99) {
      setAvailabilityRefreshError("You can add at most 99 of this item across its choices. Reduce the quantity and try again.");
      return false;
    }
    setModifierCartError(null);
    const modifierIds = modifiers.map((option) => option.id).sort();
    const selectedMealOption = item.withoutRicePrice !== undefined ? mealOption ?? "with_rice" : undefined;
    const lineKey = customerLineKey(item.id, modifierIds, selectedMealOption);
    setCart((prev) => {
      const total = prev.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.qty, 0);
      const adding = Math.min(qty, 99 - total);
      if (adding <= 0) return prev;
      const existing = prev.find((line) => line.lineKey === lineKey);
      if (existing) return prev.map((line) => line.lineKey === lineKey
        ? { ...line, qty: line.qty + adding } : line);
      return [...prev, { ...fresh, qty: adding, modifiers, modifierIds, mealOption: selectedMealOption, lineKey }];
    });
    setLastAdded(item.name);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setLastAdded(null), 2200);
    return true;
  };

const setQty = (
  lineKey: string,
  qty: number,
) =>
  setCart((prev) =>
    qty <= 0
      ? prev.filter(
          (cartItem) => cartItem.lineKey !== lineKey,
        )
      : prev.map((cartItem) =>
          cartItem.lineKey === lineKey
            ? {
                ...cartItem,
                qty: Math.min(qty, 99 - prev.filter((line) => line.id === cartItem.id && line.lineKey !== lineKey).reduce((sum, line) => sum + line.qty, 0)),
              }
            : cartItem,
        ),
  );
  const viewDetail = (item: CustomerDatabaseMenuItem,) => {
    setDetailItem(item);
    setPage("menu-detail");
  };
  const chooseMenuItem = (item: CustomerDatabaseMenuItem) => {
    if (item.category === "Beverages" || item.withoutRicePrice !== undefined) {
      viewDetail(item);
      return;
    }
    addToCart(item, 1, []);
  };

let pageContent: React.ReactNode;

if (page === "home") {
  pageContent = (
  <HomePage
    cart={cart}
    menuItems={databaseMenuItems}
    categories={databaseMenuCategories}
    menuLoading={databaseMenuLoading}
    menuError={databaseMenuError}
    availabilityError={availabilityRefreshError}
    onNav={handleNavigation}
    onBrowseCategory={handleBrowseCategory}
    onRetryMenu={retryDatabaseMenu}
    onAddToCart={chooseMenuItem}
  />
  );
} else if (page === "menu") {
  pageContent = (
  <MenuPage
    cart={cart}
    menuItems={databaseMenuItems}
    categories={databaseMenuCategories}
    menuLoading={databaseMenuLoading}
    menuError={databaseMenuError}
    availabilityError={availabilityRefreshError}
    checkoutError={modifierCartError ?? availabilityRefreshError}
    availabilityRefreshing={availabilityRefreshing}
    selectedCategory={selectedMenuCategory}
    onNav={handleNavigation}
    onCategoryChange={setSelectedMenuCategory}
    onRetryMenu={retryDatabaseMenu}
    onAddToCart={chooseMenuItem}
  />
  );
} else if (
  page === "menu-detail" &&
  detailItem
) {
  const currentDetail = currentCustomerProduct(detailItem, databaseMenuItems);
  pageContent = (
    <MenuDetailPage
      item={currentDetail.item}
      removed={currentDetail.removed}
      choiceRefreshVersion={choiceRefreshVersion}
      refreshError={databaseMenuError ?? availabilityRefreshError}
      cart={cart}
      onNav={handleNavigation}
      onRetryMenu={retryDatabaseMenu}
      onAddToCart={addToCart}
    />
  );
} else if (page === "cart") {
  pageContent = (
    <CartPage
      cart={cart}
      priceNotice={cartPriceNotice}
      onDismissPriceNotice={() => setCartPriceNotice(false)}
      availabilityRefreshing={availabilityRefreshing}
      availabilityError={modifierCartError ?? availabilityRefreshError}
      onNav={handleNavigation}
      onQtyChange={setQty}
      onRemove={(id) => {
        setModifierCartError(null);
        setCart((items) =>
          items.filter(
            (item) => item.lineKey !== id,
          ),
        );
      }}
    />
  );
} else if (page === "checkout") {
  pageContent = (
  <CheckoutPage
    cart={cart}
    cartValidationPending={modifierCartValidationPending}
    cartValidationError={modifierCartError}
    onNav={handleNavigation}
    onTrackOrder={handleTrackOrder}
    onOrderSubmitted={handleOrderSubmitted}
  />
  );
} else if ((page === "tracking" || page === "history" || page === "profile") && !isCustomerSignedIn) {
  pageContent = (
    <div className="flex h-full flex-col overflow-hidden">
      <CustNav cart={cart} onNav={handleNavigation} currentPage="tracking" />
      <main className="customer-storefront flex flex-1 items-center justify-center overflow-y-auto px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold">Sign in to view your orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account details are available only after sign in.</p>
          <button type="button" className="mt-5 min-h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
            onClick={() => {
              const parsed = parseCustomerViewSearch(location.search);
              if (!parsed.invalid && parsed.view === "tracking") sessionStorage.setItem("rrj_customer_tracking_return_v1", parsed.canonical);
              navigate("/auth?portal=customer");
            }}>Sign in</button>
        </div>
      </main>
    </div>
  );
} else if (page === "tracking") {
  pageContent = (
  <TrackingPage
    key={`${session?.id ?? "guest"}:${trackingOrderId ?? "latest"}`}
    nav={<CustNav cart={cart} onNav={handleNavigation} currentPage="tracking" />}
    onNav={handleNavigation}
    orderId={trackingOrderId}
    customerId={session!.id}
  />
  );
} else if (page === "history") {
  pageContent = (
  <HistoryPage
    nav={<CustNav cart={cart} onNav={handleNavigation} currentPage="history" />}
    onNav={handleNavigation}
    onTrackOrder={handleTrackOrder}
  />
  );
} else if (page === "profile") {
  pageContent = (
    <ProfilePage
      nav={<CustNav cart={cart} onNav={handleNavigation} currentPage="profile" />}
      onNav={handleNavigation}
    />
  );
} else {
  pageContent = (
    <HomePage
      cart={cart}
      menuItems={databaseMenuItems}
      categories={databaseMenuCategories}
      menuLoading={databaseMenuLoading}
       menuError={databaseMenuError}
       availabilityError={availabilityRefreshError}
      onNav={handleNavigation}
      onBrowseCategory={handleBrowseCategory}
      onRetryMenu={retryDatabaseMenu}
      onAddToCart={chooseMenuItem}
    />
  );
}

  return (
    <div className="customer-app relative h-full overflow-hidden bg-background">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="h-full"
        >
          {navigationNotice && <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">{navigationNotice}</p>}
          {pageContent}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {lastAdded && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            role="status"
            aria-live="polite"
            className="customer-added-toast pointer-events-none absolute bottom-5 left-1/2 z-50 flex w-[min(23rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-foreground px-4 py-3 text-white shadow-2xl shadow-black/30"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><Check className="h-4 w-4" /></span>
            <span className="min-w-0"><strong className="block truncate text-xs">{lastAdded}</strong><span className="text-[10px] text-white/55">Added to your order</span></span>
            <ShoppingCart className="ml-auto h-4 w-4 text-amber-300" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
