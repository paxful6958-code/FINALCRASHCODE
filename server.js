const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Mount Payhero routes
const payheroRoutes = require("./routes/payhero");
app.use("/api/payhero", payheroRoutes);

// Mount Auth and Admin routes (database persistence & management)
const authAdminRoutes = require("./routes/authAdmin");
app.use("/", authAdminRoutes);

// Serve homepage (Login / Registration)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve Admin Login Portal
app.get("/admin-login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

// Serve Admin Dashboard Panel
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

// Serve the M-Pesa deposit page directly at /mpesa
app.get("/mpesa", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "mpesa.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});