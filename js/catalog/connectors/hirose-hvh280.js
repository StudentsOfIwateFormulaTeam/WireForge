// Hirose HVH-280 シリーズ（HVH-280-2/2S-HU / ハーネス側）
//
// 根拠: Datasheet/HVH-280_寸法.pdf p.1
//   ・中央の正面図             : 左 = NO.1, 右 = NO.2（外形 29.09×25.74、端子ピッチ 9.5 は図面値）
//   ・左下「HOUSING ASSY (1:1)」 : 左 = NO.2, 右 = NO.1（電線挿入側）
//   他のコネクタと表示面を揃えるため、正面図の形状を左右反転して HOUSING ASSY 図と同じ向き
//   （左 NO.2・右 NO.1）で作成している。
//   中央の検知端子（HVIL）は使用しない（ユーザー指定）ため、形状のみ表示しピンとしては扱わない。
import { roundRectPts, hull, polyPath, roundRectPath } from '../../core/geometry.js';

const m = -1; // 正面図 → 電線挿入側（左右反転）
const W = 29.09 / 2;
const TOP = -14.1, BOTTOM = 11.6;

const outerPts = hull([
  ...roundRectPts(0, (-9.4 + BOTTOM) / 2, W * 2, BOTTOM + 9.4, 8.5),
  ...roundRectPts(m * 1.65, (TOP - 8) / 2, 24.5, -8 - TOP, 1.3),
]);

function cavity(xFront) {
  const x = m * xFront;
  return [
    { type: 'path', d: roundRectPath(x, 0.3, 6.2, 7.6, 1.8), cls: 'outline' },
    { type: 'path', d: roundRectPath(x, 0.3, 5.4, 6.8, 1.4), cls: 'thin' },
  ];
}

export const HVH280_PARTS = [
  {
    id: 'HRS-HVH-280-2/2S',
    maker: 'Hirose',
    series: 'HVH280',
    partNo: 'HVH-280-2/2S-HU',
    poles: 2,
    polesLabel: '2極',
    view: '電線挿入側（HOUSING ASSY 図の向き）',
    source: 'HVH-280_寸法.pdf p.1 正面図を左右反転（HOUSING ASSY 図と同じ番号配置）',
    defaultScale: 2,
    bounds: { x: -W, y: TOP, w: W * 2, h: BOTTOM - TOP },
    bodyBounds: { x: -W, y: TOP, w: W * 2, h: BOTTOM - TOP },
    flange: [],
    body: [
      { type: 'path', d: polyPath(outerPts), cls: 'outline body' },
      { type: 'path', d: roundRectPath(0, 1.1, 27.2, 19.2, 7.5), cls: 'outline' },
      { type: 'path', d: roundRectPath(0, 1.1, 25.2, 17.4, 6.8), cls: 'thin' },
      { type: 'path', d: roundRectPath(0, 1.1, 22.8, 15.4, 5.8), cls: 'thin' },
      { type: 'path', d: roundRectPath(0, 1.05, 19.5, 13.1, 4.0), cls: 'outline' },
      // ロック部
      { type: 'rect', x: -4.55, y: -13.5, w: 9.1, h: 4.9, cls: 'outline' },
      { type: 'rect', x: -1.8, y: -12.6, w: 3.6, h: 3.6, cls: 'thin' },
      { type: 'circle', cx: m * 9.2, cy: -11.6, r: 0.8, cls: 'thin' },
      ...cavity(-4.75),
      ...cavity(4.75),
      // 検知端子（未使用）
      { type: 'rect', x: -0.55, y: -2.4, w: 1.1, h: 4.7, cls: 'thin' },
    ],
    pins: [
      { id: '1', label: '1', x: m * -4.75, y: 0.3, shape: 'circle', r: 2.2, fontSize: 2.4, kind: 'power' },
      { id: '2', label: '2', x: m * 4.75, y: 0.3, shape: 'circle', r: 2.2, fontSize: 2.4, kind: 'power' },
    ],
    extras: [],
  },
];
