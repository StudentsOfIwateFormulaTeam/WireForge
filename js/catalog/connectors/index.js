// コネクタ部品カタログ（部品データ）。図面データ（配置情報）とは分離して管理する。
// プロジェクトファイルには partId のみを保存し、形状・ピン配置はここから参照する。
import { ZE064_PARTS } from './hirose-ze064.js';
import { BH12_PARTS } from './hirose-bh12.js';
import { HVH280_PARTS } from './hirose-hvh280.js';

export const CONNECTOR_GROUPS = [
  { maker: 'Hirose', series: 'ZE064', parts: ZE064_PARTS },
  { maker: 'Hirose', series: 'BH12', parts: BH12_PARTS },
  { maker: 'Hirose', series: 'HVH280', parts: HVH280_PARTS },
];

const byId = new Map();
for (const g of CONNECTOR_GROUPS) for (const p of g.parts) byId.set(p.id, p);

export function getPart(id) {
  return byId.get(id) || null;
}

export function getPin(part, pinId) {
  return part?.pins?.find((p) => p.id === pinId) || null;
}
