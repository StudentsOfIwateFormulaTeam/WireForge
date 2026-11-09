// 図面チェック（データの整合性・記入漏れの検出）。
// 図面データは変更せず、問題の一覧だけを返す。UI は js/ui/checkDialog.js。
import { getPart, getPin } from '../catalog/connectors/index.js';
import { worldBounds } from './geometry.js';
import { wirePoints, endLabel, netOfWire } from './wires.js';
import { tubeGeometry } from './tubes.js';
import { textBounds, TITLE_BLOCK } from '../render/textRenderer.js';
import { wireLabelBox } from '../render/wireRenderer.js';
import { tubeLabelBox } from '../render/tubeRenderer.js';
import { PAPER_SIZES } from './model.js';

const FRAME_MARGIN_MM = 10; // sheetRenderer の FRAME_MARGIN と同じ

/**
 * level: 'error'（図面が正しく描けない・内容が矛盾）/ 'warn'（設計ミスの可能性）/ 'info'（記入漏れ）
 * @returns [{ level, pageId, pageName, sel, message }]
 *   sel = 該当箇所を選択するための store.select() の引数（無ければ null）
 */
export function checkProject(project) {
  const out = [];
  for (const page of project.pages) checkPage(page, out, project.settings?.display || {});
  checkAcrossPages(project, out);
  const order = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

const wireName = (page, w) => {
  const route = `${endLabel(page, w.from)} → ${endLabel(page, w.to)}`;
  return w.name ? `配線「${w.name}」(${route})` : `配線 ${route}`;
};

function checkPage(page, out, display) {
  const add = (level, sel, message) => out.push({ level, pageId: page.id, pageName: page.name, sel, message });
  const paper = PAPER_SIZES[page.paper] || PAPER_SIZES['A4-landscape'];

  // ---- コネクタ ----
  const labels = new Map();
  const pinUse = new Map(); // `${connectorId}:${pinId}` -> wires
  for (const c of page.connectors) {
    const sel = { kind: 'connector', id: c.id };
    const part = getPart(c.partId);
    if (!part) add('error', sel, `コネクタ ${c.label}: 部品データ「${c.partId}」がカタログにありません（図面に描画されません）`);
    else if (part.unavailable) add('error', sel, `コネクタ ${c.label}: ${part.partNo} は資料不足のため描画できません`);
    if (!String(c.label ?? '').trim()) add('warn', sel, `コネクタ（${part?.partNo ?? c.partId}）の名前が空です`);
    else labels.set(c.label, [...(labels.get(c.label) || []), c]);
  }
  for (const [label, cs] of labels) {
    if (cs.length > 1) add('warn', { kind: 'connector', id: cs[1].id }, `コネクタ名「${label}」がこのページに ${cs.length} 個あります（どれを指すか区別できません）`);
  }

  // ---- 配線 ----
  const names = new Map();
  for (const w of page.wires) {
    const sel = { kind: 'wire', id: w.id };
    let broken = false;
    for (const [end, side] of [[w.from, '始点'], [w.to, '終点']]) {
      const inst = page.connectors.find((c) => c.id === end?.connectorId);
      if (!inst) { add('error', sel, `${wireName(page, w)}: ${side}のコネクタがありません（配線が描画されません）`); broken = true; continue; }
      const part = getPart(inst.partId);
      if (part && !getPin(part, end.pinId)) { add('error', sel, `${wireName(page, w)}: ${side}のピン「${end.pinId}」が ${inst.label} にありません`); broken = true; continue; }
      const k = `${end.connectorId}:${end.pinId}`;
      pinUse.set(k, [...(pinUse.get(k) || []), w]);
    }
    if (!broken && w.from.connectorId === w.to.connectorId && w.from.pinId === w.to.pinId) {
      add('error', sel, `${wireName(page, w)}: 始点と終点が同じピンです`);
    }
    if (!String(w.name ?? '').trim()) add('info', sel, `${wireName(page, w)}: 配線名が未入力です`);
    else names.set(w.name, [...(names.get(w.name) || []), w]);
    if (w.length == null || w.length === '') add('info', sel, `${wireName(page, w)}: 長さが未入力です`);
    else if (!(+w.length > 0)) add('warn', sel, `${wireName(page, w)}: 長さ ${w.length} が正の数ではありません`);
  }
  for (const [k, ws] of pinUse) {
    if (ws.length < 2) continue;
    const [cid, pid] = k.split(':');
    const inst = page.connectors.find((c) => c.id === cid);
    const pin = getPin(getPart(inst?.partId), pid);
    add('warn', { kind: 'pin', connectorId: cid, pinId: pid }, `ピン ${inst?.label}-${pin?.label ?? pid} に配線が ${ws.length} 本接続されています（1 端子に複数本を圧着する意図か確認してください）`);
  }
  for (const [name, ws] of names) {
    // 同名でも同じネット（ピンでつながっている）なら正常とみなす
    if (ws.length > 1 && !ws.every((w) => netOfWire(page, ws[0].id).has(w.id))) {
      add('warn', { kind: 'wire', id: ws[1].id }, `配線名「${name}」がこのページで、つながっていない ${ws.length} 本の配線に使われています`);
    }
  }

  // ---- チューブ ----
  const wireIds = new Set(page.wires.map((w) => w.id));
  for (const t of page.tubes) {
    const sel = { kind: 'tube', id: t.id };
    if (!wireIds.has(t.wireId)) add('error', sel, `チューブ ${t.label}: 基準の配線がありません（描画されません）`);
    else if (!tubeGeometry(page, t)) add('error', sel, `チューブ ${t.label}: 基準の配線が描画できないため表示されません`);
    const missing = (t.wireIds || []).filter((id) => !wireIds.has(id));
    if (missing.length) add('error', sel, `チューブ ${t.label}: 対象配線のうち ${missing.length} 本が存在しません`);
    if (t.length == null || t.length === '') add('info', sel, `チューブ ${t.label}: 長さが未入力です`);
  }

  // ---- 図枠・表題欄からのはみ出し ----
  const fx0 = FRAME_MARGIN_MM, fy0 = FRAME_MARGIN_MM, fx1 = paper.w - FRAME_MARGIN_MM, fy1 = paper.h - FRAME_MARGIN_MM;
  const tb = page.titleBlock?.show !== false
    ? { x: fx1 - TITLE_BLOCK.w, y: fy1 - TITLE_BLOCK.rowH * 4, w: TITLE_BLOCK.w, h: TITLE_BLOCK.rowH * 4 }
    : null;
  const outside = (b) => b.x < fx0 - 0.5 || b.y < fy0 - 0.5 || b.x + b.w > fx1 + 0.5 || b.y + b.h > fy1 + 0.5;
  const overlaps = (b) => tb && b.x < tb.x + tb.w && b.x + b.w > tb.x && b.y < tb.y + tb.h && b.y + b.h > tb.y;
  const placement = (b, sel, what) => {
    if (outside(b)) add('warn', sel, `${what}が図枠からはみ出しています（PDF では図面全体を縮小して収めます）`);
    else if (overlaps(b)) add('warn', sel, `${what}が表題欄に重なっています`);
  };
  for (const c of page.connectors) {
    const part = getPart(c.partId);
    if (part?.bounds) placement(worldBounds(c, part.bounds), { kind: 'connector', id: c.id }, `コネクタ ${c.label} `);
  }
  for (const w of page.wires) {
    const pts = wirePoints(page, w);
    if (!pts) continue;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const b = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    if (outside(b)) add('warn', { kind: 'wire', id: w.id }, `${wireName(page, w)}が図枠からはみ出しています（PDF では図面全体を縮小して収めます）`);
  }
  for (const t of page.texts) {
    const first = String(t.text ?? '').split('\n')[0].slice(0, 12);
    placement(textBounds(t), { kind: 'text', id: t.id }, `テキスト「${first}」`);
  }

  // ---- ラベル同士の重なり（読みにくくなるだけなので「未入力」と同じ扱いの参考情報） ----
  const labelBoxes = [
    ...page.wires.map((w) => ({ box: wireLabelBox(page, w, display), sel: { kind: 'wire', id: w.id }, name: `配線ラベル「${w.name || `${endLabel(page, w.from)} → ${endLabel(page, w.to)}`}」` })),
    ...(display.tubeLabel === false ? [] : page.tubes.map((t) => ({ box: tubeLabelBox(page, t), sel: { kind: 'tube', id: t.id }, name: `チューブラベル ${t.label}` }))),
  ].filter((l) => l.box);
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.2;
  const reported = new Set();
  for (let i = 0; i < labelBoxes.length; i++) {
    for (let j = i + 1; j < labelBoxes.length; j++) {
      if (reported.has(j) || !hit(labelBoxes[i].box, labelBoxes[j].box)) continue;
      reported.add(j);
      add('info', labelBoxes[j].sel, `${labelBoxes[j].name}が${labelBoxes[i].name}と重なっています（右パネルの「ラベルを自動配置」で並べ直せます）`);
    }
  }
}

function checkAcrossPages(project, out) {
  // チューブ番号はプロジェクト全体で一意に振っているので、重複は手入力の誤りの可能性
  const tubes = new Map();
  for (const pg of project.pages) for (const t of pg.tubes) tubes.set(t.label, [...(tubes.get(t.label) || []), [pg, t]]);
  for (const [label, list] of tubes) {
    if (list.length < 2) continue;
    const [pg, t] = list[1];
    out.push({ level: 'warn', pageId: pg.id, pageName: pg.name, sel: { kind: 'tube', id: t.id }, message: `チューブ番号「${label}」が ${list.length} 個あります` });
  }
}

export function countByLevel(issues) {
  const c = { error: 0, warn: 0, info: 0 };
  for (const i of issues) c[i.level]++;
  return c;
}
