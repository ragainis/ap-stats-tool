import { freqDot, freqLabel } from '../utils/mapHelpers';

export default function ConceptCard({ concept, open, toggle, accent }) {
  return (
    <div style={{
      borderRadius: 8,
      border: `1.5px solid ${open ? accent : "#e2e5e9"}`,
      overflow: "hidden",
      background: "#fff",
      boxShadow: open ? `0 2px 12px ${accent}18` : "none"
    }}>
      <button 
        onClick={toggle} 
        style={{
          width: "100%",
          textAlign: "left",
          border: "none",
          cursor: "pointer",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: open ? `${accent}0a` : "transparent"
        }}
      >
        <span style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: open ? "#fff" : accent,
          background: open ? accent : `${accent}14`
        }}>
          {open ? "−" : "+"}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b", flex: 1 }}>
          {concept.name}
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          color: freqDot[concept.freq],
          background: `${freqDot[concept.freq]}18`,
          padding: "2px 7px",
          borderRadius: 10,
          letterSpacing: 0.5
        }}>
          {freqLabel[concept.freq]}
        </span>
      </button>
      
      {open && (
        <div style={{ padding: "0 14px 16px 46px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "#374151" }}>
            {concept.def}
          </p>
          <div style={{
            padding: "9px 13px",
            borderRadius: 7,
            background: "linear-gradient(135deg,#f0fdf4,#ecfdf5)",
            border: "1px solid #bbf7d0",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "#166534"
          }}>
            <strong>Exam tip:</strong> {concept.tip}
          </div>
          <div style={{
            padding: "9px 13px",
            borderRadius: 7,
            background: "linear-gradient(135deg,#fef2f2,#fff1f2)",
            border: "1px solid #fecaca",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "#991b1b"
          }}>
            <strong>Common mistake:</strong> {concept.mistake}
          </div>
          {concept.calc && (
            <div style={{
              padding: "8px 13px",
              borderRadius: 7,
              background: "#1e293b",
              fontSize: 12.5,
              color: "#e2e8f0",
              fontFamily: "'Menlo','Consolas',monospace",
              letterSpacing: 0.3
            }}>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>Calculator:</span> {concept.calc}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
