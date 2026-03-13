import { useState } from "react";
import ConceptMap from "./ConceptMap";
import WhichTest from "./WhichTest";
import QuickRef from "./QuickRef";

const tabs = [
  { id: "map", label: "Concept Map", icon: "M" },
  { id: "test", label: "Which Test?", icon: "?" },
  { id: "ref", label: "Quick Reference", icon: "R" },
];

export default function APStatsTool() {
  const [tab, setTab] = useState("map");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>
          AP Statistics Study Tool
        </h1>
        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: tab === t.id ? "#2563eb" : "#f1f5f9",
                color: tab === t.id ? "#fff" : "#1e293b",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s"
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
                fontWeight: 700
              }}>
                {t.icon}
              </span>
              {t.label}
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
