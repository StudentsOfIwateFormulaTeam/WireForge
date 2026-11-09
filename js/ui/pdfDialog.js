// PDF 出力ダイアログ（方式A: ブラウザの印刷 →「PDF に保存」）
import { el } from './dom.js';
import { printProject } from '../editor/print.js';
import { PAPER_SIZES } from '../core/model.js';

export function openPdfDialog(store, { checkCounts, openCheck } = {}) {
  const project = store.project;
  let scope = 'all';
  let job = null;

  const overlay = el('div', { class: 'modal-overlay' });
  const body = el('div', { class: 'modal-body' });
  const close = () => { job?.cleanup(); overlay.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

  function prepare() {
    job?.cleanup();
    const ids = scope === 'all' ? null : [project.activePageId];
    job = printProject(project, ids);
    render();
  }

  function render() {
    const pages = project.pages.filter((p) => scope === 'all' || p.id === project.activePageId);
    const c = checkCounts;
    body.replaceChildren(
      c && (c.error || c.warn) ? el('div', { class: 'warn-box' }, [
        `図面チェックで エラー ${c.error} 件・警告 ${c.warn} 件 が見つかっています。`,
        openCheck ? el('button', { class: 'link-btn', onclick: () => { close(); openCheck(); } }, '内容を確認する') : null,
      ]) : null,
      el('div', { class: 'modal-row' }, [
        el('label', { class: 'check' }, [el('input', { type: 'radio', name: 'pdf-scope', checked: scope === 'all', onchange: () => { scope = 'all'; prepare(); } }), `全ページ（${project.pages.length} ページ）を 1 つの PDF に`]),
        el('label', { class: 'check' }, [el('input', { type: 'radio', name: 'pdf-scope', checked: scope === 'current', onchange: () => { scope = 'current'; prepare(); } }), '現在のページのみ']),
      ]),
      el('table', { class: 'wire-table' }, [
        el('thead', {}, el('tr', {}, [el('th', {}, '#'), el('th', {}, 'ページ'), el('th', {}, '用紙')])),
        el('tbody', {}, pages.map((p) => el('tr', {}, [
          el('td', {}, String(project.pages.indexOf(p) + 1)),
          el('td', {}, p.name + (job?.shrunk.includes(p.name) ? '（枠からはみ出すため縮小）' : '')),
          el('td', { class: 'nowrap' }, PAPER_SIZES[p.paper]?.label || p.paper),
        ]))),
      ]),
      el('div', { class: 'info-box' }, [
        el('b', {}, '印刷ダイアログでの設定'),
        el('ol', {}, [
          el('li', {}, '送信先（プリンター）で「PDF に保存」（Microsoft Print to PDF 等ではなく）を選ぶ'),
          el('li', {}, '余白は「なし」または「デフォルト」、倍率は 100%（ページに合わせない）'),
          el('li', {}, '「背景のグラフィック」に ✓（配線色が薄くなる場合）'),
        ]),
        el('div', { class: 'sub-hint' }, '用紙の向き・サイズはページごとの設定が自動で使われます。Chrome / Edge を推奨します。'),
      ]),
    );
  }

  overlay.appendChild(el('div', { class: 'modal', role: 'dialog', 'aria-label': 'PDF 出力' }, [
    el('h3', {}, 'PDF 出力'),
    body,
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'tb-btn light', onclick: close }, 'キャンセル'),
      el('button', {
        class: 'primary-btn inline',
        onclick: () => {
          const j = job;
          job = null; // 後片付けは印刷終了(afterprint)時に行う
          overlay.remove();
          window.removeEventListener('keydown', onKey, true);
          j.open();
        },
      }, '印刷ダイアログを開く'),
    ]),
  ]));
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
  prepare();
}
