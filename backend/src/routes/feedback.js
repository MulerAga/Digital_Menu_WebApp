const router = require("express").Router();
const feedbackCtrl = require("../controllers/feedbackController");
const { authenticate, authorize, requireSlugMatch } = require("../middleware/auth");

// GET /api/feedback — admin, manager, and staff can view all feedback
router.get(
  "/",
  authenticate,
  requireSlugMatch,
  authorize("admin", "manager", "staff"),
  feedbackCtrl.getAllFeedback,
);

module.exports = router;
