import { useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Bike,
  Clock3,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { StaffLoginPage } from "./pages/StaffLoginPage";
import { CustomerLoginPage } from "./pages/CustomerLoginPage";
import { RiderLoginPage } from "./pages/RiderLoginPage";
import { ImageWithFallback } from "../../app/components/figma/ImageWithFallback";
import { useAuth } from "../../context/AuthContext";
import type { AccountRole, DemoAccount } from "../../data/authAccounts";
import rrjLogo from "../../imports/451655946_497836222754416_7005773426468078155_n__1_.jpg";
import rrjPhoto from "../../imports/484095755_660911096446927_9159573585999384791_n__1_.jpg";

type AuthScreen = "staff" | "customer" | "rider";

const SCREEN_TABS: {
  id: AuthScreen;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}[] = [
  { id: "staff", label: "Staff Portal", shortLabel: "Staff", icon: UsersRound },
  { id: "customer", label: "Order Online", shortLabel: "Order", icon: ShoppingBag },
  { id: "rider", label: "Rider Access", shortLabel: "Rider", icon: Bike },
];

export function AuthApp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [screen, setScreen] = useState<AuthScreen>("staff");

  const handleLoginSuccess = (role: AccountRole, account?: DemoAccount) => {
    if (account) login(account);
    navigate(`/${role}`);
  };

  return (
    <main className="auth-experience">
      <section className="auth-story" aria-label="About RRJ's Food-Haus">
        <ImageWithFallback
          src={rrjPhoto}
          alt="RRJ's Food-Haus outdoor dining area glowing with warm string lights at night"
          className="auth-story-image"
        />
        <div className="auth-story-shade" />
        <div className="auth-light-string" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <i key={index} style={{ "--bulb-index": index } as React.CSSProperties} />
          ))}
        </div>

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
              <p className="auth-brand-meta">Halal Filipino comfort food</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.65 }}
            className="auth-story-copy"
          >
            <div className="auth-open-pill">
              <span className="auth-open-dot" />
              Halal kitchen · Welcoming guests since 2021
            </div>
            <h1>Good food.<br />Better moments.</h1>
            <p>
              From the kitchen to your doorstep, every RRJ experience starts
              with care and ends around a shared table.
            </p>
            <div className="auth-story-facts">
              <span><Clock3 /> Freshly prepared</span>
              <span><Sparkles /> Made with care</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="auth-workspace" aria-label="Sign in to RRJ's Food-Haus">
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
              <span>Est. 2021</span>
            </div>
          </div>

          <div className="auth-secure-label">
            <ShieldCheck />
            Secure access
          </div>
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
                <StaffLoginPage onLoginSuccess={(role) => handleLoginSuccess(role)} />
              )}
              {screen === "customer" && (
                <CustomerLoginPage onLoginSuccess={(role) => handleLoginSuccess(role)} />
              )}
              {screen === "rider" && (
                <RiderLoginPage onLoginSuccess={(role) => handleLoginSuccess(role)} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="auth-workspace-footer">
          <span>© 2021–2026 RRJ's Food-Haus</span>
          <span>Privacy · Help</span>
        </footer>
      </section>
    </main>
  );
}
