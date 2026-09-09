import { supabase } from "@/lib/supabase";
import { gcashMerchantConfig } from "@/config/paymentConfig";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  ShoppingCart,
  ArrowLeft,
  Plus,
  Minus,
  Upload,
  Check,
  Loader2,
  ChefHat,
  User,
  Phone,
  Search,
  Menu as MenuIcon,
  X,
  BadgeCheck,
  ChevronRight,
  MapPin,
  Sparkles,
  Truck,
  LogOut,
} from "lucide-react";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";
import rrjPhoto from "@/assets/brand/rrj-restaurant.jpg";

type CustomerPage =
  | "home" | "menu" | "menu-detail" | "cart" | "checkout"
  | "tracking" | "history" | "profile";

type CartItem =
  CustomerDatabaseMenuItem & {
    qty: number;
  };

interface DatabaseMenuCategory {
  id: string;
  name: string;
}

interface DatabaseMenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  is_active: boolean;
}

interface DatabaseMenuEffectiveAvailability {
  menu_item_id: string;
  effective_available: boolean;
}

interface CustomerDatabaseMenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  category: string;
  available: boolean;
  imagePath: string | null;
}

const CUSTOMER_CART_STORAGE_KEY = "rrj_customer_cart_v2";
const CUSTOMER_RESUME_PAGE_STORAGE_KEY ="rrj_customer_resume_page_v1";

const ORDER_STEPS = [
  {
    status: "waiting_payment_verification",
    label: "Waiting for Payment Verification",
  },
  {
    status: "confirmed",
    label: "Confirmed",
  },
  {
    status: "preparing",
    label: "Preparing",
  },
  {
    status: "ready",
    label: "Ready",
  },
  {
    status: "waiting_for_rider",
    label: "Waiting for Rider",
  },
  {
    status: "rider_accepted",
    label: "Rider Accepted",
  },
  {
    status: "picked_up",
    label: "Picked Up",
  },
  {
    status: "out_for_delivery",
    label: "Out for Delivery",
  },
  {
    status: "delivered",
    label: "Delivered",
  },
] as const;

const NAV_LINKS: { id: CustomerPage; label: string }[] = [
  { id: "home",     label: "Home"        },
  { id: "menu",     label: "Menu"        },
  { id: "tracking", label: "Track Order" },
  { id: "history",  label: "Orders"      },
];

const CATEGORY_META: Record<string, { emoji: string; gradient: string }> = {
  All: { emoji: "✦", gradient: "from-orange-100 via-amber-50 to-rose-100" },
  Viands: { emoji: "🍛", gradient: "from-amber-100 via-orange-50 to-red-100" },
  Soups: { emoji: "🥣", gradient: "from-emerald-100 via-lime-50 to-amber-100" },
  Rice: { emoji: "🍚", gradient: "from-stone-100 via-white to-amber-100" },
  Vegetables: { emoji: "🥬", gradient: "from-lime-100 via-emerald-50 to-teal-100" },
  Beverages: { emoji: "🥤", gradient: "from-sky-100 via-cyan-50 to-orange-100" },
};

function MenuVisual({ item, large = false }: { item: CustomerDatabaseMenuItem; large?: boolean }) {
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.All;
  return (
    <div className={`customer-menu-visual relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${meta.gradient} ${large ? "h-56 sm:h-72" : "h-32 sm:h-40"}`}>
      <div className="absolute left-5 top-4 h-12 w-12 rounded-full bg-white/45 blur-xl" />
      <div className="absolute bottom-3 right-4 h-14 w-14 rounded-full bg-primary/10 blur-xl" />
      <div className={`customer-dish-plate ${large ? "h-36 w-36 sm:h-44 sm:w-44" : "h-20 w-20 sm:h-24 sm:w-24"}`}>
        <span className={large ? "text-6xl sm:text-7xl" : "text-4xl sm:text-5xl"} aria-hidden="true">{meta.emoji}</span>
      </div>
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-white/80 px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider text-emerald-700 shadow-sm backdrop-blur">
        <BadgeCheck className="h-3 w-3" /> Halal
      </span>
    </div>
  );
}

function FoodCard({
  item,
  onAdd,
  onView,
}: {
  item: CustomerDatabaseMenuItem;
  onAdd: (
    item: CustomerDatabaseMenuItem,
  ) => void;
  onView?: (
    item: CustomerDatabaseMenuItem,
  ) => void;
}) {
  return (
    <article className="customer-food-card group overflow-hidden rounded-2xl border border-border/80 bg-card">
      <button
        type="button"
        onClick={() => onView?.(item)}
        disabled={!onView}
        className="block w-full text-left disabled:cursor-default"
        aria-label={onView ? `View ${item.name}` : undefined}
      >
        <MenuVisual item={item} />
      </button>
      <div className="p-3.5 sm:p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-xs font-extrabold text-foreground sm:text-sm">{item.name}</h3>
          <span className="flex-none text-sm font-extrabold text-primary sm:text-base">₱{item.price}</span>
        </div>
        <p className="mb-3 line-clamp-2 min-h-8 text-[10px] leading-4 text-muted-foreground sm:text-xs">{item.desc}</p>
        <button
          type="button"
          onClick={() => onAdd(item)}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#211914] px-3 text-[10px] font-extrabold text-white shadow-sm hover:bg-primary sm:text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Add to order
        </button>
      </div>
    </article>
  );
}

function CustomerMenuFeedback({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex min-h-44 flex-col items-center justify-center rounded-2xl border px-6 text-center ${
        error
          ? "border-red-200 bg-red-50"
          : "border-border bg-card"
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            Loading menu…
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-red-700">
            Unable to load the menu
          </p>
          <p className="mt-1 text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 min-h-10 rounded-xl border border-red-300 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            Try Again
          </button>
        </>
      )}
    </div>
  );
}

// ── Shared Customer Nav ──────────────────────────────────────────
function CustNav({
  cart,
  onNav,
  currentPage,
}: {
  cart: CartItem[];
  onNav: (page: CustomerPage) => void;
  currentPage: CustomerPage;
}) {
  const navigate = useNavigate();
  const { session, logout } = useAuth();

  const isCustomerSignedIn =
    session?.role === "customer";

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] =
    useState(false);
  const [signingOut, setSigningOut] =
    useState(false);

  const totalItems = cart.reduce(
    (sum, cartItem) => sum + cartItem.qty,
    0,
  );

  const handleSignOut = async (): Promise<void> => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setAccountMenuOpen(false);
    setMenuOpen(false);

    await logout();

    navigate("/auth?portal=customer", {
      replace: true,
    });
  };

  const handleSignIn = () => {
    navigate("/auth?portal=customer");
  };

  return (
    <header className="customer-nav sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border/70 bg-card/85 px-4 py-2.5 shadow-[0_8px_30px_rgba(64,40,25,0.04)] backdrop-blur-xl sm:px-6">
      {/* Logo */}
      <button
        type="button"
        onClick={() => onNav("home")}
        className="flex min-h-11 flex-shrink-0 items-center gap-2.5 rounded-xl pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-900 shadow-md ring-1 ring-black/10">
          <ImageWithFallback
            src={rrjLogo}
            alt="RRJ's Food-Haus"
            className="h-full w-full object-contain"
          />
        </div>

        <span className="hidden sm:block">
          <span className="block font-['Fraunces'] text-sm font-bold leading-none text-foreground">
            RRJ&apos;s Food-Haus
          </span>

          <span className="mt-1 flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-emerald-700">
            <BadgeCheck className="h-2.5 w-2.5" />
            Halal kitchen
          </span>
        </span>
      </button>

      {/* Desktop navigation */}
      <nav className="hidden items-center gap-1 rounded-xl border border-border/70 bg-background/60 p-1 md:flex">
        {NAV_LINKS.map((navItem) => (
          <button
            key={navItem.id}
            type="button"
            onClick={() => onNav(navItem.id)}
            aria-current={
              currentPage === navItem.id
                ? "page"
                : undefined
            }
            className={`min-h-9 rounded-lg px-3 text-[11px] font-extrabold transition-all ${
              currentPage === navItem.id
                ? "bg-[#211914] text-white shadow-sm"
                : "text-muted-foreground hover:bg-white hover:text-foreground"
            }`}
          >
            {navItem.label}
          </button>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Cart */}
        <button
          type="button"
          onClick={() => onNav("cart")}
          className="relative flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-extrabold text-primary-foreground shadow-md shadow-orange-900/10 hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <ShoppingCart className="h-4 w-4" />

          <span className="hidden sm:inline">
            Cart
          </span>

          {totalItems > 0 && (
            <motion.span
              key={totalItems}
              initial={{ scale: 0.55 }}
              animate={{ scale: 1 }}
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#211914] px-1 text-[9px] font-extrabold text-white ring-2 ring-white"
            >
              {totalItems}
            </motion.span>
          )}
        </button>

        {/* Desktop account */}
        {isCustomerSignedIn ? (
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() =>
                setAccountMenuOpen(
                  (currentValue) => !currentValue,
                )
              }
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border bg-white transition-colors ${
                accountMenuOpen
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4" />
            </button>

            <AnimatePresence>
              {accountMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close account menu"
                    onClick={() =>
                      setAccountMenuOpen(false)
                    }
                    className="fixed inset-0 z-40 cursor-default"
                  />

                  <motion.div
                    role="menu"
                    initial={{
                      opacity: 0,
                      y: -6,
                      scale: 0.97,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.97,
                    }}
                    transition={{
                      duration: 0.14,
                    }}
                    className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-48 overflow-hidden rounded-xl border border-border bg-white p-1.5 shadow-xl shadow-black/10"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onNav("profile");
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-foreground hover:bg-muted"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      My Profile
                    </button>

                    <div className="my-1 border-t border-border" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void handleSignOut();
                      }}
                      disabled={signingOut}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {signingOut ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}

                      {signingOut
                        ? "Signing out…"
                        : "Sign Out"}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSignIn}
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-extrabold text-foreground shadow-sm hover:border-primary/30 hover:bg-amber-50/40 sm:flex"
          >
            <User className="h-4 w-4 text-primary" />
            Sign In
          </button>
        )}

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white hover:bg-muted md:hidden"
        >
          <MenuIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 34,
              }}
              className="absolute right-0 top-0 flex h-full w-[min(19rem,86vw)] flex-col bg-[#1d1713] text-white shadow-2xl"
            >
              {/* Mobile header */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 overflow-hidden rounded-xl bg-black ring-1 ring-white/15">
                    <ImageWithFallback
                      src={rrjLogo}
                      alt="RRJ's Food-Haus"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div>
                    <span className="block font-['Fraunces'] text-sm font-bold">
                      RRJ&apos;s Food-Haus
                    </span>

                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-emerald-300">
                      Halal kitchen
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close navigation"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile navigation */}
              <nav className="flex flex-col gap-1 p-3">
                {NAV_LINKS.map((navItem) => (
                  <button
                    key={navItem.id}
                    type="button"
                    onClick={() => {
                      onNav(navItem.id);
                      setMenuOpen(false);
                    }}
                    className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-left text-sm font-bold transition-colors ${
                      currentPage === navItem.id
                        ? "bg-primary text-white"
                        : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    {navItem.label}

                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                ))}

                {isCustomerSignedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      onNav("profile");
                      setMenuOpen(false);
                    }}
                    className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-left text-sm font-bold transition-colors ${
                      currentPage === "profile"
                        ? "bg-primary text-white"
                        : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    My Profile

                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                )}
              </nav>

              {/* Mobile account action */}
              <div className="mt-auto border-t border-white/10 p-4">
                {isCustomerSignedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleSignOut();
                    }}
                    disabled={signingOut}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500/15 px-4 text-sm font-bold text-red-200 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {signingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}

                    {signingOut
                      ? "Signing out…"
                      : "Sign Out"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleSignIn();
                    }}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-amber-700"
                  >
                    <User className="h-4 w-4" />
                    Sign In
                  </button>
                )}

                <p className="mt-4 text-[10px] leading-relaxed text-white/35">
                  Halal Filipino comfort food
                  <br />
                  Made with care since 2021.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ── Home ──────────────────────────────────────────────────────────
function HomePage({
  cart,
  menuItems,
  categories,
  menuLoading,
  menuError,
  onNav,
  onBrowseCategory,
  onRetryMenu,
  onAddToCart,
}: {
  cart: CartItem[];
  menuItems: CustomerDatabaseMenuItem[];
  categories: DatabaseMenuCategory[];
  menuLoading: boolean;
  menuError: string | null;
  onNav: (page: CustomerPage) => void;
  onBrowseCategory: (category: string) => void;
  onRetryMenu: () => void;
  onAddToCart: (
    item: CustomerDatabaseMenuItem,
  ) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="home" />
      <div className="customer-storefront flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative h-[16rem] overflow-hidden sm:h-[22rem] lg:h-[25rem]">
          <ImageWithFallback src={rrjPhoto} alt="RRJ's Food-Haus restaurant" className="h-full w-full object-cover object-[center_66%] transition-transform duration-[12s] ease-out hover:scale-[1.035]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,14,11,.94)_0%,rgba(23,16,12,.66)_52%,rgba(20,14,11,.16)_100%)]" />
          <div className="absolute inset-0 flex items-center px-5 sm:px-10 lg:px-16">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="max-w-xl">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-emerald-200 backdrop-blur sm:text-[10px]"><BadgeCheck className="h-3 w-3" /> Halal kitchen · Open until 9 PM</p>
              <h1 className="mb-2 font-['Fraunces'] text-3xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:mb-4 sm:text-5xl lg:text-6xl">
                Comfort food,<br /><span className="text-amber-300">made for sharing.</span>
              </h1>
              <p className="mb-4 max-w-md text-xs leading-relaxed text-white/68 sm:mb-7 sm:text-sm">
                Fresh halal Filipino favorites, cooked with care and brought from our kitchen to your table.
              </p>
              <div className="flex gap-2">
                <button onClick={() => onNav("menu")} className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground shadow-lg shadow-black/20 hover:bg-amber-700 sm:min-h-12 sm:px-6 sm:text-sm">
                  Explore the menu <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={() => onNav("tracking")} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white backdrop-blur hover:bg-white/20 sm:min-h-12 sm:px-5 sm:text-sm">
                  <MapPin className="w-3.5 h-3.5" /> Track order
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Categories */}
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
          <div className="mb-7 grid grid-cols-3 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            {[
              { icon: BadgeCheck, title: "Halal kitchen", sub: "Prepared with care" },
              { icon: Sparkles, title: "Freshly cooked", sub: "Made when you order" },
              { icon: Truck, title: "Local delivery", sub: "Simple order tracking" },
            ].map(({ icon: Icon, title, sub }, index) => (
              <div key={title} className={`flex items-center justify-center gap-2 px-2 py-3 sm:gap-3 sm:px-4 sm:py-4 ${index ? "border-l border-border/70" : ""}`}>
                <div className="hidden h-9 w-9 flex-none items-center justify-center rounded-xl bg-amber-50 text-primary sm:flex"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 text-center sm:text-left"><p className="truncate text-[9px] font-extrabold text-foreground sm:text-xs">{title}</p><p className="hidden truncate text-[9px] text-muted-foreground sm:block">{sub}</p></div>
              </div>
            ))}
          </div>

          {menuLoading || menuError ? (
            <CustomerMenuFeedback
              loading={menuLoading}
              error={menuError}
              onRetry={onRetryMenu}
            />
          ) : (
            <>
          <div className="mb-3 flex items-end justify-between sm:mb-4">
            <div><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-primary/70">Find your craving</p><h2 className="font-['Fraunces'] text-xl font-semibold text-foreground sm:text-2xl">Browse by category</h2></div>
          </div>
          <div className="mb-8 grid grid-cols-3 gap-2 sm:mb-11 sm:grid-cols-6 sm:gap-3">
            {[
                "All",
                ...categories.map(
                  (category) => category.name,
                ),
              ].map((cat) => {
                const meta =
                  CATEGORY_META[cat] ??
                  CATEGORY_META.All;

                return (
                  <button
                    key={cat}
                    onClick={() => onBrowseCategory(cat)}
                    className="group flex min-h-[5.8rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/80 bg-card p-2 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg sm:min-h-[7rem] sm:gap-2"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-xl shadow-inner transition-transform group-hover:scale-110 group-hover:-rotate-3 sm:h-12 sm:w-12 sm:text-2xl ${meta.gradient}`}
                    >
                      <span aria-hidden="true">
                        {meta.emoji}
                      </span>
                    </div>

                    <span className="text-[9px] font-extrabold text-foreground sm:text-xs">
                      {cat}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="mb-3 flex items-end justify-between sm:mb-4">
            <div><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-primary/70">From our menu</p><h2 className="font-['Fraunces'] text-xl font-semibold text-foreground sm:text-2xl">Available dishes</h2></div>
            <button onClick={() => onNav("menu")} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-[10px] font-extrabold text-primary hover:bg-primary/5 sm:text-xs">View all <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {menuItems.filter((m) => m.available).slice(0, 4).map((item) => (
              <FoodCard key={item.id} item={item} onAdd={onAddToCart} />
            ))}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Menu Browse ───────────────────────────────────────────────────
function MenuPage({
  cart,
  menuItems,
  categories,
  menuLoading,
  menuError,
  selectedCategory,
  onNav,
  onCategoryChange,
  onRetryMenu,
  onAddToCart,
  onViewDetail,
}: {
  cart: CartItem[];
  menuItems: CustomerDatabaseMenuItem[];
  categories: DatabaseMenuCategory[];
  menuLoading: boolean;
  menuError: string | null;
  selectedCategory: string;
  onNav: (page: CustomerPage) => void;
  onCategoryChange: (category: string) => void;
  onRetryMenu: () => void;
  onAddToCart: (
    item: CustomerDatabaseMenuItem,
  ) => void;
  onViewDetail: (
    item: CustomerDatabaseMenuItem,
  ) => void;
}) {
  const [search, setSearch] = useState("");
  const cats = [
  "All",
  ...categories.map(
    (category) => category.name,
  ),
  ];
  const cat = cats.includes(selectedCategory)
    ? selectedCategory
    : "All";
  const filtered = menuItems.filter(
    (m) => m.available &&
    (cat === "All" || m.category === cat) &&
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="menu" />
      <div className="customer-storefront flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 md:px-10">
        <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-primary/70">Fresh from our halal kitchen</p>
            <h1 className="font-['Fraunces'] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">What are you craving?</h1>
          </div>
          {!menuLoading && !menuError ? (
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold text-muted-foreground sm:block">{filtered.length} dishes available</span>
          ) : null}
        </div>
        {menuLoading || menuError ? (
          <CustomerMenuFeedback
            loading={menuLoading}
            error={menuError}
            onRetry={onRetryMenu}
          />
        ) : (
          <>
        {/* Search + filters */}
        <div className="mb-5 flex flex-col items-stretch gap-3 sm:mb-7 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input placeholder="Search menu items…" value={search} onChange={(e) => setSearch(e.target.value)}
              aria-label="Search menu"
              className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary/45 focus:ring-4 focus:ring-primary/10" />
          </div>
          <div className="flex flex-shrink-0 gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
            {cats.map((c) => (
              <button key={c} onClick={() => onCategoryChange(c)}
                className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-[10px] font-extrabold transition-all sm:text-xs ${cat === c ? "bg-[#211914] text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => <FoodCard key={item.id} item={item} onAdd={onAddToCart} onView={onViewDetail} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl">🍽️</div>
            <h2 className="text-sm font-extrabold text-foreground">No dishes found</h2>
            <p className="mt-1 text-xs text-muted-foreground">Try a different search or category.</p>
            <button onClick={() => { setSearch(""); onCategoryChange("All"); }} className="mt-4 min-h-10 rounded-xl bg-[#211914] px-4 text-xs font-extrabold text-white">Clear filters</button>
          </div>
        )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Menu Detail ───────────────────────────────────────────────────
function MenuDetailPage({
  item,
  cart,
  onNav,
  onAddToCart,
}: {
  item: CustomerDatabaseMenuItem;
  cart: CartItem[];
  onNav: (page: CustomerPage) => void;
  onAddToCart: (
    item: CustomerDatabaseMenuItem,
  ) => void;
}) {
  const [qty, setQty] = useState(1);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="menu" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <button onClick={() => onNav("menu")} className="mb-5 flex min-h-11 items-center gap-1.5 rounded-xl pr-3 text-sm font-bold text-muted-foreground hover:text-foreground sm:mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Menu
          </button>
          <div className="grid grid-cols-1 gap-5 overflow-hidden rounded-3xl border border-border/80 bg-card p-3 shadow-[0_24px_70px_rgba(65,42,26,.09)] sm:gap-8 sm:p-5 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl"><MenuVisual item={item} large /></div>
            <div className="flex flex-col">
              <div className="mb-2 flex items-center gap-2"><span className="text-xs font-extrabold uppercase tracking-wide text-primary">{item.category}</span><span className="h-1 w-1 rounded-full bg-border" /><span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700"><BadgeCheck className="h-3 w-3" /> Halal</span></div>
              <h1 className="mb-3 font-['Fraunces'] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{item.name}</h1>
              <p className="text-muted-foreground mb-4 sm:mb-6 leading-relaxed text-sm sm:text-base">{item.desc}</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary mb-4 sm:mb-6">₱{item.price}</p>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-2">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity" className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Minus className="w-3 h-3" /></button>
                  <span className="font-bold w-6 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} aria-label="Increase quantity" className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Plus className="w-3 h-3" /></button>
                </div>
                <button
                  onClick={() => { for (let i = 0; i < qty; i++) onAddToCart(item); onNav("cart"); }}
                  className="min-h-12 flex-1 rounded-xl bg-primary px-3 text-sm font-extrabold text-primary-foreground shadow-lg shadow-orange-900/10 hover:bg-amber-800">
                  Add to Cart · ₱{item.price * qty}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cart ─────────────────────────────────────────────────────────
function CartPage({ cart, onNav, onQtyChange, onRemove }: { cart: CartItem[]; onNav: (p: CustomerPage) => void; onQtyChange: (id: string,qty: number,) => void; onRemove: (id: string) => void; }) {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="cart" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8">
          <h1 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6">My Cart</h1>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <ShoppingCart className="w-14 h-14 text-muted-foreground/25" />
              <p className="text-base font-bold text-muted-foreground">Your cart is empty</p>
              <button onClick={() => onNav("menu")} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-amber-800">Browse Menu</button>
            </div>
          ) : (
            <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 sm:gap-6">
              {/* Items */}
              <div className="lg:col-span-3 flex flex-col gap-3">
                {cart.map((item) => (
                  <div key={item.id} className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl sm:h-16 sm:w-16 sm:text-3xl ${CATEGORY_META[item.category]?.gradient ?? CATEGORY_META.All.gradient}`}>
                      <span aria-hidden="true">{CATEGORY_META[item.category]?.emoji ?? CATEGORY_META.All.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">₱{item.price} each</p>
                      <button onClick={() => onRemove(item.id)} className="mt-1 min-h-7 text-[9px] font-bold text-red-600 hover:underline">Remove</button>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <button onClick={() => onQtyChange(item.id, item.qty - 1)} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-muted flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className="w-5 text-center font-bold text-sm">{item.qty}</span>
                      <button onClick={() => onQtyChange(item.id, item.qty + 1)} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-muted flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    </div>
                    <p className="w-14 text-right font-bold text-foreground text-sm flex-shrink-0">₱{item.price * item.qty}</p>
                  </div>
                ))}
              </div>
              {/* Summary */}
              <div className="lg:col-span-2">
                <div className="bg-card border border-border rounded-xl p-4 sm:p-5 lg:sticky lg:top-4">
                  <p className="font-bold text-foreground mb-3 sm:mb-4">Order Summary</p>
                  <div className="flex flex-col gap-2 text-sm mb-4">
                    {cart.map((c) => (
                      <div key={c.id} className="flex justify-between">
                        <span className="text-muted-foreground truncate mr-2">{c.name} ×{c.qty}</span>
                        <span className="font-semibold flex-shrink-0">₱{c.price * c.qty}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Estimated delivery fee</span><span className="font-semibold">₱50</span></div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Estimated total</span><span className="text-primary">₱{subtotal + 50}</span></div>
                  </div>
                  <p className="mb-4 text-[11px] leading-4 text-muted-foreground">The final delivery fee and total will be confirmed when your order is created at checkout.</p>
                  <button onClick={() => onNav("checkout")} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-amber-800">Proceed to Checkout</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CheckoutCustomerProfile {
  first_name: string | null;
  last_name: string | null;
  contact_number: string | null;
}

interface PlacedCustomerOrder {
  order_id: string;
  order_number: string;
  subtotal: number;
  delivery_fee: number;
  grand_total: number;
  current_status: string;
}

interface PendingCustomerPaymentSubmission {
  order: PlacedCustomerOrder;
  proofImagePath?: string;
}

function parsePlacedCustomerOrder(value: unknown): PlacedCustomerOrder {
  if (!value || typeof value !== "object") {
    throw new Error(
      "The server returned invalid order information.",
    );
  }

  const row = value as Record<string, unknown>;
  const subtotal = Number(row.subtotal);
  const deliveryFee = Number(row.delivery_fee);
  const grandTotal = Number(row.grand_total);
  const hasNumericTotals = [
    row.subtotal,
    row.delivery_fee,
    row.grand_total,
  ].every(
    (amount) =>
      (typeof amount === "number" ||
        (typeof amount === "string" && amount.trim().length > 0)),
  );

  if (
    typeof row.order_id !== "string" ||
    row.order_id.trim().length === 0 ||
    typeof row.order_number !== "string" ||
    row.order_number.trim().length === 0 ||
    typeof row.current_status !== "string" ||
    row.current_status.trim().length === 0 ||
    !hasNumericTotals ||
    !Number.isFinite(subtotal) ||
    subtotal < 0 ||
    !Number.isFinite(deliveryFee) ||
    deliveryFee < 0 ||
    !Number.isFinite(grandTotal) ||
    grandTotal < 0
  ) {
    throw new Error(
      "The server returned incomplete order information.",
    );
  }

  return {
    order_id: row.order_id,
    order_number: row.order_number,
    subtotal,
    delivery_fee: deliveryFee,
    grand_total: grandTotal,
    current_status: row.current_status,
  };
}

interface SubmittedCustomerPayment {
  payment_id: string;
  order_id: string;
  amount: number | string;
  payment_method: "gcash";
  gcash_reference_number: string;
  proof_image_path: string;
  status: "pending";
  created_at: string;
}

function getPaymentProofExtension(file: File): string {
  const originalExtension = file.name
    .split(".")
    .pop()
    ?.toLowerCase();

  if (file.type === "image/png") {
    return "png";
  }

  return originalExtension === "jpeg"
    ? "jpeg"
    : "jpg";
}

// ── Checkout ─────────────────────────────────────────────────────
function CheckoutPage({
  cart,
  onNav,
  onOrderPlaced,
}: {
  cart: CartItem[];
  onNav: (page: CustomerPage) => void;
  onOrderPlaced: (orderId: string) => void;
}) {
  const { session } = useAuth();

  const subtotal = cart.reduce(
    (sum, cartItem) =>
      sum + cartItem.price * cartItem.qty,
    0,
  );

  const [step, setStep] =
    useState<"login" | "details" | "upload">(
      "login",
    );

  const [googleLoading, setGoogleLoading] =
    useState(false);

  const [fullName, setFullName] =
  useState("");

  const [contactNumber, setContactNumber] =
  useState("");

  const [deliveryAddress, setDeliveryAddress] =
  useState("");

  const [landmark, setLandmark] =
  useState("");

  const [profileLoading, setProfileLoading] =
  useState(false);

  const [deliveryError, setDeliveryError] =
  useState<string | null>(null);

  const [placingOrder, setPlacingOrder] =
  useState(false);

const [placeOrderError, setPlaceOrderError] =
  useState<string | null>(null);

const [placedOrder, setPlacedOrder] =
  useState<PlacedCustomerOrder | null>(
    null,
  );

  const [
    pendingPaymentSubmission,
    setPendingPaymentSubmission,
  ] = useState<PendingCustomerPaymentSubmission | null>(
    null,
  );

  const [
    gcashReferenceNumber,
    setGcashReferenceNumber,
  ] = useState("");

  const [
    gcashReferenceError,
    setGcashReferenceError,
  ] = useState<string | null>(null);

  const [paymentProof, setPaymentProof] =
  useState<File | null>(null);

  const [paymentProofError, setPaymentProofError] =
  useState<string | null>(null);

  const paymentProofInputRef =
  useRef<HTMLInputElement | null>(null);

  const orderCreationInFlightRef = useRef(false);

  const isCustomerSignedIn =
    session?.role === "customer";

useEffect(() => {
  if (!isCustomerSignedIn) {
    return;
  }

  let isMounted = true;

  async function loadCheckoutCustomer() {
    setProfileLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!isMounted) {
      return;
    }

    if (userError || !user) {
      console.error(
        "Unable to load checkout user:",
        userError?.message,
      );

      setProfileLoading(false);
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        `
          first_name,
          last_name,
          contact_number
        `,
      )
      .eq("id", user.id)
      .single<CheckoutCustomerProfile>();

    if (!isMounted) {
      return;
    }

    if (profileError) {
      console.error(
        "Unable to load checkout profile:",
        profileError.message,
      );
    }

    const profileName = [
      profile?.first_name,
      profile?.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const googleName =
      typeof user.user_metadata?.full_name ===
      "string"
        ? user.user_metadata.full_name
        : "";

    setFullName(
      profileName ||
        googleName ||
        user.email?.split("@")[0] ||
        "",
    );

    setContactNumber(
      profile?.contact_number ?? "",
    );

    setProfileLoading(false);
    setStep("details");
  }

  void loadCheckoutCustomer();

  return () => {
    isMounted = false;
  };
}, [isCustomerSignedIn]);

  const handleCheckoutGoogleLogin = async () => {
    if (googleLoading) {
      return;
    }

    setGoogleLoading(true);

    /*
     * Remember that the customer was checking out.
     * The cart itself is already preserved separately.
     */
    sessionStorage.setItem(
      CUSTOMER_RESUME_PAGE_STORAGE_KEY,
      "checkout",
    );

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            `${window.location.origin}/customer`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

    if (error) {
      console.error(
        "Checkout Google sign-in failed:",
        error.message,
      );

      sessionStorage.removeItem(
        CUSTOMER_RESUME_PAGE_STORAGE_KEY,
      );

      setGoogleLoading(false);

      window.alert(
        `Google sign-in failed: ${error.message}`,
      );
    }
  };

  const handleContinueToPayment = async () => {
  if (placingOrder || orderCreationInFlightRef.current) {
    return;
  }

  const cleanName = fullName.trim();
  const cleanContact = contactNumber.trim();
  const cleanAddress = deliveryAddress.trim();

  if (!cleanName) {
    setDeliveryError(
      "Please enter your full name.",
    );
    return;
  }

  if (!cleanContact) {
    setDeliveryError(
      "Please enter your contact number.",
    );
    return;
  }

  if (!/^09\d{9}$/.test(cleanContact)) {
    setDeliveryError(
      "Enter an 11-digit Philippine mobile number starting with 09.",
    );
    return;
  }

  if (!cleanAddress) {
    setDeliveryError(
      "Please enter your delivery address.",
    );
    return;
  }

  if (!gcashMerchantConfig.isConfigured) {
    setDeliveryError(
      "GCash payment is temporarily unavailable. Please contact the store.",
    );
    return;
  }

  if (!isCustomerSignedIn) {
    setDeliveryError(
      "Please sign in before creating your order.",
    );
    return;
  }

  if (pendingPaymentSubmission?.order) {
    setDeliveryError(null);
    setStep("upload");
    return;
  }

  if (cart.length === 0) {
    setDeliveryError("Your cart is empty.");
    return;
  }

  setDeliveryError(null);
  setPlaceOrderError(null);
  setPlacingOrder(true);
  orderCreationInFlightRef.current = true;

  try {
    const rpcItems = cart.map((item) => ({
      id: item.id,
      qty: item.qty,
    }));

    const {
      data: orderData,
      error: orderError,
    } = await supabase.rpc(
      "place_customer_order",
      {
        p_customer_name: cleanName,
        p_contact_number: cleanContact,
        p_delivery_address: cleanAddress,
        p_landmark: landmark.trim() || null,
        p_items: rpcItems,
      },
    );

    if (orderError) {
      throw new Error(
        `Unable to place your order: ${orderError.message}`,
      );
    }

    const orderResult =
      Array.isArray(orderData) && orderData.length === 1
        ? orderData[0]
        : null;

    if (!orderResult) {
      throw new Error(
        "The order was submitted but no complete order information was returned.",
      );
    }

    const createdOrder = parsePlacedCustomerOrder(orderResult);

    setPendingPaymentSubmission({ order: createdOrder });
    setStep("upload");
  } catch (error) {
    console.error("Unable to create customer order:", error);

    setDeliveryError(
      error instanceof Error
        ? error.message
        : "Unable to create your order.",
    );
  } finally {
    orderCreationInFlightRef.current = false;
    setPlacingOrder(false);
  }
};

const handlePaymentProofChange = (
  event: React.ChangeEvent<HTMLInputElement>,
) => {
  if (pendingPaymentSubmission?.proofImagePath) {
    event.target.value = "";
    return;
  }

  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
  ];

  if (!allowedTypes.includes(file.type)) {
    setPaymentProof(null);

    setPaymentProofError(
      "Please select a JPG or PNG image.",
    );

    event.target.value = "";
    return;
  }

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    setPaymentProof(null);

    setPaymentProofError(
      "The payment screenshot must be 5 MB or smaller.",
    );

    event.target.value = "";
    return;
  }

  setPaymentProof(file);
  setPaymentProofError(null);
  setPlaceOrderError(null);
};

const handleRemovePaymentProof = () => {
  if (pendingPaymentSubmission?.proofImagePath) {
    return;
  }

  setPaymentProof(null);
  setPaymentProofError(null);
  setPlaceOrderError(null);

  if (paymentProofInputRef.current) {
    paymentProofInputRef.current.value = "";
  }
};

const handlePlaceOrder = async () => {
  if (placingOrder || placedOrder) {
    return;
  }

  setPlaceOrderError(null);

  const existingSubmission = pendingPaymentSubmission;

  if (!existingSubmission?.order) {
    setPlaceOrderError(
      "Create your order before submitting a GCash payment.",
    );
    return;
  }

  if (!isCustomerSignedIn) {
    setPlaceOrderError(
      `Order ${existingSubmission.order.order_number} exists, but your signed-in customer account could not be confirmed. Please sign in and retry this payment submission.`,
    );
    return;
  }

  const normalizedReference =
    gcashReferenceNumber.trim();

  if (!normalizedReference) {
    setGcashReferenceError(
      "Please enter the GCash reference number.",
    );
    return;
  }

  setGcashReferenceError(null);

  if (
    !paymentProof &&
    !pendingPaymentSubmission?.proofImagePath
  ) {
    setPaymentProofError(
      "Please select your GCash payment screenshot.",
    );
    return;
  }

  setPaymentProofError(null);

  setPlacingOrder(true);

  try {
    let submission = existingSubmission;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        `Order ${submission.order.order_number} was created, but your signed-in customer account could not be confirmed. Please sign in and retry this payment submission.`,
      );
    }

    let proofImagePath =
      submission.proofImagePath;

    if (!proofImagePath) {
      if (!paymentProof) {
        throw new Error(
          `Order ${submission.order.order_number} was created. Select your payment screenshot, then retry the payment submission.`,
        );
      }

      const proofExtension =
        getPaymentProofExtension(paymentProof);

      proofImagePath = [
        user.id,
        submission.order.order_id,
        `${crypto.randomUUID()}.${proofExtension}`,
      ].join("/");

      const { error: uploadError } =
        await supabase.storage
          .from("payment-proofs")
          .upload(
            proofImagePath,
            paymentProof,
            {
              cacheControl: "3600",
              contentType: paymentProof.type,
              upsert: false,
            },
          );

      if (uploadError) {
        throw new Error(
          `Order ${submission.order.order_number} was created, but the payment screenshot upload failed: ${uploadError.message}. Retry to continue with the same order.`,
        );
      }

      submission = {
        ...submission,
        proofImagePath,
      };

      setPendingPaymentSubmission(submission);
    }

    const {
      data: paymentData,
      error: paymentError,
    } = await supabase.rpc(
      "submit_customer_payment",
      {
        p_order_id:
          submission.order.order_id,
        p_gcash_reference_number:
          normalizedReference,
        p_proof_image_path:
          proofImagePath,
      },
    );

    if (paymentError) {
      throw new Error(
        `Order ${submission.order.order_number} and its screenshot were saved, but the payment submission failed: ${paymentError.message}. Retry to continue with the same order.`,
      );
    }

    const paymentResult =
      Array.isArray(paymentData) &&
      paymentData.length > 0
        ? paymentData[0] as SubmittedCustomerPayment
        : null;

    if (
      !paymentResult ||
      !paymentResult.payment_id ||
      paymentResult.order_id !==
        submission.order.order_id ||
      paymentResult.payment_method !== "gcash" ||
      paymentResult.status !== "pending" ||
      paymentResult.gcash_reference_number.trim().toLowerCase() !==
        normalizedReference.toLowerCase() ||
      paymentResult.proof_image_path !==
        proofImagePath ||
      !paymentResult.created_at ||
      Number(paymentResult.amount) !==
        submission.order.grand_total
    ) {
      throw new Error(
        `Order ${submission.order.order_number} was created, but the server returned an invalid payment confirmation. Retry to confirm the same order payment.`,
      );
    }

    setPlacedOrder(submission.order);
    setPendingPaymentSubmission(null);
    onOrderPlaced(submission.order.order_id);
  } catch (error) {
    console.error(
      "Unable to complete customer payment submission:",
      error,
    );

    setPlaceOrderError(
      error instanceof Error
        ? error.message
        : "Unable to complete your payment submission.",
    );
  } finally {
    setPlacingOrder(false);
  }
};

return (
  <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="checkout" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <div className="flex items-center gap-2 mb-5 sm:mb-6">
            <button onClick={() => onNav("cart")} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Cart</button>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-bold text-foreground">Checkout</span>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-5 sm:mb-8 overflow-x-auto pb-1">
            {[{ key: "login", label: "Sign In" }, { key: "details", label: "Delivery" }, { key: "upload", label: "Payment" }].map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${step === s.key ? "bg-primary text-primary-foreground" : i < ["login","details","upload"].indexOf(step) ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                  {s.label}
                </div>
                {i < 2 && <div className="h-px w-4 sm:w-8 bg-border flex-shrink-0" />}
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 sm:gap-6">
            <div className="lg:col-span-3">
              {step === "login" && (
                <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
                  <h2 className="font-bold text-foreground text-base mb-4">Sign In to Continue</h2>
                  <p className="text-sm text-muted-foreground mb-5">A Google account is required to place orders and track deliveries.</p>
                  <button type="button" onClick={handleCheckoutGoogleLogin} disabled={googleLoading} className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-white hover:bg-muted/60 text-sm font-semibold shadow-sm disabled:cursor-wait disabled:opacity-70">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    {googleLoading ? "Connecting to Google…" : "Continue with Google"}
                  </button>
                </div>
              )}
              {step === "details" && (
                <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
                  <h2 className="font-bold text-foreground text-base mb-4">Delivery Details</h2>
                  <div className="flex flex-col gap-3">
                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="checkout-full-name"
                        className="text-xs font-semibold text-foreground"
                      >
                        Full Name
                      </label>

                      <input
                        id="checkout-full-name"
                        type="text"
                        value={fullName}
                        onChange={(event) =>
                          setFullName(event.target.value)
                        }
                        placeholder={
                          profileLoading
                            ? "Loading customer name..."
                            : "Enter your full name"
                        }
                        disabled={profileLoading}
                        autoComplete="name"
                        className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:cursor-wait disabled:opacity-60"
                      />
                    </div>

                    {/* Contact Number */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="checkout-contact-number"
                        className="text-xs font-semibold text-foreground"
                      >
                        Contact Number
                      </label>

                      <input
                        id="checkout-contact-number"
                        type="tel"
                        value={contactNumber}
                        onChange={(event) =>
                          setContactNumber(event.target.value)
                        }
                        placeholder={
                          profileLoading
                            ? "Loading contact number..."
                            : "09XXXXXXXXX"
                        }
                        disabled={profileLoading}
                        autoComplete="tel"
                        inputMode="tel"
                        className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:cursor-wait disabled:opacity-60"
                      />
                    </div>

                    {/* Delivery Address */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="checkout-delivery-address"
                        className="text-xs font-semibold text-foreground"
                      >
                        Delivery Address
                      </label>

                      <input
                        id="checkout-delivery-address"
                        type="text"
                        value={deliveryAddress}
                        onChange={(event) =>
                          setDeliveryAddress(event.target.value)
                        }
                        placeholder="House no., street, barangay, city"
                        autoComplete="street-address"
                        className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
                      />
                    </div>

                    {/* Landmark */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="checkout-landmark"
                        className="text-xs font-semibold text-foreground"
                      >
                        Landmark
                        <span className="ml-1 font-normal text-muted-foreground">
                          (Optional)
                        </span>
                      </label>

                      <input
                        id="checkout-landmark"
                        type="text"
                        value={landmark}
                        onChange={(event) =>
                          setLandmark(event.target.value)
                        }
                        placeholder="e.g. Near Jollibee, blue gate"
                        className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
                      />
                    </div>
                  </div>
                  {deliveryError && (
  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
    <p className="text-xs font-semibold text-red-700">
      {deliveryError}
    </p>
  </div>
)}

<button
  type="button"
  onClick={() => {
    void handleContinueToPayment();
  }}
  disabled={placingOrder}
  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-amber-800 disabled:cursor-wait disabled:opacity-60"
>
  {placingOrder && (
    <Loader2 className="h-4 w-4 animate-spin" />
  )}
  {placingOrder
    ? "Creating Order…"
    : pendingPaymentSubmission?.order
      ? "Continue to Payment"
      : "Create Order & Continue to Payment"}
</button>
                </div>
              )}
              {step === "upload" &&
                pendingPaymentSubmission?.order &&
                gcashMerchantConfig.isConfigured && (
                <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
                  <h2 className="font-bold text-foreground text-base mb-1">Upload GCash Proof of Payment</h2>
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="font-mono text-sm font-extrabold text-amber-900">
                      Order {pendingPaymentSubmission.order.order_number}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-800">
                      Amount to pay: ₱{pendingPaymentSubmission.order.grand_total}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">Send your payment to:</p>
                  <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl mb-5">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">G</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">{gcashMerchantConfig.number}</p>
                      <p className="text-xs text-muted-foreground">{gcashMerchantConfig.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-700">₱{pendingPaymentSubmission.order.grand_total}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-col gap-1.5">
                    <label
                      htmlFor="checkout-gcash-reference"
                      className="text-xs font-semibold text-foreground"
                    >
                      GCash Reference Number
                    </label>

                    <input
                      id="checkout-gcash-reference"
                      type="text"
                      value={gcashReferenceNumber}
                      onChange={(event) => {
                        setGcashReferenceNumber(
                          event.target.value,
                        );
                        setGcashReferenceError(null);
                        setPlaceOrderError(null);
                      }}
                      placeholder="Enter the reference from your GCash receipt"
                      autoComplete="off"
                      disabled={placingOrder}
                      className="rounded-lg border border-border bg-input-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 disabled:cursor-wait disabled:opacity-60"
                    />

                    {gcashReferenceError && (
                      <p className="text-xs font-semibold text-red-700">
                        {gcashReferenceError}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <input
                      ref={paymentProofInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handlePaymentProofChange}
                      disabled={
                        placingOrder ||
                        Boolean(
                          pendingPaymentSubmission?.proofImagePath,
                        )
                      }
                      className="hidden"
                    />

                    {!paymentProof ? (
                      <button
                        type="button"
                        onClick={() =>
                          paymentProofInputRef.current?.click()
                        }
                        disabled={placingOrder}
                        className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary/40 hover:bg-primary/[0.02] disabled:cursor-wait disabled:opacity-60 sm:p-8"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground/50 sm:h-10 sm:w-10" />

                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground">
                            Upload Screenshot
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            PNG or JPG, maximum 5 MB
                          </p>
                        </div>
                      </button>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                            <Check className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-emerald-800">
                              {pendingPaymentSubmission?.proofImagePath
                                ? "Payment screenshot uploaded"
                                : "Payment screenshot selected"}
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-foreground">
                              {paymentProof.name}
                            </p>

                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {(paymentProof.size / 1024 / 1024).toFixed(
                                2,
                              )}{" "}
                              MB
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              paymentProofInputRef.current?.click()
                            }
                            disabled={
                              placingOrder ||
                              Boolean(
                                pendingPaymentSubmission?.proofImagePath,
                              )
                            }
                            className="min-h-10 flex-1 rounded-lg border border-border bg-white px-3 text-xs font-bold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Change
                          </button>

                          <button
                            type="button"
                            onClick={handleRemovePaymentProof}
                            disabled={
                              placingOrder ||
                              Boolean(
                                pendingPaymentSubmission?.proofImagePath,
                              )
                            }
                            className="min-h-10 flex-1 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {paymentProofError && (
                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                        <p className="text-xs font-semibold text-red-700">
                          {paymentProofError}
                        </p>
                      </div>
                    )}
                  </div>

                  {!placedOrder && (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-xs font-semibold text-amber-800">
                          Payment retries will continue against order {pendingPaymentSubmission.order.order_number} without creating another order.
                        </p>
                      </div>
                    )}

                  {placeOrderError && (
  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
    <p className="text-xs font-semibold text-red-700">
      {placeOrderError}
    </p>
  </div>
)}

{placedOrder ? (
  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
        <Check className="h-5 w-5" />
      </div>

      <div>
        <p className="text-sm font-bold text-emerald-800">
          Order created successfully
        </p>

        <p className="mt-1 font-mono text-base font-extrabold text-foreground">
          {placedOrder.order_number}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Total: ₱
          {placedOrder.grand_total}
        </p>
      </div>
    </div>
  </div>
) : (
  <button
    type="button"
    onClick={() => {
      void handlePlaceOrder();
    }}
    disabled={placingOrder}
    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-amber-800 disabled:cursor-wait disabled:opacity-60"
  >
    {placingOrder ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        {pendingPaymentSubmission
          ? "Submitting Payment…"
          : "Creating Order…"}
      </>
    ) : (
      placeOrderError
        ? "Retry Payment Submission"
        : "Submit Payment"
    )}
  </button>
)}
                </div>
              )}
              {step === "upload" &&
                (!pendingPaymentSubmission?.order ||
                  !gcashMerchantConfig.isConfigured) && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 sm:p-6">
                    <p className="text-sm font-bold text-red-800">
                      {!gcashMerchantConfig.isConfigured
                        ? "GCash payment is temporarily unavailable. Please contact the store."
                        : "No created order is available for this payment. Return to delivery details and create your order first."}
                    </p>
                  </div>
                )}
            </div>
            {/* Order summary sidebar */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-xl p-4 sm:p-5 lg:sticky lg:top-4">
                <p className="font-bold text-foreground mb-3 sm:mb-4">Your Order</p>
                <div className="flex flex-col gap-2 text-sm">
                  {cart.map((c) => (
                    <div key={c.id} className="flex justify-between">
                      <span className="text-muted-foreground truncate mr-2">{c.name} ×{c.qty}</span>
                      <span className="font-semibold flex-shrink-0">₱{c.price * c.qty}</span>
                    </div>
                  ))}
                  {pendingPaymentSubmission?.order ? (
                    <>
                      <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Subtotal</span><span>₱{pendingPaymentSubmission.order.subtotal}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>₱{pendingPaymentSubmission.order.delivery_fee}</span></div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span className="text-primary">₱{pendingPaymentSubmission.order.grand_total}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Estimated delivery fee</span><span>₱50</span></div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Estimated total</span><span className="text-primary">₱{subtotal + 50}</span></div>
                    </>
                  )}
                </div>
                {!pendingPaymentSubmission?.order && (
                  <p className="mt-3 text-[11px] leading-4 text-muted-foreground">The final delivery fee and total will be confirmed when your order is created.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CustomerTrackingOrderRow {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_type: string;
  grand_total: number | string;
  created_at: string;
}

interface CustomerTrackingHistoryRow {
  status: string;
  notes: string | null;
  created_at: string;
}

interface CustomerTrackingPaymentRow {
  payment_id: string;
  order_id: string;
  amount: number;
  payment_method: "gcash";
  gcash_reference_number: string;
  payment_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  rejection_notes: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

const CUSTOMER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidServerTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function parseCustomerTrackingPayment(
  value: unknown,
  expectedOrderId: string,
): CustomerTrackingPaymentRow {
  if (!value || typeof value !== "object") {
    throw new Error("The server returned an invalid payment record.");
  }

  const row = value as Record<string, unknown>;
  const amount = Number(row.amount);
  const paymentStatus = row.payment_status;
  const rejectionReason = row.rejection_reason;
  const rejectionNotes = row.rejection_notes;
  const rejectedAt = row.rejected_at;

  if (
    typeof row.payment_id !== "string" ||
    !CUSTOMER_UUID_PATTERN.test(row.payment_id) ||
    row.order_id !== expectedOrderId ||
    row.payment_method !== "gcash" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    typeof row.gcash_reference_number !== "string" ||
    row.gcash_reference_number.trim().length === 0 ||
    !["pending", "verified", "rejected"].includes(
      String(paymentStatus),
    ) ||
    (rejectionReason !== null &&
      typeof rejectionReason !== "string") ||
    (rejectionNotes !== null &&
      typeof rejectionNotes !== "string") ||
    (rejectedAt !== null && !isValidServerTimestamp(rejectedAt)) ||
    !isValidServerTimestamp(row.created_at) ||
    !isValidServerTimestamp(row.updated_at)
  ) {
    throw new Error("The server returned malformed payment data.");
  }

  if (
    paymentStatus === "rejected" &&
    (typeof rejectionReason !== "string" ||
      rejectionReason.trim().length === 0 ||
      !isValidServerTimestamp(rejectedAt))
  ) {
    throw new Error("The rejected payment record is incomplete.");
  }

  return {
    payment_id: row.payment_id,
    order_id: expectedOrderId,
    amount,
    payment_method: "gcash",
    gcash_reference_number: row.gcash_reference_number.trim(),
    payment_status: paymentStatus as CustomerTrackingPaymentRow["payment_status"],
    rejection_reason:
      typeof rejectionReason === "string"
        ? rejectionReason.trim()
        : null,
    rejection_notes:
      typeof rejectionNotes === "string" && rejectionNotes.trim()
        ? rejectionNotes.trim()
        : null,
    rejected_at: rejectedAt as string | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function fetchCustomerTrackingPayment(
  orderId: string,
): Promise<CustomerTrackingPaymentRow | null> {
  const { data, error } = await supabase.rpc(
    "get_customer_order_payment",
    { p_order_id: orderId },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid payment response.");
  }

  if (data.length === 0) {
    return null;
  }

  if (data.length !== 1) {
    throw new Error("The server returned multiple payments for one order.");
  }

  return parseCustomerTrackingPayment(data[0], orderId);
}

// ── Order Tracking ────────────────────────────────────────────────
function TrackingPage({
  cart,
  onNav,
  orderId,
}: {
  cart: CartItem[];
  onNav: (page: CustomerPage) => void;
  orderId: string | null;
}) {
  const [order, setOrder] =
    useState<CustomerTrackingOrderRow | null>(
      null,
    );

  const [statusHistory, setStatusHistory] =
    useState<CustomerTrackingHistoryRow[]>([]);

  const [payment, setPayment] =
    useState<CustomerTrackingPaymentRow | null>(null);

  const [resubmissionReference, setResubmissionReference] =
    useState("");

  const [resubmissionProof, setResubmissionProof] =
    useState<File | null>(null);

  const [resubmissionProofError, setResubmissionProofError] =
    useState<string | null>(null);

  const [resubmissionError, setResubmissionError] =
    useState<string | null>(null);

  const [resubmissionSuccess, setResubmissionSuccess] =
    useState<string | null>(null);

  const [resubmittingPayment, setResubmittingPayment] =
    useState(false);

  const [uploadedResubmission, setUploadedResubmission] =
    useState<{
      fileKey: string;
      proofImagePath: string;
    } | null>(null);

  const resubmissionProofInputRef =
    useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadTrackingOrder() {
      setLoading(true);
      setErrorMessage(null);

      let orderQuery = supabase
        .from("orders")
        .select(
          `
            id,
            order_number,
            current_status,
            fulfillment_type,
            grand_total,
            created_at
          `,
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (orderId) {
        orderQuery = supabase
          .from("orders")
          .select(
            `
              id,
              order_number,
              current_status,
              fulfillment_type,
              grand_total,
              created_at
            `,
          )
          .eq("id", orderId)
          .limit(1);
      }

      const {
        data: orderData,
        error: orderError,
      } = await orderQuery;

      if (!isMounted) {
        return;
      }

      if (orderError) {
        console.error(
          "Unable to load tracking order:",
          orderError,
        );

        setErrorMessage(
          orderError.message,
        );

        setLoading(false);
        return;
      }

      const orderRows =
        (orderData ??
          []) as CustomerTrackingOrderRow[];

      const selectedOrder =
        orderRows[0] ?? null;

      if (!selectedOrder) {
        setOrder(null);
        setStatusHistory([]);
        setPayment(null);
        setLoading(false);
        return;
      }

      const [
        historyResult,
        selectedPayment,
      ] = await Promise.all([
        supabase
          .from("order_status_history")
          .select(
            `
              status,
              notes,
              created_at
            `,
          )
          .eq(
            "order_id",
            selectedOrder.id,
          )
          .order("created_at", {
            ascending: true,
          }),
        fetchCustomerTrackingPayment(
          selectedOrder.id,
        ),
      ]);

      if (!isMounted) {
        return;
      }

      if (historyResult.error) {
        console.error(
          "Unable to load order status history:",
          historyResult.error,
        );

        setErrorMessage(
          historyResult.error.message,
        );

        setLoading(false);
        return;
      }

      setOrder(selectedOrder);

      setStatusHistory(
        (historyResult.data ??
          []) as CustomerTrackingHistoryRow[],
      );

      setPayment(selectedPayment);

      setLoading(false);
    }

    void loadTrackingOrder().catch((error) => {
      if (!isMounted) {
        return;
      }

      console.error(
        "Unable to load customer payment:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load payment details.",
      );
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [loadAttempt, orderId]);

  useEffect(() => {
  if (!order?.id) {
    return;
  }

  const trackedOrderId = order.id;

  const refreshOrder = async () => {
    const {
      data,
      error,
    } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_number,
          current_status,
          fulfillment_type,
          grand_total,
          created_at
        `,
      )
      .eq("id", trackedOrderId)
      .single<CustomerTrackingOrderRow>();

    if (error) {
      console.error(
        "Unable to refresh tracking order:",
        error,
      );
      return;
    }

    setOrder(data);
  };

  const refreshStatusHistory = async () => {
    const {
      data,
      error,
    } = await supabase
      .from("order_status_history")
      .select(
        `
          status,
          notes,
          created_at
        `,
      )
      .eq("order_id", trackedOrderId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Unable to refresh order status history:",
        error,
      );
      return;
    }

    setStatusHistory(
      (data ??
        []) as CustomerTrackingHistoryRow[],
    );
  };

  const refreshPayment = async () => {
    try {
      setPayment(
        await fetchCustomerTrackingPayment(
          trackedOrderId,
        ),
      );
    } catch (error) {
      console.error(
        "Unable to refresh tracked payment:",
        error,
      );
    }
  };

  const channel = supabase
    .channel(
      `customer-order-tracking-${trackedOrderId}`,
    )

    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${trackedOrderId}`,
      },
      () => {
        void refreshOrder();
        void refreshStatusHistory();
        void refreshPayment();
      },
    )

    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "order_status_history",
        filter: `order_id=eq.${trackedOrderId}`,
      },
      () => {
        void refreshOrder();
        void refreshStatusHistory();
        void refreshPayment();
      },
    )

    .subscribe((status, error) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.error(
          "Customer tracking realtime error:",
          status,
          error,
        );
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}, [order?.id]);

  useEffect(() => {
    setResubmissionReference("");
    setResubmissionProof(null);
    setResubmissionProofError(null);
    setResubmissionError(null);
    setResubmissionSuccess(null);
    setUploadedResubmission(null);

    if (resubmissionProofInputRef.current) {
      resubmissionProofInputRef.current.value = "";
    }
  }, [order?.id]);

  const handleResubmissionProofChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;

    setResubmissionProof(null);
    setResubmissionProofError(null);
    setResubmissionError(null);
    setResubmissionSuccess(null);
    setUploadedResubmission(null);

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setResubmissionProofError(
        "Upload a JPG or PNG payment screenshot.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResubmissionProofError(
        "The payment screenshot must not exceed 5 MB.",
      );
      event.target.value = "";
      return;
    }

    setResubmissionProof(file);
  };

  const handlePaymentResubmission = async () => {
    if (
      !order ||
      order.current_status !== "waiting_payment_verification" ||
      !payment ||
      payment.payment_status !== "rejected"
    ) {
      setResubmissionError(
        "This payment is no longer eligible for resubmission.",
      );
      return;
    }

    const normalizedReference = resubmissionReference.trim();

    setResubmissionError(null);
    setResubmissionSuccess(null);

    if (!normalizedReference) {
      setResubmissionError("Enter the GCash reference number.");
      return;
    }

    if (normalizedReference.length > 100) {
      setResubmissionError(
        "The GCash reference number must be 100 characters or fewer.",
      );
      return;
    }

    if (!resubmissionProof) {
      setResubmissionError("Upload the new GCash payment screenshot.");
      return;
    }

    setResubmittingPayment(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your signed-in customer account could not be confirmed. Sign in and try again.",
        );
      }

      const fileKey = [
        resubmissionProof.name,
        resubmissionProof.type,
        resubmissionProof.size,
        resubmissionProof.lastModified,
      ].join(":");

      let proofImagePath =
        uploadedResubmission?.fileKey === fileKey
          ? uploadedResubmission.proofImagePath
          : null;

      if (!proofImagePath) {
        proofImagePath = [
          user.id,
          order.id,
          `${crypto.randomUUID()}.${getPaymentProofExtension(
            resubmissionProof,
          )}`,
        ].join("/");

        const { error: uploadError } =
          await supabase.storage
            .from("payment-proofs")
            .upload(
              proofImagePath,
              resubmissionProof,
              {
                cacheControl: "3600",
                contentType: resubmissionProof.type,
                upsert: false,
              },
            );

        if (uploadError) {
          throw new Error(
            `The new payment screenshot could not be uploaded: ${uploadError.message}`,
          );
        }

        setUploadedResubmission({
          fileKey,
          proofImagePath,
        });
      }

      const { data: paymentData, error: paymentError } =
        await supabase.rpc(
          "submit_customer_payment",
          {
            p_order_id: order.id,
            p_gcash_reference_number: normalizedReference,
            p_proof_image_path: proofImagePath,
          },
        );

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      const paymentResult =
        Array.isArray(paymentData) && paymentData.length === 1
          ? (paymentData[0] as Partial<SubmittedCustomerPayment>)
          : null;

      if (
        !paymentResult ||
        paymentResult.payment_id !== payment.payment_id ||
        paymentResult.order_id !== order.id ||
        paymentResult.payment_method !== "gcash" ||
        paymentResult.status !== "pending" ||
        typeof paymentResult.gcash_reference_number !== "string" ||
        paymentResult.gcash_reference_number.trim() !==
          normalizedReference ||
        paymentResult.proof_image_path !== proofImagePath ||
        Number(paymentResult.amount) !== Number(order.grand_total) ||
        paymentResult.created_at !== payment.created_at
      ) {
        throw new Error(
          "The server returned an invalid payment resubmission confirmation.",
        );
      }

      const [
        refreshedOrderResult,
        refreshedHistoryResult,
        refreshedPayment,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(
            `
              id,
              order_number,
              current_status,
              fulfillment_type,
              grand_total,
              created_at
            `,
          )
          .eq("id", order.id)
          .single<CustomerTrackingOrderRow>(),
        supabase
          .from("order_status_history")
          .select(
            `
              status,
              notes,
              created_at
            `,
          )
          .eq("order_id", order.id)
          .order("created_at", { ascending: true }),
        fetchCustomerTrackingPayment(order.id),
      ]);

      if (refreshedOrderResult.error) {
        throw new Error(refreshedOrderResult.error.message);
      }

      if (refreshedHistoryResult.error) {
        throw new Error(refreshedHistoryResult.error.message);
      }

      if (
        !refreshedPayment ||
        refreshedPayment.payment_id !== payment.payment_id ||
        refreshedPayment.payment_status !== "pending" ||
        refreshedPayment.gcash_reference_number !== normalizedReference ||
        refreshedPayment.amount !== Number(order.grand_total)
      ) {
        throw new Error(
          "The refreshed payment does not confirm the pending resubmission.",
        );
      }

      setOrder(refreshedOrderResult.data);
      setStatusHistory(
        (refreshedHistoryResult.data ??
          []) as CustomerTrackingHistoryRow[],
      );
      setPayment(refreshedPayment);
      setResubmissionReference("");
      setResubmissionProof(null);
      setUploadedResubmission(null);
      setResubmissionSuccess(
        "Payment resubmitted and awaiting verification",
      );

      if (resubmissionProofInputRef.current) {
        resubmissionProofInputRef.current.value = "";
      }
    } catch (error) {
      console.error(
        "Unable to resubmit customer payment:",
        error,
      );

      setResubmissionError(
        error instanceof Error
          ? error.message
          : "Unable to resubmit the payment.",
      );
    } finally {
      setResubmittingPayment(false);
    }
  };

  const historyByStatus = new Map(
    statusHistory.map((history) => [
      history.status,
      history,
    ]),
  );

  const isCancelled =
    order?.current_status === "cancelled";

  const isRejected =
    order?.current_status === "rejected";

  const isCompleted =
    order?.current_status === "completed";

  const isDelivered =
  order?.current_status === "delivered";

  const paymentNeedsResubmission =
    order?.current_status ===
      "waiting_payment_verification" &&
    payment?.payment_status === "rejected";

  const formattedPlacedDate =
    order
      ? new Date(
          order.created_at,
        ).toLocaleString(
          "en-PH",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          },
        )
      : "";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CustNav
        cart={cart}
        onNav={onNav}
        currentPage="tracking"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
            <div>
              <h1 className="text-lg font-bold text-foreground sm:text-xl">
                Order Tracking
              </h1>

              <p className="mt-1 text-xs text-muted-foreground">
                Follow the current status of your order.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNav("history")}
              className="min-h-10 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
            >
              All Orders
            </button>
          </div>

          {loading && (
            <div className="flex min-h-60 items-center justify-center rounded-2xl border border-border bg-card">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />

                <p className="text-sm font-semibold text-muted-foreground">
                  Loading order…
                </p>
              </div>
            </div>
          )}

          {!loading && errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                Unable to load order
              </p>

              <p className="mt-1 text-xs text-red-600">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-4 min-h-10 rounded-xl border border-red-300 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading &&
            !errorMessage &&
            !order && (
              <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center">
                <MapPin className="mb-3 h-10 w-10 text-muted-foreground/30" />

                <p className="text-sm font-bold text-foreground">
                  No order to track
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Place an order first or choose one
                  from your order history.
                </p>

                <button
                  type="button"
                  onClick={() => onNav("history")}
                  className="mt-4 min-h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-amber-800"
                >
                  View Orders
                </button>
              </div>
            )}

          {!loading &&
            !errorMessage &&
            order && (
              <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 bg-primary px-4 py-4 sm:px-6 sm:py-5">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
                      Order #
                    </p>

                    <p className="font-mono text-xl font-extrabold text-primary-foreground">
                      {order.order_number}
                    </p>

                    <p className="mt-1 text-xs text-primary-foreground/60">
                      Placed · {formattedPlacedDate}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
                      Total
                    </p>

                    <p className="font-bold text-primary-foreground">
                      ₱
                      {Number(
                        order.grand_total,
                      ).toLocaleString(
                        "en-PH",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </p>

                    <p className="mt-1 text-xs capitalize text-primary-foreground/60">
                      {order.fulfillment_type.replace(
                        /_/g,
                        " ",
                      )}
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {resubmissionSuccess && (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />

                      <p className="text-sm font-bold text-emerald-800">
                        {resubmissionSuccess}
                      </p>
                    </div>
                  )}

                  {paymentNeedsResubmission && payment && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />

                        <div>
                          <p className="text-sm font-extrabold text-red-800">
                            Payment needs resubmission
                          </p>

                          <p className="mt-1 text-xs leading-5 text-red-700">
                            Confirm your GCash reference and upload a new payment screenshot for this same order.
                          </p>
                        </div>
                      </div>

                      <dl className="mt-4 grid gap-2 rounded-lg border border-red-100 bg-white/70 p-3 text-xs">
                        <div>
                          <dt className="font-bold text-muted-foreground">
                            Rejection reason
                          </dt>
                          <dd className="mt-0.5 font-semibold text-foreground">
                            {payment.rejection_reason}
                          </dd>
                        </div>

                        {payment.rejection_notes && (
                          <div>
                            <dt className="font-bold text-muted-foreground">
                              Cashier notes
                            </dt>
                            <dd className="mt-0.5 whitespace-pre-wrap text-foreground">
                              {payment.rejection_notes}
                            </dd>
                          </div>
                        )}
                      </dl>

                      <div className="mt-4 grid gap-4">
                      <label className="grid gap-1.5 text-xs font-bold text-foreground">
                        GCash reference
                        <input
                          type="text"
                          value={resubmissionReference}
                          maxLength={100}
                          disabled={resubmittingPayment}
                          onChange={(event) => {
                            setResubmissionReference(event.target.value);
                            setResubmissionError(null);
                            setResubmissionSuccess(null);
                          }}
                          placeholder="Enter the GCash reference number"
                          className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                        />
                      </label>

                        <div>
                          <p className="mb-1.5 text-xs font-bold text-foreground">
                            New payment proof
                          </p>

                          <input
                            ref={resubmissionProofInputRef}
                            type="file"
                            accept="image/jpeg,image/png"
                            disabled={resubmittingPayment}
                            onChange={handleResubmissionProofChange}
                            className="sr-only"
                          />

                          <button
                            type="button"
                            disabled={resubmittingPayment}
                            onClick={() =>
                              resubmissionProofInputRef.current?.click()
                            }
                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-red-300 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Upload className="h-4 w-4" />
                            {resubmissionProof
                              ? resubmissionProof.name
                              : "Choose JPG or PNG proof (max 5 MB)"}
                          </button>

                          {resubmissionProof && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {(resubmissionProof.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}

                          {resubmissionProofError && (
                            <p className="mt-1 text-xs font-semibold text-red-700">
                              {resubmissionProofError}
                            </p>
                          )}
                        </div>

                        {resubmissionError && (
                          <p className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700">
                            {resubmissionError}
                          </p>
                        )}

                        <button
                          type="button"
                          disabled={
                            resubmittingPayment ||
                            !resubmissionReference.trim() ||
                            !resubmissionProof ||
                            Boolean(resubmissionProofError)
                          }
                          onClick={() => void handlePaymentResubmission()}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resubmittingPayment && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {resubmittingPayment
                            ? "Resubmitting…"
                            : "Resubmit Payment"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Current status */}
                  {(isCancelled ||
                    isRejected) ? (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <X className="h-5 w-5 flex-shrink-0 text-red-600" />

                      <div>
                        <p className="text-sm font-bold text-red-800">
                          {isCancelled
                            ? "Order Cancelled"
                            : "Order Rejected"}
                        </p>

                        <p className="mt-0.5 text-xs text-red-600">
                          This order is no longer active.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      {isCompleted ? (
                        <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                      ) : (
                        <ChefHat className="h-5 w-5 flex-shrink-0 text-amber-600" />
                      )}

                      <div>
                        <p className="text-sm font-bold text-amber-800">
                          {isCompleted
                            ? "Order Completed"
                            : order.current_status
                                .split("_")
                                .map(
                                  (word) =>
                                    word
                                      .charAt(0)
                                      .toUpperCase() +
                                    word.slice(1),
                                )
                                .join(" ")}
                        </p>

                        <p className="mt-0.5 text-xs text-amber-600">
                          Current order status
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  {!isCancelled &&
                    !isRejected && (
                      <div>
                        {ORDER_STEPS.map(
                          (
                            trackingStep,
                            index,
                          ) => {
                            const history =
                              historyByStatus.get(
                                trackingStep.status,
                              );

                            const isCurrent =
                              order.current_status ===
                              trackingStep.status;

                            const wasReached =
                              Boolean(history);

                            const completedStep =
                              wasReached &&
                              !isCurrent;

                            const completedOrderStep =
                              (isCompleted || isDelivered) &&
                              trackingStep.status ===
                                "delivered";

                            return (
                              <div
                                key={
                                  trackingStep.status
                                }
                                className="flex items-start gap-3 sm:gap-4"
                              >
                                <div className="flex flex-col items-center">
                                  <div
                                    className={[
                                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 sm:h-8 sm:w-8",

                                      completedStep ||
                                      completedOrderStep
                                        ? "border-green-500 bg-green-500"
                                        : isCurrent
                                          ? "border-primary bg-primary"
                                          : "border-border bg-white",
                                    ].join(" ")}
                                  >
                                    {completedStep ||
                                    completedOrderStep ? (
                                      <Check className="h-3.5 w-3.5 text-white" />
                                    ) : isCurrent ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-foreground" />
                                    ) : null}
                                  </div>

                                  {index <
                                    ORDER_STEPS.length -
                                      1 && (
                                    <div
                                      className={`mt-1 h-7 w-0.5 ${
                                        completedStep
                                          ? "bg-green-400"
                                          : "bg-border"
                                      }`}
                                    />
                                  )}
                                </div>

                                <div className="min-w-0 pb-4">
                                  <p
                                    className={`text-xs font-semibold sm:text-sm ${
                                      wasReached ||
                                      isCurrent
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {
                                      trackingStep.label
                                    }
                                  </p>

                                  {history && (
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                      {new Date(
                                        history.created_at,
                                      ).toLocaleString(
                                        "en-PH",
                                        {
                                          month:
                                            "short",
                                          day: "numeric",
                                          hour:
                                            "numeric",
                                          minute:
                                            "2-digit",
                                        },
                                      )}
                                    </p>
                                  )}

                                {isCurrent && (
                                  <p className="mt-0.5 text-xs font-semibold text-primary">
                                    {completedOrderStep
                                      ? "Completed"
                                      : "In progress…"}
                                  </p>
                                )}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

// ── Order History ─────────────────────────────────────────────────
interface CustomerOrderHistoryItemRow {
  order_id: string;
  item_name: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
}

interface CustomerOrderHistoryRow {
  id: string;
  order_number: string;
  grand_total: number | string;
  current_status: string;
  created_at: string;
  items: CustomerOrderHistoryItemRow[];
}

function formatCustomerOrderStatus(
  status: string,
) {
  return status
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

// ── Order History ─────────────────────────────────────────────────
function HistoryPage({
  cart,
  onNav,
  onTrackOrder,
}: {
  cart: CartItem[];
  onNav: (page: CustomerPage) => void;
  onTrackOrder: (orderId: string) => void;
}) {
  const [orders, setOrders] =
    useState<CustomerOrderHistoryRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

async function loadCustomerOrders() {
  setLoading(true);
  setErrorMessage(null);

  const {
    data: orderData,
    error: ordersError,
  } = await supabase
    .from("orders")
    .select(
      `
        id,
        order_number,
        grand_total,
        current_status,
        created_at
      `,
    )
    .order("created_at", {
      ascending: false,
    });

  if (!isMounted) {
    return;
  }

  if (ordersError) {
    console.error(
      "Unable to load customer orders:",
      ordersError,
    );

    setErrorMessage(
      ordersError.message,
    );

    setLoading(false);
    return;
  }

  const orderRows =
    (orderData ?? []) as Omit<
      CustomerOrderHistoryRow,
      "items"
    >[];

  if (orderRows.length === 0) {
    setOrders([]);
    setLoading(false);
    return;
  }

  const orderIds = orderRows.map(
    (order) => order.id,
  );

  const {
    data: itemData,
    error: itemsError,
  } = await supabase
    .from("order_items")
    .select(
      `
        order_id,
        item_name,
        quantity,
        unit_price,
        line_total
      `,
    )
    .in("order_id", orderIds)
    .order("created_at", {
      ascending: true,
    });

  if (!isMounted) {
    return;
  }

  if (itemsError) {
    console.error(
      "Unable to load customer order items:",
      itemsError,
    );

    setErrorMessage(
      itemsError.message,
    );

    setLoading(false);
    return;
  }

  const itemRows =
    (itemData ??
      []) as CustomerOrderHistoryItemRow[];

  const itemsByOrder = new Map<
    string,
    CustomerOrderHistoryItemRow[]
  >();

  itemRows.forEach((item) => {
    const currentItems =
      itemsByOrder.get(item.order_id) ?? [];

    currentItems.push(item);

    itemsByOrder.set(
      item.order_id,
      currentItems,
    );
  });

  const ordersWithItems:
    CustomerOrderHistoryRow[] =
      orderRows.map((order) => ({
        ...order,
        items:
          itemsByOrder.get(order.id) ?? [],
      }));

  setOrders(ordersWithItems);
  setLoading(false);
}

    void loadCustomerOrders();

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CustNav
        cart={cart}
        onNav={onNav}
        currentPage="history"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-lg font-bold text-foreground sm:text-xl">
              Order History
            </h1>

            <p className="mt-1 text-xs text-muted-foreground">
              View your previous and current orders.
            </p>
          </div>

          {loading && (
            <div className="flex min-h-52 items-center justify-center rounded-xl border border-border bg-card">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />

                <p className="text-sm font-semibold text-muted-foreground">
                  Loading your orders…
                </p>
              </div>
            </div>
          )}

          {!loading && errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                Unable to load orders
              </p>

              <p className="mt-1 text-xs text-red-600">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-4 min-h-10 rounded-xl border border-red-300 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading &&
            !errorMessage &&
            orders.length === 0 && (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
                <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground/30" />

                <p className="text-sm font-bold text-foreground">
                  No orders yet
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Your completed and active orders will
                  appear here.
                </p>

                <button
                  type="button"
                  onClick={() => onNav("menu")}
                  className="mt-4 min-h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:bg-amber-800"
                >
                  Browse Menu
                </button>
              </div>
            )}

          {!loading &&
            !errorMessage &&
            orders.length > 0 && (
              <div className="flex flex-col gap-3">
                {orders.map((order) => {
                  const formattedDate =
                    new Date(
                      order.created_at,
                    ).toLocaleString(
                      "en-PH",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    );

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border border-border bg-card p-4 sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-extrabold text-primary">
                              {order.order_number}
                            </span>

                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-extrabold text-amber-700">
                              {formatCustomerOrderStatus(
                                order.current_status,
                              )}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {formattedDate}
                          </p>
                          <div className="mt-3 flex flex-col gap-1.5 border-t border-border/70 pt-3">
                          {order.items.map((item, index) => (
                            <div
                              key={`${item.order_id}-${index}`}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="min-w-0 truncate font-semibold text-foreground">
                                {item.item_name ?? "Menu item"}
                                <span className="ml-1 font-normal text-muted-foreground">
                                  ×{item.quantity}
                                </span>
                              </span>

                              <span className="flex-shrink-0 font-bold text-muted-foreground">
                                ₱
                                {Number(
                                  item.line_total,
                                ).toLocaleString(
                                  "en-PH",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                        </div>

                        <div className="flex-shrink-0 text-right">
                          <p className="text-base font-extrabold text-foreground sm:text-lg">
                            ₱
                            {Number(
                              order.grand_total,
                            ).toLocaleString(
                              "en-PH",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </p>
                          <button type="button"
                          onClick={() =>
                            onTrackOrder(order.id)
                          }
                          className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[10px] font-extrabold text-primary hover:bg-primary/5"
                        >
                          Track Order
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

interface CustomerProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  contact_number: string | null;
  avatar_url: string | null;
}

interface CustomerAccountData {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
}

// ── Profile ───────────────────────────────────────────────────────
function ProfilePage({
  
  cart,
  onNav,
}: {
  cart: CartItem[];
  onNav: (page: CustomerPage) => void;
}) {
  const [account, setAccount] =
    useState<CustomerAccountData | null>(null);

  const [phoneInput, setPhoneInput] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [saveMessage, setSaveMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentAccount() {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError || !user) {
        setErrorMessage(
          userError?.message ??
            "No authenticated account was found.",
        );

        setLoading(false);
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          `
            id,
            first_name,
            last_name,
            contact_number,
            avatar_url
          `,
        )
        .eq("id", user.id)
        .single<CustomerProfileData>();

      if (!isMounted) {
        return;
      }

      if (profileError || !profile) {
        setErrorMessage(
          profileError?.message ??
            "Your profile could not be loaded.",
        );

        setLoading(false);
        return;
      }

      const profileName = [
        profile.first_name,
        profile.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const googleName =
        typeof user.user_metadata?.full_name ===
        "string"
          ? user.user_metadata.full_name
          : "";

      const displayName =
        profileName ||
        googleName ||
        user.email?.split("@")[0] ||
        "Customer";

      const googleAvatar =
        typeof user.user_metadata?.avatar_url ===
        "string"
          ? user.user_metadata.avatar_url
          : typeof user.user_metadata?.picture ===
              "string"
            ? user.user_metadata.picture
            : null;

      const savedPhone =
        profile.contact_number ?? "";

      setAccount({
        fullName: displayName,
        email: user.email ?? "",
        phone: savedPhone,
        avatarUrl:
          profile.avatar_url ?? googleAvatar,
      });

      setPhoneInput(savedPhone);
      setLoading(false);
    }

    void loadCurrentAccount();

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  const handleSavePhone = async () => {
    if (saving) {
      return;
    }

    const cleanPhone =
      phoneInput.trim();

    setSaveError(null);
    setSaveMessage(null);

    if (!cleanPhone) {
      setSaveError(
        "Please enter your contact number.",
      );
      return;
    }

    if (!/^09\d{9}$/.test(cleanPhone)) {
      setSaveError(
        "Enter an 11-digit Philippine mobile number starting with 09.",
      );
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaveError(
        userError?.message ??
          "Unable to verify your account.",
      );

      setSaving(false);
      return;
    }

    const { error: updateError } =
      await supabase
        .from("profiles")
        .update({
          contact_number: cleanPhone,
        })
        .eq("id", user.id);

    if (updateError) {
      console.error(
        "Unable to update contact number:",
        updateError.message,
      );

      setSaveError(
        `Unable to save your contact number: ${updateError.message}`,
      );

      setSaving(false);
      return;
    }

    setAccount((currentAccount) => {
      if (!currentAccount) {
        return currentAccount;
      }

      return {
        ...currentAccount,
        phone: cleanPhone,
      };
    });

    setPhoneInput(cleanPhone);

    setSaveMessage(
      "Contact number saved successfully.",
    );

    setSaving(false);
  };

  const phoneChanged =
    account !== null &&
    phoneInput.trim() !== account.phone;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CustNav
        cart={cart}
        onNav={onNav}
        currentPage="profile"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-lg font-bold text-foreground sm:text-xl">
              My Profile
            </h1>

            <p className="mt-1 text-xs text-muted-foreground">
              Manage your customer contact information.
            </p>
          </div>

          <div className="mb-5 rounded-xl border border-border bg-card p-5 sm:p-6">
            {loading && (
              <div className="flex min-h-48 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />

                  <p className="text-sm font-semibold text-muted-foreground">
                    Loading your account…
                  </p>
                </div>
              </div>
            )}

            {!loading && errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  Unable to load profile
                </p>

                <p className="mt-1 text-xs text-red-600">
                  {errorMessage}
                </p>

                <button
                  type="button"
                  onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                  className="mt-4 min-h-10 rounded-xl border border-red-300 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Try Again
                </button>
              </div>
            )}

            {!loading && account && (
              <>
                {/* Account header */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 sm:h-16 sm:w-16">
                    {account.avatarUrl ? (
                      <ImageWithFallback
                        src={account.avatarUrl}
                        alt={`${account.fullName} profile`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground sm:text-lg">
                      {account.fullName}
                    </p>

                    <p className="truncate text-sm text-muted-foreground">
                      {account.email}
                    </p>

                    {account.phone && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {account.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Google account section */}
                <div className="mb-6">
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Google Account
                    </p>

                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Your name and email come from your
                      signed-in Google account.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="profile-name"
                        className="text-xs font-semibold text-foreground"
                      >
                        Full Name
                      </label>

                      <input
                        id="profile-name"
                        type="text"
                        value={account.fullName}
                        readOnly
                        className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="profile-email"
                        className="text-xs font-semibold text-foreground"
                      >
                        Email Address
                      </label>

                      <input
                        id="profile-email"
                        type="email"
                        value={account.email}
                        readOnly
                        className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Contact information */}
                <div className="pt-6">
                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Contact Information
                    </p>

                    <p className="mt-1 text-[11px] text-muted-foreground">
                      This number will be used for your
                      deliveries and future orders.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="profile-phone"
                      className="text-xs font-semibold text-foreground"
                    >
                      Contact Number
                    </label>

                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                      <input
                        id="profile-phone"
                        type="tel"
                        value={phoneInput}
                        onChange={(event) => {
                          const digits =
                            event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 11);

                          setPhoneInput(digits);
                          setSaveError(null);
                          setSaveMessage(null);
                        }}
                        placeholder="09XXXXXXXXX"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={11}
                        className="w-full rounded-lg border border-border bg-input-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                      />
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      Use an 11-digit Philippine mobile
                      number starting with 09.
                    </p>
                  </div>

                  {saveError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                      <p className="text-xs font-semibold text-red-700">
                        {saveError}
                      </p>
                    </div>
                  )}

                  {saveMessage && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <Check className="h-4 w-4 flex-shrink-0 text-emerald-700" />

                      <p className="text-xs font-semibold text-emerald-700">
                        {saveMessage}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      void handleSavePhone();
                    }}
                    disabled={
                      saving || !phoneChanged
                    }
                    className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root Customer App ─────────────────────────────────────────────
export function CustomerApp() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [databaseMenuItems, setDatabaseMenuItems] =
  useState<CustomerDatabaseMenuItem[]>([]);

  const [databaseMenuCategories, setDatabaseMenuCategories] =
  useState<DatabaseMenuCategory[]>([]);

  const [databaseMenuLoading, setDatabaseMenuLoading] =
  useState(true);

  const [databaseMenuError, setDatabaseMenuError] =
  useState<string | null>(null);
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
        ? parsedCart
        : [];
    } catch {
      return [];
    }
  },
);
  const [detailItem, setDetailItem] =
  useState<CustomerDatabaseMenuItem | null>(
    null,
  );
  const [ trackingOrderId, setTrackingOrderId, ] = useState<string | null>(null);
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
  useEffect(() => {
  let isMounted = true;

  async function loadDatabaseMenu() {
    setDatabaseMenuLoading(true);
    setDatabaseMenuError(null);

    const [
      { data: categories, error: categoriesError },
      { data: items, error: itemsError },
      { data: availability, error: availabilityError },
    ] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("id, name")
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
        .order("name"),

      supabase.rpc("get_menu_effective_availability"),
    ]);

    if (!isMounted) {
      return;
    }

    if (categoriesError) {
      console.error(
        "Unable to load menu categories:",
        categoriesError.message,
      );

      setDatabaseMenuError(
        categoriesError.message,
      );

      setDatabaseMenuLoading(false);
      return;
    }

    if (itemsError) {
      console.error(
        "Unable to load menu items:",
        itemsError.message,
      );

      setDatabaseMenuError(
        itemsError.message,
      );

      setDatabaseMenuLoading(false);
      return;
    }

    if (availabilityError) {
      console.error(
        "Unable to load effective menu availability:",
        availabilityError.message,
      );

      setDatabaseMenuError(
        availabilityError.message,
      );

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
      setDatabaseMenuError(message);
      setDatabaseMenuLoading(false);
      return;
    }

    const mappedItems: CustomerDatabaseMenuItem[] =
      itemRows.map((item) => ({
        id: item.id,
        name: item.name,
        desc: item.description ?? "",
        price: Number(item.price),
        category:
          categoryNameById.get(
            item.category_id,
          ) ?? "Other",
        available:
          effectiveAvailabilityByItemId.get(item.id) ?? false,
        imagePath: item.image_path,
      }));

    setDatabaseMenuItems(mappedItems);
    setDatabaseMenuLoading(false);

    console.log(
      "Supabase customer menu:",
      mappedItems,
    );
  }

  void loadDatabaseMenu();

  return () => {
    isMounted = false;
  };
}, [databaseMenuLoadAttempt]);

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
  setTrackingOrderId(orderId);
  setPage("tracking");
};
  const handleOrderPlaced = (
  orderId: string,
) => {
  setCart([]);
  setTrackingOrderId(orderId);
  setPage("tracking");
};

  const handleNavigation = (
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
      navigate("/auth?portal=customer");
      return;
    }
    if (nextPage === "tracking") {
  setTrackingOrderId(null);
  }

    if (nextPage === "menu" && page !== "menu-detail") {
      setSelectedMenuCategory("All");
    }

    setPage(nextPage);
  };
  const handleBrowseCategory = (category: string) => {
    setSelectedMenuCategory(category);
    setPage("menu");
  };
  const retryDatabaseMenu = () => {
    setDatabaseMenuLoadAttempt((attempt) => attempt + 1);
  };

  const addToCart = (
  item: CustomerDatabaseMenuItem,
) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id);
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
    setLastAdded(item.name);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setLastAdded(null), 2200);
  };

const setQty = (
  id: string,
  qty: number,
) =>
  setCart((prev) =>
    qty <= 0
      ? prev.filter(
          (cartItem) => cartItem.id !== id,
        )
      : prev.map((cartItem) =>
          cartItem.id === id
            ? {
                ...cartItem,
                qty,
              }
            : cartItem,
        ),
  );
  const viewDetail = (item: CustomerDatabaseMenuItem,) => { setDetailItem(item); setPage("menu-detail"); };

let pageContent: React.ReactNode;

if (page === "home") {
  pageContent = (
  <HomePage
    cart={cart}
    menuItems={databaseMenuItems}
    categories={databaseMenuCategories}
    menuLoading={databaseMenuLoading}
    menuError={databaseMenuError}
    onNav={handleNavigation}
    onBrowseCategory={handleBrowseCategory}
    onRetryMenu={retryDatabaseMenu}
    onAddToCart={addToCart}
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
    selectedCategory={selectedMenuCategory}
    onNav={handleNavigation}
    onCategoryChange={setSelectedMenuCategory}
    onRetryMenu={retryDatabaseMenu}
    onAddToCart={addToCart}
    onViewDetail={viewDetail}
  />
  );
} else if (
  page === "menu-detail" &&
  detailItem
) {
  pageContent = (
    <MenuDetailPage
      item={detailItem}
      cart={cart}
      onNav={handleNavigation}
      onAddToCart={addToCart}
    />
  );
} else if (page === "cart") {
  pageContent = (
    <CartPage
      cart={cart}
      onNav={handleNavigation}
      onQtyChange={setQty}
      onRemove={(id) =>
        setCart((items) =>
          items.filter(
            (item) => item.id !== id,
          ),
        )
      }
    />
  );
} else if (page === "checkout") {
  pageContent = (
  <CheckoutPage
    cart={cart}
    onNav={handleNavigation}
    onOrderPlaced={handleOrderPlaced}
  />
  );
} else if (page === "tracking") {
  pageContent = (
  <TrackingPage
    cart={cart}
    onNav={handleNavigation}
    orderId={trackingOrderId}
  />
  );
} else if (page === "history") {
  pageContent = (
  <HistoryPage
    cart={cart}
    onNav={handleNavigation}
    onTrackOrder={handleTrackOrder}
  />
  );
} else if (page === "profile") {
  pageContent = (
    <ProfilePage
      cart={cart}
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
      onNav={handleNavigation}
      onBrowseCategory={handleBrowseCategory}
      onRetryMenu={retryDatabaseMenu}
      onAddToCart={addToCart}
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
            className="pointer-events-none absolute bottom-5 left-1/2 z-50 flex w-[min(23rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-[#211914] px-4 py-3 text-white shadow-2xl shadow-black/30"
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
