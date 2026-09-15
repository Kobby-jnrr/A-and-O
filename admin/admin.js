const API_URL = "https://a-and-o-beverages.onrender.com/api";

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");

const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

const ordersContainer = document.getElementById("ordersContainer");
const emptyOrders = document.getElementById("emptyOrders");

const totalOrders = document.getElementById("totalOrders");
const pendingPayments = document.getElementById("pendingPayments");
const verifiedPayments = document.getElementById("verifiedPayments");
const activeOrders = document.getElementById("activeOrders");

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

  ordersContainer.innerHTML = "";

  if (!orders.length) {
    emptyOrders.hidden = false;
    return;
  }

  emptyOrders.hidden = true;

  orders.forEach((order) => {
    ordersContainer.appendChild(createOrderCard(order));
  });
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
          MoMo reference
        </span>

        <span class="detail-value">
          ${escapeHtml(order.momo_reference)}
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
