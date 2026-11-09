// 編集コマンド（ツールバー・キーボード・プロパティパネルから共通で使う）
import { uid, nextConnectorLabel, createWire, createTube, nextTubeLabel, createProject, createPage, clonePage, nextPageName, createText } from '../core/model.js';
import { downloadProject, pickProjectFile, readProjectFile } from '../core/io.js';
import { pruneTubes, MIN_SPAN } from '../core/tubes.js';

const activePage = (p) => p.pages.find((pg) => pg.id === p.activePageId);
const SPEC_KEYS = ['type', 'gauge', 'color', 'lengthUnit'];
const TUBE_SPEC_KEYS = ['size', 'color', 'lengthUnit'];

export function createCommands(store) {
  let clipboard = null;

  const selectedConnectorId = () => {
    const s = store.ui.selection;
    return s?.kind === 'connector' ? s.id : s?.kind === 'pin' ? s.connectorId : null;
  };
  const selectedTextId = () => (store.ui.selection?.kind === 'text' ? store.ui.selection.id : null);

  const cmd = {
    undo: () => store.undo(),
    redo: () => store.redo(),

    // ---------- コネクタ ----------
    updateConnector(id, patch) {
      store.commit((p) => Object.assign(activePage(p).connectors.find((c) => c.id === id), patch));
    },

    rotate(delta = 90) {
      const id = selectedConnectorId();
      if (!id) return;
      store.commit((p) => {
        const c = activePage(p).connectors.find((c) => c.id === id);
        c.rotation = (((c.rotation || 0) + delta) % 360 + 360) % 360;
      });
    },

    mirror() {
      const id = selectedConnectorId();
      if (!id) return;
      store.commit((p) => {
        const c = activePage(p).connectors.find((c) => c.id === id);
        c.mirror = !c.mirror;
      });
    },

    nudge(dx, dy) {
      const tid = selectedTextId();
      if (tid) {
        store.commit((p) => { const t = activePage(p).texts.find((t) => t.id === tid); t.x += dx; t.y += dy; });
        return;
      }
      const id = selectedConnectorId();
      if (!id) return;
      store.commit((p) => {
        const c = activePage(p).connectors.find((c) => c.id === id);
        c.x += dx; c.y += dy;
      });
    },

    deleteConnector(id) {
      const n = store.page.wires.filter((w) => w.from.connectorId === id || w.to.connectorId === id).length;
      if (n && !confirm(`このコネクタに接続されている配線 ${n} 本も削除されます。よろしいですか？`)) return;
      store.commit((p) => {
        const pg = activePage(p);
        pg.connectors = pg.connectors.filter((c) => c.id !== id);
        pg.wires = pg.wires.filter((w) => w.from.connectorId !== id && w.to.connectorId !== id);
        pruneTubes(pg);
      });
      store.select(null);
    },

    // ---------- 配線 ----------
    /** from/to: { connectorId, pinId }。作成した配線の id を返す */
    addWire(from, to, props = {}) {
      if (from.connectorId === to.connectorId && from.pinId === to.pinId) return null;
      const w = createWire(from, to, { ...(store.ui.lastWire || {}), ...props });
      // 同じコネクタ同士を結ぶ配線のラベルが重ならないよう、既定のラベル位置をずらす（0.5, 0.35, 0.65, 0.2, 0.8, …）
      if (w.labelT == null) {
        const pair = (x) => [x.from.connectorId, x.to.connectorId].sort().join('|');
        const k = store.page.wires.filter((x) => pair(x) === pair(w)).length;
        const STEPS = [0.5, 0.35, 0.65, 0.2, 0.8, 0.27, 0.73, 0.42, 0.58];
        w.labelT = STEPS[k % STEPS.length];
      }
      store.commit((p) => activePage(p).wires.push(w));
      store.select({ kind: 'wire', id: w.id });
      return w.id;
    },

    updateWire(id, patch) {
      store.commit((p) => Object.assign(activePage(p).wires.find((w) => w.id === id), patch));
      const spec = Object.fromEntries(Object.entries(patch).filter(([k]) => SPEC_KEYS.includes(k)));
      if (Object.keys(spec).length) store.ui.lastWire = { ...(store.ui.lastWire || {}), ...spec };
    },

    deleteWire(id) {
      store.commit((p) => {
        const pg = activePage(p);
        pg.wires = pg.wires.filter((w) => w.id !== id);
        pruneTubes(pg);
      });
      store.select(null);
    },

    // ---------- コルゲートチューブ ----------
    /** 配線 wireId の範囲 t0〜t1 にチューブを追加。作成したチューブの id を返す */
    addTube(wireId, t0 = 0.3, t1 = 0.7, props = {}) {
      if (!store.page.wires.some((w) => w.id === wireId)) return null;
      const t = createTube(wireId, t0, t1, { ...(store.ui.lastTube || {}), ...props, label: nextTubeLabel(store.project) });
      if (t.t1 - t.t0 < MIN_SPAN) t.t1 = Math.min(1, t.t0 + MIN_SPAN);
      store.commit((p) => activePage(p).tubes.push(t));
      store.select({ kind: 'tube', id: t.id });
      return t.id;
    },

    updateTube(id, patch) {
      store.commit((p) => {
        const t = activePage(p).tubes.find((t) => t.id === id);
        Object.assign(t, patch);
        if (t.t0 > t.t1) [t.t0, t.t1] = [t.t1, t.t0];
        t.t0 = Math.max(0, t.t0);
        t.t1 = Math.min(1, t.t1);
        if (!t.wireIds.includes(t.wireId)) t.wireIds.unshift(t.wireId);
      });
      const spec = Object.fromEntries(Object.entries(patch).filter(([k]) => TUBE_SPEC_KEYS.includes(k)));
      if (Object.keys(spec).length) store.ui.lastTube = { ...(store.ui.lastTube || {}), ...spec };
    },

    /** 対象配線の追加・除外（基準配線は外せない） */
    setTubeWire(id, wireId, included) {
      store.commit((p) => {
        const t = activePage(p).tubes.find((t) => t.id === id);
        if (included) { if (!t.wireIds.includes(wireId)) t.wireIds.push(wireId); }
        else if (wireId !== t.wireId) t.wireIds = t.wireIds.filter((w) => w !== wireId);
      });
    },

    /** 対象配線の折れ点を基準配線と同じにして、束として同じ経路を通す */
    alignTubeWires(id) {
      store.commit((p) => {
        const pg = activePage(p);
        const t = pg.tubes.find((t) => t.id === id);
        const guide = pg.wires.find((w) => w.id === t.wireId);
        for (const w of pg.wires) if (w !== guide && t.wireIds.includes(w.id)) w.waypoints = structuredClone(guide.waypoints);
      });
    },

    deleteTube(id) {
      store.commit((p) => {
        const pg = activePage(p);
        pg.tubes = pg.tubes.filter((t) => t.id !== id);
      });
      store.select(null);
    },

    toggleTubeTool() {
      cmd.setTool(store.ui.tool === 'tube' ? 'select' : 'tube');
    },

    setTool(tool) {
      store.setUi({ tool, wireStart: null });
    },
    toggleWireTool() {
      cmd.setTool(store.ui.tool === 'wire' ? 'select' : 'wire');
    },
    startWireFrom(connectorId, pinId) {
      store.setUi({ tool: 'wire', wireStart: { connectorId, pinId } });
    },

    // ---------- 共通 ----------
    deleteSelection() {
      const sel = store.ui.selection;
      if (sel?.kind === 'connector') cmd.deleteConnector(sel.id);
      else if (sel?.kind === 'wire') cmd.deleteWire(sel.id);
      else if (sel?.kind === 'tube') cmd.deleteTube(sel.id);
      else if (sel?.kind === 'text') cmd.deleteText(sel.id);
      // ピン選択中は何もしない（誤ってコネクタや配線を消さないため）
    },

    copy() {
      const tid = selectedTextId();
      if (tid) {
        clipboard = { kind: 'text', data: structuredClone(store.page.texts.find((t) => t.id === tid)) };
        return true;
      }
      const id = selectedConnectorId();
      if (!id) return false;
      clipboard = { kind: 'connector', data: structuredClone(store.page.connectors.find((c) => c.id === id)) };
      return true;
    },

    paste() {
      if (!clipboard) return;
      const isText = clipboard.kind === 'text';
      const obj = structuredClone(clipboard.data);
      obj.id = uid(isText ? 'tx' : 'cn');
      if (!isText) obj.label = nextConnectorLabel(store.project);
      obj.x += 10; obj.y += 10;
      clipboard = { kind: clipboard.kind, data: structuredClone(obj) }; // 連続貼り付けで少しずつずらす
      store.commit((p) => activePage(p)[isText ? 'texts' : 'connectors'].push(obj));
      store.select({ kind: isText ? 'text' : 'connector', id: obj.id });
    },

    duplicate() { if (cmd.copy()) cmd.paste(); },

    // ---------- テキスト・注記・表題欄 ----------
    addText(x, y, props = {}) {
      const t = createText(Math.round(x), Math.round(y), props);
      store.commit((p) => activePage(p).texts.push(t));
      store.select({ kind: 'text', id: t.id });
      return t.id;
    },
    updateText(id, patch) {
      store.commit((p) => Object.assign(activePage(p).texts.find((t) => t.id === id), patch));
    },
    deleteText(id) {
      store.commit((p) => { const pg = activePage(p); pg.texts = pg.texts.filter((t) => t.id !== id); });
      store.select(null);
    },
    updateTitleBlock(patch) {
      store.commit((p) => Object.assign(activePage(p).titleBlock, patch));
    },

    // ---------- ページ ----------
    switchPage: (id) => store.setActivePage(id),
    switchPageBy(d) {
      const ps = store.project.pages;
      const i = ps.findIndex((p) => p.id === store.project.activePageId);
      const j = Math.max(0, Math.min(ps.length - 1, i + d));
      store.setActivePage(ps[j].id);
    },
    addPage() {
      const pg = createPage(nextPageName(store.project));
      pg.paper = store.page.paper; // 現在のページと同じ用紙
      store.commit((p) => {
        p.pages.splice(p.pages.findIndex((x) => x.id === p.activePageId) + 1, 0, pg);
        p.activePageId = pg.id;
      });
      store.select(null);
    },
    duplicatePage(id = store.project.activePageId) {
      const src = store.project.pages.find((p) => p.id === id);
      if (!src) return;
      const names = new Set(store.project.pages.map((p) => p.name));
      let name = `${src.name} のコピー`, n = 2;
      while (names.has(name)) name = `${src.name} のコピー ${n++}`;
      const pg = clonePage(src, name);
      store.commit((p) => {
        p.pages.splice(p.pages.findIndex((x) => x.id === id) + 1, 0, pg);
        p.activePageId = pg.id;
      });
      store.select(null);
    },
    deletePage(id = store.project.activePageId) {
      const pages = store.project.pages;
      if (pages.length <= 1) { alert('最後の 1 ページは削除できません。'); return; }
      const pg = pages.find((p) => p.id === id);
      const n = pg.connectors.length + pg.wires.length + pg.tubes.length + pg.texts.length;
      if (n && !confirm(`ページ「${pg.name}」を削除しますか？（部品・配線など ${n} 個も削除されます。元に戻す で復元できます）`)) return;
      store.commit((p) => {
        const i = p.pages.findIndex((x) => x.id === id);
        p.pages.splice(i, 1);
        if (p.activePageId === id) p.activePageId = p.pages[Math.min(i, p.pages.length - 1)].id;
      });
      store.select(null);
    },
    renamePage(id, name) {
      name = (name || '').trim();
      if (!name) return;
      store.commit((p) => { p.pages.find((x) => x.id === id).name = name; });
    },
    /** ページを index の位置へ移動 */
    movePage(id, index) {
      const from = store.project.pages.findIndex((p) => p.id === id);
      index = Math.max(0, Math.min(store.project.pages.length - 1, index));
      if (from < 0 || from === index) return;
      store.commit((p) => { const [pg] = p.pages.splice(from, 1); p.pages.splice(index, 0, pg); });
    },
    setPaper(paper) {
      store.commit((p) => { activePage(p).paper = paper; });
    },

    // ---------- ファイル ----------
    newProject() {
      if (!confirm('新しいプロジェクトを作成します。現在の図面は閉じられます（保存していない変更は失われます）。よろしいですか？')) return;
      store.replace(createProject());
    },
    saveFile() {
      downloadProject(store.project);
    },
    async openFile(file) {
      try {
        const project = file ? await readProjectFile(file) : await pickProjectFile();
        if (!project) return;
        const hasWork = store.project.pages.some((p) => p.connectors.length || p.wires.length || p.texts.length);
        if (!file && hasWork && !confirm(`「${project.name}」を開きます。現在の図面は閉じられます（保存していない変更は失われます）。よろしいですか？`)) return;
        store.replace(project);
      } catch (e) {
        alert(`読み込みに失敗しました。\n${e.message}`);
      }
    },
    renameProject(name) {
      const v = (name || '').trim() || '新規プロジェクト';
      if (v !== store.project.name) store.commit((p) => { p.name = v; });
    },

    toggleGrid: () => store.setUi({ showGrid: !store.ui.showGrid }),
    toggleSnap: () => store.setUi({ snap: !store.ui.snap }),
    setDisplay(key, value) {
      store.commit((p) => { p.settings.display[key] = value; });
    },
  };
  return cmd;
}

export function bindKeyboard(store, cmd, canvas) {
  window.addEventListener('keydown', (ev) => {
    const t = ev.target;
    if (t.matches?.('input, textarea, select, [contenteditable]')) return;
    const ctrl = ev.ctrlKey || ev.metaKey;
    const k = ev.key.toLowerCase();
    const step = ev.shiftKey ? 10 : 1;
    const handled = (() => {
      if (ctrl && k === 'z' && !ev.shiftKey) return cmd.undo(), true;
      if (ctrl && (k === 'y' || (k === 'z' && ev.shiftKey))) return cmd.redo(), true;
      if (ctrl && k === 'c') return cmd.copy(), true;
      if (ctrl && k === 'v') return cmd.paste(), true;
      if (ctrl && k === 'd') return cmd.duplicate(), true;
      if (ctrl && k === 's') return cmd.saveFile(), true;
      if (ctrl && k === 'o') return cmd.openFile(), true;
      if (ctrl && k === 'p') return cmd.exportPdf?.(), true;
      if (k === 'pageup') return cmd.switchPageBy(-1), true;
      if (k === 'pagedown') return cmd.switchPageBy(1), true;
      if (ctrl) return false;
      if (k === 'delete' || k === 'backspace') return cmd.deleteSelection(), true;
      if (k === 'r') return cmd.rotate(ev.shiftKey ? -90 : 90), true;
      if (k === 'w') return cmd.toggleWireTool(), true;
      if (k === 't') return cmd.toggleTubeTool(), true;
      if (k === 'g') return cmd.toggleGrid(), true;
      if (k === 'f') return canvas.fit(), true;
      if (k === 'escape') {
        if (store.ui.wireStart) store.setUi({ wireStart: null });
        else if (store.ui.tool !== 'select') cmd.setTool('select');
        else store.select(null);
        return true;
      }
      if (k === 'arrowleft') return cmd.nudge(-step, 0), true;
      if (k === 'arrowright') return cmd.nudge(step, 0), true;
      if (k === 'arrowup') return cmd.nudge(0, -step), true;
      if (k === 'arrowdown') return cmd.nudge(0, step), true;
      if (k === '+' || k === ';') return canvas.zoomAt(1.2), true;
      if (k === '-') return canvas.zoomAt(1 / 1.2), true;
      return false;
    })();
    if (handled) ev.preventDefault();
  });
}
