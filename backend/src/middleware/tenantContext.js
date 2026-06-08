const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

module.exports = async (req, res, next) => {
  try {
    // 1. Decode token if not already decoded
    if (!req.user && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      const token = req.headers.authorization.split(" ")[1];
      try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        // Invalid token - treat as unauthenticated guest/customer
      }
    }

    let restaurantId = null;
    let ownerId = null;
    let role = req.user ? req.user.role : "customer";

    // 2. Resolve restaurantId and ownerId
    if (req.user) {
      if (req.user.role === "admin") {
        const [rows] = await pool.query(
          "SELECT id, admin_id FROM restaurants WHERE admin_id = ? LIMIT 1",
          [req.user.id]
        );
        if (rows.length) {
          restaurantId = rows[0].id;
          ownerId = rows[0].admin_id;
        }
      } else if (req.user.restaurant_id) {
        restaurantId = req.user.restaurant_id;
        const [rows] = await pool.query(
          "SELECT admin_id FROM restaurants WHERE id = ? LIMIT 1",
          [restaurantId]
        );
        if (rows.length) {
          ownerId = rows[0].admin_id;
        }
      }
    }

    // If still not resolved (or user is customer / guest / unauthenticated), resolve by slug
    if (!restaurantId) {
      const slug = req.headers["x-restaurant-slug"] || req.params.slug || req.query.slug || req.body.restaurant_slug || req.body.slug;
      if (slug) {
        const [rows] = await pool.query(
          "SELECT id, admin_id FROM restaurants WHERE slug = ? LIMIT 1",
          [slug]
        );
        if (rows.length) {
          restaurantId = rows[0].id;
          ownerId = rows[0].admin_id;
        }
      }
    }

    // Reject if restaurant context cannot be resolved
    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant context is required" });
    }

    // 3. Resolve branchId
    let branchId = null;

    // A. From URL/query/body branch slug or x-branch-slug header
    const branchSlug = req.headers["x-branch-slug"] || req.params.branchSlug || req.query.branch || req.body.branch_slug;
    if (branchSlug && branchSlug !== "main") {
      const [rows] = await pool.query(
        "SELECT id FROM branches WHERE restaurant_id = ? AND branch_slug = ? LIMIT 1",
        [restaurantId, branchSlug]
      );
      if (rows.length) {
        branchId = rows[0].id;
      }
    }

    // B. From x-branch-id header
    if (!branchId) {
      const headerBranchId = req.headers["x-branch-id"];
      if (headerBranchId) {
        const parsedId = parseInt(headerBranchId, 10);
        if (!isNaN(parsedId)) {
          const [rows] = await pool.query(
            "SELECT id FROM branches WHERE id = ? AND restaurant_id = ? LIMIT 1",
            [parsedId, restaurantId]
          );
          if (rows.length) {
            branchId = rows[0].id;
          }
        }
      }
    }

    // C. From user.branch_id (for staff/cashiers who don't have URL context)
    if (!branchId && req.user && req.user.branch_id) {
      const [rows] = await pool.query(
        "SELECT id FROM branches WHERE id = ? AND restaurant_id = ? LIMIT 1",
        [req.user.branch_id, restaurantId]
      );
      if (rows.length) {
        branchId = rows[0].id;
      }
    }

    // D. Main branch fallback (only if no specific branch slug/ID is found)
    if (!branchId) {
      const [rows] = await pool.query(
        "SELECT id FROM branches WHERE restaurant_id = ? AND is_main_branch = 1 LIMIT 1",
        [restaurantId]
      );
      if (rows.length) {
        branchId = rows[0].id;
      }
    }

    // Reject if branchId is missing
    if (!branchId) {
      return res.status(400).json({ message: "Branch context is required" });
    }

    // Attach to req.tenant
    req.tenant = {
      restaurantId,
      branchId,
      ownerId,
      role
    };

    next();
  } catch (err) {
    next(err);
  }
};
