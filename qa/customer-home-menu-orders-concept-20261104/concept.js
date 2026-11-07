const screens = [...document.querySelectorAll('[data-screen]')];
const navLinks = [...document.querySelectorAll('[data-nav]')];
const sampleDishes = {
  'chicken-bicol-express': { name: 'Chicken Bicol Express', price: 130 },
  'crispy-beef-tadyang': { name: 'Crispy Beef Tadyang', price: 185 },
  'fried-rice': { name: 'Fried Rice', price: 45 },
};
const cart = new Map();
const money = (amount) => `₱${amount.toFixed(2)}`;

function renderCartList(list) {
  list.replaceChildren();
  for (const [id, quantity] of cart) {
    const dish = sampleDishes[id];
    const row = document.createElement('li');
    const label = document.createElement('span');
    const amount = document.createElement('strong');
    label.textContent = `${quantity} × ${dish.name}`;
    amount.textContent = money(quantity * dish.price);
    row.append(label, amount);
    list.append(row);
  }
}

function renderCart() {
  const quantity = [...cart.values()].reduce((sum, count) => sum + count, 0);
  const subtotal = [...cart].reduce((sum, [id, count]) => sum + sampleDishes[id].price * count, 0);
  document.querySelector('#header-cart-count').textContent = quantity;
  document.querySelector('#mobile-cart-count').textContent = quantity;
  document.querySelector('#mobile-cart-count').hidden = quantity === 0;
  document.querySelector('#side-cart-empty').hidden = quantity > 0;
  document.querySelector('#cart-state-title').textContent = quantity ? 'Your items' : 'Your cart is empty';
  document.querySelector('#cart-full-total').hidden = quantity === 0;
  document.querySelector('#side-checkout').disabled = quantity === 0;
  document.querySelector('#cart-checkout').disabled = quantity === 0;
  document.querySelector('#side-total').textContent = money(subtotal);
  document.querySelector('#cart-total').textContent = money(subtotal);
  document.querySelector('#checkout-subtotal').textContent = money(subtotal);
  renderCartList(document.querySelector('#side-cart-items'));
  renderCartList(document.querySelector('#cart-items'));
  renderCartList(document.querySelector('#checkout-items'));
}

document.querySelectorAll('#side-checkout, #cart-checkout').forEach((button) => {
  button.addEventListener('click', () => { location.hash = '#checkout'; });
});

document.querySelectorAll('[data-add]').forEach((button) => {
  button.addEventListener('click', () => {
    const id = button.dataset.add;
    const dish = sampleDishes[id];
    if (!dish) return;
    cart.set(id, (cart.get(id) || 0) + 1);
    renderCart();
    const toast = document.querySelector('#cart-toast');
    toast.textContent = `${dish.name} added to cart`;
    toast.hidden = false;
    window.clearTimeout(window.cartToastTimer);
    window.cartToastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  });
});
function showScreen() {
  const requested = location.hash.slice(1) || 'home';
  const screen = screens.find((item) => item.dataset.screen === requested) ? requested : 'home';
  document.querySelector('#cart-toast').hidden = true;
  screens.forEach((item) => { item.hidden = item.dataset.screen !== screen; });
  navLinks.forEach((link) => {
    const selected = link.dataset.nav === (screen === 'orders' || screen === 'order-detail' ? 'profile' : screen === 'checkout' ? 'cart' : screen);
    if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showScreen);
showScreen();
renderCart();
