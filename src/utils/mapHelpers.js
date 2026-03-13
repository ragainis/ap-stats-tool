import { nodes } from '../data/nodes';
import { edges } from '../data/edges';

export const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

export function mkPath(fromId, toId) {
  const s = nodeMap[fromId];
  const t = nodeMap[toId];
  if (!s || !t) return "";
  
  if (s.tier === t.tier) {
    const d = t.cx > s.cx ? 1 : -1;
    const m = (s.cx + t.cx) / 2;
    return `M${s.cx + d * 48},${s.cy} Q${m},${s.cy - 30} ${t.cx - d * 48},${t.cy}`;
  }
  
  const sy = s.cy + 18;
  const ty = t.cy - 18;
  const my = (sy + ty) / 2;
  return `M${s.cx},${sy} C${s.cx},${my} ${t.cx},${my} ${t.cx},${ty}`;
}

export function connectionCount(id) {
  return edges.filter(e => e.from === id || e.to === id).length;
}

export const freqDot = { high: "#ef4444", med: "#f59e0b", low: "#d1d5db" };
export const freqLabel = { high: "HIGH", med: "MED", low: "LOW" };
