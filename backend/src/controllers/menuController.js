const { pool } = require("../config/db");
const path = require("path");
const fs = require("fs");

exports.getCategories = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const isAdminRoute = !!req.user;
    let sql, params;
    if (isAdminRoute) {
      sql = `SELECT * FROM categories WHERE restaurant_id=? AND branch_id=? ORDER BY display_order ASC, created_at ASC`;
      params = [restaurantId, branchId];
    } else {
      sql = `SELECT DISTINCT c.* FROM categories c
             INNER JOIN menu_items m ON m.category_id=c.id
             WHERE c.restaurant_id=? AND c.branch_id=? AND m.available=1
             ORDER BY c.display_order ASC, c.created_at ASC`;
      params = [restaurantId, branchId];
    }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });
    const { restaurantId, branchId, ownerId } = req.tenant;

    const [existing] = await pool.query(
      `SELECT id FROM categories WHERE restaurant_id=? AND branch_id=? AND LOWER(name)=LOWER(?)`,
      [restaurantId, branchId, name],
    );
    if (existing.length)
      return res
        .status(409)
        .json({ message: `"${name}" category already exists` });

    const [result] = await pool.query(
      `INSERT INTO categories (user_id, restaurant_id, branch_id, name, icon) VALUES (?,?,?,?,?)`,
      [ownerId, restaurantId, branchId, name, icon || null],
    );
    res.status(201).json({ id: result.insertId, name, icon });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;
    const { restaurantId, branchId } = req.tenant;
    const [existing] = await pool.query(
      "SELECT id FROM categories WHERE restaurant_id=? AND branch_id=? AND LOWER(name)=LOWER(?) AND id!=?",
      [restaurantId, branchId, name, req.params.id],
    );
    if (existing.length)
      return res
        .status(409)
        .json({ message: `"${name}" category already exists` });

    const [result] = await pool.query(
      "UPDATE categories SET name=?, icon=? WHERE id=? AND restaurant_id=? AND branch_id=?",
      [name, icon, req.params.id, restaurantId, branchId],
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Category not found or access denied" });
    }
    res.json({ message: "Category updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const { deleteItems } = req.query;
    if (deleteItems === "true") {
      await pool.query(
        "DELETE FROM menu_items WHERE category_id=? AND restaurant_id=? AND branch_id=?",
        [req.params.id, restaurantId, branchId],
      );
    }
    const [result] = await pool.query(
      "DELETE FROM categories WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Category not found or access denied" });
    }
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMenuItems = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const { category, search, featured } = req.query;
    const isAdminRoute = !!req.user;

    let sql = `SELECT m.*, c.name AS category_name, c.icon AS category_icon
               FROM menu_items m LEFT JOIN categories c ON m.category_id=c.id
               WHERE m.restaurant_id=? AND m.branch_id=?`;
    const params = [restaurantId, branchId];
    if (!isAdminRoute) sql += " AND m.available=1";
    if (category) {
      sql += " AND m.category_id=?";
      params.push(category);
    }
    if (search) {
      sql += " AND (m.name LIKE ? OR m.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (featured === "true") sql += " AND m.is_featured=1";
    sql += " ORDER BY m.created_at DESC";
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMenuItem = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [rows] = await pool.query(
      `SELECT m.*, c.name AS category_name FROM menu_items m
       LEFT JOIN categories c ON m.category_id=c.id 
       WHERE m.id=? AND m.restaurant_id=? AND m.branch_id=?`,
      [req.params.id, restaurantId, branchId],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Item not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category_id,
      available,
      is_featured,
      discount_percent,
    } = req.body;
    if (!name || !price)
      return res.status(400).json({ message: "Name and price required" });
    const { restaurantId, branchId, ownerId } = req.tenant;
    const image = req.file
      ? `/uploads/user_${req.user.id}/${req.file.filename}`
      : null;

    const parseBool = (val, fb = true) =>
      val === undefined || val === null
        ? fb
        : val === true || val === "true" || val === "1" || val === 1;

    const [result] = await pool.query(
      `INSERT INTO menu_items (user_id, restaurant_id, branch_id, name, description, price, image, category_id, available, is_featured, discount_percent)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ownerId,
        restaurantId,
        branchId,
        name,
        description,
        price,
        image,
        category_id || null,
        parseBool(available, true),
        parseBool(is_featured, false),
        discount_percent || 0,
      ],
    );

    const [rows] = await pool.query(
      `SELECT m.*, c.name AS category_name FROM menu_items m 
       LEFT JOIN categories c ON m.category_id=c.id 
       WHERE m.id=? AND m.restaurant_id=? AND m.branch_id=?`,
      [result.insertId, restaurantId, branchId],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category_id,
      available,
      is_featured,
      discount_percent,
    } = req.body;
    const { restaurantId, branchId, ownerId } = req.tenant;
    const [existing] = await pool.query(
      "SELECT * FROM menu_items WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Item not found" });

    let image = existing[0].image;
    if (req.file) {
      if (image) {
        const old = path.join(__dirname, "../../", image);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      image = `/uploads/user_${req.user.id}/${req.file.filename}`;
    }
    const parseBool = (val, fb = true) =>
      val === undefined || val === null
        ? fb
        : val === true || val === "true" || val === "1" || val === 1;

    await pool.query(
      `UPDATE menu_items SET name=?, description=?, price=?, image=?, category_id=?, available=?, is_featured=?, discount_percent=? 
       WHERE id=? AND restaurant_id=? AND branch_id=?`,
      [
        name,
        description,
        price,
        image,
        category_id || null,
        parseBool(available, true),
        parseBool(is_featured, false),
        discount_percent || 0,
        req.params.id,
        restaurantId,
        branchId,
      ],
    );

    const [rows] = await pool.query(
      `SELECT m.*, c.name AS category_name FROM menu_items m 
       LEFT JOIN categories c ON m.category_id=c.id 
       WHERE m.id=? AND m.restaurant_id=? AND m.branch_id=?`,
      [req.params.id, restaurantId, branchId],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [existing] = await pool.query(
      "SELECT image FROM menu_items WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    if (!existing.length)
      return res.status(404).json({ message: "Item not found" });
    if (existing[0].image) {
      const p = path.join(__dirname, "../../", existing[0].image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await pool.query(
      "DELETE FROM menu_items WHERE id=? AND restaurant_id=? AND branch_id=?",
      [req.params.id, restaurantId, branchId],
    );
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.reorderCategories = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const { order } = req.body;
    if (!Array.isArray(order))
      return res.status(400).json({ message: "order must be an array of ids" });
    await Promise.all(
      order.map((id, index) =>
        pool.query(
          "UPDATE categories SET display_order=? WHERE id=? AND restaurant_id=? AND branch_id=?",
          [index, id, restaurantId, branchId],
        ),
      ),
    );
    res.json({ message: "Order updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPromotions = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [rows] = await pool.query(
      `SELECT m.*, c.name AS category_name, c.icon AS category_icon
       FROM menu_items m LEFT JOIN categories c ON m.category_id=c.id
       WHERE m.restaurant_id=? AND m.branch_id=? AND m.available=1 AND (m.is_featured=1 OR m.discount_percent>0)
       ORDER BY m.discount_percent DESC, m.is_featured DESC LIMIT 10`,
      [restaurantId, branchId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const { restaurantId, branchId } = req.tenant;
    const [rows] = await pool.query(
      `SELECT m.*, c.name AS category_name, c.icon AS category_icon, COALESCE(SUM(oi.quantity),0) AS order_count
       FROM menu_items m LEFT JOIN categories c ON m.category_id=c.id
       LEFT JOIN order_items oi ON m.id=oi.menu_item_id
       WHERE m.restaurant_id=? AND m.branch_id=? AND m.available=1
       GROUP BY m.id ORDER BY order_count DESC, m.is_featured DESC LIMIT 8`,
      [restaurantId, branchId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
