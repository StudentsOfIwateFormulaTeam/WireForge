// コルゲートチューブの描画（蛇腹の帯 + ラベル）
import { s } from './svg.js';
import { textWidth } from './wireRenderer.js';
import { TUBE_MAKER, tubeColorOf, formatTubeLength } from '../catalog/tubeSpecs.js';
import { tubeGeometry } from '../core/tubes.js';
import { pointAt, endLabel } from '../core/wires.js';

const LABEL_FONT = 2.3; // mm

const ptsAttr = (pts) => pts.map(([x, y]) => `${+x.toFixed(3)},${+y.toFixed(3)}`).join(' ');
const f = (v) => +v.toFixed(3);

function wireShortName(page, id) {
  const w = page.wires.find((x) => x.id === id);
  if (!w) return '?';
  return w.name || `${endLabel(page, w.from)}⇔${endLabel(page, w.to)}`;
}

export function tubeLabelLines(page, tube) {
  const c = tubeColorOf(tube.color);
  const lines = [{ text: `${tube.label}  ${TUBE_MAKER} コルゲート 内径φ${tube.size} ${c.name}`, cls: 'tl-name' }];
  const tail = [];
  const L = formatTubeLength(tube);
  if (L) tail.push(`L=${L}`);
  const names = tube.wireIds.map((id) => wireShortName(page, id));
  const shown = names.length > 3 ? [...names.slice(0, 3), `他${names.length - 3}本`] : names;
  tail.push(`対象: ${shown.join(', ')}`);
  lines.push({ text: tail.join('  '), cls: 'tl-spec' });
  return lines;
}

/** ラベルの寸法 { w, h, lh } */
export function tubeLabelSize(page, tube) {
  const lines = tubeLabelLines(page, tube);
  const lh = LABEL_FONT * 1.35;
  return { lines, lh, w: Math.max(...lines.map((l) => textWidth(l.text, LABEL_FONT))) + 2.6, h: lines.length * lh + 0.8 };
}

/** ラベルの外形（図面座標）。描けないチューブは null */
export function tubeLabelBox(page, tube) {
  const geo = tubeGeometry(page, tube);
  if (!geo) return null;
  const { w, h } = tubeLabelSize(page, tube);
  return { x: geo.label.x - w / 2, y: geo.label.y - h / 2, w, h };
}

/**
 * @param opts { display, selected, forPrint }
 * @returns { body, label } 帯は配線の上・コネクタの下、ラベルは最前面のレイヤに置く
 */
export function renderTube(page, tube, opts = {}) {
  const geo = tubeGeometry(page, tube);
  if (!geo) return { body: null, label: null };
  const c = tubeColorOf(tube.color);
  const { pts, width } = geo;
  const p = ptsAttr(pts);
  const g = s('g', { class: 'tube' + (opts.selected ? ' tube-selected' : ''), 'data-kind': 'tube', 'data-id': tube.id });

  if (opts.selected) g.appendChild(s('polyline', { class: 'tube-glow', points: p, 'stroke-width': width + 2.4 }));
  g.appendChild(s('polyline', { class: 'tube-edge', points: p, stroke: c.edge, 'stroke-width': width + 0.35 }));
  g.appendChild(s('polyline', { class: 'tube-body', points: p, stroke: c.hex, 'stroke-width': width }));

  // 蛇腹（山）: 経路に直交する短い線を一定間隔で並べる
  const pitch = Math.max(0.75, width * 0.3);
  const half = width / 2 - 0.12;
  const n = Math.floor(geo.drawnLength / pitch);
  const off = (geo.drawnLength - (n - 1) * pitch) / 2;
  let d = '';
  for (let i = 0; i < n; i++) {
    const at = pointAt(pts, (off + i * pitch) / geo.drawnLength);
    const nx = -Math.sin(at.angle) * half, ny = Math.cos(at.angle) * half;
    d += `M${f(at.x + nx)} ${f(at.y + ny)}L${f(at.x - nx)} ${f(at.y - ny)}`;
  }
  if (d) g.appendChild(s('path', { class: 'tube-rib', d, stroke: c.rib, 'stroke-width': pitch * 0.38 }));

  // ラベル（引き出し線付き）
  if (opts.display?.tubeLabel === false) return { body: g, label: null };
  const { lines, lh, w, h } = tubeLabelSize(page, tube);
  const { x, y } = geo.label;
  const lg = s('g', { class: 'tube-label' + (opts.selected ? ' tl-selected' : ''), 'data-kind': 'tube-label', 'data-id': tube.id });
  // 引き出し線は帯と同じレイヤ（配線ラベルより下）に置き、ラベル同士の重なりを避ける
  g.appendChild(s('line', { class: 'tl-leader', x1: f(geo.mid.x), y1: f(geo.mid.y), x2: f(x), y2: f(y) }));
  g.appendChild(s('circle', { class: 'tl-dot', cx: f(geo.mid.x), cy: f(geo.mid.y), r: 0.45 }));
  lg.appendChild(s('rect', { x: f(x - w / 2), y: f(y - h / 2), width: f(w), height: f(h), rx: 0.6, class: 'tl-bg' }));
  lg.appendChild(s('rect', { x: f(x - w / 2), y: f(y - h / 2), width: 1.3, height: f(h), class: 'tl-swatch', fill: c.hex }));
  lines.forEach((l, i) => {
    lg.appendChild(s('text', { x: f(x + 0.65), y: f(y - h / 2 + 0.4 + lh * (i + 0.5)), 'font-size': LABEL_FONT, class: l.cls }, l.text));
  });
  return { body: g, label: lg };
}
