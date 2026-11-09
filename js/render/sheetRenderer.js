// 1 ページ分の図面を描画する。画面表示と PDF 出力の両方でこの関数を使い、レイアウトを一致させる。
import { s } from './svg.js';
import { renderConnector } from './connectorRenderer.js';
import { renderWire } from './wireRenderer.js';
import { renderTube } from './tubeRenderer.js';
import { renderText, renderTitleBlock } from './textRenderer.js';
import { getPart } from '../catalog/connectors/index.js';
import { colorOf } from '../catalog/wireSpecs.js';
import { PAPER_SIZES, defaultSettings } from '../core/model.js';
import { netOfWire, wiresAtPin } from '../core/wires.js';

export const FRAME_MARGIN = 10; // 図枠の余白(mm)

export function paperOf(page) {
  return PAPER_SIZES[page.paper] || PAPER_SIZES['A4-landscape'];
}

/** 選択状態から強調表示する配線を決める: Map(wireId -> 'selected'|'net') */
function highlightMap(page, sel) {
  const m = new Map();
  if (!sel) return m;
  let seeds = [];
  if (sel.kind === 'tube') {
    for (const id of page.tubes.find((t) => t.id === sel.id)?.wireIds || []) m.set(id, 'net');
    return m;
  }
  if (sel.kind === 'wire') seeds = [sel.id];
  else if (sel.kind === 'pin') seeds = wiresAtPin(page, sel.connectorId, sel.pinId).map((w) => w.id);
  for (const id of seeds) for (const w of netOfWire(page, id)) m.set(w, 'net');
  if (sel.kind === 'wire') m.set(sel.id, 'selected');
  return m;
}

/**
 * @param page   ページデータ
 * @param opts   { selection, showGrid, display, forPrint, info:{ projectName, pageNo, pageCount } }
 * @returns SVG <g>（座標単位 mm, 原点 = 用紙左上）
 */
export function renderSheet(page, opts = {}) {
  const paper = paperOf(page);
  const display = opts.display || defaultSettings().display;
  const sel = opts.forPrint ? null : opts.selection;
  const g = s('g', { class: 'sheet' });

  g.appendChild(s('rect', { class: 'paper', x: 0, y: 0, width: paper.w, height: paper.h, 'data-kind': 'paper' }));

  if (opts.showGrid && !opts.forPrint) {
    g.appendChild(s('rect', { class: 'grid', x: 0, y: 0, width: paper.w, height: paper.h, fill: 'url(#grid-pattern)', 'pointer-events': 'none' }));
  }

  // 図枠
  const m = FRAME_MARGIN;
  g.appendChild(s('rect', { class: 'frame', x: m, y: m, width: paper.w - 2 * m, height: paper.h - 2 * m, 'pointer-events': 'none' }));

  // 表題欄
  if (page.titleBlock?.show !== false) {
    const info = { projectName: '', pageName: page.name, pageNo: 1, pageCount: 1, ...(opts.info || {}) };
    g.appendChild(renderTitleBlock(page.titleBlock || {}, paper, m, info, { selected: sel?.kind === 'titleBlock' }));
  }

  // 図面の内容（PDF 出力時、用紙からはみ出す場合はこのグループを縮小する）
  const content = s('g', { class: 'content' });
  g.appendChild(content);

  // 配線（線はコネクタの下、ラベルはコネクタの上）
  const hl = highlightMap(page, sel);
  const wireLayer = s('g', { class: 'layer-wires' });
  const labelLayer = s('g', { class: 'layer-wire-labels' });
  for (const w of page.wires) {
    const { line, label } = renderWire(page, w, { display, state: hl.get(w.id) || null, forPrint: opts.forPrint });
    if (line) wireLayer.appendChild(line);
    if (label) labelLayer.appendChild(label);
  }
  content.appendChild(wireLayer);

  // コルゲートチューブ（配線の上、コネクタの下）
  const tubeLayer = s('g', { class: 'layer-tubes' });
  const tubeLabelLayer = s('g', { class: 'layer-tube-labels' });
  for (const t of page.tubes) {
    const { body, label } = renderTube(page, t, { display, selected: sel?.kind === 'tube' && sel.id === t.id, forPrint: opts.forPrint });
    if (body) tubeLayer.appendChild(body);
    if (label) tubeLabelLayer.appendChild(label);
  }
  content.appendChild(tubeLayer);

  // ピンの色 = 接続されている配線の色（複数ある場合は最初の配線）
  const pinColor = new Map();
  for (const w of page.wires) {
    for (const e of [w.from, w.to]) {
      const k = `${e.connectorId}:${e.pinId}`;
      if (!pinColor.has(k)) pinColor.set(k, colorOf(w.color).hex);
    }
  }

  const layer = s('g', { class: 'layer-connectors' });
  for (const inst of page.connectors) {
    const part = getPart(inst.partId);
    if (!part || part.unavailable) {
      layer.appendChild(s('text', { x: inst.x, y: inst.y, class: 'missing-part' }, `部品データなし: ${inst.partId}`));
      continue;
    }
    layer.appendChild(
      renderConnector(inst, part, {
        selected: sel?.kind === 'connector' && sel.id === inst.id,
        selectedPinId: sel?.kind === 'pin' && sel.connectorId === inst.id ? sel.pinId : null,
        pinFill: (pinId) => pinColor.get(`${inst.id}:${pinId}`) || null,
      }),
    );
  }
  content.appendChild(layer);
  content.appendChild(labelLayer);
  content.appendChild(tubeLabelLayer);

  // テキスト・注記（最前面）
  const textLayer = s('g', { class: 'layer-texts' });
  for (const t of page.texts) textLayer.appendChild(renderText(t, { selected: sel?.kind === 'text' && sel.id === t.id }));
  content.appendChild(textLayer);
  return g;
}

/** グリッド用 <pattern> 定義 */
export function gridDefs(step) {
  const major = step * 5;
  return s('defs', {}, [
    s('pattern', { id: 'grid-pattern', width: major, height: major, patternUnits: 'userSpaceOnUse' }, [
      ...Array.from({ length: 5 }, (_, i) => [
        s('line', { x1: i * step, y1: 0, x2: i * step, y2: major, class: i === 0 ? 'grid-major' : 'grid-minor' }),
        s('line', { x1: 0, y1: i * step, x2: major, y2: i * step, class: i === 0 ? 'grid-major' : 'grid-minor' }),
      ]).flat(),
    ]),
  ]);
}
