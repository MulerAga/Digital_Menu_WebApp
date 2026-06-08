const router = require("express").Router();
const ctrl = require("../controllers/authController");
const {
  authenticate,
  authorize,
  authorizeAdmin,
  authorizeManagerOrAdmin,
  requireSlugMatch,
} = require("../middleware/rbac");

router.post("/register", ctrl.register);
router.post("/register-staff", ctrl.registerStaff);
router.post("/login", ctrl.login);
router.post("/login-staff", ctrl.loginWithApprovalCheck);
router.get("/me", authenticate, ctrl.getMe);
router.patch(
  "/me/profile",
  authenticate,
  requireSlugMatch,
  authorizeManagerOrAdmin,
  ctrl.updateProfile,
);
router.get("/users", authenticate, requireSlugMatch, authorizeManagerOrAdmin, ctrl.getUsers);
router.patch(
  "/users/:id/role",
  authenticate,
  requireSlugMatch,
  authorizeManagerOrAdmin,
  ctrl.updateUserRole,
);
router.patch(
  "/users/:id/active",
  authenticate,
  requireSlugMatch,
  authorizeManagerOrAdmin,
  ctrl.toggleUserActive,
);
router.delete(
  "/users/:id",
  authenticate,
  requireSlugMatch,
  authorizeManagerOrAdmin,
  ctrl.deleteUser,
);

module.exports = router;
