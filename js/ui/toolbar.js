// 上部ツールバー
import { el } from './dom.js';


export function createToolbar(root, store, cmd, canvas) {
  const btn = (label, title, onclick, opts = {}) =>
    el('button', { class: 'tb-btn' + (opts.cls ? ' ' + opts.cls : ''), title, onclick, disabled: opts.disabled }, label);

  const nameInput = el('input', {
    class: 'project-name',
    value: store.project.name,
    title: 'プロジェクト名',
    onchange: (e) => cmd.renameProject(e.target.value),
  });

  const saveState = el('span', { class: 'save-state', title: '編集内容はこのブラウザに自動保存されます。別の PC で使う・残す場合は「保存」でファイルにしてください。' }, '');
  const undoBtn = btn('↶ 元に戻す', '元に戻す (Ctrl+Z)', cmd.undo);
  const redoBtn = btn('↷ やり直す', 'やり直す (Ctrl+Y)', cmd.redo);
  const zoomLabel = el('span', { class: 'zoom-label', title: '表示倍率（100% = 実寸 1mm ≒ 3.78px）' }, '100%');
  const wireBtn = btn('〰 配線', '配線モード：ピン → ピンをクリックして接続 (W)', () => cmd.toggleWireTool(), { cls: 'toggle' });
  const tubeBtn = btn('◍ チューブ', 'チューブモード：配線の上をドラッグして範囲を指定 (T)', () => cmd.toggleTubeTool(), { cls: 'toggle' });
  const gridBtn = btn('グリッド', 'グリッド表示 ON/OFF (G)', cmd.toggleGrid, { cls: 'toggle' });
  const snapBtn = btn('スナップ', '移動時に 1mm 単位へ吸着', cmd.toggleSnap, { cls: 'toggle' });

  root.replaceChildren(
    el('div', { class: 'tb-group brand' }, [el('span', { class: 'logo' }, '⚡'), el('span', { class: 'app-title' }, 'ハーネス配線図')]),
    el('div', { class: 'tb-group' }, [nameInput]),
    el('div', { class: 'tb-group' }, [
      btn('新規', '新しいプロジェクト', cmd.newProject),
      btn('開く', 'プロジェクトファイル(.json)を開く (Ctrl+O)／ファイルを画面にドロップしても開けます', () => cmd.openFile()),
      btn('保存', 'プロジェクトファイル(.json)として保存 (Ctrl+S)', cmd.saveFile),
      btn('PDF出力', '全ページを PDF に出力 (Ctrl+P)', () => cmd.exportPdf()),
      saveState,
    ]),
    el('div', { class: 'tb-group' }, [undoBtn, redoBtn]),
    el('div', { class: 'tb-group' }, [
      wireBtn,
      tubeBtn,
      btn('⟳ 回転', '選択コネクタを90°回転 (R / Shift+R)', () => cmd.rotate(90)),
      btn('⇋ 反転', '選択コネクタを左右反転（反対側の面として表示）', cmd.mirror),
      btn('🗑 削除', '選択中の部品を削除 (Delete)', cmd.deleteSelection),
    ]),
    el('div', { class: 'tb-group' }, [
      btn('−', '縮小 (-)', () => canvas.zoomAt(1 / 1.2)),
      zoomLabel,
      btn('+', '拡大 (+)', () => canvas.zoomAt(1.2)),
      btn('全体', '用紙全体を表示 (F)', canvas.fit),
      gridBtn,
      snapBtn,
    ]),
  );

  const MM_PER_PX = 25.4 / 96;
  canvas.svg.parentElement.addEventListener('zoomchange', (e) => {
    zoomLabel.textContent = `${Math.round(e.detail * MM_PER_PX * 100)}%`;
  });

  function update() {
    undoBtn.disabled = !store.canUndo();
    redoBtn.disabled = !store.canRedo();
    gridBtn.classList.toggle('on', store.ui.showGrid);
    wireBtn.classList.toggle('on', store.ui.tool === 'wire');
    tubeBtn.classList.toggle('on', store.ui.tool === 'tube');
    snapBtn.classList.toggle('on', store.ui.snap);
    if (document.activeElement !== nameInput) nameInput.value = store.project.name;
  }
  store.subscribe(update);
  update();

  return {
    setSaveState(state, time) {
      const hm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
      saveState.textContent = state === 'saved' ? `✓ 自動保存 ${hm}` : '⚠ 自動保存できません';
      saveState.classList.toggle('error', state !== 'saved');
    },
  };
}
