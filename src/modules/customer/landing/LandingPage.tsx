import { useState } from "react";
import { ShoppingCart, Clock, Plus, UtensilsCrossed } from "lucide-react";
import { menuItems } from "../../../data/mockData";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";
import rrjPhoto from "@/assets/brand/rrj-restaurant.jpg";

type CartItem = { id: number; name: string; price: number; qty: number };

function CustNav({ cartCount }: { cartCount: number }) {
  return (
    <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 overflow-hidden flex-shrink-0">
          <ImageWithFallback
            src={rrjLogo}
            alt="RRJ's Food-Haus logo"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="font-bold text-sm text-foreground">
          RRJ's Food-Haus
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-emerald-700">
          Halal
        </span>
      </div>
      <div className="flex items-center gap-3">
        {["Home", "Menu", "Track Order"].map((l) => (
          <button
            key={l}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {l}
          </button>
        ))}
        <button className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-amber-800">
          <ShoppingCart className="w-3.5 h-3.5" />
          Cart
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-white text-[9px] font-bold flex items-center justify-center">
            {cartCount}
          </span>
        </button>
      </div>
    </header>
  );
}

export function LandingPage({
  cart,
  onAddToCart,
}: {
  cart: CartItem[];
  onAddToCart: (item: (typeof menuItems)[0]) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <CustNav cartCount={cart.reduce((s, c) => s + c.qty, 0)} />
      <div className="relative h-56 overflow-hidden flex-shrink-0">
        <ImageWithFallback
          src={rrjPhoto}
          alt="RRJ's Food-Haus restaurant at night"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/85 via-zinc-900/50 to-transparent flex items-center px-10">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-white mb-2 leading-tight">
              Halal Filipino Food, Delivered
            </h1>
            <p className="text-white/70 text-xs mb-4">
              Fresh, halal home-cooked meals from RRJ's Food-Haus.
            </p>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-amber-800">
                Order Now
              </button>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" />
                7AM – 9PM
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-5">
        <p className="text-sm font-bold text-foreground mb-3">
          Browse by Category
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-5">
          {["Viands", "Soups", "Rice", "Vegetables", "Beverages"].map((c) => (
            <div
              key={c}
              className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-primary/40 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4 text-primary" />
              </div>
              <span className="text-[10px] font-semibold text-foreground">
                {c}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm font-bold text-foreground mb-3">Popular Items</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {menuItems
            .filter((m) => m.available)
            .slice(0, 4)
            .map((item) => (
              <div
                key={item.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md cursor-pointer"
              >
                <div className="h-20 bg-muted/60 flex items-center justify-center">
                  <UtensilsCrossed className="w-6 h-6 text-muted-foreground/25" />
                </div>
                <div className="p-3">
                  <p className="font-bold text-xs text-foreground mb-0.5">
                    {item.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground mb-2">
                    {item.desc}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-primary">
                      ₱{item.price}
                    </span>
                    <button
                      onClick={() => onAddToCart(item)}
                      className="px-2 py-1 rounded-lg bg-primary text-white text-[9px] font-semibold hover:bg-amber-800 flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
