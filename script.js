const BUSINESS_WHATSAPP_NUMBER = "233599907434";
const BUSINESS_EMAIL = "orders@aoandbeverages.com";

const PRODUCTS = [
  {
    id: "A",
    name: "Brukina",
    category: "Beverage",
    type: "brukina-custom",
    description:
      "A rich, authentic traditional blend of smooth fermented yoghurt and slow-cooked millet, with optional sweet coconut flakes.",
    image:
      "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=300&q=80",
    //size: "300 ml",
    price: 20,
    constants: [
      { id: "yoghurt", name: "Yoghurt" },
      { id: "millet", name: "Millet" },
    ],
    addOns: [{ id: "coconut_flakes", name: "Coconut Flakes (Free)", price: 0 }],
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
    category: "Pre-order Only",
    type: "parfait-custom",
    preOrder: true,
    description:
      "Indulgent layers of rich yoghurt, wholesome granolas, and custom fruit mixtures.\n<i><b>Pre-order for Wednesday & Saturday delivery.\nOrder by Tuesday 1 PM or Friday 1 PM.</b></i>",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=300&q=80",
    //size: "350 ml",
    price: 25,
    constants: [{ id: "yoghurt", name: "Yoghurt" }],
    freeToppings: [
      { id: "granola", name: "Granola (Free)" },
      { id: "coconut_flakes", name: "Coconut Flakes (Free)" },
    ],
    fruits: [
      { id: "red_apples", name: "Red Apples" },
      { id: "red_grapes", name: "Red Grapes" },
      { id: "mangoes", name: "Mangoes" },
      { id: "strawberries", name: "Strawberries" },
      { id: "bananas", name: "Bananas" },
      { id: "pineapples", name: "Pineapples" },
    ],
    syrups: [
      { id: "mango_syrup", name: "Mango Syrup", price: 0 },
      { id: "pineapple_syrup", name: "Pineapple Syrup", price: 0 },
      { id: "honey", name: "Honey", price: 0 },
    ],
  },
  {
    id: "D",
    name: "Greek Yoghurt",
    category: "Pre-order Only",
    type: "size-sweetness",
    preOrder: true,
    description:
      "Ultra-thick, velvety, and high in protein. Pure strained yoghurt available sweetened or completely unsweetened for a healthier option.\n<i><b>Pre-order for Tuesday & Friday delivery.\nOrder by Monday 1 PM or Thursday 1 PM.</b></i>",
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

/*
============================================================
PRODUCT QUANTITY STATE
============================================================
Stores the quantity selected on each product card before
the customer clicks "Add to order".
============================================================
*/

const productQuantityState = {};

PRODUCTS.forEach((p) => {
  productQuantityState[p.id] = 1;

  if (p.type === "brukina-custom") {
    selectionState[p.id] = {
      includeCoconut: false,
    };
  } else if (p.type === "flavor-size") {
    selectionState[p.id] = {
      flavorId: p.flavors[0].id,
      sizeId: p.sizes[0].id,
    };
  } else if (p.type === "size-sweetness") {
    selectionState[p.id] = {
      sizeId: p.sizes[0].id,
      sweetnessId: p.sweetness[0].id,
    };
  } else if (p.type === "parfait-custom") {
    selectionState[p.id] = {
      selectedToppings: new Set(["granola", "coconut_flakes"]),
      selectedFruits: new Set(),
      syrupId: "none",
    };
  } else {
    selectionState[p.id] = {};
  }
});

/* ============================================================
   UNIT PRICE
============================================================ */

function computeUnitPrice(product, sel) {
  switch (product.type) {
    case "fixed":
    case "brukina-custom":
    case "parfait-custom":
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

/* ============================================================
   LINE DESCRIPTION
============================================================ */

function lineDescription(product, entry) {
  switch (product.type) {
    case "fixed":
      return product.size || "";

    case "brukina-custom": {
      const coconutText = entry.includeCoconut ? " + Coconut Flakes" : "";

      return `Standard${coconutText}${product.size ? ` · ${product.size}` : ""}`;
    }

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

    case "parfait-custom": {
      const fruitNames = (entry.selectedFruits || [])
        .map((id) => product.fruits.find((f) => f.id === id)?.name)
        .filter(Boolean);

      const toppingsNames = (entry.selectedToppings || [])
        .map((id) =>
          product.freeToppings
            .find((t) => t.id === id)
            ?.name?.replace(" (Free)", ""),
        )
        .filter(Boolean);

      const syrupObj = product.syrups?.find((s) => s.id === entry.syrupId);

      const syrupText = syrupObj ? ` + ${syrupObj.name}` : "";

      const fruitsText = fruitNames.length
        ? `Fruits: ${fruitNames.join(", ")}`
        : "No fruits selected";

      const toppingsText = toppingsNames.length
        ? `Toppings: ${toppingsNames.join(", ")}`
        : "";

      return [fruitsText, toppingsText, syrupText].filter(Boolean).join(" · ");
    }

    default:
      return "";
  }
}

/* ============================================================
   TOGGLE LABEL
============================================================ */

function getToggleLabel(product) {
  switch (product.type) {
    case "fixed":
      return "Show ingredients";

    case "brukina-custom":
      return "Customize add-ons";

    case "flavor-size":
      return "Choose flavor & size";

    case "parfait-custom":
      return "Customize Parfait";

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

function renderBulletList(ingredients) {
  const items = ingredients
    .map(
      (ing) => `
    <li class="ingredient-item bullet readonly-item" data-type="readonly">
      <span class="bullet-dot"></span>
      <span class="ingredient-label">${ing.name}</span>
    </li>
  `,
    )
    .join("");

  return `<ul class="ingredient-list">${items}</ul>`;
}

/* ============================================================
   PRE-ORDER BANNERS
============================================================ */

function renderPreOrderBanner() {
  return `
    <div class="ingredient-group" style="background: rgba(0, 102, 204, 0.05); padding: 10px; border-radius: 8px; border-left: 4px solid #0066cc; margin-bottom: 12px;">
      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #0066cc;">
        📅 Pre-order Schedule: Delivered on Wednesdays & Saturdays.
      </p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #555;">
        Order by Tuesday 1 PM (for Wed delivery) or Friday 1 PM (for Sat delivery).
      </p>
    </div>
  `;
}

function renderPreOrderBannerGreek() {
  return `
    <div class="ingredient-group" style="background: rgba(0, 102, 204, 0.05); padding: 10px; border-radius: 8px; border-left: 4px solid #0066cc; margin-bottom: 12px;">
      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #0066cc;">
        📅 Pre-order Schedule: Delivered on Tuesdays & Fridays.
      </p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #555;">
        Order by Monday 1 PM (for Tuesday delivery) or Thursday 1 PM (for Friday delivery).
      </p>
    </div>
  `;
}

/* ============================================================
   QUANTITY CONTROL
============================================================ */

function renderProductQuantity(productId) {
  const quantity = productQuantityState[productId] || 1;

  return `
    <div class="product-quantity-wrapper">
      <span class="product-quantity-label">Quantity</span>

      <div
        class="product-quantity-control"
        aria-label="Quantity for this product"
      >
        <button
          type="button"
          class="product-qty-btn"
          data-action="product-dec"
          data-product-id="${productId}"
          aria-label="Decrease quantity"
        >
          &minus;
        </button>

        <span
          class="product-qty-value"
          data-product-qty
        >
          ${quantity}
        </span>

        <button
          type="button"
          class="product-qty-btn"
          data-action="product-inc"
          data-product-id="${productId}"
          aria-label="Increase quantity"
        >
          &plus;
        </button>
      </div>
    </div>
  `;
}

/* ============================================================
   CUSTOMIZATION PANEL
============================================================ */

function renderCustomizePanel(product) {
  const sel = selectionState[product.id];

  const banner = product.preOrder ? renderPreOrderBanner() : "";

  const bannerGreek = product.id === "D" ? renderPreOrderBannerGreek() : "";

  if (product.type === "fixed") {
    return `
      <div class="customize-inner single">
        ${banner}

        <div class="ingredient-group">
          <h4>Ingredients</h4>
          ${renderBulletList(product.ingredients)}
          <p class="readonly-note">
            Ingredients are fixed and not customizable.
          </p>
        </div>
      </div>
    `;
  }

  if (product.type === "brukina-custom") {
    return `
      <div class="customize-inner single">
        ${banner}

        <div class="ingredient-group">
          <h4>Base Ingredients (Fixed)</h4>
          ${renderBulletList(product.constants)}
        </div>

        <div class="option-group" style="margin-top:12px;">
          <h4>Free Add-ons</h4>

          <div class="pill-row">
            <button
              type="button"
              class="pill-btn ${sel.includeCoconut ? "active" : ""}"
              data-action="toggle-coconut"
            >
              ${
                sel.includeCoconut
                  ? "✓ Coconut Flakes Included (Free)"
                  : "+ Add Coconut Flakes (Free)"
              }
            </button>
          </div>
        </div>
      </div>
    `;
  }

  if (product.type === "flavor-size") {
    const flavorBtns = product.flavors
      .map(
        (f) => `
      <button
        type="button"
        class="pill-btn ${f.id === sel.flavorId ? "active" : ""}"
        data-flavor="${f.id}"
      >
        ${f.name}
      </button>
    `,
      )
      .join("");

    const sizeBtns = product.sizes
      .map(
        (s) => `
      <button
        type="button"
        class="pill-btn ${s.id === sel.sizeId ? "active" : ""}"
        data-size="${s.id}"
      >
        ${s.label} &middot; ${CURRENCY} ${s.price}
      </button>
    `,
      )
      .join("");

    return `
      <div class="customize-inner single">
        ${banner}

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

        return `
          <button
            type="button"
            class="pill-btn ${s.id === sel.sizeId ? "active" : ""}"
            data-size="${s.id}"
          >
            ${s.label} &middot; ${CURRENCY} ${price}
          </button>
        `;
      })
      .join("");

    const sweetBtns = product.sweetness
      .map(
        (sw) => `
      <button
        type="button"
        class="pill-btn ${sw.id === sel.sweetnessId ? "active" : ""}"
        data-sweetness="${sw.id}"
      >
        ${sw.name}
      </button>
    `,
      )
      .join("");

    return `
      <div class="customize-inner single">
        ${bannerGreek}

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

  /* ============================================================
     PARFAIT
  ============================================================ */

  if (product.type === "parfait-custom") {
    const syrups = product.syrups || [];

    const syrupBtns = [
      `<button
        type="button"
        class="pill-btn ${
          !sel.syrupId || sel.syrupId === "none" ? "active" : ""
        }"
        data-syrup="none"
      >
        None
      </button>`,

      ...syrups.map(
        (s) =>
          `<button
            type="button"
            class="pill-btn ${sel.syrupId === s.id ? "active" : ""}"
            data-syrup="${s.id}"
          >
            ${s.name}
          </button>`,
      ),
    ].join("");

    const toppingsList = product.freeToppings
      .map((top) => {
        const isSelected = sel.selectedToppings.has(top.id);

        return `
          <li
            class="ingredient-item ${isSelected ? "checked" : ""}"
            data-type="parfait-topping"
            data-id="${top.id}"
          >
            <span class="chk">${CHECK_ICON}</span>
            <span class="ingredient-label">${top.name}</span>
          </li>
        `;
      })
      .join("");

    /*
      IMPORTANT:
      Render EVERY fruit in product.fruits.

      The inline styles prevent an existing CSS rule from
      limiting the fruit list to only four visible items.
    */

    const fruitsList = product.fruits
      .map((fruit) => {
        const isSelected = sel.selectedFruits.has(fruit.id);

        return `
          <li
            class="ingredient-item ${isSelected ? "checked" : ""}"
            data-type="parfait-fruit"
            data-id="${fruit.id}"
            style="display: flex; visibility: visible; opacity: 1;"
          >
            <span class="chk">${CHECK_ICON}</span>
            <span class="ingredient-label">${fruit.name}</span>
          </li>
        `;
      })
      .join("");

    return `
      <div class="customize-inner single">
        ${banner}

        <div class="ingredient-group">
          <h4>Base Ingredients</h4>
          ${renderBulletList(product.constants)}
        </div>

        <div
          class="ingredient-group"
          style="margin-top:12px;"
        >
          <h4>Free Toppings</h4>

          <ul class="ingredient-list">
            ${toppingsList}
          </ul>
        </div>

        <div
          class="ingredient-group"
          style="margin-top:12px;"
        >
          <h4>Fruit Mixtures (Select up to 4)</h4>

          <ul
            class="ingredient-list parfait-fruit-list"
            style="
              max-height: none !important;
              height: auto !important;
              overflow: visible !important;
              display: flex;
              flex-direction: column;
            "
          >
            ${fruitsList}
          </ul>

          <p
            class="readonly-note"
            style="margin-top:8px;"
          >
            Selected: ${sel.selectedFruits.size} / 4
          </p>
        </div>

        <div
          class="option-group"
          style="margin-top:12px;"
        >
          <h4>Drizzle / Syrup (Optional - Free)</h4>

          <div class="pill-row">
            ${syrupBtns}
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

/* ============================================================
   PRODUCT ROW
============================================================ */

function renderRowInner(product) {
  const sel = selectionState[product.id];

  const unitPrice = computeUnitPrice(product, sel);

  const metaSize = product.size ? ` &middot; ${product.size}` : "";

  return `
    <div class="product-main">

      <div class="product-art">
        <img
          src="${product.image}"
          alt="${product.name}"
          class="product-img"
        />
      </div>

      <div>
        <div class="product-cat">
          ${product.category}${metaSize}
        </div>

        <h3>${product.name}</h3>

        <p
          class="product-desc"
          style="white-space: pre-line;"
        >
          ${product.description}
        </p>

        <button
          type="button"
          class="customize-toggle"
          data-action="toggle"
        >
          ${getToggleLabel(product)}

          <svg
            viewBox="0 0 12 8"
            fill="none"
          >
            <path
              d="M1 1l5 5 5-5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <div class="product-price-block">

        <span
          class="price"
          data-base-price
        >
          ${CURRENCY} ${unitPrice}
        </span>

        <!-- PRODUCT QUANTITY -->
        ${renderProductQuantity(product.id)}

        <button
          type="button"
          class="add-btn"
          data-action="add"
        >
          Add to order
        </button>

      </div>
    </div>

    <div class="customize-panel">
      ${renderCustomizePanel(product)}
    </div>
  `;
}

/* ============================================================
   INITIAL PRODUCT RENDER
============================================================ */

if (productList) {
  PRODUCTS.forEach((p, index) => {
    const row = document.createElement("div");

    row.className = `product-row reveal ${
      index % 2 === 0 ? "slide-left" : "slide-right"
    }`;

    row.dataset.id = p.id;

    row.innerHTML = renderRowInner(p);

    productList.appendChild(row);
  });
}

/* ============================================================
   REFRESH PRODUCT ROW
============================================================ */

function refreshRow(productId) {
  if (!productList) {
    return;
  }

  const row = productList.querySelector(`.product-row[data-id="${productId}"]`);

  if (!row) {
    return;
  }

  const wasOpen = row.classList.contains("open");

  const product = PRODUCTS.find((p) => p.id === productId);

  if (!product) {
    return;
  }

  row.innerHTML = renderRowInner(product);

  if (wasOpen) {
    row.classList.add("open");
  }
}

/* ============================================================
   PRODUCT ROW INTERACTIONS
============================================================ */

if (productList) {
  productList.addEventListener("click", (e) => {
    const row = e.target.closest(".product-row");

    if (!row) {
      return;
    }

    const productId = row.dataset.id;

    const product = PRODUCTS.find((p) => p.id === productId);

    if (!product) {
      return;
    }

    const sel = selectionState[productId];

    /* --------------------------------------------------------
       PRODUCT QUANTITY DECREASE
    -------------------------------------------------------- */

    const productDecBtn = e.target.closest('[data-action="product-dec"]');

    if (productDecBtn) {
      productQuantityState[productId] = Math.max(
        1,
        (productQuantityState[productId] || 1) - 1,
      );

      refreshRow(productId);

      return;
    }

    /* --------------------------------------------------------
       PRODUCT QUANTITY INCREASE
    -------------------------------------------------------- */

    const productIncBtn = e.target.closest('[data-action="product-inc"]');

    if (productIncBtn) {
      productQuantityState[productId] =
        (productQuantityState[productId] || 1) + 1;

      refreshRow(productId);

      return;
    }

    /* --------------------------------------------------------
       TOGGLE ACCORDION
    -------------------------------------------------------- */

    const toggleBtn = e.target.closest('[data-action="toggle"]');

    if (toggleBtn) {
      row.classList.toggle("open");

      return;
    }

    /* --------------------------------------------------------
       BRUKINA COCONUT
    -------------------------------------------------------- */

    const coconutBtn = e.target.closest('[data-action="toggle-coconut"]');

    if (coconutBtn) {
      sel.includeCoconut = !sel.includeCoconut;

      refreshRow(productId);

      return;
    }

    /* --------------------------------------------------------
       PILL SELECTIONS
    -------------------------------------------------------- */

    const pillBtn = e.target.closest(".pill-btn");

    if (pillBtn) {
      if (pillBtn.dataset.syrup) {
        sel.syrupId = pillBtn.dataset.syrup;
      }

      if (pillBtn.dataset.flavor) {
        sel.flavorId = pillBtn.dataset.flavor;
      }

      if (pillBtn.dataset.size) {
        sel.sizeId = pillBtn.dataset.size;
      }

      if (pillBtn.dataset.sweetness) {
        sel.sweetnessId = pillBtn.dataset.sweetness;
      }

      refreshRow(productId);

      return;
    }

    /* --------------------------------------------------------
       PARFAIT FREE TOPPINGS
    -------------------------------------------------------- */

    const toppingItem = e.target.closest('[data-type="parfait-topping"]');

    if (toppingItem) {
      const id = toppingItem.dataset.id;

      if (sel.selectedToppings.has(id)) {
        sel.selectedToppings.delete(id);
      } else {
        sel.selectedToppings.add(id);
      }

      refreshRow(productId);

      return;
    }

    /* --------------------------------------------------------
       PARFAIT FRUITS
       Maximum = 4
    -------------------------------------------------------- */

    const fruitItem = e.target.closest('[data-type="parfait-fruit"]');

    if (fruitItem) {
      const id = fruitItem.dataset.id;

      if (sel.selectedFruits.has(id)) {
        sel.selectedFruits.delete(id);
      } else {
        if (sel.selectedFruits.size >= 4) {
          alert("You can select a maximum of 4 fruits.");

          return;
        }

        sel.selectedFruits.add(id);
      }

      refreshRow(productId);

      return;
    }

    /* --------------------------------------------------------
       ADD TO ORDER
    -------------------------------------------------------- */

    const addBtn = e.target.closest('[data-action="add"]');

    if (addBtn) {
      spawnRipple(addBtn, e);

      addProductToCart(product, row);
    }
  });
}

/* ============================================================
   RIPPLE EFFECT
============================================================ */

function spawnRipple(btn, evt) {
  if (!btn) {
    return;
  }

  const ripple = document.createElement("span");

  ripple.className = "ripple";

  const rect = btn.getBoundingClientRect();

  const size = Math.max(rect.width, rect.height);

  ripple.style.width = ripple.style.height = size + "px";

  ripple.style.left = evt.clientX - rect.left - size / 2 + "px";

  ripple.style.top = evt.clientY - rect.top - size / 2 + "px";

  btn.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
}

/* ============================================================
   NUMBER COUNT-UP ANIMATION
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

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");

          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
    },
  );

  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}

/* ============================================================
   STAT COUNT-UP
============================================================ */

const statEls = document.querySelectorAll(".stat-num");

if ("IntersectionObserver" in window) {
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
    {
      threshold: 0.5,
    },
  );

  statEls.forEach((el) => statObserver.observe(el));
}

/* ============================================================
   STEPS CONNECTOR LINE
============================================================ */

const stepLine = document.getElementById("stepLine");

const stepsGrid = document.getElementById("stepsGrid");

const stepEls = document.querySelectorAll(".step");

if ("IntersectionObserver" in window) {
  const stepsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (stepLine) {
            stepLine.classList.add("in");
          }

          stepEls.forEach((el, i) => {
            setTimeout(() => el.classList.add("in"), i * 220);
          });

          stepsObserver.disconnect();
        }
      });
    },
    {
      threshold: 0.3,
    },
  );

  if (stepsGrid) {
    stepsObserver.observe(stepsGrid);
  }
}

/* ============================================================
   CART LOGIC
============================================================ */

const cartCountEl = document.getElementById("cartCount");

const cartBtn = document.getElementById("cartBtn");

const cartListEl = document.getElementById("cartList");

const cartTotalEl = document.getElementById("cartTotal");

const drawer = document.getElementById("drawer");

const backdrop = document.getElementById("backdrop");

/* ============================================================
   CART KEY
============================================================ */

function buildCartKey(entry) {
  const product = PRODUCTS.find((p) => p.id === entry.productId);

  if (!product) {
    return entry.productId;
  }

  switch (product.type) {
    case "fixed":
      return `${entry.productId}`;

    case "brukina-custom":
      return `${entry.productId}::c(${entry.includeCoconut})`;

    case "parfait-custom":
      return `${entry.productId}::f(${[...entry.selectedFruits]
        .sort()
        .join(",")})::t(${[...entry.selectedToppings]
        .sort()
        .join(",")})::s(${entry.syrupId})`;

    case "flavor-size":
      return `${entry.productId}::f(${entry.flavorId})::s(${entry.sizeId})`;

    case "size-sweetness":
      return `${entry.productId}::s(${entry.sizeId})::sw(${entry.sweetnessId})`;

    default:
      return entry.productId;
  }
}

/* ============================================================
   ADD PRODUCT TO CART
============================================================ */

function addProductToCart(product, rowEl) {
  const sel = selectionState[product.id];

  /*
    Get the quantity selected on
    the product card.
  */
  const selectedQuantity = Math.max(1, productQuantityState[product.id] || 1);

  let entry = {
    productId: product.id,
    qty: selectedQuantity,
  };

  if (product.type === "parfait-custom") {
    entry.selectedFruits = [...sel.selectedFruits];

    entry.selectedToppings = [...sel.selectedToppings];

    entry.syrupId = sel.syrupId;
  } else if (product.type === "brukina-custom") {
    entry.includeCoconut = sel.includeCoconut;
  } else if (product.type === "flavor-size") {
    entry.flavorId = sel.flavorId;

    entry.sizeId = sel.sizeId;
  } else if (product.type === "size-sweetness") {
    entry.sizeId = sel.sizeId;

    entry.sweetnessId = sel.sweetnessId;
  }

  const key = buildCartKey(entry);

  if (cart[key]) {
    cart[key].qty += selectedQuantity;
  } else {
    cart[key] = entry;
  }

  updateCartBadge();

  renderCart();

  flyToCart(rowEl?.querySelector(".add-btn"));

  /*
    Reset the product-card quantity
    back to 1 after adding.
  */
  productQuantityState[product.id] = 1;

  refreshRow(product.id);
}

/* ============================================================
   CART UNIT PRICE
============================================================ */

function lineUnitPrice(entry) {
  const product = PRODUCTS.find((p) => p.id === entry.productId);

  if (!product) {
    return 0;
  }

  return computeUnitPrice(product, entry);
}

/* ============================================================
   TOTAL ITEMS
============================================================ */

function totalItems() {
  return Object.values(cart).reduce((total, entry) => total + entry.qty, 0);
}

/* ============================================================
   TOTAL PRICE
============================================================ */

function totalPrice() {
  return Object.values(cart).reduce(
    (sum, entry) => sum + lineUnitPrice(entry) * entry.qty,
    0,
  );
}

/* ============================================================
   UPDATE CART BADGE
============================================================ */

function updateCartBadge() {
  if (!cartCountEl || !cartBtn) {
    return;
  }

  cartCountEl.textContent = totalItems();

  cartCountEl.classList.remove("pulse");

  void cartCountEl.offsetWidth;

  cartCountEl.classList.add("pulse");

  cartBtn.classList.remove("bump");

  void cartBtn.offsetWidth;

  cartBtn.classList.add("bump");
}

/* ============================================================
   RENDER CART
============================================================ */

function renderCart() {
  if (!cartListEl) {
    return;
  }

  cartListEl.innerHTML = "";

  const keys = Object.keys(cart).filter((k) => cart[k].qty > 0);

  if (keys.length === 0) {
    cartListEl.innerHTML = `
      <div class="drawer-empty">
        Your order is empty.
        Add something from the menu
        to get started.
      </div>
    `;
  } else {
    keys.forEach((key) => {
      const entry = cart[key];

      const product = PRODUCTS.find((p) => p.id === entry.productId);

      if (!product) {
        return;
      }

      const unit = lineUnitPrice(entry);

      const desc = lineDescription(product, entry);

      const row = document.createElement("div");

      row.className = "cart-item";

      row.innerHTML = `
        <div class="cart-item-top">

          <div>
            <div class="cart-item-name">
              ${product.name}
            </div>

            ${desc ? `<div class="cart-item-sub">${desc}</div>` : ""}

            <div class="cart-item-sub">
              ${CURRENCY} ${unit}
              each &middot;

              <button
                type="button"
                class="remove-btn"
                data-key="${key}"
              >
                Remove
              </button>
            </div>
          </div>

          <div class="qty-control">

            <button
              type="button"
              data-action="dec"
              data-key="${key}"
              aria-label="Decrease quantity"
            >
              &minus;
            </button>

            <span>
              ${entry.qty}
            </span>

            <button
              type="button"
              data-action="inc"
              data-key="${key}"
              aria-label="Increase quantity"
            >
              &plus;
            </button>

          </div>

          <div class="price">
            ${CURRENCY}
            ${unit * entry.qty}
          </div>

        </div>
      `;

      cartListEl.appendChild(row);
    });
  }

  if (cartTotalEl) {
    cartTotalEl.textContent = `${CURRENCY} ${totalPrice()}`;
  }

  updateAddressVisibility();
}

/* ============================================================
   CART QUANTITY / REMOVE
============================================================ */

if (cartListEl) {
  cartListEl.addEventListener("click", (e) => {
    const incDec = e.target.closest("[data-action]");

    const removeBtn = e.target.closest(".remove-btn");

    if (incDec) {
      const key = incDec.dataset.key;

      const action = incDec.dataset.action;

      if (!cart[key]) {
        return;
      }

      if (action === "inc") {
        cart[key].qty += 1;
      }

      if (action === "dec") {
        cart[key].qty = Math.max(0, cart[key].qty - 1);
      }

      updateCartBadge();

      renderCart();
    }

    if (removeBtn) {
      delete cart[removeBtn.dataset.key];

      updateCartBadge();

      renderCart();
    }
  });
}

/* ============================================================
   FLY TO CART ANIMATION
============================================================ */

function flyToCart(fromEl) {
  if (!cartBtn || !fromEl) {
    return;
  }

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

  const animation = flyer.animate(
    [
      {
        transform: "translate(0,0) scale(1)",
        opacity: 1,
      },
      {
        transform: `translate(${dx * 0.5}px, ${dy - 50}px) scale(1.15)`,
        opacity: 1,
        offset: 0.6,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.25)`,
        opacity: 0,
      },
    ],
    {
      duration: 650,
      easing: "cubic-bezier(0.22,1,0.36,1)",
    },
  );

  animation.onfinish = () => flyer.remove();
}

/* ============================================================
   DRAWER OPEN / CLOSE
============================================================ */

function openDrawer() {
  if (drawer) {
    drawer.classList.add("open");
  }

  if (backdrop) {
    backdrop.classList.add("open");
  }
}

function closeDrawer() {
  if (drawer) {
    drawer.classList.remove("open");
  }

  if (backdrop) {
    backdrop.classList.remove("open");
  }
}

if (cartBtn) {
  cartBtn.addEventListener("click", openDrawer);
}

const drawerCloseBtn = document.getElementById("drawerClose");

if (drawerCloseBtn) {
  drawerCloseBtn.addEventListener("click", closeDrawer);
}

if (backdrop) {
  backdrop.addEventListener("click", closeDrawer);
}

/* ============================================================
   DELIVERY ADDRESS TOGGLE
============================================================ */

const methodSelect = document.getElementById("custMethod");

const addressField = document.getElementById("addressField");

function updateAddressVisibility() {
  if (!methodSelect || !addressField) {
    return;
  }

  const isDelivery = methodSelect.value === "Delivery";

  addressField.style.display = isDelivery ? "block" : "none";

  /*
    A pickup order should never
    carry an old delivery pin.
  */

  if (!isDelivery) {
    sharedLocation = null;

    if (locationStatus) {
      locationStatus.textContent = "";

      locationStatus.classList.remove("show", "error");
    }

    resetLocationButton();
  }
}

if (methodSelect) {
  methodSelect.addEventListener("change", updateAddressVisibility);
}

/* ============================================================
   SHARE EXACT LOCATION
   Google Maps pin — no API key needed.
============================================================ */

let sharedLocation = null;
// { lat, lng, link }

const shareLocationBtn = document.getElementById("shareLocationBtn");

const shareLocationBtnText = document.getElementById("shareLocationBtnText");

const locationStatus = document.getElementById("locationStatus");

function resetLocationButton() {
  if (!shareLocationBtn || !shareLocationBtnText) {
    return;
  }

  shareLocationBtn.disabled = false;

  shareLocationBtn.classList.remove("captured");

  shareLocationBtnText.textContent = "Use my current location";
}

if (shareLocationBtn) {
  shareLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      locationStatus.textContent =
        "Location isn't supported on this device or browser — please type your address instead.";

      locationStatus.classList.remove("show");

      void locationStatus.offsetWidth;

      locationStatus.classList.add("show", "error");

      return;
    }

    shareLocationBtn.disabled = true;

    shareLocationBtnText.textContent = "Getting your location…";

    locationStatus.classList.remove("show", "error");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);

        const lng = pos.coords.longitude.toFixed(6);

        sharedLocation = {
          lat,
          lng,
          link: `https://www.google.com/maps?q=${lat},${lng}`,
        };

        shareLocationBtn.disabled = false;

        shareLocationBtn.classList.add("captured");

        shareLocationBtnText.textContent = "Location captured ✓";

        locationStatus.innerHTML = `
            Pinned!
            <a
              href="${sharedLocation.link}"
              target="_blank"
              rel="noopener"
            >
              View your pin on Google Maps
            </a>
          `;

        locationStatus.classList.remove("error");

        locationStatus.classList.add("show");
      },

      (err) => {
        resetLocationButton();

        let msg =
          "Couldn't get your location — please type your address instead.";

        if (err.code === err.PERMISSION_DENIED) {
          msg =
            "Location permission was denied. You can still type your address below.";
        } else if (err.code === err.TIMEOUT) {
          msg =
            "Location took too long to respond. Please try again or type your address.";
        }

        locationStatus.textContent = msg;

        locationStatus.classList.add("show", "error");
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

/* ============================================================
   ORDER MESSAGE BUILDER
============================================================ */

function buildOrderMessage() {
  const name = document.getElementById("custName")?.value.trim() || "";

  const phone = document.getElementById("custPhone")?.value.trim() || "";

  const method = methodSelect ? methodSelect.value : "Pickup";

  const address = document.getElementById("custAddress")?.value.trim() || "";

  const keys = Object.keys(cart).filter((k) => cart[k].qty > 0);

  const lines = keys.map((key) => {
    const entry = cart[key];

    const product = PRODUCTS.find((p) => p.id === entry.productId);

    if (!product) {
      return "";
    }

    const unit = lineUnitPrice(entry);

    const desc = lineDescription(product, entry);

    const descText = desc ? ` (${desc})` : "";

    return `${product.name}${descText} x${entry.qty} - ${CURRENCY} ${unit * entry.qty}`;
  });

  const parts = [
    "New order — A and O Beverages, Bakes and More",
    "",
    ...lines.filter(Boolean),
    "",
    `Total: ${CURRENCY} ${totalPrice()}`,
    "",
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `${method === "Delivery" ? "Delivery" : "Pickup"}`,
  ];

  if (method === "Delivery") {
    if (address) {
      parts.push(`Address: ${address}`);
    }

    if (sharedLocation) {
      parts.push(`Map pin: ${sharedLocation.link}`);
    }
  }

  return {
    text: parts.join("\n"),
  };
}

/* ============================================================
   FORM VALIDATION
============================================================ */

function validateForm() {
  const name = document.getElementById("custName")?.value.trim();

  const phone = document.getElementById("custPhone")?.value.trim();

  const hasItems = totalItems() > 0;

  const method = methodSelect ? methodSelect.value : "Pickup";

  const address = document.getElementById("custAddress")?.value.trim() || "";

  if (!hasItems) {
    alert("Add at least one item to your order first.");

    return false;
  }

  if (!name || !phone) {
    alert("Please fill in your name and phone number.");

    return false;
  }

  if (method === "Delivery" && !address && !sharedLocation) {
    alert(
      "Please type your delivery address or share your exact location first.",
    );

    return false;
  }

  return true;
}

/* ============================================================
   CONFIRMATION MESSAGE
============================================================ */

function showConfirm() {
  const el = document.getElementById("confirmMsg");

  if (!el) {
    return;
  }

  el.classList.remove("show");

  void el.offsetWidth;

  el.classList.add("show");

  const path = el.querySelector("path");

  if (path) {
    path.style.animation = "none";

    void path.offsetWidth;

    path.style.animation = null;
  }
}

/* ============================================================
   WHATSAPP ORDER
============================================================ */

const whatsappBtn = document.getElementById("whatsappBtn");

if (whatsappBtn) {
  whatsappBtn.addEventListener("click", () => {
    if (!validateForm()) {
      return;
    }

    const { text } = buildOrderMessage();

    const url = `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(
      text,
    )}`;

    window.open(url, "_blank");

    showConfirm();
  });
}

/* ============================================================
   EMAIL ORDER
============================================================ */

const emailBtn = document.getElementById("emailBtn");

if (emailBtn) {
  emailBtn.addEventListener("click", () => {
    if (!validateForm()) {
      return;
    }

    const { text } = buildOrderMessage();

    const subject = encodeURIComponent(
      "New order — A and O Beverages, Bakes and More",
    );

    const url = `mailto:${BUSINESS_EMAIL}?subject=${subject}&body=${encodeURIComponent(
      text,
    )}`;

    window.location.href = url;

    showConfirm();
  });
}

/* ============================================================
   INITIALIZE
============================================================ */

renderCart();
