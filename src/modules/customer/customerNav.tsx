import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import { BadgeCheck, ChevronRight, ClipboardList, Home, Loader2, LogOut, Menu as MenuIcon, Search, ShoppingCart, User, X } from "lucide-react";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { parseCustomerViewSearch } from "./customerTrackingUrl";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";
import type { CartItem } from "./customerTypes";
import type { CustomerPage } from "./customerPageTypes";

const NAV_LINKS: { id: CustomerPage; label: string }[] = [
  { id: "home",     label: "Home"        },
  { id: "menu",     label: "Menu"        },
];

export function CustNav({
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
  const reduceMotion = useReducedMotion();
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const totalItems = cart.reduce(
    (sum, cartItem) => sum + cartItem.qty,
    0,
  );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMenuCloseButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        window.requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const closeMobileMenu = () => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => document.removeEventListener("keydown", handleEscape);
  }, [accountMenuOpen]);

  const handleMobileMenuKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== "Tab" || !mobileMenuRef.current) {
      return;
    }

    const focusableElements = Array.from(
      mobileMenuRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleSignOut = async (): Promise<void> => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setAccountMenuOpen(false);
    setMenuOpen(false);
    sessionStorage.removeItem("rrj_customer_tracking_return_v1");

    await logout();

    navigate("/auth?portal=customer", {
      replace: true,
    });
  };

  const handleSignIn = () => {
    const parsed = parseCustomerViewSearch(window.location.search);
    if (!parsed.invalid && parsed.view === "tracking") {
      sessionStorage.setItem("rrj_customer_tracking_return_v1", parsed.canonical);
    }
    navigate("/auth?portal=customer");
  };

  return (
    <header className="customer-nav sticky top-0 z-30 flex flex-shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-card px-3 py-2.5 sm:px-5 lg:px-6">
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

        <span className="block">
          <span className="block text-sm font-bold leading-none text-foreground">
            RRJ&apos;s Food-Haus
          </span>

          <span className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-800">
            <BadgeCheck className="h-3 w-3" />
            Halal kitchen
          </span>
        </span>
      </button>

      {/* Desktop navigation */}
      <nav className="customer-desktop-nav hidden min-w-0 items-center gap-4 md:flex" aria-label="Customer destinations">
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
            className={`min-h-10 border-b-2 px-1 text-sm font-semibold transition-colors ${
              currentPage === navItem.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
          aria-label={`Open cart${
            totalItems > 0
              ? `, ${totalItems} ${totalItems === 1 ? "item" : "items"}`
              : ""
          }`}
          aria-current={currentPage === "cart" || currentPage === "checkout" ? "page" : undefined}
          className={`customer-header-cart relative flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-extrabold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${currentPage === "cart" || currentPage === "checkout" ? "bg-foreground" : "bg-primary hover:bg-amber-800"}`}
        >
          <ShoppingCart className="h-4 w-4" />

          <span className="hidden sm:inline">
            Cart
          </span>

          {totalItems > 0 && (
            <motion.span
              key={totalItems}
              initial={reduceMotion ? false : { scale: 0.55 }}
              animate={{ scale: 1 }}
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1 text-xs font-black text-foreground ring-2 ring-white"
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
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-sm font-extrabold transition-colors ${
                accountMenuOpen
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4" />
              <span className="hidden lg:inline">Profile</span>
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
                    initial={
                      reduceMotion
                        ? false
                        : {
                            opacity: 0,
                            y: -6,
                            scale: 0.97,
                          }
                    }
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
                    transition={{ duration: reduceMotion ? 0 : 0.14 }}
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

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onNav("history");
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-foreground hover:bg-muted"
                    >
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      Orders
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
            className="hidden min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-extrabold text-foreground shadow-sm hover:border-primary/30 hover:bg-amber-50/40 sm:flex"
          >
            <User className="h-4 w-4 text-primary" />
            Sign In
          </button>
        )}

        {/* Mobile hamburger */}
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="customer-mobile-navigation"
          className="customer-mobile-menu-trigger flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white hover:bg-muted md:hidden"
        >
          <MenuIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 h-full w-full bg-black/45 backdrop-blur-sm"
              onClick={closeMobileMenu}
              tabIndex={-1}
            />

            <motion.div
              ref={mobileMenuRef}
              id="customer-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-mobile-nav-title"
              onKeyDown={handleMobileMenuKeyDown}
              initial={reduceMotion ? false : { x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      stiffness: 360,
                      damping: 34,
                    }
              }
              className="absolute right-0 top-0 flex h-full w-[min(19rem,86vw)] flex-col bg-foreground text-white shadow-2xl"
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
                    <span
                      id="customer-mobile-nav-title"
                      className="block text-sm font-bold"
                    >
                      RRJ&apos;s Food-Haus
                    </span>

                    <span className="text-xs font-bold text-emerald-300">
                      Halal kitchen
                    </span>
                  </div>
                </div>

                <button
                  ref={mobileMenuCloseButtonRef}
                  type="button"
                    onClick={closeMobileMenu}
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
                    aria-current={currentPage === navItem.id ? "page" : undefined}
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
                    aria-current={currentPage === "profile" || currentPage === "history" || currentPage === "tracking" ? "page" : undefined}
                    className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-left text-sm font-bold transition-colors ${
                      currentPage === "profile" || currentPage === "history" || currentPage === "tracking"
                        ? "bg-primary text-white"
                        : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    Profile

                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </button>
                )}
              </nav>

              {/* Mobile account action */}
              <div className="mt-auto border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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

                <p className="mt-4 text-xs leading-relaxed text-white/70">
                  Halal Filipino comfort food
                  <br />
                  Made with care since 2021.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <nav className="customer-mobile-bottom-nav md:hidden" aria-label="Customer destinations">
        <button type="button" onClick={() => onNav("home")} aria-current={currentPage === "home" ? "page" : undefined}><Home aria-hidden="true" /><span>Home</span></button>
        <button type="button" onClick={() => onNav("menu")} aria-current={currentPage === "menu" || currentPage === "menu-detail" ? "page" : undefined}><Search aria-hidden="true" /><span>Menu</span></button>
        <button type="button" onClick={() => onNav("cart")} aria-label={`Cart${totalItems > 0 ? `, ${totalItems} ${totalItems === 1 ? "item" : "items"}` : ""}`} aria-current={currentPage === "cart" || currentPage === "checkout" ? "page" : undefined}><ShoppingCart aria-hidden="true" /><span>Cart</span>{totalItems > 0 ? <span className="customer-bottom-cart-count" aria-hidden="true">{totalItems}</span> : null}</button>
        <button type="button" onClick={() => onNav("profile")} aria-current={currentPage === "profile" || currentPage === "history" || currentPage === "tracking" ? "page" : undefined}><User aria-hidden="true" /><span>Profile</span></button>
      </nav>
    </header>
  );
}

