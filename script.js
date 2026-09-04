const BUSINESS_WHATSAPP_NUMBER = "233599907434"; // country code + number, no + or spaces
const BUSINESS_EMAIL = "orders@aoandbeverages.com";

const PRODUCTS = [
  {
    id: "A",
    name: "Brukina",
    category: "Beverage",
    type: "fixed",
    description:
      "A rich, authentic traditional blend of smooth fermented yoghurt and slow-cooked millet, accented with sweet coconut flakes and wholesome tigernut.",
    image:
      "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=300&q=80",
    size: "350 ml",
    price: 25,
    ingredients: [
      { id: "yoghurt", name: "Yoghurt" },
      { id: "millet", name: "Millet" },
      { id: "coconut flakes", name: "Coconut Flakes" },
      { id: "tigernut", name: "Tigernut" },
    ],
  },
  {
    id: "B",
    name: "Fresh Yoghurt Drink",
    category: "Beverage",
    type: "flavor-size",
    description:
      "Creamy, refreshing, and full of flavor. Silky smooth drinkable yoghurt crafted daily to deliver a cool burst of goodness in every sip.",
    image:
      "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=300&q=80",
    flavors: [
      { id: "Vanilla", name: "Vanilla" },
      { id: "strawberry", name: "Strawberry" },
    ],
    sizes: [
      { id: "500ml", label: "500 ml", price: 25 },
      { id: "300ml", label: "300 ml", price: 15 },
      { id: "250ml", label: "250 ml", price: 12 },
    ],
  },
  {
    id: "C",
    name: "Parfait",
    category: "Beverage",
    type: "classic-custom",
    description:
      "Indulgent layers of rich yoghurt, decadent toppings, and savory glazes—perfect as an energizing snack or a wholesome treat.",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=300&q=80",
    size: "360 ml",
    price: 25,
    ingredients: [
      { id: "yoghurt", name: "Yoghurt" },
      { id: "granola", name: "Granola" },
      { id: "red apples", name: "Red Apples" },
      { id: "red grapes", name: "Red Grapes" },
      { id: "mangoes", name: "Mangoes" },
      { id: "coconut flakes", name: "Coconut Flakes" },
    ],
  },
  {
    id: "D",
    name: "Greek Yoghurt",
    category: "Beverage",
    type: "size-sweetness",
    description:
      "Ultra-thick, velvety, and high in protein. Pure strained yoghurt available sweetened or completely unsweetened for a healthier option.",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=300&q=80",
    sizes: [
      { id: "500ml", label: "500 ml" },
      { id: "1l", label: "1 Liter" },
    ],
    sweetness: [
      {
        id: "sweetened",
        name: "Sweetened",
        prices: { "500ml": 50, "1l": 100 },
      },
      {
        id: "unsweetened",
        name: "Unsweetened",
        prices: { "500ml": 45, "1l": 95 },
      },
    ],
  },
];

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CURRENCY = "GHS";

let cart = {};

const selectionState = {};
PRODUCTS.forEach((p) => {
  if (p.type === "flavor-size") {
    selectionState[p.id] = { flavorId: p.flavors[0].id, sizeId: p.sizes[0].id };
  } else if (p.type === "size-sweetness") {
    selectionState[p.id] = {
      sizeId: p.sizes[0].id,
      sweetnessId: p.sweetness[0].id,
    };
  } else if (p.type === "classic-custom") {
    selectionState[p.id] = { mode: "classic", removed: new Set() };
  } else {
    selectionState[p.id] = {};
  }
});

function computeUnitPrice(product, sel) {
  switch (product.type) {
    case "fixed":
    case "classic-custom":
      return product.price;
    case "flavor-size": {
      const size =
        product.sizes.find((s) => s.id === sel.sizeId) || product.sizes[0];
      return size.price;
    }
    case "size-sweetness": {
      const sweetness =
        product.sweetness.find((sw) => sw.id === sel.sweetnessId) ||
        product.sweetness[0];
      return sweetness.prices[sel.sizeId] || 0;
    }
    default:
      return 0;
  }
}

function lineDescription(product, entry) {
  switch (product.type) {
    case "fixed":
      return product.size || "";
    case "flavor-size": {
      const flavor = product.flavors.find((f) => f.id === entry.flavorId);
      const size = product.sizes.find((s) => s.id === entry.sizeId);
      return [flavor?.name, size?.label].filter(Boolean).join(" · ");
    }
    case "size-sweetness": {
      const size = product.sizes.find((s) => s.id === entry.sizeId);
      const sweet = product.sweetness.find((s) => s.id === entry.sweetnessId);
      return [size?.label, sweet?.name].filter(Boolean).join(" · ");
    }
    case "classic-custom": {
      if (entry.mode === "classic") {
        return `Classic · ${product.size}`;
      }
      const removedNames = (entry.removed || [])
        .map((id) => product.ingredients.find((i) => i.id === id)?.name)
        .filter(Boolean);
      const base = "Customized";
      const removedText = removedNames.length
        ? ` (No ${removedNames.join(", ")})`
        : "";
      return `${base}${removedText} · ${product.size}`;
    }
    default:
      return "";
  }
}

function getToggleLabel(product) {
  switch (product.type) {
    case "fixed":
      return "Show ingredients";
    case "flavor-size":
      return "Choose flavor & size";
    case "classic-custom":
      return "Classic or customize";
    case "size-sweetness":
      return "Choose size & sweetness";
    default:
      return "Options";
  }
}

/* ============================================================
   RENDER PRODUCT LIST
============================================================ */
const productList = document.getElementById("productList");

function renderCustomizePanel(product) {
  const sel = selectionState[product.id];

  if (product.type === "fixed") {
    const items = product.ingredients
      .map(
        (ing) => `
      <li class="ingredient-item checked readonly-item" data-type="readonly">
        <span class="chk">${CHECK_ICON}</span>
        <span class="ingredient-label">${ing.name}</span>
      </li>
    `,
      )
      .join("");
    return `
      <div class="customize-inner single">
        <div class="ingredient-group">
          <h4>Ingredients</h4>
          <ul class="ingredient-list">${items}</ul>
          <p class="readonly-note">Ingredients are fixed and not customizable.</p>
        </div>
      </div>
    `;
  }

  if (product.type === "flavor-size") {
    const flavorBtns = product.flavors
      .map(
        (f) => `
      <button type="button" class="pill-btn ${f.id === sel.flavorId ? "active" : ""}" data-flavor="${f.id}">${f.name}</button>
    `,
      )
      .join("");
    const sizeBtns = product.sizes
      .map(
        (s) => `
      <button type="button" class="pill-btn ${s.id === sel.sizeId ? "active" : ""}" data-size="${s.id}">${s.label} &middot; ${CURRENCY} ${s.price}</button>
    `,
      )
      .join("");
    return `
      <div class="customize-inner single">
        <div class="option-group">
          <h4>Flavor</h4>
          <div class="pill-row">${flavorBtns}</div>
        </div>
        <div class="option-group">
          <h4>Size</h4>
          <div class="pill-row">${sizeBtns}</div>
        </div>
      </div>
    `;
  }

  if (product.type === "size-sweetness") {
    const activeSweetness =
      product.sweetness.find((sw) => sw.id === sel.sweetnessId) ||
      product.sweetness[0];

    const sizeBtns = product.sizes
      .map((s) => {
        const price = activeSweetness.prices[s.id];
        return `<button type="button" class="pill-btn ${s.id === sel.sizeId ? "active" : ""}" data-size="${s.id}">${s.label} &middot; ${CURRENCY} ${price}</button>`;
      })
      .join("");

    const sweetBtns = product.sweetness
      .map(
        (sw) => `
      <button type="button" class="pill-btn ${sw.id === sel.sweetnessId ? "active" : ""}" data-sweetness="${sw.id}">${sw.name}</button>
    `,
      )
      .join("");

    return `
      <div class="customize-inner single">
        <div class="option-group">
          <h4>Sweetness</h4>
          <div class="pill-row">${sweetBtns}</div>
        </div>
        <div class="option-group">
          <h4>Size</h4>
          <div class="pill-row">${sizeBtns}</div>
        </div>
      </div>
    `;
  }

  if (product.type === "classic-custom") {
    const classicItems = product.ingredients
      .map(
        (ing) => `
      <li class="ingredient-item checked readonly-item" data-type="readonly">
        <span class="chk">${CHECK_ICON}</span>
        <span class="ingredient-label">${ing.name}</span>
      </li>
    `,
      )
      .join("");
    const customItems = product.ingredients
      .map((ing) => {
        const isRemoved = sel.removed.has(ing.id);
        return `
      <li class="ingredient-item ${isRemoved ? "removed" : "checked"}" data-type="custom-ing" data-id="${ing.id}">
        <span class="chk">${CHECK_ICON}</span>
        <span class="ingredient-label">${ing.name}</span>
      </li>
    `;
      })
      .join("");
    return `
      <div class="customize-inner single">
        <div class="option-group">
          <h4>Style</h4>
          <div class="pill-row">
            <button type="button" class="pill-btn ${sel.mode === "classic" ? "active" : ""}" data-mode="classic">Classic</button>
            <button type="button" class="pill-btn ${sel.mode === "custom" ? "active" : ""}" data-mode="custom">Customized</button>
          </div>
        </div>
        <div class="ingredient-group" style="display:${sel.mode === "classic" ? "block" : "none"}">
          <h4>Includes</h4>
          <ul class="ingredient-list">${classicItems}</ul>
          <p class="readonly-note">Classic ingredients are fixed and not customizable.</p>
        </div>
        <div class="ingredient-group" style="display:${sel.mode === "custom" ? "block" : "none"}">
          <h4>Tap to remove</h4>
          <ul class="ingredient-list">${customItems}</ul>
        </div>
      </div>
    `;
  }

  return "";
}

function renderRowInner(product) {
  const sel = selectionState[product.id];
  const unitPrice = computeUnitPrice(product, sel);
  const metaSize =
    product.type === "fixed" || product.type === "classic-custom"
      ? ` &middot; ${product.size}`
      : "";

  return `
    <div class="product-main">
      <div class="product-art">
        <img src="${product.image}" alt="${product.name}" class="product-img" />
      </div>
      <div>
        <div class="product-cat">${product.category}${metaSize}</div>
        <h3>${product.name}</h3>
        <p class="product-desc">${product.description}</p>
        <button class="customize-toggle" data-action="toggle">
          ${getToggleLabel(product)}
          <svg viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="product-price-block">
        <span class="price" data-base-price>${CURRENCY} ${unitPrice}</span>
        <button class="add-btn" data-action="add">Add to order</button>
      </div>
    </div>
    <div class="customize-panel">
      ${renderCustomizePanel(product)}
    </div>
  `;
}

PRODUCTS.forEach((p, index) => {
  const row = document.createElement("div");
  row.className = `product-row reveal ${index % 2 === 0 ? "slide-left" : "slide-right"}`;
  row.dataset.id = p.id;
  row.innerHTML = renderRowInner(p);
  productList.appendChild(row);
});

function refreshRow(productId) {
  const row = productList.querySelector(`.product-row[data-id="${productId}"]`);
  if (!row) return;
  const wasOpen = row.classList.contains("open");
  const product = PRODUCTS.find((p) => p.id === productId);
  row.innerHTML = renderRowInner(product);
  if (wasOpen) row.classList.add("open");
}

/* ============================================================
   PRODUCT ROW INTERACTIONS
============================================================ */
productList.addEventListener("click", (e) => {
  const row = e.target.closest(".product-row");
  if (!row) return;
  const productId = row.dataset.id;
  const product = PRODUCTS.find((p) => p.id === productId);
  const sel = selectionState[productId];

  // toggle accordion
  const toggleBtn = e.target.closest('[data-action="toggle"]');
  if (toggleBtn) {
    row.classList.toggle("open");
    return;
  }

  // pill selections (flavor / size / sweetness / classic-custom mode)
  const pillBtn = e.target.closest(".pill-btn");
  if (pillBtn) {
    if (pillBtn.dataset.flavor) sel.flavorId = pillBtn.dataset.flavor;
    if (pillBtn.dataset.size) sel.sizeId = pillBtn.dataset.size;
    if (pillBtn.dataset.sweetness) sel.sweetnessId = pillBtn.dataset.sweetness;
    if (pillBtn.dataset.mode) sel.mode = pillBtn.dataset.mode;
    refreshRow(productId);
    return;
  }

  // toggle a customizable ingredient (classic-custom, "Customized" mode only)
  const ingredientItem = e.target.closest(".ingredient-item");
  if (ingredientItem && ingredientItem.dataset.type === "custom-ing") {
    const id = ingredientItem.dataset.id;
    if (sel.removed.has(id)) {
      sel.removed.delete(id);
    } else {
      sel.removed.add(id);
    }
    refreshRow(productId);
    return;
  }

  // add to order
  const addBtn = e.target.closest('[data-action="add"]');
  if (addBtn) {
    spawnRipple(addBtn, e);
    addProductToCart(product, row);
  }
});

function spawnRipple(btn, evt) {
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = evt.clientX - rect.left - size / 2 + "px";
  ripple.style.top = evt.clientY - rect.top - size / 2 + "px";
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

/* ============================================================
   NUMBER COUNT-UP ANIMATION (used for stats)
============================================================ */
function animateNumber(el, target, prefix = "", suffix = "") {
  const start = parseFloat(el.dataset.currentValue || "0");
  const duration = 400;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(start + (target - start) * eased);
    el.textContent = `${prefix}${value}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.dataset.currentValue = target;
    }
  }
  requestAnimationFrame(tick);
}

/* ============================================================
   SCROLL REVEAL
============================================================ */
const revealEls = document.querySelectorAll(".reveal, .reveal-side");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);
revealEls.forEach((el) => revealObserver.observe(el));

/* Stat count-up on scroll into view */
const statEls = document.querySelectorAll(".stat-num");
const statObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        el.dataset.currentValue = "0";
        animateNumber(el, target, "", suffix);
        statObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.5 },
);
statEls.forEach((el) => statObserver.observe(el));

/* Steps connector line */
const stepLine = document.getElementById("stepLine");
const stepsGrid = document.getElementById("stepsGrid");
const stepEls = document.querySelectorAll(".step");
const stepsObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        stepLine.classList.add("in");
        stepEls.forEach((el, i) => {
          setTimeout(() => el.classList.add("in"), i * 220);
        });
        stepsObserver.disconnect();
      }
    });
  },
  { threshold: 0.3 },
);
stepsObserver.observe(stepsGrid);

/* ============================================================
   CART LOGIC
============================================================ */
const cartCountEl = document.getElementById("cartCount");
const cartBtn = document.getElementById("cartBtn");
const cartListEl = document.getElementById("cartList");
const cartTotalEl = document.getElementById("cartTotal");
const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("backdrop");

function buildCartKey(entry) {
  const product = PRODUCTS.find((p) => p.id === entry.productId);
  switch (product.type) {
    case "fixed":
      return `${entry.productId}`;
    case "flavor-size":
      return `${entry.productId}::f(${entry.flavorId})::s(${entry.sizeId})`;
    case "size-sweetness":
      return `${entry.productId}::s(${entry.sizeId})::sw(${entry.sweetnessId})`;
    case "classic-custom":
      return `${entry.productId}::m(${entry.mode})::r(${[...entry.removed].sort().join(",")})`;
    default:
      return entry.productId;
  }
}

function addProductToCart(product, rowEl) {
  const sel = selectionState[product.id];
  let entry = { productId: product.id, qty: 1 };

  if (product.type === "flavor-size") {
    entry.flavorId = sel.flavorId;
    entry.sizeId = sel.sizeId;
  } else if (product.type === "size-sweetness") {
    entry.sizeId = sel.sizeId;
    entry.sweetnessId = sel.sweetnessId;
  } else if (product.type === "classic-custom") {
    entry.mode = sel.mode;
    entry.removed = [...sel.removed];
  }

  const key = buildCartKey(entry);

  if (cart[key]) {
    cart[key].qty += 1;
  } else {
    cart[key] = entry;
  }

  updateCartBadge();
  renderCart();
  flyToCart(rowEl.querySelector(".add-btn"));
}

function lineUnitPrice(entry) {
  const product = PRODUCTS.find((p) => p.id === entry.productId);
  return computeUnitPrice(product, entry);
}

function totalItems() {
  return Object.values(cart).reduce((a, entry) => a + entry.qty, 0);
}

function totalPrice() {
  return Object.values(cart).reduce(
    (sum, entry) => sum + lineUnitPrice(entry) * entry.qty,
    0,
  );
}

function updateCartBadge() {
  cartCountEl.textContent = totalItems();
  cartCountEl.classList.remove("pulse");
  void cartCountEl.offsetWidth;
  cartCountEl.classList.add("pulse");
  cartBtn.classList.remove("bump");
  void cartBtn.offsetWidth;
  cartBtn.classList.add("bump");
}

function renderCart() {
  cartListEl.innerHTML = "";
  const keys = Object.keys(cart).filter((k) => cart[k].qty > 0);

  if (keys.length === 0) {
    cartListEl.innerHTML = `<div class="drawer-empty">Your order is empty. Add something from the menu to get started.</div>`;
  } else {
    keys.forEach((key) => {
      const entry = cart[key];
      const product = PRODUCTS.find((p) => p.id === entry.productId);
      const unit = lineUnitPrice(entry);
      const desc = lineDescription(product, entry);

      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-item-top">
          <div>
            <div class="cart-item-name">${product.name}</div>
            ${desc ? `<div class="cart-item-sub">${desc}</div>` : ""}
            <div class="cart-item-sub">${CURRENCY} ${unit} each &middot; <button class="remove-btn" data-key="${key}">remove</button></div>
          </div>
          <div class="qty-control">
            <button data-action="dec" data-key="${key}" aria-label="Decrease">&minus;</button>
            <span>${entry.qty}</span>
            <button data-action="inc" data-key="${key}" aria-label="Increase">&plus;</button>
          </div>
          <div class="price">${CURRENCY} ${unit * entry.qty}</div>
        </div>
      `;
      cartListEl.appendChild(row);
    });
  }

  cartTotalEl.textContent = `${CURRENCY} ${totalPrice()}`;
  updateAddressVisibility();
}

cartListEl.addEventListener("click", (e) => {
  const incDec = e.target.closest("[data-action]");
  const removeBtn = e.target.closest(".remove-btn");

  if (incDec) {
    const key = incDec.dataset.key;
    const action = incDec.dataset.action;
    if (action === "inc") cart[key].qty += 1;
    if (action === "dec") cart[key].qty = Math.max(0, cart[key].qty - 1);
    updateCartBadge();
    renderCart();
  }

  if (removeBtn) {
    delete cart[removeBtn.dataset.key];
    updateCartBadge();
    renderCart();
  }
});

/* ============================================================
   FLY-TO-CART ANIMATION
============================================================ */
function flyToCart(fromEl) {
  const startRect = fromEl.getBoundingClientRect();
  const endRect = cartBtn.getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.className = "flyer";
  flyer.style.left = startRect.left + startRect.width / 2 - 6 + "px";
  flyer.style.top = startRect.top + startRect.height / 2 - 6 + "px";
  document.body.appendChild(flyer);

  const dx =
    endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
  const dy =
    endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);

  flyer.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      {
        transform: `translate(${dx * 0.5}px, ${dy - 50}px) scale(1.15)`,
        opacity: 1,
        offset: 0.6,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0 },
    ],
    { duration: 650, easing: "cubic-bezier(0.22,1,0.36,1)" },
  ).onfinish = () => flyer.remove();
}

/* ============================================================
   DRAWER OPEN / CLOSE
============================================================ */
function openDrawer() {
  drawer.classList.add("open");
  backdrop.classList.add("open");
}
function closeDrawer() {
  drawer.classList.remove("open");
  backdrop.classList.remove("open");
}

cartBtn.addEventListener("click", openDrawer);
document.getElementById("drawerClose").addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);

/* ============================================================
   DELIVERY ADDRESS TOGGLE
============================================================ */
const methodSelect = document.getElementById("custMethod");
const addressField = document.getElementById("addressField");
function updateAddressVisibility() {
  addressField.style.display =
    methodSelect.value === "Delivery" ? "block" : "none";
}
methodSelect.addEventListener("change", updateAddressVisibility);

/* ============================================================
   ORDER MESSAGE BUILDER
============================================================ */
function buildOrderMessage() {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const method = methodSelect.value;
  const address = document.getElementById("custAddress").value.trim();

  const keys = Object.keys(cart).filter((k) => cart[k].qty > 0);
  const lines = keys.map((key) => {
    const entry = cart[key];
    const product = PRODUCTS.find((p) => p.id === entry.productId);
    const unit = lineUnitPrice(entry);
    const desc = lineDescription(product, entry);
    const descText = desc ? ` (${desc})` : "";
    return `${product.name}${descText} x${entry.qty} - ${CURRENCY} ${unit * entry.qty}`;
  });

  const parts = [
    "New order — A and O Beverages, Bakes and More",
    "",
    ...lines,
    "",
    `Total: ${CURRENCY} ${totalPrice()}`,
    "",
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `${method === "Delivery" ? "Delivery" : "Pickup"}`,
  ];

  if (method === "Delivery" && address) {
    parts.push(`Address: ${address}`);
  }

  return { text: parts.join("\n") };
}

function validateForm() {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const hasItems = totalItems() > 0;

  if (!hasItems) {
    alert("Add at least one item to your order first.");
    return false;
  }
  if (!name || !phone) {
    alert("Please fill in your name and phone number.");
    return false;
  }
  return true;
}

function showConfirm() {
  const el = document.getElementById("confirmMsg");
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  const path = el.querySelector("path");
  path.style.animation = "none";
  void path.offsetWidth;
  path.style.animation = null;
}

document.getElementById("whatsappBtn").addEventListener("click", () => {
  if (!validateForm()) return;
  const { text } = buildOrderMessage();
  const url = `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  showConfirm();
});

document.getElementById("emailBtn").addEventListener("click", () => {
  if (!validateForm()) return;
  const { text } = buildOrderMessage();
  const subject = encodeURIComponent(
    "New order — A and O Beverages, Bakes and More",
  );
  const url = `mailto:${BUSINESS_EMAIL}?subject=${subject}&body=${encodeURIComponent(text)}`;
  window.location.href = url;
  showConfirm();
});

/* init */
renderCart();
