// 図面チェックパネル（図面の上に重ねて表示。開いたまま編集でき、内容は自動で更新される）
import { el } from './dom.js';
import { checkProject, countByLevel } from '../core/check.js';

const LEVELS = {
  error: { icon: '⛔', name: 'エラー' },
  warn: { icon: '⚠', name: '警告' },
  info: { icon: 'ℹ', name: '未入力' },
};

export function createCheckPanel(container, store, cmd, canvas) {
  const list = el('div', { class: 'check-list' });
  const summary = el('div', { class: 'check-summary' });
  let scope = 'all';
  let showInfo = true;
  let timer = null;
  const listeners = new Set();

  const scopeSel = el('select', { title: '対象', onchange: (e) => { scope = e.target.value; render(); } }, [
    el('option', { value: 'all' }, '全ページ'),
    el('option', { value: 'page' }, 'このページ'),
  ]);
  const infoToggle = el('label', { class: 'check', title: '配線名・長さなどの未入力も表示' }, [
    el('input', { type: 'checkbox', checked: true, onchange: (e) => { showInfo = e.target.checked; render(); } }),
    '未入力も表示',
  ]);

  const panel = el('section', { class: 'check-panel', hidden: true, 'aria-label': '図面チェック' }, [
    el('header', {}, [
      el('b', {}, '図面チェック'),
      scopeSel,
      infoToggle,
      el('button', { class: 'icon-btn', title: '閉じる', onclick: () => api.toggle(false) }, '×'),
    ]),
    summary,
    list,
  ]);
  container.appendChild(panel);

  function go(issue) {
    if (issue.pageId !== store.project.activePageId) cmd.switchPage(issue.pageId);
    if (issue.sel) {
      store.select(issue.sel);
      canvas.reveal(issue.sel);
    }
  }

  function render() {
    const all = checkProject(store.project);
    const counts = countByLevel(all);
    listeners.forEach((fn) => fn(counts));
    if (panel.hidden) return;
    const issues = all.filter((i) => (scope === 'all' || i.pageId === store.project.activePageId) && (showInfo || i.level !== 'info'));
    summary.replaceChildren(
      ...Object.entries(LEVELS).map(([k, v]) => el('span', { class: `check-chip ${k}` }, `${v.icon} ${v.name} ${counts[k]}`)),
    );
    if (!issues.length) {
      list.replaceChildren(el('div', { class: 'check-ok' }, all.length ? '表示中の条件では問題はありません' : '✓ 問題は見つかりませんでした'));
      return;
    }
    const multiPage = scope === 'all' && store.project.pages.length > 1;
    list.replaceChildren(...issues.map((i) => el('button', {
      class: `check-item ${i.level}`,
      title: 'クリックで該当箇所を選択',
      onclick: () => go(i),
    }, [
      el('span', { class: 'lv' }, LEVELS[i.level].icon),
      el('span', { class: 'msg' }, [multiPage ? el('span', { class: 'pg' }, i.pageName) : null, i.message]),
    ])));
  }

  store.subscribe((reason) => {
    if (reason !== 'project' && reason !== 'page') return;
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  });

  const api = {
    toggle(open = panel.hidden) {
      panel.hidden = !open;
      render();
    },
    /** counts({error,warn,info}) を受け取るコールバックを登録（ツールバーの件数表示用） */
    onCounts(fn) { listeners.add(fn); fn(countByLevel(checkProject(store.project))); },
    counts: () => countByLevel(checkProject(store.project)),
  };
  return api;
}
