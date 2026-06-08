const { pool } = require("../config/db");

async function getActiveSubscription(userId) {
  const [rows] = await pool.query(
    `SELECT s.id AS subscription_id, s.user_id, s.plan_name, sp.branch_limit
     FROM subscriptions s
     JOIN subscription_plans sp ON sp.name = s.plan_name
     WHERE s.user_id = ?
       AND s.status = 'active'
       AND (s.end_date IS NULL OR s.end_date > NOW())
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function getSubscriptionDetails(userId) {
  const subscription = await getActiveSubscription(userId);
  if (!subscription) {
    throw new Error(`Active subscription not found for user ${userId}`);
  }

  const branchLimit =
    subscription.branch_limit === null || subscription.branch_limit === -1
      ? null
      : Number(subscription.branch_limit);

  console.info("Subscription details for admin:", {
    userId,
    subscriptionId: subscription.subscription_id,
    planName: subscription.plan_name,
    branchLimit,
  });

  return {
    subscriptionId: subscription.subscription_id,
    planName: subscription.plan_name,
    branchLimit,
  };
}

// Subscription plan → max total branches (main + additional)
const PLAN_LIMITS = {
  basic: 1,
  advanced: 5,
  premium: Infinity,
};

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

// Resolve restaurant_id for the calling admin
async function getRestaurantId(adminId) {
  const [rows] = await pool.query(
    "SELECT id, subscription_plan FROM restaurants WHERE admin_id = ? LIMIT 1",
    [adminId],
  );
  if (rows.length) return rows[0];

  // If the admin has no restaurant row yet, create a default restaurant record
  const [userRows] = await pool.query(
    "SELECT name, business_name, slug, restaurant_id FROM users WHERE id = ? LIMIT 1",
    [adminId],
  );
  if (!userRows.length) throw new Error("Admin user not found");

  const user = userRows[0];
  const restaurantName = user.business_name || user.name || "My Restaurant";

  let generatedSlug = user.slug;
  if (!user.slug || !user.slug.trim()) {
    const baseSlug = slugify(restaurantName) || `restaurant`;
    let suffix = 0;
    generatedSlug = baseSlug;
    while (true) {
      const [conflict] = await pool.query(
        "SELECT id FROM users WHERE slug = ? AND id != ?",
        [generatedSlug, adminId],
      );
      if (!conflict.length) break;
      suffix += 1;
      generatedSlug = `${baseSlug}-${suffix}`;
    }
    await pool.query("UPDATE users SET slug=? WHERE id = ?", [
      generatedSlug,
      adminId,
    ]);
    console.info(`Auto-generated slug for admin ${adminId}: ${generatedSlug}`);
  }

  const [result] = await pool.query(
    `INSERT INTO restaurants (restaurant_name, admin_id, slug, subscription_plan, subscription_status)
     VALUES (?, ?, ?, 'basic', 'active')`,
    [restaurantName, adminId, generatedSlug],
  );

  const restaurantId = result.insertId;

  // Create a main branch for the new restaurant.
  const [branchResult] = await pool.query(
    `INSERT INTO branches (restaurant_id, branch_name, branch_slug, is_main_branch)
     VALUES (?, ?, NULL, 1)`,
    [restaurantId, restaurantName],
  );
  const mainBranchId = branchResult.insertId;

  await pool.query(
    "UPDATE users SET restaurant_id = COALESCE(restaurant_id, ?), branch_id = COALESCE(branch_id, ?) WHERE id = ?",
    [restaurantId, mainBranchId, adminId],
  );

  console.info(
    `Auto-created restaurant ${restaurantId} and main branch ${mainBranchId} for admin ${adminId}`,
  );
  return { id: restaurantId, subscription_plan: "basic" };
}

// GET /api/branches  — list all branches for the current restaurant
exports.listBranches = async (req, res) => {
  try {
    const adminId =
      req.user.role === "admin"
        ? req.user.id
        : await resolveAdminId(req.user.business_slug);

    const { id: restaurantId } = await getRestaurantId(adminId);

    const [branches] = await pool.query(
      `SELECT b.*, 
        (SELECT COUNT(*) FROM orders o WHERE o.branch_id = b.id) AS order_count,
        (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id AND u.role IN ('staff','cashier','manager')) AS staff_count
       FROM branches b
       WHERE b.restaurant_id = ?
       ORDER BY b.is_main_branch DESC, b.created_at ASC`,
      [restaurantId],
    );
    res.json(branches);
  } catch (err) {
    console.error("branchController.listBranches error:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/branches/public/:restaurantSlug  — public list (for menu routing)
exports.listPublicBranches = async (req, res) => {
  try {
    const { restaurantSlug } = req.params;
    const [restRows] = await pool.query(
      "SELECT id FROM restaurants WHERE slug = ? LIMIT 1",
      [restaurantSlug],
    );
    if (!restRows.length) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    const restaurantId = restRows[0].id;
    const [branches] = await pool.query(
      `SELECT id, branch_name, branch_slug, is_main_branch, address, phone
       FROM branches
       WHERE restaurant_id = ?
       ORDER BY is_main_branch DESC, created_at ASC`,
      [restaurantId],
    );

    res.json(branches);
  } catch (err) {
    console.error("listPublicBranches error:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/branches/:id
exports.getBranch = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM branches WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "Branch not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/branches  — create a new branch (admin only)
exports.createBranch = async (req, res) => {
  try {
    const { branch_name, address, phone } = req.body;
    if (!branch_name)
      return res.status(400).json({ message: "branch_name is required" });

    const { id: restaurantId } = await getRestaurantId(req.user.id);
    const { planName, branchLimit } = await getSubscriptionDetails(req.user.id);

    // Count existing branches
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM branches WHERE restaurant_id = ?",
      [restaurantId],
    );

    console.info("Branch creation subscription check:", {
      userId: req.user.id,
      planName,
      branchLimit,
      branchCount: total,
    });

    if (branchLimit !== null && total >= branchLimit) {
      return res.status(403).json({
        message: `Your ${planName} plan allows a maximum of ${branchLimit} branch${branchLimit === 1 ? "" : "es"}. Upgrade to add more.`,
        limit: branchLimit,
        current: total,
        plan: planName,
      });
    }

    // Generate unique branch_slug within this restaurant
    const base = slugify(branch_name);
    const [conflict] = await pool.query(
      "SELECT id FROM branches WHERE restaurant_id = ? AND branch_slug = ?",
      [restaurantId, base],
    );
    const branch_slug = conflict.length ? `${base}-${Date.now()}` : base;

    const [result] = await pool.query(
      `INSERT INTO branches (restaurant_id, branch_name, branch_slug, address, phone, is_main_branch)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [restaurantId, branch_name, branch_slug, address || null, phone || null],
    );

    const [newBranch] = await pool.query(
      "SELECT * FROM branches WHERE id = ?",
      [result.insertId],
    );
    res.status(201).json(newBranch[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/branches/:id  — update branch details
exports.updateBranch = async (req, res) => {
  try {
    const { branch_name, address, phone } = req.body;
    const { id: restaurantId } = await getRestaurantId(req.user.id);

    const [existing] = await pool.query(
      "SELECT * FROM branches WHERE id = ? AND restaurant_id = ?",
      [req.params.id, restaurantId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Branch not found" });

    await pool.query(
      "UPDATE branches SET branch_name = ?, address = ?, phone = ? WHERE id = ?",
      [
        branch_name || existing[0].branch_name,
        address ?? existing[0].address,
        phone ?? existing[0].phone,
        req.params.id,
      ],
    );

    const [updated] = await pool.query("SELECT * FROM branches WHERE id = ?", [
      req.params.id,
    ]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/branches/:id  — delete a non-main branch
exports.deleteBranch = async (req, res) => {
  try {
    const { id: restaurantId } = await getRestaurantId(req.user.id);

    const [existing] = await pool.query(
      "SELECT * FROM branches WHERE id = ? AND restaurant_id = ?",
      [req.params.id, restaurantId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Branch not found" });
    if (existing[0].is_main_branch)
      return res.status(400).json({ message: "Cannot delete the main branch" });

    await pool.query("DELETE FROM branches WHERE id = ?", [req.params.id]);
    res.json({ message: "Branch deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/branches/:id/users  — list users assigned to a branch
exports.getBranchUsers = async (req, res) => {
  try {
    const { id: restaurantId } = await getRestaurantId(req.user.id);

    // Verify branch belongs to this restaurant
    const [branch] = await pool.query(
      "SELECT id FROM branches WHERE id = ? AND restaurant_id = ?",
      [req.params.id, restaurantId],
    );
    if (!branch.length)
      return res.status(404).json({ message: "Branch not found" });

    const [users] = await pool.query(
      `SELECT id, name, email, phone, role, is_active, branch_id, created_at
       FROM users WHERE branch_id = ? AND role IN ('staff','cashier','manager')
       ORDER BY created_at DESC`,
      [req.params.id],
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/branches/users/:userId/assign  — assign user to a branch
exports.assignUserToBranch = async (req, res) => {
  try {
    const { branch_id } = req.body;
    const { id: restaurantId } = await getRestaurantId(req.user.id);

    // Verify branch belongs to this restaurant
    const [branch] = await pool.query(
      "SELECT id FROM branches WHERE id = ? AND restaurant_id = ?",
      [branch_id, restaurantId],
    );
    if (!branch.length)
      return res.status(404).json({ message: "Branch not found" });

    await pool.query("UPDATE users SET branch_id = ? WHERE id = ?", [
      branch_id,
      req.params.userId,
    ]);
    res.json({ message: "User assigned to branch" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/branches/subscription/limits  — return plan limits for the current restaurant
exports.getSubscriptionLimits = async (req, res) => {
  try {
    const { id: restaurantId } = await getRestaurantId(req.user.id);
    const { planName, branchLimit } = await getSubscriptionDetails(req.user.id);
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM branches WHERE restaurant_id = ?",
      [restaurantId],
    );

    console.info("Subscription limits fetched:", {
      userId: req.user.id,
      planName,
      branchLimit,
      branchCount: total,
    });
    res.json({
      plan: planName,
      max_branches: branchLimit === null ? null : branchLimit,
      current_branches: total,
      can_add: branchLimit === null || total < branchLimit,
    });
  } catch (err) {
    console.error("branchController.getSubscriptionLimits error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Helper used by other controllers
async function resolveAdminId(businessSlug) {
  const [rows] = await pool.query(
    "SELECT admin_id FROM restaurants WHERE slug = ? LIMIT 1",
    [businessSlug],
  );
  if (!rows.length)
    throw new Error("Admin not found for slug: " + businessSlug);
  return rows[0].id;
}

exports.resolveAdminId = resolveAdminId;
exports.PLAN_LIMITS = PLAN_LIMITS;
