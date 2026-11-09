// コルゲートチューブの仕様マスタ（部品データ）
// メーカー: 住友電装。サイズは内径 φ（参考図の φA）。品番は資料が無いため持たない。

export const TUBE_MAKER = '住友電装';

/** 色。key はプロジェクトファイルに保存される値 */
export const TUBE_COLORS = [
  { key: 'black', name: '黒', hex: '#2a2a2a', rib: '#7a7a7a', edge: '#000000', text: '#ffffff' },
  { key: 'orange', name: 'オレンジ', hex: '#f57c00', rib: '#a64f00', edge: '#6b3300', text: '#000000' },
];

/**
 * サイズ = 内径 φ(mm)。依頼書の値をそのまま使う。
 * width = 図面上の帯の太さ(mm)。用紙上で実寸だと太すぎるため、太さの差が分かる程度に縮めて描く。
 */
export const TUBE_SIZES = [5.2, 7.4, 10.7, 13.2, 15.2, 19.5, 22.1, 25.1, 28.2, 32.4].map((d) => ({
  d,
  width: +(1.4 + d * 0.16).toFixed(2),
}));

export const DEFAULT_TUBE = { size: 10.7, color: 'black', length: null, lengthUnit: 'mm' };

export const tubeColorOf = (key) => TUBE_COLORS.find((c) => c.key === key) || TUBE_COLORS[0];
export const tubeSizeOf = (d) => TUBE_SIZES.find((s) => s.d === d) || TUBE_SIZES[2];

export function tubeSpecText(tube) {
  return `${TUBE_MAKER} コルゲートチューブ 内径φ${tube.size} ${tubeColorOf(tube.color).name}`;
}

export function formatTubeLength(tube) {
  if (tube.length == null || tube.length === '') return '';
  if (tube.lengthUnit === 'm') return `${+(tube.length / 1000).toFixed(3)}m`;
  return `${+(+tube.length).toFixed(1)}mm`;
}
