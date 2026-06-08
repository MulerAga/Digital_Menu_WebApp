const router = require("express").Router();
const ctrl = require("../controllers/menuController");
const { authenticate, authorize, optionalAuth, requireSlugMatch } = require("../middleware/auth");
const tenantContext = require("../middleware/tenantContext");
const upload = require("../middleware/upload");

const adminRoles = ["admin", "manager", "staff", "cashier"];

// ── Admin routes (must come BEFORE /:slug wildcards) ──────────────────────

// Categories
router.get(
  "/admin/categories",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.getCategories,
);
router.post(
  "/admin/categories/reorder",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.reorderCategories,
);
router.post(
  "/admin/categories",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.createCategory,
);
router.put(
  "/admin/categories/:id",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.updateCategory,
);
router.delete(
  "/admin/categories/:id",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.deleteCategory,
);

// Items
router.get(
  "/admin/items",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.getMenuItems,
);
router.get(
  "/admin/items/:id",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.getMenuItem,
);
router.post(
  "/admin/items",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  upload.single("image"),
  ctrl.createMenuItem,
);
router.put(
  "/admin/items/:id",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  upload.single("image"),
  ctrl.updateMenuItem,
);
router.delete(
  "/admin/items/:id",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.deleteMenuItem,
);

// Promotions & Recommendations
router.get(
  "/admin/promotions",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.getPromotions,
);
router.get(
  "/admin/recommendations",
  authenticate,
  requireSlugMatch,
  authorize(...adminRoles),
  tenantContext,
  ctrl.getRecommendations,
);

// ── Public slug-based routes ───────────────────────────────────────────────
router.get("/:slug/items",            optionalAuth, tenantContext, ctrl.getMenuItems);
router.get("/:slug/items/:id",        optionalAuth, tenantContext, ctrl.getMenuItem);
router.get("/:slug/categories",       optionalAuth, tenantContext, ctrl.getCategories);
router.get("/:slug/promotions",       optionalAuth, tenantContext, ctrl.getPromotions);
router.get("/:slug/recommendations",  optionalAuth, tenantContext, ctrl.getRecommendations);

module.exports = router;
