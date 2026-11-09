// 配線の仕様マスタ（部品データ）

/** 配線色。key はプロジェクトファイルに保存される値（JIS 略号準拠） */
export const WIRE_COLORS = [
  { key: 'R', name: '赤', hex: '#d32f2f' },
  { key: 'W', name: '白', hex: '#ffffff' },
  { key: 'B', name: '黒', hex: '#222222' },
  { key: 'L', name: '青', hex: '#1e63c6' },
  { key: 'G', name: '緑', hex: '#2e9d44' },
  { key: 'Br', name: '茶', hex: '#7b4a26' },
  { key: 'Y', name: '黄', hex: '#f2c500' },
  { key: 'P', name: 'ピンク', hex: '#f48fb1' },
  { key: 'Gr', name: '灰色', hex: '#8c8c8c' },
  { key: 'O', name: 'オレンジ', hex: '#f57c00' },
];

export const WIRE_TYPES = ['AVSS', 'UL1015'];

/** 配線太さ(sq)。stroke = 図面上の線幅(mm)。細線も視認できるよう誇張している */
export const WIRE_GAUGES = [
  { sq: 0.3, stroke: 0.45 },
  { sq: 0.5, stroke: 0.55 },
  { sq: 0.85, stroke: 0.7 },
  { sq: 1.25, stroke: 0.85 },
  { sq: 2, stroke: 1.05 },
  { sq: 3, stroke: 1.3 },
];

export const WIRE_NAME_PRESETS = ['電源', 'GND', '+12V', '+5V', 'CAN_H', 'CAN_L', 'HV+', 'HV-', 'SDC', 'SIG'];

export const colorOf = (key) => WIRE_COLORS.find((c) => c.key === key) || WIRE_COLORS[2];
export const gaugeOf = (sq) => WIRE_GAUGES.find((g) => g.sq === sq) || WIRE_GAUGES[1];

/** 長さの表示文字列。length は mm で保持、unit は表示単位 */
export function formatLength(wire) {
  if (wire.length == null || wire.length === '') return '';
  if (wire.lengthUnit === 'm') return `${+(wire.length / 1000).toFixed(3)}m`;
  return `${+(+wire.length).toFixed(1)}mm`;
}

export function specText(wire) {
  return `${wire.type} ${wire.gauge}sq ${colorOf(wire.color).name}`;
}
