import {useEffect, useState } from "react";
import {
  Bike, LayoutDashboard, History, User,
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
  setRiderAvailability,
  subscribeToRiderAssignmentChanges,
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
  | "home"
  | "requests"
  | "delivery-detail"
  | "nav-assist"
  | "upload-proof"
  | "history"
  | "profile";

type BottomTab = "home" | "deliveries" | "history" | "profile";
    
// ── Responsive Rider workspace ────────────────────────────────────
function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rider-app flex h-full min-h-0 w-full justify-center">
      <div
        className="rider-workspace flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden"
      >
        {/* Screen content */}
        <div className="rider-screen flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          {children}
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
    <nav aria-label="Rider navigation" className="rider-bottom-nav flex flex-shrink-0 border-t border-border bg-white">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            aria-current={active === t.id ? "page" : undefined}
            onClick={() => onSelect(t.id)}
            className={`min-w-0 flex-1 flex flex-col items-center justify-center gap-1 px-1 py-3 transition-colors ${active === t.id ? "text-primary bg-orange-50" : "text-muted-foreground"}`}
          >
            <Icon className="w-5 h-5" strokeWidth={active === t.id ? 2.5 : 1.8} />
            <span className="text-sm font-semibold">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function RiderRetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="mt-3 min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-100"
    >
      Try Again
    </button>
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

  const [updatingAvailability, setUpdatingAvailability] =
  useState(false);
  
  const [activeDelivery, setActiveDelivery] =
    useState<RiderActiveDelivery | null>(null);

  const [activeDeliveryLoading, setActiveDeliveryLoading] =
    useState(true);

  const [activeDeliveryError, setActiveDeliveryError] =
    useState("");
  const [homeLoadAttempt, setHomeLoadAttempt] = useState(0);

    useEffect(() => {
  let active = true;
  let unsubscribe:
    | (() => void)
    | null = null;

  const loadHomeData = async (
    showLoading = true,
  ) => {
    if (showLoading) {
      setActiveDeliveryLoading(true);
    }

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
            : "Unable to load Rider dashboard.",
        );
      }
    } finally {
      if (
        active &&
        showLoading
      ) {
        setActiveDeliveryLoading(false);
      }
    }
  };

  const startRealtime = async () => {
    try {
      const cleanup =
        await subscribeToRiderAssignmentChanges(
          () => {
            if (active) {
              void loadHomeData(false);
            }
          },
        );

      if (!active) {
        cleanup();
        return;
      }

      unsubscribe = cleanup;
    } catch (caught) {
      console.error(
        "Unable to start Rider realtime updates:",
        caught,
      );
    }
  };

  void loadHomeData();
  void startRealtime();

  return () => {
    active = false;
    unsubscribe?.();
  };
}, [homeLoadAttempt]);

  const handleToggleAvailability = async () => {
  if (
    !riderProfile ||
    updatingAvailability ||
    offerCount > 0 ||
    riderProfile.availabilityStatus === "on_delivery"
  ) {
    return;
  }

  const nextStatus =
    riderProfile.availabilityStatus === "available"
      ? "offline"
      : "available";

  setUpdatingAvailability(true);
  setActiveDeliveryError("");

  try {
    const result =
      await setRiderAvailability(nextStatus);

    setRiderProfile((current) =>
      current
        ? {
            ...current,
            availabilityStatus:
              result.availability_status,
          }
        : current,
    );
  } catch (caught) {
    setActiveDeliveryError(
      caught instanceof Error
        ? caught.message
        : "Unable to update availability.",
    );
  } finally {
    setUpdatingAvailability(false);
  }
};

  const isAvailable =
  riderProfile?.availabilityStatus === "available";

  const availabilityLabel =
  riderProfile?.availabilityStatus === "on_delivery"
    ? "Currently on a delivery"
    : riderProfile?.availabilityStatus === "offline"
      ? "Not accepting deliveries"
      : "Accepting deliveries";

  const greeting = (() => {
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
})();

  return (


    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="rider-header bg-primary px-4 py-4 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">
            {greeting},
          </p>

          <p className="text-white font-bold text-xl">
            {riderName}
          </p>
        </div>

        <div className="w-11 h-11 shrink-0 rounded-xl bg-white/20 flex items-center justify-center" aria-label="Rider">
          <span className="text-white font-bold text-sm">
            {riderInitial}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
        <div className="min-w-0">
          <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">
            Your availability
          </p>

          <p className="text-white text-base font-bold mt-1" role="status">
            {riderProfile ? availabilityLabel : activeDeliveryLoading ? "Loading availability…" : "Availability unavailable"}
          </p>
        </div>

        <button
          type="button"
          disabled={
            updatingAvailability ||
            !riderProfile ||
            offerCount > 0 ||
            riderProfile.availabilityStatus ===
              "on_delivery"
          }
          onClick={() => {
            void handleToggleAvailability();
          }}
          aria-label="Toggle rider availability"
          aria-pressed={isAvailable}
          className={`rider-availability-toggle w-16 h-11 shrink-0 rounded-full relative border border-white/30 transition-colors disabled:opacity-60 ${
            isAvailable
              ? "bg-emerald-600"
              : "bg-white/30"
          }`}
        >
          <div
            className={`absolute top-1.5 w-7 h-7 bg-white rounded-full transition-all ${
              isAvailable
                ? "left-8"
                : "left-1"
            }`}
          />
        </button>
      </div>
      </div>
      <div className="rider-content bg-background flex-1 overflow-y-auto px-4 pt-4">
        {isAvailable && offerCount > 0 && (
          <div className="rider-offer-alert bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-amber-800 mb-1">
              {offerCount} new{" "}
              {offerCount === 1
                ? "delivery request"
                : "delivery requests"}
            </p>

            <button
              onClick={() => onNav("requests")}
              className="mt-2 min-h-11 w-full rounded-xl bg-primary px-4 py-2 text-base font-bold text-white"
            >
              Review Delivery Offer
            </button>
          </div>
        )}
      <p className="text-base font-bold text-foreground mb-2">
        Active Delivery
      </p>

      {activeDeliveryLoading && (
        <div className="w-full bg-card rounded-xl border border-border p-4 mb-4 text-center">
          <p className="text-sm text-muted-foreground">
            Loading active delivery…
          </p>
        </div>
      )}

      {!activeDeliveryLoading && activeDeliveryError && (
        <div role="alert" className="w-full rounded-xl border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-sm font-semibold text-red-700">
            {activeDeliveryError}
          </p>
          <RiderRetryButton
            onRetry={() => setHomeLoadAttempt((attempt) => attempt + 1)}
          />
        </div>
      )}

      {!activeDeliveryLoading &&
        !activeDeliveryError &&
        !activeDelivery && (
          <div className="w-full bg-card rounded-xl border border-border p-4 mb-4 text-center">
            <Bike className="w-6 h-6 mx-auto text-muted-foreground/50 mb-1" />

            <p className="text-sm font-semibold">
              No active delivery
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              Accepted deliveries will appear here.
            </p>
          </div>
        )}

      {!activeDeliveryLoading &&
        !activeDeliveryError &&
        activeDelivery && (
          <button
            onClick={() => onNav("delivery-detail")}
            className="rider-active-card w-full bg-card rounded-xl border border-blue-200 p-4 text-left mb-4 hover:border-blue-400 transition-colors"
          >
            <div className="rider-order-heading flex flex-wrap items-start justify-between gap-2 mb-3">
              <span className="rider-order-number font-mono text-lg font-bold text-foreground">
                {activeDelivery.orderNumber}
              </span>

              <span className="px-2 py-0.5 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                {activeDelivery.assignmentStatus === "accepted"
                  ? "Rider Accepted"
                  : activeDelivery.assignmentStatus === "picked_up"
                    ? "Picked Up"
                    : "Out for Delivery"}
              </span>
            </div>

            <p className="text-base font-semibold mb-1">
              {activeDelivery.customerName}
            </p>

            <div className="flex items-start gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

              <span>
                {activeDelivery.deliveryAddress}
              </span>
            </div>

            <div className="mt-3 w-full min-h-11 py-3 rounded-xl bg-primary text-white text-base font-bold text-center">
              View Delivery & Next Step
            </div>
          </button>
        )}
      <div className="rider-daily-summary grid grid-cols-2 gap-3 mt-5 mb-1">
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-sm text-muted-foreground mb-0.5">
            Deliveries Today
          </p>

          <p className="text-xl font-bold text-foreground">
            {dashboardStats?.deliveriesToday ?? "—"}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-sm text-muted-foreground mb-0.5">
            Completed Today
          </p>

          <p className="text-xl font-bold text-foreground">
            {dashboardStats?.completedToday ?? "—"}
          </p>
        </div>
      </div>
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
  const [offerLoadAttempt, setOfferLoadAttempt] = useState(0);

  const [acceptingId, setAcceptingId] =
    useState<string | null>(null);

  const [rejectingId, setRejectingId] =
    useState<string | null>(null);

  useEffect(() => {
  let active = true;
  let unsubscribe:
    | (() => void)
    | null = null;

  const loadOffers = async (
    showLoading = true,
  ) => {
    if (showLoading) {
      setLoading(true);
    }

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
      if (
        active &&
        showLoading
      ) {
        setLoading(false);
      }
    }
  };

  const startRealtime = async () => {
    try {
      const cleanup =
        await subscribeToRiderAssignmentChanges(
          () => {
            if (active) {
              void loadOffers(false);
            }
          },
        );

      if (!active) {
        cleanup();
        return;
      }

      unsubscribe = cleanup;
    } catch (caught) {
      console.error(
        "Unable to start Rider delivery request realtime updates:",
        caught,
      );
    }
  };

  void loadOffers();
  void startRealtime();

  return () => {
    active = false;
    unsubscribe?.();
  };
}, [offerLoadAttempt]);

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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="rider-header bg-primary px-4 py-4 flex-shrink-0">
        <p className="text-white font-bold">
          Delivery Offers
        </p>

        <p className="text-white/80 text-sm">
          Review the destination, then accept or reject.
        </p>
      </div>

      <div className="rider-content bg-background flex-1 px-4 pt-4 overflow-y-auto">
        {loading && (
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Loading delivery requests…
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
            <RiderRetryButton
              onRetry={() => setOfferLoadAttempt((attempt) => attempt + 1)}
            />
          </div>
        )}

        {!loading &&
          !error &&
          offers.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <Bike className="mx-auto h-7 w-7 text-muted-foreground/50" />

              <p className="mt-2 text-base font-bold">
                No delivery offers
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Offers will appear here. After accepting, open Home to view your active delivery.
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          offers.map((offer) => (
            <div
              key={offer.assignmentId}
              className="rider-offer-card bg-card rounded-xl border border-amber-300 p-4 mb-4"
            >
              <div className="rider-order-heading flex flex-wrap items-start justify-between gap-2 mb-3">
                <span className="rider-order-number font-mono text-lg font-bold text-foreground">
                  {offer.orderNumber}
                </span>

                <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800">
                  Delivery offer
                </span>
              </div>

              <div className="mb-3">
                <p className="text-base font-bold">{offer.customerName}</p>
                <p className="text-sm text-muted-foreground mt-1">{offer.contactNumber}</p>
              </div>

              <div className="flex flex-col gap-1.5 mb-2.5">
                <div className="flex items-start gap-2 text-base text-foreground">
                  <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

                  <span>
                    <span className="font-semibold text-foreground">
                      Deliver to:
                    </span>{" "}
                    {offer.deliveryAddress}
                  </span>
                </div>

                {offer.landmark && (
                  <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <Navigation className="w-3 h-3 mt-0.5 flex-shrink-0" />

                    <span>
                      Landmark: {offer.landmark}
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border p-3 mb-3">
                <div className="flex justify-between gap-3 text-sm">
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

                <div className="mt-1 flex justify-between gap-3 text-base font-bold">
                  <span>Order total</span>

                  <span className="text-primary">
                    ₱
                    {offer.total.toFixed(
                      2,
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
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
                  className="py-3 rounded-xl bg-primary text-white text-base font-bold flex items-center justify-center gap-1 disabled:opacity-60"
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
                  className="py-3 rounded-xl border border-red-200 bg-white text-base font-bold text-red-700 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <X className="w-3 h-3" />

                  {rejectingId ===
                  offer.assignmentId
                    ? "Rejecting…"
                    : "Reject"}
                </button>
              </div>
              <div className="bg-muted/60 rounded-xl p-3">
                <p className="text-xs font-bold text-muted-foreground mb-1">
                  ORDER ITEMS
                </p>

                {offer.items.map((item) => (
                  <p
                    key={item.id}
                    className="text-sm"
                  >
                    {item.quantity} × {item.name}
                  </p>
                ))}

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
  const [deliveryLoadAttempt, setDeliveryLoadAttempt] = useState(0);
  
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
  }, [deliveryLoadAttempt]);

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
    if (
      delivery.assignmentStatus !== "accepted" &&
      delivery.assignmentStatus !== "picked_up"
    ) {
      throw new Error(
        "This delivery cannot be advanced from its current status.",
      );
    }

    await advanceRiderDelivery(
      delivery.assignmentId,
      delivery.assignmentStatus,
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="rider-header bg-primary px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => onNav("home")}
          aria-label="Back"
          className="w-11 h-11 shrink-0 rounded-xl bg-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        <p className="text-white font-bold text-sm">
          Active Delivery
        </p>
      </div>

      <div className="rider-content flex-1 bg-background overflow-y-auto px-4 py-3">
        {loading && (
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Loading delivery details…
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
            <RiderRetryButton
              onRetry={() => setDeliveryLoadAttempt((attempt) => attempt + 1)}
            />
          </div>
        )}

        {!loading &&
          !error &&
          !delivery && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <Bike className="w-7 h-7 mx-auto text-muted-foreground/50" />

              <p className="mt-2 text-base font-bold">
                No active delivery
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          delivery && (
            <>
              <div className="rider-order-heading flex flex-wrap items-start justify-between gap-2 mb-4">
                <span className="rider-order-number font-mono text-xl font-bold text-foreground">
                  {delivery.orderNumber}
                </span>

                <span className="px-2 py-0.5 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                  {statusLabel}
                </span>
              </div>

              <div className="bg-card rounded-xl border border-border p-3 mb-2">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">
                  Customer
                </p>

                <p className="text-base font-bold">
                  {delivery.customerName}
                </p>

                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <Phone className="w-3 h-3" />

                  <span>
                    {delivery.contactNumber}
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-3 mb-2">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">
                  Delivery Address
                </p>

                <div className="flex items-start gap-1.5 text-sm">
                  <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

                  <p className="font-semibold text-base">
                    {delivery.deliveryAddress}
                  </p>
                </div>

                {delivery.landmark && (
                  <p className="text-sm text-muted-foreground mt-1 ml-4">
                    Landmark: {delivery.landmark}
                  </p>
                )}

                <button
                  onClick={() =>
                    onNav("nav-assist")
                  }
                  className="mt-2 w-full h-14 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-center gap-2 text-sm text-blue-600 font-semibold"
                >
                  <Navigation className="w-4 h-4" />
                  Navigation Assistance
                </button>
              </div>

              <section aria-label="Next delivery action" className="rider-next-action rounded-xl border border-border bg-card p-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Next step</p>
                <p className="text-base font-semibold mb-3">
                  {delivery.assignmentStatus === "accepted"
                    ? "Collect the order, then mark it as picked up."
                    : delivery.assignmentStatus === "picked_up"
                      ? "Ready to leave? Start the delivery."
                      : "Hand over the order, then upload proof to complete delivery."}
                </p>
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
                className="rider-advance-action w-full py-3 rounded-xl bg-primary text-white font-bold text-base flex items-center justify-center gap-2 mb-2 disabled:opacity-60"
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
                className="rider-proof-action w-full py-3 rounded-xl border border-border bg-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Proof of Delivery
              </button>
              </section>

              <div className="bg-card rounded-xl border border-border p-3 mb-3">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Items
                </p>

                {delivery.items.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm mb-1"
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

                <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
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

                <div className="flex justify-between font-bold text-base mt-1">
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
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    Order Notes
                  </p>

                  <p className="text-sm">
                    {delivery.notes}
                  </p>
                </div>
              )}

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
  const [navigationLoadAttempt, setNavigationLoadAttempt] = useState(0);

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
  }, [navigationLoadAttempt]);

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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="rider-header bg-primary px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={() =>
            onNav("delivery-detail")
          }
          aria-label="Back"
          className="w-11 h-11 shrink-0 rounded-xl bg-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        <div>
          <p className="text-white font-bold text-sm">
            Navigation
          </p>

          <p className="text-white/80 text-sm">
            Delivery destination
          </p>
        </div>
      </div>

      <div className="rider-content flex-1 bg-background overflow-y-auto px-4 py-4">
        {loading && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Loading delivery destination…
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
            <RiderRetryButton
              onRetry={() => setNavigationLoadAttempt((attempt) => attempt + 1)}
            />
          </div>
        )}

        {!loading &&
          !error &&
          !delivery && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <Navigation className="w-7 h-7 mx-auto text-muted-foreground/50" />

              <p className="mt-2 text-base font-bold">
                No active delivery
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
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
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Deliver To
                </p>

                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-green-600" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-base font-bold">
                      {delivery.customerName}
                    </p>

                    <p className="text-sm mt-1">
                      {delivery.deliveryAddress}
                    </p>

                    {delivery.landmark && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Landmark:{" "}
                        {delivery.landmark}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-3 text-center">
                <Navigation className="w-8 h-8 mx-auto text-blue-600 mb-2" />

                <p className="text-base font-bold text-blue-700">
                  Open turn-by-turn navigation
                </p>

                <p className="text-sm text-blue-600 mt-1">
                  Google Maps will use the delivery
                  address as your destination.
                </p>
              </div>

              <button
                type="button"
                onClick={openGoogleMaps}
                className="w-full py-3 rounded-xl bg-primary text-white text-base font-bold flex items-center justify-center gap-2"
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
  const [proofLoadAttempt, setProofLoadAttempt] = useState(0);

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
  }, [proofLoadAttempt]);

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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="rider-header bg-primary px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={() =>
            onNav("delivery-detail")
          }
          aria-label="Back"
          className="w-11 h-11 shrink-0 rounded-xl bg-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        <div>
          <p className="text-white font-bold text-sm">
            Proof of Delivery
          </p>

          {delivery && (
            <p className="text-white/80 text-sm">
              {delivery.orderNumber}
            </p>
          )}
        </div>
      </div>

      <div className="rider-content flex-1 bg-background px-4 py-4 overflow-y-auto">
        {loading && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Loading delivery…
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
            {!delivery ? (
              <RiderRetryButton
                onRetry={() => setProofLoadAttempt((attempt) => attempt + 1)}
              />
            ) : null}
          </div>
        )}

        {!loading && delivery && (
          <>
            <div className="rounded-xl border border-border bg-card p-4 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completing this order</p>
              <p className="rider-order-number mt-1 font-mono text-xl font-bold">{delivery.orderNumber}</p>
              <p className="mt-2 text-base font-semibold">{delivery.customerName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{delivery.deliveryAddress}</p>
            </div>
            <p className="text-base font-bold mb-1">
              Delivery Photo
            </p>

            <p className="text-sm text-muted-foreground mb-4">
              Add a clear photo of the delivered order. JPEG, PNG or WebP, up to 5 MB.
            </p>

            <div className="w-full min-h-36 bg-muted/60 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 p-4 mb-4">
              {selectedFile ? (
                <>
                  <Check className="w-8 h-8 text-green-500" />

                  <p className="text-sm font-semibold text-green-800" role="status">
                    {proofPath ? "Photo uploaded · completion still required" : "Photo selected · ready to submit"}
                  </p>
                  <p className="text-sm font-bold text-green-700 text-center break-all">
                    {selectedFile.name}
                  </p>

                  <p className="text-sm text-muted-foreground">
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

                  <p className="text-sm font-semibold text-muted-foreground">
                    No photo selected
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <label className="py-2.5 rounded-xl border border-border bg-card text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
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

              <label className="py-2.5 rounded-xl border border-border bg-card text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
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

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-3">
              <p className="text-base font-bold text-amber-900">Confirm the order has been delivered</p>
              <p className="mt-1 text-sm text-amber-900">
                Submit only after handing over this order. This completes the delivery and returns you to Home. Completed deliveries appear in History.
              </p>
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
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-base flex items-center justify-center gap-1.5 disabled:opacity-50"
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
  const [historyLoadAttempt, setHistoryLoadAttempt] = useState(0);

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
  }, [historyLoadAttempt]);

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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="rider-header bg-primary px-4 py-4 flex-shrink-0">
        <p className="text-white font-bold">
          Delivery History
        </p>

        <p className="text-white/80 text-sm">
          Your completed deliveries
        </p>
      </div>

      <div className="rider-content bg-background flex-1 overflow-y-auto px-4 pt-4">
        {loading && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Loading delivery history…
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
            <RiderRetryButton
              onRetry={() => setHistoryLoadAttempt((attempt) => attempt + 1)}
            />
          </div>
        )}

        {!loading &&
          !error &&
          records.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-5 text-center">
              <History className="w-7 h-7 mx-auto text-muted-foreground/50" />

              <p className="mt-2 text-base font-bold">
                No completed deliveries
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
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
                <span className="font-mono text-sm font-bold text-primary">
                  {record.orderNumber}
                </span>

                <span className="px-2 py-0.5 rounded-full text-sm font-bold bg-green-100 text-green-700">
                  Delivered
                </span>
              </div>

              <div className="flex items-start gap-1.5 mt-2">
                <MapPin className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />

                <p className="text-sm text-muted-foreground">
                  {record.deliveryAddress}
                </p>
              </div>

              <div className="flex items-end justify-between gap-3 mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {formatDeliveredAt(
                    record.deliveredAt,
                  )}
                </p>

                <p className="text-base font-bold">
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
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);

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
  }, [profileLoadAttempt]);

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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="rider-header bg-primary px-4 py-5 flex flex-col items-center gap-2 flex-shrink-0">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold text-xl">
            {riderInitial}
          </span>
        </div>

        <p className="text-white font-bold text-sm">
          {riderName}
        </p>

        {!loading && profile && (
          <span className="px-2 py-0.5 rounded-full text-sm font-bold bg-green-400/30 text-green-100">
            {availabilityLabel}
          </span>
        )}
      </div>

      <div className="rider-content flex-1 bg-background px-4 py-4 overflow-y-auto">
        {loading && (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Loading rider profile…
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 mb-3">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
            <RiderRetryButton
              onRetry={() => setProfileLoadAttempt((attempt) => attempt + 1)}
            />
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
                  className="flex justify-between gap-4 py-2.5 border-b border-border last:border-0 text-sm"
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
            <p className="text-xs text-muted-foreground mb-0.5">
              Total Deliveries
            </p>

            <p className="text-lg font-bold">
              {profileStats?.totalDeliveries ??
                "—"}
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-2.5 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">
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
          className="w-full mt-4 py-2.5 rounded-xl border border-border bg-white text-sm font-bold text-muted-foreground flex items-center justify-center gap-1.5 disabled:opacity-60"
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
      {screen === "upload-proof"    && <UploadProofScreen    onNav={setScreen} />}
    </PhoneShell>
  );
}
