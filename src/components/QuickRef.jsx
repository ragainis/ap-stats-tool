import { useState } from "react";
import { procedures } from "../data/procedures";
import { U } from "../data/units";

const scopeTable = [
  ["", "Random Sampling: YES", "Random Sampling: NO"],
  ["Random Assignment: YES", "Generalize to population + Causal conclusion", "Causal conclusion for subjects in study only"],
  ["Random Assignment: NO", "Generalize to population, Association only", "Association for subjects in study only"]
];

export default function QuickRef({ onNav }) {
  const [open, setOpen] = useState(null);
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>8 procedures + Scope of Inference. Night-before-the-exam review.</p>
        <button
          onClick={() => setExpandAll(!expandAll)}
          style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#4b5563", fontWeight: 600 }}
        >
          {expandAll ? "Collapse all" : "Expand all"}
        </button>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {procedures.map(p => {
          const isOpen = expandAll || open === p.id;
          return (
            <div key={p.id} style={{ borderRadius: 10, border: `1.5px solid ${isOpen ? "#dc2626" : "#e5e7eb"}`, overflow: "hidden", background: "#fff" }}>
              <button
                onClick={() => setOpen(open === p.id ? null : p.id)}
                style={{
                  width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                  padding: "clamp(10px, 3vw, 12px) clamp(12px, 3vw, 16px)", display: "flex", alignItems: "center", gap: 10,
                  background: isOpen ? "#fef2f2" : "transparent",
                  minHeight: 48
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 12,
                  background: isOpen ? "#dc2626" : "#fee2e2",
                  color: isOpen ? "#fff" : "#dc2626",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0
                }}>
                  {isOpen ? "−" : "+"}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 11.5, color: "#6b7280", fontWeight: 500 }}>
                  {p.when.split(" ").slice(0, 5).join(" ")}...
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: "0 16px 16px 50px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>{p.when}</p>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Hypotheses</div>
                    <div style={{ fontFamily: "'Menlo','Consolas',monospace", fontSize: 12.5, color: "#1e293b" }}>H0: {p.h0}</div>
                    <div style={{ fontFamily: "'Menlo','Consolas',monospace", fontSize: 12.5, color: "#1e293b" }}>Ha: {p.ha}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Conditions</div>
                    {p.conditions.map((c, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: "#334155", padding: "2px 0" }}>• {c}</div>
                    ))}
                  </div>
                  <div style={{
                    padding: "8px 12px", borderRadius: 6, background: "#f8fafc",
                    fontFamily: "'Menlo','Consolas',monospace", fontSize: 12, lineHeight: 1.7, color: "#1e293b"
                  }}>
                    <div><span style={{ color: "#6b7280", fontSize: 10.5 }}>Test: </span>{p.testStat}</div>
                    {p.ci !== "(no CI for Chi-Square)" && <div><span style={{ color: "#6b7280", fontSize: 10.5 }}>CI: </span>{p.ci}</div>}
                  </div>
                  <div style={{
                    padding: "6px 12px", borderRadius: 6, background: "#1e293b",
                    fontFamily: "'Menlo','Consolas',monospace", fontSize: 11.5, color: "#e2e8f0"
                  }}>
                    <span style={{ color: "#94a3b8", fontSize: 10 }}>Calculator: </span>{p.calc}
                  </div>
                  <div style={{
                    padding: "8px 12px", borderRadius: 6, background: "#fef2f2",
                    border: "1px solid #fecaca", fontSize: 12, color: "#991b1b"
                  }}>
                    <strong>Watch out:</strong> {p.mistake}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scope of Inference Table */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>Scope of Inference (2x2)</h3>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse", fontSize: "clamp(11px, 2.5vw, 12px)" }}>
            <tbody>
              {scopeTable.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        background: ri === 0 || ci === 0 ? "#f8fafc" : "#fff",
                        fontWeight: ri === 0 || ci === 0 ? 600 : 400,
                        color: ri === 0 || ci === 0 ? "#64748b" : "#1e293b",
                        textAlign: ci === 0 ? "left" : "center"
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 8, fontSize: 11.5, color: "#6b7280" }}>
          Ask yourself after every hypothesis test: Can I generalize? Can I claim causation?
        </p>
      </div>
    </div>
  );
}
