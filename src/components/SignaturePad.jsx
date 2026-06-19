import { useRef, useState, useEffect } from "react";

const FONTS = [
  { name: "Pacifico", label: "Pacifico" },
  { name: "Great Vibes", label: "Great Vibes" },
  { name: "Dancing Script", label: "Dancing Script" },
  { name: "Allura", label: "Allura" },
];

const GFONTS_ID = "__sig_gfonts__";
if (!document.getElementById(GFONTS_ID)) {
  const link = document.createElement("link");
  link.id = GFONTS_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Pacifico&family=Great+Vibes&family=Dancing+Script:wght@700&family=Allura&display=swap";
  document.head.appendChild(link);
}

export default function SignaturePad({ onSignatureReady }) {
  const [mode, setMode] = useState("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [selectedFont, setSelectedFont] = useState(FONTS[0].name);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [sigWidth, setSigWidth] = useState(120);
  const [sigHeight, setSigHeight] = useState(50);
  const [fontsReady, setFontsReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastPos = useRef(null);
  const strokes = useRef([]);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Promise.all(
          FONTS.map((f) =>
            document.fonts.load(`bold 32px '${f.name}'`).catch(() => null)
          )
        );
      } catch {}
      setFontsReady(true);
    };
    loadFonts();
  }, []);

  useEffect(() => {
    if (mode === "draw") redrawCanvas();
  }, [mode]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokes.current.forEach(({ from, to }) => {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
  };

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    strokes.current.push({ from: { ...lastPos.current }, to: { ...pos } });
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    strokes.current = [];
    redrawCanvas();
  };

  const getDrawnBase64 = () => {
    const tmp = document.createElement("canvas");
    tmp.width = sigWidth * 3;
    tmp.height = sigHeight * 3;
    const ctx = tmp.getContext("2d");
    const src = canvasRef.current;
    if (src) ctx.drawImage(src, 0, 0, tmp.width, tmp.height);
    const out = document.createElement("canvas");
    out.width = sigWidth;
    out.height = sigHeight;
    out.getContext("2d").drawImage(tmp, 0, 0, sigWidth, sigHeight);
    return out.toDataURL("image/png").split(",")[1];
  };

  const getTypedBase64 = async () => {
    const fontStr = `bold ${Math.floor(sigHeight * 1.6)}px '${selectedFont}', cursive`;
    try { await document.fonts.load(fontStr); } catch {}
    const scale = 4;
    const canvas = document.createElement("canvas");
    canvas.width = sigWidth * scale;
    canvas.height = sigHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fontSize = Math.floor(canvas.height * 0.62);
    ctx.font = `bold ${fontSize}px '${selectedFont}', cursive`;
    ctx.fillStyle = "#1a1a2e";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(typedText.trim(), canvas.width / 2, canvas.height / 2);
    const out = document.createElement("canvas");
    out.width = sigWidth;
    out.height = sigHeight;
    out.getContext("2d").drawImage(canvas, 0, 0, sigWidth, sigHeight);
    return out.toDataURL("image/png").split(",")[1];
  };

  const getUploadedBase64 = () =>
    new Promise((resolve, reject) => {
      const out = document.createElement("canvas");
      out.width = sigWidth;
      out.height = sigHeight;
      const ctx = out.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, sigWidth, sigHeight);
        resolve(out.toDataURL("image/png").split(",")[1]);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = uploadedPreview;
    });

  const handleApply = async () => {
    setError("");
    setApplying(true);
    try {
      let base64 = null;
      if (mode === "draw") {
        if (strokes.current.length === 0) { setError("Please draw your signature first."); return; }
        base64 = getDrawnBase64();
      } else if (mode === "type") {
        if (!typedText.trim()) { setError("Please type your name first."); return; }
        base64 = await getTypedBase64();
      } else if (mode === "upload") {
        if (!uploadedImage) { setError("Please upload a signature image first."); return; }
        base64 = await getUploadedBase64();
      }
      if (!base64) { setError("Could not generate signature. Please try again."); return; }
      if (typeof onSignatureReady === "function") {
        onSignatureReady({ base64, width: sigWidth, height: sigHeight });
      } else {
        setError("Internal error: callback not connected.");
      }
    } catch (err) {
      setError("Error: " + err.message);
    } finally {
      setApplying(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setError("Only PNG or JPG supported."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setUploadedPreview(ev.target.result); setUploadedImage(ev.target.result.split(",")[1]); };
    reader.readAsDataURL(file);
  };

  const tabStyle = (active) => ({
    padding: "8px 20px", border: "none",
    borderBottom: active ? "2px solid #6c63ff" : "2px solid transparent",
    background: "transparent", color: active ? "#6c63ff" : "#888",
    fontWeight: active ? 700 : 400, fontSize: "14px", cursor: "pointer", transition: "all 0.2s",
  });

  return (
    <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 16px rgba(108,99,255,0.10)", padding: "24px", maxWidth: "480px", width: "100%" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #eee", marginBottom: "20px", gap: "4px" }}>
        <button style={tabStyle(mode === "draw")} onClick={() => setMode("draw")}>✏️ Draw</button>
        <button style={tabStyle(mode === "type")} onClick={() => setMode("type")}>T Type</button>
        <button style={tabStyle(mode === "upload")} onClick={() => setMode("upload")}>📁 Upload</button>
      </div>

      {mode === "draw" && (
        <div>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "10px" }}>Draw your signature below:</p>
          <canvas ref={canvasRef} width={440} height={160}
            style={{ border: "1.5px dashed #c4b5fd", borderRadius: "8px", background: "#fafafa", cursor: "crosshair", touchAction: "none", width: "100%", display: "block" }}
            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
            onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
          />
          <button onClick={clearCanvas} style={{ marginTop: "8px", fontSize: "12px", color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear</button>
        </div>
      )}

      {mode === "type" && (
        <div>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "10px" }}>Type your name and choose a font:</p>
          <input type="text" value={typedText} onChange={(e) => { setTypedText(e.target.value); setError(""); }} placeholder="Your full name"
            style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e0d9ff", borderRadius: "8px", fontSize: "15px", outline: "none", marginBottom: "14px", boxSizing: "border-box" }}
          />
          {!fontsReady && <p style={{ fontSize: "12px", color: "#aaa", marginBottom: "8px" }}>Loading fonts…</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {FONTS.map((f) => (
              <button key={f.name} onClick={() => setSelectedFont(f.name)}
                style={{ padding: "12px 16px", border: `1.5px solid ${selectedFont === f.name ? "#6c63ff" : "#e0d9ff"}`, borderRadius: "8px", background: selectedFont === f.name ? "#f3f0ff" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: `'${f.name}', cursive`, fontSize: "22px", color: "#1a1a2e", transition: "all 0.15s" }}>
                {typedText || "Your Signature"}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "upload" && (
        <div>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "10px" }}>Upload a PNG or JPG signature image:</p>
          <div onClick={() => fileInputRef.current.click()}
            style={{ border: "1.5px dashed #c4b5fd", borderRadius: "8px", background: "#fafafa", padding: "24px", textAlign: "center", cursor: "pointer", color: "#888", fontSize: "14px", marginBottom: "12px" }}>
            {uploadedPreview
              ? <img src={uploadedPreview} alt="preview" style={{ maxHeight: "80px", maxWidth: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
              : <span>Click to browse PNG / JPG</span>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handleFileChange} />
          {uploadedPreview && (
            <button onClick={() => { setUploadedImage(null); setUploadedPreview(null); fileInputRef.current.value = ""; }}
              style={{ fontSize: "12px", color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Remove</button>
          )}
        </div>
      )}

      <div style={{ marginTop: "20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: "13px", color: "#555", display: "flex", alignItems: "center", gap: "6px" }}>
          W: <input type="number" value={sigWidth} min={30} max={400} onChange={(e) => setSigWidth(Math.max(30, Number(e.target.value)))}
            style={{ width: "64px", padding: "4px 8px", border: "1px solid #e0d9ff", borderRadius: "6px", fontSize: "13px" }} /> px
        </label>
        <label style={{ fontSize: "13px", color: "#555", display: "flex", alignItems: "center", gap: "6px" }}>
          H: <input type="number" value={sigHeight} min={20} max={200} onChange={(e) => setSigHeight(Math.max(20, Number(e.target.value)))}
            style={{ width: "64px", padding: "4px 8px", border: "1px solid #e0d9ff", borderRadius: "6px", fontSize: "13px" }} /> px
        </label>
      </div>

      {error && (
        <p style={{ marginTop: "12px", fontSize: "13px", color: "#e05c5c", background: "#fff0f0", padding: "8px 12px", borderRadius: "6px" }}>⚠️ {error}</p>
      )}

      <button onClick={handleApply} disabled={applying || (mode === "type" && !fontsReady)}
        style={{ marginTop: "16px", width: "100%", padding: "12px", background: applying ? "#a78bfa" : "linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: applying ? "wait" : "pointer", letterSpacing: "0.5px", opacity: applying ? 0.8 : 1 }}>
        {applying ? "Applying…" : "Apply Signature"}
      </button>
    </div>
  );
}