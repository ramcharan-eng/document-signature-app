const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    filepath: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
    },
    signature: {
      type: String,
      default: "",
    },
    signaturePage: {
      type: Number,
      default: 0,
    },
    signaturePosition: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    // ── New fields for signing ──
    signed: {
      type: Boolean,
      default: false,
    },
    signedPath: {
      type: String,
      default: "",
    },
    signedAt: {
      type: Date,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);