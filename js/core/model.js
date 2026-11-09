// プロジェクト（図面データ）のスキーマと生成関数。
// 保存形式(JSON)の互換性を保つため、構造を変える時は SCHEMA_VERSION を上げて migrate() に変換を追加する。

import { DEFAULT_TUBE } from '../catalog/tubeSpecs.js';

export const FILE_FORMAT = 'sift-harness-diagram';
export const SCHEMA_VERSION = 1;

export const PAPER_SIZES = {
  'A4-landscape': { label: 'A4 横', w: 297, h: 210 },
  'A4-portrait': { label: 'A4 縦', w: 210, h: 297 },
  'A3-landscape': { label: 'A3 横', w: 420, h: 297 },
  'A3-portrait': { label: 'A3 縦', w: 297, h: 420 },
};

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function createPage(name = 'ページ 1') {
  return {
    id: uid('pg'),
    name,
    paper: 'A4-landscape',
    connectors: [], // { id, partId, label, x, y, rotation, mirror, scale, showFlange }
    wires: [], // { id, from:{connectorId,pinId}, to:{connectorId,pinId}, name, type, gauge, color, length(mm), lengthUnit, waypoints:[[x,y]] }
    tubes: [], // { id, label, size(φ), color, wireId(基準配線), wireIds(対象配線), t0, t1(基準配線上の範囲 0〜1), length(mm), lengthUnit, labelDx, labelDy }
    texts: [], // { id, x, y(左上, mm), text(改行可), size(文字高さ mm), bold, frame(枠付き = 注記) }
    titleBlock: defaultTitleBlock(),
  };
}

/** 表題欄（図面右下） */
export function defaultTitleBlock() {
  return { show: true, title: '', drawingNo: '', author: '', date: '', revision: '' };
}

export const DEFAULT_TEXT = { text: 'テキスト', size: 3.5, bold: false, frame: false };

export function createText(x, y, props = {}) {
  return { id: uid('tx'), x, y, ...DEFAULT_TEXT, ...props };
}

/** ページの複製。部品・配線・チューブ・テキストの id を振り直し、相互参照も付け替える */
export function clonePage(page, name) {
  const pg = structuredClone(page);
  pg.id = uid('pg');
  pg.name = name;
  const cmap = new Map(), wmap = new Map();
  for (const c of pg.connectors) { const id = uid('cn'); cmap.set(c.id, id); c.id = id; }
  for (const w of pg.wires) {
    const id = uid('wr'); wmap.set(w.id, id); w.id = id;
    w.from.connectorId = cmap.get(w.from.connectorId) ?? w.from.connectorId;
    w.to.connectorId = cmap.get(w.to.connectorId) ?? w.to.connectorId;
  }
  for (const t of pg.tubes) {
    t.id = uid('tb');
    t.wireId = wmap.get(t.wireId) ?? t.wireId;
    t.wireIds = t.wireIds.map((id) => wmap.get(id) ?? id);
  }
  for (const t of pg.texts) t.id = uid('tx');
  return pg;
}

/** 既存のページ名と重複しない「ページ n」 */
export function nextPageName(project) {
  const used = new Set(project.pages.map((p) => p.name));
  let n = project.pages.length + 1;
  while (used.has(`ページ ${n}`)) n++;
  return `ページ ${n}`;
}

export function createProject(name = '新規プロジェクト') {
  const page = createPage();
  return {
    format: FILE_FORMAT,
    version: SCHEMA_VERSION,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: defaultSettings(),
    pages: [page],
    activePageId: page.id,
  };
}

export function defaultSettings() {
  return {
    display: { wireName: true, wireEnds: true, wireSpec: true, wireLength: true, tubeLabel: true },
  };
}

export const DEFAULT_WIRE = { name: '', type: 'AVSS', gauge: 0.5, color: 'B', length: null, lengthUnit: 'mm' };

export function createWire(from, to, props = {}) {
  return {
    id: uid('wr'),
    from: { ...from },
    to: { ...to },
    ...DEFAULT_WIRE,
    ...props,
    waypoints: [],
  };
}

export function createTube(wireId, t0, t1, props = {}) {
  return {
    id: uid('tb'),
    label: 'T1',
    ...DEFAULT_TUBE,
    ...props,
    wireId,
    wireIds: [wireId],
    t0: Math.min(t0, t1),
    t1: Math.max(t0, t1),
    labelDx: null, // ラベル位置（範囲中央からのずれ, mm）。null = 自動
    labelDy: null,
  };
}

/** 既存チューブ(T1, T2, …)と重複しない次のラベル */
export function nextTubeLabel(project) {
  const used = new Set();
  for (const pg of project.pages) for (const t of pg.tubes || []) used.add(t.label);
  let n = 1;
  while (used.has(`T${n}`)) n++;
  return `T${n}`;
}

export function createConnectorInstance(part, { x, y, label }) {
  return {
    id: uid('cn'),
    partId: part.id,
    label,
    x,
    y,
    rotation: 0,
    mirror: false,
    scale: part.defaultScale ?? 1,
    showFlange: true,
  };
}

/** 既存ラベル(J1, J2, …)と重複しない次のラベル */
export function nextConnectorLabel(project) {
  const used = new Set();
  for (const pg of project.pages) for (const c of pg.connectors) used.add(c.label);
  let n = 1;
  while (used.has(`J${n}`)) n++;
  return `J${n}`;
}

/** 読み込んだ JSON を現行スキーマへ変換 */
export function migrate(data) {
  if (!data || data.format !== FILE_FORMAT) throw new Error('このアプリのプロジェクトファイルではありません');
  if (data.version > SCHEMA_VERSION) throw new Error(`新しいバージョン(v${data.version})のファイルです。アプリを更新してください`);
  // v1 が最初のバージョン。将来: if (data.version === 1) { ...; data.version = 2; }
  const def = defaultSettings();
  data.settings = { ...def, ...(data.settings || {}) };
  data.settings.display = { ...def.display, ...(data.settings.display || {}) };
  if (!Array.isArray(data.pages) || !data.pages.length) throw new Error('ページ情報がありません');
  data.name ??= '無題のプロジェクト';
  for (const pg of data.pages) {
    pg.id ??= uid('pg');
    pg.name ??= 'ページ';
    pg.connectors ??= [];
    pg.wires ??= [];
    for (const w of pg.wires) w.waypoints ??= [];
    pg.tubes ??= [];
    for (const t of pg.tubes) {
      t.wireIds ??= t.wireId ? [t.wireId] : [];
      t.wireId ??= t.wireIds[0];
      t.labelDx ??= null;
      t.labelDy ??= null;
    }
    pg.texts ??= [];
    for (const t of pg.texts) Object.assign(t, { ...DEFAULT_TEXT, ...t });
    pg.titleBlock = { ...defaultTitleBlock(), ...(pg.titleBlock || {}) };
    pg.paper = PAPER_SIZES[pg.paper] ? pg.paper : 'A4-landscape';
  }
  if (!data.pages.some((p) => p.id === data.activePageId)) data.activePageId = data.pages[0].id;
  return data;
}
