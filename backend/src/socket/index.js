const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const { id, role, slug, business_slug, restaurant_slug, branch_id, branch_slug } = socket.user;
    console.log(`Socket connected: user ${id} (${role})`);

    const restaurantSlug = restaurant_slug || slug || business_slug || null;

    socket.join(`user_${id}`);

    if (restaurantSlug) {
      socket.join(`restaurant_${restaurantSlug}`);
      socket.join(`${role}_restaurant_${restaurantSlug}`);
      socket.restaurantSlug = restaurantSlug;
    }

    // Join branch-scoped room for granular event routing
    if (branch_id) {
      socket.join(`branch_${branch_id}`);
    }

    socket.on("join_order", (orderId) => {
      socket.join(`order_${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: user ${id}`);
    });
  });
};
