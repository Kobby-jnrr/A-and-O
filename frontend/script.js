/* =========================================================
   A AND O BEVERAGES, BAKES AND MORE
   Main frontend JavaScript
========================================================= */

const API_BASE_URL = "http://localhost:3000/api";
const CURRENCY = "GHS";

const MAX_PARFAIT_FRUITS = 3;

/* =========================================================
   PRODUCT DATA
========================================================= */

let PRODUCTS = {};

/* =========================================================
   STATE
========================================================= */

let cart = [];

let deliveryLocation = {
  lat: null,
  lng: null,
  link: null,
};

let trackingOrderNumber = "";
let paystackOrderProcessing = false;

/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatMoney(amount) {
  const value = Number(amount) || 0;

  return `${CURRENCY} ${value.toFixed(2)}`;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   PRODUCT PRICE HELPERS
========================================================= */

function getProductUnitPrice(product, options = {}) {
  if (!product) {
    return 0;
  }

  if (product.type === "brukina-custom") {
    return product.price;
  }

  if (product.type === "flavor-size") {
    return product.sizes[options.sizeId] || 0;
  }

  if (product.type === "parfait-custom") {
    return product.price;
  }

  if (product.type === "size-sweetness") {
    return product.prices?.[options.sizeId]?.[options.sweetnessId] || 0;
  }

  return 0;
}

/* =========================================================
   PRODUCT DESCRIPTION HELPERS
========================================================= */

function getCartItemDescription(product, options = {}) {
  if (!product) {
    return "";
  }

  if (product.type === "brukina-custom") {
    const toppingNames = (options.toppings || [])
      .map((id) => product.toppings?.[id])
      .filter(Boolean);
    return toppingNames.length
      ? `Toppings: ${toppingNames.join(", ")}`
      : "Standard";
  }

  if (product.type === "flavor-size") {
    const flavor = product.flavors?.[options.flavorId] || "Plain";

    const sizeNames = {
      "500ml": "500 ml",
      "300ml": "300 ml",
      "250ml": "250 ml",
    };

    return `${flavor} - ${sizeNames[options.sizeId] || options.sizeId}`;
  }

  if (product.type === "parfait-custom") {
    const parts = [];

    const fruits = Array.isArray(options.fruits) ? options.fruits : [];

    const toppings = Array.isArray(options.toppings) ? options.toppings : [];

    const syrupId = options.syrupId || "none";

    if (fruits.length > 0) {
      const fruitNames = fruits
        .map((fruit) => product.fruits?.[fruit])
        .filter(Boolean);

      if (fruitNames.length > 0) {
        parts.push(`Fruits: ${fruitNames.join(", ")}`);
      }
    }

    if (toppings.length > 0) {
      const toppingNames = toppings
        .map((topping) => product.toppings?.[topping])
        .filter(Boolean);

      if (toppingNames.length > 0) {
        parts.push(`Toppings: ${toppingNames.join(", ")}`);
      }
    }

    if (syrupId !== "none" && product.syrups?.[syrupId]) {
      parts.push(`Syrup: ${product.syrups[syrupId]}`);
    }

    return parts.length > 0 ? parts.join(" | ") : "Standard Parfait";
  }

  if (product.type === "size-sweetness") {
    const sizeName = formatOptionLabel(options.sizeId);
    const sweetnessName = formatOptionLabel(options.sweetnessId);

    return `${sizeName} - ${sweetnessName}`;
  }

  return "";
}

/* =========================================================
   PRODUCT RENDERING
========================================================= */

async function loadProducts() {
  const productList = $("#productList");
  if (productList)
    productList.innerHTML = `<p class="placeholder-note">Loading products...</p>`;

  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? "The product API is not deployed yet."
          : "Could not load products.",
      );
    }
    const products = await response.json();
    PRODUCTS = (Array.isArray(products) ? products : []).reduce(
      (map, product) => {
        map[product.id] = product;
        return map;
      },
      {},
    );
    renderProducts();
  } catch (error) {
    console.error("Could not load products:", error);
    if (productList)
      productList.innerHTML = `<p class="placeholder-note">${escapeHtml(error.message || "Products are unavailable right now. Please refresh and try again.")}</p>`;
  }
}

function formatOptionLabel(value) {
  return String(value)
    .replace(/^(\d+)ml$/i, "$1 ml")
    .replace(/^(\d+)l$/i, "$1 L")
    .replace(
      /(^|[_-])(\w)/g,
      (_, prefix, letter) =>
        `${prefix === "_" || prefix === "-" ? " " : ""}${letter.toUpperCase()}`,
    );
}

function renderProducts() {
  const productList = $("#productList");

  if (!productList) {
    return;
  }

  productList.innerHTML = Object.values(PRODUCTS)
    .map((product) => renderProduct(product))
    .join("");

  initializeProductInteractions();
}

function renderProduct(product) {
  const outOfStock = product.status === "out_of_stock";
  let startingPrice = 0;

  if (product.type === "brukina-custom") {
    startingPrice = product.price;
  }

  if (product.type === "flavor-size") {
    startingPrice = Math.min(...Object.values(product.sizes));
  }

  if (product.type === "parfait-custom") {
    startingPrice = product.price;
  }

  if (product.type === "size-sweetness") {
    startingPrice = Math.min(
      ...Object.values(product.prices).flatMap((sizes) => Object.values(sizes)),
    );
  }

  return `
    <article
      data-product-id="${escapeHtml(product.id)}"
      class="product-row${outOfStock ? " product-out-of-stock" : ""}"
    >

      <!--
        IMPORTANT:
        This wrapper now matches the CSS selector used
        for the beverage image sizing.
      -->
      <div class="product-image-wrap">
        <img
          class="product-image"
          src="${escapeHtml(product.image || "images/webpic.png")}"
          alt="${escapeHtml(product.name)}"
          loading="lazy"
        />
      </div>

      <div class="product-main">

        <div class="product-cat">
          ${escapeHtml(product.category)}
        </div>

        <h3>
          ${escapeHtml(product.name)}
        </h3>

        ${outOfStock ? `<span class="product-stock-badge">Out of stock</span>` : ""}

        <p class="product-description">
          ${escapeHtml(product.description)}
        </p>

      </div>

      <div class="product-side">

        <div class="product-price">
          From ${formatMoney(startingPrice)}
        </div>

        <button
          type="button"
          class="product-add-btn"
          data-product-id="${escapeHtml(product.id)}"
          ${outOfStock ? 'disabled aria-disabled="true"' : ""}
        >
          ${outOfStock ? "Out of stock" : "Customize"}
        </button>

      </div>

      ${
        outOfStock
          ? ""
          : `<div
        class="customize-box"
        data-customize-box="${escapeHtml(product.id)}"
        hidden
      >
        ${renderCustomization(product)}
      </div>`
      }

    </article>
  `;
}

/* =========================================================
   CUSTOMIZATION HTML
========================================================= */

function renderCustomization(product) {
  if (product.type === "brukina-custom") {
    const toppings = product.toppings || { coconut_flakes: "Coconut Flakes" };
    return `
      <div class="customize-grid">

        <div class="customize-field">

          <label>Toppings</label>

          <div class="option-list">

            ${Object.entries(toppings)
              .map(
                ([id, label]) =>
                  `<button type="button" class="option-button brukina-topping-option" data-brukina-topping="${escapeHtml(id)}" aria-pressed="false">${escapeHtml(label)}</button>`,
              )
              .join("")}

          </div>

        </div>

        <div class="customize-field">

          <label>
            Price
          </label>

          <div class="product-price">
            ${formatMoney(product.price)}
          </div>

        </div>

      </div>

      <div class="customize-actions">

        <button
          type="button"
          class="product-add-btn confirm-product-btn"
          data-product-id="${escapeHtml(product.id)}"
        >
          Add to order
        </button>

      </div>
    `;
  }

  if (product.type === "flavor-size") {
    const defaultSize = Object.keys(product.sizes || {}).includes("500ml")
      ? "500ml"
      : Object.keys(product.sizes || {})[0];
    return `
      <div class="customize-grid">

        <div class="customize-field">

          <label>
            Flavor
          </label>

          <div class="option-list">

            ${Object.entries(product.flavors)
              .map(
                ([id, name], index) => `
                  <button
                    type="button"
                    class="option-button flavor-option ${
                      index === 0 ? "active" : ""
                    }"
                    data-flavor-id="${escapeHtml(id)}"
                    aria-pressed="${index === 0 ? "true" : "false"}"
                  >
                    ${escapeHtml(name)}
                  </button>
                `,
              )
              .join("")}

          </div>

        </div>

        <div class="customize-field">

          <label>
            Size
          </label>

          <div class="option-list">

            ${Object.entries(product.sizes)
              .map(
                ([id, price]) => `
                  <button
                    type="button"
                    class="option-button size-option ${
                      id === defaultSize ? "active" : ""
                    }"
                    data-size-id="${escapeHtml(id)}"
                    aria-pressed="${id === defaultSize ? "true" : "false"}"
                  >
                    ${escapeHtml(formatOptionLabel(id))}
                  </button>
                `,
              )
              .join("")}

          </div>

        </div>

        <div class="customize-field">
          <label>Price</label>
          <div class="product-price" data-custom-price="${escapeHtml(product.id)}">${formatMoney(product.sizes?.[defaultSize])}</div>
        </div>

      </div>

      <div class="customize-actions">

        <button
          type="button"
          class="product-add-btn confirm-product-btn"
          data-product-id="${escapeHtml(product.id)}"
        >
          Add to order
        </button>

      </div>
    `;
  }

  if (product.type === "parfait-custom") {
    return `
      <div class="customize-grid">

        <div class="customize-field">

          <label>
            Fruits
          </label>

          <div class="option-list">

            ${Object.entries(product.fruits)
              .map(
                ([id, name]) => `
                  <button
                    type="button"
                    class="option-button parfait-fruit-option"
                    data-fruit-id="${escapeHtml(id)}"
                    aria-pressed="false"
                  >
                    ${escapeHtml(name)}
                  </button>
                `,
              )
              .join("")}

          </div>

          <div class="fruit-limit">
            Choose up to ${MAX_PARFAIT_FRUITS} fruits.
          </div>

        </div>

        <div class="customize-field">

          <label>
            Toppings
          </label>

          <div class="option-list">

            ${Object.entries(product.toppings)
              .map(
                ([id, name]) => `
                  <button
                    type="button"
                    class="option-button parfait-topping-option"
                    data-topping-id="${escapeHtml(id)}"
                    aria-pressed="false"
                  >
                    ${escapeHtml(name)}
                  </button>
                `,
              )
              .join("")}

          </div>

        </div>

        <div class="customize-field">

          <label>
            Syrup
          </label>

          <div class="option-list">

            ${Object.entries(product.syrups)
              .map(
                ([id, name], index) => `
                  <button
                    type="button"
                    class="option-button parfait-syrup-option ${
                      index === 0 ? "active" : ""
                    }"
                    data-syrup-id="${escapeHtml(id)}"
                    aria-pressed="${index === 0 ? "true" : "false"}"
                  >
                    ${escapeHtml(name)}
                  </button>
                `,
              )
              .join("")}

          </div>

        </div>

        <div class="customize-field">

          <label>
            Price
          </label>

          <div class="product-price">
            ${formatMoney(product.price)}
          </div>

        </div>

      </div>

      <div class="customize-actions">

        <button
          type="button"
          class="product-add-btn confirm-product-btn"
          data-product-id="${escapeHtml(product.id)}"
        >
          Add to order
        </button>

      </div>
    `;
  }

  if (product.type === "size-sweetness") {
    const sizes = Object.keys(product.prices || {});
    const sweetnesses = [
      ...new Set(
        Object.values(product.prices || {}).flatMap((prices) =>
          Object.keys(prices || {}),
        ),
      ),
    ];
    const defaultSize = sizes.includes("1l") ? "1l" : sizes[0];
    const defaultSweetness = sweetnesses.includes("sweetened")
      ? "sweetened"
      : sweetnesses[0];
    return `
      <div class="customize-grid">

        <div class="customize-field">

          <label>
            Size
          </label>

          <div class="option-list">

            ${sizes.map((size) => `<button type="button" class="option-button greek-size-option ${size === defaultSize ? "active" : ""}" data-greek-size="${escapeHtml(size)}" aria-pressed="${size === defaultSize}">${escapeHtml(formatOptionLabel(size))}</button>`).join("")}

          </div>

        </div>

        <div class="customize-field">

          <label>
            Sweetness
          </label>

          <div class="option-list">

            ${sweetnesses.map((sweetness) => `<button type="button" class="option-button greek-sweetness-option ${sweetness === defaultSweetness ? "active" : ""}" data-greek-sweetness="${escapeHtml(sweetness)}" aria-pressed="${sweetness === defaultSweetness}">${escapeHtml(formatOptionLabel(sweetness))}</button>`).join("")}

          </div>

        </div>

        <div class="customize-field">
          <label>Price</label>
          <div class="product-price" data-custom-price="${escapeHtml(product.id)}">${formatMoney(product.prices?.[defaultSize]?.[defaultSweetness])}</div>
        </div>

      </div>

      <div class="customize-actions">

        <button
          type="button"
          class="product-add-btn confirm-product-btn"
          data-product-id="${escapeHtml(product.id)}"
        >
          Add to order
        </button>

      </div>
    `;
  }

  return "";
}

/* =========================================================
   PRODUCT INTERACTIONS
========================================================= */

function updateCustomizationPrice(box) {
  const productId = box.closest(".product-row")?.dataset.productId;
  const product = PRODUCTS[productId];
  const priceElement = box.querySelector("[data-custom-price]");
  if (!product || !priceElement) return;

  let price = 0;
  if (product.type === "flavor-size") {
    const size = box.querySelector(".size-option.active")?.dataset.sizeId;
    price = product.sizes?.[size];
  } else if (product.type === "size-sweetness") {
    const size = box.querySelector(".greek-size-option.active")?.dataset
      .greekSize;
    const sweetness = box.querySelector(".greek-sweetness-option.active")
      ?.dataset.greekSweetness;
    price = product.prices?.[size]?.[sweetness];
  }
  priceElement.textContent = formatMoney(price);
}

function initializeProductInteractions() {
  $$(".product-add-btn[data-product-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.dataset.productId;

      const box = document.querySelector(`[data-customize-box="${productId}"]`);

      if (!box) {
        return;
      }

      const wasHidden = box.hidden;

      $$(".customize-box").forEach((otherBox) => {
        if (otherBox !== box) {
          otherBox.hidden = true;
        }
      });

      box.hidden = !wasHidden;

      if (!box.hidden) {
        box.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    });
  });

  $$(".confirm-product-btn").forEach((button) => {
    button.addEventListener("click", () => {
      addCustomizedProduct(button.dataset.productId);
    });
  });

  /* ---------------------------------------------------------
     BRUKINA OPTION
  --------------------------------------------------------- */

  $$(".brukina-topping-option").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      button.setAttribute(
        "aria-pressed",
        button.classList.contains("active") ? "true" : "false",
      );
    });
  });

  /* ---------------------------------------------------------
     FRESH YOGHURT FLAVOR
  --------------------------------------------------------- */

  $$(".flavor-option").forEach((button) => {
    button.addEventListener("click", () => {
      const box = button.closest(".customize-box");

      if (!box) {
        return;
      }

      box.querySelectorAll(".flavor-option").forEach((option) => {
        option.classList.remove("active");
        option.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      updateCustomizationPrice(box);
    });
  });

  /* ---------------------------------------------------------
     FRESH YOGHURT SIZE
  --------------------------------------------------------- */

  $$(".size-option").forEach((button) => {
    button.addEventListener("click", () => {
      const box = button.closest(".customize-box");

      if (!box) {
        return;
      }

      box.querySelectorAll(".size-option").forEach((option) => {
        option.classList.remove("active");
        option.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      updateCustomizationPrice(box);
    });
  });

  /* ---------------------------------------------------------
     PARFAIT FRUITS
  --------------------------------------------------------- */

  $$(".parfait-fruit-option").forEach((button) => {
    button.addEventListener("click", () => {
      const box = button.closest(".customize-box");

      if (!box) {
        return;
      }

      const selected = box.querySelectorAll(".parfait-fruit-option.active");

      if (
        !button.classList.contains("active") &&
        selected.length >= MAX_PARFAIT_FRUITS
      ) {
        showSmallNotice(`You can select up to ${MAX_PARFAIT_FRUITS} fruits.`);

        return;
      }

      button.classList.toggle("active");

      button.setAttribute(
        "aria-pressed",
        button.classList.contains("active") ? "true" : "false",
      );
    });
  });

  /* ---------------------------------------------------------
     PARFAIT TOPPINGS
  --------------------------------------------------------- */

  $$(".parfait-topping-option").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");

      button.setAttribute(
        "aria-pressed",
        button.classList.contains("active") ? "true" : "false",
      );
    });
  });

  /* ---------------------------------------------------------
     PARFAIT SYRUP
  --------------------------------------------------------- */

  $$(".parfait-syrup-option").forEach((button) => {
    button.addEventListener("click", () => {
      const box = button.closest(".customize-box");

      if (!box) {
        return;
      }

      box.querySelectorAll(".parfait-syrup-option").forEach((option) => {
        option.classList.remove("active");
        option.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      updateCustomizationPrice(box);
    });
  });

  /* ---------------------------------------------------------
     GREEK YOGHURT SIZE
  --------------------------------------------------------- */

  $$(".greek-size-option").forEach((button) => {
    button.addEventListener("click", () => {
      const box = button.closest(".customize-box");

      if (!box) {
        return;
      }

      box.querySelectorAll(".greek-size-option").forEach((option) => {
        option.classList.remove("active");
        option.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      updateCustomizationPrice(box);
    });
  });

  /* ---------------------------------------------------------
     GREEK YOGHURT SWEETNESS
  --------------------------------------------------------- */

  $$(".greek-sweetness-option").forEach((button) => {
    button.addEventListener("click", () => {
      const box = button.closest(".customize-box");

      if (!box) {
        return;
      }

      box.querySelectorAll(".greek-sweetness-option").forEach((option) => {
        option.classList.remove("active");
        option.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      updateCustomizationPrice(box);
    });
  });

  initializeRippleButtons();
}

/* =========================================================
   ADD CUSTOMIZED PRODUCT
========================================================= */

function addCustomizedProduct(productId) {
  const product = PRODUCTS[productId];

  if (!product) {
    return;
  }

  const box = document.querySelector(`[data-customize-box="${productId}"]`);

  if (!box) {
    return;
  }

  const options = {
    includeCoconut: false,
    flavorId: "plain",
    sizeId: null,
    fruits: [],
    toppings: [],
    syrupId: "none",
    sweetnessId: null,
  };

  /* ---------------------------------------------------------
     BRUKINA
  --------------------------------------------------------- */

  if (product.type === "brukina-custom") {
    options.toppings = [
      ...box.querySelectorAll(".brukina-topping-option.active"),
    ].map((button) => button.dataset.brukinaTopping);
    options.includeCoconut = options.toppings.includes("coconut_flakes");
  }

  /* ---------------------------------------------------------
     FRESH YOGHURT DRINK
  --------------------------------------------------------- */

  if (product.type === "flavor-size") {
    const selectedFlavor = box.querySelector(".flavor-option.active");

    const selectedSize = box.querySelector(".size-option.active");

    options.flavorId = selectedFlavor?.dataset.flavorId || "plain";

    options.sizeId =
      selectedSize?.dataset.sizeId ||
      (Object.keys(product.sizes || {}).includes("500ml")
        ? "500ml"
        : Object.keys(product.sizes || {})[0]);
  }

  /* ---------------------------------------------------------
     PARFAIT
  --------------------------------------------------------- */

  if (product.type === "parfait-custom") {
    options.fruits = [
      ...box.querySelectorAll(".parfait-fruit-option.active"),
    ].map((button) => button.dataset.fruitId);

    options.toppings = [
      ...box.querySelectorAll(".parfait-topping-option.active"),
    ].map((button) => button.dataset.toppingId);

    const selectedSyrup = box.querySelector(".parfait-syrup-option.active");

    options.syrupId = selectedSyrup?.dataset.syrupId || "none";
  }

  /* ---------------------------------------------------------
     GREEK YOGHURT
  --------------------------------------------------------- */

  if (product.type === "size-sweetness") {
    const selectedSize = box.querySelector(".greek-size-option.active");

    const selectedSweetness = box.querySelector(
      ".greek-sweetness-option.active",
    );

    options.sizeId =
      selectedSize?.dataset.greekSize ||
      (Object.keys(product.prices || {}).includes("1l")
        ? "1l"
        : Object.keys(product.prices || {})[0]);

    options.sweetnessId =
      selectedSweetness?.dataset.greekSweetness ||
      (Object.keys(product.prices?.[options.sizeId] || {}).includes("sweetened")
        ? "sweetened"
        : Object.keys(product.prices?.[options.sizeId] || {})[0]);
  }

  const unitPrice = getProductUnitPrice(product, options);

  if (!unitPrice) {
    showSmallNotice("Please select the available options first.");

    return;
  }

  const description = getCartItemDescription(product, options);

  const existingItem = cart.find(
    (item) =>
      item.productId === productId &&
      JSON.stringify(item.options) === JSON.stringify(options),
  );

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      cartId: `${productId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

      productId,

      productName: product.name,

      quantity: 1,

      unitPrice,

      description,

      options,
    });
  }

  renderCart();
  updateCartBadge();
  updateMomoAmount();

  animateFlyToCart();

  showSmallNotice(`${product.name} added to your order.`);
}

/* =========================================================
   CART
========================================================= */

function getCartTotal() {
  return cart.reduce(
    (total, item) => total + Number(item.unitPrice) * Number(item.quantity),
    0,
  );
}

function renderCart() {
  const cartList = $("#cartList");

  if (!cartList) {
    return;
  }

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="cart-empty">

        <strong>
          Your order is empty.
        </strong>

        <span>
          Add something delicious from the menu.
        </span>

      </div>
    `;

    updateMomoAmount();

    return;
  }

  cartList.innerHTML = `
    ${cart
      .map(
        (item) => `
          <div class="cart-item">

            <div class="cart-item-head">

              <div>

                <div class="cart-item-name">
                  ${escapeHtml(item.productName)}
                </div>

                <div class="cart-item-description">
                  ${escapeHtml(item.description)}
                </div>

              </div>

              <div class="cart-item-price">
                ${formatMoney(item.unitPrice * item.quantity)}
              </div>

            </div>

            <div class="cart-item-controls">

              <div class="quantity-controls">

                <button
                  type="button"
                  class="quantity-btn"
                  data-cart-action="decrease"
                  data-cart-id="${escapeHtml(item.cartId)}"
                  aria-label="Decrease quantity"
                >
                  −
                </button>

                <span class="quantity-value">
                  ${item.quantity}
                </span>

                <button
                  type="button"
                  class="quantity-btn"
                  data-cart-action="increase"
                  data-cart-id="${escapeHtml(item.cartId)}"
                  aria-label="Increase quantity"
                >
                  +
                </button>

              </div>

              <button
                type="button"
                class="remove-cart-item"
                data-cart-action="remove"
                data-cart-id="${escapeHtml(item.cartId)}"
              >
                Remove
              </button>

            </div>

          </div>
        `,
      )
      .join("")}

    <div class="cart-total-row">

      <span>
        Order total
      </span>

      <strong>
        ${formatMoney(getCartTotal())}
      </strong>

    </div>
  `;

  $$(".quantity-btn, .remove-cart-item").forEach((button) => {
    button.addEventListener("click", () => {
      handleCartAction(button.dataset.cartAction, button.dataset.cartId);
    });
  });

  updateMomoAmount();
}

/* =========================================================
   CART ACTIONS
========================================================= */

function handleCartAction(action, cartId) {
  const item = cart.find((cartItem) => cartItem.cartId === cartId);

  if (!item) {
    return;
  }

  if (action === "increase") {
    item.quantity += 1;
  }

  if (action === "decrease") {
    item.quantity -= 1;

    if (item.quantity <= 0) {
      cart = cart.filter((cartItem) => cartItem.cartId !== cartId);
    }
  }

  if (action === "remove") {
    cart = cart.filter((cartItem) => cartItem.cartId !== cartId);
  }

  renderCart();
  updateCartBadge();
  updateMomoAmount();
}

function updateCartBadge() {
  const cartCount = $("#cartCount");

  if (!cartCount) {
    return;
  }

  const count = cart.reduce((total, item) => total + Number(item.quantity), 0);

  cartCount.textContent = count;
}

/* =========================================================
   PAYSTACK AMOUNT DISPLAY
========================================================= */

function updateMomoAmount() {
  const amount = $("#momoAmount");

  if (!amount) {
    return;
  }

  amount.textContent = formatMoney(getCartTotal());
}

/* =========================================================
   DRAWER
========================================================= */

function openDrawer() {
  const drawer = $("#drawer");

  const backdrop = $("#backdrop");

  if (!drawer || !backdrop) {
    return;
  }

  drawer.classList.add("open");

  drawer.setAttribute("aria-hidden", "false");

  backdrop.classList.add("show");

  backdrop.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");
}

function closeDrawer() {
  const drawer = $("#drawer");

  const backdrop = $("#backdrop");

  if (!drawer || !backdrop) {
    return;
  }

  drawer.classList.remove("open");

  drawer.setAttribute("aria-hidden", "true");

  backdrop.classList.remove("show");

  backdrop.setAttribute("aria-hidden", "true");

  document.body.classList.remove("modal-open");
}

/* =========================================================
   DELIVERY VISIBILITY
========================================================= */

function updateAddressVisibility() {
  const orderMethod = $("#orderMethod");

  const deliveryFields = $("#deliveryFields");

  const deliveryAddress = $("#deliveryAddress");

  if (!orderMethod || !deliveryFields) {
    return;
  }

  const isDelivery = orderMethod.value === "Delivery";

  deliveryFields.hidden = !isDelivery;

  if (deliveryAddress) {
    deliveryAddress.required = isDelivery;
  }

  if (!isDelivery) {
    deliveryLocation = {
      lat: null,
      lng: null,
      link: null,
    };

    const locationStatus = $("#locationStatus");

    const resetLocationBtn = $("#resetLocationBtn");

    if (locationStatus) {
      locationStatus.textContent = "";
    }

    if (resetLocationBtn) {
      resetLocationBtn.hidden = true;
    }
  }
}

/* =========================================================
   ORDER METHOD OPTIONS
========================================================= */

function initializeOrderMethodOptions() {
  const options = $$(".order-method-options .option-btn");

  const hiddenInput = $("#orderMethod");

  if (!options.length || !hiddenInput) {
    return;
  }

  options.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedMethod = button.dataset.orderMethod;

      if (!selectedMethod) {
        return;
      }

      options.forEach((option) => {
        option.classList.remove("selected");

        option.setAttribute("aria-pressed", "false");
      });

      button.classList.add("selected");

      button.setAttribute("aria-pressed", "true");

      hiddenInput.value = selectedMethod;

      updateAddressVisibility();
    });
  });
}

/* =========================================================
   LOCATION
========================================================= */

function initializeLocation() {
  const useLocationBtn = $("#useLocationBtn");

  const resetLocationBtn = $("#resetLocationBtn");

  if (useLocationBtn) {
    useLocationBtn.addEventListener("click", useCurrentLocation);
  }

  if (resetLocationBtn) {
    resetLocationBtn.addEventListener("click", resetLocation);
  }
}

function useCurrentLocation() {
  const status = $("#locationStatus");

  const buttonText = $("#useLocationBtnText");

  const resetButton = $("#resetLocationBtn");

  const deliveryAddress = $("#deliveryAddress");

  if (!navigator.geolocation) {
    if (status) {
      status.textContent = "Location is not supported by this browser.";
    }

    return;
  }

  if (buttonText) {
    buttonText.textContent = "Getting your location...";
  }

  if (status) {
    status.textContent = "Please allow location access when your browser asks.";
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;

      const lng = position.coords.longitude;

      const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;

      deliveryLocation = {
        lat,
        lng,
        link: mapLink,
      };

      if (deliveryAddress) {
        deliveryAddress.value =
          `Current location: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n` +
          `Google Maps location: ${mapLink}`;

        deliveryAddress.classList.remove("field-error");
      }

      if (buttonText) {
        buttonText.textContent = "Location added";
      }

      if (status) {
        status.textContent =
          "Your current location has been added to the delivery address.";
      }

      if (resetButton) {
        resetButton.hidden = false;
      }
    },
    (error) => {
      if (buttonText) {
        buttonText.textContent = "Use my current location";
      }

      if (status) {
        if (error.code === 1) {
          status.textContent =
            "Location permission was denied. You can enter your delivery address instead.";
        } else {
          status.textContent =
            "We couldn't get your location. Please enter your delivery address instead.";
        }
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    },
  );
}

function resetLocation() {
  deliveryLocation = {
    lat: null,
    lng: null,
    link: null,
  };

  const status = $("#locationStatus");

  const buttonText = $("#useLocationBtnText");

  const resetButton = $("#resetLocationBtn");

  const deliveryAddress = $("#deliveryAddress");

  if (status) {
    status.textContent = "";
  }

  if (buttonText) {
    buttonText.textContent = "Use my current location";
  }

  if (resetButton) {
    resetButton.hidden = true;
  }

  if (deliveryAddress) {
    deliveryAddress.value = "";
  }
}

/* =========================================================
   FORM VALIDATION
========================================================= */

function validateOrderForm() {
  const form = $("#orderForm");

  if (!form) {
    return false;
  }

  let valid = true;

  const customerName = $("#customerName");

  const customerPhone = $("#customerPhone");

  const orderMethod = $("#orderMethod");

  const deliveryAddress = $("#deliveryAddress");

  // Paystack handles payment — only validate customer info fields
  [customerName, customerPhone].forEach((field) => {
    if (!field) {
      return;
    }

    field.classList.remove("field-error");

    if (!field.value.trim()) {
      field.classList.add("field-error");

      valid = false;
    }
  });

  const isDelivery = orderMethod?.value === "Delivery";

  if (isDelivery) {
    if (
      deliveryAddress &&
      !deliveryAddress.value.trim() &&
      !deliveryLocation.link
    ) {
      deliveryAddress.classList.add("field-error");

      valid = false;
    }
  }

  if (!valid) {
    showSmallNotice("Please complete the required order information.");

    const firstError = form.querySelector(".field-error");

    firstError?.focus();
  }

  return valid;
}

/* =========================================================
   ORDER SUBMISSION — PAYSTACK
========================================================= */

async function submitOrder(event) {
  event.preventDefault();

  if (cart.length === 0) {
    showSmallNotice("Your order is empty. Please add something first.");

    return;
  }

  if (!validateOrderForm()) {
    return;
  }

  const submitButton = $("#submitOrderBtn");

  const customerName = $("#customerName").value.trim();

  const customerPhone = $("#customerPhone").value.trim();

  const orderMethod = $("#orderMethod").value;

  const deliveryAddress = $("#deliveryAddress")?.value.trim() || "";

  const amountGHS = getCartTotal();

  if (submitButton) {
    submitButton.disabled = true;

    submitButton.textContent = "Preparing payment...";
  }

  try {
    // -------------------------------------------------------
    // Step 1 — Ask the server to initialise a Paystack charge
    // -------------------------------------------------------
    const initResponse = await fetch(`${API_BASE_URL}/paystack/initialize`, {
      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        email: `${customerPhone.replace(/\s/g, "")}@aoandbeverages.com`,
        amountGHS,
        customerName,
        customerPhone,
      }),
    });

    const initData = await initResponse.json().catch(() => ({}));

    if (!initResponse.ok) {
      throw new Error(
        initData.message || "Could not start the payment. Please try again.",
      );
    }

    const { reference } = initData;

    // -------------------------------------------------------
    // Step 2 — Open Paystack inline popup
    // -------------------------------------------------------
    const handler = PaystackPop.setup({
      key: initData.publicKey,

      email: initData.email,

      amount: initData.amountKobo,

      currency: "GHS",

      ref: reference,

      metadata: {
        custom_fields: [
          {
            display_name: "Customer Name",
            variable_name: "customer_name",
            value: customerName,
          },
          {
            display_name: "Phone",
            variable_name: "customer_phone",
            value: customerPhone,
          },
          {
            display_name: "Order Method",
            variable_name: "order_method",
            value: orderMethod,
          },
        ],
      },

      onClose() {
        // User dismissed the popup without paying
        if (submitButton) {
          submitButton.disabled = false;

          submitButton.textContent = "Pay & Place Order";
        }

        showSmallNotice("Payment was not completed.");
      },

      callback: function (transaction) {
        try {
          showSmallNotice(
            "Payment confirmed by Paystack — finalizing order...",
          );
        } catch (e) {}
        if (submitButton) submitButton.textContent = "Placing your order...";

        // Call the async handler in a microtask so we pass a plain function to Paystack
        setTimeout(() => {
          (async () => {
            try {
              console.log("Paystack callback", transaction);
              await placeOrderWithReference(transaction.reference);
            } catch (err) {
              console.error("Error in paystack callback wrapper:", err);
            }
          })();
        }, 0);
      },
    });

    // Helper to post the order to the backend given a Paystack reference
    async function placeOrderWithReference(ref) {
      if (!ref || paystackOrderProcessing) return;
      paystackOrderProcessing = true;

      try {
        try {
          showOrderSuccess(ref, amountGHS);
        } catch (e) {}

        const orderPayload = {
          customerName,
          customerPhone,
          orderMethod,
          deliveryAddress:
            orderMethod === "Delivery" ? deliveryAddress || null : null,
          locationLat: orderMethod === "Delivery" ? deliveryLocation.lat : null,
          locationLng: orderMethod === "Delivery" ? deliveryLocation.lng : null,
          locationLink:
            orderMethod === "Delivery" ? deliveryLocation.link : null,
          paystackReference: ref,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            includeCoconut: item.options?.includeCoconut || false,
            flavorId: item.options?.flavorId || null,
            sizeId: item.options?.sizeId || null,
            fruits: item.options?.fruits || [],
            toppings: item.options?.toppings || [],
            syrupId: item.options?.syrupId || "none",
            sweetnessId: item.options?.sweetnessId || null,
          })),
        };

        const response = await fetch(`${API_BASE_URL}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok)
          throw new Error(data.message || "Could not save order.");

        if (data.orderNumber)
          localStorage.setItem("aoLatestOrderNumber", data.orderNumber);

        cart = [];
        renderCart();
        updateCartBadge();
        updateMomoAmount();
        resetOrderForm();
        closeDrawer();
        showOrderSuccess(
          data.orderNumber || ref,
          data.totalAmount || amountGHS,
        );
      } catch (orderError) {
        console.error("Order save error after payment:", orderError);
        showSmallNotice(
          orderError.message ||
            "Your payment went through but we couldn't record your order.",
        );
      } finally {
        paystackOrderProcessing = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Pay & Place Order";
        }
      }
    }

    handler.openIframe();

    // Poll Paystack via backend verify endpoint for flows that don't immediately call back
    (function startPolling(referenceToCheck) {
      const pollInterval = 3000;
      const maxAttempts = 40;
      let attempts = 0;

      const id = setInterval(async () => {
        attempts += 1;
        if (paystackOrderProcessing || attempts > maxAttempts) {
          clearInterval(id);
          if (attempts > maxAttempts) {
            showSmallNotice(
              "Payment pending — please complete the authorization on your device.",
            );
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = "Pay & Place Order";
            }
          }
          return;
        }

        try {
          const resp = await fetch(
            `${API_BASE_URL}/paystack/verify/${encodeURIComponent(referenceToCheck)}`,
          );
          const json = await resp.json().catch(() => ({}));

          if (resp.ok && json.status === "success") {
            clearInterval(id);
            await placeOrderWithReference(referenceToCheck);
          }
        } catch (e) {
          // ignore transient errors
        }
      }, pollInterval);
    })(reference);
  } catch (error) {
    console.error("Paystack init error:", error);

    showSmallNotice(
      error.message || "We couldn't start the payment. Please try again.",
    );

    if (submitButton) {
      submitButton.disabled = false;

      submitButton.textContent = "Pay & Place Order";
    }
  }
}

/* =========================================================
   RESET FORM
========================================================= */

function resetOrderForm() {
  const form = $("#orderForm");

  if (form) {
    form.reset();
  }

  deliveryLocation = {
    lat: null,
    lng: null,
    link: null,
  };

  const locationStatus = $("#locationStatus");

  const resetLocationBtn = $("#resetLocationBtn");

  const buttonText = $("#useLocationBtnText");

  if (locationStatus) {
    locationStatus.textContent = "";
  }

  if (resetLocationBtn) {
    resetLocationBtn.hidden = true;
  }

  if (buttonText) {
    buttonText.textContent = "Use my current location";
  }

  const orderMethod = $("#orderMethod");

  if (orderMethod) {
    orderMethod.value = "Pickup";
  }

  $$(".order-method-options .option-btn").forEach((button) => {
    const isPickup = button.dataset.orderMethod === "Pickup";

    button.classList.toggle("selected", isPickup);

    button.setAttribute("aria-pressed", isPickup ? "true" : "false");
  });

  updateAddressVisibility();
}

/* =========================================================
   SUCCESS MODAL
========================================================= */

function showOrderSuccess(orderNumber, totalAmount) {
  const modal = $("#aoOrderSuccessModal");

  const number = $("#aoSuccessOrderNumber");

  if (!modal) {
    return;
  }

  if (number) {
    number.textContent = orderNumber || "Order submitted";
  }

  modal.dataset.orderNumber = orderNumber || "";

  modal.dataset.totalAmount = totalAmount || "";

  modal.classList.add("show");

  modal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  setTimeout(() => {
    $("#aoTrackFromSuccess")?.focus();
  }, 100);
}

function closeOrderSuccess() {
  const modal = $("#aoOrderSuccessModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("show");

  modal.setAttribute("aria-hidden", "true");

  if (!$("#aoTrackingModal")?.classList.contains("show")) {
    document.body.classList.remove("modal-open");
  }
}

/* =========================================================
   TRACKING MODAL
========================================================= */

function openTrackingModal(orderNumber = "") {
  const modal = $("#aoTrackingModal");

  const input = $("#aoTrackingOrderNumber");

  if (!modal) {
    return;
  }

  modal.classList.add("show");

  modal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

  trackingOrderNumber =
    orderNumber || localStorage.getItem("aoLatestOrderNumber") || "";

  if (input) {
    input.value = trackingOrderNumber;

    setTimeout(() => {
      input.focus();

      if (input.value) {
        input.select();
      }
    }, 100);
  }

  if (trackingOrderNumber) {
    fetchTrackedOrder(trackingOrderNumber);
  } else {
    renderTrackingEmpty();
  }
}

function closeTrackingModal() {
  const modal = $("#aoTrackingModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("show");

  modal.setAttribute("aria-hidden", "true");

  if (!$("#aoOrderSuccessModal")?.classList.contains("show")) {
    document.body.classList.remove("modal-open");
  }
}

/* =========================================================
   TRACKING FORM
========================================================= */

async function handleTrackingSubmit(event) {
  event.preventDefault();

  const input = $("#aoTrackingOrderNumber");

  if (!input) {
    return;
  }

  const orderNumber = input.value.trim().toUpperCase();

  if (!orderNumber) {
    renderTrackingError("Please enter your order number.");

    input.focus();

    return;
  }

  trackingOrderNumber = orderNumber;

  localStorage.setItem("aoLatestOrderNumber", orderNumber);

  await fetchTrackedOrder(orderNumber);
}

/* =========================================================
   FETCH TRACKED ORDER
========================================================= */

async function fetchTrackedOrder(orderNumber) {
  const result = $("#aoTrackingResult");

  if (!result) {
    return;
  }

  const normalized = String(orderNumber || "")
    .trim()
    .toUpperCase();

  if (!normalized) {
    renderTrackingEmpty();

    return;
  }

  renderTrackingLoading();

  try {
    const response = await fetch(
      `${API_BASE_URL}/orders/track/${encodeURIComponent(normalized)}?t=${Date.now()}`,
      {
        method: "GET",

        cache: "no-store",

        headers: {
          Accept: "application/json",
        },
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "We couldn't find that order.");
    }

    renderTrackedOrder(data.order || data);
  } catch (error) {
    console.error("Tracking error:", error);

    renderTrackingError(
      error.message ||
        "We couldn't find that order. Please check the order number and try again.",
    );
  }
}

/* =========================================================
   TRACKING LOADING
========================================================= */

function renderTrackingLoading() {
  const result = $("#aoTrackingResult");

  if (!result) {
    return;
  }

  result.innerHTML = `
    <div class="ao-loading">

      <span
        class="ao-loading-spinner"
        aria-hidden="true"
      ></span>

      <span>
        Checking your order...
      </span>

    </div>
  `;
}

/* =========================================================
   TRACKING EMPTY
========================================================= */

function renderTrackingEmpty() {
  const result = $("#aoTrackingResult");

  if (!result) {
    return;
  }

  result.innerHTML = `
    <div class="ao-tracking-empty">
      Enter your order number above to see your
      order status.
    </div>
  `;
}

/* =========================================================
   TRACKING ERROR
========================================================= */

function renderTrackingError(message) {
  const result = $("#aoTrackingResult");

  if (!result) {
    return;
  }

  result.innerHTML = `
    <div class="ao-tracking-error">
      ${escapeHtml(message)}
    </div>
  `;
}

/* =========================================================
   TRACKING STATUS
========================================================= */

function getTrackingStatusInfo(order) {
  const orderStatus = order.orderStatus || "Pending";

  const paymentStatus = order.paymentStatus || "Pending";

  if (orderStatus === "Cancelled") {
    return {
      label: "Cancelled",

      className: "ao-status-cancelled",

      message:
        "This order has been cancelled. Please contact us if you need help.",
    };
  }

  if (paymentStatus === "Rejected") {
    return {
      label: "Payment not verified",
      message:
        "We could not verify the payment for this order. If you believe a payment was made, please reach out to us immediately so we can look into the issue and work with you to resolve it.",
      tone: "warning",
    };
  }

  if (orderStatus === "Completed") {
    return {
      label: "Completed",

      className: "ao-status-completed",

      message: "Your order has been completed. Thank you!",
    };
  }

  if (orderStatus === "Ready") {
    return {
      label: "Ready",

      className: "ao-status-ready",

      message: "Your order is ready!",
    };
  }

  if (orderStatus === "Processing") {
    return {
      label: "Processing",

      className: "ao-status-processing",

      message: "We're preparing your order now.",
    };
  }

  if (paymentStatus === "Verified") {
    return {
      label: "Payment verified",

      className: "ao-status-processing",

      message: "Payment verified. Your order is waiting to be prepared.",
    };
  }

  return {
    label: "Order received",

    className: "ao-status-pending",

    message: "We've received your order. We're waiting to verify your payment.",
  };
}

/* =========================================================
   TRACKING TIMELINE
========================================================= */

function getTimelineSteps(order) {
  const orderStatus = order.orderStatus || "Pending";

  const paymentStatus = order.paymentStatus || "Pending";

  if (orderStatus === "Cancelled") {
    return [
      {
        title: "Order received",

        description: "Your order was received.",

        state: "complete",
      },

      {
        title: "Order cancelled",

        description: "This order has been cancelled.",

        state: "cancelled",
      },
    ];
  }

  const paymentStep = {
    title: "Payment verified",

    description:
      paymentStatus === "Verified"
        ? "Your payment has been verified."
        : paymentStatus === "Rejected"
          ? "We could not verify your payment reference."
          : "Payment verification is pending.",

    state:
      paymentStatus === "Verified"
        ? "complete"
        : paymentStatus === "Rejected"
          ? "cancelled"
          : "active",
  };

  let processingState = "pending";

  let readyState = "pending";

  let completedState = "pending";

  if (orderStatus === "Processing") {
    processingState = "active";
  }

  if (orderStatus === "Ready") {
    processingState = "complete";

    readyState = "active";
  }

  if (orderStatus === "Completed") {
    processingState = "complete";

    readyState = "complete";

    completedState = "complete";
  }

  if (orderStatus === "Pending" && paymentStatus === "Verified") {
    processingState = "active";
  }

  return [
    {
      title: "Order received",

      description: "Your order has been received.",

      state: "complete",
    },

    paymentStep,

    {
      title: "Processing",

      description:
        processingState === "active"
          ? "We're preparing your order now."
          : processingState === "complete"
            ? "Your order has been prepared."
            : "Your order has not reached this stage yet.",

      state: processingState,
    },

    {
      title: "Ready",

      description:
        readyState === "active"
          ? "Your order is ready!"
          : readyState === "complete"
            ? "Your order was ready for collection or delivery."
            : "We'll let you know when your order is ready.",

      state: readyState,
    },

    {
      title: "Completed",

      description:
        completedState === "complete"
          ? "Your order has been completed. Thank you!"
          : "This is the final stage of your order.",

      state: completedState,
    },
  ];
}

/* =========================================================
   TRACKING DATE
========================================================= */

function formatTrackingDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",

    timeStyle: "short",
  });
}

/* =========================================================
   RENDER TRACKED ORDER
========================================================= */

function renderTrackedOrder(order) {
  const result = $("#aoTrackingResult");

  if (!result) {
    return;
  }

  const statusInfo = getTrackingStatusInfo(order);

  const timeline = getTimelineSteps(order);

  const items = Array.isArray(order.items) ? order.items : [];

  const orderNumber = order.orderNumber || trackingOrderNumber;

  const createdAt = formatTrackingDate(order.createdAt);

  result.innerHTML = `
    <div class="ao-tracking-summary">

      <div class="ao-tracking-summary-top">

        <div>

          <div class="ao-tracking-order-number">
            ${escapeHtml(orderNumber)}
          </div>

          ${
            createdAt
              ? `
                <div class="ao-tracking-date">
                  Ordered ${escapeHtml(createdAt)}
                </div>
              `
              : ""
          }

        </div>

        <span
          class="ao-status-badge ${statusInfo.className}"
        >
          ${escapeHtml(statusInfo.label)}
        </span>

      </div>

      <div class="ao-status-message">
        ${escapeHtml(statusInfo.message)}
      </div>

      <div class="ao-tracking-section-title">
        Order progress
      </div>

      <div class="ao-timeline">

        ${timeline
          .map(
            (step) => `
              <div
                class="ao-timeline-step ${escapeHtml(step.state)}"
              >

                <div
                  class="ao-timeline-dot"
                  aria-hidden="true"
                ></div>

                <div>

                  <div class="ao-timeline-title">
                    ${escapeHtml(step.title)}
                  </div>

                  <div class="ao-timeline-description">
                    ${escapeHtml(step.description)}
                  </div>

                </div>

              </div>
            `,
          )
          .join("")}

      </div>

      <div class="ao-tracking-section-title">
        Your items
      </div>

      <div class="ao-tracking-items">

        ${
          items.length > 0
            ? items
                .map((item) => {
                  const productName =
                    item.product_name || item.productName || "Product";

                  const unitPrice = Number(
                    item.unit_price ?? item.unitPrice ?? 0,
                  );

                  const quantity = Number(item.quantity ?? 0);

                  const description = item.description || "";

                  const lineTotal = unitPrice * quantity;

                  return `
                    <div class="ao-tracking-item">

                      <div>

                        <div class="ao-tracking-item-name">
                          ${escapeHtml(productName)}
                        </div>

                        ${
                          description
                            ? `
                              <div class="ao-tracking-item-description">
                                ${escapeHtml(description)}
                              </div>
                            `
                            : ""
                        }

                      </div>

                      <div class="ao-tracking-item-meta">

                        ×${quantity}

                        <br />

                        ${formatMoney(lineTotal)}

                      </div>

                    </div>
                  `;
                })
                .join("")
            : `
                <div class="ao-tracking-empty">
                  No item details available.
                </div>
              `
        }

      </div>

      <div class="ao-tracking-total">

        <span>
          Order total
        </span>

        <strong>
          ${formatMoney(order.totalAmount)}
        </strong>

      </div>

      <div class="ao-refresh-row">

        <button
          type="button"
          class="ao-refresh-button"
          id="aoRefreshTracking"
        >
          Refresh status
        </button>

      </div>

    </div>
  `;

  const refreshButton = $("#aoRefreshTracking");

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      fetchTrackedOrder(orderNumber);
    });
  }
}

/* =========================================================
   SUCCESS / TRACKING EVENTS
========================================================= */

function initializeSuccessModal() {
  const closeButton = $("#aoSuccessClose");

  const doneButton = $("#aoDoneFromSuccess");

  const trackButton = $("#aoTrackFromSuccess");

  const modal = $("#aoOrderSuccessModal");

  if (closeButton) {
    closeButton.addEventListener("click", closeOrderSuccess);
  }

  if (doneButton) {
    doneButton.addEventListener("click", closeOrderSuccess);
  }

  if (trackButton) {
    trackButton.addEventListener("click", () => {
      const orderNumber =
        modal?.dataset.orderNumber ||
        localStorage.getItem("aoLatestOrderNumber") ||
        "";

      closeOrderSuccess();

      openTrackingModal(orderNumber);
    });
  }

  $$("[data-success-close]").forEach((element) => {
    element.addEventListener("click", closeOrderSuccess);
  });
}

function initializeTrackingModal() {
  const form = $("#aoTrackingForm");

  const closeButton = $("#aoTrackingClose");

  if (form) {
    form.addEventListener("submit", handleTrackingSubmit);
  }

  if (closeButton) {
    closeButton.addEventListener("click", closeTrackingModal);
  }

  $$("[data-tracking-close]").forEach((element) => {
    element.addEventListener("click", closeTrackingModal);
  });
}

/* =========================================================
   TRACK ORDER BUTTON
========================================================= */

function createTrackOrderButton() {
  const existingButton = $("#trackOrderBtn");

  if (existingButton) {
    existingButton.addEventListener("click", () => {
      openTrackingModal();
    });
  }

  if (document.querySelector(".ao-floating-track-button")) {
    return;
  }

  const button = document.createElement("button");

  button.type = "button";

  button.className = "ao-floating-track-button";

  button.innerHTML = `
    <span
      class="ao-floating-track-icon"
      aria-hidden="true"
    >
      ↗
    </span>

    <span>
      Track Order
    </span>
  `;

  button.addEventListener("click", () => {
    openTrackingModal();
  });

  document.body.appendChild(button);
}

/* =========================================================
   CART BUTTON
========================================================= */

function initializeCart() {
  const cartButton = $("#cartBtn");

  const drawerClose = $("#drawerClose");

  const backdrop = $("#backdrop");

  if (cartButton) {
    cartButton.addEventListener("click", () => {
      openDrawer();
    });
  }

  if (drawerClose) {
    drawerClose.addEventListener("click", closeDrawer);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeDrawer);
  }
}

/* =========================================================
   FORM EVENTS
========================================================= */

function initializeForm() {
  const form = $("#orderForm");

  if (form) {
    form.addEventListener("submit", submitOrder);
  }

  initializeOrderMethodOptions();

  $$(".field input, .field textarea, .field select").forEach((field) => {
    field.addEventListener("input", () => {
      field.classList.remove("field-error");
    });

    field.addEventListener("change", () => {
      field.classList.remove("field-error");
    });
  });
}

/* =========================================================
   SMALL NOTICE
========================================================= */

function showSmallNotice(message) {
  let notice = document.querySelector(".ao-small-notice");

  if (!notice) {
    notice = document.createElement("div");

    notice.className = "ao-small-notice";

    Object.assign(notice.style, {
      position: "fixed",

      left: "50%",

      bottom: "25px",

      zIndex: "5000",

      transform: "translate(-50%, 20px)",

      opacity: "0",

      padding: "12px 18px",

      borderRadius: "999px",

      background: "#122b52",

      color: "#ffffff",

      fontSize: "13px",

      fontWeight: "700",

      boxShadow: "0 15px 35px rgba(10, 35, 65, 0.22)",

      transition: "opacity 180ms ease, transform 180ms ease",

      maxWidth: "calc(100% - 30px)",

      textAlign: "center",
    });

    document.body.appendChild(notice);
  }

  notice.textContent = message;

  clearTimeout(notice._hideTimer);

  requestAnimationFrame(() => {
    notice.style.opacity = "1";

    notice.style.transform = "translate(-50%, 0)";
  });

  notice._hideTimer = setTimeout(() => {
    notice.style.opacity = "0";

    notice.style.transform = "translate(-50%, 20px)";
  }, 2800);
}

/* =========================================================
   RIPPLE EFFECT
========================================================= */

function initializeRippleButtons() {
  $$(".product-add-btn, .btn, .order-btn").forEach((button) => {
    if (button.dataset.rippleInitialized) {
      return;
    }

    button.dataset.rippleInitialized = "true";

    button.addEventListener("click", (event) => {
      const rect = button.getBoundingClientRect();

      const ripple = document.createElement("span");

      ripple.className = "ripple";

      ripple.style.left = `${event.clientX - rect.left}px`;

      ripple.style.top = `${event.clientY - rect.top}px`;

      button.style.position = "relative";

      button.style.overflow = "hidden";

      button.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 550);
    });
  });
}

/* =========================================================
   FLY TO CART ANIMATION
========================================================= */

function animateFlyToCart() {
  const cartButton = $("#cartBtn");

  if (!cartButton) {
    return;
  }

  const rect = cartButton.getBoundingClientRect();

  const dot = document.createElement("span");

  dot.className = "fly-to-cart";

  dot.style.left = `${window.innerWidth / 2}px`;

  dot.style.top = `${window.innerHeight / 2}px`;

  document.body.appendChild(dot);

  requestAnimationFrame(() => {
    dot.style.left = `${rect.left + rect.width / 2}px`;

    dot.style.top = `${rect.top + rect.height / 2}px`;

    dot.style.transform = "translate(-50%, -50%) scale(0.5)";

    dot.style.opacity = "0";
  });

  setTimeout(() => {
    dot.remove();
  }, 700);
}

/* =========================================================
   REVEAL ANIMATIONS
========================================================= */

function initializeRevealAnimations() {
  const elements = [...$$(".reveal"), ...$$(".reveal-side")];

  if (elements.length === 0) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => {
      element.classList.add("visible");
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("visible");

        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
    },
  );

  elements.forEach((element) => {
    observer.observe(element);
  });
}

/* =========================================================
   STATS ANIMATION
========================================================= */

function initializeStats() {
  const stats = $$(".stat-num");

  if (stats.length === 0) {
    return;
  }

  stats.forEach((stat) => {
    const text = stat.textContent.trim();

    if (!/^\d+$/.test(text)) {
      return;
    }

    const target = Number(text);

    stat.textContent = "0";

    let current = 0;

    const duration = 900;

    const start = performance.now();

    function update(time) {
      const progress = Math.min((time - start) / duration, 1);

      current = Math.round(target * (1 - Math.pow(1 - progress, 3)));

      stat.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (entries[0].isIntersecting) {
          requestAnimationFrame(update);

          obs.disconnect();
        }
      },
      {
        threshold: 0.5,
      },
    );

    observer.observe(stat);
  });
}

/* =========================================================
   STEPS
========================================================= */

function initializeSteps() {
  const stepsGrid = $("#stepsGrid");

  const stepLine = $("#stepLine");

  if (!stepsGrid || !stepLine) {
    return;
  }

  function updateStepLine() {
    if (window.innerWidth <= 760) {
      stepLine.style.width = "0";

      return;
    }

    stepLine.style.left = "8%";

    stepLine.style.right = "8%";
  }

  updateStepLine();

  window.addEventListener("resize", updateStepLine);
}

/* =========================================================
   KEYBOARD EVENTS
========================================================= */

function initializeKeyboardEvents() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if ($("#aoTrackingModal")?.classList.contains("show")) {
      closeTrackingModal();

      return;
    }

    if ($("#aoOrderSuccessModal")?.classList.contains("show")) {
      closeOrderSuccess();

      return;
    }

    if ($("#drawer")?.classList.contains("open")) {
      closeDrawer();
    }
  });
}

/* =========================================================
   INITIALIZE
========================================================= */

async function initialize() {
  await loadProducts();

  renderCart();

  updateCartBadge();

  updateMomoAmount(); // keeps the Paystack amount display in sync

  updateAddressVisibility();

  initializeCart();

  initializeForm();

  initializeLocation();

  initializeSuccessModal();

  initializeTrackingModal();

  createTrackOrderButton();

  initializeRevealAnimations();

  initializeStats();

  initializeSteps();

  initializeKeyboardEvents();

  initializeRippleButtons();
}

/* =========================================================
   START
========================================================= */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
