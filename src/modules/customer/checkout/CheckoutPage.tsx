import { UtensilsCrossed, ShoppingCart, Upload } from "lucide-react";

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

export function CheckoutPage({ cart }: { cart: CartItem[] }) {
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <CustNav cartCount={cart.reduce((s, c) => s + c.qty, 0)} />
      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          <div className="col-span-3 flex flex-col gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="font-bold text-sm mb-3">Sign In</p>
              <button style={{ minHeight: 40 }} className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-border bg-white text-xs font-semibold">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Continue with Google
              </button>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="font-bold text-sm mb-3">Delivery Details</p>
              <div className="flex flex-col gap-2">
                {[{ l: "Full Name", v: "Maria Santos" }, { l: "Contact Number", v: "09171234567" }, { l: "Delivery Address", v: "123 Main St., Manila" }, { l: "Landmark", v: "Near Jollibee" }].map((f) => (
                  <div key={f.l} className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">{f.l}</label>
                    <input defaultValue={f.v} className="px-3 py-2 text-xs bg-input-background border border-border rounded-lg focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="font-bold text-sm mb-1">Upload GCash Proof</p>
              <p className="text-[9px] text-muted-foreground mb-3">Send to <span className="font-bold text-foreground">09171234567</span> (RRJ Food-House)</p>
              <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary/40 cursor-pointer">
                <Upload className="w-6 h-6 text-muted-foreground/50" />
                <p className="text-xs font-semibold text-foreground">Upload Screenshot</p>
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <div className="bg-card rounded-xl border border-border p-4 sticky top-0">
              <p className="font-bold text-sm mb-3">Order Summary</p>
              <div className="flex flex-col gap-1 text-xs mb-3">
                {cart.map((c) => <div key={c.id} className="flex justify-between"><span className="text-muted-foreground">{c.name} ×{c.qty}</span><span className="font-semibold">₱{c.price * c.qty}</span></div>)}
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-border"><span>Total</span><span className="text-primary">₱{total + 50}</span></div>
              </div>
              <button className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-xs hover:bg-amber-800">Place Order</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
