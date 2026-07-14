import { useState } from "react";
import {
  Loader2, Save, Upload, Package, Bike, ShoppingCart, AlertCircle,
  WifiOff, ServerCrash, ShieldOff, TimerOff, CheckCircle, Trash2, X,
  ImageIcon, Check, Clock,
} from "lucide-react";

// ── Reusable state card ───────────────────────────────────────────
function StateCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  desc,
  spin,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  spin?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`border rounded-2xl p-6 flex flex-col items-center text-center gap-3 ${iconBg.replace("bg-", "bg-")}`} style={{ borderColor: "inherit" }}>
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center`}>
        <Icon className={`w-7 h-7 ${iconColor} ${spin ? "animate-spin" : ""}`} />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
      </div>
      {children}
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "warning"; onClose: () => void }) {
  const colors = {
    success: "bg-zinc-900 text-white",
    error:   "bg-red-600 text-white",
    warning: "bg-amber-500 text-white",
  };
  const icons = { success: CheckCircle, error: AlertCircle, warning: AlertCircle };
  const Icon = icons[type];
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold ${colors[type]} animate-in slide-in-from-right`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-foreground text-lg mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted/60">Cancel</button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold ${confirmVariant === "danger" ? "bg-red-600 hover:bg-amber-800" : "bg-primary hover:bg-amber-800"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────
function EmptyTable({ icon: Icon, title, desc, action }: { icon: React.ElementType; title: string; desc: string; action?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/40" />
      </div>
      <p className="font-bold text-foreground mb-1">{title}</p>
      <p className="text-sm text-muted-foreground mb-5">{desc}</p>
      {action && (
        <button className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-amber-800">
          {action}
        </button>
      )}
    </div>
  );
}

// ── Main states gallery ───────────────────────────────────────────
export function SystemStates() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "warning" } | null>(null);
  const [dialog, setDialog] = useState<"delete" | "reject" | null>(null);
  const [emptyTab, setEmptyTab] = useState<"orders" | "inventory" | "riders">("orders");

  return (
    <div className="states-gallery h-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete Menu Item?"
          message='Are you sure you want to delete "Crispy Beef Tadyang"? This action cannot be undone.'
          confirmLabel="Delete Item"
          confirmVariant="danger"
          onConfirm={() => { setDialog(null); setToast({ msg: "Menu item deleted.", type: "error" }); }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "reject" && (
        <ConfirmDialog
          title="Reject Payment?"
          message="Are you sure you want to reject the payment for ORD-1048? The order will be cancelled."
          confirmLabel="Reject Payment"
          confirmVariant="danger"
          onConfirm={() => { setDialog(null); setToast({ msg: "Payment rejected. Order cancelled.", type: "error" }); }}
          onCancel={() => setDialog(null)}
        />
      )}

      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[22px] border border-border bg-card p-5 shadow-[0_18px_42px_rgba(67,42,23,0.06)] sm:p-6">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary/75">RRJ design system</p>
          <h1 className="font-['Fraunces'] text-3xl font-bold tracking-[-0.035em] text-foreground">System States</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Reusable feedback states, toasts, dialogs, and empty states used throughout the app.</p>
        </div>

        {/* Loading states */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Loading States</h2>
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center"><Loader2 className="w-7 h-7 text-blue-500 animate-spin" /></div>
            <div className="text-center"><p className="text-sm font-bold">Loading</p><p className="text-xs text-muted-foreground mt-0.5">Fetching data from server</p></div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center"><Save className="w-7 h-7 text-violet-500 animate-pulse" /></div>
            <div className="text-center"><p className="text-sm font-bold">Saving</p><p className="text-xs text-muted-foreground mt-0.5">Saving your changes…</p></div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center"><Upload className="w-7 h-7 text-teal-500 animate-bounce" /></div>
            <div className="text-center"><p className="text-sm font-bold">Uploading</p><p className="text-xs text-muted-foreground mt-0.5">Uploading proof of payment…</p></div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
              <div className="flex items-center gap-1">
                <Bike className="w-5 h-5 text-violet-500" />
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
              </div>
            </div>
            <div className="text-center"><p className="text-sm font-bold">Waiting for Rider</p><p className="text-xs text-muted-foreground mt-0.5">Order ready. Awaiting rider…</p></div>
          </div>
        </div>

        {/* Success states */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Success States</h2>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0"><CheckCircle className="w-6 h-6 text-green-600" /></div>
            <div>
              <p className="text-sm font-bold text-green-800">Payment Verified</p>
              <p className="text-xs text-green-700 mt-0.5">ORD-1048 confirmed. Sent to Kitchen Queue.</p>
              <p className="text-[10px] text-green-600 mt-1">11:04 AM · by Juan Santos</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0"><ShoppingCart className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm font-bold text-blue-800">Order Confirmed</p>
              <p className="text-xs text-blue-700 mt-0.5">ORD-1048 sent to Kitchen Queue for preparation.</p>
              <p className="text-[10px] text-blue-600 mt-1">11:04 AM · System</p>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center flex-shrink-0"><Upload className="w-6 h-6 text-teal-600" /></div>
            <div>
              <p className="text-sm font-bold text-teal-800">File Uploaded</p>
              <p className="text-xs text-teal-700 mt-0.5">Proof of delivery uploaded successfully.</p>
              <p className="text-[10px] text-teal-600 mt-1">10:45 AM · Ramil Abad</p>
            </div>
          </div>
        </div>

        {/* Warning states */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Warning States</h2>
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0"><Package className="w-6 h-6 text-amber-600" /></div>
            <div>
              <p className="text-sm font-bold text-amber-800">Low Stock Warning</p>
              <p className="text-xs text-amber-700 mt-0.5">Cooking Oil is at 4 liters — below reorder level of 10 liters.</p>
              <button className="text-[10px] font-semibold text-amber-700 mt-2 underline">Record Stock Receiving →</button>
            </div>
          </div>
          <div className="bg-zinc-100 border border-zinc-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-200 flex items-center justify-center flex-shrink-0"><Bike className="w-6 h-6 text-zinc-500" /></div>
            <div>
              <p className="text-sm font-bold text-zinc-700">No Rider Available</p>
              <p className="text-xs text-zinc-500 mt-0.5">All riders are offline or currently on delivery. Order will wait until a rider becomes available.</p>
            </div>
          </div>
        </div>

        {/* Error states */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Error States</h2>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { icon: AlertCircle,  bg: "bg-red-50",   ic: "text-red-400",   title: "Error",          desc: "Failed to load. Please retry.",    btn: "Retry" },
            { icon: WifiOff,      bg: "bg-zinc-100", ic: "text-zinc-500",  title: "No Internet",    desc: "Check your connection.",           btn: "Retry" },
            { icon: ServerCrash,  bg: "bg-red-50",   ic: "text-red-400",   title: "Server Error",   desc: "500 — Something went wrong.",     btn: null },
            { icon: ShieldOff,    bg: "bg-amber-50", ic: "text-amber-500", title: "Unauthorized",   desc: "You don't have permission.",       btn: "Go Back" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className={`${s.bg} border rounded-2xl p-5 flex flex-col items-center text-center gap-3`}>
                <div className={`w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center`}><Icon className={`w-6 h-6 ${s.ic}`} /></div>
                <div><p className="text-sm font-bold">{s.title}</p><p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.desc}</p></div>
                {s.btn && <button className="px-4 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-foreground hover:bg-muted/60">{s.btn}</button>}
              </div>
            );
          })}
        </div>

        {/* Toast triggers */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Toast Notifications</h2>
        <div className="flex gap-3 mb-8 flex-wrap">
          {[
            { label: "Payment Verified ✓",  msg: "Payment verified. ORD-1048 sent to kitchen.",       type: "success" as const },
            { label: "Order Confirmed ✓",   msg: "Order confirmed and added to Kitchen Queue.",         type: "success" as const },
            { label: "Low Stock Warning",   msg: "Cooking Oil is below reorder level (4L).",           type: "warning" as const },
            { label: "Payment Rejected",    msg: "Payment rejected. Order ORD-1048 cancelled.",        type: "error"   as const },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => setToast({ msg: t.msg, type: t.type })}
              className="px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/60 shadow-sm"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Confirmation dialogs */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Confirmation Dialogs</h2>
        <div className="flex gap-3 mb-8 flex-wrap">
          <button onClick={() => setDialog("delete")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-100">
            <Trash2 className="w-4 h-4" /> Delete Confirmation
          </button>
          <button onClick={() => setDialog("reject")} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-700 hover:bg-amber-100">
            <X className="w-4 h-4" /> Reject Payment Dialog
          </button>
        </div>

        {/* Empty states */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Empty States</h2>
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4">
          {(["orders", "inventory", "riders"] as const).map((t) => (
            <button key={t} onClick={() => setEmptyTab(t)} className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${emptyTab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-8">
          {emptyTab === "orders"    && <EmptyTable icon={ShoppingCart} title="No Orders Found" desc="No orders match your current filter. Try adjusting your search or date range." action="Clear Filters" />}
          {emptyTab === "inventory" && <EmptyTable icon={Package}      title="No Inventory Found" desc="No inventory items match your search. Try a different item name or category." />}
          {emptyTab === "riders"    && <EmptyTable icon={Bike}         title="No Riders Found" desc="No riders are registered yet. Rider accounts are set up by the Manager." />}
        </div>

        {/* Skeleton loader */}
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Skeleton Loaders</h2>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0">
              <div className="w-10 h-10 rounded-xl bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3 bg-muted rounded animate-pulse" style={{ width: `${60 + i * 15}%` }} />
                <div className="h-2.5 bg-muted/70 rounded animate-pulse" style={{ width: `${40 + i * 10}%` }} />
              </div>
              <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
              <div className="h-8 w-16 bg-muted rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
