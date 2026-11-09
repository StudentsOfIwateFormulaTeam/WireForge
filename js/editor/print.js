// PDF 出力（ブラウザの印刷機能 →「PDF に保存」）。
// 画面と同じ renderSheet() で全ページを SVG（ベクター）として並べ、ページごとに用紙サイズを指定して印刷する。
import { s } from '../render/svg.js';
import { renderSheet, paperOf, FRAME_MARGIN } from '../render/sheetRenderer.js';
import { PAPER_SIZES } from '../core/model.js';

/** 図枠の内側に収まっていなければ、収まる変換 {k, dx, dy} を返す（収まっていれば null） */
export function fitTransform(bbox, paper, tolerance = 0.5) {
  const m = FRAME_MARGIN;
  const ax = m, ay = m, aw = paper.w - 2 * m, ah = paper.h - 2 * m;
  if (!bbox || (bbox.width === 0 && bbox.height === 0)) return null;
  const inside = bbox.x >= ax - tolerance && bbox.y >= ay - tolerance
    && bbox.x + bbox.width <= ax + aw + tolerance && bbox.y + bbox.height <= ay + ah + tolerance;
  if (inside) return null;
  const pad = 2;
  const k = Math.min(1, (aw - pad * 2) / bbox.width, (ah - pad * 2) / bbox.height);
  // 縮小後に枠内へ平行移動（はみ出していない方向は元の位置を保つ）
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const nx = clamp(bbox.x * k, ax + pad, ax + aw - pad - bbox.width * k);
  const ny = clamp(bbox.y * k, ay + pad, ay + ah - pad - bbox.height * k);
  return { k, dx: nx - bbox.x * k, dy: ny - bbox.y * k };
}

function pageStyle() {
  return Object.entries(PAPER_SIZES)
    .map(([key, p]) => `@page paper-${key} { size: ${p.w}mm ${p.h}mm; margin: 0; }`)
    .join('\n');
}

/**
 * 印刷用 DOM を作り、印刷ダイアログを開く。
 * @param pageIds 出力するページ（省略時は全ページ）
 * @returns 縮小して収めたページ名の一覧
 */
export function printProject(project, pageIds) {
  document.getElementById('print-root')?.remove();
  const root = document.createElement('div');
  root.id = 'print-root';
  const style = document.createElement('style');
  style.textContent = pageStyle();
  root.appendChild(style);

  const pages = project.pages.filter((p) => !pageIds || pageIds.includes(p.id));
  const svgs = [];
  pages.forEach((pg) => {
    const paper = paperOf(pg);
    const key = PAPER_SIZES[pg.paper] ? pg.paper : 'A4-landscape';
    const div = document.createElement('div');
    div.className = 'print-page';
    div.style.page = `paper-${key}`;
    div.style.width = `${paper.w}mm`;
    div.style.height = `${paper.h}mm`;
    const sheet = renderSheet(pg, {
      forPrint: true,
      display: project.settings?.display,
      info: { projectName: project.name, pageNo: project.pages.indexOf(pg) + 1, pageCount: project.pages.length },
    });
    const svg = s('svg', { class: 'print-svg', width: `${paper.w}mm`, height: `${paper.h}mm`, viewBox: `0 0 ${paper.w} ${paper.h}` }, [sheet]);
    div.appendChild(svg);
    root.appendChild(div);
    svgs.push({ pg, paper, sheet });
  });
  document.body.appendChild(root);

  // はみ出し対策: 内容が図枠からはみ出すページは縮小して収める（レイアウトを測るため DOM 追加後に行う）
  const shrunk = [];
  for (const { pg, paper, sheet } of svgs) {
    const content = sheet.querySelector('.content');
    let bbox = null;
    try { bbox = content.getBBox(); } catch { /* 非表示環境 */ }
    const t = fitTransform(bbox, paper);
    if (t) {
      content.setAttribute('transform', `translate(${t.dx} ${t.dy}) scale(${t.k})`);
      shrunk.push(pg.name);
    }
  }

  const prevTitle = document.title;
  document.title = project.name || 'harness'; // 「PDF に保存」の既定ファイル名になる
  document.body.classList.add('printing');
  const cleanup = () => {
    document.body.classList.remove('printing');
    document.title = prevTitle;
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  return {
    shrunk,
    open() {
      window.print(); // 閉じた後は afterprint で後片付け
    },
    cleanup,
  };
}
