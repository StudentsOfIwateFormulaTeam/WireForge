// 配線の経路・接続関係の計算
import { getPart, getPin } from '../catalog/connectors/index.js';
import { localToWorld } from './geometry.js';

/** ピンの図面座標。存在しなければ null */
export function pinWorld(page, end) {
  const inst = page.connectors.find((c) => c.id === end.connectorId);
  if (!inst) return null;
  const pin = getPin(getPart(inst.partId), end.pinId);
  if (!pin) return null;
  return localToWorld(inst, pin.x, pin.y);
}

/** 配線の折れ線（始点ピン → 中継点 → 終点ピン）。端点が無効なら null */
export function wirePoints(page, wire) {
  const a = pinWorld(page, wire.from);
  const b = pinWorld(page, wire.to);
  if (!a || !b) return null;
  return [a, ...(wire.waypoints || []), b];
}

export function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** 折れ線上の位置 t(0〜1, 長さ比) の座標と、その区間の向き(rad) */
export function pointAt(pts, t) {
  const total = polylineLength(pts);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (target <= seg || i === pts.length - 1) {
      const u = seg ? Math.min(1, target / seg) : 0;
      return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, angle: Math.atan2(y1 - y0, x1 - x0), segIndex: i - 1 };
    }
    target -= seg;
  }
  return { x: pts[0][0], y: pts[0][1], angle: 0, segIndex: 0 };
}

/** t0〜t1 の範囲の部分折れ線 */
export function subPolyline(pts, t0, t1) {
  const total = polylineLength(pts);
  const a = Math.min(t0, t1) * total, b = Math.max(t0, t1) * total;
  const out = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    const s0 = acc, s1 = acc + seg;
    const lerp = (d) => { const u = seg ? (d - s0) / seg : 0; return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u]; };
    if (s1 >= a && s0 <= b) {
      if (!out.length) out.push(lerp(Math.max(a, s0)));
      out.push(lerp(Math.min(b, s1)));
    }
    acc = s1;
  }
  return out;
}

/** 点から折れ線への最近点の t（0〜1）と距離 */
export function nearestT(pts, x, y) {
  const total = polylineLength(pts) || 1;
  let best = { t: 0, d: Infinity }, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const dx = x1 - x0, dy = y1 - y0, seg2 = dx * dx + dy * dy, seg = Math.sqrt(seg2);
    const u = seg2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / seg2)) : 0;
    const d = Math.hypot(x0 + dx * u - x, y0 + dy * u - y);
    if (d < best.d) best = { t: (acc + seg * u) / total, d };
    acc += seg;
  }
  return best;
}

const sameEnd = (a, b) => a.connectorId === b.connectorId && a.pinId === b.pinId;

/** ピンに接続されている配線 */
export function wiresAtPin(page, connectorId, pinId) {
  const e = { connectorId, pinId };
  return page.wires.filter((w) => sameEnd(w.from, e) || sameEnd(w.to, e));
}

/** 配線の反対側の端 */
export function otherEnd(wire, connectorId, pinId) {
  return sameEnd(wire.from, { connectorId, pinId }) ? wire.to : wire.from;
}

/**
 * ネット（ピンを共有して電気的につながっている配線の集合）を求める。
 * 同じピンに 2 本以上の配線があれば、それらは同じネット。
 */
export function netOfWire(page, wireId) {
  const key = (e) => `${e.connectorId}:${e.pinId}`;
  const start = page.wires.find((w) => w.id === wireId);
  if (!start) return new Set();
  const net = new Set([start.id]);
  const pins = [key(start.from), key(start.to)];
  const seen = new Set(pins);
  while (pins.length) {
    const k = pins.pop();
    for (const w of page.wires) {
      if (net.has(w.id)) continue;
      if (key(w.from) === k || key(w.to) === k) {
        net.add(w.id);
        for (const e of [key(w.from), key(w.to)]) if (!seen.has(e)) { seen.add(e); pins.push(e); }
      }
    }
  }
  return net;
}

export function endLabel(page, end) {
  const inst = page.connectors.find((c) => c.id === end.connectorId);
  const pin = inst && getPin(getPart(inst.partId), end.pinId);
  return inst && pin ? `${inst.label}-${pin.label}` : '?';
}
