// Hirose ZE064 シリーズ（ZE064W-□DS-HU / ハーネス側ソケット）
//
// 根拠: Datasheet/ZE064W-8DS_寸法.pdf, ZE064W-14DS_寸法.pdf, ZE064W-24DS_寸法.pdf p.1
//   右側の投影図（防水栓穴が見える電線挿入側。番号 1 / n/2 / n/2+1 / n が記載）をトレース。
//   ピン配列: 2 段。上段 右→左 に 1 … n/2、下段 右→左 に n/2+1 … n。
//   列ピッチ 2.2mm・段ピッチ約 3.1mm、外形 20.9 / 27.5 / 38.5 × 18.88（8 / 14 / 24極）は図面値。
import { chaikin, mirrorOutline, polyPath } from '../../core/geometry.js';

const PITCH_X = 2.2;
const ROW_Y = 1.54;

function scalePts(pts, sx, sy) {
  return pts.map(([x, y]) => [x * sx, y * sy]);
}

function buildZE064DS({ poles, outlineRight, width, sideRects, pdf }) {
  const cols = poles / 2;
  const outer = chaikin(mirrorOutline(outlineRight), 2);
  const W = width / 2;
  // 内側の線（外形を約 0.8mm 内側へ）
  const inner = scalePts(outer, (W - 0.8) / W, (9.3 - 0.8) / 9.3).map(([x, y]) => [x, y - 0.1]);

  const body = [
    { type: 'path', d: polyPath(outer), cls: 'outline body' },
    { type: 'path', d: polyPath(inner), cls: 'thin' },
    // 上部ロック部
    { type: 'rect', x: -8.95, y: -8.8, w: 17.9, h: 2.8, cls: 'outline' },
    { type: 'rect', x: -8.45, y: -8.45, w: 16.9, h: 1.9, cls: 'thin' },
    { type: 'rect', x: -3.2, y: -8.0, w: 6.4, h: 0.45, cls: 'thin' },
    { type: 'rect', x: -8.3, y: -10.0, w: 2.4, h: 1.4, rx: 0.5, cls: 'thin' },
    { type: 'rect', x: 5.9, y: -10.0, w: 2.4, h: 1.4, rx: 0.5, cls: 'thin' },
    ...sideRects.map(([x0, x1, y0, y1]) => ({ type: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0, cls: 'thin' })),
  ];

  const pins = [];
  for (let row = 0; row < 2; row++) {
    for (let c = 0; c < cols; c++) {
      const n = row * cols + c + 1;
      pins.push({
        id: String(n),
        label: String(n),
        // 右端が 1（電線挿入側から見た図）
        x: ((cols - 1) / 2 - c) * PITCH_X,
        y: row === 0 ? -ROW_Y : ROW_Y,
        shape: 'circle',
        r: 1.0,
        fontSize: 1.0,
        kind: 'signal',
      });
    }
  }

  const b = { x: -W, y: -10.2, w: width, h: 18.7 };
  return {
    id: `HRS-ZE064W-${poles}DS`,
    maker: 'Hirose',
    series: 'ZE064',
    partNo: `ZE064W-${poles}DS-HU`,
    poles,
    polesLabel: `${poles}極`,
    view: '電線挿入側',
    source: `${pdf} p.1 右側投影図`,
    defaultScale: 2.5,
    bounds: b,
    bodyBounds: b,
    flange: [],
    body,
    pins,
    extras: [],
  };
}

export const ZE064_PARTS = [
  buildZE064DS({
    poles: 8,
    width: 20.9,
    pdf: 'ZE064W-8DS_寸法.pdf',
    outlineRight: [
      [0, -10.15], [8.4, -10.15], [10.45, -8.3], [10.45, 2.2], [9.7, 3.6], [4.9, 8.4], [0, 8.4],
    ],
    sideRects: [
      [-7.6, -6.5, -1.7, 2.0], [6.5, 7.6, -1.7, 2.0], [-0.5, 0.5, -4.0, -3.0], [-2.05, 2.0, 4.9, 7.0],
    ],
  }),
  buildZE064DS({
    poles: 14,
    width: 27.5,
    pdf: 'ZE064W-14DS_寸法.pdf',
    outlineRight: [
      [0, -10.15], [8.0, -10.15], [10.6, -9.6], [11.0, -7.5], [11.0, -5.6], [12.6, -3.6],
      [13.75, -1.5], [13.75, 3.2], [12.6, 5.6], [11.0, 6.3], [7.2, 6.3], [4.9, 8.5], [0, 8.5],
    ],
    sideRects: [
      [-6.9, -4.8, -5.33, -4.48], [-1.65, 1.7, -5.33, -4.48], [4.7, 6.75, -5.33, -4.48],
      [-5.9, -2.3, 4.67, 5.6], [2.3, 5.8, 4.67, 5.6], [-2.1, 2.15, 4.8, 7.1],
    ],
  }),
  buildZE064DS({
    poles: 24,
    width: 38.5,
    pdf: 'ZE064W-24DS_寸法.pdf',
    outlineRight: [
      [0, -10.15], [8.0, -10.15], [10.6, -9.6], [11.2, -7.8], [13.5, -7.3], [17.5, -5.5],
      [19.25, -2.0], [19.25, 3.0], [17.5, 5.8], [13.8, 6.3], [11.4, 6.4], [9.5, 8.5], [0, 8.5],
    ],
    sideRects: [
      [-10.9, -7.2, -5.33, -4.48], [7.2, 10.8, -5.33, -4.48], [-0.5, 0.5, -4.7, -3.75],
      [-10.9, -7.2, 4.6, 5.6], [7.2, 10.8, 4.6, 5.6],
    ],
  }),
];
