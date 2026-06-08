const { pool } = require("../config/db");

// Public: get restaurant by slug
// Looks up the restaurant record directly by slug
exports.getBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const [rows] = await pool.query(
      "SELECT id, restaurant_name, logo, slug FROM restaurants WHERE slug = ? LIMIT 1",
      [slug.toLowerCase()],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch restaurant" });
  }
};

// Authenticated: get restaurant for current admin
exports.getMy = async (req, res) => {
  try {
    const adminId = req.user.id;
    const [rows] = await pool.query(
      "SELECT id, restaurant_name, logo FROM restaurants WHERE admin_id = ? LIMIT 1",
      [adminId],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Restaurant not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching my restaurant:", err);
    res.status(500).json({ message: "Failed to fetch restaurant" });
  }
};

// Authenticated: upload logo for current admin restaurant
exports.uploadLogo = async (req, res) => {
  try {
    const adminId = req.user.id;
    // Ensure file was uploaded
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Verify restaurant exists
    const [restaurants] = await pool.query(
      "SELECT id FROM restaurants WHERE admin_id = ?",
      [adminId],
    );
    if (!restaurants.length)
      return res.status(404).json({ message: "Restaurant not found" });

    const restaurantId = restaurants[0].id;
    const filePath = `/uploads/user_${adminId}/${req.file.filename}`;

    await pool.query("UPDATE restaurants SET logo = ? WHERE id = ?", [
      filePath,
      restaurantId,
    ]);

    res.json({ message: "Logo uploaded", logo: filePath });
  } catch (err) {
    console.error("Error uploading logo:", err);
    res.status(500).json({ message: "Failed to upload logo" });
  }
};
