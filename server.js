require("dotenv").config();
const paypal = require("@paypal/checkout-server-sdk");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const axios = require("axios");

const app = express();

const environment =
process.env.PAYPAL_MODE === "live"
? new paypal.core.LiveEnvironment(
process.env.PAYPAL_CLIENT_ID,
process.env.PAYPAL_CLIENT_SECRET
)
: new paypal.core.SandboxEnvironment(
process.env.PAYPAL_CLIENT_ID,
process.env.PAYPAL_CLIENT_SECRET
);

const paypalClient = new paypal.core.PayPalHttpClient(environment);
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ================= DATABASE =================
mongoose.connect(
  "mongodb+srv://travel-agency:Signals09%2409@cluster0.fopru6q.mongodb.net/travelsystem?retryWrites=true&w=majority"
)
.then(() => console.log("Database connected"))
.catch(err => console.log("DB Error:", err));

// ================= MODELS =================
const Application = mongoose.model("Application", {
trackingId: String,
name: String,
email: String,
job: String,
destination: String,
budget: String,
status: { type: String, default: "pending" },
paymentStatus: { type: String, default: "unpaid" }
});

const Admin = mongoose.model("Admin", {
  username: String,
  password: String
});

// ================= ADMIN SETUP =================
app.post("/admin/setup", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  const admin = new Admin({
    username: req.body.username,
    password: hash
  });

  await admin.save();
  res.json({ message: "Admin created" });
});

// ================= LOGIN =================
app.post("/admin/login", async (req, res) => {
  const admin = await Admin.findOne({ username: req.body.username });

  if (!admin) return res.status(400).json({ message: "Invalid username" });

  const ok = await bcrypt.compare(req.body.password, admin.password);
  if (!ok) return res.status(400).json({ message: "Invalid password" });

  const token = jwt.sign({ id: admin._id }, "SECRET123", { expiresIn: "1d" });

  res.json({ token });
});

// ================= AUTH =================
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) return res.status(401).json({ message: "No token" });

  try {
    const token = header.split(" ")[1];
    jwt.verify(token, "SECRET123");
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ================= APPLY =================
app.post("/apply", async (req, res) => {

const trackingId =
"TRV-" + Math.floor(100000 + Math.random() * 900000);

const appData = new Application({
...req.body,
trackingId
});

await appData.save();

res.json({
success: true,
trackingId
});

});
// ================= GET APPLICATIONS =================
app.get("/applications", async (req, res) => {
  const data = await Application.find();
  res.json(data);
});
app.get("/application/:id", async (req, res) => {

  const appData = await Application.findOne({
trackingId: req.params.id
});

  if (!appData) {
    return res.status(404).json({
      message: "Application not found"
    });
  }

  res.json(appData);

});

// ================= ADMIN APPLICATIONS =================
app.get("/admin/applications", auth, async (req, res) => {
  const data = await Application.find();
  res.json(data);
});

// ================= APPROVE =================
app.patch("/admin/approve/:id", auth, async (req, res) => {
  const updated = await Application.findByIdAndUpdate(
    req.params.id,
    { status: "approved" },
    { new: true }
  );

  res.json(updated);
});

// ================= REJECT =================
app.patch("/admin/reject/:id", auth, async (req, res) => {
  const updated = await Application.findByIdAndUpdate(
    req.params.id,
    { status: "rejected" },
    { new: true }
  );

  res.json(updated);
});

// ================= CONFIRM PAYMENT =================
app.patch("/admin/confirm-payment/:id", auth, async (req, res) => {
  const updated = await Application.findByIdAndUpdate(
    req.params.id,
    { paymentStatus: "paid" },
    { new: true }
  );

  res.json(updated);
});

// ================= CONFIRM PAYMENT =================
app.patch("/admin/confirm-payment/:id", auth, async (req, res) => {
  const updated = await Application.findByIdAndUpdate(
    req.params.id,
    { paymentStatus: "paid" },
    { new: true }
  );

  res.json(updated);
});

// ================= MPESA TOKEN =================
app.get("/mpesa/token", async (req, res) => {
  try {
    const auth = Buffer.from(
      process.env.MPESA_CONSUMER_KEY +
      ":" +
      process.env.MPESA_CONSUMER_SECRET
    ).toString("base64");

    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.log(error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to get token"
    });
  }
});

// ================= MPESA STK PUSH =================

app.post("/mpesa/stkpush", async (req, res) => {
  try {
    const phone = req.body.phone;

    const tokenResponse = await axios.get(
      "http://localhost:5000/mpesa/token"
    );

    const token = tokenResponse.data.access_token;

    const timestamp =
      new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);

    const password = Buffer.from(
      process.env.MPESA_SHORTCODE +
      process.env.MPESA_PASSKEY +
      timestamp
    ).toString("base64");

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: 15000,
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: "TravelVisa",
        TransactionDesc: "Travel Booking"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    res.status(500).json({
      error: err.response?.data || err.message
    });
  }
});

// ================= MPESA CALLBACK =================

app.post("/mpesa/callback", (req, res) => {

  console.log(
    JSON.stringify(req.body, null, 2)
  );

  res.json({
    ResultCode: 0,
    ResultDesc: "Accepted"
  });

});

app.post("/paypal/create-order", async (req, res) => {

try{

const request = new paypal.orders.OrdersCreateRequest();

request.prefer("return=representation");

request.requestBody({
intent:"CAPTURE",
purchase_units:[
{
amount:{
currency_code:"USD",
value:"300.00"
}
}
]
});

const order = await paypalClient.execute(request);

res.json({
id:order.result.id
});

}catch(err){

console.log(err);

res.status(500).json({
error:"PayPal order creation failed"
});

}

});

app.post("/paypal/capture-order", async (req, res) => {

try{

const request = new paypal.orders.OrdersCaptureRequest(req.body.orderID);

request.requestBody({});

const capture = await paypalClient.execute(request);

res.json(capture.result);

}catch(err){

console.log(err);

res.status(500).json({
error:"PayPal capture failed"
});

}

});

// ================= SERVER =================
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
