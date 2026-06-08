const jwt = require("jsonwebtoken");

/**
 * Authenticate user - verifies JWT token
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Optional authentication - sets req.user if valid token, but doesn't block
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // invalid token — treat as unauthenticated
    }
  }
  next();
};

/**
 * Authorize based on roles - checks if user's role is in the allowed list
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied",
        requiredRoles: roles,
        userRole: req.user.role,
      });
    }
    next();
  };

/**
 * Authorize only admin role
 */
const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

/**
 * Authorize admin and manager roles
 */
const authorizeManagerOrAdmin = (req, res, next) => {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ message: "Manager or Admin access only" });
  }
  next();
};

/**
 * Authorize any staff-level role (admin, manager, staff, cashier)
 */
const authorizeStaff = (req, res, next) => {
  if (!["admin", "manager", "staff", "cashier"].includes(req.user.role)) {
    return res.status(403).json({ message: "Staff access denied" });
  }
  next();
};

/**
 * Validates that the authenticated user belongs to the restaurant identified
 * by the x-restaurant-slug request header.
 */
const requireSlugMatch = (req, res, next) => {
  const headerSlug = req.headers["x-restaurant-slug"];
  if (!headerSlug) return next();

  const userRestaurantSlug =
    req.user?.restaurant_slug || req.user?.slug || req.user?.business_slug;
  if (!userRestaurantSlug) {
    return res
      .status(403)
      .json({ message: "You do not belong to this restaurant." });
  }

  if (headerSlug.toLowerCase() !== userRestaurantSlug.toLowerCase()) {
    return res
      .status(403)
      .json({ message: "You do not belong to this restaurant." });
  }

  next();
};

/**
 * Check if user is approved (approval_status === 'approved')
 */
const requireApproval = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user.approvalStatus !== "approved") {
    return res.status(403).json({
      message:
        "Your account is not yet approved. Please wait for administrator approval.",
      approvalStatus: req.user.approvalStatus,
    });
  }
  next();
};

/**
 * Ensure user is either customer or approved staff
 */
const checkApprovalStatus = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  req.approvalStatus = req.user.approvalStatus;
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  authorizeAdmin,
  authorizeManagerOrAdmin,
  authorizeStaff,
  requireApproval,
  checkApprovalStatus,
  requireSlugMatch,
  requireBranchMatch: require("./auth").requireBranchMatch,
};
