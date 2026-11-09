// 幾何ユーティリティ（単位はすべて mm）

export function circlePts(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export function roundRectPts(cx, cy, w, h, r, n = 8) {
  const pts = [];
  const corners = [
    [cx + w / 2 - r, cy - h / 2 + r, -90],
    [cx + w / 2 - r, cy + h / 2 - r, 0],
    [cx - w / 2 + r, cy + h / 2 - r, 90],
    [cx - w / 2 + r, cy - h / 2 + r, 180],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
    }
  }
  return pts;
}

/** 凸包（Andrew's monotone chain） */
export function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Chaikin 法で多角形の角を丸める（閉じた多角形） */
export function chaikin(pts, iterations = 2) {
  let p = pts;
  for (let k = 0; k < iterations; k++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

/** 右半分の輪郭点（上→下）から左右対称の閉じた多角形を作る */
export function mirrorOutline(rightHalf) {
  const left = rightHalf.slice().reverse().map(([x, y]) => [-x, y]);
  return [...rightHalf, ...left];
}

const f = (v) => +v.toFixed(3);

export function polyPath(pts) {
  return 'M' + pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' L') + ' Z';
}

export function roundRectPath(cx, cy, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  return [
    `M${f(x0 + r)},${f(y0)}`,
    `H${f(x1 - r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x1)},${f(y0 + r)}`,
    `V${f(y1 - r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x1 - r)},${f(y1)}`,
    `H${f(x0 + r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x0)},${f(y1 - r)}`,
    `V${f(y0 + r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x0 + r)},${f(y0)}`, 'Z',
  ].join(' ');
}

/**
 * 部品ローカル座標 → 図面座標。
 * 適用順: 拡大(scale) → ミラー(左右) → 回転(rotation, 度, 時計回り) → 平行移動
 */
export function localToWorld(inst, lx, ly) {
  const s = inst.scale ?? 1;
  let x = lx * s * (inst.mirror ? -1 : 1);
  let y = ly * s;
  const a = ((inst.rotation || 0) * Math.PI) / 180;
  const c = Math.cos(a), sn = Math.sin(a);
  return [inst.x + x * c - y * sn, inst.y + x * sn + y * c];
}

/** SVG transform 文字列（localToWorld と同じ変換） */
export function instanceTransform(inst) {
  const s = inst.scale ?? 1;
  return `translate(${f(inst.x)} ${f(inst.y)}) rotate(${inst.rotation || 0}) scale(${inst.mirror ? -s : s} ${s})`;
}

/** 部品のローカル外接矩形を変換した図面上の外接矩形 */
export function worldBounds(inst, b) {
  const pts = [
    localToWorld(inst, b.x, b.y),
    localToWorld(inst, b.x + b.w, b.y),
    localToWorld(inst, b.x, b.y + b.h),
    localToWorld(inst, b.x + b.w, b.y + b.h),
  ];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export const snap = (v, step) => (step > 0 ? Math.round(v / step) * step : v);
