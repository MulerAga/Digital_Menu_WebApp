const { pool } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// Helper: emit order socket events to the right rooms
async function emitOrderEvent(io, event, order, restaurantSlug, branchId) {
  if (!io || !restaurantSlug) return;
  // Restaurant-wide rooms (admin always sees all)
  io.to(`admin_restaurant_${restaurantSlug}`).emit(event, order);
  // Branch-scoped rooms
  if (branchId) {
    io.to(`branch_${branchId}`).emit(event, order);
  } else {
    // Fallback: emit to all restaurant rooms
    io.to(`manager_restaurant_${restaurantSlug}`).emit(event, order);
    io.to(`staff_restaurant_${restaurantSlug}`).emit(event, order);
    io.to(`cashier_restaurant_${restaurantSlug}`).emit(event, order);
  }
  if (order.user_id) {
    io.to(`user_${order.user_id}`).emit(
      event === "new_order" ? "order_placed" : "order_status_changed",
      order,
    );
  }
}

exports.placeOrder = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { items: rawItems, table_number, payment_method, notes } = req.body;

    // Receipt image is uploaded as multipart via multer (not JSON body)
    const receipt_image = req.file
      ? `/uploads/receipts/${req.file.filename}`
      : null;

    // FormData sends arrays as JSON strings — parse if needed
    let items;
    try {
      items = typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems;
    } catch {
      return res.status(400).json({ message: "Invalid items format" });
    }

    if (!items || !items.length) {
      return res.status(400).json({ message: "No items in order" });
    }

    const { restaurantId, branchId, ownerId } = req.tenant;

    let total = 0;
    const enriched = [];

    for (const item of items) {
      const [rows] = await conn.query(
        "SELECT id, user_id, name, price, discount_percent, available FROM menu_items WHERE id=? AND restaurant_id=? AND branch_id=?",
        [item.menu_item_id, restaurantId, branchId],
      );

      if (!rows.length || !rows[0].available) {
        throw new Error(
          `Item ${item.menu_item_id} not available at this branch`,
        );
      }

      const menuItem = rows[0];

      const discounted =
        menuItem.price * (1 - (menuItem.discount_percent || 0) / 100);
      total += discounted * item.quantity;
      enriched.push({ ...item, name: menuItem.name, price: discounted });
    }

    const customerUserId = req.user?.id || null;
    const guestToken = customerUserId ? null : uuidv4();

    const [restSlugRows] = await conn.query(
      `SELECT slug FROM restaurants WHERE id=?`,
      [restaurantId],
    );
    const restaurantSlug = restSlugRows[0]?.slug || null;

    const [orderResult] = await conn.query(
      `INSERT INTO orders (owner_id, restaurant_id, branch_id, user_id, guest_token, restaurant_slug, table_number, payment_method, total, notes, receipt_image) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ownerId,
        restaurantId,
        branchId,
        customerUserId,
        guestToken,
        restaurantSlug,
        table_number || null,
        payment_method || "cash",
        total.toFixed(2),
        notes || null,
        receipt_image || null,
      ],
    );

    const orderId = orderResult.insertId;

    for (const item of enriched) {
      await conn.query(
        "INSERT INTO order_items (order_id, menu_item_id, name, quantity, price) VALUES (?,?,?,?,?)",
        [orderId, item.menu_item_id, item.name, item.quantity, item.price],
      );
    }

    await conn.commit();

    const [order] = await conn.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o LEFT JOIN users u ON o.user_id=u.id WHERE o.id=?`,
      [orderId],
    );

    const [orderItems] = await conn.query(
      "SELECT * FROM order_items WHERE order_id=?",
      [orderId],
    );

    const fullOrder = { ...order[0], items: orderItems };

    const io = req.app.get("io");

    if (io && ownerId && restaurantSlug) {
      // 1. Branch-specific new order
      if (branchId) {
        io.to(`branch_${branchId}`).emit("new_order", fullOrder);
      }

      // 2. Restaurant admin receives all orders
      io.to(`admin_restaurant_${restaurantSlug}`).emit("new_order", fullOrder);

      // 3. Cash orders
      if ((payment_method || "cash") === "cash") {
        if (branchId) {
          io.to(`branch_${branchId}`).emit("new_cash_order", fullOrder);
        }

        // Admin receives all cash orders
        io.to(`admin_restaurant_${restaurantSlug}`).emit(
          "new_cash_order",
          fullOrder,
        );
      }

      // 4. Customer receives confirmation
      if (customerUserId) {
        io.to(`user_${customerUserId}`).emit("order_placed", fullOrder);
      }
    }

    res.status(201).json(fullOrder);
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const { status, user_id, period, payment_method, date, branch_slug } =
      req.query;

    // Resolve which branch to filter by
    let effectiveBranchId = null;

    if (req.user && req.user.role === "customer") {
      // Customer: use branch_slug from query to scope their orders
      if (branch_slug) {
        const [rows] = await pool.query(
          "SELECT id FROM branches WHERE slug = ? AND restaurant_id = ?",
          [branch_slug, restaurantId],
        );
        effectiveBranchId = rows[0]?.id ?? -1; // -1 = no match, returns nothing
      }
      // else: effectiveBranchId stays null → main restaurant orders only
    } else {
      // Staff/admin: use their tenant branch context as before
      effectiveBranchId = branchId;
    }

    let sql = `
      SELECT o.*, u.name AS customer_name, u.email AS customer_email
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      WHERE o.restaurant_id = ?
    `;
    const params = [restaurantId];

    // Branch filter
    if (effectiveBranchId === null) {
      sql += " AND o.branch_id IS NULL";
    } else {
      sql += " AND o.branch_id = ?";
      params.push(effectiveBranchId);
    }

    if (status) {
      sql += " AND o.status = ?";
      params.push(status);
    }
    if (payment_method) {
      sql += " AND o.payment_method = ?";
      params.push(payment_method);
    }
    if (date) {
      sql += " AND DATE(o.created_at) = ?";
      params.push(date);
    } else if (period === "day") {
      sql += " AND DATE(o.created_at) = CURDATE()";
    } else if (period === "week") {
      sql += " AND DATE(o.created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)";
    } else if (period === "month") {
      sql += " AND DATE(o.created_at) >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)";
    }

    if (req.user && req.user.role === "customer") {
      sql += " AND o.user_id = ?";
      params.push(req.user.id);
    } else {
      if (user_id) {
        sql += " AND o.user_id = ?";
        params.push(user_id);
      }
    }

    sql += " ORDER BY o.created_at DESC";
    const [orders] = await pool.query(sql, params);

    for (const order of orders) {
      const [items] = await pool.query(
        "SELECT * FROM order_items WHERE order_id = ?",
        [order.id],
      );
      order.items = items;
    }

    res.json(orders);
  } catch (err) {
    console.error("getOrders error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [rows] = await pool.query(
      `SELECT o.*, u.name AS customer_name FROM orders o
       LEFT JOIN users u ON o.user_id=u.id 
       WHERE o.id=? AND o.restaurant_id=? AND o.branch_id=?`,
      [req.params.id, restaurantId, branchId],
    );

    if (!rows.length)
      return res.status(404).json({ message: "Order not found" });

    const order = rows[0];

    if (
      req.user &&
      req.user.role === "customer" &&
      order.user_id !== req.user.id
    )
      return res.status(403).json({ message: "Access denied" });

    const [items] = await pool.query(
      "SELECT * FROM order_items WHERE order_id=?",
      [order.id],
    );

    res.json({ ...order, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const { status } = req.body;
    const validStatuses = [
      "pending",
      "preparing",
      "served",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const role = req.user.role;
    if (role === "admin")
      return res
        .status(403)
        .json({ message: "Admins cannot update order status" });
    if (role === "staff" && ["cancelled", "completed"].includes(status))
      return res
        .status(403)
        .json({ message: "Staff cannot cancel or complete orders" });
    if (role === "cashier" && status !== "completed")
      return res
        .status(403)
        .json({ message: "Cashiers can only complete orders" });

    const [existing] = await pool.query(
      "SELECT * FROM orders WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Order not found" });

    await pool.query(
      "UPDATE orders SET status=? WHERE id=? AND restaurant_id=? AND branch_id=?",
      [status, req.params.id, restaurantId, branchId],
    );

    const [updated] = await pool.query(
      `SELECT o.*, u.name AS customer_name FROM orders o 
       LEFT JOIN users u ON o.user_id=u.id 
       WHERE o.id=? AND o.restaurant_id=? AND o.branch_id=?`,
      [req.params.id, restaurantId, branchId],
    );
    const [items] = await pool.query(
      "SELECT * FROM order_items WHERE order_id=?",
      [req.params.id],
    );
    const fullOrder = { ...updated[0], items };

    const io = req.app.get("io");
    const [adminRows] = await pool.query(
      `SELECT slug FROM restaurants WHERE id=?`,
      [restaurantId],
    );
    const restaurantSlug = adminRows[0]?.slug;
    await emitOrderEvent(
      io,
      "order_updated",
      fullOrder,
      restaurantSlug,
      branchId,
    );

    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markCashPaid = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [existing] = await pool.query(
      "SELECT * FROM orders WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Order not found" });

    await pool.query(
      "UPDATE orders SET cash_paid=1 WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    const [updated] = await pool.query(
      `SELECT o.*, u.name AS customer_name FROM orders o 
       LEFT JOIN users u ON o.user_id=u.id 
       WHERE o.id=? AND o.restaurant_id=? AND o.branch_id=?`,
      [req.params.id, restaurantId, branchId],
    );
    const [items] = await pool.query(
      "SELECT * FROM order_items WHERE order_id=?",
      [req.params.id],
    );
    const fullOrder = { ...updated[0], items };

    const io = req.app.get("io");
    const [adminRows] = await pool.query(
      `SELECT slug FROM restaurants WHERE id=?`,
      [restaurantId],
    );
    await emitOrderEvent(
      io,
      "order_updated",
      fullOrder,
      adminRows[0]?.slug,
      branchId,
    );
    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.acceptCashOrder = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [existing] = await pool.query(
      "SELECT * FROM orders WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Order not found" });
    if (existing[0].payment_method !== "cash")
      return res.status(400).json({ message: "Order is not a cash payment" });
    if (existing[0].status !== "pending")
      return res
        .status(400)
        .json({ message: "Only pending orders can be accepted" });

    await pool.query(
      "UPDATE orders SET status='preparing' WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    const [updated] = await pool.query(
      `SELECT o.*, u.name AS customer_name FROM orders o 
       LEFT JOIN users u ON o.user_id=u.id 
       WHERE o.id=? AND o.restaurant_id=? AND o.branch_id=?`,
      [req.params.id, restaurantId, branchId],
    );
    const [items] = await pool.query(
      "SELECT * FROM order_items WHERE order_id=?",
      [req.params.id],
    );
    const fullOrder = { ...updated[0], items };

    const io = req.app.get("io");
    const [adminRows] = await pool.query(
      `SELECT slug FROM restaurants WHERE id=?`,
      [restaurantId],
    );
    await emitOrderEvent(
      io,
      "order_updated",
      fullOrder,
      adminRows[0]?.slug,
      branchId,
    );
    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.completeCashOrder = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [existing] = await pool.query(
      "SELECT * FROM orders WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Order not found" });
    if (existing[0].payment_method !== "cash")
      return res.status(400).json({ message: "Order is not a cash payment" });
    if (existing[0].cash_paid !== 1)
      return res
        .status(400)
        .json({ message: "Cash must be marked as paid before completion" });
    if (!["preparing", "pending"].includes(existing[0].status))
      return res
        .status(400)
        .json({ message: "Only accepted cash orders may be completed" });

    await pool.query(
      "UPDATE orders SET status='served' WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    const [updated] = await pool.query(
      `SELECT o.*, u.name AS customer_name FROM orders o 
       LEFT JOIN users u ON o.user_id=u.id 
       WHERE o.id=? AND o.restaurant_id=? AND o.branch_id=?`,
      [req.params.id, restaurantId, branchId],
    );
    const [items] = await pool.query(
      "SELECT * FROM order_items WHERE order_id=?",
      [req.params.id],
    );
    const fullOrder = { ...updated[0], items };

    const io = req.app.get("io");
    const [adminRows] = await pool.query(
      `SELECT slug FROM restaurants WHERE id=?`,
      [restaurantId],
    );
    await emitOrderEvent(
      io,
      "order_updated",
      fullOrder,
      adminRows[0]?.slug,
      branchId,
    );
    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCashierSummary = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const { date } = req.query;
    const dateExpr = date ? "?" : "CURDATE()";

    const params = [restaurantId, branchId];
    if (date) params.push(date);

    const [[summary]] = await pool.query(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(total), 0) AS total_cash,
         SUM(CASE WHEN cash_paid=1 THEN 1 ELSE 0 END) AS paid_orders,
         COALESCE(SUM(CASE WHEN cash_paid=1 THEN total ELSE 0 END), 0) AS collected_cash
       FROM orders
       WHERE restaurant_id=? AND branch_id=?  
         AND DATE(created_at)=${dateExpr} 
         AND status != 'cancelled'`,
      params,
    );

    const [hourly] = await pool.query(
      `SELECT HOUR(created_at) AS hour, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE restaurant_id=? AND branch_id=? 
         AND DATE(created_at)=${dateExpr} 
         AND status != 'cancelled'
       GROUP BY HOUR(created_at) 
       ORDER BY hour ASC`,
      params,
    );

    res.json({ ...summary, hourly });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOrderByGuestToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { restaurantId } = req.tenant; // ← no branchId

    const [rows] = await pool.query(
      `SELECT o.*, u.name AS customer_name FROM orders o
       LEFT JOIN users u ON o.user_id=u.id
       WHERE o.guest_token=? AND o.restaurant_id=?`, // ← no branch filter
      [token, restaurantId],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Order not found" });
    const order = rows[0];
    const [items] = await pool.query(
      "SELECT * FROM order_items WHERE order_id=?",
      [order.id],
    );
    res.json({ ...order, items }); // include guest_token and branch_id
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOrderedItems = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const { period = "day", sort = "desc" } = req.query;
    const sortDir = sort === "asc" ? "ASC" : "DESC";
    const dateFilter =
      period === "week"
        ? `DATE(o.created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`
        : period === "month"
          ? `DATE(o.created_at) >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`
          : `DATE(o.created_at) = CURDATE()`;

    const [items] = await pool.query(
      `SELECT oi.name, SUM(oi.quantity) AS total_qty, SUM(oi.quantity * oi.price) AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.restaurant_id=? AND o.branch_id=? AND ${dateFilter} AND o.status != 'cancelled'
       GROUP BY oi.name
       ORDER BY total_qty ${sortDir}`,
      [restaurantId, branchId],
    );

    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;

    const [[{ total_revenue }]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total_revenue 
       FROM orders o
       WHERE o.restaurant_id=? AND o.branch_id=? AND o.status != 'cancelled'`,
      [restaurantId, branchId],
    );

    const [[{ total_orders }]] = await pool.query(
      `SELECT COUNT(*) AS total_orders 
       FROM orders o
       WHERE o.restaurant_id=? AND o.branch_id=?`,
      [restaurantId, branchId],
    );

    const [[{ today_orders }]] = await pool.query(
      `SELECT COUNT(*) AS today_orders 
       FROM orders o
       WHERE o.restaurant_id=? AND o.branch_id=? AND DATE(o.created_at)=CURDATE()`,
      [restaurantId, branchId],
    );

    const [[{ today_revenue }]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS today_revenue 
       FROM orders o
       WHERE o.restaurant_id=? AND o.branch_id=? AND DATE(o.created_at)=CURDATE() AND o.status != 'cancelled'`,
      [restaurantId, branchId],
    );

    const [statusBreakdown] = await pool.query(
      `SELECT o.status, COUNT(*) AS count 
       FROM orders o
       WHERE o.restaurant_id=? AND o.branch_id=? GROUP BY o.status`,
      [restaurantId, branchId],
    );

    const [topItems] = await pool.query(
      `SELECT oi.name, SUM(oi.quantity) AS total_qty, SUM(oi.quantity * oi.price) AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id=o.id
       WHERE o.restaurant_id=? AND o.branch_id=? AND o.status != 'cancelled'
       GROUP BY oi.name ORDER BY total_qty DESC LIMIT 5`,
      [restaurantId, branchId],
    );

    const [recentOrders] = await pool.query(
      `SELECT o.*, u.name AS customer_name 
       FROM orders o
       LEFT JOIN users u ON o.user_id=u.id
       WHERE o.restaurant_id=? AND o.branch_id=? 
       ORDER BY o.created_at DESC LIMIT 10`,
      [restaurantId, branchId],
    );

    const [dailySales] = await pool.query(
      `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS date,
               COUNT(*) AS orders,
               SUM(o.total) AS revenue
       FROM orders o
       WHERE o.restaurant_id=? AND o.branch_id=? 
         AND o.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         AND o.status != 'cancelled'
       GROUP BY DATE_FORMAT(o.created_at, '%Y-%m') 
       ORDER BY date ASC`,
      [restaurantId, branchId],
    );

    res.json({
      total_revenue,
      total_orders,
      today_orders,
      today_revenue,
      status_breakdown: statusBreakdown,
      top_items: topItems,
      recent_orders: recentOrders,
      daily_sales: dailySales,
    });
  } catch (err) {
    console.error("Analytics error:", err.message);
    res.status(500).json({ message: err.message });
  }
};
