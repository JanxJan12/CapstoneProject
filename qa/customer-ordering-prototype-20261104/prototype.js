const screens = new Set(["home", "menu", "detail", "cart", "checkout", "tracking", "orders", "account"]);
const links = [...document.querySelectorAll('a[href^="#"]')];
const screenNodes = [...document.querySelectorAll(".screen[data-screen]")];
const qtyOutputs = [document.querySelector("#detail-qty"), document.querySelector("#cart-qty")];
let quantity = 1;
let category = "All";

function money(amount) {
  return `₱${amount.toFixed(2)}`;
}

function updateQuantity(next) {
  quantity = Math.max(1, Math.min(99, next));
  const subtotal = 130 * quantity;
  qtyOutputs.forEach((node) => { node.textContent = String(quantity); });
  document.querySelector("#detail-price").textContent = money(130);
  document.querySelector("#detail-add").textContent = `Add to cart · ${money(subtotal)}`;
  document.querySelector("#cart-count").textContent = String(quantity);
  document.querySelector("#cart-item-count").textContent = `${quantity} ${quantity === 1 ? "item" : "items"}`;
  document.querySelector("#cart-line-total").textContent = money(subtotal);
  document.querySelector("#cart-subtotal").textContent = money(subtotal);
  document.querySelector("#checkout-item-name").textContent = `${quantity} × Chicken Bicol Express`;
  document.querySelector("#checkout-item-price").textContent = money(subtotal);
  document.querySelector("#checkout-subtotal").textContent = money(subtotal);
}

function showScreen() {
  const requested = location.hash.slice(1) || "menu";
  const current = screens.has(requested) ? requested : "menu";
  screenNodes.forEach((node) => { node.hidden = node.dataset.screen !== current; });
  links.forEach((link) => {
    const destination = link.getAttribute("href").slice(1);
    const active = destination === current || (current === "detail" && destination === "menu") || (current === "checkout" && destination === "cart");
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  document.title = `${current[0].toUpperCase()}${current.slice(1)} · RRJ customer prototype`;
}

function filterDishes() {
  const term = document.querySelector("#dish-search").value.trim().toLowerCase();
  const available = [...document.querySelectorAll("#dish-list .dish")];
  const unavailable = [...document.querySelectorAll("#unavailable-list .dish")];
  const matches = (node) => (category === "All" || node.dataset.category === category) && node.dataset.name.toLowerCase().includes(term);
  [...available, ...unavailable].forEach((node) => { node.hidden = !matches(node); });
  const availableCount = available.filter((node) => !node.hidden).length;
  const unavailableCount = unavailable.filter((node) => !node.hidden).length;
  document.querySelector("#results-count").textContent = `${availableCount} shown`;
  document.querySelector(".unavailable-title").hidden = unavailableCount === 0;
  document.querySelector("#empty-result").hidden = availableCount + unavailableCount > 0;
}

document.querySelectorAll(".qty-minus").forEach((button) => button.addEventListener("click", () => updateQuantity(quantity - 1)));
document.querySelectorAll(".qty-plus").forEach((button) => button.addEventListener("click", () => updateQuantity(quantity + 1)));
document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => {
  category = button.dataset.category;
  document.querySelectorAll(".filter").forEach((filter) => {
    const active = filter === button;
    filter.classList.toggle("active", active);
    filter.setAttribute("aria-pressed", String(active));
  });
  filterDishes();
}));
document.querySelector("#dish-search").addEventListener("input", filterDishes);
document.querySelector("#google-demo").addEventListener("click", () => { document.querySelector("#demo-notice").hidden = false; });
window.addEventListener("hashchange", showScreen);
showScreen();
updateQuantity(1);
