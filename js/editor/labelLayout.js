// 配線ラベル・チューブラベルの自動配置。
// コネクタ（型番表示を含む）・テキスト・他のラベルと重ならない位置を候補の中から選ぶ。
// 文字幅は概算（textWidth）なので、画面と PDF で同じ結果になる。
import { getPart } from '../catalog/connectors/index.js';
import { worldBounds } from '../core/geometry.js';
import { wirePoints } from '../core/wires.js';
import { tubeGeometry } from '../core/tubes.js';
import { textWidth, wireLabelBox } from '../render/wireRenderer.js';
import { tubeLabelSize, tubeLabelBox } from '../render/tubeRenderer.js';

export { tubeLabelBox };
import { textBounds } from '../render/textRenderer.js';

const GAP = 0.8; // ラベル同士・部品との最小すき間(mm)
// 中央に近い順: 0.5, 0.475, 0.525, 0.45, … 0.1, 0.9
const T_CANDIDATES = [0.5, ...Array.from({ length: 16 }, (_, i) => [0.475 - i * 0.025, 0.525 + i * 0.025]).flat()].map((t) => +t.toFixed(3));
const TUBE_K = [1, -1, 1.7, -1.7, 2.4, -2.4, 3.2, -3.2];

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP;
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP;
  return w > 0 && h > 0 ? w * h : 0;
}
const score = (box, obs) => obs.reduce((s, o) => s + overlapArea(box, o), 0);

/** コネクタ本体＋その下の型番表示の外形 */
function connectorBox(inst) {
  const part = getPart(inst.partId);
  if (!part || part.unavailable) return null;
  const b = worldBounds(inst, inst.showFlange !== false ? part.bounds : part.bodyBounds);
  const title = textWidth(`${inst.label}  ${part.partNo}（${part.polesLabel}）`, 3) * 1.05;
  const sub = textWidth(`${part.maker} ${part.series} ／ ${part.view}`, 2.2);
  const tw = Math.max(b.w, title, sub);
  const cx = b.x + b.w / 2;
  return { x: cx - tw / 2, y: b.y, w: tw, h: b.h + 8.5 };
}

/** 固定の障害物（コネクタ・テキスト） */
function fixedObstacles(page) {
  return [...page.connectors.map(connectorBox), ...page.texts.map(textBounds)].filter(Boolean);
}

/** 配線ラベルを置く位置 t（0〜1）。重ならない候補が無ければ重なりが最も小さい位置 */
export function bestWireLabelT(page, wire, display, obstacles) {
  const pts = wirePoints(page, wire);
  if (!pts) return wire.labelT ?? 0.5;
  let best = { t: wire.labelT ?? 0.5, s: Infinity };
  for (const t of T_CANDIDATES) {
    const box = wireLabelBox(page, wire, display, t, pts);
    if (!box) return best.t;
    const s = score(box, obstacles);
    if (s === 0) return t;
    if (s < best.s) best = { t, s };
  }
  return best.t;
}

/** チューブラベルの位置（範囲中央からのずれ）。既定位置で良ければ { labelDx:null, labelDy:null } */
export function bestTubeLabelOffset(page, tube, obstacles) {
  const base = { ...tube, labelDx: null, labelDy: null };
  const geo = tubeGeometry(page, base);
  if (!geo) return { labelDx: tube.labelDx, labelDy: tube.labelDy };
  const { w, h } = tubeLabelSize(page, base);
  let best = null;
  for (const k of TUBE_K) {
    // 下側に置く場合はラベルの高さ分も離す
    const extra = k < 0 ? h / 2 : 0;
    const len = Math.hypot(geo.label.dx, geo.label.dy) || 1;
    const dx = geo.label.dx * k + (geo.label.dx / len) * Math.sign(k) * extra;
    const dy = geo.label.dy * k + (geo.label.dy / len) * Math.sign(k) * extra;
    const box = { x: geo.mid.x + dx - w / 2, y: geo.mid.y + dy - h / 2, w, h };
    const s = score(box, obstacles);
    const cand = k === 1 ? { labelDx: null, labelDy: null, s } : { labelDx: +dx.toFixed(2), labelDy: +dy.toFixed(2), s };
    if (s === 0) return cand;
    if (!best || s < best.s) best = cand;
  }
  return { labelDx: best.labelDx, labelDy: best.labelDy };
}

/** ページ上の他のラベル（except で指定したものを除く）と固定の障害物 */
export function labelObstacles(page, display, except = {}) {
  const obs = fixedObstacles(page);
  for (const w of page.wires) {
    if (w.id === except.wireId) continue;
    const b = wireLabelBox(page, w, display);
    if (b) obs.push(b);
  }
  if (display?.tubeLabel !== false) {
    for (const t of page.tubes) {
      if (t.id === except.tubeId) continue;
      const b = tubeLabelBox(page, t);
      if (b) obs.push(b);
    }
  }
  return obs;
}

/** ページ内のすべてのラベルを配置し直す（page を直接書き換える） */
export function layoutPageLabels(page, display) {
  const fixed = fixedObstacles(page);
  const wires = page.wires;
  const boxes = new Map();
  const others = (id) => [...fixed, ...[...boxes].filter(([k]) => k !== id).map(([, b]) => b)];
  const place = (w) => {
    w.labelT = bestWireLabelT(page, w, display, others(w.id));
    const b = wireLabelBox(page, w, display);
    if (b) boxes.set(w.id, b); else boxes.delete(w.id);
  };
  // 1 回目: 順に置く → 2 回目以降: 重なっているラベルだけ、他のすべてを避けて置き直す
  for (const w of wires) place(w);
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const w of wires) {
      const b = boxes.get(w.id);
      if (!b || score(b, others(w.id)) === 0) continue;
      const before = w.labelT;
      // 重なりの相手を先に動かせるよう、自分を除いた状態で相手側も置き直す
      for (const o of wires) {
        const ob = boxes.get(o.id);
        if (o !== w && ob && overlapArea(b, ob) > 0) place(o);
      }
      place(w);
      if (w.labelT !== before) moved = true;
    }
    if (!moved) break;
  }
  if (display?.tubeLabel === false) return;
  const placed = [...fixed, ...boxes.values()];
  for (const t of page.tubes) {
    Object.assign(t, bestTubeLabelOffset(page, t, placed));
    const b = tubeLabelBox(page, t);
    if (b) placed.push(b);
  }
}
