# Paystack Integration Guide — A and O Beverages

This document explains how Paystack is integrated into the A and O ordering system, how to test it in test mode, and how to go live.

---

## How the Integration Works

The integration uses the **Paystack Inline JS** popup, which gives customers a polished in-browser payment UI. The flow is:

```
Customer fills order → clicks "Pay & Place Order"
       ↓
Frontend calls POST /api/paystack/initialize
       ↓
Server calls Paystack API → gets a reference + public key back
       ↓
Frontend opens Paystack inline popup using the public key + reference
       ↓
Customer pays (card, Mobile Money, bank transfer, etc.)
       ↓
Popup fires onSuccess callback with the reference
       ↓
Frontend calls POST /api/orders with the reference
       ↓
Server calls Paystack API to VERIFY the reference
       ↓
If verified → order saved to database → success shown to customer
```

### Files involved

| File | Role |
|---|---|
| `server/.env` | Holds `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` |
| `server/server.js` | `POST /api/paystack/initialize` and payment verification inside `POST /api/orders` |
| `frontend/script.js` | Calls initialize, opens popup, handles success/failure |
| `frontend/index.html` | Loads `https://js.paystack.co/v1/inline.js` |

---

## Test Mode Setup

### 1. Get your test keys

1. Go to [dashboard.paystack.com](https://dashboard.paystack.com)
2. Make sure the toggle in the top-right corner says **Test**
3. Go to **Settings → API Keys & Webhooks**
4. Copy:
   - **Test Secret Key** — starts with `sk_test_`
   - **Test Public Key** — starts with `pk_test_`

### 2. Add them to your `.env`

```env
PAYSTACK_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY
PAYSTACK_PUBLIC_KEY=pk_test_YOUR_TEST_PUBLIC_KEY
```

### 3. Test card numbers

Use these on the Paystack popup when prompted:

| Card | Number | Expiry | CVV |
|---|---|---|---|
| Successful payment | `4084 0840 8408 4081` | Any future date | Any 3 digits |
| Declined payment | `4084 0840 8408 4084` | Any future date | Any 3 digits |

> **Note:** For GHS (Ghana Cedis), Paystack will also allow Mobile Money test payments. Use any 10-digit number in the MoMo field — test mode does not charge real accounts.

### 4. Run the server locally

```bash
cd server
npm start
```

The server runs on `http://localhost:3000` by default.

> **Frontend note:** The frontend currently points to the deployed Render URL (`https://a-and-o-beverages.onrender.com`). For local testing you can temporarily change `API_BASE_URL` in `frontend/script.js` to `http://localhost:3000/api`.

### 5. Make a test order

1. Open `frontend/index.html` in a browser (or use a local server like Live Server in VS Code)
2. Add a product, fill out your details, click **Pay & Place Order**
3. The Paystack popup opens — use a test card from the table above
4. After success, check the Admin dashboard to confirm the order appeared with **Payment Status: Verified**

### 6. Verify a test transaction

After a test payment, you can verify it directly:

```bash
curl https://api.paystack.co/transaction/verify/YOUR_REFERENCE \
  -H "Authorization: Bearer sk_test_YOUR_SECRET_KEY"
```

The response `data.status` should be `"success"`.

---

## Going Live

### Step 1 — Activate your Paystack account

1. Log into [dashboard.paystack.com](https://dashboard.paystack.com)
2. Complete business verification:
   - Business name and registration documents
   - Bank account for settlement
   - A working website URL (your deployed frontend)
3. Paystack will review and activate your account (usually within 24–48 hours)

### Step 2 — Get your live keys

1. Toggle to **Live** mode in the Paystack dashboard
2. Go to **Settings → API Keys & Webhooks**
3. Copy:
   - **Live Secret Key** — starts with `sk_live_`
   - **Live Public Key** — starts with `pk_live_`

### Step 3 — Update your environment variables

On **Render** (or wherever you host):

1. Go to your service → **Environment**
2. Update:
   ```
   PAYSTACK_SECRET_KEY = sk_live_YOUR_LIVE_SECRET_KEY
   PAYSTACK_PUBLIC_KEY = pk_live_YOUR_LIVE_PUBLIC_KEY
   ```
3. Redeploy / restart the service

> ⚠️ **Never commit live keys to Git.** They must only ever live in environment variables.

### Step 4 — Set up a webhook (recommended)

A webhook lets Paystack notify your server when a payment succeeds, even if the customer's browser closed.

1. In Paystack dashboard → **Settings → API Keys & Webhooks → Webhook URL**
2. Enter: `https://a-and-o-beverages.onrender.com/api/paystack/webhook`
3. You'll need to add a new route in `server.js` to handle the webhook event

**Basic webhook handler example** (add to `server.js`):

```js
const crypto = require("crypto");

app.post("/api/paystack/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  const hash = crypto
    .createHmac("sha512", secret)
    .update(req.body)
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(req.body);

  if (event.event === "charge.success") {
    const reference = event.data.reference;
    // Handle successful charge — e.g. look up order by reference and mark it verified
    console.log("Paystack webhook: charge.success for", reference);
  }

  res.status(200).send("OK");
});
```

> **Note:** The webhook route must use `express.raw()` to get the raw body for signature verification. Place this route **before** `app.use(express.json())` or handle it separately.

### Step 5 — Test your live setup

Make a small real payment (e.g. GHS 1.00) to confirm the full flow works end-to-end before announcing to customers.

---

## Currency Note

Paystack's API accepts amounts in the **smallest currency unit**:

- For **GHS** (Ghana Cedis): 1 GHS = 100 pesewas
- The server converts: `amountKobo = Math.round(amountGHS * 100)`
- When verifying, the server converts back: `verifiedAmount = txn.amount / 100`

---

## Common Issues

| Issue | Likely cause | Fix |
|---|---|---|
| "Could not start payment" | Wrong or missing secret key | Check `.env` has correct `PAYSTACK_SECRET_KEY` |
| Popup doesn't open | Wrong or missing public key | Check `PAYSTACK_PUBLIC_KEY` is correct |
| "Payment could not be verified" | Reference already used or test key on live | Use fresh reference; match test/live keys |
| Order not saved after payment | Server error during DB insert | Check server logs for the specific error |
| CORS error in browser | Frontend and server on different origins | Make sure `app.use(cors())` is in server.js |

---

## Key References

- Paystack docs: [paystack.com/docs](https://paystack.com/docs)
- Inline JS reference: [paystack.com/docs/payments/accept-payments/#popup](https://paystack.com/docs/payments/accept-payments/#popup)
- Verify transaction API: [paystack.com/docs/api/transaction/#verify](https://paystack.com/docs/api/transaction/#verify)
- Webhooks: [paystack.com/docs/payments/webhooks](https://paystack.com/docs/payments/webhooks)
