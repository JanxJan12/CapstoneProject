import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Bike, ShoppingBag, UsersRound } from "lucide-react";
import { StaffLoginPage } from "./pages/StaffLoginPage";
import { CustomerLoginPage } from "./pages/CustomerLoginPage";
import { RiderLoginPage } from "./pages/RiderLoginPage";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import { useAuth } from "@/app/providers/AuthProvider";
import type { AccountRole } from "../../data/accountRole";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";
import rrjPhoto from "@/assets/brand/rrj-restaurant.jpg";

type AuthScreen = "staff" | "customer" | "rider";

const SCREEN_TABS: {
  id: AuthScreen;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}[] = [
  { id: "staff", label: "Staff", shortLabel: "Staff", icon: UsersRound },
  {
    id: "customer",
    label: "Customer",
    shortLabel: "Customer",
    icon: ShoppingBag,
  },
  { id: "rider", label: "Rider", shortLabel: "Rider", icon: Bike },
];

export function AuthApp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading } = useAuth();
  const [screen, setScreen] = useState<AuthScreen>("staff");

  useEffect(() => {
    const portal = searchParams.get("portal");

    if (portal === "staff" || portal === "customer" || portal === "rider") {
      setScreen(portal);
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || !session) {
      return;
    }

    navigate(`/${session.role}`, {
      replace: true,
    });
  }, [loading, navigate, session]);

  const handleLoginSuccess = (role: AccountRole) => {
    navigate(`/${role}`);
  };

  return (
    <main className="auth-experience" data-portal={screen}>
      <section className="auth-story" aria-label="About RRJ's Food-Haus">
        <ImageWithFallback
          src={rrjPhoto}
          alt="RRJ's Food-Haus outdoor dining area glowing with warm string lights at night"
          className="auth-story-image"
        />
        <div className="auth-story-shade" />

        <div className="auth-story-content">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="auth-brand-lockup"
          >
            <div className="auth-logo-frame">
              <ImageWithFallback
                src={rrjLogo}
                alt="RRJ's Food-Haus logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="auth-brand-name">RRJ's Food-Haus</p>
              <p className="auth-brand-meta">
                {screen === "customer"
                  ? "Welcome to the table"
                  : "Staff & delivery access"}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.65 }}
            className="auth-story-copy"
          >
            <h2>
              {screen === "customer"
                ? "Your next meal starts here."
                : screen === "rider"
                  ? "Rider access"
                  : "Cashier & Manager access"}
            </h2>
            <p>
              {screen === "customer"
                ? "Explore the menu, choose your meal, and order when you’re ready."
                : screen === "rider"
                  ? "Use your approved rider account to open your delivery workspace."
                  : "Use your assigned staff account to open your workspace."}
            </p>
          </motion.div>
        </div>
      </section>

      <section
        className="auth-workspace"
        aria-label="Sign in to RRJ's Food-Haus"
      >
        <header className="auth-workspace-header">
          <div className="auth-mobile-brand">
            <div className="auth-mobile-logo">
              <ImageWithFallback
                src={rrjLogo}
                alt="RRJ's Food-Haus logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p>RRJ's Food-Haus</p>
              <span>Choose your sign-in below</span>
            </div>
          </div>

          <p className="auth-entry-context">
            {screen === "customer"
              ? "Order online"
              : screen === "rider"
                ? "Rider sign-in"
                : "Cashier & Manager sign-in"}
          </p>
        </header>

        <nav className="auth-portal-tabs" aria-label="Choose your portal">
          {SCREEN_TABS.map(({ id, label, shortLabel, icon: Icon }) => {
            const selected = screen === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setScreen(id)}
                aria-current={selected ? "page" : undefined}
              >
                {selected && (
                  <motion.span
                    layoutId="auth-active-portal"
                    className="auth-portal-active"
                    transition={{ type: "spring", stiffness: 410, damping: 34 }}
                  />
                )}
                <span className="auth-portal-label">
                  <Icon />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{shortLabel}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="auth-panel-scroll">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              initial={{ opacity: 0, x: 20, filter: "blur(3px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -16, filter: "blur(3px)" }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-full"
            >
              {screen === "staff" && (
                <StaffLoginPage
                  onLoginSuccess={(role) => handleLoginSuccess(role)}
                />
              )}
              {screen === "customer" && (
                <CustomerLoginPage
                  onLoginSuccess={(role) => handleLoginSuccess(role)}
                />
              )}
              {screen === "rider" && (
                <RiderLoginPage
                  onLoginSuccess={(role) => handleLoginSuccess(role)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="auth-workspace-footer">
          <span>RRJ's Food-Haus</span>
        </footer>
      </section>
    </main>
  );
}
