import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ShoppingCart, ArrowLeft, Plus, Minus, Upload,
  Check, Loader2, ChefHat, User, Phone,
  Search, Star, Menu as MenuIcon, X, BadgeCheck, ChevronRight,
  MapPin, Sparkles, Truck,
} from "lucide-react";
import { menuItems } from "../../data/mockData";
import type { MenuItem } from "../../types";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";
import rrjPhoto from "@/assets/brand/rrj-restaurant.jpg";

type CustomerPage =
  | "home" | "menu" | "menu-detail" | "cart" | "checkout"
  | "tracking" | "history" | "profile";

type CartItem = MenuItem & { qty: number };

const ORDER_STEPS = [
  "Waiting for Payment Verification", "Confirmed", "Preparing", "Ready",
  "Waiting for Rider", "Rider Accepted", "Picked Up", "Out for Delivery", "Delivered",
];

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

function MenuVisual({ item, large = false }: { item: MenuItem; large?: boolean }) {
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
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  onView?: (item: MenuItem) => void;
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
function CustNav({ cart, onNav, currentPage }: { cart: CartItem[]; onNav: (p: CustomerPage) => void; currentPage: CustomerPage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const totalItems = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <header className="customer-nav sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border/70 bg-card/85 px-4 py-2.5 shadow-[0_8px_30px_rgba(64,40,25,0.04)] backdrop-blur-xl sm:px-6">
      {/* Logo */}
      <button onClick={() => onNav("home")} className="flex min-h-11 flex-shrink-0 items-center gap-2.5 rounded-xl pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-900 shadow-md ring-1 ring-black/10">
          <ImageWithFallback src={rrjLogo} alt="RRJ's Food-Haus" className="w-full h-full object-contain" />
        </div>
        <span className="hidden sm:block">
          <span className="block font-['Fraunces'] text-sm font-bold leading-none text-foreground">RRJ's Food-Haus</span>
          <span className="mt-1 flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-emerald-700"><BadgeCheck className="h-2.5 w-2.5" /> Halal kitchen</span>
        </span>
      </button>

      {/* Desktop nav links */}
      <nav className="hidden items-center gap-1 rounded-xl border border-border/70 bg-background/60 p-1 md:flex">
        {NAV_LINKS.map((n) => (
          <button key={n.id} onClick={() => onNav(n.id)}
            aria-current={currentPage === n.id ? "page" : undefined}
            className={`min-h-9 rounded-lg px-3 text-[11px] font-extrabold transition-all ${currentPage === n.id ? "bg-[#211914] text-white shadow-sm" : "text-muted-foreground hover:bg-white hover:text-foreground"}`}>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => onNav("cart")} className="relative flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-extrabold text-primary-foreground shadow-md shadow-orange-900/10 hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Cart</span>
          {totalItems > 0 && (
            <motion.span
              key={totalItems}
              initial={{ scale: 0.55 }}
              animate={{ scale: 1 }}
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#211914] px-1 text-[9px] font-extrabold text-white ring-2 ring-white"
            >{totalItems}</motion.span>
          )}
        </button>
        <button onClick={() => onNav("profile")} aria-label="Open profile" className="hidden h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground sm:flex">
          <User className="w-4 h-4 text-muted-foreground" />
        </button>
        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(true)} aria-label="Open navigation" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white hover:bg-muted md:hidden">
          <MenuIcon className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 md:hidden">
            <button aria-label="Close navigation" className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="absolute right-0 top-0 flex h-full w-[min(19rem,86vw)] flex-col bg-[#1d1713] text-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 overflow-hidden rounded-xl bg-black ring-1 ring-white/15"><ImageWithFallback src={rrjLogo} alt="RRJ's Food-Haus" className="h-full w-full object-contain" /></div>
                  <div><span className="block font-['Fraunces'] text-sm font-bold">RRJ's Food-Haus</span><span className="text-[8px] font-extrabold uppercase tracking-widest text-emerald-300">Halal kitchen</span></div>
                </div>
                <button onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex flex-col gap-1 p-3">
                {NAV_LINKS.map((n) => (
                  <button key={n.id} onClick={() => { onNav(n.id); setMenuOpen(false); }}
                    className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-left text-sm font-bold transition-colors ${currentPage === n.id ? "bg-primary text-white" : "text-white/65 hover:bg-white/[0.07] hover:text-white"}`}>
                    {n.label}<ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                ))}
                <button onClick={() => { onNav("profile"); setMenuOpen(false); }}
                  className="flex min-h-12 items-center justify-between rounded-xl px-4 text-left text-sm font-bold text-white/65 hover:bg-white/[0.07] hover:text-white">
                  My Profile<ChevronRight className="h-4 w-4 opacity-50" />
                </button>
              </nav>
              <div className="mt-auto border-t border-white/10 p-4 text-[10px] leading-relaxed text-white/35">Halal Filipino comfort food<br />Made with care since 2021.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ── Home ──────────────────────────────────────────────────────────
function HomePage({ cart, onNav, onAddToCart }: { cart: CartItem[]; onNav: (p: CustomerPage) => void; onAddToCart: (i: MenuItem) => void }) {
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
            {["All", "Viands", "Soups", "Rice", "Vegetables", "Beverages"].map((cat) => (
              <button key={cat} onClick={() => onNav("menu")}
                className="group flex min-h-[5.8rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border/80 bg-card p-2 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg sm:min-h-[7rem] sm:gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-xl shadow-inner transition-transform group-hover:scale-110 group-hover:-rotate-3 sm:h-12 sm:w-12 sm:text-2xl ${CATEGORY_META[cat].gradient}`}>
                  <span aria-hidden="true">{CATEGORY_META[cat].emoji}</span>
                </div>
                <span className="text-[9px] font-extrabold text-foreground sm:text-xs">{cat}</span>
              </button>
            ))}
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
function MenuPage({ cart, onNav, onAddToCart, onViewDetail }: { cart: CartItem[]; onNav: (p: CustomerPage) => void; onAddToCart: (i: MenuItem) => void; onViewDetail: (i: MenuItem) => void }) {
  const [cat, setCat]       = useState("All");
  const [search, setSearch] = useState("");
  const cats    = ["All", "Viands", "Soups", "Rice", "Vegetables", "Beverages"];
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
function MenuDetailPage({ item, cart, onNav, onAddToCart }: { item: MenuItem; cart: CartItem[]; onNav: (p: CustomerPage) => void; onAddToCart: (i: MenuItem) => void }) {
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
function CartPage({ cart, onNav, onQtyChange, onRemove }: { cart: CartItem[]; onNav: (p: CustomerPage) => void; onQtyChange: (id: number, qty: number) => void; onRemove: (id: number) => void }) {
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

// ── Checkout ─────────────────────────────────────────────────────
function CheckoutPage({ cart, onNav }: { cart: CartItem[]; onNav: (p: CustomerPage) => void }) {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const [step, setStep] = useState<"login" | "details" | "upload">("login");

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
                  <button onClick={() => setStep("details")} className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-white hover:bg-muted/60 text-sm font-semibold shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </button>
                </div>
              )}
              {step === "details" && (
                <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
                  <h2 className="font-bold text-foreground text-base mb-4">Delivery Details</h2>
                  <div className="flex flex-col gap-3">
                    {[{ l: "Full Name", p: "Maria Santos" }, { l: "Contact Number", p: "09171234567" }, { l: "Delivery Address", p: "123 Main St., Manila" }, { l: "Landmark", p: "Near Jollibee, Blue Gate" }].map((f) => (
                      <div key={f.l} className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-foreground">{f.l}</label>
                        <input placeholder={f.p} className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/60" />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setStep("upload")} className="w-full mt-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-amber-800">Continue to Payment</button>
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
                  <div className="border-2 border-dashed border-border rounded-xl p-6 sm:p-8 flex flex-col items-center gap-3 hover:border-primary/40 cursor-pointer transition-colors mb-4">
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/50" />
                    <p className="font-semibold text-foreground text-sm">Upload Screenshot</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                  </div>
                  <button onClick={() => onNav("tracking")} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-amber-800">Place Order</button>
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

// ── Order Tracking ────────────────────────────────────────────────
function TrackingPage({ cart, onNav }: { cart: CartItem[]; onNav: (p: CustomerPage) => void }) {
  const currentStep = 2;
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="tracking" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
          <h1 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6">Order Tracking</h1>
          <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
            <div className="bg-primary px-4 sm:px-6 py-4 sm:py-5 flex items-start justify-between">
              <div>
                <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-wide mb-1">Order #</p>
                <p className="text-primary-foreground font-bold text-xl">ORD-1047</p>
                <p className="text-primary-foreground/60 text-xs mt-1">Placed · Jul 4, 2024 at 10:42 AM</p>
              </div>
              <div className="text-right">
                <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-wide mb-1">Est. Delivery</p>
                <p className="text-primary-foreground font-bold">30–45 min</p>
                <p className="text-primary-foreground/60 text-xs mt-1">₱220 · GCash</p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-5 sm:mb-6">
                <ChefHat className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Your order is being prepared</p>
                  <p className="text-xs text-amber-600 mt-0.5">Kitchen is working on your order</p>
                </div>
              </div>
              {ORDER_STEPS.map((s, i) => (
                <div key={s} className="flex items-start gap-3 sm:gap-4">
                  <div className="flex flex-col items-center">
                    <div className={["w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2",
                      i < currentStep  ? "bg-green-500 border-green-500"
                      : i === currentStep ? "bg-primary border-primary"
                      : "border-border bg-white"].join(" ")}>
                      {i < currentStep  ? <Check className="w-3.5 h-3.5 text-white" />
                      : i === currentStep ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
                      : null}
                    </div>
                    {i < ORDER_STEPS.length - 1 && <div className={`w-0.5 h-5 sm:h-6 mt-1 ${i < currentStep ? "bg-green-400" : "bg-border"}`} />}
                  </div>
                  <div className="pb-4 sm:pb-5">
                    <p className={`text-xs sm:text-sm font-semibold ${i <= currentStep ? "text-foreground" : "text-muted-foreground"}`}>{s}</p>
                    {i < currentStep  && <p className="text-xs text-green-600 mt-0.5">Completed</p>}
                    {i === currentStep && <p className="text-xs text-primary mt-0.5">In progress…</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Order History ─────────────────────────────────────────────────
function HistoryPage({ cart, onNav }: { cart: CartItem[]; onNav: (p: CustomerPage) => void }) {
  const orders = [
    { id: "ORD-1047", date: "Jul 4, 2024", items: "Crispy Beef Tadyang, White Rice", total: 220, status: "Preparing" },
    { id: "ORD-1039", date: "Jul 1, 2024", items: "Sinigang na Baka, White Rice ×2", total: 225, status: "Delivered" },
    { id: "ORD-1031", date: "Jun 28, 2024", items: "Kare-Kare, White Rice, Softdrinks", total: 240, status: "Delivered" },
    { id: "ORD-1022", date: "Jun 22, 2024", items: "Adobong Manok, Fried Rice", total: 165, status: "Delivered" },
  ];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="history" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8">
          <h1 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6">Order History</h1>
          <div className="flex flex-col gap-3">
            {orders.map((o) => (
              <div key={o.id} className="bg-card border border-border rounded-xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-sm font-bold text-primary">{o.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${o.status === "Delivered" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{o.status}</span>
                  </div>
                  <p className="text-sm text-foreground font-semibold truncate">{o.items}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base sm:text-lg font-bold text-foreground">₱{o.total}</p>
                  <button onClick={() => onNav("tracking")} className="text-xs font-semibold text-primary hover:underline mt-1 block">
                    {o.status === "Preparing" ? "Track →" : "Reorder →"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────
function ProfilePage({ cart, onNav }: { cart: CartItem[]; onNav: (p: CustomerPage) => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustNav cart={cart} onNav={onNav} currentPage="profile" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8">
          <h1 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6">My Profile</h1>
          <div className="bg-card border border-border rounded-xl p-5 sm:p-6 mb-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <User className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base sm:text-lg">Maria Santos</p>
                <p className="text-sm text-muted-foreground">maria.santos@gmail.com</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> 09171234567</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[{ l: "Full Name", v: "Maria Santos" }, { l: "Email", v: "maria.santos@gmail.com" }, { l: "Phone", v: "09171234567" }, { l: "Default Address", v: "123 Main St., Manila" }].map((f) => (
                <div key={f.l} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.l}</label>
                  <input defaultValue={f.v} className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50" />
                </div>
              ))}
              <button className="w-fit mt-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-amber-800">Save Changes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Root Customer App ─────────────────────────────────────────────
export function CustomerApp() {
  const [page, setPage]             = useState<CustomerPage>("home");
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [lastAdded, setLastAdded]   = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id);
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
    setLastAdded(item.name);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setLastAdded(null), 2200);
  };

  const setQty = (id: number, qty: number) =>
    setCart((prev) =>
      qty <= 0 ? prev.filter((c) => c.id !== id) : prev.map((c) => c.id === id ? { ...c, qty } : c)
    );

  const viewDetail = (item: MenuItem) => { setDetailItem(item); setPage("menu-detail"); };

  let pageContent: React.ReactNode;
  if (page === "home") pageContent = <HomePage cart={cart} onNav={setPage} onAddToCart={addToCart} />;
  else if (page === "menu") pageContent = <MenuPage cart={cart} onNav={setPage} onAddToCart={addToCart} onViewDetail={viewDetail} />;
  else if (page === "menu-detail" && detailItem) pageContent = <MenuDetailPage item={detailItem} cart={cart} onNav={setPage} onAddToCart={addToCart} />;
  else if (page === "cart") pageContent = <CartPage cart={cart} onNav={setPage} onQtyChange={setQty} onRemove={(id) => setCart((items) => items.filter((item) => item.id !== id))} />;
  else if (page === "checkout") pageContent = <CheckoutPage cart={cart} onNav={setPage} />;
  else if (page === "tracking") pageContent = <TrackingPage cart={cart} onNav={setPage} />;
  else if (page === "history") pageContent = <HistoryPage cart={cart} onNav={setPage} />;
  else if (page === "profile") pageContent = <ProfilePage cart={cart} onNav={setPage} />;
  else pageContent = <HomePage cart={cart} onNav={setPage} onAddToCart={addToCart} />;

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
