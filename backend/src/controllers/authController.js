const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      approvalStatus: user.approval_status,
      slug: user.slug || null,
      business_slug: user.business_slug || null,
      restaurant_slug: user.restaurant_slug || user.slug || user.business_slug || null,
      restaurant_id: user.restaurant_id || null,
      branch_id: user.branch_id || null,
      branch_slug: user.branch_slug || null,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );

const getBusinessScope = (req) =>
  req.user.business_slug || req.user.slug || null;

// Converts a business name to a URL-friendly slug, e.g. "Canoe Restaurant" → "canoe-restaurant"
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function generateUniqueUserSlug(source, excludeUserId = null) {
  const baseSlug = generateSlug(source || "");
  if (!baseSlug) return null;

  let suffix = 0;
  let slug = baseSlug;
  while (true) {
    const [conflict] = await pool.query(
      "SELECT id FROM users WHERE slug = ? AND id != ?",
      [slug, excludeUserId || 0],
    );
    if (!conflict.length) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

exports.register = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      role,
      business_name,
      slug: requestedSlug,
    } = req.body;
    if (!name || !email || !password || !phone)
      return res.status(400).json({ message: "All fields required" });

    const [existing] = await pool.query("SELECT id FROM users WHERE email=?", [
      email,
    ]);
    if (existing.length)
      return res.status(409).json({ message: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const safeRole = ["customer", "staff", "cashier", "manager"].includes(role)
      ? role
      : "customer";
    const isActive = safeRole === "customer" ? 1 : 0;

    let businessSlug = null;
    if (requestedSlug) {
      const [ownerRows] = await pool.query(
        "SELECT slug FROM users WHERE slug=? AND role='admin'",
        [requestedSlug.trim()],
      );
      if (ownerRows.length) {
        businessSlug = ownerRows[0].slug;
      }
    }

    if (safeRole !== "customer" && !businessSlug) {
      return res.status(400).json({
        message:
          "Staff, cashier, and manager accounts must be created from a restaurant registration page.",
      });
    }

    let userSlug = null;
    if (safeRole === "customer" && business_name && business_name.trim()) {
      userSlug = await generateUniqueUserSlug(business_name.trim());
    }

    const [result] = await pool.query(
      "INSERT INTO users (name, email, phone, password, role, business_name, slug, business_slug, is_active) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        name,
        email,
        phone,
        hash,
        safeRole,
        business_name || null,
        userSlug,
        businessSlug,
        isActive,
      ],
    );

    const user = {
      id: result.insertId,
      name,
      phone,
      email,
      role: safeRole,
      business_name: business_name || null,
      slug: userSlug,
      business_slug: businessSlug,
    };

    if (isActive) {
      return res.status(201).json({ token: signToken(user), user });
    }

    return res.status(201).json({
      user,
      message:
        "Account created and pending admin approval. You will be able to log in once approved.",
      pending: true,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // 1. Find user
    const [rows] = await pool.query("SELECT * FROM users WHERE email=?", [
      email,
    ]);

    if (!rows.length)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];

    // 2. Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // 3. Check account is active
    if (user.is_active === 0 || user.is_active === false)
      return res.status(403).json({
        message:
          "Account is deactivated. Please contact customer support or complete your payment!",
      });

    // 4. Check active subscription
    const [subs] = await pool.query(
      `SELECT * FROM subscriptions
       WHERE user_id=?
       AND status='active'
       AND end_date > NOW()
       LIMIT 1`,
      [user.id],
    );

    const hasSubscription = subs.length > 0;

    const { password: _, ...safeUser } = user;

    res.json({
      token: signToken(safeUser),
      user: safeUser,
      subscriptionActive: hasSubscription,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.requested_role, u.approval_status,
              u.restaurant_id, u.business_name, u.slug, u.business_slug, u.branch_id,
              u.created_at,
              b.branch_slug, b.branch_name, b.is_main_branch,
              r.slug AS restaurant_slug
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN restaurants r ON r.id = u.restaurant_id OR (u.role = 'admin' AND r.admin_id = u.id) OR (r.slug = u.business_slug)
       WHERE u.id=?`,
      [req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { business_name } = req.body;
    if (!business_name || !business_name.trim())
      return res.status(400).json({ message: "business_name is required" });

    //role based access

    const [targetRows] = await pool.query("SELECT role FROM users WHERE id=?", [
      req.params.id,
    ]);

    if (!targetRows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetRole = targetRows[0].role;

    // Managers cannot manage staff/managers/admins
    if (
      req.user.role === "manager" &&
      ["staff", "manager", "admin"].includes(targetRole)
    ) {
      return res.status(403).json({
        message: "Managers cannot manage staff members",
      });
    }

    // Generate new slug from business_name
    const baseSlug = business_name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    const [conflict] = await pool.query(
      "SELECT id FROM users WHERE slug=? AND id != ?",
      [baseSlug, req.user.id],
    );
    const slug = conflict.length ? `${baseSlug}-${req.user.id}` : baseSlug;

    await pool.query("UPDATE users SET business_name=?, slug=? WHERE id=?", [
      business_name.trim(),
      slug,
      req.user.id,
    ]);

    const [rows] = await pool.query(
      "SELECT id, name, email, phone, role, business_name, slug, created_at FROM users WHERE id=?",
      [req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const isSameBusinessUser = async (req, userId) => {
  const businessScope = getBusinessScope(req);
  if (!businessScope) return true;

  const [rows] = await pool.query(
    "SELECT role FROM users WHERE id=? AND (business_slug=? OR slug=?)",
    [userId, businessScope, businessScope],
  );
  if (!rows.length) return false;
  if (rows[0].role === "admin" && req.user.role !== "admin") return false;
  return true;
};

exports.getUsers = async (req, res) => {
  try {
    const businessScope = getBusinessScope(req);
    const query = businessScope
      ? "SELECT id, name, email, phone, role, is_active, created_at FROM users WHERE (business_slug = ? OR slug = ? OR id = ?) ORDER BY created_at DESC"
      : "SELECT id, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC";
    const params = businessScope
      ? [businessScope, businessScope, req.user.id]
      : [];
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    if (!(await isSameBusinessUser(req, req.params.id))) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const { role } = req.body;
    if (!["admin", "manager", "staff", "cashier", "customer"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    // Enforce manager role restrictions: cannot create/assign admin accounts
    if (req.user.role === "manager" && role === "admin") {
      return res
        .status(403)
        .json({ message: "Managers cannot create admin accounts" });
    }

    await pool.query("UPDATE users SET role=? WHERE id=?", [
      role,
      req.params.id,
    ]);
    res.json({ message: "Role updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.toggleUserActive = async (req, res) => {
  try {
    if (!(await isSameBusinessUser(req, req.params.id))) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const [rows] = await pool.query("SELECT is_active FROM users WHERE id=?", [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "User not found" });
    const newState = rows[0].is_active ? 0 : 1;
    await pool.query("UPDATE users SET is_active=? WHERE id=?", [
      newState,
      req.params.id,
    ]);
    res.json({
      message: newState ? "User activated" : "User deactivated",
      is_active: newState,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!(await isSameBusinessUser(req, req.params.id))) {
      return res.status(403).json({ message: "Not allowed" });
    }
    await pool.query("DELETE FROM users WHERE id=?", [req.params.id]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Register a new staff member
 * Requires: name, email, password, phone, businessName (or restaurantId), requested_role
 * Sets approval_status to 'pending' by default
 */
exports.registerStaff = async (req, res) => {
  try {
    const { name, email, password, phone, businessName, requestedRole, slug } =
      req.body;

    // Validation
    if (
      !name ||
      !email ||
      !password ||
      !phone ||
      !businessName ||
      !requestedRole
    ) {
      return res.status(400).json({
        message:
          "All fields are required: name, email, password, phone, businessName, requestedRole",
      });
    }

    // Validate role
    if (!["admin", "manager", "cashier", "staff"].includes(requestedRole)) {
      return res.status(400).json({ message: "Invalid requested role" });
    }

    // Check if email already exists
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    if (existing.length) {
      return res.status(409).json({ message: "Email already registered" });
    }

    let businessSlug = null;
    let restaurantId = null;

    // 1. If slug is provided, resolve from restaurants table
    if (slug) {
      const [restRows] = await pool.query(
        "SELECT id, slug FROM restaurants WHERE slug = ? LIMIT 1",
        [slug.toLowerCase().trim()]
      );
      if (restRows.length) {
        restaurantId = restRows[0].id;
        businessSlug = restRows[0].slug;
      }
    }

    // 2. If not resolved, fall back to businessName
    if (!restaurantId) {
      const searchName = businessName.trim().toLowerCase();
      // Check restaurants table first
      const [restRows] = await pool.query(
        "SELECT id, slug FROM restaurants WHERE LOWER(restaurant_name) = ? LIMIT 1",
        [searchName]
      );
      if (restRows.length) {
        restaurantId = restRows[0].id;
        businessSlug = restRows[0].slug;
      } else {
        // Fall back to legacy users table lookup
        const [business] = await pool.query(
          `SELECT id, slug
           FROM users
           WHERE role = 'admin'
           AND LOWER(business_name) = ?
           LIMIT 1`,
          [searchName],
        );
        if (!business.length) {
          return res.status(404).json({ message: "Restaurant not found" });
        }
        businessSlug = business[0].slug;
        // Retrieve restaurant_id if possible
        const [rRows] = await pool.query(
          "SELECT id FROM restaurants WHERE admin_id = ? LIMIT 1",
          [business[0].id]
        );
        if (rRows.length) {
          restaurantId = rRows[0].id;
        }
      }
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Insert new user with pending approval status and restaurant_id
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, phone, restaurant_id, business_slug, requested_role, role, approval_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', 0)`,
      [name, email, hash, phone, restaurantId, businessSlug, requestedRole],
    );

    const newUser = {
      id: result.insertId,
      name,
      email,
      phone,
      businessName,
      restaurantId,
      businessSlug,
      requestedRole,
      role: null,
      approvalStatus: "pending",
    };

    res.status(201).json({
      user: newUser,
      message:
        "Your account is waiting for approval from the restaurant administrator.",
      pending: true,
    });
  } catch (err) {
    console.error("Error registering staff:", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to register staff member" });
  }
};

/**
 * Enhanced login that checks approval status and validates restaurant slug.
 * Expects optional `slug` in request body — the restaurant slug from the URL.
 */
exports.loginWithApprovalCheck = async (req, res) => {
  try {
    const { email, password, slug: requestSlug } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Find user
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // --- Restaurant slug validation ---
    // Resolve the canonical restaurant ID and slug for this user
    let restaurantId = user.restaurant_id || null;
    let userRestaurantSlug = null;

    if (user.role === "admin") {
      const [restRows] = await pool.query(
        "SELECT id, slug FROM restaurants WHERE admin_id = ? LIMIT 1",
        [user.id]
      );
      if (restRows.length) {
        restaurantId = restRows[0].id;
        userRestaurantSlug = restRows[0].slug;
      }
    } else if (restaurantId) {
      const [restRows] = await pool.query(
        "SELECT slug FROM restaurants WHERE id = ? LIMIT 1",
        [restaurantId]
      );
      if (restRows.length) {
        userRestaurantSlug = restRows[0].slug;
      }
    }

    // Fallback to legacy fields if not yet resolved
    if (!userRestaurantSlug) {
      userRestaurantSlug = user.business_slug || user.slug || null;
    }

    if (requestSlug) {
      if (!userRestaurantSlug || requestSlug.toLowerCase() !== userRestaurantSlug.toLowerCase()) {
        return res.status(403).json({
          message: "You do not belong to this restaurant.",
        });
      }
    }

    // Inject canonical fields so signToken can embed them in the JWT, and they are returned to client
    user.restaurant_id = restaurantId;
    user.restaurant_slug = userRestaurantSlug;

    // Check approval status for staff members
    if (["staff", "cashier", "manager"].includes(user.requested_role)) {
      if (user.approval_status === "pending") {
        return res.status(403).json({
          message:
            "Your account is waiting for approval from the restaurant administrator.",
          approvalStatus: "pending",
          userId: user.id,
        });
      }

      if (user.approval_status === "rejected") {
        return res.status(403).json({
          message:
            "Your registration was rejected. Please contact the restaurant administrator.",
          approvalStatus: "rejected",
          userId: user.id,
        });
      }
    }

    // Ensure role is set for approved staff members
    if (
      (!user.role || user.role === null) &&
      user.approval_status === "approved" &&
      ["staff", "cashier", "manager"].includes(user.requested_role)
    ) {
      user.role = user.requested_role;
      await pool.query("UPDATE users SET role = ? WHERE id = ?", [
        user.role,
        user.id,
      ]);
    }

    // Check account is active
    if (user.is_active === 0 || user.is_active === false) {
      return res.status(403).json({
        message: "Account is deactivated. Please contact customer support.",
      });
    }

    // Fetch branch info so it can be embedded in the JWT
    let branchSlug = null;
    if (user.branch_id) {
      const [branchRows] = await pool.query(
        "SELECT branch_slug, is_main_branch FROM branches WHERE id = ?",
        [user.branch_id],
      );
      if (branchRows.length) {
        branchSlug = branchRows[0].is_main_branch
          ? null
          : branchRows[0].branch_slug;
        user.branch_slug = branchSlug;
      }
    }

    const { password: _, ...safeUser } = user;

    res.json({
      token: signToken(safeUser),
      user: safeUser,
    });
  } catch (err) {
    console.error("Error in login:", err);
    res.status(500).json({ message: err.message || "Login failed" });
  }
};
