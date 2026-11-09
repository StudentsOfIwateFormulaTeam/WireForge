// 下部: ページ管理バー（切替・追加・複製・削除・名前変更・並べ替え）
import { el } from './dom.js';

export function createPageBar(root, store, cmd) {
  const tabs = el('div', { class: 'page-tabs' });
  const cursor = el('span', { class: 'cursor-pos' }, '');
  let editingId = null;
  let dragId = null;

  const activeIndex = () => store.project.pages.findIndex((p) => p.id === store.project.activePageId);
  const moveBy = (d) => cmd.movePage(store.project.activePageId, activeIndex() + d);

  const leftBtn = el('button', { class: 'tb-btn', title: '現在のページを左へ移動', onclick: () => moveBy(-1) }, '◀');
  const rightBtn = el('button', { class: 'tb-btn', title: '現在のページを右へ移動', onclick: () => moveBy(1) }, '▶');
  const delBtn = el('button', { class: 'tb-btn', title: '現在のページを削除', onclick: () => cmd.deletePage() }, '削除');

  root.replaceChildren(
    tabs,
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'tb-btn', title: '新しいページを追加', onclick: () => cmd.addPage() }, '＋ ページ追加'),
      el('button', { class: 'tb-btn', title: '現在のページを複製', onclick: () => cmd.duplicatePage() }, '複製'),
      leftBtn, rightBtn, delBtn,
    ]),
    cursor,
  );

  function startRename(pg) {
    editingId = pg.id;
    render();
  }

  function tab(pg, i) {
    const active = pg.id === store.project.activePageId;
    if (pg.id === editingId) {
      const input = el('input', {
        class: 'page-tab-input', value: pg.name,
        onkeydown: (e) => {
          if (e.key === 'Enter') input.blur();
          if (e.key === 'Escape') { editingId = null; render(); }
          e.stopPropagation();
        },
        onblur: () => {
          if (editingId !== pg.id) return;
          editingId = null;
          if (input.value.trim() && input.value.trim() !== pg.name) cmd.renamePage(pg.id, input.value);
          else render();
        },
      });
      setTimeout(() => { input.focus(); input.select(); }, 0);
      return input;
    }
    return el('button', {
      class: 'page-tab' + (active ? ' active' : ''),
      title: 'クリックで切替／ダブルクリックで名前変更／ドラッグで並べ替え',
      draggable: 'true',
      onclick: () => cmd.switchPage(pg.id),
      ondblclick: () => startRename(pg),
      ondragstart: (e) => { dragId = pg.id; e.dataTransfer.setData('text/x-page-id', pg.id); e.dataTransfer.effectAllowed = 'move'; },
      ondragover: (e) => { if (dragId) { e.preventDefault(); e.currentTarget.classList.add('drop-target'); } },
      ondragleave: (e) => e.currentTarget.classList.remove('drop-target'),
      ondrop: (e) => {
        e.preventDefault();
        if (dragId && dragId !== pg.id) cmd.movePage(dragId, i);
        dragId = null;
      },
      ondragend: () => { dragId = null; render(); },
    }, [el('span', { class: 'page-no' }, String(i + 1)), pg.name]);
  }

  function render() {
    const pages = store.project.pages;
    tabs.replaceChildren(...pages.map(tab));
    const i = activeIndex();
    leftBtn.disabled = i <= 0;
    rightBtn.disabled = i >= pages.length - 1;
    delBtn.disabled = pages.length <= 1;
    tabs.querySelector('.page-tab.active')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  store.subscribe(render);
  render();

  return {
    setCursor(x, y) { cursor.textContent = `X ${x.toFixed(1)}  Y ${y.toFixed(1)} mm`; },
  };
}
