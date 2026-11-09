// エントリポイント
import { createProject } from './core/model.js';
import { createStore } from './core/store.js';
import { createCanvas } from './editor/canvas.js';
import { createCommands, bindKeyboard } from './editor/commands.js';
import { createToolbar } from './ui/toolbar.js';
import { createPartsPanel } from './ui/partsPanel.js';
import { createPropertyPanel } from './ui/propertyPanel.js';
import { createPageBar } from './ui/pageBar.js';
import { openPdfDialog } from './ui/pdfDialog.js';
import { createCheckPanel } from './ui/checkPanel.js';
import { openHelpDialog } from './ui/helpDialog.js';
import { loadAutosave, startAutosave } from './core/io.js';

// 前回の作業（ブラウザ内の自動保存）があれば復元
const restored = new URLSearchParams(location.search).has('fresh') ? null : loadAutosave();
const store = createStore(restored || createProject());
const cmd = createCommands(store);

const pageBar = createPageBar(document.getElementById('pagebar'), store, cmd);
const canvas = createCanvas(document.getElementById('canvas'), store, cmd, {
  onCursor: (x, y) => pageBar.setCursor(x, y),
});
const check = createCheckPanel(document.querySelector('.canvas-wrap'), store, cmd, canvas);
cmd.toggleCheck = () => check.toggle();
cmd.showHelp = openHelpDialog;
cmd.onCheckCounts = (fn) => check.onCounts(fn);
cmd.exportPdf = () => openPdfDialog(store, { checkCounts: check.counts(), openCheck: () => check.toggle(true) });
const props = createPropertyPanel(document.getElementById('props'), store, cmd);
createPartsPanel(document.getElementById('parts'), store, canvas, cmd, { onShowInfo: props.showPartInfo });
const toolbar = createToolbar(document.getElementById('toolbar'), store, cmd, canvas);
bindKeyboard(store, cmd, canvas);
startAutosave(store, toolbar.setSaveState);
if (restored) toolbar.setSaveState('saved', new Date(restored.updatedAt || Date.now()));

// 図面上のダブルクリック → プロパティパネルの編集欄へ
document.getElementById('canvas').addEventListener('edit-request', () => props.focusEditor());

// プロジェクトファイル(.json)を画面にドロップして開く
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  e.preventDefault();
  if (/\.json$/i.test(file.name) || file.type === 'application/json') {
    if (confirm(`「${file.name}」を開きます。現在の図面は閉じられます。よろしいですか？`)) cmd.openFile(file);
  }
});

// 小さい画面用: 左右パネルの開閉
for (const b of document.querySelectorAll('[data-toggle-panel]')) {
  b.addEventListener('click', () => document.body.classList.toggle(`hide-${b.dataset.togglePanel}`));
}

// デバッグ・動作確認用
window.__app = { store, cmd, canvas };
