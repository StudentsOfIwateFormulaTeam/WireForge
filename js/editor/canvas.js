// 図面編集エリア: 表示（パン・ズーム）と マウス操作（選択・移動・D&D配置・配線）
import { s } from '../render/svg.js';
import { renderSheet, gridDefs, paperOf } from '../render/sheetRenderer.js';
import { snap } from '../core/geometry.js';
import { getPart } from '../catalog/connectors/index.js';
import { createConnectorInstance, nextConnectorLabel, createTube, nextTubeLabel } from '../core/model.js';
import { tubeGeometry, shiftRange, MIN_SPAN } from '../core/tubes.js';
import { fitTransform } from './print.js';
import { pinWorld, wirePoints, nearestT, polylineLength } from '../core/wires.js';

const MIN_ZOOM = 0.3, MAX_ZOOM = 40; // px / mm
const HANDLE_PX = 5; // 編集ハンドルの半径（画面 px）

const activePage = (p) => p.pages.find((pg) => pg.id === p.activePageId);

export function createCanvas(container, store, cmd, { onCursor } = {}) {
  const svg = s('svg', { class: 'canvas-svg', tabindex: 0 });
  const defsHolder = s('g');
  const viewport = s('g', { class: 'viewport' });
  const sheetHolder = s('g');
  const overlay = s('g', { class: 'overlay' }); // 画面専用（印刷しない）: ハンドル・配線プレビュー
  viewport.append(sheetHolder, overlay);
  svg.append(defsHolder, viewport);
  container.appendChild(svg);

  const hint = document.createElement('div');
  hint.className = 'canvas-hint';
  container.appendChild(hint);
  const warn = document.createElement('div');
  warn.className = 'canvas-warn';
  warn.hidden = true;
  warn.textContent = '⚠ 図枠の外にはみ出している図があります（PDF では縮小して枠内に収めます）';
  container.appendChild(warn);
  let lastPaperKey = null;

  const view = { zoom: 3, tx: 40, ty: 40 };
  let lastGridStep = null;
  let cursor = [0, 0];
  let rubber = null;

  function applyView() {
    viewport.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.zoom})`);
    container.dispatchEvent(new CustomEvent('zoomchange', { detail: view.zoom }));
    renderOverlay();
  }

  function render() {
    const ui = store.ui;
    if (ui.gridStep !== lastGridStep) {
      defsHolder.replaceChildren(gridDefs(ui.gridStep));
      lastGridStep = ui.gridStep;
    }
    const project = store.project, page = store.page;
    const sheet = renderSheet(page, {
      selection: ui.selection,
      showGrid: ui.showGrid,
      display: project.settings?.display,
      info: { projectName: project.name, pageNo: project.pages.indexOf(page) + 1, pageCount: project.pages.length },
    });
    sheetHolder.replaceChildren(sheet);
    // はみ出し警告（印刷時と同じ判定）
    let bbox = null;
    try { bbox = sheet.querySelector('.content').getBBox(); } catch { /* 非表示 */ }
    warn.hidden = !fitTransform(bbox, paperOf(page), 0.5);
    // ページ切替で用紙サイズが変わったら全体表示
    const paperKey = `${page.id}:${page.paper}`;
    if (lastPaperKey && lastPaperKey !== paperKey) {
      const prevPaper = lastPaperKey.split(':')[1];
      if (prevPaper !== page.paper) requestAnimationFrame(fit);
    }
    lastPaperKey = paperKey;
    svg.classList.toggle('tool-wire', ui.tool === 'wire');
    svg.classList.toggle('tool-tube', ui.tool === 'tube');
    renderOverlay();
    renderHint();
  }

  function renderHint() {
    const ui = store.ui;
    if (ui.tool === 'tube') {
      hint.hidden = false;
      hint.textContent = 'チューブモード：配線の上をドラッグして被せる範囲を指定（クリックだけなら既定の長さ）／T・Esc で終了';
      return;
    }
    if (ui.tool !== 'wire') { hint.hidden = true; return; }
    hint.hidden = false;
    hint.textContent = ui.wireStart
      ? '配線モード：接続先のピンをクリック（Esc で始点を取り消し）'
      : '配線モード：始点のピンをクリック（W / Esc で終了）';
  }

  function renderOverlay() {
    const ui = store.ui;
    const r = HANDLE_PX / view.zoom;
    const items = [];

    // 配線モード: 始点マーカーとラバーバンド
    rubber = null;
    if (ui.tool === 'wire' && ui.wireStart) {
      const a = pinWorld(store.page, ui.wireStart);
      if (a) {
        rubber = s('line', { class: 'rubber', x1: a[0], y1: a[1], x2: cursor[0], y2: cursor[1], 'stroke-width': 1.5 / view.zoom });
        items.push(rubber, s('circle', { class: 'wire-start', cx: a[0], cy: a[1], r: r * 1.3, 'stroke-width': 2 / view.zoom }));
      }
    }

    // 選択中の配線: 中継点ハンドルと、区間中央の「追加」ハンドル
    const sel = ui.selection;
    if (sel?.kind === 'wire' && ui.tool === 'select') {
      const w = store.page.wires.find((x) => x.id === sel.id);
      const pts = w && wirePoints(store.page, w);
      if (pts) {
        for (let i = 1; i < pts.length; i++) {
          const mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2;
          items.push(s('circle', {
            class: 'handle handle-add', cx: mx, cy: my, r: r * 0.8, 'stroke-width': 1.2 / view.zoom,
            'data-kind': 'handle-add', 'data-id': w.id, 'data-index': i - 1,
          }));
        }
        w.waypoints.forEach(([x, y], i) => {
          items.push(s('rect', {
            class: 'handle handle-wp', x: x - r, y: y - r, width: r * 2, height: r * 2, 'stroke-width': 1.2 / view.zoom,
            'data-kind': 'handle-wp', 'data-id': w.id, 'data-index': i,
          }));
        });
      }
    }
    // 選択中のチューブ: 両端の範囲ハンドル
    if (sel?.kind === 'tube' && ui.tool === 'select') {
      const t = store.page.tubes.find((x) => x.id === sel.id);
      const geo = t && tubeGeometry(store.page, t);
      if (geo) {
        [['t0', geo.pts[0]], ['t1', geo.pts[geo.pts.length - 1]]].forEach(([end, [x, y]]) => {
          items.push(s('circle', {
            class: 'handle handle-tube', cx: x, cy: y, r: r * 1.1, 'stroke-width': 1.5 / view.zoom,
            'data-kind': 'handle-tube', 'data-id': t.id, 'data-end': end,
          }));
        });
      }
    }
    overlay.replaceChildren(...items);
  }

  /** 画面座標 → 図面座標(mm) */
  function toSheet(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return [(clientX - r.left - view.tx) / view.zoom, (clientY - r.top - view.ty) / view.zoom];
  }

  function zoomAt(factor, clientX, clientY) {
    const r = svg.getBoundingClientRect();
    const px = clientX ?? r.left + r.width / 2;
    const py = clientY ?? r.top + r.height / 2;
    const [mx, my] = toSheet(px, py);
    view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
    view.tx = px - r.left - mx * view.zoom;
    view.ty = py - r.top - my * view.zoom;
    applyView();
  }

  function fit() {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const paper = paperOf(store.page);
    const pad = 24;
    view.zoom = Math.min((r.width - pad * 2) / paper.w, (r.height - pad * 2) / paper.h);
    view.tx = (r.width - paper.w * view.zoom) / 2;
    view.ty = (r.height - paper.h * view.zoom) / 2;
    applyView();
  }

  const stepNow = () => (store.ui.snap ? store.ui.snapStep : 0);
  const findWire = (p, id) => activePage(p).wires.find((w) => w.id === id);
  const findTube = (p, id) => activePage(p).tubes.find((t) => t.id === id);
  /** 図面座標から、チューブの基準配線上の t */
  const tOnWire = (wireId, x, y) => {
    const w = findWire(store.project, wireId);
    const pts = w && wirePoints(store.page, w);
    return pts ? Math.round(nearestT(pts, x, y).t * 1000) / 1000 : null;
  };

  // ---------- マウス操作 ----------
  let drag = null;

  function capture(ev) {
    try { svg.setPointerCapture(ev.pointerId); } catch { /* 合成イベント等 */ }
  }

  svg.addEventListener('pointerdown', (ev) => {
    svg.focus();
    const target = ev.target.closest('[data-kind]');
    const kind = target?.getAttribute('data-kind');
    const id = target?.getAttribute('data-id');
    const [mx, my] = toSheet(ev.clientX, ev.clientY);

    // 中ボタン / 空白部 → パン
    if (ev.button === 1 || (ev.button === 0 && (!kind || kind === 'paper'))) {
      if (ev.button === 0 && store.ui.tool === 'select') store.select(null);
      drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, tx: view.tx, ty: view.ty };
      capture(ev);
      svg.classList.add('panning');
      return;
    }
    if (ev.button !== 0) return;

    // 配線モード: ピンを 2 回クリックして接続
    if (store.ui.tool === 'wire') {
      if (kind !== 'pin') return;
      const end = { connectorId: id, pinId: target.getAttribute('data-pin') };
      const start = store.ui.wireStart;
      if (!start) {
        store.setUi({ wireStart: end });
      } else if (start.connectorId === end.connectorId && start.pinId === end.pinId) {
        store.setUi({ wireStart: null });
      } else {
        store.ui.wireStart = null;
        cmd.addWire(start, end);
      }
      return;
    }

    // チューブモード: 配線の上をドラッグして範囲を指定
    if (store.ui.tool === 'tube') {
      let wireId = null;
      if (kind === 'wire' || kind === 'wire-label') wireId = id;
      else if (kind === 'tube' || kind === 'tube-label') wireId = store.page.tubes.find((t) => t.id === id)?.wireId;
      if (!wireId) return;
      const t = tOnWire(wireId, mx, my);
      if (t == null) return;
      const snapshot = store.begin();
      const tube = createTube(wireId, t, t, { ...(store.ui.lastTube || {}), label: nextTubeLabel(store.project) });
      store.live((p) => activePage(p).tubes.push(tube));
      store.ui.selection = { kind: 'tube', id: tube.id };
      drag = { mode: 'tube-create', id: tube.id, wireId, ta: t, snapshot };
      capture(ev);
      return;
    }

    if (kind === 'handle-tube') {
      drag = { mode: 'tube-end', id, end: target.getAttribute('data-end'), snapshot: store.begin() };
      capture(ev);
      return;
    }

    if (kind === 'tube') {
      store.select({ kind: 'tube', id });
      const tube = store.page.tubes.find((t) => t.id === id);
      const t = tOnWire(tube.wireId, mx, my);
      if (t != null) {
        drag = { mode: 'tube-move', id, wireId: tube.wireId, ta: t, t0: tube.t0, t1: tube.t1, snapshot: store.begin() };
        capture(ev);
      }
      return;
    }

    if (kind === 'tube-label') {
      store.select({ kind: 'tube', id });
      const tube = store.page.tubes.find((t) => t.id === id);
      const geo = tubeGeometry(store.page, tube);
      if (geo) {
        drag = { mode: 'tube-label', id, sx: mx, sy: my, dx: geo.label.dx, dy: geo.label.dy, snapshot: store.begin() };
        capture(ev);
      }
      return;
    }

    if (kind === 'handle-wp' || kind === 'handle-add') {
      const index = +target.getAttribute('data-index');
      const snapshot = store.begin();
      let wpIndex = index;
      if (kind === 'handle-add') {
        store.live((p) => findWire(p, id).waypoints.splice(index, 0, [snap(mx, stepNow()), snap(my, stepNow())]));
      }
      drag = { mode: 'waypoint', id, wpIndex, snapshot };
      capture(ev);
      return;
    }

    if (kind === 'wire' || kind === 'wire-label') {
      store.select({ kind: 'wire', id });
      if (kind === 'wire-label') {
        drag = { mode: 'label', id, snapshot: store.begin() };
        capture(ev);
      }
      return;
    }

    if (kind === 'titleBlock') {
      store.select({ kind: 'titleBlock' });
      return;
    }

    if (kind === 'text') {
      store.select({ kind: 'text', id });
      const t = store.page.texts.find((x) => x.id === id);
      drag = { mode: 'move-text', id, ox: t.x - mx, oy: t.y - my, snapshot: store.begin() };
      capture(ev);
      return;
    }

    if (kind === 'pin') {
      store.select({ kind: 'pin', connectorId: id, pinId: target.getAttribute('data-pin') });
    } else if (kind === 'connector') {
      store.select({ kind: 'connector', id });
    }
    const inst = store.page.connectors.find((c) => c.id === id);
    if (!inst) return;
    drag = { mode: 'move', id, ox: inst.x - mx, oy: inst.y - my, snapshot: store.begin() };
    capture(ev);
  });

  svg.addEventListener('pointermove', (ev) => {
    const [mx, my] = toSheet(ev.clientX, ev.clientY);
    cursor = [mx, my];
    onCursor?.(mx, my);
    if (rubber) { rubber.setAttribute('x2', mx); rubber.setAttribute('y2', my); }
    if (!drag) return;
    const step = stepNow();
    if (drag.mode === 'pan') {
      view.tx = drag.tx + ev.clientX - drag.sx;
      view.ty = drag.ty + ev.clientY - drag.sy;
      applyView();
    } else if (drag.mode === 'move') {
      const nx = snap(mx + drag.ox, step), ny = snap(my + drag.oy, step);
      store.live((p) => {
        const c = activePage(p).connectors.find((c) => c.id === drag.id);
        if (c) { c.x = nx; c.y = ny; }
      });
    } else if (drag.mode === 'move-text') {
      const nx = snap(mx + drag.ox, step), ny = snap(my + drag.oy, step);
      store.live((p) => {
        const t = activePage(p).texts.find((t) => t.id === drag.id);
        if (t) { t.x = nx; t.y = ny; }
      });
    } else if (drag.mode === 'waypoint') {
      store.live((p) => { findWire(p, drag.id).waypoints[drag.wpIndex] = [snap(mx, step), snap(my, step)]; });
    } else if (drag.mode === 'tube-create' || drag.mode === 'tube-move' || drag.mode === 'tube-end') {
      const tube = findTube(store.project, drag.id);
      const t = tube && tOnWire(tube.wireId, mx, my);
      if (t == null) return;
      store.live((p) => {
        const tb = findTube(p, drag.id);
        if (drag.mode === 'tube-create') {
          tb.t0 = Math.min(drag.ta, t); tb.t1 = Math.max(drag.ta, t);
        } else if (drag.mode === 'tube-move') {
          [tb.t0, tb.t1] = shiftRange(drag.t0, drag.t1, t - drag.ta);
        } else if (drag.end === 't0') {
          tb.t0 = Math.min(t, tb.t1 - MIN_SPAN);
        } else {
          tb.t1 = Math.max(t, tb.t0 + MIN_SPAN);
        }
      });
    } else if (drag.mode === 'tube-label') {
      const r = (v) => Math.round(v * 10) / 10;
      store.live((p) => {
        const tb = findTube(p, drag.id);
        tb.labelDx = r(drag.dx + mx - drag.sx);
        tb.labelDy = r(drag.dy + my - drag.sy);
      });
    } else if (drag.mode === 'label') {
      const w = findWire(store.project, drag.id);
      const pts = wirePoints(store.page, w);
      if (pts) {
        const t = Math.round(nearestT(pts, mx, my).t * 1000) / 1000;
        store.live((p) => { findWire(p, drag.id).labelT = t; });
      }
    }
  });

  const endDrag = () => {
    if (drag?.mode === 'tube-create') finishTubeCreate();
    if (drag?.snapshot) store.end(drag.snapshot);
    svg.classList.remove('panning');
    drag = null;
  };
  /** クリックだけ（範囲がほぼ 0）の時は、クリック位置を中心に既定の長さ（約 40mm, 最大で配線の 60%）にする */
  function finishTubeCreate() {
    const tube = findTube(store.project, drag.id);
    if (tube && tube.t1 - tube.t0 < MIN_SPAN) {
      const pts = wirePoints(store.page, findWire(store.project, drag.wireId));
      const L = pts ? polylineLength(pts) : 0;
      const span = L ? Math.min(0.6, Math.max(MIN_SPAN * 2, 40 / L)) : 0.4;
      const [a, b] = shiftRange(0, span, drag.ta - span / 2);
      tube.t0 = Math.round(a * 1000) / 1000;
      tube.t1 = Math.round(b * 1000) / 1000;
    }
    store.ui.tool = 'select';
    store.select({ kind: 'tube', id: drag.id });
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  // 中継点のダブルクリックで削除
  svg.addEventListener('dblclick', (ev) => {
    // テキスト・表題欄のダブルクリック → プロパティパネルの入力欄へ
    if (ev.target.closest('[data-kind="text"], [data-kind="titleBlock"]')) {
      container.dispatchEvent(new CustomEvent('edit-request', { bubbles: true }));
      return;
    }
    const target = ev.target.closest('[data-kind="handle-wp"]');
    if (!target) return;
    const id = target.getAttribute('data-id');
    const index = +target.getAttribute('data-index');
    store.commit((p) => findWire(p, id).waypoints.splice(index, 1));
  });

  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    zoomAt(Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY);
  }, { passive: false });

  // ---------- 部品パネルからのドラッグ＆ドロップ ----------
  svg.addEventListener('dragover', (ev) => {
    if (ev.dataTransfer.types.includes('application/x-part-id')) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    }
  });
  svg.addEventListener('drop', (ev) => {
    const partId = ev.dataTransfer.getData('application/x-part-id');
    if (!partId) return;
    ev.preventDefault();
    const [mx, my] = toSheet(ev.clientX, ev.clientY);
    placePart(partId, mx, my);
  });

  function placePart(partId, x, y) {
    const part = getPart(partId);
    if (!part || part.unavailable) return;
    if (x == null) {
      const r = svg.getBoundingClientRect();
      [x, y] = toSheet(r.left + r.width / 2, r.top + r.height / 2);
    }
    const step = stepNow();
    const inst = createConnectorInstance(part, { x: snap(x, step), y: snap(y, step), label: nextConnectorLabel(store.project) });
    store.commit((p) => activePage(p).connectors.push(inst));
    store.select({ kind: 'connector', id: inst.id });
  }

  let fitted = false;
  new ResizeObserver(() => { if (!fitted) { fit(); fitted = true; } }).observe(container);

  store.subscribe(render);
  render();
  applyView();

  /** 表示中の領域の中心（図面座標） */
  function viewCenter() {
    const r = svg.getBoundingClientRect();
    return toSheet(r.left + r.width / 2, r.top + r.height / 2);
  }

  /** 選択中の部品が画面外なら、画面中央へスクロールする（図面チェックの「該当箇所へ移動」用） */
  function reveal(sel = store.ui.selection) {
    if (!sel) return;
    const id = sel.kind === 'pin' ? sel.connectorId : sel.id;
    const kind = sel.kind === 'pin' ? 'connector' : sel.kind;
    const node = kind === 'titleBlock'
      ? sheetHolder.querySelector('[data-kind="titleBlock"]')
      : sheetHolder.querySelector(`[data-kind="${kind}"][data-id="${CSS.escape(id)}"]`);
    if (!node) return;
    const r = node.getBoundingClientRect(), box = svg.getBoundingClientRect();
    const m = 40;
    const visible = r.left >= box.left + m && r.right <= box.right - m && r.top >= box.top + m && r.bottom <= box.bottom - m;
    if (visible) return;
    view.tx += box.left + box.width / 2 - (r.left + r.width / 2);
    view.ty += box.top + box.height / 2 - (r.top + r.height / 2);
    applyView();
  }

  return { svg, fit, zoomAt, placePart, render, viewCenter, reveal, get zoom() { return view.zoom; } };
}
