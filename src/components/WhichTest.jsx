import { useState } from "react";
import { tree } from "../data/tree";
import { procedures } from "../data/procedures";

const PM = Object.fromEntries(procedures.map(p => [p.id, p]));

export default function WhichTest({ onNav }) {
  const [path, setPath] = useState([]);
  const [result, setResult] = useState(null);

  const reset = () => { setPath([]); setResult(null); };

  const choose = (opt, stepIdx) => {
    const newPath = [...path.slice(0, stepIdx), opt.label];
    if (opt.result) {
      setPath(newPath);
      setResult(opt.result);
    } else {
      setPath(newPath);
      setResult(null);
    }
  };

  const currentStep = path.length;
  const proc = result ? PM[result] : null;

  return (
    <div>
      {/* Breadcrumbs */}
      {path.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280", fontWeight: 600 }}
          >
            Start over
          </button>
          {path.map((p, i) => (
            <span key={i} style={{ fontSize: 12, color: "#4b5563", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#d1d5db" }}>&gt;</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>{p}</span>
            </span>
          ))}
        </div>
      )}

      {/* Steps */}
      {!result && tree.slice(0, currentStep + 1).map((step, si) => {
        if (si < currentStep) return null;
        return (
          <div key={si} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 12px" }}>{step.q}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 10 }}>
              {step.opts.map((o, oi) => (
                <button
                  key={oi}
                  onClick={() => choose(o, si)}
                  style={{
                    padding: "clamp(14px, 4vw, 18px)", borderRadius: 10, border: "2px solid #e5e7eb",
                    background: "#fff", cursor: "pointer", textAlign: "left",
                    fontSize: "clamp(13px, 3.5vw, 14px)", fontWeight: 600, color: "#1e293b", transition: "all .15s",
                    minHeight: 48
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = "#2563eb"; e.target.style.background = "#eff6ff"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#fff"; }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Result card */}
      {proc && (
        <div style={{ borderRadius: 12, border: "2px solid #dc2626", overflow: "hidden", background: "#fff" }}>
          <div style={{ background: "#dc2626", color: "#fff", padding: "clamp(12px, 3vw, 14px) clamp(14px, 4vw, 18px)" }}>
            <div style={{ fontSize: "clamp(10px, 2.5vw, 11px)", opacity: 0.8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Procedure identified</div>
            <div style={{ fontSize: "clamp(18px, 5vw, 22px)", fontWeight: 700, marginTop: 2 }}>{proc.name}</div>
            <div style={{ fontSize: "clamp(12px, 3vw, 13px)", opacity: 0.9, marginTop: 4 }}>{proc.when}</div>
          </div>
          <div style={{ padding: "clamp(12px, 3vw, 16px) clamp(14px, 4vw, 18px)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Hypotheses</div>
              <div style={{ fontSize: 14, color: "#1e293b", fontFamily: "'Menlo','Consolas',monospace" }}>H0: {proc.h0}</div>
              <div style={{ fontSize: 14, color: "#1e293b", fontFamily: "'Menlo','Consolas',monospace" }}>Ha: {proc.ha}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Conditions (check all three)</div>
              {proc.conditions.map((c3, i) => (
                <div key={i} style={{ fontSize: 13, color: "#334155", padding: "4px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: "#059669", fontWeight: 700 }}>[ ]</span>{c3}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Formulas</div>
              <div style={{
                padding: "10px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0",
                fontFamily: "'Menlo','Consolas',monospace", fontSize: 13, lineHeight: 1.8, color: "#1e293b"
              }}>
                <div><span style={{ color: "#6b7280", fontSize: 11 }}>Test stat: </span>{proc.testStat}</div>
                {proc.ci !== "(no CI for Chi-Square)" && <div><span style={{ color: "#6b7280", fontSize: 11 }}>CI: </span>{proc.ci}</div>}
              </div>
            </div>
            <div style={{
              padding: "10px 14px", borderRadius: 8, background: "#1e293b",
              fontFamily: "'Menlo','Consolas',monospace", fontSize: 12.5, color: "#e2e8f0"
            }}>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>Calculator: </span>{proc.calc}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Conclusion template</div>
              <div style={{
                fontSize: 13, color: "#334155", lineHeight: 1.65, fontStyle: "italic",
                padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0"
              }}>
                "{proc.conclude}"
              </div>
            </div>
            <div style={{
              padding: "10px 14px", borderRadius: 8, background: "#fef2f2",
              border: "1px solid #fecaca", fontSize: 12.5, color: "#991b1b", lineHeight: 1.6
            }}>
              <strong>Watch out:</strong> {proc.mistake}
            </div>
            <button
              onClick={() => onNav("map")}
              style={{
                alignSelf: "flex-start", padding: "8px 16px", borderRadius: 8,
                border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb",
                fontWeight: 600, fontSize: 13, cursor: "pointer"
              }}
            >
              View in Concept Map →
            </button>
          </div>
        </div>
      )}

      {!result && path.length === 0 && (
        <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 14, lineHeight: 1.7, marginTop: 20 }}>
          Read an FRQ stem and can't tell which test to use?<br />Answer 2-3 questions above and get the full procedure card.
        </div>
      )}
    </div>
  );
}
