// Hirose BH12 シリーズ（BH12WP-3SC / ハーネス側プラグ・3端子）
//
// 根拠: Datasheet/BH12_寸法.pdf p.1 右中段の端子記号付き断面図（A / B / 1 記載）
//   A, B = 電源端子 BH12-SC-213（AWG14〜16）、1 = 信号端子 BH12-SC1-213（AWG22〜24）［注記 2］
//   配置: A = 左上、B = 右下、1 = 左下（図の向きのまま）。外径 Ø13.8 は図面値。
//   ※ 今回使用するのは電源2＋信号1 の 3 端子（ユーザー指定）。
import { roundRectPath } from '../../core/geometry.js';

const R = 6.9; // 外径 Ø13.8
const FLAT_Y = -5.0; // 上部の平取り
const flatX = Math.sqrt(R * R - FLAT_Y * FLAT_Y);

const outline = [
  `M${-flatX},${FLAT_Y}`,
  `A${R},${R} 0 1 0 ${flatX},${FLAT_Y}`,
  `L${2.0},${FLAT_Y} V${-7.3} H${-2.0} V${FLAT_Y} Z`,
].join(' ');

function powerCavity(x, y) {
  return [
    { type: 'circle', cx: x, cy: y, r: 1.78, cls: 'outline' },
    { type: 'circle', cx: x, cy: y, r: 1.5, cls: 'thin' },
  ];
}

export const BH12_PARTS = [
  {
    id: 'HRS-BH12WP-3SC',
    maker: 'Hirose',
    series: 'BH12',
    partNo: 'BH12WP-3SC',
    poles: 3,
    polesLabel: '3極（電源2＋信号1）',
    view: '端子記号記載の断面図',
    source: 'BH12_寸法.pdf p.1 右中段 断面図（A/B/1 記載）',
    defaultScale: 3.5,
    bounds: { x: -R, y: -7.3, w: R * 2, h: 7.3 + R },
    bodyBounds: { x: -R, y: -7.3, w: R * 2, h: 7.3 + R },
    flange: [],
    body: [
      { type: 'path', d: outline, cls: 'outline body' },
      { type: 'path', d: roundRectPath(-5.95, 0, 1.0, 3.2, 0.2), cls: 'thin' },
      { type: 'path', d: roundRectPath(5.95, 0, 1.0, 3.2, 0.2), cls: 'thin' },
      { type: 'path', d: `M-1.3,${R - 0.15} H1.3`, cls: 'thin' },
      ...powerCavity(-1.73, -1.37),
      ...powerCavity(1.69, 1.39),
      { type: 'circle', cx: -1.86, cy: 2.15, r: 1.1, cls: 'outline' },
    ],
    pins: [
      { id: 'A', label: 'A', x: -1.73, y: -1.37, shape: 'circle', r: 1.2, fontSize: 1.3, kind: 'power' },
      { id: 'B', label: 'B', x: 1.69, y: 1.39, shape: 'circle', r: 1.2, fontSize: 1.3, kind: 'power' },
      { id: '1', label: '1', x: -1.86, y: 2.15, shape: 'circle', r: 0.8, fontSize: 1.0, kind: 'signal' },
    ],
    extras: [],
  },
];
