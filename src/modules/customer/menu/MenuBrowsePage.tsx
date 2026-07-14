import { UtensilsCrossed, ShoppingCart, Plus } from "lucide-react";
import { menuItems } from "../../../data/mockData";

type CartItem = { id: number; name: string; price: number; qty: number };

function CustNav({ cartCount }: { cartCount: number }) {
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
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center">{cartCount}</span>
        </button>
      </div>
    </header>
  );
}

export function MenuBrowsePage({ cart, onAddToCart }: { cart: CartItem[]; onAddToCart: (item: typeof menuItems[0]) => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <CustNav cartCount={cart.reduce((s, c) => s + c.qty, 0)} />
      <div className="flex-1 overflow-y-auto px-8 py-5">
        <div className="flex gap-2 mb-5 flex-wrap">
          {["All", "Viands", "Soups", "Rice", "Vegetables", "Beverages"].map((c) => (
            <button key={c} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${c === "All" ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {menuItems.filter((m) => m.available).map((item) => (
            <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md cursor-pointer">
              <div className="h-20 bg-muted/60 flex items-center justify-center"><UtensilsCrossed className="w-6 h-6 text-muted-foreground/25" /></div>
              <div className="p-3">
                <p className="font-bold text-xs text-foreground mb-0.5">{item.name}</p>
                <p className="text-[9px] text-muted-foreground mb-2">{item.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-primary">₱{item.price}</span>
                  <button onClick={() => onAddToCart(item)} className="px-2 py-1 rounded-lg bg-primary text-white text-[9px] font-semibold hover:bg-amber-800 flex items-center gap-0.5"><Plus className="w-2.5 h-2.5" />Add</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
