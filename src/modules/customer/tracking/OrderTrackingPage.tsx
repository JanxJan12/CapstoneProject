import { UtensilsCrossed, ShoppingCart, Check, Loader2, ChefHat } from "lucide-react";

function CustNav() {
  return (
    <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center"><UtensilsCrossed className="w-3.5 h-3.5 text-white" strokeWidth={2.5} /></div>
        <span className="font-bold text-sm text-foreground">RRJ Food-House</span>
      </div>
      <div className="flex items-center gap-3">
        {["Home", "Menu", "Track Order"].map((l) => <button key={l} className="text-xs font-semibold text-muted-foreground hover:text-foreground">{l}</button>)}
        <button className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-amber-800">
          <ShoppingCart className="w-3.5 h-3.5" />Cart
        </button>
      </div>
    </header>
  );
}

export function OrderTrackingPage() {
  const steps = ["Waiting for Payment Verification", "Confirmed", "Preparing", "Ready", "Waiting for Rider", "Rider Accepted", "Picked Up", "Out for Delivery", "Delivered"];
  const currentStep = 2;
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <CustNav />
      <div className="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-6 py-5">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="bg-primary px-5 py-4">
            <p className="text-white text-[9px] font-bold uppercase tracking-wide mb-0.5">Order Tracker</p>
            <p className="text-white font-bold text-base">ORD-1047</p>
            <p className="text-red-200 text-[10px] mt-0.5">Estimated: 30–45 minutes</p>
          </div>
          <div className="p-5">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800">Your order is being prepared in the kitchen.</p>
            </div>
            {steps.map((step, i) => (
              <div key={step} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${i < currentStep ? "bg-green-500 border-green-500" : i === currentStep ? "bg-primary border-primary" : "border-border bg-white"}`}>
                    {i < currentStep ? <Check className="w-3 h-3 text-white" /> : i === currentStep ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : null}
                  </div>
                  {i < steps.length - 1 && <div className={`w-0.5 h-5 ${i < currentStep ? "bg-green-400" : "bg-border"}`} />}
                </div>
                <p className={`text-[10px] pb-4 leading-tight ${i <= currentStep ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
