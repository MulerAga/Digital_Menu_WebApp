const { pool } = require("../config/db");

/**
 * Get all pending staff approvals for the logged-in admin's restaurant
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    const adminSlug = req.user.slug;

    const [pendingUsers] = await pool.query(
      `SELECT id, name, email, phone, requested_role,
              approval_status, created_at
       FROM users
       WHERE business_slug = ?
       AND approval_status = 'pending'
       AND requested_role IN ('manager', 'cashier', 'staff')
       ORDER BY created_at DESC`,
      [adminSlug],
    );

    res.json(pendingUsers);
  } catch (error) {
    console.error("Error fetching pending approvals:", error);

    res.status(500).json({
      message: "Failed to fetch pending approvals",
    });
  }
};

/**
 * Get all approved staff for the restaurant
 */
exports.getApprovedStaff = async (req, res) => {
  try {
    const adminSlug = req.user.slug;

    const [approvedUsers] = await pool.query(
      `SELECT id, name, email, phone, role,
              approval_status, approved_at
       FROM users
       WHERE business_slug = ?
       AND approval_status = 'approved'
       AND role IN ('manager', 'staff', 'cashier')
       ORDER BY approved_at DESC`,
      [adminSlug],
    );

    res.json(approvedUsers);
  } catch (error) {
    console.error("Error fetching approved staff:", error);

    res.status(500).json({
      message: "Failed to fetch approved staff",
    });
  }
};

/**
 * Approve a pending staff member
 */
exports.approveStaff = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    const adminSlug = req.user.slug;

    const [users] = await pool.query(
      `SELECT id, business_slug, requested_role,
              approval_status
       FROM users
       WHERE id = ?`,
      [userId],
    );

    if (!users.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    if (user.business_slug !== adminSlug) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    if (user.approval_status !== "pending") {
      return res.status(400).json({
        message: "User is not pending approval",
      });
    }

    await pool.query(
      `UPDATE users
       SET role = requested_role,
           approval_status = 'approved',
           approved_by = ?,
           approved_at = NOW(),
           is_active = 1
       WHERE id = ?`,
      [adminId, userId],
    );

    res.json({
      message: "Staff approved successfully",
    });
  } catch (error) {
    console.error("Error approving staff:", error);

    res.status(500).json({
      message: "Failed to approve staff member",
    });
  }
};

/**
 * Reject a pending staff member
 */
exports.rejectStaff = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const adminId = req.user.id;
    const adminSlug = req.user.slug;

    const [users] = await pool.query(
      `SELECT id, business_slug, approval_status
       FROM users
       WHERE id = ?`,
      [userId],
    );

    if (!users.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    if (user.business_slug !== adminSlug) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    await pool.query(
      `UPDATE users
       SET approval_status = 'rejected',
           approved_by = ?,
           approved_at = NOW()
       WHERE id = ?`,
      [adminId, userId],
    );

    res.json({
      message: "Staff rejected",
    });
  } catch (error) {
    console.error("Error rejecting staff:", error);

    res.status(500).json({
      message: "Failed to reject staff member",
    });
  }
};

/**
 * Get approval status for a user
 */
exports.getApprovalStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.query(
      `SELECT id, approval_status, role, requested_role
       FROM users
       WHERE id = ?`,
      [userId],
    );

    if (!users.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    res.json({
      userId: user.id,
      approvalStatus: user.approval_status,
      role: user.role,
      requestedRole: user.requested_role,
    });
  } catch (error) {
    console.error("Error fetching approval status:", error);
    res.status(500).json({ message: "Failed to fetch approval status" });
  }
};
