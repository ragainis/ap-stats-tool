import { useState, useCallback, useMemo } from "react";
import { U } from "../data/units";
import { nodes } from "../data/nodes";
import { edges } from "../data/edges";
import { nodeMap, mkPath, connectionCount } from "../utils/mapHelpers";
import ConceptCard from "./ConceptCard";

const W = 940, H = 455;

const bands = [
  { y: 38, h: 68, l: "DATA GATHERING", f: "#f0fdf4" },
  { y: 198, h: 68, l: "MATHEMATICAL BRIDGE", f: "#fffbeb" },
  { y: 358, h: 68, l: "INFERENCE", f: "#fef2f2" }
];

const regs = [
  { u: "eda", x: 22, y: 42, w: 520, h: 60 },
  { u: "collect", x: 558, y: 42, w: 365, h: 60 },
  { u: "prob", x: 118, y: 202, w: 688, h: 60 },
  { u: "inference", x: 22, y: 362, w: 900, h: 60 }
];

export default function ConceptMap({ onNav }) {
  const [hov, setHov] = useState(null);
  const [sel, setSel] = useState(null);
  const [openC, setOpenC] = useState(null);

  const hEdges = useMemo(() => {
    if (!hov) return new Set();
    return new Set(edges.map((e, i) => (e.from === hov || e.to === hov) ? i : -1).filter(i => i >= 0));
  }, [hov]);

  const hNodes = useMemo(() => {
    if (!hov) return new Set();
    const s = new Set([hov]);
    edges.forEach(e => {
      if (e.from === hov) s.add(e.to);
      if (e.to === hov) s.add(e.from);
    });
    return s;
  }, [hov]);

  const sn = sel ? nodeMap[sel] : null;
  const su = sn ? U[sn.unit] : null;
  const sIn = sel ? edges.filter(e => e.to === sel) : [];
  const sOut = sel ? edges.filter(e => e.from === sel) : [];

  const click = useCallback(id => {
    setSel(p => {
      const n = p === id ? null : id;
      if (n !== p) setOpenC(null);
      return n;
    });
  }, []);

  return (
    <div>
      <div style={{ background: "#fafaf9", borderRadius: 12, border: "1px solid #e5e5e5", padding: "6px 0", overflow: "hidden" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          onMouseLeave={() => setHov(null)}
          onClick={e => {
            if (e.target.tagName === "svg" || (e.target.tagName === "rect" && e.target.dataset.bg)) {
              setSel(null);
              setOpenC(null);
            }
          }}
        >
          <defs>
            <marker id="ah" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="6" markerHeight="5" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="#94a3b8" />
            </marker>
            {Object.entries(U).map(([k, u]) => (
              <marker key={k} id={`ah-${k}`} viewBox="0 0 8 6" refX="7" refY="3" markerWidth="6" markerHeight="5" orient="auto">
                <polygon points="0 0,8 3,0 6" fill={u.color} />
              </marker>
            ))}
          </defs>

          {/* Background bands */}
          {bands.map((b, i) => (
            <g key={i}>
              <rect x={0} y={b.y} width={W} height={b.h} fill={b.f} data-bg="true" />
              <text x={16} y={b.y + 12} fontSize={8.5} fontWeight={700} fill="#94a3b8" letterSpacing="1.2">{b.l}</text>
              <text x={W - 16} y={b.y + 12} fontSize={8.5} fontWeight={700} fill="#94a3b8" textAnchor="end">
                {i === 0 ? `${U.eda.weight} + ${U.collect.weight}` : i === 1 ? U.prob.weight : U.inference.weight}
              </text>
            </g>
          ))}

          {/* Region outlines */}
          {regs.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={8} fill="none"
              stroke={U[r.u].color} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.4} data-bg="true" />
          ))}

          {/* Edges */}
          {edges.map((e, i) => {
            const su2 = nodeMap[e.from]?.unit;
            const col = U[su2]?.color || "#94a3b8";
            const hi = hEdges.has(i);
            const dim = hov && !hi;
            return (
              <g key={i}>
                <path
                  d={mkPath(e.from, e.to)}
                  fill="none"
                  stroke={hi ? col : "#b0b8c4"}
                  strokeWidth={hi ? 2.5 : 1}
                  opacity={dim ? 0.08 : hi ? 0.9 : 0.2}
                  markerEnd={hi ? `url(#ah-${su2})` : "url(#ah)"}
                  style={{ transition: "opacity .2s" }}
                />
                {hi && (() => {
                  const s = nodeMap[e.from], t = nodeMap[e.to];
                  const mx = (s.cx + t.cx) / 2;
                  const my = s.tier === t.tier ? s.cy - 18 : (s.cy + t.cy) / 2 - 4;
                  return <text x={mx} y={my} textAnchor="middle" fontSize={8.5} fill={col} fontWeight={600} opacity={0.85}>{e.why}</text>;
                })()}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const u = U[n.unit];
            const cnt = connectionCount(n.id);
            const hub = cnt >= 6;
            const isH = hov === n.id;
            const isS = sel === n.id;
            const isC = hNodes.has(n.id);
            const dim = hov && !isC;
            const hw = n.label.length > 14 ? 62 : n.label.length > 10 ? 54 : 46;

            return (
              <g
                key={n.id}
                onMouseEnter={() => setHov(n.id)}
                onClick={ev => { ev.stopPropagation(); click(n.id); }}
                style={{ cursor: "pointer", transition: "opacity .2s" }}
                opacity={dim ? 0.15 : 1}
              >
                {hub && !dim && (
                  <rect x={n.cx - hw - 2} y={n.cy - 19} width={(hw + 2) * 2} height={38} rx={19}
                    fill={u.color} opacity={isH ? 0.2 : 0.07} />
                )}
                <rect x={n.cx - hw} y={n.cy - 17} width={hw * 2} height={34} rx={17}
                  fill={isH || isS ? u.color : "#fff"}
                  stroke={u.color}
                  strokeWidth={isH || isS ? 2 : isC ? 2 : 1.2}
                  filter={isH ? "drop-shadow(0 2px 6px rgba(0,0,0,.15))" : "none"}
                />
                <text x={n.cx} y={n.cy + 1} textAnchor="middle" dominantBaseline="central"
                  fontSize={11} fontWeight={600} fill={isH || isS ? "#fff" : "#1e293b"}
                  style={{ pointerEvents: "none", userSelect: "none" }}>
                  {n.label}
                </text>
                {cnt > 0 && !dim && (
                  <g>
                    <circle cx={n.cx + hw - 6} cy={n.cy - 15} r={7} fill={u.color} opacity={isH ? 1 : 0.75} />
                    <text x={n.cx + hw - 6} y={n.cy - 14} textAnchor="middle" dominantBaseline="central"
                      fontSize={8} fontWeight={700} fill="#fff">{cnt}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hov && (() => {
            const n = nodeMap[hov];
            if (!n) return null;
            const bW = 310;
            let bX = Math.max(10, Math.min(n.cx - bW / 2, W - bW - 10));
            const bY = n.tier === 3 ? n.cy - 64 : n.cy + 28;
            const ws = n.narrative.split(" ");
            const ls = [];
            let c = "";
            ws.forEach(w => {
              if ((c + " " + w).length > 52) { ls.push(c); c = w; }
              else c = c ? c + " " + w : w;
            });
            if (c) ls.push(c);
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={bX} y={bY} width={bW} height={14 + ls.length * 14} rx={6} fill="#1e293b" opacity={0.92} />
                {ls.map((l, li) => <text key={li} x={bX + 10} y={bY + 16 + li * 14} fontSize={10.5} fill="#e2e8f0">{l}</text>)}
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Selected node detail panel */}
      {sn && (
        <div style={{ marginTop: 10, borderRadius: 12, border: `2px solid ${su.color}`, overflow: "hidden", background: "#fff" }}>
          <div style={{ background: su.color, color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {su.label} · {su.title}
              </span>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{sn.label}</div>
            </div>
            <button
              onClick={() => { setSel(null); setOpenC(null); }}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              X
            </button>
          </div>
          <div style={{ padding: "14px 16px" }}>
            {(sOut.length > 0 || sIn.length > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {sIn.map((e, i) => {
                  const s = nodeMap[e.from], su3 = U[s.unit];
                  return (
                    <span key={"i" + i} onClick={() => click(s.id)} style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 20,
                      background: `${su3.color}10`, color: su3.color, fontWeight: 600,
                      border: `1px solid ${su3.color}28`, cursor: "pointer"
                    }}>
                      ← {s.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>({e.why})</span>
                    </span>
                  );
                })}
                {sOut.map((e, i) => {
                  const t = nodeMap[e.to], tu = U[t.unit];
                  return (
                    <span key={"o" + i} onClick={() => click(t.id)} style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 20,
                      background: `${tu.color}10`, color: tu.color, fontWeight: 600,
                      border: `1px solid ${tu.color}28`, cursor: "pointer"
                    }}>
                      → {t.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>({e.why})</span>
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8 }}>
                {sn.concepts.length} Concepts
              </h4>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>— expand for definition, exam tip, common mistake</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sn.concepts.map((c2, i) => {
                const k = `${sel}-${i}`;
                return <ConceptCard key={k} concept={c2} open={openC === k} toggle={() => setOpenC(openC === k ? null : k)} accent={su.color} />;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
