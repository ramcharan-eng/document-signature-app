import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function PDFViewer({ onPositionSelect }) {
  const [numPages, setNumPages] = useState(0);

  const handleClick = (e, pageNumber) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = rect.height - (e.clientY - rect.top);

    onPositionSelect({
      page: pageNumber,
      x: Math.round(x),
      y: Math.round(y),
    });

    alert(`Page ${pageNumber}\nX: ${Math.round(x)}\nY: ${Math.round(y)}`);
  };

  return (
    <Document
      file="/sample.pdf"
      onLoadSuccess={({ numPages }) => {
        console.log("PDF Loaded");
        setNumPages(numPages);
      }}
      onLoadError={(error) => {
        console.error(error);
        alert(error.message);
      }}
    >
      {Array.from({ length: numPages }, (_, index) => (
        <div
          key={index}
          onClick={(e) => handleClick(e, index + 1)}
          style={{ cursor: "crosshair" }}
        >
          <Page
            pageNumber={index + 1}
            width={600}
          />
        </div>
      ))}
    </Document>
  );
}

export default PDFViewer;