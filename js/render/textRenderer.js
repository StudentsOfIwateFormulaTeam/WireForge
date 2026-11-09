// テキスト・注記・表題欄の描画
import { s } from './svg.js';
import { textWidth } from './wireRenderer.js';

const f = (v) => +(+v).toFixed(3);
const LINE_H = 1.4; // 行送り（文字高さの倍率）
const PAD = 1.2; // 枠と文字の余白(mm)

/** テキストの外形（図面座標）。x,y は左上 */
export function textBounds(t) {
  const lines = String(t.text ?? '').split('\n');
  const w = Math.max(t.size, ...lines.map((l) => textWidth(l, t.size) * (t.bold ? 1.05 : 1)));
  const h = lines.length * t.size * LINE_H;
  const pad = t.frame ? PAD : 0;
  return { x: t.x - pad, y: t.y - pad, w: w + pad * 2, h: h + pad * 2 };
}

export function renderText(t, opts = {}) {
  const g = s('g', { class: 'note' + (opts.selected ? ' note-selected' : ''), 'data-kind': 'text', 'data-id': t.id });
  const b = textBounds(t);
  // 枠なしでもクリックしやすいよう透明な当たり判定を置く
  g.appendChild(s('rect', { class: t.frame ? 'note-frame' : 'note-hit', x: f(b.x), y: f(b.y), width: f(b.w), height: f(b.h) }));
  const lines = String(t.text ?? '').split('\n');
  const text = s('text', { class: 'note-text' + (t.bold ? ' bold' : ''), 'font-size': t.size });
  lines.forEach((line, i) => {
    text.appendChild(s('tspan', { x: f(t.x), y: f(t.y + t.size * LINE_H * i + t.size * 0.7 * LINE_H) }, line || ' '));
  });
  g.appendChild(text);
  if (opts.selected) g.appendChild(s('rect', { class: 'sel-box', x: f(b.x - 0.8), y: f(b.y - 0.8), width: f(b.w + 1.6), height: f(b.h + 1.6) }));
  return g;
}

/** 表題欄の寸法 */
export const TITLE_BLOCK = { w: 120, rowH: 6.5 };

/**
 * @param info { projectName, pageName, pageNo, pageCount }
 */
export function renderTitleBlock(tb, paper, margin, info, opts = {}) {
  const { w, rowH } = TITLE_BLOCK;
  const h = rowH * 4;
  const x0 = paper.w - margin - w, y0 = paper.h - margin - h;
  const g = s('g', { class: 'title-block' + (opts.selected ? ' tb-selected' : ''), 'data-kind': 'titleBlock' });
  g.appendChild(s('rect', { class: 'tb-bg', x: x0, y: y0, width: w, height: h }));

  const cell = (x, y, cw, label, value, big) => {
    g.appendChild(s('rect', { class: 'tb-cell', x: f(x), y: f(y), width: f(cw), height: rowH }));
    g.appendChild(s('text', { class: 'tb-label', x: f(x + 1), y: f(y + rowH / 2 + 0.2) }, label));
    g.appendChild(s('text', { class: 'tb-value' + (big ? ' big' : ''), x: f(x + 2.5 + textWidth(label, 1.8)), y: f(y + rowH / 2 + 0.3) }, value || ''));
  };
  cell(x0, y0, w, 'プロジェクト', info.projectName);
  cell(x0, y0 + rowH, w, '図面名', tb.title || info.pageName, true);
  cell(x0, y0 + rowH * 2, 50, '図番', tb.drawingNo);
  cell(x0 + 50, y0 + rowH * 2, 35, '版', tb.revision);
  cell(x0 + 85, y0 + rowH * 2, 35, 'ページ', `${info.pageNo} / ${info.pageCount}`);
  cell(x0, y0 + rowH * 3, 60, '作成者', tb.author);
  cell(x0 + 60, y0 + rowH * 3, 60, '日付', tb.date);
  if (opts.selected) g.appendChild(s('rect', { class: 'sel-box', x: x0 - 1, y: y0 - 1, width: w + 2, height: h + 2 }));
  return g;
}
