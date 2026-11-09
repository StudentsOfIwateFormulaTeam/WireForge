// コルゲートチューブの位置計算。
// チューブは「基準配線」の経路上の範囲 t0〜t1（長さ比 0〜1）として保持するので、
// コネクタや折れ点を動かしてもチューブは配線に沿って追従する。
import { wirePoints, pointAt, subPolyline, polylineLength } from './wires.js';
import { tubeSizeOf } from '../catalog/tubeSpecs.js';

export const MIN_SPAN = 0.02;

/** 描画用の形状。基準配線が無効なら null */
export function tubeGeometry(page, tube) {
  const wire = page.wires.find((w) => w.id === tube.wireId);
  const wpts = wire && wirePoints(page, wire);
  if (!wpts) return null;
  const t0 = Math.max(0, Math.min(tube.t0, tube.t1));
  const t1 = Math.min(1, Math.max(tube.t0, tube.t1));
  const pts = subPolyline(wpts, t0, t1);
  if (pts.length < 2) return null;
  const width = tubeSizeOf(tube.size).width;
  const mid = pointAt(pts, 0.5);
  // ラベルの既定位置: 範囲中央から法線方向（上側）へ離す
  let nx = -Math.sin(mid.angle), ny = Math.cos(mid.angle);
  if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
  const d = width / 2 + 6;
  const dx = tube.labelDx ?? nx * d;
  const dy = tube.labelDy ?? ny * d;
  return {
    wirePts: wpts,
    pts,
    width,
    mid,
    label: { x: mid.x + dx, y: mid.y + dy, dx, dy },
    drawnLength: polylineLength(pts),
  };
}

/** 範囲 [t0,t1] を幅を保ったまま delta だけずらす（0〜1 に収める） */
export function shiftRange(t0, t1, delta) {
  const span = t1 - t0;
  let a = t0 + delta;
  a = Math.max(0, Math.min(1 - span, a));
  return [a, a + span];
}

/** 配線を削除した後、存在しない配線を対象から外す。基準配線が消えたら残りの対象へ付け替え、対象が無くなったチューブは削除 */
export function pruneTubes(page) {
  const ids = new Set(page.wires.map((w) => w.id));
  page.tubes = page.tubes.filter((t) => {
    t.wireIds = t.wireIds.filter((id) => ids.has(id));
    if (!ids.has(t.wireId)) {
      if (!t.wireIds.length) return false;
      t.wireId = t.wireIds[0];
    }
    if (!t.wireIds.includes(t.wireId)) t.wireIds.unshift(t.wireId);
    return true;
  });
}

/** 配線を覆っているチューブ */
export function tubesOnWire(page, wireId) {
  return page.tubes.filter((t) => t.wireIds.includes(wireId));
}
