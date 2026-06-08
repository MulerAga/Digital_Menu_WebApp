const router = require("express").Router();
const ctrl = require("../controllers/branchController");
const { authenticate, authorizeAdmin, requireSlugMatch } = require("../middleware/rbac");
const { authorize } = require("../middleware/auth");

// Public — for menu routing (no auth needed)
router.get("/public/:restaurantSlug", ctrl.listPublicBranches);

// All admin-only routes require auth + slug match
router.get("/subscription/limits", authenticate, requireSlugMatch, authorizeAdmin, ctrl.getSubscriptionLimits);
router.get("/", authenticate, requireSlugMatch, authorize("admin", "manager"), ctrl.listBranches);
router.post("/", authenticate, requireSlugMatch, authorizeAdmin, ctrl.createBranch);
router.get("/:id", authenticate, requireSlugMatch, authorize("admin", "manager"), ctrl.getBranch);
router.patch("/:id", authenticate, requireSlugMatch, authorizeAdmin, ctrl.updateBranch);
router.delete("/:id", authenticate, requireSlugMatch, authorizeAdmin, ctrl.deleteBranch);
router.get("/:id/users", authenticate, requireSlugMatch, authorize("admin", "manager"), ctrl.getBranchUsers);
router.patch("/users/:userId/assign", authenticate, requireSlugMatch, authorizeAdmin, ctrl.assignUserToBranch);

module.exports = router;
