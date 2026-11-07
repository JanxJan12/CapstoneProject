import { ShoppingCart } from "lucide-react";
import { customerDrinkChoiceNames, customerMealChoiceName, customerUnitPrice } from "./customerCatalog";
import { formatCustomerCurrency } from "./customerRecordedCharges";
import type { CartItem } from "./customerTypes";

export function CustomerMenuCartAside({
  cart,
  checking,
  error,
  onCart,
  onCheckout,
}: {
  cart: CartItem[];
  checking: boolean;
  error: string | null;
  onCart: () => void;
  onCheckout: () => void;
}) {
  const subtotal = cart.reduce((sum, item) => sum + customerUnitPrice(item) * item.qty, 0);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <aside className="customer-menu-cart" aria-label="Cart summary">
      <div className="customer-menu-cart-heading">
        <h2>Cart</h2>
        {count > 0 ? <span>{count} {count === 1 ? "item" : "items"}</span> : null}
      </div>
      {cart.length === 0 ? (
        <div className="customer-menu-cart-empty">
          <ShoppingCart aria-hidden="true" />
          <p>Your cart is empty</p>
          <span>Choose a dish to start your order.</span>
        </div>
      ) : (
        <div className="customer-menu-cart-lines">
          {cart.map((item) => {
            const choices = [customerMealChoiceName(item.mealOption), customerDrinkChoiceNames(item.modifiers)].filter(Boolean).join(", ");
            return (
              <div className="customer-menu-cart-line" key={item.lineKey}>
                <span className="customer-menu-cart-qty">{item.qty}×</span>
                <div>
                  <strong>{item.name}</strong>
                  {choices ? <small>{choices}</small> : null}
                  {!item.available ? <small>Unavailable today</small> : null}
                </div>
                <span>{formatCustomerCurrency(customerUnitPrice(item) * item.qty)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="customer-menu-cart-footer">
        <div className="customer-menu-cart-subtotal"><span>Items subtotal</span><strong>{formatCustomerCurrency(subtotal)}</strong></div>
        <p>Delivery fee and final total are confirmed at checkout.</p>
        {error ? <p role="alert" className="customer-menu-cart-error">{error}</p> : null}
        <button type="button" onClick={onCheckout} disabled={cart.length === 0 || checking} className="customer-menu-cart-checkout">
          {checking ? "Checking availability…" : "Continue to checkout"}
        </button>
        {cart.length > 0 ? <button type="button" onClick={onCart} className="customer-menu-cart-edit">Edit cart</button> : null}
      </div>
    </aside>
  );
}
