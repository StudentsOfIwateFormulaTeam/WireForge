// 右パネル: 選択中の部品・ピン・配線のプロパティ
import { el } from './dom.js';
import { getPart, getPin } from '../catalog/connectors/index.js';
import { WIRE_COLORS, WIRE_TYPES, WIRE_GAUGES, WIRE_NAME_PRESETS, colorOf, formatLength, specText } from '../catalog/wireSpecs.js';
import { wiresAtPin, otherEnd, endLabel, netOfWire } from '../core/wires.js';
import { TUBE_COLORS, TUBE_SIZES, tubeColorOf, tubeSpecText, formatTubeLength } from '../catalog/tubeSpecs.js';
import { tubesOnWire, MIN_SPAN } from '../core/tubes.js';
import { PAPER_SIZES } from '../core/model.js';

const KIND_LABEL = { power: '電源端子', signal: '信号端子' };

function row(label, control) {
  return el('div', { class: 'prop-row' }, [el('label', {}, label), control]);
}
function info(label, text) {
  return el('div', { class: 'prop-row' }, [el('label', {}, label), el('span', { class: 'prop-value' }, text)]);
}
function numberInput(value, onchange, { step = 1, min, max, placeholder } = {}) {
  return el('input', {
    type: 'number', value: value == null ? '' : String(+(+value).toFixed(3)), step: String(step), min, max, placeholder,
    onchange: (e) => {
      if (e.target.value === '') return onchange(null);
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v)) onchange(v);
    },
  });
}
function select(options, value, onchange) {
  return el('select', { onchange: (e) => onchange(e.target.value) },
    options.map(([v, label]) => el('option', { value: v, selected: String(v) === String(value) }, label)));
}
const chip = (key) => el('span', { class: 'chip', style: `background:${colorOf(key).hex}` });
const tubeChip = (key) => el('span', { class: 'tube-chip', style: `background-color:${tubeColorOf(key).hex}` });
const pct = (t) => Math.round(t * 1000) / 10;

/** 長さ入力（mm 保持・mm/m 表示切替） */
function lengthInput(obj, upd) {
  const unitFactor = obj.lengthUnit === 'm' ? 1000 : 1;
  return el('div', { class: 'len-input' }, [
    numberInput(obj.length == null ? null : obj.length / unitFactor, (v) => upd({ length: v == null ? null : v * unitFactor }), { step: obj.lengthUnit === 'm' ? 0.01 : 1, min: 0, placeholder: '未設定' }),
    select([['mm', 'mm'], ['m', 'm']], obj.lengthUnit, (v) => upd({ lengthUnit: v })),
  ]);
}

export function createPropertyPanel(root, store, cmd) {
  let infoPart = null; // 左パネルから「資料不足」部品を選んだ時の表示

  function showPartInfo(part) {
    infoPart = part;
    store.select(null);
    render();
  }

  const page = () => store.page;
  const connectorOptions = () => page().connectors.map((c) => [c.id, `${c.label}（${getPart(c.partId)?.partNo ?? '?'}）`]);
  const pinOptions = (connectorId) => {
    const inst = page().connectors.find((c) => c.id === connectorId);
    return (getPart(inst?.partId)?.pins || []).map((p) => [p.id, p.label]);
  };

  // ---------- 何も選択していない時 ----------
  function displayToggles() {
    const d = store.project.settings.display;
    const t = (key, label) => el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: !!d[key], onchange: (e) => cmd.setDisplay(key, e.target.checked) }), label,
    ]);
    return el('div', { class: 'prop-group' }, [
      el('h4', {}, '配線ラベルの表示'),
      el('div', { class: 'check-grid' }, [t('wireName', '配線名'), t('wireEnds', '接続先'), t('wireSpec', '種類・太さ・色'), t('wireLength', '長さ')]),
      el('h4', {}, 'チューブの表示'),
      el('div', { class: 'check-grid' }, [t('tubeLabel', 'チューブのラベル')]),
    ]);
  }

  function wireList(wires, opts = {}) {
    if (!wires.length) return el('p', { class: 'hint' }, opts.empty || '配線はありません。');
    return el('table', { class: 'wire-table' }, [
      el('thead', {}, el('tr', {}, [el('th', {}, ''), el('th', {}, '配線名'), el('th', {}, '接続'), el('th', {}, '仕様'), el('th', {}, '長さ')])),
      el('tbody', {}, wires.map((w) =>
        el('tr', {
          class: store.ui.selection?.kind === 'wire' && store.ui.selection.id === w.id ? 'active' : '',
          onclick: () => store.select({ kind: 'wire', id: w.id }),
        }, [
          el('td', {}, chip(w.color)),
          el('td', {}, w.name || '—'),
          el('td', { class: 'nowrap' }, `${endLabel(page(), w.from)}⇔${endLabel(page(), w.to)}`),
          el('td', { class: 'nowrap' }, `${w.type} ${w.gauge}sq`),
          el('td', { class: 'nowrap' }, formatLength(w) || '—'),
        ]),
      )),
    ]);
  }

  function tubeList(tubes, opts = {}) {
    if (!tubes.length) return el('p', { class: 'hint' }, opts.empty || 'チューブはありません。');
    return el('table', { class: 'wire-table' }, [
      el('thead', {}, el('tr', {}, [el('th', {}, ''), el('th', {}, '名前'), el('th', {}, 'サイズ'), el('th', {}, '対象'), el('th', {}, '長さ')])),
      el('tbody', {}, tubes.map((t) =>
        el('tr', {
          class: store.ui.selection?.kind === 'tube' && store.ui.selection.id === t.id ? 'active' : '',
          onclick: () => store.select({ kind: 'tube', id: t.id }),
        }, [
          el('td', {}, tubeChip(t.color)),
          el('td', {}, t.label),
          el('td', { class: 'nowrap' }, `φ${t.size} ${tubeColorOf(t.color).name}`),
          el('td', { class: 'nowrap' }, `${t.wireIds.length} 本`),
          el('td', { class: 'nowrap' }, formatTubeLength(t) || '—'),
        ]),
      )),
    ]);
  }

  function renderEmpty() {
    const pg = page();
    return [
      el('h3', {}, 'プロパティ'),
      el('p', { class: 'hint' }, '図面上のコネクタ・ピン・配線をクリックすると、ここに詳細が表示されます。'),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, 'ページ'),
        row('ページ名', el('input', { value: pg.name, onchange: (e) => cmd.renamePage(pg.id, e.target.value) })),
        row('用紙', select(Object.entries(PAPER_SIZES).map(([k, v]) => [k, `${v.label}（${v.w}×${v.h}）`]), pg.paper, (v) => cmd.setPaper(v))),
        row('表題欄', el('div', { class: 'inline' }, [
          el('input', { type: 'checkbox', checked: pg.titleBlock.show !== false, onchange: (e) => cmd.updateTitleBlock({ show: e.target.checked }) }),
          el('button', { class: 'link-btn', onclick: () => store.select({ kind: 'titleBlock' }) }, '編集…'),
        ])),
        info('コネクタ数', String(pg.connectors.length)),
        info('配線数', String(pg.wires.length)),
        info('チューブ数', String(pg.tubes.length)),
        info('テキスト数', String(pg.texts.length)),
        el('button', {
          class: 'secondary-btn', disabled: !pg.wires.length,
          title: '配線ラベル・チューブラベルを、コネクタや他のラベルと重ならない位置へ並べ直します（元に戻す で戻せます）',
          onclick: () => cmd.autoLayoutLabels(),
        }, 'ラベルを自動配置'),
      ]),
      displayToggles(),
      el('div', { class: 'prop-group' }, [el('h4', {}, `配線一覧（${pg.wires.length}）`), wireList(pg.wires)]),
      el('div', { class: 'prop-group' }, [el('h4', {}, `コルゲートチューブ一覧（${pg.tubes.length}）`), tubeList(pg.tubes)]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '操作'),
        el('ul', { class: 'shortcut-list' }, [
          ['ドラッグ', '部品の移動'], ['空白をドラッグ', '画面の移動'], ['ホイール', '拡大・縮小'],
          ['W', '配線モード（ピン→ピンをクリック）'], ['T', 'チューブモード（配線上をドラッグ）'], ['R / Shift+R', '回転'], ['Delete', '削除'],
          ['Ctrl+C / V / D', 'コピー/貼付/複製'], ['Ctrl+Z / Y', '元に戻す/やり直す'],
          ['Ctrl+S / O', '保存 / 開く'], ['Ctrl+P', 'PDF 出力'], ['PageUp / Down', 'ページ切替'],
          ['矢印キー', '1mm 移動（Shift で 10mm）'], ['G / F', 'グリッド / 全体表示'], ['?', '操作方法の一覧'],
        ].map(([k, v]) => el('li', {}, [el('kbd', {}, k), ' ', v]))),
      ]),
    ];
  }

  function renderUnavailable(part) {
    return [
      el('h3', {}, 'コネクタ情報'),
      el('div', { class: 'prop-group' }, [
        info('メーカー', part.maker),
        info('シリーズ', part.series),
        info('極数', part.polesLabel),
        el('div', { class: 'warn-box' }, part.unavailableReason),
      ]),
    ];
  }

  // ---------- コネクタ ----------
  function connectorSection(inst, part) {
    const upd = (patch) => cmd.updateConnector(inst.id, patch);
    return el('div', { class: 'prop-group' }, [
      el('h4', {}, 'コネクタ'),
      row('参照名', el('input', { value: inst.label, onchange: (e) => upd({ label: e.target.value.trim() || inst.label }) })),
      info('メーカー', part.maker),
      info('型番', part.partNo),
      info('極数', part.polesLabel),
      info('表示面', part.view + (inst.mirror ? '（左右反転）' : '')),
      info('図の根拠', part.source),
      el('h4', {}, '配置'),
      row('X (mm)', numberInput(inst.x, (v) => v != null && upd({ x: v }))),
      row('Y (mm)', numberInput(inst.y, (v) => v != null && upd({ y: v }))),
      row('回転', select([0, 90, 180, 270].map((r) => [r, `${r}°`]), inst.rotation, (v) => upd({ rotation: +v }))),
      row('左右反転', el('input', { type: 'checkbox', checked: !!inst.mirror, onchange: (e) => upd({ mirror: e.target.checked }) })),
      row('表示倍率', numberInput(inst.scale, (v) => v != null && upd({ scale: Math.min(10, Math.max(0.5, v)) }), { step: 0.5, min: 0.5, max: 10 })),
      part.flange.length > 0 && row('フランジ表示', el('input', { type: 'checkbox', checked: inst.showFlange !== false, onchange: (e) => upd({ showFlange: e.target.checked }) })),
      el('button', { class: 'danger-btn', onclick: () => cmd.deleteConnector(inst.id) }, 'このコネクタを削除'),
    ]);
  }

  function pinTable(inst, part, selectedPinId) {
    return el('div', { class: 'prop-group' }, [
      el('h4', {}, `ピン一覧（${part.pins.length}）`),
      el('table', { class: 'pin-table' }, [
        el('thead', {}, el('tr', {}, [el('th', {}, 'ピン'), el('th', {}, '種別'), el('th', {}, '配線')])),
        el('tbody', {}, part.pins.map((pin) => {
          const ws = wiresAtPin(page(), inst.id, pin.id);
          return el('tr', {
            class: pin.id === selectedPinId ? 'active' : '',
            onclick: () => store.select({ kind: 'pin', connectorId: inst.id, pinId: pin.id }),
          }, [
            el('td', { class: 'pin-no' }, pin.label),
            el('td', {}, KIND_LABEL[pin.kind] || pin.kind),
            el('td', {}, ws.length
              ? ws.map((w) => el('div', { class: 'pin-wire' }, [chip(w.color), ` ${w.name || ''} → ${endLabel(page(), otherEnd(w, inst.id, pin.id))}`]))
              : el('span', { class: 'muted' }, '未接続')),
          ]);
        })),
      ]),
    ]);
  }

  // ---------- ピン ----------
  function pinSection(inst, part, pin) {
    const ws = wiresAtPin(page(), inst.id, pin.id);
    // 接続先をリストから選んで追加
    const others = page().connectors.filter((c) => c.id !== inst.id);
    let targetC = others[0]?.id || inst.id;
    let targetP = pinOptions(targetC)[0]?.[0];
    const pinSel = el('select', { onchange: (e) => { targetP = e.target.value; } });
    const fillPins = () => {
      pinSel.replaceChildren(...pinOptions(targetC).map(([v, l]) => el('option', { value: v }, l)));
      targetP = pinOptions(targetC)[0]?.[0];
    };
    fillPins();
    const conSel = select(connectorOptions(), targetC, (v) => { targetC = v; fillPins(); });

    return [
      el('h3', {}, `ピン ${inst.label}-${pin.label}`),
      el('div', { class: 'prop-group' }, [
        info('コネクタ', `${inst.label}（${part.partNo}）`),
        info('ピン番号', pin.label),
        info('種別', KIND_LABEL[pin.kind] || pin.kind),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, `接続されている配線（${ws.length}）`),
        wireList(ws, { empty: 'このピンには配線がありません。' }),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '配線を追加'),
        el('button', { class: 'primary-btn', onclick: () => cmd.startWireFrom(inst.id, pin.id) }, '図面上で接続先ピンをクリック'),
        el('div', { class: 'sub-hint' }, 'または接続先を選んで追加:'),
        row('コネクタ', conSel),
        row('ピン', pinSel),
        el('button', {
          class: 'primary-btn',
          onclick: () => targetP && cmd.addWire({ connectorId: inst.id, pinId: pin.id }, { connectorId: targetC, pinId: targetP }),
        }, '＋ 配線を追加'),
      ]),
      pinTable(inst, part, pin.id),
      el('button', { class: 'link-btn', onclick: () => store.select({ kind: 'connector', id: inst.id }) }, '← コネクタのプロパティへ'),
    ];
  }

  // ---------- 配線 ----------
  function endEditor(label, wire, key) {
    const end = wire[key];
    return el('div', { class: 'end-editor' }, [
      el('label', {}, label),
      select(connectorOptions(), end.connectorId, (v) => {
        const first = pinOptions(v)[0]?.[0];
        cmd.updateWire(wire.id, { [key]: { connectorId: v, pinId: first } });
      }),
      select(pinOptions(end.connectorId), end.pinId, (v) => cmd.updateWire(wire.id, { [key]: { connectorId: end.connectorId, pinId: v } })),
    ]);
  }

  function wireSection(wire) {
    const upd = (patch) => cmd.updateWire(wire.id, patch);
    const net = [...netOfWire(page(), wire.id)].filter((id) => id !== wire.id).map((id) => page().wires.find((w) => w.id === id));

    return [
      el('h3', {}, ['配線 ', chip(wire.color), ` ${wire.name || ''}`]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '接続（ピン番号の対応は自由に変更できます）'),
        endEditor('始点', wire, 'from'),
        endEditor('終点', wire, 'to'),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '配線情報'),
        row('配線名', el('input', { value: wire.name, list: 'wire-name-presets', placeholder: '例: CAN_H', onchange: (e) => upd({ name: e.target.value.trim() }) })),
        row('配線種類', select(WIRE_TYPES.map((t) => [t, t]), wire.type, (v) => upd({ type: v }))),
        row('配線太さ', select(WIRE_GAUGES.map((g) => [g.sq, `${g.sq} sq`]), wire.gauge, (v) => upd({ gauge: +v }))),
        row('配線長さ', lengthInput(wire, upd)),
        el('div', { class: 'prop-row top' }, [
          el('label', {}, '配線色'),
          el('div', { class: 'color-chips' }, WIRE_COLORS.map((c) =>
            el('button', {
              class: 'color-chip' + (c.key === wire.color ? ' on' : ''),
              title: c.name,
              onclick: () => upd({ color: c.key }),
            }, [el('span', { class: 'chip big', style: `background:${c.hex}` }), c.name]),
          )),
        ]),
        info('仕様', `${specText(wire)}${formatLength(wire) ? '  L=' + formatLength(wire) : ''}`),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '経路'),
        el('p', { class: 'hint' }, '線の中央の ○ をドラッグすると折れ点を追加、□ をドラッグで移動、ダブルクリックで削除。ラベルはドラッグで線に沿って移動できます。'),
        info('折れ点', `${wire.waypoints.length} 個`),
        wire.waypoints.length > 0 && el('button', { class: 'tb-btn light', onclick: () => upd({ waypoints: [] }) }, '折れ点をすべて削除'),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, 'コルゲートチューブ'),
        tubeList(tubesOnWire(page(), wire.id), { empty: 'この配線にはチューブがありません。' }),
        el('button', { class: 'primary-btn', onclick: () => cmd.addTube(wire.id) }, '＋ この配線にチューブを追加'),
        el('div', { class: 'sub-hint' }, 'チューブモード（T）で配線の上をドラッグしても追加できます。'),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, `つながっている配線（同じピンを共有: ${net.length}）`),
        wireList(net, { empty: '他の配線とは共有していません。' }),
      ]),
      el('button', { class: 'danger-btn', onclick: () => cmd.deleteWire(wire.id) }, 'この配線を削除'),
    ];
  }

  // ---------- コルゲートチューブ ----------
  function tubeSection(tube) {
    const upd = (patch) => cmd.updateTube(tube.id, patch);
    const pg = page();
    const guide = pg.wires.find((w) => w.id === tube.wireId);
    const wireText = (w) => `${w.name || '（名前なし）'}  ${endLabel(pg, w.from)}⇔${endLabel(pg, w.to)}`;
    const span = tube.t1 - tube.t0;
    const estimate = guide?.length != null ? guide.length * span : null;
    const fmtMm = (mm) => (tube.lengthUnit === 'm' ? `${+(mm / 1000).toFixed(3)} m` : `${Math.round(mm)} mm`);

    return [
      el('h3', {}, ['チューブ ', tubeChip(tube.color), ` ${tube.label}`]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '仕様'),
        row('参照名', el('input', { value: tube.label, onchange: (e) => upd({ label: e.target.value.trim() || tube.label }) })),
        row('内径', select(TUBE_SIZES.map((sz) => [sz.d, `φ${sz.d}`]), tube.size, (v) => upd({ size: +v }))),
        el('div', { class: 'prop-row top' }, [
          el('label', {}, '色'),
          el('div', { class: 'color-chips' }, TUBE_COLORS.map((c) =>
            el('button', { class: 'color-chip' + (c.key === tube.color ? ' on' : ''), title: c.name, onclick: () => upd({ color: c.key }) },
              [el('span', { class: 'chip big', style: `background:${c.hex}` }), c.name]),
          )),
        ]),
        row('長さ', lengthInput(tube, upd)),
        estimate != null && el('div', { class: 'sub-hint' }, [
          `参考: 基準配線の長さ × 範囲 = ${fmtMm(estimate)} `,
          el('button', { class: 'link-btn', onclick: () => upd({ length: Math.round(estimate) }) }, 'この値を入れる'),
        ]),
        info('品名', tubeSpecText(tube)),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '位置（基準配線の始点からの割合）'),
        row('基準配線', select(pg.wires.map((w) => [w.id, wireText(w)]), tube.wireId, (v) => upd({ wireId: v }))),
        el('div', { class: 'range-input' }, [
          numberInput(pct(tube.t0), (v) => v != null && upd({ t0: Math.min(v / 100, tube.t1 - MIN_SPAN) }), { step: 1, min: 0, max: 100 }),
          el('span', {}, '% 〜'),
          numberInput(pct(tube.t1), (v) => v != null && upd({ t1: Math.max(v / 100, tube.t0 + MIN_SPAN) }), { step: 1, min: 0, max: 100 }),
          el('span', {}, '%'),
        ]),
        el('p', { class: 'hint' }, 'チューブをドラッグすると配線に沿って移動、両端の ○ で範囲を伸縮できます。ラベルもドラッグで動かせます。'),
        (tube.labelDx != null) && el('button', { class: 'tb-btn light', onclick: () => upd({ labelDx: null, labelDy: null }) }, 'ラベル位置を自動に戻す'),
      ]),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, `対象配線（${tube.wireIds.length} 本）`),
        el('div', { class: 'check-list' }, pg.wires.map((w) => {
          const isGuide = w.id === tube.wireId;
          return el('label', { class: 'check' + (isGuide ? ' guide' : '') }, [
            el('input', {
              type: 'checkbox', checked: tube.wireIds.includes(w.id), disabled: isGuide,
              onchange: (e) => cmd.setTubeWire(tube.id, w.id, e.target.checked),
            }),
            chip(w.color), ` ${wireText(w)}${isGuide ? '（基準）' : ''}`,
          ]);
        })),
        el('div', { class: 'sub-hint' }, 'チューブは基準配線の上に描きます。束ねる配線は対象として一緒に記録されます。'),
        tube.wireIds.length > 1 && el('button', {
          class: 'tb-btn light',
          title: '対象配線の折れ点を基準配線と同じにして、同じ経路を通るようにします（元に戻す可）',
          onclick: () => cmd.alignTubeWires(tube.id),
        }, '対象配線の経路を基準配線にそろえる'),
      ]),
      el('button', { class: 'danger-btn', onclick: () => cmd.deleteTube(tube.id) }, 'このチューブを削除'),
    ];
  }

  // ---------- テキスト・注記 ----------
  function textSection(t) {
    const upd = (patch) => cmd.updateText(t.id, patch);
    let snap = null;
    const area = el('textarea', {
      class: 'text-edit', rows: 5, 'data-live': '1', 'data-focus': '1', value: t.text,
      onfocus: () => { snap = store.begin(); },
      oninput: (e) => store.live((p) => { p.pages.find((x) => x.id === p.activePageId).texts.find((x) => x.id === t.id).text = e.target.value; }),
      onblur: () => { if (snap) store.end(snap); snap = null; render(); },
    });
    area.value = t.text;
    return [
      el('h3', {}, t.frame ? '注記' : 'テキスト'),
      el('div', { class: 'prop-group' }, [
        el('h4', {}, '内容（改行できます）'),
        area,
        row('文字高さ (mm)', numberInput(t.size, (v) => v != null && upd({ size: Math.min(30, Math.max(1, v)) }), { step: 0.5, min: 1, max: 30 })),
        row('太字', el('input', { type: 'checkbox', checked: !!t.bold, onchange: (e) => upd({ bold: e.target.checked }) })),
        row('枠で囲む（注記）', el('input', { type: 'checkbox', checked: !!t.frame, onchange: (e) => upd({ frame: e.target.checked }) })),
        row('X (mm)', numberInput(t.x, (v) => v != null && upd({ x: v }))),
        row('Y (mm)', numberInput(t.y, (v) => v != null && upd({ y: v }))),
        el('p', { class: 'hint' }, 'ドラッグで移動、矢印キーで 1mm（Shift で 10mm）移動。図面上でダブルクリックすると内容を編集できます。'),
      ]),
      el('button', { class: 'danger-btn', onclick: () => cmd.deleteText(t.id) }, 'このテキストを削除'),
    ];
  }

  // ---------- 表題欄 ----------
  function titleBlockSection() {
    const pg = page();
    const tb = pg.titleBlock;
    const upd = (patch) => cmd.updateTitleBlock(patch);
    const field = (key, label, placeholder, focus) => row(label, el('input', {
      value: tb[key] || '', placeholder, 'data-focus': focus ? '1' : undefined, onchange: (e) => upd({ [key]: e.target.value.trim() }),
    }));
    const today = () => { const d = new Date(); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };
    return [
      el('h3', {}, '表題欄'),
      el('div', { class: 'prop-group' }, [
        row('表示', el('input', { type: 'checkbox', checked: tb.show !== false, onchange: (e) => upd({ show: e.target.checked }) })),
        field('title', '図面名', `${pg.name}（未入力時はページ名）`, true),
        field('drawingNo', '図番', '例: SIFT-HN-001'),
        field('revision', '版', '例: A'),
        field('author', '作成者', ''),
        row('日付', el('div', { class: 'len-input' }, [
          el('input', { value: tb.date || '', placeholder: 'YYYY/MM/DD', onchange: (e) => upd({ date: e.target.value.trim() }) }),
          el('button', { class: 'tb-btn light', onclick: () => upd({ date: today() }) }, '今日'),
        ])),
        info('プロジェクト', store.project.name),
        el('p', { class: 'hint' }, 'プロジェクト名とページ番号は自動で入ります。表題欄はページごとに設定します。'),
      ]),
      el('button', { class: 'link-btn', onclick: () => store.select(null) }, '← ページのプロパティへ'),
    ];
  }

  let pending = false;
  root.addEventListener('focusout', () => setTimeout(() => { if (pending) render(); }, 0));

  function render() {
    // 入力中（ライブ編集中）の欄は作り直さない（フォーカスとカーソル位置を保つ）
    const active = document.activeElement;
    if (active && root.contains(active) && active.dataset.live) { pending = true; return; }
    pending = false;
    const sel = store.ui.selection;
    if (sel) infoPart = null;
    let content;
    if (infoPart) {
      content = renderUnavailable(infoPart);
    } else if (!sel) {
      content = renderEmpty();
    } else if (sel.kind === 'text') {
      const t = page().texts.find((x) => x.id === sel.id);
      content = t ? textSection(t) : renderEmpty();
    } else if (sel.kind === 'titleBlock') {
      content = titleBlockSection();
    } else if (sel.kind === 'tube') {
      const t = page().tubes.find((x) => x.id === sel.id);
      content = t ? tubeSection(t) : renderEmpty();
    } else if (sel.kind === 'wire') {
      const w = page().wires.find((x) => x.id === sel.id);
      content = w ? wireSection(w) : renderEmpty();
    } else {
      const cid = sel.kind === 'pin' ? sel.connectorId : sel.id;
      const inst = page().connectors.find((c) => c.id === cid);
      const part = inst && getPart(inst.partId);
      if (!inst || !part) {
        content = renderEmpty();
      } else if (sel.kind === 'pin') {
        content = pinSection(inst, part, getPin(part, sel.pinId));
      } else {
        content = [el('h3', {}, `コネクタ ${inst.label}`), connectorSection(inst, part), pinTable(inst, part, null)];
      }
    }
    const scroll = root.scrollTop;
    root.replaceChildren(
      ...content,
      el('datalist', { id: 'wire-name-presets' }, WIRE_NAME_PRESETS.map((n) => el('option', { value: n }))),
    );
    root.scrollTop = scroll;
  }

  store.subscribe(render);
  render();

  /** 図面上のダブルクリック等から、最初の編集欄にフォーカス */
  function focusEditor() {
    const f = root.querySelector('[data-focus]');
    if (f) { f.focus(); f.select?.(); }
  }
  return { showPartInfo, focusEditor };
}
