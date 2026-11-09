// コネクタ断面図の描画。部品データ(catalog)と配置データ(instance)から SVG を生成する。
import { s, contrastText } from './svg.js';
import { instanceTransform, localToWorld, worldBounds } from '../core/geometry.js';

// 印刷時の線幅（用紙上の mm）
const STROKE = { outline: 0.35, thin: 0.18 };
const PIN_STROKE = 0.25;

function shapeEl(e, scale) {
  const cls = e.cls || 'thin';
  const sw = (cls.includes('outline') ? STROKE.outline : STROKE.thin) / scale;
  const common = { class: `cn-${cls.split(' ').join(' cn-')}`, 'stroke-width': sw };
  switch (e.type) {
    case 'path':
      return s('path', { ...common, d: e.d });
    case 'circle':
      return s('circle', { ...common, cx: e.cx, cy: e.cy, r: e.r });
    case 'rect': {
      const t = e.rot ? `rotate(${e.rot} ${e.cx ?? e.x + e.w / 2} ${e.cy ?? e.y + e.h / 2})` : undefined;
      return s('rect', { ...common, x: e.x, y: e.y, width: e.w, height: e.h, rx: e.rx, transform: t });
    }
    default:
      return null;
  }
}

function pinShape(pin, scale, attrs) {
  const sw = PIN_STROKE / scale;
  if (pin.shape === 'circle') {
    return s('circle', { ...attrs, cx: pin.x, cy: pin.y, r: pin.r, 'stroke-width': sw });
  }
  return s('rect', {
    ...attrs,
    x: pin.x - pin.w / 2,
    y: pin.y - pin.h / 2,
    width: pin.w,
    height: pin.h,
    rx: Math.min(pin.w, pin.h) * 0.12,
    transform: pin.rot ? `rotate(${pin.rot} ${pin.x} ${pin.y})` : undefined,
    'stroke-width': sw,
  });
}

/**
 * @param inst    配置データ
 * @param part    部品データ
 * @param opts    { selected, selectedPinId, pinFill(pinId)->color|null }
 */
export function renderConnector(inst, part, opts = {}) {
  const scale = inst.scale ?? 1;
  const root = s('g', { class: 'connector' + (opts.selected ? ' selected' : ''), 'data-kind': 'connector', 'data-id': inst.id });

  // --- 図形（回転・拡大される） ---
  const shapes = s('g', { transform: instanceTransform(inst) });
  if (inst.showFlange !== false) for (const e of part.flange) shapes.appendChild(shapeEl(e, scale));
  for (const e of part.body) shapes.appendChild(shapeEl(e, scale));

  for (const pin of part.pins) {
    const fill = opts.pinFill?.(pin.id) || null;
    const sel = opts.selectedPinId === pin.id;
    shapes.appendChild(
      pinShape(pin, scale, {
        class: `pin pin-${pin.kind}${fill ? ' pin-wired' : ''}${sel ? ' pin-selected' : ''}`,
        style: fill ? `fill:${fill}` : undefined,
        'data-kind': 'pin',
        'data-id': inst.id,
        'data-pin': pin.id,
      }),
    );
  }
  root.appendChild(shapes);

  // --- ピン番号（常に正立） ---
  const labels = s('g', { class: 'pin-labels' });
  for (const pin of part.pins) {
    const [wx, wy] = localToWorld(inst, pin.x, pin.y);
    const fill = opts.pinFill?.(pin.id);
    labels.appendChild(
      s('text', {
        x: wx,
        y: wy,
        'font-size': (pin.fontSize || 1.2) * scale,
        class: 'pin-label',
        fill: fill ? contrastText(fill) : '#8a8f96', // 未接続ピンは灰色の番号
      }, pin.label),
    );
  }
  root.appendChild(labels);

  // --- 型番・極数（部品の下に正立表示） ---
  const b = worldBounds(inst, inst.showFlange !== false ? part.bounds : part.bodyBounds);
  const cx = b.x + b.w / 2;
  root.appendChild(
    s('text', { x: cx, y: b.y + b.h + 4.2, class: 'cn-title' }, [
      s('tspan', { class: 'cn-ref' }, inst.label),
      `  ${part.partNo}（${part.polesLabel}）`,
    ]),
  );
  root.appendChild(s('text', { x: cx, y: b.y + b.h + 7.6, class: 'cn-sub' }, `${part.maker} ${part.series} ／ ${part.view}`));

  if (opts.selected) {
    root.appendChild(s('rect', { class: 'sel-box', x: b.x - 1.5, y: b.y - 1.5, width: b.w + 3, height: b.h + 3 }));
  }
  return root;
}
