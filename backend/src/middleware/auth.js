const jwt = require("jsonwebtoken");

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

// Sets req.user if a valid token is present, but never blocks the request.
// Used on public routes that should also work when an admin is browsing.
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      /* invalid token — treat as unauthenticated */
    }
  }
  next();
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };

// Shorthand: any authenticated staff-level role (admin, manager, staff, cashier)
const authorizeStaff = (req, res, next) => {
  if (!["admin", "manager", "staff", "cashier"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

/**
 * Validates that the authenticated user belongs to the restaurant identified
 * by the `x-restaurant-slug` request header (sent by the frontend on every
 * authenticated API call).
 *
 * The check is intentionally server-side: we derive the user's restaurant from
 * the JWT (restaurant_slug claim) and compare it to the header value.
 * We never trust a restaurant_id/slug sent in the request body.
 *
 * Skip the check when no header is present (backwards-compat for routes that
 * don't yet send the header, e.g. public menu routes).
 */
const requireSlugMatch = (req, res, next) => {
  const headerSlug = req.headers["x-restaurant-slug"];
  if (!headerSlug) return next(); // no slug header — skip check

  const userRestaurantSlug = req.user?.restaurant_slug || req.user?.slug || req.user?.business_slug;
  if (!userRestaurantSlug) {
    return res.status(403).json({ message: "You do not belong to this restaurant." });
  }

  if (headerSlug.toLowerCase() !== userRestaurantSlug.toLowerCase()) {
    return res.status(403).json({ message: "You do not belong to this restaurant." });
  }

  next();
};

/**
 * Validates that the authenticated user belongs to the branch identified
 * by the `x-branch-slug` request header.
 * For main branch requests the header will be absent or empty — skip check.
 */
const requireBranchMatch = (req, res, next) => {
  const headerBranchSlug = req.headers["x-branch-slug"];
  // No header = main branch request, always allowed (restaurant slug check is enough)
  if (!headerBranchSlug || headerBranchSlug === "main") return next();

  const userBranchSlug = req.user?.branch_slug;

  // Admin can access all branches of their restaurant
  if (req.user?.role === "admin") return next();

  if (!userBranchSlug) {
    return res.status(403).json({ message: "You are not assigned to this branch." });
  }

  if (headerBranchSlug.toLowerCase() !== userBranchSlug.toLowerCase()) {
    return res.status(403).json({ message: "You are not assigned to this branch." });
  }

  next();
};

module.exports = { authenticate, authorize, authorizeStaff, optionalAuth, requireSlugMatch, requireBranchMatch };
