// routes/contactRoutes.js
const express = require("express");
const db = require("../db");

const router = express.Router();

const STATUSES = ["new", "read", "replied", "archived"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

const clean = (value) => (typeof value === "string" ? value.trim() : "");

// Express 5 does not support regex in route paths, so validate :id here
router.param("id", (req, res, next, id) => {
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ success: false, message: "Invalid message id" });
  }
  next();
});

/* ------------------------------------------------------------------ */
/* POST /api/contact  -> public: save a new contact message            */
/* ------------------------------------------------------------------ */
router.post("/", async (req, res) => {
  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const company = clean(req.body.company);
    const phone = clean(req.body.phone);
    const subject = clean(req.body.subject);
    const message = clean(req.body.message);

    // Validation
    const errors = {};
    if (!name || name.length < 2) errors.name = "Full name is required (min 2 characters)";
    if (name.length > 100) errors.name = "Full name must be under 100 characters";
    if (!email || !EMAIL_REGEX.test(email)) errors.email = "A valid email address is required";
    if (phone && !PHONE_REGEX.test(phone)) errors.phone = "Enter a valid phone number";
    if (!subject) errors.subject = "Subject is required";
    if (subject.length > 200) errors.subject = "Subject must be under 200 characters";
    if (!message || message.length < 10) errors.message = "Message is required (min 10 characters)";
    if (message.length > 5000) errors.message = "Message must be under 5000 characters";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please fix the highlighted fields",
        errors,
      });
    }

    // Basic spam guard: same email + same subject within the last 2 minutes
    const [recent] = await db.execute(
      `SELECT id FROM contact_messages
       WHERE email = ? AND subject = ? AND created_at > (NOW() - INTERVAL 2 MINUTE)
       LIMIT 1`,
      [email, subject]
    );
    if (recent.length > 0) {
      return res.status(429).json({
        success: false,
        message: "You already sent this message. Please wait a couple of minutes.",
      });
    }

    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || null;

    const [result] = await db.execute(
      `INSERT INTO contact_messages
        (full_name, email, company, phone, subject, message, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, company || null, phone || null, subject, message, ip]
    );

    return res.status(201).json({
      success: true,
      message: "Thanks! Your message has been sent. We'll reply within 2 business hours.",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error("Contact POST error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not send your message. Please try again later.",
    });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/contact  -> admin: list messages (pagination/search/filter)*/
/* ?page=1&limit=10&status=new&search=john                             */
/* ------------------------------------------------------------------ */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const status = clean(req.query.status);
    const search = clean(req.query.search);

    const where = [];
    const params = [];

    if (status) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter" });
      }
      where.push("status = ?");
      params.push(status);
    }

    if (search) {
      where.push("(full_name LIKE ? OR email LIKE ? OR company LIKE ? OR subject LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM contact_messages ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `SELECT id, full_name, email, company, phone, subject, message, status, created_at
       FROM contact_messages ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Contact GET list error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/contact/:id  -> admin: single message                      */
/* ------------------------------------------------------------------ */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM contact_messages WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Contact GET one error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch message" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/contact/:id/status  -> admin: update status              */
/* body: { status: "read" | "replied" | "archived" | "new" }           */
/* ------------------------------------------------------------------ */
router.patch("/:id/status", async (req, res) => {
  try {
    const status = clean(req.body.status);
    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${STATUSES.join(", ")}`,
      });
    }

    const [result] = await db.execute("UPDATE contact_messages SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    return res.json({ success: true, message: "Status updated" });
  } catch (err) {
    console.error("Contact PATCH status error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /api/contact/:id  -> admin: delete a message                 */
/* ------------------------------------------------------------------ */
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.execute("DELETE FROM contact_messages WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    return res.json({ success: true, message: "Message deleted" });
  } catch (err) {
    console.error("Contact DELETE error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete message" });
  }
});

module.exports = router;