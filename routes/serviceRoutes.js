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
    cb(null, `service-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

// ==========================================
// 1. POST Route: Add a new service
// ==========================================
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { title, description, features } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const imagePath = `/uploads/${req.file.filename}`;

    const query = `
      INSERT INTO services (title, description, features, image_path) 
      VALUES (?, ?, ?, ?)
    `;
    
    await db.query(query, [title, description, features, imagePath]);

    res.status(201).json({ success: true, message: "Service created successfully!" });
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 2. GET Route: Fetch all services
// ==========================================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM services ORDER BY created_at DESC");
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 3. GET Route: Fetch single service by ID
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM services WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Service not found" });
    
    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 4. PUT Route: Update a service
// ==========================================
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, features } = req.body;

    // Check if service exists
    const [existing] = await db.query("SELECT * FROM services WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: "Service not found" });

    // If new image uploaded, use new path. Otherwise, keep old path.
    let imagePath = existing[0].image_path;
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      // Optional: Delete old image from folder here if needed
    }

    const query = `
      UPDATE services 
      SET title = ?, description = ?, features = ?, image_path = ? 
      WHERE id = ?
    `;
    
    await db.query(query, [title, description, features, imagePath, id]);

    res.status(200).json({ success: true, message: "Service updated successfully!" });
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 5. DELETE Route: Delete a service
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query("DELETE FROM services WHERE id = ?", [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    res.status(200).json({ success: true, message: "Service deleted successfully!" });
  } catch (error) {
    console.error("Error deleting service:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;