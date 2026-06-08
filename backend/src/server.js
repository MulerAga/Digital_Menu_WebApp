require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const { initDB } = require("./config/db");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
const tenantContext = require("./middleware/tenantContext");

app.use("/api/auth", require("./routes/auth"));
app.use("/api/approvals", tenantContext, require("./routes/approvals"));
app.use("/api/branches", tenantContext, require("./routes/branches"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/orders", tenantContext, require("./routes/orders"));
app.use("/api/feedback", tenantContext, require("./routes/feedback"));
app.use("/api/restaurants", require("./routes/restaurants"));

// Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

// 404
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || "Internal server error" });
});

// Socket
require("./socket")(io);

const PORT = process.env.PORT || 5000;

initDB()
  .then(() => {
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
