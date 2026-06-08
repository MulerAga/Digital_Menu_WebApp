const { pool } = require("../config/db");

// POST /api/orders/:id/feedback
// Authenticated users or guests (via guest_token in body) can submit feedback
exports.submitFeedback = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { rating, comment, guest_token } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    // Fetch the order
    const { restaurantId, branchId } = req.tenant;
    const [rows] = await pool.query(
      "SELECT * FROM orders WHERE id=? AND restaurant_id=? AND branch_id=?",
      [orderId, restaurantId, branchId],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Order not found" });
    const order = rows[0];

    // Authorization: must be the order owner (user or guest)
    if (req.user) {
      if (req.user.role === "customer" && order.user_id !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else {
      // Guest: validate guest_token
      if (!guest_token || order.guest_token !== guest_token) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Only allow feedback on served/completed orders
    if (!["served", "completed"].includes(order.status)) {
      return res
        .status(400)
        .json({ message: "Feedback can only be submitted for served orders" });
    }

    // Upsert feedback (one per order)
    const [existing] = await pool.query(
      "SELECT id FROM order_feedback WHERE order_id=?",
      [orderId],
    );
    if (existing.length) {
      await pool.query(
        "UPDATE order_feedback SET rating=?, comment=? WHERE order_id=?",
        [rating, comment || null, orderId],
      );
    } else {
      await pool.query(
        "INSERT INTO order_feedback (order_id, user_id, guest_token, rating, comment) VALUES (?,?,?,?,?)",
        [
          orderId,
          req.user?.id || null,
          guest_token || null,
          rating,
          comment || null,
        ],
      );
    }

    const [feedback] = await pool.query(
      "SELECT * FROM order_feedback WHERE order_id=?",
      [orderId],
    );

    // Notify staff and admin via socket
    const io = req.app.get("io");
    if (io) {
      const payload = { ...feedback[0], order_id: Number(orderId) };
      io.to("staff").emit("new_feedback", payload);
      io.to("admin").emit("new_feedback", payload);
    }

    res.status(existing.length ? 200 : 201).json(feedback[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/orders/:id/feedback
// GET /api/orders/:id/feedback
exports.getFeedback = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { restaurantId, branchId } = req.tenant;

    const [rows] = await pool.query(
      `SELECT f.* FROM order_feedback f
       JOIN orders o ON f.order_id = o.id
       WHERE f.order_id = ? AND o.restaurant_id = ? AND o.branch_id = ?`,
      [orderId, restaurantId, branchId],
    );
    if (!rows.length)
      return res.status(404).json({ message: "No feedback found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/feedback  — admin/staff: list all feedback with order info, scoped to their restaurant
exports.getAllFeedback = async (req, res) => {
  try {
    // Resolve the canonical admin (owner) for this restaurant
    let ownerAdminId;
    if (req.user.role === "admin") {
      ownerAdminId = req.user.id;
    } else if (req.user.restaurant_id) {
      const [rows] = await pool.query(
        `SELECT admin_id FROM restaurants WHERE id=?`,
        [req.user.restaurant_id],
      );
      if (rows.length) ownerAdminId = rows[0].admin_id;
    }

    let sql = `
      SELECT f.*, o.table_number, o.total, o.created_at AS order_date,
             u.name AS customer_name
      FROM order_feedback f
      JOIN orders o ON f.order_id = o.id
      LEFT JOIN users u ON f.user_id = u.id
    `;
    const params = [];
    const { restaurantId, branchId } = req.tenant;

    if (ownerAdminId) {
      sql += `
  WHERE o.owner_id = ?
  AND o.restaurant_id = ?
  AND o.branch_id = ?
`;

      params.push(ownerAdminId, restaurantId, branchId);
    }

    sql += " ORDER BY f.created_at DESC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
