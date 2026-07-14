import { UtensilsCrossed } from "lucide-react";

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-red-400" />
        {children}
      </div>
    </div>
  );
}

export function AuthLogo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className={`flex items-center gap-${size === "md" ? "3" : "2.5"}`}>
      <div className={`${size === "md" ? "w-10 h-10 rounded-xl" : "w-9 h-9 rounded-xl"} bg-primary flex items-center justify-center shadow-sm`}>
        <UtensilsCrossed className="text-white w-4 h-4" strokeWidth={2.5} />
      </div>
      <div>
        <div className={`font-bold ${size === "md" ? "text-xl" : "text-base"} text-foreground tracking-tight leading-none`}>RRJ Food-House</div>
        <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 tracking-widest uppercase">Management System</div>
      </div>
    </div>
  );
}
