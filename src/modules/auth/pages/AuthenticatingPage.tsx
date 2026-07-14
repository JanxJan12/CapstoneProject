import { UtensilsCrossed, Lock, CheckCircle, Loader2 } from "lucide-react";

export function AuthenticatingPage() {
  return (
    <div className="min-h-full bg-background flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-7 text-center max-w-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <UtensilsCrossed className="text-white w-4 h-4" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-bold text-xl text-foreground tracking-tight leading-none">RRJ Food-House</div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 tracking-widest uppercase">Management System</div>
          </div>
        </div>
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" style={{ animationDuration: "0.9s" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Authenticating...</h2>
          <p className="text-sm text-muted-foreground mt-1">Checking account permissions...</p>
        </div>
        <div className="w-full flex flex-col gap-2">
          {[{ l: "Verifying credentials", done: true }, { l: "Checking permissions", active: true }, { l: "Loading workspace" }].map((s) => (
            <div key={s.l} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${s.done ? "bg-green-50 border-green-200" : s.active ? "bg-accent border-primary/20" : "bg-card border-border"}`}>
              {s.done ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> : s.active ? <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />}
              <span className={`text-xs font-medium ${s.done ? "text-green-700" : s.active ? "text-foreground" : "text-muted-foreground"}`}>{s.l}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">You will be redirected based on your assigned role.</p>
      </div>
    </div>
  );
}
