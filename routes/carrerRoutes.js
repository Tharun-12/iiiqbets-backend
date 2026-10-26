const express = require("express");
const router = express.Router();
const db = require("../db");

// POST Route: Add new career
router.post("/", async (req, res) => {
  try {
    const { title, location, job_type, experience } = req.body;
    
    const query = `INSERT INTO careers (title, location, job_type, experience) VALUES (?, ?, ?, ?)`;
    await db.query(query, [title, location, job_type, experience]);
    
    res.status(201).json({ success: true, message: "Career created successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// GET Route: Fetch all careers
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM careers ORDER BY created_at DESC");
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// PUT Route: Update career
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, location, job_type, experience } = req.body;

    const [existing] = await db.query("SELECT * FROM careers WHERE id = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: "Career not found" });

    const query = `UPDATE careers SET title = ?, location = ?, job_type = ?, experience = ? WHERE id = ?`;
    await db.query(query, [title, location, job_type, experience, id]);

    res.status(200).json({ success: true, message: "Career updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// DELETE Route: Delete career
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM careers WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Career not found" });
    
    res.status(200).json({ success: true, message: "Career deleted successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

module.exports = router;