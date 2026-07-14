import { UtensilsCrossed, ShoppingCart, Minus, Plus } from "lucide-react";

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

export function CartPage({ cart }: { cart: CartItem[] }) {
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <CustNav cartCount={cart.reduce((s, c) => s + c.qty, 0)} />
      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-6 py-5">
        <p className="text-base font-bold mb-4">My Cart</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          <div className="md:col-span-3 bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
            {cart.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-lg bg-muted/60 flex-shrink-0 flex items-center justify-center"><UtensilsCrossed className="w-4 h-4 text-muted-foreground/40" /></div>
                <div className="flex-1"><p className="text-xs font-semibold">{c.name}</p><p className="text-[9px] text-muted-foreground">₱{c.price}</p></div>
                <div className="flex items-center gap-1.5">
                  <button className="w-5 h-5 rounded-full bg-muted flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button>
                  <span className="text-xs font-bold w-4 text-center">{c.qty}</span>
                  <button className="w-5 h-5 rounded-full bg-muted flex items-center justify-center"><Plus className="w-2.5 h-2.5" /></button>
                </div>
                <p className="w-12 text-right text-xs font-bold">₱{c.price * c.qty}</p>
              </div>
            ))}
          </div>
          <div className="md:col-span-2 bg-card rounded-xl border border-border p-4">
            <p className="font-bold text-sm mb-3">Summary</p>
            <div className="flex flex-col gap-1 text-xs mb-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-semibold">₱{total}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="font-semibold">₱50</span></div>
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-border"><span>Total</span><span className="text-primary">₱{total + 50}</span></div>
            </div>
            <button className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-xs hover:bg-amber-800">Proceed to Checkout</button>
          </div>
        </div>
      </div>
    </div>
  );
}
