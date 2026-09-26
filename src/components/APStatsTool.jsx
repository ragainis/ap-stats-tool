import { useState } from "react";
import ConceptMap from "./ConceptMap";
import WhichTest from "./WhichTest";
import QuickRef from "./QuickRef";

const tabs = [
  { id: "map", label: "Concept Map", shortLabel: "Map", icon: "M" },
  { id: "test", label: "Which Test?", shortLabel: "Test", icon: "?" },
  { id: "ref", label: "Quick Reference", shortLabel: "Ref", icon: "R" },
];

export default function APStatsTool() {
  const [tab, setTab] = useState("map");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(12px, 4vw, 20px)" }}>
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", margin: "0 0 12px" }}>
          <h1 style={{
            fontSize: "clamp(18px, 5vw, 24px)",
            fontWeight: 700,
            color: "#1e293b",
            margin: 0
          }}>
            AP Statistics Study Tool
          </h1>
          <a href="/" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>← mezins.com</a>
        </div>
        <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: tab === t.id ? "#2563eb" : "#f1f5f9",
                color: tab === t.id ? "#fff" : "#1e293b",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "clamp(12px, 3vw, 14px)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
                minHeight: 44,
                flex: "1 1 auto"
              }}
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                background: tab === t.id ? "rgba(255,255,255,0.2)" : "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0
              }}>
                {t.icon}
              </span>
              <span className="tab-label-full" style={{ display: "inline" }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {tab === "map" && <ConceptMap onNav={setTab} />}
      {tab === "test" && <WhichTest onNav={setTab} />}
      {tab === "ref" && <QuickRef onNav={setTab} />}
    </div>
  );
}
