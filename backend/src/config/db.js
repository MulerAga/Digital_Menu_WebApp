const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    rejectUnauthorized: false,
  },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const initDB = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) DEFAULT NULL,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image VARCHAR(255),
        category_id INT,
        available BOOLEAN DEFAULT TRUE,
        is_featured BOOLEAN DEFAULT FALSE,
        discount_percent INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT,
        user_id INT,
        guest_token VARCHAR(36) UNIQUE,
        table_number VARCHAR(20),
        status ENUM('pending','preparing','served','completed','cancelled') DEFAULT 'pending',
        payment_method ENUM('cash','bank','wallet') DEFAULT 'cash',
        total DECIMAL(10,2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        menu_item_id INT,
        name VARCHAR(150) NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
      )
    `);

    try {
      await conn.query(`ALTER TABLE orders ADD COLUMN owner_id INT`);
    } catch (e) {
      /* column already exists */
    }

    try {
      await conn.query(
        `ALTER TABLE orders ADD CONSTRAINT fk_orders_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL`,
      );
    } catch (e) {
      /* constraint already exists or cannot be added */
    }

    try {
      await conn.query(
        `UPDATE orders o
         JOIN order_items oi ON oi.order_id = o.id
         SET o.owner_id = oi.user_id
         WHERE o.owner_id IS NULL`,
      );
    } catch (e) {
      /* ignore */
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT,
        guest_token VARCHAR(36),
        rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_order_feedback (order_id)
      )
    `);

    // Migrate: add is_active to users if missing (default 1 so existing users stay active)
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add cash_paid flag to orders (cashier marks when cash is received)
    try {
      await conn.query(
        `ALTER TABLE orders ADD COLUMN cash_paid TINYINT(1) NOT NULL DEFAULT 0`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add receipt_image to orders (payment screenshot for bank/wallet)
    try {
      await conn.query(
        `ALTER TABLE orders ADD COLUMN receipt_image VARCHAR(500) NULL`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add restaurant_slug to orders for guest isolation
    // This allows filtering guest order history per restaurant
    try {
      await conn.query(
        `ALTER TABLE orders ADD COLUMN restaurant_slug VARCHAR(100) NULL`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: backfill restaurant_slug on existing orders from owner_id → users.slug
    try {
      await conn.query(
        `UPDATE orders o
         JOIN users u ON u.id = o.owner_id AND u.role = 'admin'
         SET o.restaurant_slug = u.slug
         WHERE o.restaurant_slug IS NULL AND o.owner_id IS NOT NULL`,
      );
    } catch (e) {
      /* ignore */
    }

    // Migrate: extend orders.status ENUM to include 'completed' and 'paid'
    try {
      await conn.query(
        `ALTER TABLE orders MODIFY COLUMN status ENUM('pending','preparing','served','completed','cancelled') DEFAULT 'pending'`,
      );
    } catch (e) {
      /* ignore */
    }

    // Migrate: add business_name to users if missing
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN business_name VARCHAR(150) NULL`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add slug to users if missing (used for public menu URLs like /canoe-restaurant)
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN slug VARCHAR(100) UNIQUE NULL`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add business_slug to users if missing (stores the owning admin slug for staff/cashier/manager)
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN business_slug VARCHAR(100) NULL`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add logo to restaurants if missing
    try {
      await conn.query(
        `ALTER TABLE restaurants ADD COLUMN logo VARCHAR(255) DEFAULT NULL`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add slug to restaurants table if missing
    try {
      await conn.query(
        `ALTER TABLE restaurants ADD COLUMN slug VARCHAR(100) UNIQUE DEFAULT NULL`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: backfill restaurant.slug from users.slug (one-time migration)
    try {
      await conn.query(
        `UPDATE restaurants r
         JOIN users u ON u.id = r.admin_id
         SET r.slug = u.slug
         WHERE r.slug IS NULL AND u.slug IS NOT NULL`,
      );
    } catch (e) {
      /* already done or error */
    }

    // Migrate: auto-generate slugs for existing admin users from business_name (or name fallback)
    try {
      const [admins] = await conn.query(
        `SELECT id, name, business_name FROM users WHERE role='admin'`,
      );
      for (const admin of admins) {
        const source =
          admin.business_name && admin.business_name.trim()
            ? admin.business_name
            : admin.name;
        const baseSlug = source
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");
        const [conflict] = await conn.query(
          `SELECT id FROM users WHERE slug=? AND id != ?`,
          [baseSlug, admin.id],
        );
        const finalSlug = conflict.length
          ? `${baseSlug}-${admin.id}`
          : baseSlug;
        await conn.query(`UPDATE users SET slug=? WHERE id=?`, [
          finalSlug,
          admin.id,
        ]);
      }
    } catch (e) {
      /* ignore */
    }

    // Migrate: add display_order if missing
    try {
      await conn.query(
        `ALTER TABLE categories ADD COLUMN display_order INT DEFAULT 0`,
      );
      await conn.query(
        `UPDATE categories SET display_order = id WHERE display_order = 0`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add guest_token if missing
    try {
      await conn.query(
        `ALTER TABLE orders ADD COLUMN guest_token VARCHAR(36) UNIQUE`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add user_id to categories if missing
    try {
      await conn.query(
        `ALTER TABLE categories ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add user_id to menu_items if missing
    try {
      await conn.query(
        `ALTER TABLE menu_items ADD COLUMN user_id INT REFERENCES users(id) ON DELETE CASCADE`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: add RBAC approval fields to users if missing
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN requested_role VARCHAR(50) DEFAULT NULL AFTER role`,
      );
    } catch (e) {
      /* column already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved' AFTER requested_role`,
      );
    } catch (e) {
      /* column already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN approved_by INT DEFAULT NULL AFTER approval_status`,
      );
    } catch (e) {
      /* column already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL AFTER approved_by`,
      );
    } catch (e) {
      /* column already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER email`,
      );
    } catch (e) {
      /* column already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE users ADD COLUMN restaurant_id INT DEFAULT NULL AFTER phone`,
      );
    } catch (e) {
      /* column already exists */
    }

    // Migrate: create restaurants table if missing
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS restaurants (
          id INT AUTO_INCREMENT PRIMARY KEY,
          restaurant_name VARCHAR(255) NOT NULL,
          admin_id INT NOT NULL,
          slug VARCHAR(100) UNIQUE DEFAULT NULL,
          subscription_plan VARCHAR(50) DEFAULT 'basic',
          subscription_status VARCHAR(50) DEFAULT 'active',
          logo VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
    } catch (e) {
      /* table already exists or cannot be created yet */
    }

    // Migrate: create approval_logs table if missing
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS approval_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          action VARCHAR(50) NOT NULL,
          approved_by INT,
          reason VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
    } catch (e) {
      /* table already exists or cannot be created yet */
    }

    // Migrate: assign orphaned rows (user_id IS NULL) to the first admin user
    try {
      const [admins] = await conn.query(
        `SELECT id FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1`,
      );
      if (admins.length) {
        const adminId = admins[0].id;
        await conn.query(
          `UPDATE categories SET user_id=? WHERE user_id IS NULL`,
          [adminId],
        );
        await conn.query(
          `UPDATE menu_items SET user_id=? WHERE user_id IS NULL`,
          [adminId],
        );
      }
    } catch (e) {
      /* users table may not exist yet */
    }

    // Migrate: remove duplicate categories (keep lowest id per name, case-insensitive)
    try {
      await conn.query(`
        DELETE c1 FROM categories c1
        INNER JOIN categories c2
        WHERE c1.id > c2.id AND LOWER(c1.name) = LOWER(c2.name)
      `);
    } catch (e) {
      /* ignore */
    }

    // ── Branch system migrations ──────────────────────────────────────────

    // Create branches table
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS branches (
          id INT AUTO_INCREMENT PRIMARY KEY,
          restaurant_id INT NOT NULL,
          branch_name VARCHAR(150) NOT NULL,
          branch_slug VARCHAR(100) NULL,
          address VARCHAR(255) NULL,
          phone VARCHAR(30) NULL,
          is_main_branch TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
          UNIQUE KEY uq_branch_slug (restaurant_id, branch_slug)
        )
      `);
    } catch (e) {
      /* already exists */
    }

    // Add branch_id to users
    try {
      await conn.query(`ALTER TABLE users ADD COLUMN branch_id INT NULL`);
    } catch (e) {
      /* already exists */
    }

    // Add branch_id to orders
    try {
      await conn.query(`ALTER TABLE orders ADD COLUMN branch_id INT NULL`);
    } catch (e) {
      /* already exists */
    }

    // Add branch_id to categories
    try {
      await conn.query(`ALTER TABLE categories ADD COLUMN branch_id INT NULL`);
    } catch (e) {
      /* already exists */
    }

    // Add branch_id to menu_items
    try {
      await conn.query(`ALTER TABLE menu_items ADD COLUMN branch_id INT NULL`);
    } catch (e) {
      /* already exists */
    }

    // Add restaurant_id to categories
    try {
      await conn.query(
        `ALTER TABLE categories ADD COLUMN restaurant_id INT NULL`,
      );
    } catch (e) {
      /* already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE categories ADD CONSTRAINT fk_categories_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE`,
      );
    } catch (e) {
      /* already exists or error */
    }

    // Add restaurant_id to menu_items
    try {
      await conn.query(
        `ALTER TABLE menu_items ADD COLUMN restaurant_id INT NULL`,
      );
    } catch (e) {
      /* already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE menu_items ADD CONSTRAINT fk_menu_items_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE`,
      );
    } catch (e) {
      /* already exists or error */
    }

    // Add restaurant_id to orders
    try {
      await conn.query(`ALTER TABLE orders ADD COLUMN restaurant_id INT NULL`);
    } catch (e) {
      /* already exists */
    }
    try {
      await conn.query(
        `ALTER TABLE orders ADD CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE`,
      );
    } catch (e) {
      /* already exists or error */
    }

    // Backfill restaurant_id values
    try {
      await conn.query(`
        UPDATE categories c
        JOIN restaurants r ON r.admin_id = c.user_id
        SET c.restaurant_id = r.id
        WHERE c.restaurant_id IS NULL
      `);
      await conn.query(`
        UPDATE menu_items m
        JOIN restaurants r ON r.admin_id = m.user_id
        SET m.restaurant_id = r.id
        WHERE m.restaurant_id IS NULL
      `);
      await conn.query(`
        UPDATE orders o
        JOIN restaurants r ON r.admin_id = o.owner_id
        SET o.restaurant_id = r.id
        WHERE o.restaurant_id IS NULL
      `);
    } catch (e) {
      console.error("Backfilling restaurant_id failed:", e.message);
    }

    // Seed main branches for existing restaurants (one-time migration)
    try {
      const [rests] = await conn.query(
        `SELECT r.id, r.restaurant_name, r.admin_id, u.slug
         FROM restaurants r JOIN users u ON u.id = r.admin_id
         WHERE r.id NOT IN (SELECT DISTINCT restaurant_id FROM branches WHERE is_main_branch = 1)`,
      );
      for (const r of rests) {
        const [ins] = await conn.query(
          `INSERT INTO branches (restaurant_id, branch_name, branch_slug, is_main_branch)
           VALUES (?, ?, NULL, 1)`,
          [r.id, r.restaurant_name],
        );
        const mainBranchId = ins.insertId;
        // Assign all existing users of this restaurant to the main branch
        await conn.query(
          `UPDATE users SET branch_id = ? WHERE (slug = ? OR business_slug = ?) AND branch_id IS NULL`,
          [mainBranchId, r.slug, r.slug],
        );
        // Assign existing orders to main branch
        await conn.query(
          `UPDATE orders SET branch_id = ? WHERE owner_id = ? AND branch_id IS NULL`,
          [mainBranchId, r.admin_id],
        );
        // Assign existing categories and menu items to main branch
        await conn.query(
          `UPDATE categories SET branch_id = ? WHERE user_id = ? AND branch_id IS NULL`,
          [mainBranchId, r.admin_id],
        );
        await conn.query(
          `UPDATE menu_items SET branch_id = ? WHERE user_id = ? AND branch_id IS NULL`,
          [mainBranchId, r.admin_id],
        );
      }
    } catch (e) {
      /* ignore */
    }

    // Seed categories (only if none exist; assign to first admin so they appear in the menu)
    const [cats] = await conn.query(`SELECT id FROM categories LIMIT 1`);
    if (cats.length === 0) {
      try {
        const [admins] = await conn.query(
          `SELECT id FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1`,
        );
        const seedUserId = admins.length ? admins[0].id : null;
        await conn.query(
          `
          INSERT INTO categories (user_id, name, icon) VALUES
          (?, 'Main Course', '⭐'),(?, 'Starters', '🍩'), (?, 'Drinks', '🥤'),
          (?, 'Desserts', '🍰'), (?, 'Salads', '🥗')
        `,
          [seedUserId, seedUserId, seedUserId, seedUserId, seedUserId],
        );
      } catch (e) {
        /* users table may not exist yet — skip seed */
      }
    }

    console.log("✅ Database initialized");
  } finally {
    conn.release();
  }
};

module.exports = { pool, initDB };
