const router = require("express").Router();
const ctrl = require("../controllers/orderController");
const feedbackCtrl = require("../controllers/feedbackController");
const {
  authenticate,
  authorize,
  requireSlugMatch,
  requireBranchMatch,
} = require("../middleware/auth");
const { uploadReceipt } = require("../middleware/upload");

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();
  const jwt = require("jsonwebtoken");
  try {
    req.user = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    /* guest */
  }
  next();
};

router.post(
  "/",
  optionalAuth,
  uploadReceipt.single("receipt_image"),
  ctrl.placeOrder,
);
router.get("/guest/:token", ctrl.getOrderByGuestToken);

router.get(
  "/analytics",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  authorize("admin", "manager"),
  ctrl.getAnalytics,
);
router.get(
  "/ordered-items",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  authorize("admin", "manager"),
  ctrl.getOrderedItems,
);
router.get(
  "/",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  ctrl.getOrders,
);
router.get(
  "/cashier/summary",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  authorize("cashier"),
  ctrl.getCashierSummary,
);

router.post(
  "/:id/feedback",
  (req, res, next) => {
    console.log("feedback headers:", req.headers["x-restaurant-slug"]);
    console.log("feedback body:", req.body);
    next();
  },
  optionalAuth,
  feedbackCtrl.submitFeedback,
);

router.get("/:id/feedback", optionalAuth, feedbackCtrl.getFeedback);

router.get(
  "/:id",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  ctrl.getOrder,
);
router.patch(
  "/:id/status",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  authorize("admin", "staff"),
  ctrl.updateOrderStatus,
);
router.patch(
  "/:id/cash/accept",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  authorize("cashier"),
  ctrl.acceptCashOrder,
);
router.patch(
  "/:id/cash/paid",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  authorize("cashier"),
  ctrl.markCashPaid,
);
router.patch(
  "/:id/cash/complete",
  authenticate,
  requireSlugMatch,
  requireBranchMatch,
  authorize("cashier"),
  ctrl.completeCashOrder,
);

module.exports = router;
