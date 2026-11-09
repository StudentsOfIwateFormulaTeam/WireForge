// アプリ状態の一元管理。
//   project : 保存対象の図面データ（Undo/Redo の対象）
//   ui      : 選択状態・表示設定など（保存・履歴の対象外）

const clone = (o) => structuredClone(o);
const HISTORY_LIMIT = 200;

export function createStore(initialProject) {
  let project = initialProject;
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set();
  const ui = {
    selection: null, // { kind:'connector', id } | { kind:'pin', connectorId, pinId } | { kind:'wire', id } | { kind:'tube', id } | { kind:'text', id } | { kind:'titleBlock' }
    tool: 'select', // 'select' | 'wire' | 'tube'
    wireStart: null, // 配線モードで選んだ始点ピン { connectorId, pinId }
    lastWire: null, // 直前に設定した配線仕様（新しい配線の初期値にする）
    lastTube: null, // 直前に設定したチューブ仕様
    showGrid: true,
    snap: true,
    gridStep: 5, // mm（表示グリッド）
    snapStep: 1, // mm（移動スナップ）
  };

  const emit = (reason) => listeners.forEach((fn) => fn(reason));

  const store = {
    get project() { return project; },
    get ui() { return ui; },
    get page() { return project.pages.find((p) => p.id === project.activePageId) || project.pages[0]; },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** 1 操作 = 1 履歴。mutator は project のドラフトを直接書き換える */
    commit(mutator) {
      const before = clone(project);
      mutator(project);
      project.updatedAt = new Date().toISOString();
      undoStack.push(before);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack.length = 0;
      validateSelection();
      emit('project');
    },

    /** ドラッグ等の連続操作: begin → live(複数回) → end で 1 履歴にまとめる */
    begin() { return clone(project); },
    live(mutator) { mutator(project); emit('project'); },
    end(snapshot) {
      if (JSON.stringify(snapshot) === JSON.stringify(project)) return;
      project.updatedAt = new Date().toISOString();
      undoStack.push(snapshot);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack.length = 0;
      emit('project');
    },

    undo() {
      if (!undoStack.length) return;
      redoStack.push(clone(project));
      project = undoStack.pop();
      validateSelection();
      emit('project');
    },
    redo() {
      if (!redoStack.length) return;
      undoStack.push(clone(project));
      project = redoStack.pop();
      validateSelection();
      emit('project');
    },

    /** ファイル読み込み等で丸ごと置き換え（履歴はリセット） */
    replace(newProject) {
      project = newProject;
      undoStack.length = 0;
      redoStack.length = 0;
      ui.selection = null;
      ui.wireStart = null;
      emit('project');
    },

    select(sel) { ui.selection = sel; emit('selection'); },
    /** ページ切替（履歴には残さない） */
    setActivePage(id) {
      if (!project.pages.some((p) => p.id === id) || project.activePageId === id) return;
      project.activePageId = id;
      ui.selection = null;
      ui.wireStart = null;
      emit('page');
    },
    setUi(patch) { Object.assign(ui, patch); emit('ui'); },
  };

  function validateSelection() {
    const s = ui.selection;
    if (!s) return;
    const page = store.page;
    if (s.kind === 'wire') {
      if (!page.wires.some((w) => w.id === s.id)) ui.selection = null;
      return;
    }
    if (s.kind === 'text') {
      if (!page.texts.some((t) => t.id === s.id)) ui.selection = null;
      return;
    }
    if (s.kind === 'titleBlock') return;
    if (s.kind === 'tube') {
      if (!page.tubes.some((t) => t.id === s.id)) ui.selection = null;
      return;
    }
    const id = s.kind === 'pin' ? s.connectorId : s.id;
    if (!page.connectors.some((c) => c.id === id)) ui.selection = null;
  }

  return store;
}
