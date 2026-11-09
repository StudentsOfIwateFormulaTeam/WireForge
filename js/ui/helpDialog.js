// 操作方法・ショートカット一覧
import { el } from './dom.js';

const SECTIONS = [
  ['図面の表示', [
    ['マウスホイール', '拡大・縮小（カーソル位置を中心）'],
    ['空白部をドラッグ / 中ボタンドラッグ', '表示の移動'],
    ['+ / −', '拡大 / 縮小'],
    ['F', '用紙全体を表示'],
    ['G', 'グリッド表示 ON/OFF'],
  ]],
  ['コネクタ', [
    ['部品パネルからドラッグ', '図面に配置（ダブルクリックで中央に配置）'],
    ['ドラッグ / 矢印キー', '移動（Shift+矢印 で 10mm）'],
    ['R / Shift+R', '90° 回転 / 逆回転'],
    ['Ctrl+C → Ctrl+V / Ctrl+D', 'コピー・貼り付け / 複製（テキストも可）'],
  ]],
  ['配線・チューブ', [
    ['W', '配線モード：ピン → ピンの順にクリック'],
    ['ピンをクリック', 'ピン情報と、つながっている配線を表示'],
    ['配線を選択 → 区間中央の ○ をドラッグ', '折れ点を追加（折れ点 □ はドラッグで移動、ダブルクリックで削除）'],
    ['T', 'チューブモード：配線の上をドラッグして範囲を指定'],
    ['チューブ両端の ○ をドラッグ', '被せる範囲を変更'],
  ]],
  ['編集・ファイル', [
    ['Delete / Backspace', '選択中の部品を削除'],
    ['Esc', '配線の始点を取り消し → モード終了 → 選択解除'],
    ['Ctrl+Z / Ctrl+Y', '元に戻す / やり直す'],
    ['Ctrl+S / Ctrl+O', 'ファイルに保存 / ファイルを開く'],
    ['Ctrl+P', 'PDF 出力'],
    ['PageUp / PageDown', '前 / 次のページ'],
    ['テキスト・表題欄をダブルクリック', '右パネルの入力欄へ移動'],
    ['?', 'この一覧を表示'],
  ]],
];

export function openHelpDialog() {
  if (document.querySelector('.modal-overlay.help')) return;
  const overlay = el('div', { class: 'modal-overlay help' });
  const close = () => { overlay.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopPropagation(); close(); } };
  overlay.appendChild(el('div', { class: 'modal wide', role: 'dialog', 'aria-label': '操作方法' }, [
    el('h3', {}, '操作方法・ショートカット'),
    el('div', { class: 'help-grid' }, SECTIONS.map(([title, rows]) => el('section', {}, [
      el('h4', {}, title),
      el('table', { class: 'help-table' }, el('tbody', {}, rows.map(([k, v]) => el('tr', {}, [el('th', {}, k), el('td', {}, v)])))),
    ]))),
    el('div', { class: 'sub-hint' }, '編集内容はこのブラウザに自動保存されます。別の PC で使う・長期保存するときは「保存」でファイル(.harness.json)にしてください。'),
    el('div', { class: 'modal-actions' }, [el('button', { class: 'primary-btn inline', onclick: close }, '閉じる')]),
  ]));
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
}
