const router = require("express").Router();
const ctrl = require("../controllers/approvalController");
const { authenticate, authorizeAdmin, requireSlugMatch } = require("../middleware/rbac");

router.get("/pending", authenticate, requireSlugMatch, authorizeAdmin, ctrl.getPendingApprovals);
router.get("/approved", authenticate, requireSlugMatch, authorizeAdmin, ctrl.getApprovedStaff);
router.post("/:userId/approve", authenticate, requireSlugMatch, authorizeAdmin, ctrl.approveStaff);
router.post("/:userId/reject", authenticate, requireSlugMatch, authorizeAdmin, ctrl.rejectStaff);
router.get("/status/me", authenticate, ctrl.getApprovalStatus);

module.exports = router;
