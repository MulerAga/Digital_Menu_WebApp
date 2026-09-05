const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const fileFilter = (req, file, cb) => {
  const allowedExtensions = new Set([".jpeg", ".jpg", ".png", ".webp"]);
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const ext = allowedExtensions.has(
    path.extname(file.originalname).toLowerCase(),
  );
  const mime = allowedMimeTypes.has(file.mimetype.toLowerCase());
  if (ext && mime) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

// ── Authenticated menu-item uploads (requires req.user.id) ────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/user_" + req.user.id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Guest-safe receipt uploads (no req.user required) ─────────────────────
const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/receipts");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const uploadReceipt = multer({
  storage: receiptStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;
module.exports.uploadReceipt = uploadReceipt;
