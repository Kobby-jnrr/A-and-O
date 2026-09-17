require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");

const db = require("./database");
const { login, authenticateToken } = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || "";

const PRODUCT_TYPES = [
  "brukina-custom",
  "flavor-size",
  "parfait-custom",
  "size-sweetness",
];

const PRODUCT_STATUSES = ["available", "out_of_stock", "unavailable"];

function productForApi(row) {
  const config = row.config && typeof row.config === "object" ? row.config : {};

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    type: row.type,
    ...config,
    image: row.image_url,
    description: row.description,
    status: row.status,
    sortOrder: row.sort_order,
  };
}

function optionIsAvailable(product, group, id) {
  return product?.stock?.[group]?.[id] !== "out_of_stock";
}

function validateProductInput(input, { requireId = false } = {}) {
  const product = input || {};
  const result = {};

  if (requireId || product.id !== undefined) {
    result.id = String(product.id || "").trim();
    if (!result.id || !/^[A-Za-z0-9_-]+$/.test(result.id)) {
      throw new Error(
        "Product ID may only use letters, numbers, hyphens, and underscores.",
      );
    }
  }

  for (const field of [
    "name",
    "category",
    "type",
    "status",
    "description",
    "image_url",
  ]) {
    if (product[field] !== undefined) result[field] = product[field];
  }
  if (product.image !== undefined) result.image_url = product.image;
  if (product.sort_order !== undefined) result.sort_order = product.sort_order;
  if (product.sortOrder !== undefined) result.sort_order = product.sortOrder;
  if (product.config !== undefined) result.config = product.config;

  if (result.name !== undefined && !String(result.name).trim())
    throw new Error("Product name is required.");
  if (result.type !== undefined && !PRODUCT_TYPES.includes(result.type))
    throw new Error("Invalid product type.");
  if (result.status !== undefined && !PRODUCT_STATUSES.includes(result.status))
    throw new Error("Invalid product status.");
  if (
    result.sort_order !== undefined &&
    !Number.isInteger(Number(result.sort_order))
  )
    throw new Error("Sort order must be a whole number.");
  if (
    result.config !== undefined &&
    (!result.config ||
      typeof result.config !== "object" ||
      Array.isArray(result.config))
  )
    throw new Error("Product configuration must be an object.");

  return result;
}

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

// Paystack webhook needs the raw request body for signature verification.
// We'll register a per-route raw body parser below for the webhook and
// keep the JSON body parser for other routes.

// ============================================================
// PAYSTACK WEBHOOK
// ============================================================

app.post(
  "/api/paystack/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const secret = process.env.PAYSTACK_SECRET_KEY || "";

      const signature = req.headers["x-paystack-signature"];

      const hash = crypto
        .createHmac("sha512", secret)
        .update(req.body)
        .digest("hex");

      if (!signature || hash !== signature) {
        console.warn("Invalid Paystack webhook signature", { signature, hash });
        return res.status(400).send("Invalid signature");
      }

      const event = JSON.parse(req.body.toString());

      console.log("Paystack webhook event:", event.event);

      if (event.event === "charge.success") {
        const reference = event.data?.reference;
        // Try to extract order_number from metadata if present
        const metadataOrderNumber =
          event.data?.metadata?.order_number ||
          event.data?.metadata?.orderNumber ||
          null;

        try {
          let result;

          if (metadataOrderNumber) {
            result = await db.query(
              `UPDATE orders SET payment_status = 'Verified', order_status = 'Processing', updated_at = CURRENT_TIMESTAMP, momo_reference = $1 WHERE order_number = $2 AND payment_status != 'Verified' RETURNING order_number, id, total_amount`,
              [String(reference), String(metadataOrderNumber)],
            );
          }

          // Fallback: try matching by momo_reference
          if (!result || result.rows.length === 0) {
            if (reference) {
              result = await db.query(
                `UPDATE orders SET payment_status = 'Verified', order_status = 'Processing', updated_at = CURRENT_TIMESTAMP WHERE momo_reference = $1 AND payment_status != 'Verified' RETURNING order_number, id, total_amount`,
                [String(reference)],
              );
            }
          }

          if (result && result.rows.length > 0) {
            console.log(
              "Order verified via webhook:",
              result.rows[0].order_number,
            );
          } else {
            console.log(
              "Webhook: no matching order for reference/metadata",
              reference,
              metadataOrderNumber,
            );
          }
        } catch (dbErr) {
          console.error("Webhook DB error:", dbErr);
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Paystack webhook handler error:", error);
      res.status(500).send("Webhook handler error");
    }
  },
);

// Now enable JSON body parsing for the rest of the routes
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
// PAYSTACK — VERIFY TRANSACTION (proxy for frontend polling)
// ============================================================

app.get("/api/paystack/verify/:reference", async (req, res) => {
  try {
    const reference = String(req.params.reference || "").trim();

    if (!reference) {
      return res
        .status(400)
        .json({ success: false, message: "Reference is required." });
    }

    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const txn = verifyRes.data?.data;

    if (!txn) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found." });
    }

    return res.json({
      success: true,
      status: txn.status,
      reference: txn.reference,
      amount: txn.amount,
      channel: txn.channel,
      authorization: txn.authorization || null,
      raw: txn,
    });
  } catch (error) {
    console.error(
      "Paystack verify proxy error:",
      error?.response?.data || error.message,
    );

    const status = error?.response?.status || 500;

    return res
      .status(status)
      .json({ success: false, message: "Could not verify transaction." });
  }
});

// ============================================================
// CREATE PROVISIONAL ORDER (before payment)
// ============================================================

app.post("/api/orders/init", async (req, res) => {
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
      items,
    } = req.body;

    if (!customerName || !customerPhone || !orderMethod) {
      return res.status(400).json({
        message: "Please provide your name, phone number, and order method.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Please add at least one product to your order." });
    }

    if (!["Pickup", "Delivery"].includes(orderMethod)) {
      return res
        .status(400)
        .json({ message: "Order method must be either Pickup or Delivery." });
    }

    if (orderMethod === "Delivery" && !deliveryAddress && !locationLink) {
      return res
        .status(400)
        .json({ message: "Please provide a delivery address or location." });
    }

    const cleanCustomerName = String(customerName).trim();
    const cleanCustomerPhone = String(customerPhone).trim();

    if (!cleanCustomerName || !cleanCustomerPhone) {
      return res
        .status(400)
        .json({ message: "Please provide valid customer information." });
    }

    // Validate products and compute total
    const validatedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const productId = String(item.productId || "").trim();
      const productResult = await db.query(
        "SELECT * FROM products WHERE id = $1 LIMIT 1",
        [productId],
      );
      const productRow = productResult.rows[0];

      if (!productRow || productRow.status !== "available") {
        return res
          .status(400)
          .json({ message: `This product is not available: ${productId}` });
      }

      const product = productForApi(productRow);

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res
          .status(400)
          .json({ message: "Each product must have a valid quantity." });
      }

      let unitPrice = 0;
      let description = "";

      if (product.type === "brukina-custom") {
        const toppings = Array.isArray(item.toppings) ? item.toppings : [];
        const allowedToppings = product.toppings || {
          coconut_flakes: "Coconut Flakes",
        };
        if (
          toppings.some(
            (topping) =>
              !allowedToppings[topping] ||
              !optionIsAvailable(product, "toppings", topping),
          )
        ) {
          return res
            .status(400)
            .json({ message: "Invalid Brukina topping selected." });
        }

        const groundnutSelected = !!item.groundnut;

        unitPrice = Number(product.price) + (groundnutSelected ? 2 : 0);

        description = [];
        if (toppings.length)
          description.push(
            `Toppings: ${toppings.map((t) => allowedToppings[t]).join(", ")}`,
          );
        if (groundnutSelected) description.push("Groundnut");
        description = description.join("; ") || "Standard";
      } else if (product.type === "flavor-size") {
        const size = String(item.sizeId || "").trim();
        const flavor = String(item.flavorId || "")
          .trim()
          .toLowerCase();
        if (
          !product.sizes?.[size] ||
          !optionIsAvailable(product, "sizes", size)
        )
          return res.status(400).json({
            message: "Please select a valid size for Fresh Yoghurt Drink.",
          });
        if (
          !product.flavors?.[flavor] ||
          !optionIsAvailable(product, "flavors", flavor)
        )
          return res.status(400).json({
            message: "Please select a valid flavor for Fresh Yoghurt Drink.",
          });
        unitPrice = product.sizes[size];
        description = `${flavor.charAt(0).toUpperCase() + flavor.slice(1)} - ${size}`;
      } else if (product.type === "parfait-custom") {
        unitPrice = product.price;
      } else if (product.type === "size-sweetness") {
        const size = String(item.sizeId || "").trim();
        const sweetness = String(item.sweetnessId || "")
          .trim()
          .toLowerCase();
        if (
          !product.prices?.[size] ||
          !optionIsAvailable(product, "sizes", size)
        )
          return res
            .status(400)
            .json({ message: "Please select a valid size for Greek Yoghurt." });
        if (!product.prices[size]?.[sweetness])
          return res.status(400).json({
            message:
              "Please select whether the Greek Yoghurt is sweetened or unsweetened.",
          });
        unitPrice = product.prices[size][sweetness];
        description = `${size} - ${sweetness.charAt(0).toUpperCase() + sweetness.slice(1)}`;
      } else {
        return res
          .status(400)
          .json({ message: "This product has an unsupported configuration." });
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

    // Create order number and insert order + items
    client = await db.connect();
    try {
      await client.query("BEGIN");

      const orderNumber = await createUniqueOrderNumber();

      const orderResult = await client.query(
        `INSERT INTO orders (order_number, customer_name, customer_phone, order_method, delivery_address, location_lat, location_lng, location_link, total_amount, payment_method, payment_status, order_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Paystack','Pending','Pending') RETURNING id`,
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
        ],
      );

      const orderId = orderResult.rows[0].id;

      for (const item of validatedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, description) VALUES ($1,$2,$3,$4,$5,$6)`,
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

      return res.status(201).json({
        success: true,
        orderNumber,
        orderId,
        totalAmount: calculatedTotal,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      if (client) client.release();
    }
  } catch (error) {
    console.error("Create provisional order error:", error);
    if (client)
      try {
        client.release();
      } catch {}
    return res
      .status(500)
      .json({ message: "Could not create provisional order." });
  }
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
// PRODUCTS
// ============================================================

app.get("/api/products", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM products WHERE status IN ('available', 'out_of_stock') ORDER BY sort_order, name`,
    );
    res.json(result.rows.map(productForApi));
  } catch (error) {
    console.error("Get public products error:", error);
    res.status(500).json({ message: "We could not load products right now." });
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
      paystackReference,
      items,
    } = req.body;

    // --------------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------------

    if (!customerName || !customerPhone || !orderMethod || !paystackReference) {
      return res.status(400).json({
        message:
          "Please provide your name, phone number, order method, and a valid payment reference.",
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
    const cleanPaystackRef = paystackReference
      ? String(paystackReference).trim()
      : "";
    const providedOrderNumber = req.body.orderNumber
      ? String(req.body.orderNumber).trim()
      : null;

    if (!cleanCustomerName || !cleanCustomerPhone) {
      return res
        .status(400)
        .json({ message: "Please provide valid customer information." });
    }

    // --------------------------------------------------------
    // VALIDATE PRODUCTS
    // --------------------------------------------------------

    const validatedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const productId = String(item.productId || "").trim();
      const productResult = await db.query(
        "SELECT * FROM products WHERE id = $1 LIMIT 1",
        [productId],
      );
      const productRow = productResult.rows[0];

      if (!productRow || productRow.status !== "available") {
        return res.status(400).json({
          message: `This product is not available: ${productId}`,
        });
      }

      const product = productForApi(productRow);

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

      if (product.type === "brukina-custom") {
        const toppings = Array.isArray(item.toppings) ? item.toppings : [];
        const allowedToppings = product.toppings || {
          coconut_flakes: "Coconut Flakes",
        };
        if (
          toppings.some(
            (topping) =>
              !allowedToppings[topping] ||
              !optionIsAvailable(product, "toppings", topping),
          )
        ) {
          return res
            .status(400)
            .json({ message: "Invalid Brukina topping selected." });
        }

        const groundnutSelected = !!item.groundnut;

        unitPrice = Number(product.price) + (groundnutSelected ? 2 : 0);

        description = [];
        if (toppings.length)
          description.push(
            `Toppings: ${toppings.map((t) => allowedToppings[t]).join(", ")}`,
          );
        if (groundnutSelected) description.push("Groundnut");
        description = description.join("; ") || "Standard";
      }

      // ------------------------------------------------------
      // FRESH YOGHURT DRINK
      // ------------------------------------------------------
      else if (product.type === "flavor-size") {
        const size = String(item.sizeId || "").trim();
        const flavor = String(item.flavorId || "")
          .trim()
          .toLowerCase();

        if (!product.sizes?.[size]) {
          return res.status(400).json({
            message: "Please select a valid size for Fresh Yoghurt Drink.",
          });
        }

        if (!product.flavors?.[flavor]) {
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
      else if (product.type === "parfait-custom") {
        unitPrice = product.price;

        const allowedFruits = Object.keys(product.fruits || {});
        const allowedToppings = Object.keys(product.toppings || {});
        const allowedSyrups = Object.keys(product.syrups || {});

        const fruits = Array.isArray(item.fruits) ? item.fruits : [];

        const toppings = Array.isArray(item.toppings) ? item.toppings : [];

        const syrup = item.syrupId || "none";

        if (fruits.length > 3) {
          return res.status(400).json({
            message: "You can select a maximum of 3 fruits for a parfait.",
          });
        }

        for (const fruit of fruits) {
          if (
            !allowedFruits.includes(fruit) ||
            !optionIsAvailable(product, "fruits", fruit)
          ) {
            return res.status(400).json({
              message: "Invalid parfait fruit selected.",
            });
          }
        }

        for (const topping of toppings) {
          if (
            !allowedToppings.includes(topping) ||
            !optionIsAvailable(product, "toppings", topping)
          ) {
            return res.status(400).json({
              message: "Invalid parfait topping selected.",
            });
          }
        }

        if (
          !allowedSyrups.includes(syrup) ||
          !optionIsAvailable(product, "syrups", syrup)
        ) {
          return res.status(400).json({
            message: "Invalid parfait syrup selected.",
          });
        }

        const fruitLabels = product.fruits || {};
        const toppingLabels = product.toppings || {};
        const syrupLabels = product.syrups || {};

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
      else if (product.type === "size-sweetness") {
        const size = String(item.sizeId || "").trim();
        const sweetness = String(item.sweetnessId || "")
          .trim()
          .toLowerCase();

        if (
          !product.prices?.[size] ||
          !optionIsAvailable(product, "sizes", size)
        ) {
          return res.status(400).json({
            message: "Please select a valid size for Greek Yoghurt.",
          });
        }

        if (!product.prices[size]?.[sweetness]) {
          return res.status(400).json({
            message:
              "Please select whether the Greek Yoghurt is sweetened or unsweetened.",
          });
        }

        unitPrice = product.prices[size][sweetness];

        const displaySweetness =
          sweetness.charAt(0).toUpperCase() + sweetness.slice(1);

        description = `${size} - ${displaySweetness}`;
      } else {
        return res
          .status(400)
          .json({ message: "This product has an unsupported configuration." });
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
    // APPLY FEE RULE
    // --------------------------------------------------------

    // Fee policy: 50 GHS and below => 0.50 GHS, otherwise 1%
    const fee =
      Number(calculatedTotal) <= 50
        ? 0.5
        : Number((calculatedTotal * 0.01).toFixed(2));
    const expectedTotal = Number((calculatedTotal + fee).toFixed(2));

    // --------------------------------------------------------
    // VERIFY PAYSTACK PAYMENT
    // --------------------------------------------------------

    if (!cleanPaystackRef) {
      return res
        .status(400)
        .json({ message: "Please provide a valid payment reference." });
    }

    let verifiedAmount = 0;
    try {
      const verifyRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(cleanPaystackRef)}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
      );

      const txn = verifyRes.data?.data;
      if (!txn || txn.status !== "success") {
        return res.status(400).json({
          message: "Payment could not be verified. Please try again.",
        });
      }

      verifiedAmount = Number(txn.amount) / 100;

      if (Math.abs(verifiedAmount - expectedTotal) > 0.01) {
        return res.status(400).json({
          message:
            "The amount paid does not match the order total including fees.",
          expected: expectedTotal,
          paid: verifiedAmount,
        });
      }
    } catch (verifyError) {
      console.error(
        "Paystack verify error:",
        verifyError?.response?.data || verifyError.message,
      );
      return res.status(400).json({
        message:
          "We could not verify your payment. Please contact us if payment was deducted.",
      });
    }

    // --------------------------------------------------------
    // POSTGRESQL TRANSACTION: update provisional order or create new
    // --------------------------------------------------------

    client = await db.connect();
    try {
      await client.query("BEGIN");

      if (providedOrderNumber) {
        // Ensure provisional order exists and total matches
        const existing = await client.query(
          `SELECT id, total_amount FROM orders WHERE order_number = $1 LIMIT 1`,
          [providedOrderNumber],
        );
        if (existing.rows.length === 0) {
          await client.query("ROLLBACK");
          return res
            .status(404)
            .json({ message: "Provisional order not found." });
        }

        const storedTotal = Number(existing.rows[0].total_amount);
        if (Math.abs(storedTotal - calculatedTotal) > 0.01) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Order items do not match provisional order total.",
          });
        }

        const updateRes = await client.query(
          `UPDATE orders SET momo_reference = $1, payment_method = 'Paystack', payment_status = 'Verified', order_status = 'Pending', updated_at = CURRENT_TIMESTAMP WHERE order_number = $2 RETURNING id`,
          [cleanPaystackRef, providedOrderNumber],
        );

        await client.query("COMMIT");

        return res.status(200).json({
          success: true,
          message: "Order finalized.",
          orderNumber: providedOrderNumber,
          orderId: updateRes.rows[0].id,
        });
      }

      // No provisional order provided — insert new order record
      const orderNumber = await createUniqueOrderNumber();

      const orderResult = await client.query(
        `INSERT INTO orders (order_number, customer_name, customer_phone, order_method, delivery_address, location_lat, location_lng, location_link, total_amount, payment_method, momo_reference, payment_status, order_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Paystack',$10,'Verified','Pending') RETURNING id`,
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
          cleanPaystackRef,
        ],
      );

      const orderId = orderResult.rows[0].id;

      for (const item of validatedItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, description) VALUES ($1,$2,$3,$4,$5,$6)`,
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
        paymentStatus: "Verified",
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
        "Your order has been received and is awaiting payment verification.";
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

app.get("/api/admin/products", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM products ORDER BY sort_order, name",
    );
    res.json(result.rows.map(productForApi));
  } catch (error) {
    console.error("Get admin products error:", error);
    res.status(500).json({ message: "We could not load products right now." });
  }
});

app.post("/api/admin/products", authenticateToken, async (req, res) => {
  try {
    const product = validateProductInput(req.body, { requireId: true });
    if (!product.name || !product.type || !product.config) {
      return res.status(400).json({
        message: "Product ID, name, type, and configuration are required.",
      });
    }
    const result = await db.query(
      `INSERT INTO products (id, name, category, type, config, image_url, description, status, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9) RETURNING *`,
      [
        product.id,
        String(product.name).trim(),
        String(product.category || "Beverage").trim(),
        product.type,
        JSON.stringify(product.config),
        product.image_url || null,
        product.description || null,
        product.status || "available",
        Number(product.sort_order || 0),
      ],
    );
    res.status(201).json(productForApi(result.rows[0]));
  } catch (error) {
    console.error("Create product error:", error);
    res.status(error.code === "23505" ? 409 : 400).json({
      message:
        error.code === "23505"
          ? "That product ID already exists."
          : error.message || "Could not create product.",
    });
  }
});

app.patch("/api/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const product = validateProductInput(req.body);
    const fields = [];
    const values = [];
    const columns = {
      name: "name",
      category: "category",
      type: "type",
      config: "config",
      image_url: "image_url",
      description: "description",
      status: "status",
      sort_order: "sort_order",
    };
    for (const [key, column] of Object.entries(columns)) {
      if (product[key] !== undefined) {
        values.push(
          key === "config"
            ? JSON.stringify(product[key])
            : key === "sort_order"
              ? Number(product[key])
              : product[key],
        );
        fields.push(
          `${column} = $${values.length}${key === "config" ? "::jsonb" : ""}`,
        );
      }
    }
    if (!fields.length)
      return res
        .status(400)
        .json({ message: "No product changes were provided." });
    values.push(String(req.params.id));
    const result = await db.query(
      `UPDATE products SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows[0])
      return res.status(404).json({ message: "Product not found." });
    res.json(productForApi(result.rows[0]));
  } catch (error) {
    console.error("Update product error:", error);
    res
      .status(400)
      .json({ message: error.message || "Could not update product." });
  }
});

app.delete("/api/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM products WHERE id = $1 RETURNING id",
      [String(req.params.id)],
    );
    if (!result.rows[0])
      return res.status(404).json({ message: "Product not found." });
    res.status(204).end();
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Could not delete product." });
  }
});

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
// PAYSTACK — INITIALIZE TRANSACTION
// ============================================================

app.post("/api/paystack/initialize", async (req, res) => {
  try {
    const { email, amountGHS, customerName, customerPhone } = req.body;

    if (!email || !amountGHS || amountGHS <= 0) {
      return res.status(400).json({
        message: "A valid email and amount are required to start payment.",
      });
    }

    // Apply fee policy: <= 50 GHS => flat 0.50 GHS; > 50 => 1% fee
    const baseAmount = Number(amountGHS);
    const fee = baseAmount <= 50 ? 0.5 : Number((baseAmount * 0.01).toFixed(2));
    const totalAmountGHS = Number((baseAmount + fee).toFixed(2));

    // Paystack expects amount in the lowest currency unit (pesewas for GHS)
    const amountKobo = Math.round(totalAmountGHS * 100);

    const payload = {
      email,
      amount: amountKobo,
      currency: "GHS",
      metadata: {
        customer_name: customerName,
        customer_phone: customerPhone,
      },
    };

    // include order number in metadata when provided by frontend
    if (req.body.orderNumber) {
      payload.metadata.order_number = String(req.body.orderNumber);
    }

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      payload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const { reference, authorization_url } = paystackRes.data.data;

    res.json({
      success: true,
      reference,
      authorization_url,
      amountKobo,
      email,
      fee,
      amountGHS: baseAmount,
      totalAmountGHS,
      // Return the public key so the frontend can open the inline popup
      publicKey: PAYSTACK_PUBLIC_KEY,
    });
  } catch (error) {
    console.error(
      "Paystack initialize error:",
      error?.response?.data || error.message,
    );

    res.status(500).json({
      message: "Could not start payment. Please try again.",
    });
  }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log(`A and O backend running on port ${PORT}`);
});
