const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `product-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

// POST Route: Add new product
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, subtitle } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Image is required" });

    const imagePath = `/uploads/${req.file.filename}`;
    const query = `INSERT INTO products (name, subtitle, image_path) VALUES (?, ?, ?)`;
    
    await db.query(query, [name, subtitle, imagePath]);
    res.status(201).json({ success: true, message: "Product created successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// GET Route: Fetch all products
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products ORDER BY created_at DESC");
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// PUT Route: Update product
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subtitle } = req.body;

    const [existing] = await db.query("SELECT * FROM products WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: "Product not found" });

    let imagePath = existing[0].image_path;
    if (req.file) imagePath = `/uploads/${req.file.filename}`;

    const query = `UPDATE products SET name = ?, subtitle = ?, image_path = ? WHERE id = ?`;
    await db.query(query, [name, subtitle, imagePath, id]);

    res.status(200).json({ success: true, message: "Product updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// DELETE Route: Delete product
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Product not found" });
    res.status(200).json({ success: true, message: "Product deleted successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;