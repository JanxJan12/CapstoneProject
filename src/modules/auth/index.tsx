  import { useCallback, useEffect, useState } from "react";
  import { useNavigate, useSearchParams } from "react-router";
  import { AnimatePresence, motion } from "motion/react";
  import { Bike, ShoppingBag, UsersRound } from "lucide-react";
  import { StaffLoginPage } from "./pages/StaffLoginPage";
  import { CustomerLoginPage } from "./pages/CustomerLoginPage";
  import { RiderLoginPage } from "./pages/RiderLoginPage";
  import { DemoPasswordLogin } from "./components/DemoPasswordLogin";
  import { ImageWithFallback } from "@/components/media/ImageWithFallback";
  import { useAuth } from "@/app/providers/AuthProvider";
  import type { AccountRole } from "../../data/accountRole";
  import rrjLogo from "@/assets/brand/rrj-logo.jpg";
  import rrjPhoto from "@/assets/brand/rrj-restaurant.jpg";

  import { RiderApplicationPage } from "./pages/RiderApplicationPage";
  import { RiderApplicationStatusPage } from "./pages/RiderApplicationStatusPage";
  import {
    getOwnRiderApplication,
    type RiderApplicationSummary,
  } from "./services/riderApplicationService";

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
    const [searchParams, setSearchParams] = useSearchParams();
    const {
    session,
    loading,
    authError,
    retrySession,
    logout, } = useAuth();
    const [screen, setScreen] = useState<AuthScreen>("staff");

    const [riderApplication, setRiderApplication] =
    useState<RiderApplicationSummary | null>(null);

  const [riderApplicationLoading, setRiderApplicationLoading] =
    useState(false);

  const [riderApplicationChecked, setRiderApplicationChecked] =
    useState(false);

  const [riderApplicationError, setRiderApplicationError] =
    useState<string | null>(null);

  const portal = searchParams.get("portal");

  const sessionId = session?.id ?? null;
  const sessionRole = session?.role ?? null;

  useEffect(() => {
    if (
      portal === "staff" ||
      portal === "customer" ||
      portal === "rider"
    ) {
      setScreen(portal);
    }
  }, [portal]);

  const loadRiderApplication = useCallback(async () => {
    if (!sessionId || sessionRole !== "customer") {
      return;
    }

    setRiderApplicationLoading(true);
    setRiderApplicationError(null);

    try {
      const application =
        await getOwnRiderApplication(sessionId);

      setRiderApplication(application);
    } catch (error) {
      setRiderApplicationError(
        error instanceof Error
          ? error.message
          : "Unable to check your rider application.",
      );
    } finally {
      setRiderApplicationLoading(false);
      setRiderApplicationChecked(true);
    }
  }, [sessionId, sessionRole]);

  useEffect(() => {
    if (loading || !sessionRole) {
      return;
    }

    if (
      portal === "rider" &&
      sessionRole === "customer"
    ) {
      return;
    }

    navigate(`/${sessionRole}`, {
      replace: true,
    });
  }, [
    loading,
    navigate,
    portal,
    sessionRole,
  ]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (
      portal !== "rider" ||
      !sessionId ||
      sessionRole !== "customer"
    ) {
      setRiderApplication(null);
      setRiderApplicationError(null);
      setRiderApplicationLoading(false);
      setRiderApplicationChecked(false);
      return;
    }

    void loadRiderApplication();
  }, [
    loadRiderApplication,
    loading,
    portal,
    sessionId,
    sessionRole,
  ]);

  const handleRiderSignOut = async () => {
    await logout();

    navigate("/auth?portal=rider", {
      replace: true,
    });
  };

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
                  onClick={() => {
                    setScreen(id);

                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.set("portal", id);

                    setSearchParams(nextParams, {
                      replace: true,
                    });
                  }}
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
            {import.meta.env.VITE_DEMO_MODE === "true" && <DemoPasswordLogin />}
            {import.meta.env.VITE_STAGE2_TEST_MODE === "true" &&
              import.meta.env.VITE_SUPABASE_URL === "http://127.0.0.1:49321" &&
              <DemoPasswordLogin mode="stage2" />}
            {authError && (
              <div
                role="alert"
                className="mx-auto mb-4 flex w-full max-w-[25rem] flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-left sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-red-800">
                    Account check failed
                  </p>

                  <p className="mt-1 text-sm leading-relaxed text-red-700">
                    {authError}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void retrySession();
                  }}
                  disabled={loading}
                  className="min-h-11 shrink-0 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Checking…" : "Try again"}
                </button>
              </div>
            )}

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
                  <>
                    {!session ? (
                      <RiderLoginPage
                        onLoginSuccess={(role) =>
                          handleLoginSuccess(role)
                        }
                      />
                    ) : session.role === "customer" ? (
                      !riderApplicationChecked ||
                      riderApplicationLoading ? (
                        <div className="auth-page-shell">
                          <div className="auth-form-card flex w-full max-w-[25rem] flex-col items-center rounded-xl p-8 text-center">
                            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />

                            <p className="mt-4 text-sm font-bold text-foreground">
                              Checking your rider application…
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Please wait while we check your account.
                            </p>
                          </div>
                        </div>
                      ) : riderApplicationError ? (
                        <div className="auth-page-shell">
                          <div className="auth-form-card w-full max-w-[25rem] rounded-xl p-6 sm:p-8">
                            <p className="text-sm font-bold text-red-700">
                              Unable to check rider application
                            </p>

                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              {riderApplicationError}
                            </p>

                            <button
                              type="button"
                              onClick={() => {
                                void loadRiderApplication();
                              }}
                              className="mt-5 min-h-[2.8rem] w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
                            >
                              Try again
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                void handleRiderSignOut();
                              }}
                              className="mt-2 min-h-[2.8rem] w-full rounded-xl border border-border px-4 text-sm font-bold text-foreground"
                            >
                              Sign out
                            </button>
                          </div>
                        </div>
                      ) : riderApplication ? (
                        <RiderApplicationStatusPage
                          status={riderApplication.approvalStatus}
                          onSignOut={() => {
                            void handleRiderSignOut();
                          }}
                        />
                      ) : (
                        <RiderApplicationPage
                          onSubmitted={() => {
                            void loadRiderApplication();
                          }}
                        />
                      )
                    ) : (
                      <div className="auth-page-shell">
                        <div className="auth-form-card flex w-full max-w-[25rem] flex-col items-center rounded-xl p-8 text-center">
                          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />

                          <p className="mt-4 text-sm font-bold text-foreground">
                            Opening your workspace…
                          </p>
                        </div>
                      </div>
                    )}
                  </>
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
