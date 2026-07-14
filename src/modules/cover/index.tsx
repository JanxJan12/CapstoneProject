import { UtensilsCrossed } from "lucide-react";
import { PAGE_LIST } from "../../constants";

export function CoverPage() {
  const colors = [
    { name: "Primary Red", hex: "#DC2626", cls: "bg-[#DC2626]", role: "Buttons, active states, branding" },
    { name: "Dark Red", hex: "#B91C1C", cls: "bg-[#B91C1C]", role: "Hover state, pressed" },
    { name: "Light Red", hex: "#FEF2F2", cls: "bg-[#FEF2F2] border border-red-100", role: "Error tints, secondary surfaces" },
    { name: "Foreground", hex: "#111118", cls: "bg-[#111118]", role: "Primary text" },
    { name: "Muted Text", hex: "#6B7280", cls: "bg-[#6B7280]", role: "Captions, labels" },
    { name: "Background", hex: "#F4F4F6", cls: "bg-[#F4F4F6] border border-border", role: "Page background" },
    { name: "Card", hex: "#FFFFFF", cls: "bg-white border border-border", role: "Card surfaces, panels" },
    { name: "Border", hex: "#E5E5E9", cls: "bg-[#E5E5E9]", role: "Dividers, input borders" },
    { name: "Success", hex: "#22C55E", cls: "bg-[#22C55E]", role: "Verified, delivered, healthy" },
    { name: "Warning", hex: "#F59E0B", cls: "bg-[#F59E0B]", role: "Pending, low stock, caution" },
    { name: "Info", hex: "#3B82F6", cls: "bg-[#3B82F6]", role: "Delivery, confirmed, info" },
    { name: "Neutral", hex: "#71717A", cls: "bg-[#71717A]", role: "Walk-in, offline, cancelled" },
  ];
  return (
    <div className="max-w-5xl">
      {/* Hero */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-8">
        <div className="h-2 bg-gradient-to-r from-red-700 via-red-500 to-red-400" />
        <div className="p-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                <UtensilsCrossed className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="font-bold text-xl text-foreground">RRJ Food-House</p>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Management System</p>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">UI/UX Blueprint</h1>
            <p className="text-muted-foreground text-sm max-w-lg">Complete design system and screen documentation for a Web- and Mobile-Based Foodhouse Management System for Order Processing, Inventory Management, and Delivery Operations.</p>
            <div className="flex gap-2 mt-5">
              {["Manager Portal", "Cashier POS", "Kitchen Queue", "Customer Website", "Rider App"].map((t) => (
                <span key={t} className="px-3 py-1 rounded-full bg-muted text-xs font-semibold text-muted-foreground border border-border">{t}</span>
              ))}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-8">
            <div className="grid grid-cols-2 gap-3">
              {[{ n: "9", l: "Modules" }, { n: "60+", l: "Screens" }, { n: "5", l: "User Roles" }, { n: "20+", l: "States" }].map((s) => (
                <div key={s.l} className="bg-muted/60 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{s.n}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Color Palette */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-sm font-bold text-foreground mb-4">Color System</p>
          <div className="grid grid-cols-2 gap-2">
            {colors.map((c) => (
              <div key={c.name} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${c.cls}`} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-sm font-bold text-foreground mb-4">Typography — Inter</p>
          <div className="flex flex-col gap-3">
            {[
              { size: "24px / Bold", sample: "Page Heading", cls: "text-2xl font-bold" },
              { size: "18px / Bold", sample: "Section Title", cls: "text-lg font-bold" },
              { size: "14px / Semibold", sample: "Card Title & Labels", cls: "text-sm font-semibold" },
              { size: "13px / Regular", sample: "Body text and descriptions", cls: "text-[13px]" },
              { size: "11px / Medium", sample: "Captions, timestamps, meta", cls: "text-[11px] font-medium text-muted-foreground" },
              { size: "10px / Bold + CAPS", sample: "BADGE • TABLE HEADER • STATUS", cls: "text-[10px] font-bold uppercase tracking-wider text-muted-foreground" },
            ].map((t) => (
              <div key={t.size} className="flex items-baseline gap-3 py-2 border-b border-border last:border-0">
                <p className={`flex-1 ${t.cls}`}>{t.sample}</p>
                <p className="text-[9px] font-mono text-muted-foreground/60 flex-shrink-0">{t.size}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Spacing */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-sm font-bold text-foreground mb-4">8pt Spacing Scale</p>
          <div className="flex flex-col gap-2">
            {[{ t: "4px", w: 4, label: "0.5 — tight" }, { t: "8px", w: 8, label: "1 — xs" }, { t: "16px", w: 16, label: "2 — sm" }, { t: "24px", w: 24, label: "3 — md" }, { t: "32px", w: 32, label: "4 — lg" }, { t: "48px", w: 48, label: "6 — xl" }, { t: "64px", w: 64, label: "8 — 2xl" }].map((s) => (
              <div key={s.t} className="flex items-center gap-3">
                <div className="bg-primary/80 rounded" style={{ width: s.w, height: 14 }} />
                <p className="text-[10px] font-mono text-muted-foreground">{s.t} — {s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Border radius */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-sm font-bold text-foreground mb-4">Border Radius</p>
          <div className="flex flex-col gap-4">
            {[{ r: "4px", cls: "rounded", label: "Badges, chips" }, { r: "8px", cls: "rounded-lg", label: "Inputs, rows" }, { r: "12px", cls: "rounded-xl", label: "Cards, panels" }, { r: "16px", cls: "rounded-2xl", label: "Modals, sheets" }, { r: "999px", cls: "rounded-full", label: "Pills, avatars" }].map((s) => (
              <div key={s.r} className="flex items-center gap-3">
                <div className={`w-10 h-6 bg-primary/20 border-2 border-primary/40 flex-shrink-0 ${s.cls}`} />
                <div>
                  <p className="text-[10px] font-semibold text-foreground">{s.r}</p>
                  <p className="text-[9px] text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User roles */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-sm font-bold text-foreground mb-4">User Roles</p>
          <div className="flex flex-col gap-3">
            {[
              { role: "Manager", platform: "Web", color: "bg-violet-100 text-violet-700", desc: "Full system access" },
              { role: "Cashier", platform: "Web", color: "bg-blue-100 text-blue-700", desc: "POS + Payments" },
              { role: "Kitchen Staff", platform: "Web", color: "bg-amber-100 text-amber-700", desc: "Kitchen queue only" },
              { role: "Customer", platform: "Web", color: "bg-red-100 text-red-700", desc: "Browse + Order" },
              { role: "Rider", platform: "Android", color: "bg-green-100 text-green-700", desc: "Mobile delivery app" },
            ].map((r) => (
              <div key={r.role} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.color}`}>{r.role}</span>
                  <span className="text-[10px] text-muted-foreground">{r.desc}</span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.platform}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Page index */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <p className="text-sm font-bold text-foreground mb-4">Page Index</p>
        <div className="grid grid-cols-2 gap-3">
          {PAGE_LIST.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <span className="w-8 h-8 rounded-lg bg-primary text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{p.num}</span>
              <div>
                <p className="text-xs font-semibold text-foreground">{p.label}</p>
                <p className="text-[9px] text-muted-foreground">{p.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
