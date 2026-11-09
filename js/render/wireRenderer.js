// 配線の描画（線・ラベル）
import { s } from './svg.js';
import { colorOf, gaugeOf, formatLength, specText } from '../catalog/wireSpecs.js';
import { wirePoints, pointAt, endLabel } from '../core/wires.js';

const LABEL_FONT = 2.3; // mm
const CASING = 0.28; // 縁取りの幅（片側合計, mm）

const ptsAttr = (pts) => pts.map(([x, y]) => `${+x.toFixed(3)},${+y.toFixed(3)}`).join(' ');

/** 文字幅の概算（全角 1em / 半角 0.56em）。DOM 計測を使わず画面と PDF で同じ結果にする */
export function textWidth(str, size) {
  let w = 0;
  for (const ch of str) w += /[\u0000-ÿ]/.test(ch) ? 0.56 : 1.0;
  return w * size;
}

export function wireLabelLines(page, wire, display) {
  const lines = [];
  const head = [];
  if (display.wireName && wire.name) head.push(wire.name);
  if (display.wireEnds) head.push(`${endLabel(page, wire.from)} ⇔ ${endLabel(page, wire.to)}`);
  if (head.length) lines.push({ text: head.join('  '), cls: 'wl-name' });
  const tail = [];
  if (display.wireSpec) tail.push(specText(wire));
  if (display.wireLength) {
    const L = formatLength(wire);
    if (L) tail.push(`L=${L}`);
  }
  if (tail.length) lines.push({ text: tail.join('  '), cls: 'wl-spec' });
  return lines;
}

/**
 * @param opts { display, state: 'selected'|'net'|null, forPrint }
 * @returns { line, label } 線はコネクタの下、ラベルはコネクタの上のレイヤに置く
 */
export function renderWire(page, wire, opts = {}) {
  const pts = wirePoints(page, wire);
  if (!pts) return { line: null, label: null };
  const color = colorOf(wire.color);
  const width = gaugeOf(wire.gauge).stroke;
  const g = s('g', { class: 'wire' + (opts.state ? ` wire-${opts.state}` : ''), 'data-kind': 'wire', 'data-id': wire.id });

  const p = ptsAttr(pts);
  if (!opts.forPrint) g.appendChild(s('polyline', { class: 'wire-hit', points: p }));
  if (opts.state) g.appendChild(s('polyline', { class: 'wire-glow', points: p, 'stroke-width': width + 2.2 }));
  g.appendChild(s('polyline', { class: 'wire-casing', points: p, 'stroke-width': width + CASING }));
  g.appendChild(s('polyline', { class: 'wire-core', points: p, stroke: color.hex, 'stroke-width': width }));

  // ラベル
  const lines = wireLabelLines(page, wire, opts.display || {});
  if (lines.length) {
    const at = pointAt(pts, wire.labelT ?? 0.5);
    const lh = LABEL_FONT * 1.35;
    const w = Math.max(...lines.map((l) => textWidth(l.text, LABEL_FONT))) + 2.2;
    const h = lines.length * lh + 0.8;
    const lg = s('g', { class: 'wire-label' + (opts.state ? ` wl-${opts.state}` : ''), 'data-kind': 'wire-label', 'data-id': wire.id });
    lg.appendChild(s('rect', { x: at.x - w / 2, y: at.y - h / 2, width: w, height: h, rx: 0.6, class: 'wl-bg' }));
    lg.appendChild(s('rect', { x: at.x - w / 2, y: at.y - h / 2, width: 1.0, height: h, class: 'wl-swatch', fill: color.hex }));
    lines.forEach((l, i) => {
      lg.appendChild(s('text', {
        x: at.x + 0.5,
        y: at.y - h / 2 + 0.4 + lh * (i + 0.5),
        'font-size': LABEL_FONT,
        class: l.cls,
      }, l.text));
    });
    return { line: g, label: lg };
  }
  return { line: g, label: null };
}
