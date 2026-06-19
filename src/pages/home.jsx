import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import SignaturePad from "../components/SignaturePad";
import axios from "axios";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ── SVG Icons (no emoji – renders correctly on all OS) ──────────────────────
const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconPen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const IconPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconFolder = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export default function Home() {
  const [token] = useState(localStorage.getItem("token") || "");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 600, height: 800 });
  const [sigPos, setSigPos] = useState(null);
  const [pendingSig, setPendingSig] = useState(false);
  const [signature, setSignature] = useState(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [docId, setDocId] = useState(null);
  const [showPad, setShowPad] = useState(false);
  const [previewSig, setPreviewSig] = useState(null);

  const pageContainerRef = useRef(null);

  const handlePdfChange = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;
    setPdfFile(file);
    setPdfUrl(URL.createObjectURL(file));
    setSigPos(null);
    setSignedPdfUrl(null);
    setDocId(null);

    const form = new FormData();
    form.append("document", file);
    setUploading(true);
    try {
      const res = await axios.post(`${API}/documents/upload`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const id = res.data._id || res.data.id;
      console.log("Uploaded, docId =", id);
      setDocId(id);
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const onPageRenderSuccess = useCallback((page) => {
    setPageSize({ width: page.width, height: page.height });
  }, []);

  const handlePageClick = (e) => {
    if (!pendingSig) return;
    const rect = pageContainerRef.current.getBoundingClientRect();
    setSigPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      page: currentPage,
    });
    setPendingSig(false);
  };

  const handleSignatureReady = ({ base64, width, height }) => {
    setSignature({ base64, width, height });
    setPreviewSig(`data:image/png;base64,${base64}`);
    setShowPad(false);
  };

  const handleSign = async () => {
    if (!docId) return alert("Please upload a PDF first.");
    if (!signature) return alert("Please create a signature first.");
    if (!sigPos) return alert("Click on the PDF to place your signature.");

    const pdfX = sigPos.x * pageSize.width;
    const pdfY = (1 - sigPos.y) * pageSize.height - signature.height;

    setSigning(true);
    try {
      const res = await axios.post(
        `${API}/documents/sign/${docId}`,
        {
          signatureBase64: signature.base64,
          sigWidth: signature.width,
          sigHeight: signature.height,
          x: pdfX,
          y: pdfY,
          page: sigPos.page - 1,
        },
        { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      setSignedPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      alert("Signing failed: " + (err.response?.data?.message || err.message));
    } finally {
      setSigning(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    app: { minHeight: "100vh", background: "#f5f4ff", fontFamily: "'Inter','Segoe UI',sans-serif" },
    nav: {
      background: "#fff",
      boxShadow: "0 1px 8px rgba(108,99,255,0.08)",
      padding: "0 32px", height: "60px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    navBrand: {
      fontWeight: 800, fontSize: "20px",
      background: "linear-gradient(135deg,#6c63ff,#a78bfa)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    },
    main: {
      maxWidth: "1100px", margin: "0 auto", padding: "32px 16px",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px",
    },
    card: { background: "#fff", borderRadius: "14px", boxShadow: "0 2px 16px rgba(108,99,255,0.08)", padding: "24px" },
    cardTitle: {
      fontWeight: 700, fontSize: "15px", color: "#1a1a2e",
      marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px",
    },
    btn: { padding: "10px 20px", borderRadius: "8px", border: "none", fontWeight: 600, fontSize: "14px", cursor: "pointer", transition: "all 0.15s" },
    btnPrimary: { background: "linear-gradient(135deg,#6c63ff,#a78bfa)", color: "#fff" },
    btnSecondary: { background: "#f3f0ff", color: "#6c63ff", border: "1.5px solid #e0d9ff" },
    btnDanger: { background: "#fff0f0", color: "#e05c5c", border: "1.5px solid #fecaca" },
    btnSuccess: { background: "linear-gradient(135deg,#10b981,#34d399)", color: "#fff" },
    fileLabel: {
      display: "flex", alignItems: "center", gap: "10px",
      padding: "12px 18px", border: "1.5px dashed #c4b5fd",
      borderRadius: "8px", cursor: "pointer", color: "#6c63ff",
      fontSize: "14px", fontWeight: 500, background: "#fafafa",
    },
    tag: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600 },
    tagGreen: { background: "#d1fae5", color: "#065f46" },
    tagBlue: { background: "#ede9fe", color: "#5b21b6" },
    tagYellow: { background: "#fef3c7", color: "#92400e" },
    paginationRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "12px" },
  };

  return (
    <div style={s.app}>
      {/* NAV */}
      <nav style={s.nav}>
        <span style={s.navBrand}>DocSign</span>
        <button style={{ ...s.btn, ...s.btnDanger, padding: "7px 16px" }} onClick={handleLogout}>
          Logout
        </button>
      </nav>

      <div style={s.main}>
        {/* ── LEFT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Upload */}
          <div style={s.card}>
            <div style={s.cardTitle}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "8px", background: "#ede9fe" }}>
                <IconUpload />
              </span>
              Upload Document
            </div>
            <label style={s.fileLabel} htmlFor="pdf-input">
              <IconFolder /> Choose PDF file
              <input id="pdf-input" type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePdfChange} />
            </label>
            {pdfFile && (
              <p style={{ marginTop: "10px", fontSize: "13px", color: "#555", display: "flex", alignItems: "center", gap: "6px" }}>
                {pdfFile.name}{" "}
                {uploading
                  ? <span style={{ ...s.tag, ...s.tagBlue }}>Uploading...</span>
                  : docId
                    ? <span style={{ ...s.tag, ...s.tagGreen }}><IconCheck /> Uploaded</span>
                    : null}
              </p>
            )}
          </div>

          {/* Signature */}
          <div style={s.card}>
            <div style={s.cardTitle}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "8px", background: "#ede9fe" }}>
                <IconPen />
              </span>
              Your Signature
            </div>
            {signature ? (
              <div style={{ marginBottom: "12px" }}>
                <img src={previewSig} alt="sig" style={{ border: "1px solid #e0d9ff", borderRadius: "6px", maxWidth: "100%", background: "#fafafa", display: "block" }} />
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#888" }}>{signature.width} x {signature.height} px</div>
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "12px" }}>No signature yet — create one below.</p>
            )}
            <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setShowPad(v => !v)}>
              {showPad ? "Hide Pad" : signature ? "Edit Signature" : "Create Signature"}
            </button>
            {showPad && (
              <div style={{ marginTop: "16px" }}>
                <SignaturePad onSignatureReady={handleSignatureReady} />
              </div>
            )}
          </div>

          {/* Place & Sign */}
          <div style={s.card}>
            <div style={s.cardTitle}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "8px", background: "#ede9fe" }}>
                <IconPin />
              </span>
              Place &amp; Sign
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                style={{ ...s.btn, ...(pendingSig ? s.btnDanger : s.btnSecondary) }}
                onClick={() => setPendingSig(v => !v)}
                disabled={!pdfUrl}
              >
                {pendingSig ? "Cancel Placement" : "Place Signature on PDF"}
              </button>

              {sigPos && (
                <span style={{ ...s.tag, ...s.tagGreen, fontSize: "13px" }}>
                  <IconCheck /> Position set on page {sigPos.page}
                </span>
              )}

              <button
                style={{ ...s.btn, ...s.btnSuccess, opacity: signing ? 0.7 : 1 }}
                onClick={handleSign}
                disabled={signing || !docId || !signature || !sigPos}
              >
                {signing ? "Signing..." : "Sign Document"}
              </button>

              {signedPdfUrl && (
                <a
                  href={signedPdfUrl}
                  download="signed-document.pdf"
                  style={{ ...s.btn, ...s.btnPrimary, textDecoration: "none", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <IconDownload /> Download Signed PDF
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: PDF Viewer ── */}
        <div style={s.card}>
          <div style={s.cardTitle}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "8px", background: "#ede9fe" }}>
              <IconEye />
            </span>
            PDF Preview
            {pendingSig && (
              <span style={{ marginLeft: "8px", ...s.tag, ...s.tagYellow, animation: "pulse 1.5s infinite" }}>
                Click to place signature
              </span>
            )}
          </div>

          {pdfUrl ? (
            <>
              <div
                ref={pageContainerRef}
                style={{ position: "relative", display: "inline-block", width: "100%", cursor: pendingSig ? "crosshair" : "default", userSelect: "none" }}
                onClick={handlePageClick}
              >
                <Document file={pdfUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
                  <Page
                    pageNumber={currentPage}
                    width={pageContainerRef.current ? pageContainerRef.current.clientWidth : 480}
                    onRenderSuccess={onPageRenderSuccess}
                  />
                </Document>

                {sigPos && sigPos.page === currentPage && signature && (
                  <img
                    src={previewSig}
                    alt="sig overlay"
                    style={{
                      position: "absolute", pointerEvents: "none",
                      border: "2px solid #6c63ff", borderRadius: "4px",
                      left: `${sigPos.x * 100}%`, top: `${sigPos.y * 100}%`,
                      width: `${signature.width}px`, height: `${signature.height}px`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                )}
              </div>

              {numPages > 1 && (
                <div style={s.paginationRow}>
                  <button style={{ ...s.btn, ...s.btnSecondary, padding: "6px 14px" }} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <span style={{ fontSize: "13px", color: "#555" }}>Page {currentPage} of {numPages}</span>
                  <button style={{ ...s.btn, ...s.btnSecondary, padding: "6px 14px" }} onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage === numPages}>Next</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ minHeight: "320px", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: "15px", border: "1.5px dashed #e0d9ff", borderRadius: "8px" }}>
              Upload a PDF to preview it here
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}
