const API_URL = "https://a-and-o-beverages.onrender.com";

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");

const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

const ordersContainer = document.getElementById("ordersContainer");
const activeOrdersContainer = document.getElementById("activeOrdersContainer");
const completedOrdersContainer = document.getElementById(
  "completedOrdersContainer",
);
const emptyOrders = document.getElementById("emptyOrders");

const totalOrders = document.getElementById("totalOrders");
const pendingPayments = document.getElementById("pendingPayments");
const verifiedPayments = document.getElementById("verifiedPayments");
const activeOrders = document.getElementById("activeOrders");
const ordersSection = document.getElementById("ordersSection");
const ordersIntro = document.getElementById("ordersIntro");
const ordersSummary = document.getElementById("ordersSummary");
const productsSection = document.getElementById("productsSection");
const productsContainer = document.getElementById("productsContainer");
const addProductBtn = document.getElementById("addProductBtn");
const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");
const productFormError = document.getElementById("productFormError");
const productFields = document.getElementById("productFields");
let adminProducts = [];
let editingProductId = null;

/* =========================
   LOGIN
========================= */

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginError.hidden = true;

  const username = document.getElementById("username").value.trim();

  const password = document.getElementById("password").value;

  try {
    const response = await fetch(`${API_URL}/api/admin/login`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed.");
    }

    localStorage.setItem("aoAdminToken", data.token);

    showDashboard();
  } catch (error) {
    loginError.textContent = error.message || "Login failed.";

    loginError.hidden = false;
  }
});

/* =========================
   SHOW DASHBOARD
========================= */

function showDashboard() {
  loginScreen.hidden = true;
  dashboardScreen.hidden = false;

  loadOrders();
  loadProducts();
}

/* =========================
   LOAD ORDERS
========================= */

async function loadOrders() {
  const token = localStorage.getItem("aoAdminToken");

  if (!token) {
    showLogin();
    return;
  }

  try {
    refreshBtn.disabled = true;

    const response = await fetch(`${API_URL}/api/admin/orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      logout();
      return;
    }

    if (!response.ok) {
      throw new Error("Could not load orders.");
    }

    const orders = await response.json();

    renderOrders(Array.isArray(orders) ? orders : []);
  } catch (error) {
    console.error("Could not load orders:", error);

    updateSummary([]);

    emptyOrders.hidden = true;

    ordersContainer.innerHTML = `
      <div class="empty-orders">
        <div class="empty-icon">⚠️</div>

        <h3>Could not load orders</h3>

        <p>
          Make sure the A and O backend is running.
        </p>
      </div>
    `;
  } finally {
    refreshBtn.disabled = false;
  }
}

/* =========================
   RENDER ORDERS
========================= */

function renderOrders(orders) {
  updateSummary(orders);

  // Clear both lists
  activeOrdersContainer.innerHTML = "";
  completedOrdersContainer.innerHTML = "";

  if (!orders.length) {
    emptyOrders.hidden = false;
    return;
  }

  emptyOrders.hidden = true;

  // Active orders: not Completed or Cancelled — FIFO (oldest first)
  const active = orders
    .filter((o) => !["Completed", "Cancelled"].includes(o.order_status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Completed orders: only Completed — LIFO (newest first)
  const completed = orders
    .filter((o) => o.order_status === "Completed")
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at) -
        new Date(a.updated_at || a.created_at),
    );

  active.forEach((order) =>
    activeOrdersContainer.appendChild(createOrderCard(order)),
  );
  completed.forEach((order) =>
    completedOrdersContainer.appendChild(createOrderCard(order)),
  );
}

/* =========================
   SUMMARY
========================= */

function updateSummary(orders) {
  const pending = orders.filter(
    (order) => order.payment_status === "Pending",
  ).length;

  const verified = orders.filter(
    (order) => order.payment_status === "Verified",
  ).length;

  const active = orders.filter(
    (order) => !["Completed", "Cancelled"].includes(order.order_status),
  ).length;

  totalOrders.textContent = orders.length;
  pendingPayments.textContent = pending;
  verifiedPayments.textContent = verified;
  activeOrders.textContent = active;
}

/* =========================
   ORDER CARD
========================= */

function createOrderCard(order) {
  const card = document.createElement("article");

  card.className = "order-card";

  const items = Array.isArray(order.items) ? order.items : [];

  const itemsHtml = items
    .map((item) => {
      const description = item.description
        ? ` — ${escapeHtml(item.description)}`
        : "";

      const lineTotal = Number(item.unit_price) * Number(item.quantity);

      return `
        <div class="order-item">
          <div class="order-item-name">
            ${escapeHtml(item.product_name)}
            ${description}
            × ${item.quantity}
          </div>

          <div class="order-item-price">
            GHS ${lineTotal.toFixed(2)}
          </div>
        </div>
      `;
    })
    .join("");

  const date = new Date(order.created_at);

  const formattedDate = date.toLocaleString();

  card.innerHTML = `
    <div class="order-top">

      <div>
        <h3 class="order-number">
          ${escapeHtml(order.order_number)}
        </h3>

        <div class="order-date">
          ${escapeHtml(formattedDate)}
        </div>
      </div>

      <div class="order-total">
        <span>Total</span>

        <strong>
          GHS ${Number(order.total_amount).toFixed(2)}
        </strong>
      </div>

    </div>


    <div class="order-details">

      <div class="detail-box">
        <span class="detail-label">
          Customer
        </span>

        <span class="detail-value">
          ${escapeHtml(order.customer_name)}
        </span>
      </div>


      <div class="detail-box">
        <span class="detail-label">
          Phone
        </span>

        <span class="detail-value">
          ${escapeHtml(order.customer_phone)}
        </span>
      </div>


      <div class="detail-box">
        <span class="detail-label">
          Order type
        </span>

        <span class="detail-value">
          ${escapeHtml(order.order_method)}
        </span>
      </div>


      <div class="detail-box">
        <span class="detail-label">
          Order number
        </span>

        <span class="detail-value">
          ${escapeHtml(order.order_number)}
        </span>
      </div>


      ${
        order.order_method === "Delivery"
          ? `
            <div class="detail-box">

              <span class="detail-label">
                Delivery address
              </span>

              <span class="detail-value">
                ${escapeHtml(order.delivery_address || "Location pin provided")}
              </span>

            </div>

            ${
              order.location_link
                ? `
                  <div class="detail-box">

                    <span class="detail-label">
                      Location
                    </span>

                    <span class="detail-value">

                      <a
                        href="${escapeHtml(order.location_link)}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open map location
                      </a>

                    </span>

                  </div>
                `
                : ""
            }
          `
          : ""
      }

    </div>


    <div class="order-items">

      <h3>Items</h3>

      ${
        itemsHtml ||
        `
          <div class="order-item">
            <div class="order-item-name">
              No items found.
            </div>
          </div>
        `
      }

    </div>


    <div class="order-actions">

      <div class="status-group">

        <label for="payment-${order.id}">
          Payment status
        </label>

        <select
          id="payment-${order.id}"
          class="payment-select"
          data-id="${escapeHtml(order.id)}"
        >

          <option
            value="Pending"
            ${order.payment_status === "Pending" ? "selected" : ""}
          >
            Pending
          </option>

          <option
            value="Verified"
            ${order.payment_status === "Verified" ? "selected" : ""}
          >
            Verified
          </option>

          <option
            value="Rejected"
            ${order.payment_status === "Rejected" ? "selected" : ""}
          >
            Rejected
          </option>

        </select>

      </div>


      <div class="status-group">

        <label for="status-${order.id}">
          Order status
        </label>

        <select
          id="status-${order.id}"
          class="order-status-select"
          data-id="${escapeHtml(order.id)}"
        >

          <option
            value="Pending"
            ${order.order_status === "Pending" ? "selected" : ""}
          >
            Pending
          </option>

          <option
            value="Processing"
            ${order.order_status === "Processing" ? "selected" : ""}
          >
            Processing
          </option>

          <option
            value="Ready"
            ${order.order_status === "Ready" ? "selected" : ""}
          >
            Ready
          </option>

          <option
            value="Completed"
            ${order.order_status === "Completed" ? "selected" : ""}
          >
            Completed
          </option>

          <option
            value="Cancelled"
            ${order.order_status === "Cancelled" ? "selected" : ""}
          >
            Cancelled
          </option>

        </select>

      </div>

    </div>


    <div class="order-save-area">

      <span class="save-message" hidden></span>

      <button
        type="button"
        class="save-order-btn"
        data-id="${escapeHtml(order.id)}"
      >
        <span class="save-icon">✓</span>
        Save changes
      </button>

    </div>
  `;

  /* =========================
     SAVE BUTTON
  ========================= */

  const saveButton = card.querySelector(".save-order-btn");

  saveButton.addEventListener("click", async () => {
    const paymentSelect = card.querySelector(".payment-select");

    const orderStatusSelect = card.querySelector(".order-status-select");

    const saveMessage = card.querySelector(".save-message");

    await saveOrderChanges({
      orderId: order.id,

      paymentStatus: paymentSelect.value,

      orderStatus: orderStatusSelect.value,

      button: saveButton,

      messageElement: saveMessage,
    });
  });

  return card;
}

/* =========================
   SAVE BOTH STATUS CHANGES
========================= */

async function saveOrderChanges({
  orderId,
  paymentStatus,
  orderStatus,
  button,
  messageElement,
}) {
  const token = localStorage.getItem("aoAdminToken");

  if (!token) {
    showLogin();
    return;
  }

  const originalText = button.innerHTML;

  try {
    button.disabled = true;

    button.innerHTML = `
      <span class="save-spinner"></span>
      Saving...
    `;

    messageElement.hidden = true;

    /* =========================
       UPDATE PAYMENT
    ========================= */

    const paymentResponse = await fetch(
      `${API_URL}/api/admin/orders/${orderId}/payment`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          paymentStatus,
        }),
      },
    );

    if (paymentResponse.status === 401) {
      logout();
      return;
    }

    if (!paymentResponse.ok) {
      let message = "Could not update payment status.";

      try {
        const data = await paymentResponse.json();

        message = data.message || message;
      } catch {
        // Keep default message.
      }

      throw new Error(message);
    }

    /* =========================
       UPDATE ORDER STATUS
    ========================= */

    const orderResponse = await fetch(
      `${API_URL}/api/admin/orders/${orderId}/status`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          orderStatus,
        }),
      },
    );

    if (orderResponse.status === 401) {
      logout();
      return;
    }

    if (!orderResponse.ok) {
      let message = "Could not update order status.";

      try {
        const data = await orderResponse.json();

        message = data.message || message;
      } catch {
        // Keep default message.
      }

      throw new Error(message);
    }

    /* =========================
       SUCCESS
    ========================= */

    button.innerHTML = `
      <span class="save-icon">✓</span>
      Saved
    `;

    messageElement.textContent = "Changes saved successfully.";

    messageElement.className = "save-message success";

    messageElement.hidden = false;

    /*
      Reload the orders after a short delay.
      This confirms the data is coming back
      from the backend with the saved values.
    */

    setTimeout(async () => {
      await loadOrders();
    }, 700);
  } catch (error) {
    console.error("Could not save order:", error);

    button.innerHTML = originalText;

    messageElement.textContent = error.message || "Could not save changes.";

    messageElement.className = "save-message error";

    messageElement.hidden = false;

    button.disabled = false;
  }
}

/* =========================
   PRODUCTS
========================= */

async function loadProducts() {
  const token = localStorage.getItem("aoAdminToken");
  if (!token) return;
  try {
    const response = await fetch(`${API_URL}/api/admin/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) return logout();
    if (!response.ok) throw new Error("Could not load products.");
    renderProducts(await response.json());
  } catch (error) {
    console.error("Could not load products:", error);
    productsContainer.innerHTML = `<div class="empty-orders"><h3>Could not load products</h3><p>Please check that the database setup has been run.</p></div>`;
  }
}

function renderProducts(products) {
  adminProducts = Array.isArray(products) ? products : [];
  if (!products.length) {
    productsContainer.innerHTML = `<div class="empty-orders"><h3>No products yet</h3><p>Add your first product to make it available to customers.</p></div>`;
    return;
  }
  // Render each product with visible price and meta; keep layout compact
  productsContainer.innerHTML = adminProducts
    .map((product) => {
      // Determine a starting price to display
      let startingPrice = 0;
      if (product.type === "brukina-custom")
        startingPrice = Number(product.price || 0);
      else if (product.type === "flavor-size")
        startingPrice = Math.min(...Object.values(product.sizes || { 0: 0 }));
      else if (product.type === "parfait-custom")
        startingPrice = Number(product.price || 0);
      else if (product.type === "size-sweetness")
        startingPrice = Math.min(
          ...Object.values(product.prices || {}).flatMap((s) =>
            Object.values(s),
          ),
        );

      const shortDesc = product.description
        ? product.description.length > 80
          ? product.description.slice(0, 77) + "..."
          : product.description
        : "";

      const fallbackImg =
        "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=85";
      return `
      <article class="product-card">
        <!-- Image -->
        <div class="admin-product-image-wrap">
          <img
            src="${escapeHtml(product.image || fallbackImg)}"
            alt="${escapeHtml(product.name)}"
            onerror="this.src='${fallbackImg}'"
          />
          <div class="product-image-status">
            <span class="status-pill status-${escapeHtml(product.status)}">${escapeHtml(product.status.replaceAll("_", " "))}</span>
          </div>
        </div>

        <!-- Body -->
        <div class="product-card-body">
          <div class="product-card-title-row">
            <h3 class="product-card-name">${escapeHtml(product.name)}</h3>
            ${startingPrice ? `<span class="product-card-price">GHS ${Number(startingPrice).toFixed(2)}</span>` : ""}
          </div>

          <div class="product-card-meta">
            <span class="product-type">${escapeHtml((product.category || "").replaceAll("-", " "))}</span>
            <span class="product-meta">· ${escapeHtml(product.type.replaceAll("-", " "))}</span>
          </div>

          ${product.description ? `<p class="product-card-desc">${escapeHtml(product.description)}</p>` : ""}
        </div>

        <!-- Footer: availability + actions -->
        <div class="product-card-footer">
          <div class="availability-actions">
            <button type="button" class="availability-btn ${product.status === "available" ? "selected" : ""}" data-id="${escapeHtml(product.id)}" data-status="available">In stock</button>
            <button type="button" class="availability-btn ${product.status === "out_of_stock" ? "selected" : ""}" data-id="${escapeHtml(product.id)}" data-status="out_of_stock">Out of stock</button>
            <button type="button" class="availability-btn ${product.status === "unavailable" ? "selected" : ""}" data-id="${escapeHtml(product.id)}" data-status="unavailable">Hide</button>
          </div>
          <div class="product-card-actions">
            <button type="button" class="edit-product-btn" data-id="${escapeHtml(product.id)}">✏ Edit</button>
            <button type="button" class="delete-product-btn" data-id="${escapeHtml(product.id)}" data-name="${escapeHtml(product.name)}">✕ Delete</button>
          </div>
        </div>
      </article>`;
    })
    .join("");

  // Wire up buttons
  document.querySelectorAll(".availability-btn").forEach((button) =>
    button.addEventListener("click", async () => {
      await updateProduct(button.dataset.id, { status: button.dataset.status });
      loadProducts();
    }),
  );
  document
    .querySelectorAll(".edit-product-btn")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openProductModal(
          adminProducts.find((product) => product.id === button.dataset.id),
        ),
      ),
    );
  document
    .querySelectorAll(".delete-product-btn")
    .forEach((button) =>
      button.addEventListener("click", () =>
        deleteProduct(button.dataset.id, button.dataset.name),
      ),
    );
}

async function updateProduct(id, changes) {
  const response = await fetch(
    `${API_URL}/api/admin/products/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("aoAdminToken")}`,
      },
      body: JSON.stringify(changes),
    },
  );
  if (!response.ok) {
    showSmallError("Could not update product status.");
    await loadProducts();
  }
}

async function deleteProduct(id, name) {
  if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
  const response = await fetch(
    `${API_URL}/api/admin/products/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("aoAdminToken")}`,
      },
    },
  );
  if (!response.ok) return showSmallError("Could not delete product.");
  loadProducts();
}

function optionRows(entries = {}, group, includePrice = false) {
  return Object.entries(entries)
    .map(
      ([id, value]) =>
        `<div class="option-row" data-option-group="${group}"><input data-option-id value="${escapeHtml(id)}" placeholder="ID" /><input data-option-label value="${escapeHtml(includePrice ? id : value)}" placeholder="${includePrice ? "Size" : "Name"}" />${includePrice ? `<input data-option-price type="number" min="0" step="0.01" value="${escapeHtml(value)}" placeholder="Price" />` : ""}<button type="button" class="remove-option-btn">Remove</button></div>`,
    )
    .join("");
}

function renderProductFields(type, config = {}) {
  if (type === "brukina-custom") {
    productFields.innerHTML = `<h3>Brukina details</h3><label>Price (GHS)<input id="basePrice" type="number" min="0" step="0.01" value="${escapeHtml(config.price ?? 20)}" required /></label><div class="options-editor"><div class="options-heading"><strong>Toppings</strong><button type="button" class="add-option-btn" data-group="brukina-toppings">Add topping</button></div><div id="brukina-toppings">${optionRows(config.toppings || { coconut_flakes: "Coconut Flakes" }, "brukina-toppings")}</div></div>`;
  } else if (type === "flavor-size") {
    productFields.innerHTML = `<h3>Yoghurt details</h3><div class="options-editor"><div class="options-heading"><strong>Flavors</strong><button type="button" class="add-option-btn" data-group="flavors">Add flavor</button></div><div id="flavors">${optionRows(config.flavors || { plain: "Plain" }, "flavors")}</div></div><div class="options-editor"><div class="options-heading"><strong>Sizes and prices</strong><button type="button" class="add-option-btn" data-group="sizes">Add size</button></div><div id="sizes">${optionRows(config.sizes || { "500ml": 25 }, "sizes", true)}</div></div>`;
  } else if (type === "parfait-custom") {
    productFields.innerHTML = `<h3>Parfait details</h3><label>Base price (GHS)<input id="basePrice" type="number" min="0" step="0.01" value="${escapeHtml(config.price ?? 40)}" required /></label>${["fruits", "toppings", "syrups"].map((group) => `<div class="options-editor"><div class="options-heading"><strong>${group[0].toUpperCase() + group.slice(1)}</strong><button type="button" class="add-option-btn" data-group="${group}">Add ${group.slice(0, -1)}</button></div><div id="${group}">${optionRows(config[group] || (group === "syrups" ? { none: "No Syrup" } : {}), group)}</div></div>`).join("")}`;
  } else {
    const prices = config.prices || {
      "500ml": { sweetened: 50, unsweetened: 45 },
    };
    productFields.innerHTML = `<h3>Size and sweetness prices</h3><div class="options-editor"><div class="options-heading"><strong>Sizes</strong><button type="button" class="add-option-btn" data-group="sweetness-prices">Add size</button></div><div id="sweetness-prices">${Object.entries(
      prices,
    )
      .map(
        ([size, values]) =>
          `<div class="option-row sweetness-row"><input data-size value="${escapeHtml(size)}" placeholder="Size" /><input data-sweetened type="number" min="0" step="0.01" value="${escapeHtml(values.sweetened ?? "")}" placeholder="Sweetened price" /><input data-unsweetened type="number" min="0" step="0.01" value="${escapeHtml(values.unsweetened ?? "")}" placeholder="Unsweetened price" /><button type="button" class="remove-option-btn">Remove</button></div>`,
      )
      .join("")}</div></div>`;
  }
  productFields
    .querySelectorAll(".add-option-btn")
    .forEach((button) =>
      button.addEventListener("click", () =>
        addOptionRow(button.dataset.group),
      ),
    );
  productFields
    .querySelectorAll(".remove-option-btn")
    .forEach((button) =>
      button.addEventListener("click", () =>
        button.closest(".option-row").remove(),
      ),
    );
}

function addOptionRow(group) {
  const container = document.getElementById(group);
  if (!container) return;
  if (group === "sizes")
    container.insertAdjacentHTML(
      "beforeend",
      optionRows({ "": "" }, group, true),
    );
  else if (group === "sweetness-prices")
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="option-row sweetness-row"><input data-size placeholder="Size" /><input data-sweetened type="number" min="0" step="0.01" placeholder="Sweetened price" /><input data-unsweetened type="number" min="0" step="0.01" placeholder="Unsweetened price" /><button type="button" class="remove-option-btn">Remove</button></div>`,
    );
  else container.insertAdjacentHTML("beforeend", optionRows({ "": "" }, group));
  container.lastElementChild
    .querySelector(".remove-option-btn")
    .addEventListener("click", (event) =>
      event.currentTarget.closest(".option-row").remove(),
    );
}

function collectOptions(group, hasPrice = false) {
  return [
    ...document.querySelectorAll(`[data-option-group="${group}"]`),
  ].reduce((options, row) => {
    const id = row.querySelector("[data-option-id]").value.trim();
    const value = row.querySelector(
      hasPrice ? "[data-option-price]" : "[data-option-label]",
    ).value;
    if (id && value !== "")
      options[id] = hasPrice ? Number(value) : value.trim();
    return options;
  }, {});
}

function collectConfig(type) {
  if (type === "brukina-custom")
    return {
      price: Number(document.getElementById("basePrice").value),
      toppings: collectOptions("brukina-toppings"),
    };
  if (type === "flavor-size")
    return {
      flavors: collectOptions("flavors"),
      sizes: collectOptions("sizes", true),
    };
  if (type === "parfait-custom")
    return {
      price: Number(document.getElementById("basePrice").value),
      fruits: collectOptions("fruits"),
      toppings: collectOptions("toppings"),
      syrups: collectOptions("syrups"),
    };
  return {
    prices: [...document.querySelectorAll(".sweetness-row")].reduce(
      (prices, row) => {
        const size = row.querySelector("[data-size]").value.trim();
        const sweetened = row.querySelector("[data-sweetened]").value;
        const unsweetened = row.querySelector("[data-unsweetened]").value;
        if (size && sweetened !== "" && unsweetened !== "")
          prices[size] = {
            sweetened: Number(sweetened),
            unsweetened: Number(unsweetened),
          };
        return prices;
      },
      {},
    ),
  };
}

function setTapPicker(id, value, disabled = false) {
  const input = document.getElementById(id);
  input.value = value;
  document
    .querySelectorAll(`[data-picker="${id}"] button`)
    .forEach((button) => {
      button.classList.toggle("selected", button.dataset.value === value);
      button.disabled = disabled;
    });
}

function updateImagePreview(url) {
  const preview = document.getElementById("productImagePreview");
  preview.src =
    url ||
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=85";
  preview.onerror = () => {
    preview.src =
      "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=85";
  };
}

function openProductModal(product = null) {
  productForm.reset();
  editingProductId = product?.id || null;
  document.getElementById("productModalTitle").textContent = product
    ? `Edit ${product.name}`
    : "Add product";
  document.getElementById("productId").value = product?.id || "";
  document.getElementById("productId").disabled = Boolean(product);
  document.getElementById("productName").value = product?.name || "";
  document.getElementById("productCategory").value =
    product?.category || "Fresh Beverage";
  setTapPicker(
    "productType",
    product?.type || "brukina-custom",
    Boolean(product),
  );
  setTapPicker("productStatus", product?.status || "available");
  document.getElementById("productSortOrder").value = product?.sortOrder || 0;
  document.getElementById("productImageUrl").value = product?.image || "";
  updateImagePreview(product?.image || "");
  document.getElementById("productDescription").value =
    product?.description || "";
  renderProductFields(product?.type || "brukina-custom", product || {});
  productFormError.hidden = true;
  productModal.hidden = false;
}

function closeProductModal() {
  productModal.hidden = true;
}
function showSmallError(message) {
  window.alert(message);
}

document.querySelectorAll(".dashboard-tab").forEach((button) =>
  button.addEventListener("click", () => {
    const productsActive = button.dataset.tab === "products";
    document
      .querySelectorAll(".dashboard-tab")
      .forEach((tab) => tab.classList.toggle("active", tab === button));
    ordersSection.hidden = productsActive;
    ordersIntro.hidden = productsActive;
    ordersSummary.hidden = productsActive;
    productsSection.hidden = !productsActive;
    if (productsActive) loadProducts();
  }),
);

addProductBtn.addEventListener("click", openProductModal);
document
  .querySelectorAll("[data-close-product-modal]")
  .forEach((button) => button.addEventListener("click", closeProductModal));
document.querySelectorAll(".tap-options button").forEach((button) =>
  button.addEventListener("click", () => {
    const inputId = button.closest(".tap-options").dataset.picker;
    if (inputId === "productType" && editingProductId) return;
    setTapPicker(inputId, button.dataset.value);
    if (inputId === "productType") renderProductFields(button.dataset.value);
  }),
);
document
  .getElementById("productImageUrl")
  .addEventListener("input", (event) =>
    updateImagePreview(event.target.value.trim()),
  );
productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  productFormError.hidden = true;
  const type = document.getElementById("productType").value;
  const payload = {
    id: document.getElementById("productId").value.trim(),
    name: document.getElementById("productName").value.trim(),
    category: document.getElementById("productCategory").value.trim(),
    type,
    status: document.getElementById("productStatus").value,
    sortOrder: Number(document.getElementById("productSortOrder").value),
    image: document.getElementById("productImageUrl").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    config: collectConfig(type),
  };
  try {
    const url = editingProductId
      ? `${API_URL}/api/admin/products/${encodeURIComponent(editingProductId)}`
      : `${API_URL}/api/admin/products`;
    if (editingProductId) delete payload.id;
    const response = await fetch(url, {
      method: editingProductId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("aoAdminToken")}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    closeProductModal();
    loadProducts();
  } catch (error) {
    productFormError.textContent = error.message || "Could not save product.";
    productFormError.hidden = false;
  }
});

/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener("click", logout);

function logout() {
  localStorage.removeItem("aoAdminToken");

  showLogin();
}

/* =========================
   SHOW LOGIN
========================= */

function showLogin() {
  dashboardScreen.hidden = true;

  loginScreen.hidden = false;

  loginForm.reset();

  loginError.hidden = true;
}

/* =========================
   REFRESH
========================= */

refreshBtn.addEventListener("click", loadOrders);

/* =========================
   HTML ESCAPING
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   INITIAL CHECK
========================= */

const existingToken = localStorage.getItem("aoAdminToken");

if (existingToken) {
  showDashboard();
} else {
  showLogin();
}
