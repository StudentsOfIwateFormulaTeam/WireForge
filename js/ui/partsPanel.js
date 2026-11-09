// 左パネル: 部品（コネクタ一覧）・配線 / チューブ / テキスト追加
import { el } from './dom.js';
import { s } from '../render/svg.js';
import { CONNECTOR_GROUPS } from '../catalog/connectors/index.js';
import { renderConnector } from '../render/connectorRenderer.js';

function thumbnail(part) {
  const b = part.bounds;
  const pad = 1.5;
  const inst = { x: 0, y: 0, rotation: 0, scale: 1, showFlange: true, label: '' };
  const g = renderConnector(inst, part);
  // サムネイルでは文字類を省く
  g.querySelectorAll('.cn-title, .cn-sub, .pin-labels').forEach((n) => n.remove());
  g.querySelectorAll('[data-kind]').forEach((n) => n.removeAttribute('data-kind'));
  return s('svg', { class: 'thumb', viewBox: `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}` }, [g]);
}

export function createPartsPanel(root, store, canvas, cmd, { onShowInfo }) {
  const search = el('input', { class: 'search', type: 'search', placeholder: '型番・シリーズで絞り込み', oninput: () => renderList() });
  const list = el('div', { class: 'part-list' });

  function renderList() {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren();
    for (const g of CONNECTOR_GROUPS) {
      const parts = g.parts.filter((p) => !q || `${p.maker} ${p.series} ${p.partNo} ${p.polesLabel}`.toLowerCase().includes(q));
      if (!parts.length) continue;
      list.appendChild(el('div', { class: 'group-title' }, `${g.maker} ${g.series}`));
      for (const p of parts) {
        if (p.unavailable) {
          list.appendChild(
            el('div', { class: 'part-item unavailable', title: p.unavailableReason, onclick: () => onShowInfo(p) }, [
              el('div', { class: 'thumb missing' }, '?'),
              el('div', { class: 'part-text' }, [
                el('div', { class: 'part-name' }, p.polesLabel),
                el('div', { class: 'part-meta warn' }, '資料不足のため配置不可'),
              ]),
            ]),
          );
          continue;
        }
        list.appendChild(
          el('div', {
            class: 'part-item',
            draggable: 'true',
            title: 'ドラッグして図面に配置／ダブルクリックで中央に配置',
            ondragstart: (e) => {
              e.dataTransfer.setData('application/x-part-id', p.id);
              e.dataTransfer.effectAllowed = 'copy';
            },
            ondblclick: () => canvas.placePart(p.id),
          }, [
            thumbnail(p),
            el('div', { class: 'part-text' }, [
              el('div', { class: 'part-name' }, p.partNo),
              el('div', { class: 'part-meta' }, p.polesLabel),
            ]),
          ]),
        );
      }
    }
  }

  const wireBtn = el('button', { class: 'side-btn', title: 'ピン → ピンの順にクリックして配線 (W)', onclick: () => cmd.toggleWireTool() }, ['＋ 配線', el('span', { class: 'badge' }, 'W')]);
  const tubeBtn = el('button', { class: 'side-btn', title: '配線の上をドラッグしてチューブを被せる範囲を指定 (T)', onclick: () => cmd.toggleTubeTool() }, ['＋ コルゲートチューブ', el('span', { class: 'badge' }, 'T')]);
  store.subscribe(() => {
    wireBtn.classList.toggle('on', store.ui.tool === 'wire');
    tubeBtn.classList.toggle('on', store.ui.tool === 'tube');
  });

  root.replaceChildren(
    el('section', { class: 'panel-section grow' }, [el('h3', {}, 'コネクタ'), search, list]),
    el('section', { class: 'panel-section' }, [
      el('h3', {}, '追加'),
      wireBtn,
      tubeBtn,
      el('button', { class: 'side-btn', title: '表示中の領域の中央にテキストを追加', onclick: () => { const [x, y] = canvas.viewCenter(); cmd.addText(x, y); } }, '＋ テキスト'),
      el('button', { class: 'side-btn', title: '枠付きの注記を追加', onclick: () => { const [x, y] = canvas.viewCenter(); cmd.addText(x, y, { text: '注記\n1. ', frame: true, size: 3 }); } }, '＋ 注記（枠付き）'),
      el('button', { class: 'side-btn', title: '表題欄（図面名・図番・作成者など）を編集', onclick: () => store.select({ kind: 'titleBlock' }) }, '表題欄を編集'),
    ]),
  );
  renderList();
}
