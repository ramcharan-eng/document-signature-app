console.log("DOCUMENT ROUTES FILE LOADED");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const auth = require("../middleware/auth");
const Document = require("../models/Document");

// ── Ensure upload directories exist ──────────────────────────────────────────
const uploadDir = path.join(__dirname, "../uploads");
const signedDir = path.join(__dirname, "../uploads/signed");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(signedDir)) fs.mkdirSync(signedDir, { recursive: true });

// ── Multer config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// helper – works whether JWT puts id as "id" or "_id"
const getUserId = (req) => req.user.id || req.user._id;

// ── POST /api/documents/upload ────────────────────────────────────────────────
router.post("/upload", auth, upload.single("document"), async (req, res) => {
  try {
    console.log("UPLOAD ROUTE HIT, fieldname =", req.file?.fieldname);
    console.log("req.user =", req.user);

    if (!req.file) {
      return res.status(400).json({ message: "No PDF file provided" });
    }

    const doc = new Document({
      user: getUserId(req),
      filename: req.file.originalname,
      filepath: req.file.path,   // matches schema field "filepath"
      size: req.file.size,
      uploadedAt: new Date(),
      signed: false,
    });

    await doc.save();
    console.log("SAVED doc._id =", doc._id, "user =", doc.user);
    res.status(201).json({ _id: doc._id, filename: doc.filename });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: err.message || "Upload failed" });
  }
});

// ── GET /api/documents ────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const docs = await Document.find({ user: getUserId(req) }).sort({ uploadedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/documents/:id ────────────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const filePath = doc.signed && doc.signedPath ? doc.signedPath : doc.filepath;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on disk" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.filename)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/documents/sign/:id ──────────────────────────────────────────────
router.post("/sign/:id", auth, async (req, res) => {
  try {
    const { signatureBase64, sigWidth = 120, sigHeight = 50, x = 0, y = 0, page = 0 } = req.body;

    console.log("SIGN: id =", req.params.id, "| user =", getUserId(req));

    if (!signatureBase64) {
      return res.status(400).json({ message: "signatureBase64 is required" });
    }

    // Find by ID only (no user filter) to avoid mismatch issues
    const doc = await Document.findById(req.params.id);
    console.log("SIGN: doc found =", doc ? doc._id : "NULL");

    if (!doc) return res.status(404).json({ message: "Document not found" });

    const sourcePath = doc.filepath;
    console.log("SIGN: sourcePath =", sourcePath, "| exists =", fs.existsSync(sourcePath || ""));

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return res.status(404).json({ message: "Source PDF not found on disk" });
    }

    // Load and modify PDF
    const existingPdfBytes = fs.readFileSync(sourcePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const pages = pdfDoc.getPages();
    const pageIndex = Math.max(0, Math.min(Number(page), pages.length - 1));
    const targetPage = pages[pageIndex];

    const cleanBase64 = signatureBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    const sigBytes = Uint8Array.from(Buffer.from(cleanBase64, "base64"));

    let sigImage;
    try {
      sigImage = await pdfDoc.embedPng(sigBytes);
    } catch {
      sigImage = await pdfDoc.embedJpg(sigBytes);
    }

    const w = parseFloat(sigWidth) || 120;
    const h = parseFloat(sigHeight) || 50;
    const px = parseFloat(x) || 0;
    const py = parseFloat(y) || 0;

    targetPage.drawImage(sigImage, { x: px, y: py, width: w, height: h });

    const signedBytes = await pdfDoc.save();
    const signedFilename = `signed-${Date.now()}-${path.basename(sourcePath)}`;
    const signedPath = path.join(signedDir, signedFilename);
    fs.writeFileSync(signedPath, signedBytes);

    // Update record — these fields must exist in your schema
    doc.signed = true;
    doc.signedPath = signedPath;
    doc.signedAt = new Date();
    await doc.save();

    console.log("SIGN: success, sending", signedBytes.length, "bytes");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="signed-${encodeURIComponent(doc.filename)}"`);
    res.setHeader("Content-Length", signedBytes.length);
    res.send(Buffer.from(signedBytes));
  } catch (err) {
    console.error("Sign error:", err);
    res.status(500).json({ message: err.message || "Signing failed" });
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    [doc.filepath, doc.signedPath].forEach((fp) => {
      if (fp && fs.existsSync(fp)) fs.unlinkSync(fp);
    });

    await doc.deleteOne();
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;