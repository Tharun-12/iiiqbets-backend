const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve uploaded images statically
// When you visit http://localhost:5000/uploads/image.jpg, it will load the image
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Import routes
const contactRoutes = require("./routes/contactRoutes");
const serviceRoutes = require("./routes/serviceRoutes"); // <-- Imported new route
const productRoutes = require("./routes/productRoutes");
const careerRoutes = require("./routes/carrerRoutes");
const blogRoutes = require("./routes/blogRoutes");






// Use routes
app.use("/api/contact", contactRoutes);
app.use("/api/services", serviceRoutes); 
app.use("/api/products", productRoutes);
app.use("/api/careers", careerRoutes);
app.use("/api/blogs", blogRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});