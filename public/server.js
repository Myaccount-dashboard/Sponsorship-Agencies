const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

// DATABASE
mongoose.connect(
  "mongodb+srv://travel-agency:Signals09$09@cluster0.fopru6q.mongodb.net/?appName=Cluster0"
)
.then(() => console.log("Database connected"))
.catch(err => console.log(err));

// MODELS
const Application = mongoose.model("Application", {
  name: String,
  email: String,
  destination: String,
  budget: String,
  status: { type: String, default: "pending" }
});

const Admin = mongoose.model("Admin", {
  username: String,
  password: String
});

// ADMIN SETUP
app.post("/admin/setup", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);

  const admin = new Admin({
    username: req.body.username,
    password: hash
  });

  await admin.save();
  res.json({ message: "Admin created" });
});

// LOGIN
app.post("/admin/login", async (req, res) => {
  const admin = await Admin.findOne({ username: req.body.username });

  if (!admin) return res.status(400).json({ message: "Invalid username" });

  const ok = await bcrypt.compare(req.body.password, admin.password);
  if (!ok) return res.status(400).json({ message: "Invalid password" });

  const token = jwt.sign(
    { id: admin._id },
    "SECRET123",
    { expiresIn: "1d" }
  );

  res.json({ token });
});

// AUTH MIDDLEWARE
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

// APPLY (PUBLIC)
app.post("/apply", async (req, res) => {

  const appData = new Application(req.body);

  await appData.save();

  res.json({
    message: "Application submitted",
    id: appData._id
  });

});

// GET ALL APPLICATIONS
app.get("/applications", async (req, res) => {
  const data = await Application.find();
  res.json(data);
});

// ADMIN DASHBOARD
app.get("/admin/applications", auth, async (req, res) => {
  const data = await Application.find();
  res.json(data);
});

// APPROVE
app.patch("/admin/approve/:id", auth, async (req, res) => {
  const updated = await Application.findByIdAndUpdate(
    req.params.id,
    { status: "approved" },
    { new: true }
  );
  res.json(updated);
});

// REJECT
app.patch("/admin/reject/:id", auth, async (req, res) => {
  const updated = await Application.findByIdAndUpdate(
    req.params.id,
    { status: "rejected" },
    { new: true }
  );
  res.json(updated);
});

// SERVER
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
