import { UtensilsCrossed, Loader2 } from "lucide-react";

export function SplashScreen() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 bg-primary flex flex-col items-center justify-center gap-5 px-8">
        <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center"><UtensilsCrossed className="w-8 h-8 text-white" strokeWidth={2} /></div>
        <div className="text-center"><p className="text-white font-bold text-xl">RRJ Rider</p><p className="text-red-200 text-[9px] mt-1 uppercase tracking-widest">Delivery App</p></div>
        <Loader2 className="w-7 h-7 text-white/60 animate-spin" />
      </div>
      <p className="text-center text-red-300 text-[9px] pb-3 flex-shrink-0 bg-primary">v1.0.0 · RRJ Food-House</p>
    </div>
  );
}
