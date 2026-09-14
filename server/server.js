const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./database");
const { login, authenticateToken } = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// PRODUCTS
// ============================================================

const PRODUCTS = {
  A: {
    name: "Brukina",
    type: "brukina-custom",
    price: 20,
  },

  B: {
    name: "Fresh Yoghurt Drink",
    type: "flavor-size",
    sizes: {
      "500ml": 25,
      "300ml": 15,
      "250ml": 12,
    },
  },

  C: {
    name: "Parfait",
    type: "parfait-custom",
    price: 40,
  },

  D: {
    name: "Greek Yoghurt",
    type: "size-sweetness",
    prices: {
      "500ml": {
        sweetened: 50,
        unsweetened: 45,
      },
      "1l": {
        sweetened: 100,
        unsweetened: 90,
      },
    },
  },
};

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());

app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

// ============================================================
// ORDER NUMBER
// ============================================================

function generateOrderNumber() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `AO-${year}${month}${day}-${randomNumber}`;
}

async function createUniqueOrderNumber() {
  let orderNumber;

  do {
    orderNumber = generateOrderNumber();

    const result = await db.query(
      `
      SELECT id
      FROM orders
      WHERE order_number = $1
      LIMIT 1
      `,
      [orderNumber],
    );

    if (result.rows.length === 0) {
      return orderNumber;
    }
  } while (true);
}

// ============================================================
// BASIC ROUTE
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message: "A and O Beverages backend is running.",
  });
});

// ============================================================
// ADMIN LOGIN
// ============================================================

app.post("/api/admin/login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Please enter your username and password.",
      });
    }

    const token = login(username, password);

    if (!token) {
      return res.status(401).json({
        message: "The username or password is incorrect.",
      });
    }

    res.json({
      message: "Login successful.",
      token,
    });
  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      message: "We could not log you in right now. Please try again.",
    });
  }
});

// ============================================================
// CREATE ORDER
// ============================================================

app.post("/api/orders", async (req, res) => {
  let client;

  try {
    const {
      customerName,
      customerPhone,
      orderMethod,
      deliveryAddress,
      locationLat,
      locationLng,
      locationLink,
      momoReference,
      items,
    } = req.body;

    // --------------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------------

    if (!customerName || !customerPhone || !orderMethod || !momoReference) {
      return res.status(400).json({
        message:
          "Please provide your name, phone number, order method, and Mobile Money reference.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Please add at least one product to your order.",
      });
    }

    if (!["Pickup", "Delivery"].includes(orderMethod)) {
      return res.status(400).json({
        message: "Order method must be either Pickup or Delivery.",
      });
    }

    if (orderMethod === "Delivery" && !deliveryAddress && !locationLink) {
      return res.status(400).json({
        message: "Please provide a delivery address or location.",
      });
    }

    const cleanCustomerName = String(customerName).trim();
    const cleanCustomerPhone = String(customerPhone).trim();
    const cleanMomoReference = String(momoReference).trim();

    if (!cleanCustomerName || !cleanCustomerPhone) {
      return res.status(400).json({
        message: "Please provide valid customer information.",
      });
    }

    if (!cleanMomoReference) {
      return res.status(400).json({
        message: "Please provide your Mobile Money payment reference.",
      });
    }

    // --------------------------------------------------------
    // VALIDATE PRODUCTS
    // --------------------------------------------------------

    const validatedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const productId = String(item.productId || "").trim();
      const product = PRODUCTS[productId];

      if (!product) {
        return res.status(400).json({
          message: `Invalid product: ${productId}`,
        });
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          message: "Each product must have a valid quantity.",
        });
      }

      let unitPrice = 0;
      let description = "";

      // ------------------------------------------------------
      // BRUKINA
      // ------------------------------------------------------

      if (productId === "A") {
        unitPrice = product.price;

        const coconutFlakes =
          item.coconutFlakes === true || item.coconutFlakes === "true";

        description = coconutFlakes ? "With Coconut Flakes" : "Standard";
      }

      // ------------------------------------------------------
      // FRESH YOGHURT DRINK
      // ------------------------------------------------------
      else if (productId === "B") {
        const size = String(item.size || "").trim();
        const flavor = String(item.flavor || "")
          .trim()
          .toLowerCase();

        if (!product.sizes[size]) {
          return res.status(400).json({
            message: "Please select a valid size for Fresh Yoghurt Drink.",
          });
        }

        if (!["plain", "strawberry"].includes(flavor)) {
          return res.status(400).json({
            message: "Please select a valid flavor for Fresh Yoghurt Drink.",
          });
        }

        unitPrice = product.sizes[size];

        const displayFlavor = flavor.charAt(0).toUpperCase() + flavor.slice(1);

        description = `${displayFlavor} - ${size}`;
      }

      // ------------------------------------------------------
      // PARFAIT
      // ------------------------------------------------------
      else if (productId === "C") {
        unitPrice = product.price;

        const allowedFruits = [
          "red_apples",
          "red_grapes",
          "mangoes",
          "strawberries",
          "bananas",
          "pineapples",
        ];

        const allowedToppings = ["granola", "coconut_flakes"];

        const allowedSyrups = [
          "none",
          "mango_syrup",
          "pineapple_syrup",
          "honey",
        ];

        const fruits = Array.isArray(item.fruits) ? item.fruits : [];

        const toppings = Array.isArray(item.toppings) ? item.toppings : [];

        const syrup = item.syrup || "none";

        if (fruits.length > 3) {
          return res.status(400).json({
            message: "You can select a maximum of 3 fruits for a parfait.",
          });
        }

        for (const fruit of fruits) {
          if (!allowedFruits.includes(fruit)) {
            return res.status(400).json({
              message: "Invalid parfait fruit selected.",
            });
          }
        }

        for (const topping of toppings) {
          if (!allowedToppings.includes(topping)) {
            return res.status(400).json({
              message: "Invalid parfait topping selected.",
            });
          }
        }

        if (!allowedSyrups.includes(syrup)) {
          return res.status(400).json({
            message: "Invalid parfait syrup selected.",
          });
        }

        const fruitLabels = {
          red_apples: "Red Apples",
          red_grapes: "Red Grapes",
          mangoes: "Mangoes",
          strawberries: "Strawberries",
          bananas: "Bananas",
          pineapples: "Pineapples",
        };

        const toppingLabels = {
          granola: "Granola",
          coconut_flakes: "Coconut Flakes",
        };

        const syrupLabels = {
          none: "No Syrup",
          mango_syrup: "Mango Syrup",
          pineapple_syrup: "Pineapple Syrup",
          honey: "Honey",
        };

        const fruitText =
          fruits.length > 0
            ? fruits.map((fruit) => fruitLabels[fruit]).join(", ")
            : "No fruit";

        const toppingText =
          toppings.length > 0
            ? toppings.map((topping) => toppingLabels[topping]).join(", ")
            : "No toppings";

        description = `Fruits: ${fruitText}; Toppings: ${toppingText}; Syrup: ${syrupLabels[syrup]}`;
      }

      // ------------------------------------------------------
      // GREEK YOGHURT
      // ------------------------------------------------------
      else if (productId === "D") {
        const size = String(item.size || "").trim();
        const sweetness = String(item.sweetness || "")
          .trim()
          .toLowerCase();

        if (!["500ml", "1l"].includes(size)) {
          return res.status(400).json({
            message: "Please select a valid size for Greek Yoghurt.",
          });
        }

        if (!["sweetened", "unsweetened"].includes(sweetness)) {
          return res.status(400).json({
            message:
              "Please select whether the Greek Yoghurt is sweetened or unsweetened.",
          });
        }

        unitPrice = product.prices[size][sweetness];

        const displaySweetness =
          sweetness.charAt(0).toUpperCase() + sweetness.slice(1);

        description = `${size} - ${displaySweetness}`;
      }

      calculatedTotal += unitPrice * quantity;

      validatedItems.push({
        productId,
        productName: product.name,
        quantity,
        unitPrice,
        description,
      });
    }

    // --------------------------------------------------------
    // CREATE ORDER NUMBER
    // --------------------------------------------------------

    const orderNumber = await createUniqueOrderNumber();

    // --------------------------------------------------------
    // POSTGRESQL TRANSACTION
    // --------------------------------------------------------

    client = await db.connect();

    try {
      await client.query("BEGIN");

      const orderResult = await client.query(
        `
        INSERT INTO orders (
          order_number,
          customer_name,
          customer_phone,
          order_method,
          delivery_address,
          location_lat,
          location_lng,
          location_link,
          total_amount,
          payment_method,
          momo_number,
          momo_account_name,
          momo_reference,
          payment_status,
          order_status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'MoMo',
          '059 990 7434',
          'A and O Beverages Limited',
          $10,
          'Pending',
          'Pending'
        )
        RETURNING id
        `,
        [
          orderNumber,
          cleanCustomerName,
          cleanCustomerPhone,
          orderMethod,
          deliveryAddress ? String(deliveryAddress).trim() : null,
          locationLat ?? null,
          locationLng ?? null,
          locationLink || null,
          calculatedTotal,
          cleanMomoReference,
        ],
      );

      const orderId = orderResult.rows[0].id;

      for (const item of validatedItems) {
        await client.query(
          `
          INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            description
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          `,
          [
            orderId,
            item.productId,
            item.productName,
            item.quantity,
            item.unitPrice,
            item.description || null,
          ],
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Your order has been received successfully!",
        orderId,
        orderNumber,
        totalAmount: calculatedTotal,
        paymentStatus: "Pending",
        orderStatus: "Pending",
        trackingMessage:
          "Please keep your order number so you can check your order status later.",
      });
    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Create order error:", error);

    if (client) {
      try {
        client.release();
      } catch {}
    }

    res.status(500).json({
      message: "We could not receive your order right now. Please try again.",
    });
  }
});

// ============================================================
// TRACK ORDER
// ============================================================

app.get("/api/orders/track/:orderNumber", async (req, res) => {
  try {
    const orderNumber = String(req.params.orderNumber || "")
      .trim()
      .toUpperCase();

    if (!orderNumber) {
      return res.status(400).json({
        message: "Please provide an order number.",
      });
    }

    const orderResult = await db.query(
      `
        SELECT
          id,
          order_number,
          customer_name,
          total_amount,
          payment_method,
          payment_status,
          order_status,
          created_at,
          updated_at
        FROM orders
        WHERE order_number = $1
        LIMIT 1
        `,
      [orderNumber],
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        message: "We couldn't find an order with that order number.",
      });
    }

    const order = orderResult.rows[0];

    const itemsResult = await db.query(
      `
        SELECT
          product_name,
          quantity,
          unit_price,
          description
        FROM order_items
        WHERE order_id = $1
        ORDER BY id ASC
        `,
      [order.id],
    );

    let statusMessage = "Your order has been received and is being processed.";

    if (order.payment_status === "Rejected") {
      statusMessage =
        "Payment could not be verified. If you have already made this payment, please reach out to us immediately so we can look into the issue and work with you to resolve it.";
    } else if (order.order_status === "Processing") {
      statusMessage =
        "Your payment has been received and your order is being prepared.";
    } else if (order.order_status === "Ready") {
      statusMessage = "Your order is ready for collection or delivery.";
    } else if (order.order_status === "Completed") {
      statusMessage =
        "Your order has been completed. Thank you for ordering from A and O Beverages!";
    } else if (order.order_status === "Cancelled") {
      statusMessage =
        "This order has been cancelled. Please contact us if you need assistance.";
    } else if (order.payment_status === "Pending") {
      statusMessage =
        "Your order has been received. We're checking your Mobile Money payment.";
    }

    res.json({
      success: true,
      order: {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        totalAmount: Number(order.total_amount),
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        orderStatus: order.order_status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        statusMessage,
        items: itemsResult.rows.map((item) => ({
          product_name: item.product_name,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          description: item.description,
        })),
      },
    });
  } catch (error) {
    console.error("Track order error:", error);

    res.status(500).json({
      message: "We could not retrieve the order right now. Please try again.",
    });
  }
});

// ============================================================
// ADMIN — GET ALL ORDERS
// ============================================================

app.get("/api/admin/orders", authenticateToken, async (req, res) => {
  try {
    const ordersResult = await db.query(
      `
        SELECT *
        FROM orders
        ORDER BY created_at DESC
        `,
    );

    const result = [];

    for (const order of ordersResult.rows) {
      const itemsResult = await db.query(
        `
          SELECT *
          FROM order_items
          WHERE order_id = $1
          ORDER BY id ASC
          `,
        [order.id],
      );

      result.push({
        ...order,
        total_amount: Number(order.total_amount),
        items: itemsResult.rows.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Get admin orders error:", error);

    res.status(500).json({
      message: "We could not load the orders right now.",
    });
  }
});

// ============================================================
// ADMIN — UPDATE PAYMENT STATUS
// ============================================================

app.patch(
  "/api/admin/orders/:id/payment",
  authenticateToken,
  async (req, res) => {
    try {
      const { paymentStatus } = req.body;

      const allowedStatuses = ["Pending", "Verified", "Rejected"];

      if (!allowedStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          message: "Invalid payment status.",
        });
      }

      const orderId = Number(req.params.id);

      if (!Number.isInteger(orderId)) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      const result = await db.query(
        `
        UPDATE orders
        SET
          payment_status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
        `,
        [paymentStatus, orderId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      res.json({
        success: true,
        message: "Payment status updated successfully.",
      });
    } catch (error) {
      console.error("Update payment status error:", error);

      res.status(500).json({
        message: "We could not update the payment status.",
      });
    }
  },
);

// ============================================================
// ADMIN — UPDATE ORDER STATUS
// ============================================================

app.patch(
  "/api/admin/orders/:id/status",
  authenticateToken,
  async (req, res) => {
    try {
      const { orderStatus } = req.body;

      const allowedStatuses = [
        "Pending",
        "Processing",
        "Ready",
        "Completed",
        "Cancelled",
      ];

      if (!allowedStatuses.includes(orderStatus)) {
        return res.status(400).json({
          message: "Invalid order status.",
        });
      }

      const orderId = Number(req.params.id);

      if (!Number.isInteger(orderId)) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      const result = await db.query(
        `
        UPDATE orders
        SET
          order_status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id
        `,
        [orderStatus, orderId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      res.json({
        success: true,
        message: "Order status updated successfully.",
      });
    } catch (error) {
      console.error("Update order status error:", error);

      res.status(500).json({
        message: "We could not update the order status.",
      });
    }
  },
);

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log(`A and O backend running on port ${PORT}`);
});
