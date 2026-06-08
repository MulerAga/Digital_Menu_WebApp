const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");
const restaurantController = require("../controllers/restaurantController");

// Authenticated admin routes MUST come before /:slug wildcard
router.get("/me", authenticate, restaurantController.getMy);
router.post(
  "/me/logo",
  authenticate,
  upload.single("logo"),
  restaurantController.uploadLogo,
);

// Public route: get restaurant by slug (must be last)
router.get("/:slug", restaurantController.getBySlug);

module.exports = router;
