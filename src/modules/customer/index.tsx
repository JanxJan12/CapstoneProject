import { supabase } from "@/lib/supabase";
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
  Star,
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
  onNav,
  onAddToCart,
}: {
  cart: CartItem[];
  menuItems: CustomerDatabaseMenuItem[];
  categories: DatabaseMenuCategory[];
  onNav: (page: CustomerPage) => void;
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
                    onClick={() => onNav("menu")}
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
            <div><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-primary/70">Guest favorites</p><h2 className="font-['Fraunces'] text-xl font-semibold text-foreground sm:text-2xl">Popular right now</h2></div>
            <button onClick={() => onNav("menu")} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-[10px] font-extrabold text-primary hover:bg-primary/5 sm:text-xs">View all <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {menuItems.filter((m) => m.available).slice(0, 4).map((item) => (
              <FoodCard key={item.id} item={item} onAdd={onAddToCart} />
            ))}
          </div>
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
  onNav,
  onAddToCart,
  onViewDetail,
}: {
  cart: CartItem[];
  menuItems: CustomerDatabaseMenuItem[];
  categories: DatabaseMenuCategory[];
  onNav: (page: CustomerPage) => void;
  onAddToCart: (
    item: CustomerDatabaseMenuItem,
  ) => void;
  onViewDetail: (
    item: CustomerDatabaseMenuItem,
  ) => void;
}) {
  const [cat, setCat]       = useState("All");
  const [search, setSearch] = useState("");
  const cats = [
  "All",
  ...categories.map(
    (category) => category.name,
  ),
];
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
          <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold text-muted-foreground sm:block">{filtered.length} dishes available</span>
        </div>
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
              <button key={c} onClick={() => setCat(c)}
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
            <button onClick={() => { setSearch(""); setCat("All"); }} className="mt-4 min-h-10 rounded-xl bg-[#211914] px-4 text-xs font-extrabold text-white">Clear filters</button>
          </div>
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
              <div className="flex items-center gap-1 mb-4 sm:mb-6">
                {[1,2,3,4,5].map((s) => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                <span className="text-xs text-muted-foreground ml-1">(128 orders)</span>
              </div>
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
                    <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Delivery Fee</span><span className="font-semibold">₱50</span></div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span className="text-primary">₱{subtotal + 50}</span></div>
                  </div>
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

  const [paymentProof, setPaymentProof] =
  useState<File | null>(null);

  const [paymentProofError, setPaymentProofError] =
  useState<string | null>(null);

  const paymentProofInputRef =
  useRef<HTMLInputElement | null>(null);

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

  const handleContinueToPayment = () => {
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
      "Please enter a valid Philippine mobile number, for example 09171234567.",
    );
    return;
  }

  if (!cleanAddress) {
    setDeliveryError(
      "Please enter your delivery address.",
    );
    return;
  }

  setDeliveryError(null);
  setStep("upload");
};

const handlePaymentProofChange = (
  event: React.ChangeEvent<HTMLInputElement>,
) => {
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
};

const handleRemovePaymentProof = () => {
  setPaymentProof(null);
  setPaymentProofError(null);

  if (paymentProofInputRef.current) {
    paymentProofInputRef.current.value = "";
  }
};

const handlePlaceOrder = async () => {
  if (placingOrder || placedOrder) {
    return;
  }

  setPlaceOrderError(null);

  if (!isCustomerSignedIn) {
    setPlaceOrderError(
      "Please sign in before placing your order.",
    );
    return;
  }

  if (cart.length === 0) {
    setPlaceOrderError(
      "Your cart is empty.",
    );
    return;
  }

  setPlacingOrder(true);

  const rpcItems = cart.map((item) => ({
    id: item.id,
    qty: item.qty,
  }));

  const {
    data,
    error,
  } = await supabase.rpc(
    "place_customer_order",
    {
      p_customer_name:
        fullName.trim(),

      p_contact_number:
        contactNumber.trim(),

      p_delivery_address:
        deliveryAddress.trim(),

      p_landmark:
        landmark.trim() || null,

      p_items: rpcItems,
    },
  );

  if (error) {
    console.error(
      "Unable to place customer order:",
      error,
    );

    setPlaceOrderError(
      `Unable to place your order: ${error.message}`,
    );

    setPlacingOrder(false);
    return;
  }

  const result =
    Array.isArray(data) &&
    data.length > 0
      ? data[0]
      : null;

  if (!result) {
    setPlaceOrderError(
      "The order was submitted but no order information was returned.",
    );

    setPlacingOrder(false);
    return;
  }

  const createdOrder: PlacedCustomerOrder = {
    order_id: result.order_id,
    order_number: result.order_number,
    subtotal: Number(result.subtotal),
    delivery_fee: Number(
      result.delivery_fee,
    ),
    grand_total: Number(
      result.grand_total,
    ),
    current_status:
      result.current_status,
  };

  console.log(
    "Customer order created:",
    createdOrder,
  );

setPlacedOrder(createdOrder);
setPlacingOrder(false);

onOrderPlaced(createdOrder.order_id);
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
  onClick={handleContinueToPayment}
  className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-amber-800"
>
  Continue to Payment
</button>
                </div>
              )}
              {step === "upload" && (
                <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
                  <h2 className="font-bold text-foreground text-base mb-1">Upload GCash Proof of Payment</h2>
                  <p className="text-sm text-muted-foreground mb-2">Send your payment to:</p>
                  <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl mb-5">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">G</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">09171234567</p>
                      <p className="text-xs text-muted-foreground">RRJ's Food-Haus</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-700">₱{subtotal + 50}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <input
                      ref={paymentProofInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handlePaymentProofChange}
                      className="hidden"
                    />

                    {!paymentProof ? (
                      <button
                        type="button"
                        onClick={() =>
                          paymentProofInputRef.current?.click()
                        }
                        className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary/40 hover:bg-primary/[0.02] sm:p-8"
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
                              Payment screenshot selected
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
                            className="min-h-10 flex-1 rounded-lg border border-border bg-white px-3 text-xs font-bold text-foreground hover:bg-muted"
                          >
                            Change
                          </button>

                          <button
                            type="button"
                            onClick={handleRemovePaymentProof}
                            className="min-h-10 flex-1 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 hover:bg-red-50"
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
        Creating Order…
      </>
    ) : (
      "Place Order"
    )}
  </button>
)}
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
                  <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Delivery</span><span>₱50</span></div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span className="text-primary">₱{subtotal + 50}</span></div>
                </div>
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

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

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
        setLoading(false);
        return;
      }

      const {
        data: historyData,
        error: historyError,
      } = await supabase
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
        });

      if (!isMounted) {
        return;
      }

      if (historyError) {
        console.error(
          "Unable to load order status history:",
          historyError,
        );

        setErrorMessage(
          historyError.message,
        );

        setLoading(false);
        return;
      }

      setOrder(selectedOrder);

      setStatusHistory(
        (historyData ??
          []) as CustomerTrackingHistoryRow[],
      );

      setLoading(false);
    }

    void loadTrackingOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

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
                              isCompleted &&
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
                                      In progress…
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
  }, []);

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
  }, []);

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
        "Please enter a valid Philippine mobile number, for example 09171234567.",
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

    const categoryRows =
      (categories ??
        []) as DatabaseMenuCategory[];
    
    setDatabaseMenuCategories(categoryRows);

    const itemRows =
      (items ?? []) as DatabaseMenuItem[];

    const categoryNameById = new Map(
      categoryRows.map((category) => [
        category.id,
        category.name,
      ]),
    );

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
        available: item.is_available,
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
}, []);

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

    setPage(nextPage);
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
    onNav={handleNavigation}
    onAddToCart={addToCart}
  />
  );
} else if (page === "menu") {
  pageContent = (
  <MenuPage
    cart={cart}
    menuItems={databaseMenuItems}
    categories={databaseMenuCategories}
    onNav={handleNavigation}
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
      onNav={handleNavigation}
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
