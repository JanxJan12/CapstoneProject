import {useEffect, useState } from "react";
import {
  UtensilsCrossed, Bike, LayoutDashboard, History, User,
  MapPin, Phone, Check, X, ArrowLeft, Upload, Camera,
 Navigation, ImageIcon, LogOut,
} from "lucide-react";

import {
  acceptRiderOffer,
  advanceRiderDelivery,
  completeRiderDelivery,
  fetchActiveRiderDelivery,
  fetchRiderDashboardStats,
  fetchRiderDeliveryHistory,
  fetchRiderOffers,
  fetchRiderProfile,
  fetchRiderProfileStats,
  rejectRiderOffer,
  uploadRiderDeliveryProof,
  type RiderActiveDelivery,
  type RiderDashboardStats,
  type RiderDeliveryHistoryItem,
  type RiderDeliveryRequest,
  type RiderProfile,
  type RiderProfileStats,
} from "./services/supabaseRiderService";

import { useAuth } from "@/app/providers/AuthProvider";

type RiderScreen =
  | "splash" | "login" | "home" | "requests" | "delivery-detail"
  | "nav-assist" | "update-status" | "upload-proof" | "history" | "profile";

type BottomTab = "home" | "deliveries" | "history" | "profile";
    
// ── Android phone shell ───────────────────────────────────────────
// On mobile (< md): full-screen, no chrome
// On desktop (>= md): phone frame centered on dark bg
function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rider-app flex h-full w-full items-center justify-center bg-background md:overflow-auto md:py-6">
      <div
        className="rider-phone flex h-full w-full flex-col overflow-hidden md:h-[720px] md:w-[360px] md:flex-shrink-0 md:rounded-[2.7rem] md:border-[7px] md:border-[#17110e] md:shadow-[0_42px_90px_-32px_rgba(18,10,5,0.8)]"
      >
        {/* Status bar — desktop phone chrome only */}
        <div className="hidden md:flex items-center justify-between px-5 pt-3 pb-1 bg-zinc-900 flex-shrink-0">
          <span className="text-white text-[10px] font-semibold">9:41</span>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 items-end">
              {[3, 5, 7, 9].map((h, i) => (
                <div key={i} className={`w-1 rounded-sm ${i < 3 ? "bg-white" : "bg-white/40"}`} style={{ height: h }} />
              ))}
            </div>
            <div className="w-5 h-2.5 rounded-sm border border-white/60 flex items-center px-0.5 ml-1">
              <div className="h-1.5 bg-green-400 rounded-xs" style={{ width: "70%" }} />
            </div>
          </div>
        </div>
        {/* Screen content */}
        <div className="rider-screen flex flex-1 flex-col overflow-hidden bg-background">
          {children}
        </div>
        {/* Home indicator — desktop only */}
        <div className="hidden md:flex bg-background items-center justify-center py-2 flex-shrink-0">
          <div className="w-24 h-1 bg-zinc-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ── Bottom navigation ─────────────────────────────────────────────
function BottomNav({ active, onSelect }: { active: BottomTab; onSelect: (t: BottomTab) => void }) {
  const tabs: { id: BottomTab; label: string; icon: React.ElementType }[] = [
    { id: "home",       label: "Home",       icon: LayoutDashboard },
    { id: "deliveries", label: "Deliveries", icon: Bike },
    { id: "history",    label: "History",    icon: History },
    { id: "profile",    label: "Profile",    icon: User },
  ];
  return (
    <div className="rider-bottom-nav flex flex-shrink-0 border-t border-border bg-white/95 backdrop-blur-xl">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${active === t.id ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon className="w-5 h-5" strokeWidth={active === t.id ? 2.5 : 1.8} />
            <span className="text-[9px] font-semibold">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Splash ────────────────────────────────────────────────────────
function SplashScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="rider-splash relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-primary px-8">
      <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center">
        <UtensilsCrossed className="w-10 h-10 text-white" strokeWidth={2} />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-2xl">RRJ Rider</p>
        <p className="text-white/60 text-xs mt-1 uppercase tracking-widest">Delivery App</p>
      </div>
      <button
        onClick={onNext}
        className="mt-4 w-full py-3 rounded-xl bg-white text-primary font-bold text-sm hover:bg-primary/5"
      >
        Get Started
      </button>
      <p className="text-white/40 text-[9px] absolute bottom-6">v1.0.0 · RRJ Food-House</p>
    </div>
  );
}

// ── Login ────────────────────────────────────────────────────────
function LoginScreen({ onNext }: { onNext: () => void }) {
  const [email, setEmail]   = useState("ramil.abad@rrj.com");
  const [password, setPassword] = useState("password");
  return (
    <>
      <div className="bg-primary px-5 pt-7 pb-10 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">RRJ Rider</div>
            <div className="text-white/60 text-[9px] font-semibold uppercase tracking-widest mt-0.5">Delivery App</div>
          </div>
        </div>
        <h2 className="text-white text-xl font-bold">Sign in to manage<br />your deliveries</h2>
        <p className="text-white/60 text-[10px] mt-1">Authorized delivery partners only.</p>
      </div>
      <div className="bg-card -mt-5 rounded-t-3xl flex-1 px-5 pt-5 pb-4 overflow-y-auto">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1"><label className="text-xs font-semibold">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50" /></div>
          <div className="flex flex-col gap-1"><label className="text-xs font-semibold">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2.5 text-sm bg-input-background border border-border rounded-lg focus:outline-none focus:border-primary/50" /></div>
          <div className="flex justify-end"><button className="text-xs font-semibold text-primary">Forgot password?</button></div>
          <button onClick={onNext} style={{ minHeight: 44 }} className="w-full flex items-center justify-center rounded-xl bg-primary text-white font-bold text-sm hover:bg-amber-800">Sign In</button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-5">Need access? Please contact RRJ Food-House management.</p>
      </div>
    </>
  );
}

// ── Home Tab ─────────────────────────────────────────────────────
function HomeTab({ onNav }: { onNav: (s: RiderScreen) => void }) {
  const { session } = useAuth();

  const riderName =
    session?.name?.trim() || "Rider";

  const riderInitial =
    riderName.charAt(0).toUpperCase();

  const [riderProfile, setRiderProfile] =
  useState<RiderProfile | null>(null);

  const [dashboardStats, setDashboardStats] =
  useState<RiderDashboardStats | null>(null);

  const [offerCount, setOfferCount] = useState(0);
  
  const [activeDelivery, setActiveDelivery] =
    useState<RiderActiveDelivery | null>(null);

  const [activeDeliveryLoading, setActiveDeliveryLoading] =
    useState(true);

  const [activeDeliveryError, setActiveDeliveryError] =
    useState("");

    useEffect(() => {
    let active = true;

    const loadActiveDelivery = async () => {
      setActiveDeliveryLoading(true);
      setActiveDeliveryError("");

      try {
        const [
          delivery,
          offers,
          profile,
          stats,
        ] = await Promise.all([
          fetchActiveRiderDelivery(),
          fetchRiderOffers(),
          fetchRiderProfile(),
          fetchRiderDashboardStats(),
        ]);
        if (active) {
          setActiveDelivery(delivery);
          setOfferCount(offers.length);
          setRiderProfile(profile);
          setDashboardStats(stats);
        }
      } catch (caught) {
        if (active) {
          setActiveDeliveryError(
            caught instanceof Error
              ? caught.message
              : "Unable to load active delivery.",
          );
        }
      } finally {
        if (active) {
          setActiveDeliveryLoading(false);
        }
      }
    };

    void loadActiveDelivery();

    return () => {
      active = false;
    };
  }, []);

  const isAvailable =
  riderProfile?.availabilityStatus === "available";

  const availabilityLabel =
  riderProfile?.availabilityStatus === "on_delivery"
    ? "Currently on a delivery"
    : riderProfile?.availabilityStatus === "offline"
      ? "Not accepting deliveries"
      : "Accepting deliveries";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 pt-4 pb-8 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white/60 text-[8px] font-semibold uppercase tracking-wide">
            Good morning,
          </p>

          <p className="text-white font-bold text-sm">
            {riderName}
          </p>
        </div>

        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {riderInitial}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white/15 rounded-xl px-4 py-3">
        <div>
          <p className="text-white text-xs font-bold">
            Availability
          </p>

          <p className="text-white/60 text-[9px]">
            {availabilityLabel}
          </p>
        </div>

        <div
          className={`w-12 h-6 rounded-full relative ${
            isAvailable
              ? "bg-green-400"
              : "bg-white/30"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow ${
              isAvailable
                ? "left-6"
                : "left-0.5"
            }`}
          />
        </div>
      </div>
      </div>
      <div className="-mt-4 rounded-t-2xl bg-background flex-1 overflow-y-auto px-4 pt-4">
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[9px] text-muted-foreground mb-0.5">
            Deliveries Today
          </p>

          <p className="text-xl font-bold text-primary">
            {dashboardStats?.deliveriesToday ?? "—"}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-[9px] text-muted-foreground mb-0.5">
            Completed
          </p>

          <p className="text-xl font-bold text-green-600">
            {dashboardStats?.completedToday ?? "—"}
          </p>
        </div>
      </div>
      <p className="text-xs font-bold text-foreground mb-2">
        Active Delivery
      </p>

      {activeDeliveryLoading && (
        <div className="w-full bg-card rounded-xl border border-border p-4 mb-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            Loading active delivery…
          </p>
        </div>
      )}

      {!activeDeliveryLoading && activeDeliveryError && (
        <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-[10px] font-semibold text-red-700">
            {activeDeliveryError}
          </p>
        </div>
      )}

      {!activeDeliveryLoading &&
        !activeDeliveryError &&
        !activeDelivery && (
          <div className="w-full bg-card rounded-xl border border-border p-4 mb-4 text-center">
            <Bike className="w-6 h-6 mx-auto text-muted-foreground/50 mb-1" />

            <p className="text-[10px] font-semibold">
              No active delivery
            </p>

            <p className="text-[9px] text-muted-foreground mt-1">
              Accepted deliveries will appear here.
            </p>
          </div>
        )}

      {!activeDeliveryLoading &&
        !activeDeliveryError &&
        activeDelivery && (
          <button
            onClick={() => onNav("delivery-detail")}
            className="w-full bg-card rounded-xl border border-border p-3 text-left mb-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex justify-between mb-1.5">
              <span className="font-mono text-[9px] font-bold text-primary">
                {activeDelivery.orderNumber}
              </span>

              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700">
                {activeDelivery.assignmentStatus === "accepted"
                  ? "Rider Accepted"
                  : activeDelivery.assignmentStatus === "picked_up"
                    ? "Picked Up"
                    : "Out for Delivery"}
              </span>
            </div>

            <p className="text-xs font-semibold mb-1">
              {activeDelivery.customerName}
            </p>

            <div className="flex items-start gap-1 text-[9px] text-muted-foreground mb-2">
              <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

              <span>
                {activeDelivery.deliveryAddress}
              </span>
            </div>

            <div className="w-full py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold text-center">
              View Delivery
            </div>
          </button>
        )}
        {isAvailable && offerCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-amber-800 mb-1">
              {offerCount} new{" "}
              {offerCount === 1
                ? "delivery request"
                : "delivery requests"}
            </p>

            <button
              onClick={() => onNav("requests")}
              className="text-[10px] font-semibold text-primary"
            >
              View Request →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delivery Requests ────────────────────────────────────────────

function DeliveryRequestsTab() {
  const [offers, setOffers] =
    useState<RiderDeliveryRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [acceptingId, setAcceptingId] =
    useState<string | null>(null);

  const [rejectingId, setRejectingId] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadOffers = async () => {
      setLoading(true);
      setError("");

      try {
        const nextOffers =
          await fetchRiderOffers();

        if (active) {
          setOffers(nextOffers);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load delivery requests.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadOffers();

    return () => {
      active = false;
    };
  }, []);

  const handleAccept = async (
    assignmentId: string,
  ) => {
    if (acceptingId || rejectingId) {
      return;
    }

    setAcceptingId(assignmentId);
    setError("");

    try {
      await acceptRiderOffer(
        assignmentId,
      );

      const nextOffers =
        await fetchRiderOffers();

      setOffers(nextOffers);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to accept the delivery.",
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (
    assignmentId: string,
  ) => {
    if (acceptingId || rejectingId) {
      return;
    }

    const confirmed = window.confirm(
      "Reject this delivery request?",
    );

    if (!confirmed) {
      return;
    }

    setRejectingId(assignmentId);
    setError("");

    try {
      await rejectRiderOffer(
        assignmentId,
      );

      const nextOffers =
        await fetchRiderOffers();

      setOffers(nextOffers);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to reject the delivery.",
      );
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex-shrink-0">
        <p className="text-white font-bold">
          Delivery Requests
        </p>

        <p className="text-white/60 text-[9px]">
          Orders currently offered to you
        </p>
      </div>

      <div className="-mt-3 rounded-t-2xl bg-background flex-1 px-4 pt-4 overflow-y-auto">
        {loading && (
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-[10px] text-muted-foreground">
              Loading delivery requests…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          offers.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <Bike className="mx-auto h-7 w-7 text-muted-foreground/50" />

              <p className="mt-2 text-xs font-bold">
                No delivery requests
              </p>

              <p className="mt-1 text-[9px] text-muted-foreground">
                New assigned deliveries will appear
                here.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          offers.map((offer) => (
            <div
              key={offer.assignmentId}
              className="bg-card rounded-xl border border-border p-3 mb-3"
            >
              <div className="flex justify-between mb-2">
                <span className="font-mono text-[9px] font-bold text-primary">
                  {offer.orderNumber}
                </span>

                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">
                  Offered
                </span>
              </div>

              <p className="text-xs font-bold mb-2">
                {offer.customerName} ·{" "}
                {offer.contactNumber}
              </p>

              <div className="flex flex-col gap-1.5 mb-2.5">
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground">
                  <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

                  <span>
                    <span className="font-semibold text-foreground">
                      Deliver to:
                    </span>{" "}
                    {offer.deliveryAddress}
                  </span>
                </div>

                {offer.landmark && (
                  <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground">
                    <Navigation className="w-3 h-3 mt-0.5 flex-shrink-0" />

                    <span>
                      Landmark: {offer.landmark}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-muted/60 rounded-lg p-2 mb-3">
                <p className="text-[8px] font-bold text-muted-foreground mb-1">
                  ORDER ITEMS
                </p>

                {offer.items.map((item) => (
                  <p
                    key={item.id}
                    className="text-[9px]"
                  >
                    {item.quantity} × {item.name}
                  </p>
                ))}

                <div className="mt-2 border-t border-border pt-2 flex justify-between text-[9px]">
                  <span className="text-muted-foreground">
                    Delivery fee
                  </span>

                  <span className="font-bold">
                    ₱
                    {offer.deliveryFee.toFixed(
                      2,
                    )}
                  </span>
                </div>

                <div className="mt-1 flex justify-between text-[10px] font-bold">
                  <span>Total</span>

                  <span className="text-primary">
                    ₱
                    {offer.total.toFixed(
                      2,
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={
                    acceptingId !== null ||
                    rejectingId !== null
                  }
                  onClick={() => {
                    void handleAccept(
                      offer.assignmentId,
                    );
                  }}
                  className="py-2.5 rounded-xl bg-primary text-white text-[10px] font-bold flex items-center justify-center gap-1 disabled:opacity-60"
                >
                  <Check className="w-3 h-3" />

                  {acceptingId ===
                  offer.assignmentId
                    ? "Accepting…"
                    : "Accept"}
                </button>

                <button
                  type="button"
                  disabled={
                    acceptingId !== null ||
                    rejectingId !== null
                  }
                  onClick={() => {
                    void handleReject(
                      offer.assignmentId,
                    );
                  }}
                  className="py-2.5 rounded-xl border border-border bg-white text-[10px] font-bold text-muted-foreground flex items-center justify-center gap-1 disabled:opacity-60"
                >
                  <X className="w-3 h-3" />

                  {rejectingId ===
                  offer.assignmentId
                    ? "Rejecting…"
                    : "Reject"}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Delivery Detail ───────────────────────────────────────────────
function DeliveryDetailScreen({
  onNav,
}: {
  onNav: (s: RiderScreen) => void;
}) {
  const [delivery, setDelivery] =
    useState<RiderActiveDelivery | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");
  
  const [updatingStatus, setUpdatingStatus] =
  useState(false);

  useEffect(() => {
    let active = true;

    const loadDelivery = async () => {
      setLoading(true);
      setError("");

      try {
        const nextDelivery =
          await fetchActiveRiderDelivery();

        if (active) {
          setDelivery(nextDelivery);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load delivery details.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDelivery();

    return () => {
      active = false;
    };
  }, []);

  const handleAdvanceStatus = async () => {
  if (!delivery || updatingStatus) {
    return;
  }

  if (
    delivery.assignmentStatus ===
    "out_for_delivery"
  ) {
    return;
  }

  setUpdatingStatus(true);
  setError("");

  try {
    await advanceRiderDelivery(
      delivery.assignmentId,
    );

    const nextDelivery =
      await fetchActiveRiderDelivery();

    setDelivery(nextDelivery);
  } catch (caught) {
    setError(
      caught instanceof Error
        ? caught.message
        : "Unable to update delivery status.",
    );
  } finally {
    setUpdatingStatus(false);
  }
};

  const statusLabel =
    delivery?.assignmentStatus === "accepted"
      ? "Rider Accepted"
      : delivery?.assignmentStatus === "picked_up"
        ? "Picked Up"
        : delivery?.assignmentStatus === "out_for_delivery"
          ? "Out for Delivery"
          : "";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => onNav("home")}
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        <p className="text-white font-bold text-sm">
          Delivery Detail
        </p>
      </div>

      <div className="flex-1 bg-background overflow-y-auto px-4 py-3">
        {loading && (
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-[10px] text-muted-foreground">
              Loading delivery details…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          !delivery && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <Bike className="w-7 h-7 mx-auto text-muted-foreground/50" />

              <p className="mt-2 text-xs font-bold">
                No active delivery
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          delivery && (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-mono text-[9px] font-bold text-primary">
                  {delivery.orderNumber}
                </span>

                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700">
                  {statusLabel}
                </span>
              </div>

              <div className="bg-card rounded-xl border border-border p-3 mb-2">
                <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">
                  Customer
                </p>

                <p className="text-xs font-bold">
                  {delivery.customerName}
                </p>

                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                  <Phone className="w-3 h-3" />

                  <span>
                    {delivery.contactNumber}
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-3 mb-2">
                <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">
                  Delivery Address
                </p>

                <div className="flex items-start gap-1.5 text-[9px]">
                  <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

                  <p className="font-semibold">
                    {delivery.deliveryAddress}
                  </p>
                </div>

                {delivery.landmark && (
                  <p className="text-[9px] text-muted-foreground mt-1 ml-4">
                    Landmark: {delivery.landmark}
                  </p>
                )}

                <button
                  onClick={() =>
                    onNav("nav-assist")
                  }
                  className="mt-2 w-full h-14 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-center gap-2 text-[10px] text-blue-600 font-semibold"
                >
                  <Navigation className="w-4 h-4" />
                  Open Navigation Assistance
                </button>
              </div>

              <div className="bg-card rounded-xl border border-border p-3 mb-3">
                <p className="text-[8px] font-bold text-muted-foreground uppercase mb-2">
                  Items
                </p>

                {delivery.items.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-[9px] mb-1"
                    >
                      <span>
                        {item.name}
                      </span>

                      <span className="font-bold">
                        ×{item.quantity}
                      </span>
                    </div>
                  ),
                )}

                <div className="flex justify-between text-[9px] border-t border-border pt-2 mt-2">
                  <span className="text-muted-foreground">
                    Delivery Fee
                  </span>

                  <span>
                    ₱
                    {delivery.deliveryFee.toFixed(
                      2,
                    )}
                  </span>
                </div>

                <div className="flex justify-between font-bold text-xs mt-1">
                  <span>Total</span>

                  <span className="text-primary">
                    ₱
                    {delivery.total.toFixed(
                      2,
                    )}
                  </span>
                </div>
              </div>

              {delivery.notes && (
                <div className="bg-card rounded-xl border border-border p-3 mb-3">
                  <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">
                    Order Notes
                  </p>

                  <p className="text-[9px]">
                    {delivery.notes}
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={
                  updatingStatus ||
                  delivery.assignmentStatus ===
                    "out_for_delivery"
                }
                onClick={() => {
                  void handleAdvanceStatus();
                }}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-[11px] flex items-center justify-center gap-1.5 mb-2 disabled:opacity-60"
              >
                {updatingStatus
                  ? "Updating…"
                  : delivery.assignmentStatus ===
                      "accepted"
                    ? "Mark as Picked Up"
                    : delivery.assignmentStatus ===
                        "picked_up"
                      ? "Start Delivery"
                      : "Out for Delivery"}
              </button>

              <button
                type="button"
                disabled={
                  delivery.assignmentStatus !==
                  "out_for_delivery"
                }
                onClick={() => {
                  onNav("upload-proof");
                }}
                className="w-full py-2.5 rounded-xl border border-border bg-white text-[10px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Proof of Delivery
              </button>
            </>
          )}
      </div>
    </div>
  );
}

// ── Navigation Assistance ─────────────────────────────────────────
function NavAssistScreen({
  onNav,
}: {
  onNav: (s: RiderScreen) => void;
}) {
  const [delivery, setDelivery] =
    useState<RiderActiveDelivery | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadDelivery = async () => {
      setLoading(true);
      setError("");

      try {
        const nextDelivery =
          await fetchActiveRiderDelivery();

        if (active) {
          setDelivery(nextDelivery);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load delivery address.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDelivery();

    return () => {
      active = false;
    };
  }, []);

  const openGoogleMaps = () => {
    if (!delivery) {
      return;
    }

    const destination =
      [
        delivery.deliveryAddress,
        delivery.landmark,
      ]
        .filter(Boolean)
        .join(", ");

    const mapsUrl =
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        destination,
      )}`;

    window.open(
      mapsUrl,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={() =>
            onNav("delivery-detail")
          }
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        <div>
          <p className="text-white font-bold text-sm">
            Navigation
          </p>

          <p className="text-white/60 text-[9px]">
            Delivery destination
          </p>
        </div>
      </div>

      <div className="flex-1 bg-background overflow-y-auto px-4 py-4">
        {loading && (
          <div className="py-6 text-center">
            <p className="text-[10px] text-muted-foreground">
              Loading delivery destination…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          !delivery && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <Navigation className="w-7 h-7 mx-auto text-muted-foreground/50" />

              <p className="mt-2 text-xs font-bold">
                No active delivery
              </p>

              <p className="mt-1 text-[9px] text-muted-foreground">
                Navigation becomes available after
                accepting a delivery.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          delivery && (
            <>
              <div className="bg-card rounded-xl border border-border p-4 mb-3">
                <p className="text-[8px] font-bold text-muted-foreground uppercase mb-2">
                  Deliver To
                </p>

                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-green-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold">
                      {delivery.customerName}
                    </p>

                    <p className="text-[10px] mt-1">
                      {delivery.deliveryAddress}
                    </p>

                    {delivery.landmark && (
                      <p className="text-[9px] text-muted-foreground mt-1">
                        Landmark:{" "}
                        {delivery.landmark}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-3 text-center">
                <Navigation className="w-8 h-8 mx-auto text-blue-600 mb-2" />

                <p className="text-xs font-bold text-blue-700">
                  Open turn-by-turn navigation
                </p>

                <p className="text-[9px] text-blue-600 mt-1">
                  Google Maps will use the delivery
                  address as your destination.
                </p>
              </div>

              <button
                type="button"
                onClick={openGoogleMaps}
                className="w-full py-3 rounded-xl bg-primary text-white text-[11px] font-bold flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                Open in Google Maps
              </button>
            </>
          )}
      </div>
    </div>
  );
}

// ── Update Status ─────────────────────────────────────────────────
function UpdateStatusScreen({ onNav }: { onNav: (s: RiderScreen) => void }) {
  const [current, setCurrent] = useState("Picked Up");
  const statuses = ["Rider Accepted", "Picked Up", "Out for Delivery", "Delivered"];
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => onNav("delivery-detail")} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><ArrowLeft className="w-4 h-4 text-white" /></button>
        <p className="text-white font-bold text-sm">Update Status</p>
      </div>
      <div className="flex-1 bg-background px-4 py-4 overflow-y-auto">
        <p className="font-mono text-[9px] font-bold text-primary mb-3">ORD-1046</p>
        {statuses.map((s, i) => {
          const isDone = statuses.indexOf(current) > i;
          const isActive = current === s;
          return (
            <button key={s} onClick={() => setCurrent(s)} className={`w-full flex items-center gap-2.5 p-3 mb-2 rounded-xl border text-left transition-all ${isActive ? "border-primary bg-red-50/60" : isDone ? "border-green-300 bg-green-50" : "border-border bg-card"}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isActive ? "border-primary bg-primary" : isDone ? "border-green-500 bg-green-500" : "border-border"}`}>
                {(isActive || isDone) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? "text-primary" : isDone ? "text-green-700" : "text-muted-foreground"}`}>{s}</span>
            </button>
          );
        })}
        <button onClick={() => current === "Delivered" ? onNav("upload-proof") : onNav("delivery-detail")} className="w-full mt-3 py-3 rounded-xl bg-primary text-white font-bold text-[11px]">
          {current === "Delivered" ? "Upload Proof of Delivery" : "Confirm Status"}
        </button>
      </div>
    </div>
  );
}

// ── Upload Proof ──────────────────────────────────────────────────
function UploadProofScreen({
  onNav,
}: {
  onNav: (s: RiderScreen) => void;
}) {
  const [delivery, setDelivery] =
    useState<RiderActiveDelivery | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [proofPath, setProofPath] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadDelivery = async () => {
      setLoading(true);
      setError("");

      try {
        const nextDelivery =
          await fetchActiveRiderDelivery();

        if (!active) {
          return;
        }

        if (
          !nextDelivery ||
          nextDelivery.assignmentStatus !==
            "out_for_delivery"
        ) {
          setDelivery(null);
          setError(
            "There is no delivery currently ready for proof of delivery.",
          );
          return;
        }

        setDelivery(nextDelivery);
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load delivery.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDelivery();

    return () => {
      active = false;
    };
  }, []);

  const handleFileChange = (
    file: File | undefined,
  ) => {
    if (!file) {
      return;
    }

    setError("");
    setProofPath("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setSelectedFile(null);
      setError(
        "Please select a JPEG, PNG, or WebP image.",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null);
      setError(
        "The proof image must be 5 MB or smaller.",
      );
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (
      !delivery ||
      !selectedFile ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let uploadedPath =
        proofPath;

      if (!uploadedPath) {
        uploadedPath =
          await uploadRiderDeliveryProof(
            delivery.assignmentId,
            selectedFile,
          );

        setProofPath(uploadedPath);
      }

      await completeRiderDelivery(
        delivery.assignmentId,
        uploadedPath,
      );

      onNav("home");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to complete delivery.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={() =>
            onNav("delivery-detail")
          }
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        <div>
          <p className="text-white font-bold text-sm">
            Proof of Delivery
          </p>

          {delivery && (
            <p className="text-white/60 text-[9px]">
              {delivery.orderNumber}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 bg-background px-4 py-4 overflow-y-auto">
        {loading && (
          <div className="py-6 text-center">
            <p className="text-[10px] text-muted-foreground">
              Loading delivery…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {!loading && delivery && (
          <>
            <p className="text-xs font-bold mb-1">
              Delivery Photo
            </p>

            <p className="text-[9px] text-muted-foreground mb-4">
              Upload a clear photo showing that the order was delivered.
            </p>

            <div className="w-full min-h-36 bg-muted/60 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 p-4 mb-4">
              {selectedFile ? (
                <>
                  <Check className="w-8 h-8 text-green-500" />

                  <p className="text-[10px] font-bold text-green-700 text-center break-all">
                    {selectedFile.name}
                  </p>

                  <p className="text-[9px] text-muted-foreground">
                    {(
                      selectedFile.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-muted-foreground/50" />

                  <p className="text-[10px] font-semibold text-muted-foreground">
                    No photo selected
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <label className="py-2.5 rounded-xl border border-border bg-card text-[10px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                Camera

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  disabled={submitting}
                  onChange={(event) => {
                    handleFileChange(
                      event.target.files?.[0],
                    );

                    event.target.value = "";
                  }}
                />
              </label>

              <label className="py-2.5 rounded-xl border border-border bg-card text-[10px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5" />
                Gallery

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={submitting}
                  onChange={(event) => {
                    handleFileChange(
                      event.target.files?.[0],
                    );

                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            <button
              type="button"
              disabled={
                !selectedFile ||
                submitting
              }
              onClick={() => {
                void handleSubmit();
              }}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />

              {submitting
                ? "Completing Delivery…"
                : "Submit & Complete Delivery"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────
function HistoryTab() {
  const [records, setRecords] =
    useState<RiderDeliveryHistoryItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      setLoading(true);
      setError("");

      try {
        const nextRecords =
          await fetchRiderDeliveryHistory();

        if (active) {
          setRecords(nextRecords);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load delivery history.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, []);

  const formatDeliveredAt = (
    value: string,
  ) =>
    new Intl.DateTimeFormat(
      "en-PH",
      {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
    ).format(new Date(value));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-4 flex-shrink-0">
        <p className="text-white font-bold">
          Delivery History
        </p>

        <p className="text-white/60 text-[9px]">
          Your completed deliveries
        </p>
      </div>

      <div className="-mt-3 rounded-t-2xl bg-background flex-1 overflow-y-auto px-4 pt-4">
        {loading && (
          <div className="py-6 text-center">
            <p className="text-[10px] text-muted-foreground">
              Loading delivery history…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          records.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <History className="w-7 h-7 mx-auto text-muted-foreground/50" />

              <p className="mt-2 text-xs font-bold">
                No completed deliveries
              </p>

              <p className="mt-1 text-[9px] text-muted-foreground">
                Completed deliveries will appear here.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          records.map((record) => (
            <div
              key={record.assignmentId}
              className="bg-card rounded-xl border border-border p-3 mb-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] font-bold text-primary">
                  {record.orderNumber}
                </span>

                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-100 text-green-700">
                  Delivered
                </span>
              </div>

              <div className="flex items-start gap-1.5 mt-2">
                <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

                <p className="text-[9px] text-muted-foreground">
                  {record.deliveryAddress}
                </p>
              </div>

              <div className="flex items-end justify-between gap-3 mt-2 pt-2 border-t border-border">
                <p className="text-[8px] text-muted-foreground">
                  {formatDeliveredAt(
                    record.deliveredAt,
                  )}
                </p>

                <p className="text-xs font-bold">
                  ₱{record.total.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────
function ProfileTab() {
  const {
    session,
    logout,
  } = useAuth();

  const riderName =
    session?.name?.trim() || "Rider";

  const riderInitial =
    riderName.charAt(0).toUpperCase();

  const [profile, setProfile] =
    useState<RiderProfile | null>(null);

  const [profileStats, setProfileStats] =
    useState<RiderProfileStats | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [signingOut, setSigningOut] =
    useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");

      try {
        const [
          nextProfile,
          nextStats,
        ] = await Promise.all([
          fetchRiderProfile(),
          fetchRiderProfileStats(),
        ]);

        if (active) {
          setProfile(nextProfile);
          setProfileStats(nextStats);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load rider profile.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  const availabilityLabel =
    profile?.availabilityStatus === "on_delivery"
      ? "On Delivery"
      : profile?.availabilityStatus === "offline"
        ? "Offline"
        : "Available";

  const motor =
    [
      profile?.motorBrand,
      profile?.motorModel,
    ]
      .filter(Boolean)
      .join(" ") || "Not provided";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-primary px-4 py-5 flex flex-col items-center gap-2 flex-shrink-0">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold text-xl">
            {riderInitial}
          </span>
        </div>

        <p className="text-white font-bold text-sm">
          {riderName}
        </p>

        {!loading && profile && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-400/30 text-green-100">
            {availabilityLabel}
          </span>
        )}
      </div>

      <div className="flex-1 bg-background px-4 py-4 overflow-y-auto">
        {loading && (
          <div className="py-4 text-center">
            <p className="text-[10px] text-muted-foreground">
              Loading rider profile…
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 mb-3">
            <p className="text-[10px] font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          profile && (
            <>
              {[
                {
                  l: "Contact",
                  v:
                    profile.contactNumber ||
                    "Not provided",
                },
                {
                  l: "License",
                  v:
                    profile.driverLicenseNumber ||
                    "Not provided",
                },
                {
                  l: "Plate",
                  v:
                    profile.plateNumber ||
                    "Not provided",
                },
                {
                  l: "Motor",
                  v: motor,
                },
              ].map((field) => (
                <div
                  key={field.l}
                  className="flex justify-between gap-4 py-2.5 border-b border-border last:border-0 text-[10px]"
                >
                  <span className="text-muted-foreground">
                    {field.l}
                  </span>

                  <span className="font-semibold text-foreground text-right">
                    {field.v}
                  </span>
                </div>
              ))}
            </>
          )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-card rounded-xl border border-border p-2.5 text-center">
            <p className="text-[8px] text-muted-foreground mb-0.5">
              Total Deliveries
            </p>

            <p className="text-lg font-bold">
              {profileStats?.totalDeliveries ??
                "—"}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-2.5 text-center">
            <p className="text-[8px] text-muted-foreground mb-0.5">
              Today
            </p>

            <p className="text-lg font-bold text-primary">
              {profileStats?.completedToday ??
                "—"}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            void handleSignOut();
          }}
          className="w-full mt-4 py-2.5 rounded-xl border border-border bg-white text-[10px] font-bold text-muted-foreground flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <LogOut className="w-3 h-3" />

          {signingOut
            ? "Signing Out…"
            : "Sign Out"}
        </button>
      </div>
    </div>
  );
}

// ── Root Rider App ────────────────────────────────────────────────
export function RiderApp() {
  const [screen, setScreen] = useState<RiderScreen>("home");
  const [activeTab, setActiveTab] = useState<BottomTab>("home");

  // Screens that show bottom navigation
  const MAIN_SCREENS: RiderScreen[] = ["home", "requests", "history", "profile"];
  const showBottomNav = MAIN_SCREENS.includes(screen);

  const handleTabSelect = (tab: BottomTab) => {
    setActiveTab(tab);
    const tabToScreen: Record<BottomTab, RiderScreen> = {
      home: "home", deliveries: "requests", history: "history", profile: "profile",
    };
    setScreen(tabToScreen[tab]);
  };

  return (
    <PhoneShell>

      {showBottomNav && (
        <>
          {activeTab === "home" && ( <HomeTab onNav={(nextScreen) => { 
            if (nextScreen === "requests") 
              {
              setActiveTab("deliveries"); 
            }
              
              setScreen(nextScreen);
            }} /> )}
          {activeTab === "deliveries" && (<DeliveryRequestsTab />)}
          {activeTab === "history"    && <HistoryTab />}
          {activeTab === "profile"    && <ProfileTab />}
          <BottomNav active={activeTab} onSelect={handleTabSelect} />
        </>
      )}

      {screen === "delivery-detail" && <DeliveryDetailScreen onNav={setScreen} />}
      {screen === "nav-assist"      && <NavAssistScreen      onNav={setScreen} />}
      {screen === "update-status"   && <UpdateStatusScreen   onNav={setScreen} />}
      {screen === "upload-proof"    && <UploadProofScreen    onNav={setScreen} />}
    </PhoneShell>
  );
}
