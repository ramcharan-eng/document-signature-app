const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());


// ADD THESE LINES HERE ↓↓↓
app.use("/uploads", express.static("uploads"));
app.use("/signed", express.static("signed"));
console.log("LOADING:", require.resolve("./routes/documentRoutes"));

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
// ↑↑↑

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});