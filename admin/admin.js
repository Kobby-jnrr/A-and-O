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
const activeOrdersSection = document.getElementById("activeOrdersSection");
const completedOrdersSection = document.getElementById(
  "completedOrdersSection",
);
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

  const submitBtn = loginForm.querySelector("button[type=submit]");
  const originalHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="login-btn-spinner"></span><span>Logging in…</span>`;

  try {
    const response = await fetch(`${API_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
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
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
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
    console.error("Could not load orders");

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
    console.error("Could not save order");

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
    console.error("Could not load products");
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
        `<div class="option-row" data-option-group="${group}"><input data-option-id type="hidden" value="${escapeHtml(id)}" /><input data-option-label value="${escapeHtml(includePrice ? id : value)}" placeholder="${includePrice ? "Size" : "Name"}" />${includePrice ? `<input data-option-price type="number" min="0" step="0.01" value="${escapeHtml(value)}" placeholder="Price" />` : ""}<select data-option-status aria-label="${escapeHtml(value)} stock status"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select><button type="button" class="remove-option-btn">Remove</button></div>`,
    )
    .join("");
}

function applyOptionStockStatuses(config = {}) {
  productFields.querySelectorAll(".option-row").forEach((row) => {
    const group = row.dataset.optionGroup;
    const id = row.querySelector("[data-option-id], [data-size]")?.value;
    const select = row.querySelector("[data-option-status]");
    if (select) select.value = config.stock?.[group]?.[id] || "available";
  });
}

function renderProductFields(type, config = {}) {
  if (type === "brukina-custom") {
    productFields.innerHTML = `<h3>Brukina details</h3><label>Price (GHS)<input id="basePrice" type="number" min="0" step="0.01" value="${escapeHtml(config.price ?? 20)}" required /></label><div class="options-editor"><div class="options-heading"><strong>Options</strong><button type="button" class="add-option-btn" data-group="brukina-options">Add option</button></div><div id="brukina-options">${optionRows(config.options || { millet: "Millet", millet_coconut_flakes: "Millet and Coconut Flakes" }, "options")}</div></div>`;
  } else if (type === "flavor-size") {
    renderYoghurtFields(config);
  } else if (type === "parfait-custom") {
    productFields.innerHTML = `<h3>Parfait details</h3><label>Base price (GHS)<input id="basePrice" type="number" min="0" step="0.01" value="${escapeHtml(config.price ?? 40)}" required /></label>${["fruits", "toppings", "syrups"].map((group) => `<div class="options-editor"><div class="options-heading"><strong>${group[0].toUpperCase() + group.slice(1)}</strong><button type="button" class="add-option-btn" data-group="${group}">Add ${group.slice(0, -1)}</button></div><div id="${group}">${optionRows(config[group] || (group === "syrups" ? { none: "No Syrup" } : {}), group)}</div></div>`).join("")}`;
  } else if (type === "size-sweetness") {
    renderGreekFields(config);
  } else {
    productFields.innerHTML = "";
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
  applyOptionStockStatuses(config);
}

function renderGreekFields(config = {}) {
  const legacyPrices = config.prices || {
    "500ml": { sweetened: 50, unsweetened: 45 },
  };
  const sizes = Object.keys(config.sizes || legacyPrices);
  const sweetnessPrices =
    config.sweetnessPrices ||
    Object.fromEntries(
      ["sweetened", "unsweetened"].map((sweetness) => [
        sweetness,
        Object.fromEntries(
          sizes.map((size) => [size, legacyPrices[size]?.[sweetness] ?? ""]),
        ),
      ]),
    );
  const header = sizes
    .map((size) => `<th>${escapeHtml(formatOptionLabel(size))}</th>`)
    .join("");
  const rows = Object.entries(sweetnessPrices)
    .map(
      ([sweetness, prices]) =>
        `<tr data-greek-sweetness="${escapeHtml(sweetness)}"><td><input data-sweetness-label value="${escapeHtml(formatOptionLabel(sweetness))}" placeholder="Sweetness name" /></td>${sizes
          .map(
            (size) =>
              `<td><input data-sweetness-price data-size="${escapeHtml(size)}" type="number" min="0" step="0.01" value="${escapeHtml(prices?.[size] ?? "")}" placeholder="Price" /><select data-sweetness-stock data-size="${escapeHtml(size)}" aria-label="${escapeHtml(sweetness)} ${escapeHtml(size)} stock"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select></td>`,
          )
          .join(
            "",
          )}<td><button type="button" class="remove-greek-sweetness-btn">Remove</button></td></tr>`,
    )
    .join("");
  productFields.innerHTML = `<h3>Greek yoghurt details</h3><div class="options-editor greek-matrix-editor"><div class="options-heading"><strong>Sweetness, sizes, prices and stock</strong><div><button type="button" class="add-greek-sweetness-btn">Add sweetness</button><button type="button" class="add-greek-size-btn">Add size</button></div></div><div class="yoghurt-matrix-wrap"><table class="yoghurt-matrix"><thead><tr><th>Sweetness</th>${header}<th></th></tr></thead><tbody id="greek-matrix-body">${rows}</tbody></table></div></div>`;
  productFields.querySelectorAll("#greek-matrix-body tr").forEach((row) => {
    const sweetness = row.dataset.greekSweetness;
    row.querySelectorAll("[data-sweetness-stock]").forEach((select) => {
      select.value =
        config.stock?.sweetnesses?.[sweetness]?.[select.dataset.size] ||
        config.stock?.sizes?.[select.dataset.size] ||
        "available";
    });
  });
  productFields
    .querySelector(".add-greek-sweetness-btn")
    .addEventListener("click", () => addGreekSweetness());
  productFields
    .querySelector(".add-greek-size-btn")
    .addEventListener("click", () => addGreekSize());
  productFields
    .querySelectorAll(".remove-greek-sweetness-btn")
    .forEach((button) =>
      button.addEventListener("click", () => button.closest("tr").remove()),
    );
}

function addGreekSweetness() {
  const body = document.getElementById("greek-matrix-body");
  const sizes = [
    ...body.querySelectorAll("tr:first-child [data-sweetness-price]"),
  ].map((input) => input.dataset.size);
  const sweetnessId = `sweetness_${body.children.length + 1}`;
  const row = document.createElement("tr");
  row.dataset.greekSweetness = sweetnessId;
  row.innerHTML = `<td><input data-sweetness-label value="" placeholder="Sweetness name" /></td>${sizes.map((size) => `<td><input data-sweetness-price data-size="${escapeHtml(size)}" type="number" min="0" step="0.01" placeholder="Price" /><select data-sweetness-stock data-size="${escapeHtml(size)}" aria-label="${escapeHtml(size)} stock"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select></td>`).join("")}<td><button type="button" class="remove-greek-sweetness-btn">Remove</button></td>`;
  body.appendChild(row);
  row
    .querySelector(".remove-greek-sweetness-btn")
    .addEventListener("click", () => row.remove());
}

function addGreekSize() {
  const headerRow = productFields.querySelector(".yoghurt-matrix thead tr");
  const sizeId = window.prompt("Enter the new size, for example 1l:");
  if (!sizeId?.trim()) return;
  const normalizedSize = sizeId.trim();
  const headerCell = document.createElement("th");
  headerCell.textContent = formatOptionLabel(normalizedSize);
  headerRow.insertBefore(headerCell, headerRow.lastElementChild);
  productFields.querySelectorAll("#greek-matrix-body tr").forEach((row) => {
    const cell = document.createElement("td");
    cell.innerHTML = `<input data-sweetness-price data-size="${escapeHtml(normalizedSize)}" type="number" min="0" step="0.01" placeholder="Price" /><select data-sweetness-stock data-size="${escapeHtml(normalizedSize)}" aria-label="${escapeHtml(normalizedSize)} stock"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select>`;
    row.insertBefore(cell, row.lastElementChild);
  });
}

function renderYoghurtFields(config = {}) {
  const sizes = config.sizes || { "500ml": 25 };
  const flavors = config.flavors || { plain: "Plain" };
  const flavorPrices =
    config.flavorPrices ||
    Object.fromEntries(
      Object.keys(flavors).map((flavorId) => [
        flavorId,
        Object.fromEntries(
          Object.entries(sizes).map(([sizeId, price]) => [sizeId, price]),
        ),
      ]),
    );
  const sizeIds = Object.keys(sizes);
  const header = sizeIds
    .map((sizeId) => `<th>${escapeHtml(formatOptionLabel(sizeId))}</th>`)
    .join("");
  const rows = Object.entries(flavors)
    .map(
      ([flavorId, label]) =>
        `<tr data-yogurt-flavor="${escapeHtml(flavorId)}"><td><input data-flavor-label value="${escapeHtml(label)}" placeholder="Flavor name" /></td>${sizeIds
          .map(
            (sizeId) =>
              `<td><input data-flavor-price data-size="${escapeHtml(sizeId)}" type="number" min="0" step="0.01" value="${escapeHtml(flavorPrices[flavorId]?.[sizeId] ?? "")}" placeholder="Price" /><select data-flavor-stock data-size="${escapeHtml(sizeId)}" aria-label="${escapeHtml(label)} ${escapeHtml(sizeId)} stock"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select></td>`,
          )
          .join(
            "",
          )}<td><button type="button" class="remove-yogurt-flavor-btn">Remove</button></td></tr>`,
    )
    .join("");
  productFields.innerHTML = `<h3>Yoghurt details</h3><div class="options-editor yoghurt-matrix-editor"><div class="options-heading"><strong>Flavors, sizes, prices and stock</strong><div><button type="button" class="add-yogurt-flavor-btn">Add flavor</button><button type="button" class="add-yogurt-size-btn">Add size</button></div></div><div class="yoghurt-matrix-wrap"><table class="yoghurt-matrix"><thead><tr><th>Flavor</th>${header}<th></th></tr></thead><tbody id="yoghurt-matrix-body">${rows}</tbody></table></div></div>`;
  productFields.querySelectorAll("#yoghurt-matrix-body tr").forEach((row) => {
    const flavorId = row.dataset.yogurtFlavor;
    row.querySelectorAll("[data-flavor-stock]").forEach((select) => {
      const sizeId = select.dataset.size;
      select.value =
        config.stock?.flavors?.[flavorId]?.[sizeId] ||
        (config.stock?.flavors?.[flavorId] === "out_of_stock" ||
        config.stock?.sizes?.[sizeId] === "out_of_stock"
          ? "out_of_stock"
          : "available");
    });
  });
  productFields
    .querySelector(".add-yogurt-flavor-btn")
    .addEventListener("click", () => addYoghurtFlavor());
  productFields
    .querySelector(".add-yogurt-size-btn")
    .addEventListener("click", () => addYoghurtSize());
  productFields
    .querySelectorAll(".remove-yogurt-flavor-btn")
    .forEach((button) =>
      button.addEventListener("click", () => button.closest("tr").remove()),
    );
}

function addYoghurtFlavor() {
  const body = document.getElementById("yoghurt-matrix-body");
  const sizeIds = [
    ...body.querySelectorAll("tr:first-child [data-flavor-price]"),
  ].map((input) => input.dataset.size);
  const flavorId = `flavor_${body.children.length + 1}`;
  const row = document.createElement("tr");
  row.dataset.yogurtFlavor = flavorId;
  row.innerHTML = `<td><input data-flavor-label value="" placeholder="Flavor name" /></td>${sizeIds.map((sizeId) => `<td><input data-flavor-price data-size="${escapeHtml(sizeId)}" type="number" min="0" step="0.01" placeholder="Price" /><select data-flavor-stock data-size="${escapeHtml(sizeId)}" aria-label="${escapeHtml(sizeId)} stock"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select></td>`).join("")}<td><button type="button" class="remove-yogurt-flavor-btn">Remove</button></td>`;
  body.appendChild(row);
  row
    .querySelector(".remove-yogurt-flavor-btn")
    .addEventListener("click", () => row.remove());
}

function addYoghurtSize() {
  const headerRow = productFields.querySelector(".yoghurt-matrix thead tr");
  const sizeId = window.prompt("Enter the new size, for example 250ml:");
  if (!sizeId?.trim()) return;
  const normalizedSize = sizeId.trim();
  const headerCell = document.createElement("th");
  headerCell.textContent = formatOptionLabel(normalizedSize);
  headerRow.insertBefore(headerCell, headerRow.lastElementChild);
  productFields.querySelectorAll(".yoghurt-matrix tbody tr").forEach((row) => {
    const cell = document.createElement("td");
    cell.innerHTML = `<input data-flavor-price data-size="${escapeHtml(normalizedSize)}" type="number" min="0" step="0.01" placeholder="Price" /><select data-flavor-stock data-size="${escapeHtml(normalizedSize)}" aria-label="${escapeHtml(normalizedSize)} stock"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select>`;
    row.insertBefore(cell, row.lastElementChild);
  });
}

function addOptionRow(group) {
  const container = document.getElementById(group);
  if (!container) return;
  if (group === "sizes")
    container.insertAdjacentHTML(
      "beforeend",
      optionRows({ "": "" }, "sizes", true),
    );
  else if (group === "sweetness-prices")
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="option-row sweetness-row" data-option-group="sizes"><input data-size placeholder="Size" /><input data-sweetened type="number" min="0" step="0.01" placeholder="Sweetened price" /><input data-unsweetened type="number" min="0" step="0.01" placeholder="Unsweetened price" /><select data-option-status aria-label="Size stock status"><option value="available">In stock</option><option value="out_of_stock">Out of stock</option></select><button type="button" class="remove-option-btn">Remove</button></div>`,
    );
  else
    container.insertAdjacentHTML(
      "beforeend",
      optionRows({ "": "" }, group === "brukina-options" ? "options" : group),
    );
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
    const label = row
      .querySelector(hasPrice ? "[data-option-label]" : "[data-option-label]")
      .value.trim();
    const idInput = row.querySelector("[data-option-id]");
    const id = idInput?.value.trim() || optionIdFromLabel(label);
    const value = row.querySelector(
      hasPrice ? "[data-option-price]" : "[data-option-label]",
    ).value;
    if (id && value !== "")
      options[id] = hasPrice ? Number(value) : value.trim();
    return options;
  }, {});
}

function optionIdFromLabel(label) {
  return (
    String(label || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "option"
  );
}

function collectStock(group, id) {
  const row = [
    ...document.querySelectorAll(`[data-option-group="${group}"]`),
  ].find((candidate) => {
    const storedId = candidate.querySelector("[data-option-id]")?.value.trim();
    const label = candidate.querySelector("[data-option-label]")?.value.trim();
    return (storedId || optionIdFromLabel(label)) === id;
  });
  return row?.querySelector("[data-option-status]")?.value || "available";
}

function collectConfigStock(type) {
  const stock = {};
  const addGroup = (group, ids) => {
    stock[group] = {};
    ids.forEach((id) => {
      if (id) stock[group][id] = collectStock(group, id);
    });
  };
  if (type === "brukina-custom")
    addGroup("options", Object.keys(collectOptions("options")));
  if (type === "flavor-size") {
    stock.flavors = {};
    document.querySelectorAll("#yoghurt-matrix-body tr").forEach((row) => {
      const flavorId = row.dataset.yogurtFlavor;
      stock.flavors[flavorId] = {};
      row.querySelectorAll("[data-flavor-stock]").forEach((select) => {
        stock.flavors[flavorId][select.dataset.size] = select.value;
      });
    });
  }
  if (type === "parfait-custom")
    ["fruits", "toppings", "syrups"].forEach((group) =>
      addGroup(group, Object.keys(collectOptions(group))),
    );
  if (type === "size-sweetness") {
    stock.sweetnesses = {};
    document.querySelectorAll("#greek-matrix-body tr").forEach((row) => {
      const sweetness = row.dataset.greekSweetness;
      stock.sweetnesses[sweetness] = {};
      row.querySelectorAll("[data-sweetness-stock]").forEach((select) => {
        stock.sweetnesses[sweetness][select.dataset.size] = select.value;
      });
    });
  }
  return stock;
}

function collectConfig(type) {
  if (type === "brukina-custom")
    return {
      price: Number(document.getElementById("basePrice").value),
      options: collectOptions("options"),
      stock: collectConfigStock(type),
    };
  if (type === "flavor-size") {
    const flavors = {};
    const flavorPrices = {};
    const sizes = {};
    document.querySelectorAll("#yoghurt-matrix-body tr").forEach((row) => {
      const flavorId = row.dataset.yogurtFlavor;
      const label = row.querySelector("[data-flavor-label]").value.trim();
      if (!label) return;
      flavors[flavorId] = label;
      flavorPrices[flavorId] = {};
      row.querySelectorAll("[data-flavor-price]").forEach((input) => {
        if (input.value !== "") {
          flavorPrices[flavorId][input.dataset.size] = Number(input.value);
          sizes[input.dataset.size] = Number(input.value);
        }
      });
    });
    return { flavors, sizes, flavorPrices, stock: collectConfigStock(type) };
  }
  if (type === "parfait-custom")
    return {
      price: Number(document.getElementById("basePrice").value),
      fruits: collectOptions("fruits"),
      toppings: collectOptions("toppings"),
      syrups: collectOptions("syrups"),
      stock: collectConfigStock(type),
    };
  if (type === "size-sweetness") {
    const sweetnessPrices = {};
    const prices = {};
    const sizes = {};
    document.querySelectorAll("#greek-matrix-body tr").forEach((row) => {
      const sweetnessId = row.dataset.greekSweetness;
      const label = row.querySelector("[data-sweetness-label]").value.trim();
      if (!label) return;
      sweetnessPrices[sweetnessId] = {};
      row.querySelectorAll("[data-sweetness-price]").forEach((input) => {
        if (input.value !== "") {
          sweetnessPrices[sweetnessId][input.dataset.size] = Number(
            input.value,
          );
          sizes[input.dataset.size] = Number(input.value);
        }
      });
      prices[sweetnessId] = sweetnessPrices[sweetnessId];
    });
    return { prices, sizes, sweetnessPrices, stock: collectConfigStock(type) };
  }
  return {
    stock: collectConfigStock(type),
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
  document.getElementById("productName").value = product?.name || "";
  document.getElementById("productCategory").value =
    product?.category || "Fresh Beverage";
  setTapPicker(
    "productType",
    product?.type || "brukina-custom",
    Boolean(product),
  );
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
    const completedActive = button.dataset.tab === "completed-orders";
    document
      .querySelectorAll(".dashboard-tab")
      .forEach((tab) => tab.classList.toggle("active", tab === button));
    ordersSection.hidden = productsActive;
    ordersIntro.hidden = productsActive;
    ordersSummary.hidden = productsActive;
    productsSection.hidden = !productsActive;
    activeOrdersSection.hidden = productsActive || completedActive;
    completedOrdersSection.hidden = productsActive || !completedActive;
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
  const productName = document.getElementById("productName").value.trim();
  const payload = {
    name: productName,
    category: document.getElementById("productCategory").value.trim(),
    type,
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

/* =========================
   INITIAL CHECK
========================= */

const existingToken = localStorage.getItem("aoAdminToken");

if (existingToken) {
  showDashboard();
} else {
  showLogin();
}
