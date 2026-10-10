import type {
  Cond,
  Dir,
  GaugeEl,
  LightColor,
  LightEl,
  LightLevel,
  LightRule,
  LineEl,
  PlateEl,
  Schematic,
  SwitchEl,
  SwitchPosition,
  TextEl,
} from '../types';

/**
 * Schematic drawing of the forward overhead panel.
 *
 * It is drawn in the pixel space of the reference photo (2170 x 2100), so the
 * measured control rectangles in fwd-overhead.controls.json apply to both.
 * Everything a procedure step refers to is positioned from those rectangles.
 * Items the procedure does not use are decoration: placed by eye, not operable,
 * and their lights stay extinguished.
 *
 * Light behaviour is a simplification for an airplane on the ground with
 * electrical power and both engines shut down. Each rule names its source.
 */

const W = 2170;
const H = 2100;
/**
 * Decoration is placed in the 2000-px-wide view of the photo it was read from.
 * Comparing those readings with the measured controls showed them 2 % small.
 */
const F = (W / 2000) * 1.02;

type Rects = Record<string, { rect: number[] }>;

export function buildFwdOverhead(controls: Rects): Schematic {
  const plates: PlateEl[] = [];
  const lines: LineEl[] = [];
  const texts: TextEl[] = [];
  const gauges: GaugeEl[] = [];
  const lights: LightEl[] = [];
  const switches: SwitchEl[] = [];
  let decor = 0;

  const box = (id: string) => {
    const [x, y, w, h] = controls[id].rect;
    const r = { x: x * W, y: y * H, w: w * W, h: h * H };
    return { ...r, cx: r.x + r.w / 2, cy: r.y + r.h / 2, x2: r.x + r.w, y2: r.y + r.h };
  };

  // ----- drawing helpers (canvas pixels) -----

  type TextOpts = { size?: number; anchor?: TextEl['anchor']; tone?: TextEl['tone']; rotate?: number };
  const text = (x: number, y: number, str: string, o: TextOpts = {}) => {
    const size = o.size ?? 20;
    const rows = str.split('\n');
    rows.forEach((row, i) =>
      texts.push({
        x,
        y: y + (i - (rows.length - 1) / 2) * size * 1.08,
        text: row,
        size,
        anchor: o.anchor ?? 'middle',
        tone: o.tone ?? 'light',
        rotate: o.rotate,
      }),
    );
  };
  const plate = (x: number, y: number, w: number, h: number, tone: PlateEl['tone'] = 'dark', r?: number) =>
    plates.push({ rect: [x, y, w, h], tone, r });
  const line = (points: [number, number][], tone: LineEl['tone'] = 'light', width = 3) =>
    lines.push({ points, tone, width });

  const when = (...conds: Cond[]) => conds;
  type LightOpts = { color?: LightColor; rules?: LightRule[]; base?: LightLevel; source?: string };
  const addLight = (id: string, rect: [number, number, number, number], rows: string[], o: LightOpts = {}) =>
    lights.push({ id, rect, lines: rows, color: o.color ?? 'amber', rules: o.rules, base: o.base, source: o.source });
  const light = (id: string, rows: string[], o: LightOpts = {}) => {
    const b = box(id);
    addLight(id, [b.x, b.y, b.w, b.h], rows, o);
  };
  /** Splits one measured rectangle into a row (or column) of individual lights. */
  const lightRow = (id: string, parts: [string, string[], LightOpts?][], vertical = false) => {
    const b = box(id);
    parts.forEach(([suffix, rows, o], i) => {
      const n = parts.length;
      const rect: [number, number, number, number] = vertical
        ? [b.x, b.y + (b.h / n) * i, b.w, b.h / n]
        : [b.x + (b.w / n) * i, b.y, b.w / n, b.h];
      addLight(`${id}.${suffix}`, rect, rows, o);
    });
  };

  const pos = (id: string, dir: Dir): SwitchPosition => ({ id, dir });
  const OFF_ON = [pos('OFF', 'up'), pos('ON', 'down')];
  const TOGGLE_R = 33;

  type ToggleOpts = {
    initial?: string;
    /** Where the position labels go: left or right of the lever, above and below it, or none. */
    labels?: 'l' | 'r' | 'tb' | 'br' | 'none';
    /** Label text per position id, when it differs from the id. */
    names?: Record<string, string>;
    at?: { x: number; y: number };
  };
  const toggle = (id: string, label: string, positions: SwitchPosition[], o: ToggleOpts = {}) => {
    const { x, y } = o.at ?? { x: box(id).cx, y: box(id).cy };
    switches.push({ id, label, style: 'toggle', x, y, r: TOGGLE_R, positions, initial: o.initial ?? positions[0].id });
    const side = o.labels ?? 'r';
    if (side === 'none') return;
    for (const p of positions) {
      const name = o.names?.[p.id] ?? p.id;
      const gap = TOGGLE_R + 8;
      if (p.dir === 'left') text(x - gap, y, name, { size: 17, anchor: 'end' });
      else if (p.dir === 'right') text(x + gap, y, name, { size: 17, anchor: 'start' });
      else if (p.dir === 'center' && positions.some((q) => q.dir === 'left')) text(x, y + gap + 2, name, { size: 17 });
      else if (side === 'br') {
        if (p.dir === 'up') text(x + 24, y - 36, name, { size: 12, anchor: 'start' });
        if (p.dir === 'down') text(x, y + gap + 6, name, { size: 13 });
      } else if (side === 'tb') {
        if (p.dir === 'up') text(x, y - gap - 6, name, { size: 17 });
        if (p.dir === 'down') text(x, y + gap + 8, name, { size: 17 });
        if (p.dir === 'center') text(x + gap, y, name, { size: 17, anchor: 'start' });
      } else {
        const dy = p.dir === 'up' ? -26 : p.dir === 'down' ? 28 : 1;
        text(side === 'l' ? x - gap : x + gap, y + dy, name, { size: 17, anchor: side === 'l' ? 'end' : 'start' });
      }
    }
  };

  const guard = (id: string, label: string, color: 'black' | 'red') => {
    const b = box(id);
    switches.push({
      id,
      label,
      style: 'guard',
      x: b.cx,
      y: b.cy,
      r: Math.min(b.w, b.h) / 2,
      positions: [{ id: 'closed' }, { id: 'open' }],
      initial: 'closed',
      guard: { w: b.w, h: b.h, color },
    });
  };

  type KnobOpts = { initial?: string; bar?: boolean; pointer?: number; r?: number; at?: { x: number; y: number } };
  const knob = (id: string, label: string, positions: [string, number][] | null, o: KnobOpts = {}) => {
    const b = o.at ? null : box(id);
    switches.push({
      id,
      label,
      style: 'knob',
      x: o.at?.x ?? b!.cx,
      y: o.at?.y ?? b!.cy,
      r: o.r ?? Math.min(b!.w, b!.h) / 2 - 4,
      positions: positions?.map(([pid, angle]) => ({ id: pid, angle })),
      initial: o.initial ?? positions?.[0][0],
      bar: o.bar,
      pointer: o.pointer,
    });
  };

  // ----- decoration helpers (coordinates read from the 2000-px view) -----

  const dPlate = (x: number, y: number, w: number, h: number, tone: PlateEl['tone'] = 'dark', r?: number) =>
    plate(x * F, y * F, w * F, h * F, tone, r);
  const dText = (x: number, y: number, str: string, o: TextOpts = {}) => text(x * F, y * F, str, o);
  const dLight = (x: number, y: number, w: number, h: number, rows: string[], o: LightOpts = {}) =>
    addLight(`decor.light${decor++}`, [x * F, y * F, w * F, h * F], rows, o);
  const dToggle = (x: number, y: number, dir: Dir = 'up', tone: SwitchEl['tone'] = 'light') =>
    switches.push({
      id: `decor.switch${decor++}`,
      label: '',
      style: 'toggle',
      x: x * F,
      y: y * F,
      r: TOGGLE_R,
      positions: [{ id: 'fixed', dir }],
      tone,
    });
  const dButton = (x: number, y: number, r = 20, tone: SwitchEl['tone'] = 'dark') =>
    switches.push({ id: `decor.switch${decor++}`, label: '', style: 'button', x: x * F, y: y * F, r, tone });
  const dKnob = (x: number, y: number, r: number, pointer: number) =>
    switches.push({ id: `decor.switch${decor++}`, label: '', style: 'knob', x: x * F, y: y * F, r, pointer });
  const dGuard = (x: number, y: number, w: number, h: number, color: 'black' | 'red') =>
    switches.push({
      id: `decor.switch${decor++}`,
      label: '',
      style: 'guard',
      x: (x + w / 2) * F,
      y: (y + h / 2) * F,
      r: 0,
      guard: { w: w * F, h: h * F, color },
    });
  const dGauge = (x: number, y: number, r: number, label: string[], needle: number) =>
    gauges.push({ x: x * F, y: y * F, r: r * F, label, needle });

  // =====================================================================
  // Plates
  // =====================================================================

  plate(0, 0, W, H, 'base', 0);
  dPlate(22, 36, 440, 622); // flight control
  dPlate(40, 662, 432, 426); // navigation, displays
  dPlate(52, 1092, 432, 186); // fuel valve lights
  dPlate(60, 1282, 430, 426, 'light'); // fuel pumps
  dPlate(466, 36, 408, 168); // blank
  dPlate(470, 208, 410, 574); // electrical meters, CAB/UTIL
  dPlate(474, 786, 406, 290); // standby power
  dPlate(480, 1080, 402, 462); // ground power, bus transfer, APU
  dPlate(488, 1206, 394, 300, 'light');
  dPlate(686, 1546, 196, 162); // L wiper
  dPlate(884, 36, 192, 272); // blank
  dPlate(884, 312, 192, 1396); // centre column
  dPlate(1080, 36, 428, 452); // window heat, probe heat
  dPlate(1080, 492, 428, 240); // anti-ice
  dPlate(1080, 736, 428, 250); // hydraulic pumps
  dPlate(1084, 866, 416, 118, 'light');
  dPlate(1080, 990, 428, 150); // door lights
  dPlate(1080, 1144, 428, 142); // voice recorder monitor
  dPlate(1080, 1290, 282, 418); // cabin altitude
  dPlate(1366, 1290, 124, 418); // alt horn cutout
  dPlate(1540, 36, 382, 112); // voice recorder
  dPlate(1512, 152, 408, 456); // air temperature
  dPlate(1512, 612, 408, 42); // dual bleed
  dPlate(1498, 658, 420, 556, 'light'); // bleed air
  dPlate(1512, 1218, 408, 44); // pressurization lights
  dPlate(1492, 1266, 410, 376); // pressurization
  dPlate(1516, 1648, 346, 56, 'black'); // altitude placard
  plate(66, 1900, 2062, 184); // lower strip

  // =====================================================================
  // Flight control panel
  // =====================================================================

  const FCOM_FC = 'FCOM Flight Controls – Controls and Indicators (PDF p. 1034)';
  {
    const a = box('fltCtl.A');
    const b = box('fltCtl.B');
    text((a.cx + b.cx) / 2, a.y - 44, 'FLT CONTROL', { size: 24 });
    text(a.cx, a.y - 16, 'A', { size: 18 });
    text(b.cx, b.y - 16, 'B', { size: 18 });
    guard('fltCtl.A', 'FLT CONTROL A switch', 'black');
    guard('fltCtl.B', 'FLT CONTROL B switch', 'black');
    text(a.x - 10, a.y + 34, 'STBY\nRUD', { size: 15, anchor: 'end' });
    text(a.x - 10, a.y + 100, 'OFF', { size: 15, anchor: 'end' });
    text(a.x - 10, a.y + 150, 'A ON', { size: 15, anchor: 'end' });
    text(b.x2 + 10, b.y + 34, 'STBY\nRUD', { size: 15, anchor: 'start' });
    text(b.x2 + 10, b.y + 100, 'OFF', { size: 15, anchor: 'start' });
    text(b.x2 + 10, b.y + 150, 'B ON', { size: 15, anchor: 'start' });

    // Low pressure lights go out once the electric pump of that system is on.
    light('fltCtl.lowPressA', ['LOW', 'PRESSURE'], {
      base: 'on',
      rules: [{ when: when({ 'hyd.elec2': 'ON' }), then: 'off' }],
      source: `${FCOM_FC}: illuminated with low system A pressure. Simplified: system A is pressurised when its electric pump (ELEC 2) is ON.`,
    });
    light('fltCtl.lowPressB', ['LOW', 'PRESSURE'], {
      base: 'on',
      rules: [{ when: when({ 'hyd.elec1': 'ON' }), then: 'off' }],
      source: `${FCOM_FC}: illuminated with low system B pressure. Simplified: system B is pressurised when its electric pump (ELEC 1) is ON.`,
    });

    const sa = box('spoiler.A');
    const sb = box('spoiler.B');
    text((sa.cx + sb.cx) / 2, sa.y - 42, 'SPOILER', { size: 22 });
    text(sa.cx, sa.y - 15, 'A', { size: 18 });
    text(sb.cx, sb.y - 15, 'B', { size: 18 });
    guard('spoiler.A', 'SPOILER A switch', 'black');
    guard('spoiler.B', 'SPOILER B switch', 'black');
    text(sa.x - 10, sa.y + 50, 'OFF', { size: 15, anchor: 'end' });
    text(sa.x - 10, sa.y + 130, 'ON', { size: 15, anchor: 'end' });
    text(sb.x2 + 10, sb.y + 50, 'OFF', { size: 15, anchor: 'start' });
    text(sb.x2 + 10, sb.y + 130, 'ON', { size: 15, anchor: 'start' });

    const yl = box('yawDamper.light');
    text(yl.x - 10, yl.cy, 'YAW\nDAMPER', { size: 16, anchor: 'end' });
    light('yawDamper.light', ['YAW', 'DAMPER'], {
      rules: [{ when: when({ 'yawDamper.switch': 'OFF' }), then: 'on' }],
      source: `${FCOM_FC}: illuminated when the yaw damper is not engaged. Simplified: follows the YAW DAMPER switch.`,
    });
    toggle('yawDamper.switch', 'YAW DAMPER switch', OFF_ON, { labels: 'l', at: { x: yl.cx, y: yl.y2 + 52 } });

    const lq = box('stbyHyd.lowQuantity');
    text(lq.cx, lq.y - 20, 'STANDBY HYD', { size: 20 });
    light('stbyHyd.lowQuantity', ['LOW', 'QUANTITY']);
    light('stbyHyd.lowPressure', ['LOW', 'PRESSURE']);
    light('stbyHyd.stbyRudOn', ['STBY', 'RUD ON']);

    const m = box('altFlaps.master');
    const p = box('altFlaps.position');
    guard('altFlaps.master', 'ALTERNATE FLAPS master switch', 'red');
    text(m.cx, m.y2 + 14, 'ARM', { size: 14 });
    text(p.cx + 4, m.y + 12, 'ALTERNATE\nFLAPS', { size: 17 });
    toggle('altFlaps.position', 'ALTERNATE FLAPS position switch', [pos('UP', 'up'), pos('OFF', 'center'), pos('DOWN', 'down')], {
      initial: 'OFF',
      labels: 'tb',
    });

    light('light.feelDiffPress', ['FEEL', 'DIFF PRESS']);
    light('light.speedTrimFail', ['SPEED TRIM', 'FAIL']);
    light('light.machTrimFail', ['MACH TRIM', 'FAIL']);
    light('light.autoSlatFail', ['AUTO SLAT', 'FAIL']);
    light('light.spoilers', ['SPOILERS']);
  }

  // =====================================================================
  // Navigation and displays
  // =====================================================================

  {
    const three = (l: string, r: string) => [pos(l, 'left'), pos('NORMAL', 'center'), pos(r, 'right')];
    const v = box('nav.vhfNav');
    const i = box('nav.irs');
    const f = box('nav.fmc');
    const titleY = v.cy - 84;
    text((v.cx + i.cx) / 2, titleY, 'NAVIGATION', { size: 22 });
    line([[v.cx - 110, titleY], [(v.cx + i.cx) / 2 - 80, titleY]]);
    line([[(v.cx + i.cx) / 2 + 80, titleY], [i.cx + 100, titleY]]);
    text(v.cx, v.cy - 52, 'VHF NAV', { size: 19 });
    toggle('nav.vhfNav', 'VHF NAV transfer switch', three('BOTH ON 1', 'BOTH ON 2'), {
      initial: 'NORMAL',
      names: { 'BOTH ON 1': 'BOTH\nON 1', 'BOTH ON 2': 'BOTH\nON 2' },
    });
    text(i.cx, i.cy - 52, 'IRS', { size: 19 });
    toggle('nav.irs', 'IRS transfer switch', three('BOTH ON L', 'BOTH ON R'), {
      initial: 'NORMAL',
      names: { 'BOTH ON L': 'BOTH\nON L', 'BOTH ON R': 'BOTH\nON R' },
    });
    text(f.cx, f.cy - 52, 'FMC', { size: 19 });
    toggle('nav.fmc', 'FMC source select switch', three('BOTH ON L', 'BOTH ON R'), {
      initial: 'NORMAL',
      names: { 'BOTH ON L': 'BOTH\nON L', 'BOTH ON R': 'BOTH\nON R' },
    });

    const s = box('displays.source');
    const c = box('displays.controlPanel');
    const dy = f.cy + 70;
    text((s.cx + c.cx) / 2, dy, 'DISPLAYS', { size: 22 });
    line([[(s.cx + c.cx) / 2 + 76, dy], [c.cx + 80, dy]]);
    text(s.cx - 30, s.cy - 100, 'SOURCE', { size: 19 });
    text(s.cx, s.cy - 76, 'AUTO', { size: 16 });
    text(s.cx - 62, s.cy - 44, 'ALL\nON 1', { size: 16, anchor: 'end' });
    text(s.cx + 62, s.cy - 44, 'ALL\nON 2', { size: 16, anchor: 'start' });
    knob('displays.source', 'SOURCE selector', [['ALL ON 1', -50], ['AUTO', 0], ['ALL ON 2', 50]], { initial: 'AUTO' });
    text(c.cx, c.cy - 54, 'CONTROL PANEL', { size: 18 });
    toggle('displays.controlPanel', 'CONTROL PANEL select switch', three('BOTH ON 1', 'BOTH ON 2'), {
      initial: 'NORMAL',
      names: { 'BOTH ON 1': 'BOTH\nON 1', 'BOTH ON 2': 'BOTH\nON 2' },
    });
  }

  // =====================================================================
  // Fuel
  // =====================================================================

  const FCOM_FUEL = 'FCOM Fuel – Controls and Indicators (PDF p. 1619–1621)';
  {
    const closed: LightOpts = {
      color: 'blue',
      base: 'dim',
      source: `${FCOM_FUEL}: dim when the valve is closed. Engines are shut down, so the valves are closed.`,
    };
    light('fuel.engValveClosedL', ['ENG VALVE', 'CLOSED'], closed);
    light('fuel.sparValveClosedL', ['SPAR VALVE', 'CLOSED'], closed);
    light('fuel.engValveClosedR', ['ENG VALVE', 'CLOSED'], closed);
    light('fuel.sparValveClosedR', ['SPAR VALVE', 'CLOSED'], closed);
    const el = box('fuel.engValveClosedL');
    const er = box('fuel.engValveClosedR');
    gauges.push({ x: (el.x2 + er.x) / 2, y: el.y2 + 28, r: 78, label: ['FUEL', 'TEMP', '°C'], needle: 60 });

    light('fuel.filterBypassL', ['FILTER', 'BYPASS']);
    light('fuel.filterBypassR', ['FILTER', 'BYPASS']);
    light('fuel.valveOpen', ['VALVE', 'OPEN'], {
      color: 'blue',
      rules: [{ when: when({ 'fuel.crossfeed': 'OPEN' }), then: 'dim' }],
      source: `${FCOM_FUEL}: dim when the crossfeed valve is open, extinguished when closed. The bright in-transit indication is not shown.`,
    });

    const x = box('fuel.crossfeed');
    const cl = box('fuel.pumpCtrL');
    const cr = box('fuel.pumpCtrR');
    const a1 = box('fuel.pumpAft1');
    const f1 = box('fuel.pumpFwd1');
    const f2 = box('fuel.pumpFwd2');
    const a2 = box('fuel.pumpAft2');
    // Flow lines of the fuel mimic.
    const t1 = (a1.cx + f1.cx) / 2;
    const t2 = (f2.cx + a2.cx) / 2;
    line([[t1, a1.y - 70], [t1, x.cy], [x.x - 6, x.cy]], 'dark', 5);
    line([[x.x2 + 6, x.cy], [t2, x.cy], [t2, a2.y - 70]], 'dark', 5);
    line([[t1, x.cy], [t1, x.y - 12]], 'dark', 5);
    line([[t2, x.cy], [t2, x.y - 12]], 'dark', 5);
    line([[cl.cx, cl.y - 34], [cl.cx, x.cy]], 'dark', 5);
    line([[cr.cx, cr.y - 34], [cr.cx, x.cy]], 'dark', 5);
    text(x.x - 52, x.cy - 22, 'CROSS', { size: 19, tone: 'dark' });
    text(x.x2 + 50, x.cy - 22, 'FEED', { size: 19, tone: 'dark' });
    knob('fuel.crossfeed', 'CROSSFEED selector', [['CLOSED', 0], ['OPEN', 90]], { bar: true, r: 42 });

    const pumpLow = (sw: string): LightOpts => ({
      base: 'on',
      rules: [{ when: when({ [sw]: 'ON' }), then: 'off' }],
      source: `${FCOM_FUEL}: main tank LOW PRESSURE light is illuminated when pump output pressure is low or the FUEL PUMP switch is OFF.`,
    });
    const ctr: LightOpts = {
      source: `${FCOM_FUEL}: centre tank LOW PRESSURE lights are extinguished with the switch OFF, and with the switch ON and normal pressure.`,
    };
    lightRow('fuel.lowPressCtr', [['L', ['LOW', 'PRESSURE'], ctr], ['R', ['LOW', 'PRESSURE'], ctr]]);
    lightRow('fuel.lowPress1', [
      ['aft', ['LOW', 'PRESSURE'], pumpLow('fuel.pumpAft1')],
      ['fwd', ['LOW', 'PRESSURE'], pumpLow('fuel.pumpFwd1')],
    ]);
    lightRow('fuel.lowPress2', [
      ['fwd', ['LOW', 'PRESSURE'], pumpLow('fuel.pumpFwd2')],
      ['aft', ['LOW', 'PRESSURE'], pumpLow('fuel.pumpAft2')],
    ]);

    const mid = (cl.cx + cr.cx) / 2;
    text(mid, cl.y - 18, 'FUEL PUMPS', { size: 18, tone: 'dark' });
    text(mid, cl.cy - 26, 'OFF', { size: 15, tone: 'dark' });
    text(mid, cl.cy + 30, 'ON', { size: 15, tone: 'dark' });
    text(cl.x - 14, cl.cy, 'L', { size: 19, tone: 'dark' });
    text(cr.x2 + 14, cr.cy, 'R', { size: 19, tone: 'dark' });
    text(mid, cl.y2 + 26, 'CTR', { size: 19, tone: 'dark' });
    toggle('fuel.pumpCtrL', 'FUEL PUMPS switch, CTR L', OFF_ON, { labels: 'none' });
    toggle('fuel.pumpCtrR', 'FUEL PUMPS switch, CTR R', OFF_ON, { labels: 'none' });

    for (const [l, r, n, names] of [
      [a1, f1, '1', ['AFT', 'FWD']],
      [f2, a2, '2', ['FWD', 'AFT']],
    ] as const) {
      const m = (l.cx + r.cx) / 2;
      text(m, l.cy - 26, 'OFF', { size: 15, tone: 'dark' });
      text(m, l.cy + 30, 'ON', { size: 15, tone: 'dark' });
      text(l.cx, l.y2 + 24, names[0], { size: 17, tone: 'dark' });
      text(r.cx, r.y2 + 24, names[1], { size: 17, tone: 'dark' });
      text(m, l.y2 + 58, n, { size: 22, tone: 'dark' });
    }
    text((f1.cx + f2.cx) / 2, a1.y2 + 40, 'FUEL\nPUMPS', { size: 18, tone: 'dark' });
    toggle('fuel.pumpAft1', 'FUEL PUMPS switch, tank 1 AFT', OFF_ON, { labels: 'none' });
    toggle('fuel.pumpFwd1', 'FUEL PUMPS switch, tank 1 FWD', OFF_ON, { labels: 'none' });
    toggle('fuel.pumpFwd2', 'FUEL PUMPS switch, tank 2 FWD', OFF_ON, { labels: 'none' });
    toggle('fuel.pumpAft2', 'FUEL PUMPS switch, tank 2 AFT', OFF_ON, { labels: 'none' });
  }

  // =====================================================================
  // Electrical (meters and generators are decoration)
  // =====================================================================

  {
    dText(585, 228, 'DC AMPS', { size: 19 });
    dText(735, 228, 'CPS FREQ', { size: 19 });
    dPlate(514, 246, 314, 156, 'black', 6);
    dText(672, 423, 'DC VOLTS   AC AMPS   AC VOLTS', { size: 17 });
    dLight(522, 452, 74, 40, ['BAT', 'DISCHARGE']);
    dLight(598, 452, 74, 40, ['TR UNIT']);
    dLight(674, 452, 74, 40, ['ELEC']);
    dButton(787, 472, 20);
    dText(787, 504, 'MAINT', { size: 15 });
    dKnob(565, 596, 40, 140);
    dText(565, 540, 'DC', { size: 16, tone: 'dim' });
    dKnob(775, 598, 40, 180);
    dText(775, 540, 'AC', { size: 16, tone: 'dim' });
    dGuard(540, 652, 50, 100, 'black');
    dText(565, 770, 'BAT', { size: 16 });

    const cu = box('elec.cabUtil');
    const ife = box('elec.ifePassSeat');
    toggle('elec.cabUtil', 'CAB/UTIL switch', OFF_ON, { labels: 'r' });
    toggle('elec.ifePassSeat', 'IFE/PASS SEAT switch', OFF_ON, { labels: 'r' });
    text(cu.cx, cu.y2 + 28, 'CAB/UTIL', { size: 17 });
    text(ife.cx + 6, ife.y2 + 36, 'IFE/PASS\nSEAT', { size: 17 });

    const sp = box('elec.standbyPower');
    const d1 = box('elec.disconnect1');
    const d2 = box('elec.disconnect2');
    dLight(520, 828, 78, 40, ['DRIVE']);
    dLight(640, 794, 76, 38, ['STANDBY', 'PWR OFF']);
    dLight(758, 828, 78, 40, ['DRIVE']);
    text(d1.cx, d1.y - 112, '1', { size: 16 });
    text(d2.cx, d2.y - 112, '2', { size: 16 });
    text(sp.cx, sp.y - 20, 'STANDBY POWER', { size: 19 });
    text(d1.cx, d1.y - 14, 'DISCONNECT', { size: 15 });
    text(d2.cx, d2.y - 14, 'DISCONNECT', { size: 15 });
    guard('elec.standbyPower', 'STANDBY POWER switch', 'black');
    text(sp.cx, sp.y2 + 20, 'BAT    OFF    AUTO', { size: 15 });
    guard('elec.disconnect1', 'Generator drive DISCONNECT switch 1', 'red');
    guard('elec.disconnect2', 'Generator drive DISCONNECT switch 2', 'red');

    const bt = box('elec.busTransfer');
    dLight(648, 1092, 66, 38, ['GRD POWER', 'AVAILABLE'], { color: 'blue' });
    dText(680, 1158, 'GRD PWR', { size: 17 });
    dToggle(680, 1212, 'center');
    text(bt.cx, bt.y - 14, 'BUS TRANSFER', { size: 17, tone: 'dark' });
    text(bt.x - 12, bt.cy, 'OFF', { size: 15, tone: 'dark', anchor: 'end' });
    text(bt.x2 + 12, bt.cy, 'AUTO', { size: 15, tone: 'dark', anchor: 'start' });
    guard('elec.busTransfer', 'BUS TRANSFER switch', 'black');
    for (const x of [512, 782]) {
      dLight(x, 1284, 72, 36, ['TRANSFER', 'BUS OFF']);
      dLight(x, 1322, 72, 36, ['SOURCE', 'OFF']);
      dLight(x, 1360, 72, 36, ['GEN OFF', 'BUS'], { color: 'blue' });
    }
    dLight(648, 1360, 72, 36, ['APU GEN', 'OFF BUS'], { color: 'blue' });
    for (const x of [543, 622, 741, 820]) dToggle(x, 1444, 'center');
    dText(543, 1492, 'GEN 1', { size: 16, tone: 'dark' });
    dText(682, 1492, 'APU GEN', { size: 16, tone: 'dark' });
    dText(820, 1492, 'GEN 2', { size: 16, tone: 'dark' });
    ['DOOR', 'LOW OIL\nPRESSURE', 'FAULT', 'OVERSPEED'].forEach((t, i) =>
      dLight(543 + i * 72, 1500, 70, 28, t.split('\n')),
    );
  }

  // =====================================================================
  // Centre column
  // =====================================================================

  {
    const cb = box('lights.circuitBreaker');
    const pl = box('lights.panel');
    text(cb.cx, cb.y - 44, 'CIRCUIT BREAKER', { size: 19 });
    text(cb.cx, cb.y - 16, 'BRIGHT', { size: 14 });
    text(cb.x - 8, cb.y2 + 4, 'OFF', { size: 14, anchor: 'end' });
    knob('lights.circuitBreaker', 'CIRCUIT BREAKER light control', null, { pointer: 20 });
    text(pl.cx, pl.y - 44, 'PANEL', { size: 19 });
    text(pl.cx, pl.y - 16, 'BRIGHT', { size: 14 });
    text(pl.x - 8, pl.y2 + 4, 'OFF', { size: 14, anchor: 'end' });
    knob('lights.panel', 'PANEL light control', null, { pointer: 20 });

    dText(979, 650, 'LAVATORY', { size: 16 });
    dLight(941, 664, 76, 36, ['SMOKE']);

    const off = box('equipCooling.offLights');
    const su = box('equipCooling.supply');
    const ex = box('equipCooling.exhaust');
    text(off.cx, off.y - 18, 'EQUIP COOLING', { size: 19 });
    lightRow('equipCooling.offLights', [['supply', ['OFF']], ['exhaust', ['OFF']]]);
    const norm = [pos('NORMAL', 'up'), pos('ALTN', 'down')];
    text(su.cx, su.y - 20, 'SUPPLY', { size: 14 });
    text(ex.cx, ex.y - 20, 'EXHAUST', { size: 14 });
    text((su.cx + ex.cx) / 2, su.cy - 24, 'NORM', { size: 14 });
    text((su.cx + ex.cx) / 2, su.cy + 30, 'ALTN', { size: 14 });
    toggle('equipCooling.supply', 'EQUIP COOLING SUPPLY switch', norm, { labels: 'none' });
    toggle('equipCooling.exhaust', 'EQUIP COOLING EXHAUST switch', norm, { labels: 'none' });
    light('equipCooling.smoke', ['EQUIP', 'SMOKE']);

    dText(981, 978, 'EMER EXIT LIGHTS', { size: 17 });
    dLight(900, 1062, 42, 80, ['NOT', 'ARMED']);
    dGuard(966, 1000, 56, 150, 'black');
    dText(1030, 1044, 'OFF', { size: 14, anchor: 'start' });
    dText(1030, 1078, 'ARMED', { size: 14, anchor: 'start' });
    dText(1030, 1110, 'ON', { size: 14, anchor: 'start' });

    const fb = box('signs.fastenBelts');
    const belts = [pos('OFF', 'up'), pos('AUTO', 'center'), pos('ON', 'down')];
    const ns = fb.cx - 100;
    text(fb.cx - 4, fb.y - 34, 'FASTEN\nBELTS', { size: 17 });
    text(ns, fb.y - 34, 'NO\nSMOKING', { size: 17, tone: 'dim' });
    text((ns + fb.cx) / 2, fb.cy - 26, 'OFF', { size: 14 });
    text((ns + fb.cx) / 2, fb.cy + 2, 'AUTO', { size: 14 });
    text((ns + fb.cx) / 2, fb.cy + 30, 'ON', { size: 14 });
    switches.push({ id: `decor.switch${decor++}`, label: '', style: 'toggle', x: ns, y: fb.cy, r: TOGGLE_R, positions: [{ id: 'fixed', dir: 'up' }] });
    toggle('signs.fastenBelts', 'FASTEN BELTS switch', belts, { labels: 'none' });

    dText(925, 1318, 'ATTEND', { size: 16 });
    dButton(925, 1352, 18);
    dText(1032, 1310, 'GRD\nCALL', { size: 16 });
    dButton(1032, 1352, 18);
    dLight(985, 1398, 74, 34, ['CALL'], { color: 'blue' });
    dText(981, 1448, 'CABIN READY', { size: 15 });
    dLight(900, 1462, 74, 34, ['CABIN', 'READY']);
    dButton(1022, 1480, 17);

    const wiper: [string, number][] = [['PARK', 0], ['INT', 45], ['LOW', 90], ['HIGH', 135]];
    for (const [id, name] of [['wiper.L', 'L WIPER'], ['wiper.R', 'R WIPER']] as const) {
      const w = box(id);
      text(w.cx + 6, w.y - 56, name, { size: 19 });
      text(w.cx, w.y - 26, 'PARK', { size: 14 });
      text(w.x2 + 8, w.y + 4, 'INT', { size: 14, anchor: 'start' });
      text(w.x2 + 16, w.cy, 'LOW', { size: 14, anchor: 'start' });
      text(w.x2 + 8, w.y2 - 2, 'HIGH', { size: 14, anchor: 'start' });
      knob(id, `${name} selector`, wiper);
    }
  }

  // =====================================================================
  // Window heat, probe heat, anti-ice
  // =====================================================================

  const FCOM_ICE = 'FCOM 3.10 Anti-Ice, Rain – Controls and Indicators (PDF p. 839–843)';
  {
    const whOn = (sw: string): LightOpts => ({
      color: 'green',
      rules: [{ when: when({ [sw]: 'ON' }), then: 'on' }],
      source: `${FCOM_ICE}: illuminated when window heat is being applied; extinguished with the switch OFF.`,
    });
    lightRow('windowHeat.overheatL', [['side', ['OVERHEAT']], ['fwd', ['OVERHEAT']]]);
    lightRow('windowHeat.overheatR', [['fwd', ['OVERHEAT']], ['side', ['OVERHEAT']]]);
    lightRow('windowHeat.onL', [['side', ['ON'], whOn('windowHeat.sideL')], ['fwd', ['ON'], whOn('windowHeat.fwdL')]]);
    lightRow('windowHeat.onR', [['fwd', ['ON'], whOn('windowHeat.fwdR')], ['side', ['ON'], whOn('windowHeat.sideR')]]);
    const sl = box('windowHeat.sideL');
    const fl = box('windowHeat.fwdL');
    const fr = box('windowHeat.fwdR');
    const sr = box('windowHeat.sideR');
    const mid = (fl.cx + fr.cx) / 2;
    const ty = sl.y - 22;
    text(mid, ty, 'WINDOW HEAT', { size: 17 });
    text(sl.cx - 4, ty, 'L', { size: 17 });
    text(sr.cx + 4, ty, 'R', { size: 17 });
    text(sl.cx - 30, sl.cy + 4, 'SIDE', { size: 12, anchor: 'end' });
    text(fl.cx + 30, fl.cy + 4, 'FWD', { size: 12, anchor: 'start' });
    text(fr.cx - 30, fr.cy + 4, 'FWD', { size: 12, anchor: 'end' });
    text(sr.cx + 30, sr.cy + 4, 'SIDE', { size: 12, anchor: 'start' });
    for (const m of [(sl.cx + fl.cx) / 2, (fr.cx + sr.cx) / 2]) {
      text(m, sl.cy - 24, 'OFF', { size: 12 });
      text(m, sl.cy + 28, 'ON', { size: 12 });
    }
    for (const id of ['sideL', 'fwdL', 'fwdR', 'sideR']) {
      const side = id.startsWith('side') ? 'SIDE' : 'FWD';
      toggle(`windowHeat.${id}`, `WINDOW HEAT ${id.endsWith('L') ? 'L' : 'R'} ${side} switch`, OFF_ON, { labels: 'none' });
    }
    switches.push({ id: `decor.switch${decor++}`, label: '', style: 'toggle', x: mid, y: sl.cy, r: 26, positions: [{ id: 'fixed', dir: 'center' }] });
    text(mid, sl.cy - 36, 'TEST', { size: 11 });

    const pa = box('probeHeat.A');
    const pb = box('probeHeat.B');
    const probe = (sw: string): LightOpts => ({
      base: 'on',
      rules: [{ when: when({ [sw]: 'ON' }), then: 'off' }],
      source: `${FCOM_ICE}: illuminated when the related probe is not heated. In AUTO the probes are heated only when an engine is running, so with engines shut down the lights are illuminated unless the switch is ON.`,
    });
    const A = probe('probeHeat.A');
    const B = probe('probeHeat.B');
    lightRow('probeHeat.lightsL', [['capt', ['CAPT', 'PITOT'], A], ['elev', ['L ELEV', 'PITOT'], A], ['alpha', ['L ALPHA', 'VANE'], A], ['temp', ['TEMP', 'PROBE'], A]], true);
    lightRow('probeHeat.lightsR', [['fo', ['F/O', 'PITOT'], B], ['elev', ['R ELEV', 'PITOT'], B], ['alpha', ['R ALPHA', 'VANE'], B], ['aux', ['AUX', 'PITOT'], B]], true);
    const pm = (pa.cx + pb.cx) / 2;
    const auto = [pos('AUTO', 'up'), pos('ON', 'down')];
    text(pm, pa.y - 14, 'PROBE', { size: 17 });
    text(pa.x - 4, pa.cy, 'A', { size: 15, anchor: 'end' });
    text(pm, pa.cy - 24, 'AUTO', { size: 11 });
    text(pb.x2 + 4, pa.cy, 'B', { size: 15, anchor: 'start' });
    text(pm, pa.cy + 28, 'ON', { size: 11 });
    text(pm, pa.y2 + 22, 'HEAT', { size: 17 });
    toggle('probeHeat.A', 'PROBE HEAT A switch', auto, { labels: 'none' });
    toggle('probeHeat.B', 'PROBE HEAT B switch', auto, { labels: 'none' });
    dText(1296, 400, 'TAT TEST', { size: 15 });
    dButton(1292, 440, 18);

    const disagree = `${FCOM_ICE}: extinguished when the valve position agrees with the switch, in either position. The momentary in-transit indication is not shown.`;
    lightRow('wingAntiIce.valveLights', [['L', ['L VALVE'], { source: disagree }], ['R', ['R VALVE'], { source: disagree }]]);
    const wa = box('wingAntiIce.switch');
    text(wa.x - 12, wa.cy, 'WING\nANTI-ICE', { size: 15, anchor: 'end' });
    toggle('wingAntiIce.switch', 'WING ANTI-ICE switch', OFF_ON, { labels: 'r' });

    lightRow('engAntiIce.engLights', [['1', ['ENG', 'ANTI-ICE']], ['2', ['ENG', 'ANTI-ICE']]]);
    lightRow('engAntiIce.cowlLights', [['1', ['COWL', 'ANTI-ICE']], ['2', ['COWL', 'ANTI-ICE']]]);
    lightRow('engAntiIce.cowlValveLights', [['1', ['COWL VALVE'], { source: disagree }], ['2', ['COWL VALVE'], { source: disagree }]]);
    const e1 = box('engAntiIce.1');
    const e2 = box('engAntiIce.2');
    const em = (e1.cx + e2.cx) / 2;
    text(em, e1.y2 + 18, 'ENG ANTI-ICE', { size: 15 });
    text(em, e1.cy - 24, 'OFF', { size: 12 });
    text(em, e1.cy + 28, 'ON', { size: 12 });
    text(e1.x - 4, e1.cy, '1', { size: 15, anchor: 'end' });
    text(e2.x2 + 4, e2.cy, '2', { size: 15, anchor: 'start' });
    toggle('engAntiIce.1', 'ENG ANTI-ICE switch 1', OFF_ON, { labels: 'none' });
    toggle('engAntiIce.2', 'ENG ANTI-ICE switch 2', OFF_ON, { labels: 'none' });
  }

  // =====================================================================
  // Hydraulic pumps
  // =====================================================================

  const FCOM_HYD = 'FCOM Hydraulics – Controls and Indicators (PDF p. 1637)';
  {
    const e1 = box('hyd.eng1');
    const l2 = box('hyd.elec2');
    const l1 = box('hyd.elec1');
    const e2 = box('hyd.eng2');
    const lp2 = box('hyd.lowPressElec2');
    const lp1 = box('hyd.lowPressElec1');
    const elecLow = (sw: string): LightOpts => ({
      base: 'on',
      rules: [{ when: when({ [sw]: 'ON' }), then: 'off' }],
      source: `${FCOM_HYD}: illuminated when the output pressure of the pump is low. Simplified: follows the electric pump switch.`,
    });
    light('hyd.lowPressElec2', ['LOW', 'PRESSURE'], elecLow('hyd.elec2'));
    light('hyd.lowPressElec1', ['LOW', 'PRESSURE'], elecLow('hyd.elec1'));
    addLight(`decor.light${decor++}`, [lp2.x - lp2.w - 4, lp2.y, lp2.w, lp2.h], ['LOW', 'PRESSURE']);
    addLight(`decor.light${decor++}`, [lp1.x2 + 4, lp1.y, lp1.w, lp1.h], ['LOW', 'PRESSURE']);
    addLight(`decor.light${decor++}`, [lp2.x, lp2.y - lp2.h - 3, lp2.w, lp2.h], ['OVERHEAT']);
    addLight(`decor.light${decor++}`, [lp1.x, lp1.y - lp1.h - 3, lp1.w, lp1.h], ['OVERHEAT']);
    const y = l2.cy;
    text(e1.cx, y + 50, 'ENG 1', { size: 14, tone: 'dark' });
    text(l2.cx, y + 50, 'ELEC 2', { size: 14, tone: 'dark' });
    text(l1.cx, y + 50, 'ELEC 1', { size: 14, tone: 'dark' });
    text(e2.cx, y + 50, 'ENG 2', { size: 14, tone: 'dark' });
    for (const m of [(e1.cx + l2.cx) / 2, (l1.cx + e2.cx) / 2]) {
      text(m, y - 24, 'OFF', { size: 13, tone: 'dark' });
      text(m, y + 30, 'ON', { size: 13, tone: 'dark' });
    }
    text((e1.cx + l2.cx) / 2, y + 50, 'A', { size: 16, tone: 'dark' });
    text((l1.cx + e2.cx) / 2, y + 50, 'B', { size: 16, tone: 'dark' });
    text((l2.cx + l1.cx) / 2, y + 68, 'HYD PUMPS', { size: 14, tone: 'dark' });
    toggle('hyd.eng1', 'HYD PUMPS ENG 1 switch (system A)', OFF_ON, { labels: 'none', initial: 'ON', at: { x: e1.cx, y } });
    toggle('hyd.elec2', 'HYD PUMPS ELEC 2 switch (system A)', OFF_ON, { labels: 'none' });
    toggle('hyd.elec1', 'HYD PUMPS ELEC 1 switch (system B)', OFF_ON, { labels: 'none' });
    toggle('hyd.eng2', 'HYD PUMPS ENG 2 switch (system B)', OFF_ON, { labels: 'none', initial: 'ON', at: { x: e2.cx, y } });
  }

  // Door lights, voice recorder monitor (decoration).
  {
    const grid = [
      [null, 'FWD\nENTRY', 'FWD\nSERVICE', null],
      ['AIR\nSTAIR', 'LEFT FWD\nOVERWING', 'RIGHT FWD\nOVERWING', 'FWD\nCARGO'],
      ['EQUIP', 'LEFT AFT\nOVERWING', 'RIGHT AFT\nOVERWING', 'AFT\nCARGO'],
      [null, 'AFT\nENTRY', 'AFT\nSERVICE', null],
    ];
    grid.forEach((row, r) =>
      row.forEach((t, c) => {
        if (t) dLight(1143 + c * 73, 996 + r * 35, 71, 33, t.split('\n'));
      }),
    );
    dText(1286, 1158, 'COCKPIT VOICE RECORDER MICROPHONE MONITOR', { size: 12 });
    dButton(1190, 1206, 30);
    dButton(1255, 1232, 12, 'red');
    dText(1255, 1206, 'ERASE', { size: 14 });
    dButton(1317, 1232, 12);
    dText(1317, 1206, 'TEST', { size: 14 });
    dText(1190, 1264, 'STATUS', { size: 14 });
    dButton(1385, 1212, 16);
    dText(1385, 1264, 'HEADPHONE', { size: 14 });
  }

  // =====================================================================
  // Cabin altitude indicators
  // =====================================================================

  {
    const a = box('press.cabinAltGauge');
    const c = box('press.cabinClimbGauge');
    gauges.push({ x: a.cx, y: a.cy, r: Math.min(a.w, a.h) / 2 - 6, label: ['DIFF PRESS', 'PSI', 'CABIN ALT', 'x 1000 FT'], needle: 0 });
    gauges.push({ x: c.cx, y: c.cy, r: Math.min(c.w, c.h) / 2 - 4, label: ['CABIN', 'CLIMB'], needle: -90 });
    dText(1414, 1338, 'ALT\nHORN\nCUTOUT', { size: 16 });
    dButton(1414, 1396, 18);
    dPlate(1082, 1582, 78, 68, 'black', 4);
    dText(1121, 1616, 'PRESS DIFF\nLIMIT: TAKE-\nOFF & LDG\n.125 PSI', { size: 11 });
  }

  // =====================================================================
  // Air conditioning and bleed air
  // =====================================================================

  const FCOM_AIR = 'FCOM 2.10 Air Systems – Controls and Indicators (PDF p. 801–811, 834)';
  {
    dText(1622, 62, 'VOICE\nRECORDER', { size: 16 });
    dText(1733, 52, 'AUTO', { size: 13 });
    dToggle(1733, 90, 'up', 'dark');
    dText(1733, 130, 'ON', { size: 13 });

    const ts = box('air.tempSource');
    text(ts.x - 50, ts.y - 30, 'AIR TEMP', { size: 19 });
    dGauge(1602, 244, 72, ['TEMP', '°C'], -100);
    text(ts.x - 26, ts.cy, 'SUPPLY\nDUCT', { size: 13, anchor: 'end' });
    text(ts.cx, ts.y - 12, 'PASS CAB', { size: 12 });
    text(ts.x2 + 8, ts.cy, 'PACK', { size: 13, anchor: 'start' });
    knob('air.tempSource', 'AIR TEMP source selector', null, { pointer: 140 });

    const ta = box('air.trimAir');
    text(ta.cx - 6, ta.y - 16, 'TRIM AIR', { size: 18 });
    toggle('air.trimAir', 'TRIM AIR switch', OFF_ON, { labels: 'r' });

    for (const [lightId, selId, name] of [
      ['air.zoneTempCont', 'air.tempSelCont', 'CONT CAB'],
      ['air.zoneTempFwd', 'air.tempSelFwd', 'FWD CAB'],
      ['air.zoneTempAft', 'air.tempSelAft', 'AFT CAB'],
    ] as const) {
      const s = box(selId);
      light(lightId, ['ZONE', 'TEMP']);
      text(s.cx, s.y - 12, name, { size: 16 });
      text(s.x - 2, s.y2 + 2, 'C', { size: 13 });
      text(s.x2 + 2, s.y2 + 2, 'W', { size: 13 });
      text(s.cx, s.y2 + 7, 'OFF', { size: 11 });
      knob(selId, `${name} temperature selector`, null, { pointer: 0 });
    }

    light('air.dualBleed', ['DUAL', 'BLEED'], {
      rules: [
        {
          when: when(
            { 'air.apuBleed': 'ON', 'air.bleed1': 'ON' },
            { 'air.apuBleed': 'ON', 'air.bleed2': 'ON', 'air.isolationValve': 'OPEN' },
            { 'air.apuBleed': 'ON', 'air.bleed2': 'ON', 'air.isolationValve': 'AUTO', 'air.bleed1': 'OFF' },
          ),
          then: 'on',
        },
      ],
      source: `${FCOM_AIR}: illuminated with the APU bleed air valve open and engine No. 1 BLEED air switch ON, or engine No. 2 BLEED air switch ON with the APU bleed air valve and isolation valve open. Simplified: the APU bleed valve follows the APU BLEED switch.`,
    });

    const rl = box('air.recircL');
    const rr = box('air.recircR');
    const recirc = [pos('OFF', 'up'), pos('AUTO', 'down')];
    text(rl.cx + 20, rl.y - 14, 'L RECIRC FAN', { size: 15, tone: 'dark' });
    text(rr.cx - 20, rr.y - 14, 'R RECIRC FAN', { size: 15, tone: 'dark' });
    toggle('air.recircL', 'L RECIRC FAN switch', recirc, { labels: 'none', initial: 'AUTO' });
    toggle('air.recircR', 'R RECIRC FAN switch', recirc, { labels: 'none', initial: 'AUTO' });
    text(rl.x2 + 8, rl.cy - 22, 'OFF', { size: 14, tone: 'dark', anchor: 'start' });
    text(rl.x2 + 8, rl.cy + 26, 'AUTO', { size: 14, tone: 'dark', anchor: 'start' });
    text(rr.x - 8, rr.cy - 22, 'OFF', { size: 14, tone: 'dark', anchor: 'end' });
    text(rr.cx, rr.y2 + 12, 'AUTO', { size: 14, tone: 'dark' });
    const iso = box('air.isolationValve');
    gauges.push({ x: iso.cx, y: (rl.y2 + iso.y) / 2 - 22, r: 52, label: ['DUCT', 'PRESS', 'PSI'], needle: 200 });
    dText(1846, 772, 'OVHT', { size: 13, tone: 'dark' });
    dButton(1846, 806, 16);
    dText(1846, 842, 'TEST', { size: 13, tone: 'dark' });

    const pk = [pos('OFF', 'up'), pos('AUTO', 'center'), pos('HIGH', 'down')];
    const pL = box('air.packL');
    const pR = box('air.packR');
    text(pL.cx, pL.y - 14, 'L PACK', { size: 15, tone: 'dark' });
    text(pR.cx, pR.y - 14, 'R PACK', { size: 15, tone: 'dark' });
    text(pL.x2 + 6, pL.cy, 'OFF\nAUTO\nHIGH', { size: 12, tone: 'dark', anchor: 'start' });
    text(pR.x - 6, pR.cy, 'OFF\nAUTO\nHIGH', { size: 12, tone: 'dark', anchor: 'end' });
    toggle('air.packL', 'L PACK switch', pk, { labels: 'none' });
    toggle('air.packR', 'R PACK switch', pk, { labels: 'none' });
    text(iso.cx, iso.y - 34, 'ISOLATION\nVALVE', { size: 14, tone: 'dark' });
    text(iso.cx, iso.y - 6, 'CLOSE', { size: 12, tone: 'dark' });
    text(iso.x2 + 6, iso.cy, 'AUTO', { size: 12, tone: 'dark', anchor: 'start' });
    text(iso.cx, iso.y2 + 8, 'OPEN', { size: 12, tone: 'dark' });
    toggle('air.isolationValve', 'ISOLATION VALVE switch', [pos('CLOSE', 'up'), pos('AUTO', 'center'), pos('OPEN', 'down')], {
      labels: 'none',
      initial: 'OPEN',
    });

    light('air.packLightL', ['PACK']);
    light('air.packLightR', ['PACK']);
    light('air.wingBodyOvhtL', ['WING-BODY', 'OVERHEAT']);
    light('air.wingBodyOvhtR', ['WING-BODY', 'OVERHEAT']);
    light('air.bleedLightL', ['BLEED']);
    light('air.bleedLightR', ['BLEED']);
    const wl = box('air.wingBodyOvhtL');
    const wr = box('air.wingBodyOvhtR');
    text(wl.x - 34, wl.cy, 'WING\nANTI\nICE', { size: 12, tone: 'dark' });
    text(wr.x2 + 34, wr.cy, 'WING\nANTI\nICE', { size: 12, tone: 'dark' });
    text((wl.x2 + wr.x) / 2, wl.y2 - 8, 'TRIP', { size: 12, tone: 'dark' });
    switches.push({ id: `decor.switch${decor++}`, label: '', style: 'button', x: (wl.x2 + wr.x) / 2, y: wl.y2 + 20, r: 16, tone: 'dark' });
    text((wl.x2 + wr.x) / 2, wl.y2 + 48, 'RESET', { size: 12, tone: 'dark' });

    const b1 = box('air.bleed1');
    const b2 = box('air.bleed2');
    const ab = box('air.apuBleed');
    const by = ab.cy;
    toggle('air.bleed1', 'Engine BLEED air switch 1', OFF_ON, { labels: 'none', initial: 'ON', at: { x: b1.cx, y: by } });
    toggle('air.apuBleed', 'APU BLEED air switch', OFF_ON, { labels: 'none' });
    toggle('air.bleed2', 'Engine BLEED air switch 2', OFF_ON, { labels: 'none', initial: 'ON', at: { x: b2.cx, y: by } });
    text(b1.x2 + 8, by - 22, 'OFF', { size: 13, tone: 'dark', anchor: 'start' });
    text(b1.x2 + 8, by + 26, 'ON', { size: 13, tone: 'dark', anchor: 'start' });
    text(b2.x - 8, by - 22, 'OFF', { size: 13, tone: 'dark', anchor: 'end' });
    text(b2.x - 8, by + 26, 'ON', { size: 13, tone: 'dark', anchor: 'end' });
    text(b1.cx, by + 56, '1', { size: 15, tone: 'dark' });
    text(ab.cx, by + 56, 'APU', { size: 15, tone: 'dark' });
    text(b2.cx, by + 56, '2', { size: 15, tone: 'dark' });
    text((ab.cx + b2.cx) / 2 + 10, by + 56, 'BLEED', { size: 15, tone: 'dark' });
  }

  // =====================================================================
  // Pressurization
  // =====================================================================

  {
    const af = box('press.autoFail');
    const gap = 3;
    light('press.autoFail', ['AUTO', 'FAIL']);
    addLight(`decor.light${decor++}`, [af.x2 + gap, af.y, af.w, af.h], ['OFF SCHED', 'DESCENT']);
    addLight('press.altn', [af.x2 + af.w + gap * 2, af.y, af.w, af.h], ['ALTN'], {
      color: 'green',
      rules: [{ when: when({ 'press.modeSelector': 'ALTN' }), then: 'on' }],
      source: `${FCOM_AIR}: illuminated with the pressurization mode selector in ALTN.`,
    });
    addLight('press.manual', [af.x2 + af.w * 2 + gap * 3, af.y, af.w, af.h], ['MANUAL'], {
      color: 'green',
      rules: [{ when: when({ 'press.modeSelector': 'MAN' }), then: 'on' }],
      source: `${FCOM_AIR}: illuminated with the pressurization mode selector in MAN.`,
    });

    const fa = box('press.fltAlt');
    const la = box('press.landAlt');
    const ms = box('press.modeSelector');
    text(fa.cx, fa.y - 16, 'AUTO', { size: 16 });
    text(ms.cx + 20, fa.y - 16, 'MANUAL', { size: 16 });
    line([[fa.x2 + 26, fa.y - 28], [fa.x2 + 26, la.y2 + 10]]);
    for (const [b, name, id, label] of [
      [fa, 'FLT ALT', 'press.fltAlt', 'FLT ALT indicator and selector'],
      [la, 'LAND ALT', 'press.landAlt', 'LAND ALT indicator and selector'],
    ] as const) {
      plate(b.x + 6, b.y + 2, b.w - 12, 40, 'black', 4);
      text(b.cx, b.y + 23, '- - - - -', { size: 20, tone: 'dim' });
      text(b.cx, b.y + 60, name, { size: 15 });
      knob(id, label, null, { at: { x: b.cx, y: b.y2 - 40 }, r: 32, pointer: 0 });
    }
    gauges.push({ x: ms.cx + 12, y: fa.cy + 8, r: 50, label: ['VALVE'], needle: -60 });
    switches.push({ id: `decor.switch${decor++}`, label: '', style: 'toggle', x: ms.cx + 12, y: la.y - 4, r: 24, positions: [{ id: 'fixed', dir: 'center' }], tone: 'dark' });
    text(ms.cx - 26, la.y - 4, 'CLOSE', { size: 11, anchor: 'end' });
    text(ms.cx + 50, la.y - 4, 'OPEN', { size: 11, anchor: 'start' });
    text(ms.cx, ms.cy - 80, 'ALTN', { size: 14 });
    text(ms.cx - 52, ms.cy - 62, 'AUTO', { size: 14 });
    text(ms.cx + 52, ms.cy - 62, 'MAN', { size: 14 });
    knob('press.modeSelector', 'Pressurization mode selector', [['AUTO', -40], ['ALTN', 0], ['MAN', 40]]);

    dText(1688, 1664, 'CAB ALT │ LAND ALT │ 2000 │ 4000 │ 6000 │ 8000', { size: 11 });
    dText(1688, 1688, 'FLT ALT │ <FL160 │ FL220 │ FL260 │ FL320 │ FL410', { size: 11 });
  }

  // =====================================================================
  // Lower strip: exterior lights, APU, engine start
  // =====================================================================

  {
    const ld = box('ext.landing');
    text(ld.cx, ld.cy - 64, 'LANDING', { size: 15 });
    text(ld.cx, ld.cy - 26, 'OFF', { size: 12 });
    text(ld.cx, ld.cy + 46, 'L    ON    R', { size: 13 });
    toggle('ext.landingL', 'LANDING light switch L', OFF_ON, { labels: 'none', at: { x: ld.x + ld.w * 0.25, y: ld.cy } });
    toggle('ext.landingR', 'LANDING light switch R', OFF_ON, { labels: 'none', at: { x: ld.x + ld.w * 0.75, y: ld.cy } });

    const tl = box('ext.rwyTurnoffL');
    const tr = box('ext.rwyTurnoffR');
    const tm = (tl.cx + tr.cx) / 2;
    text(tm, tl.cy - 66, 'RUNWAY\nTURNOFF', { size: 13 });
    text(tl.cx, tl.cy + 46, 'L', { size: 13 });
    text(tr.cx, tl.cy + 46, 'R', { size: 13 });
    text(tm, tl.cy - 24, 'OFF', { size: 12 });
    text(tm, tl.cy + 28, 'ON', { size: 12 });
    toggle('ext.rwyTurnoffL', 'RUNWAY TURNOFF L switch', OFF_ON, { labels: 'none' });
    toggle('ext.rwyTurnoffR', 'RUNWAY TURNOFF R switch', OFF_ON, { labels: 'none' });

    const tx = box('ext.taxi');
    text(tx.cx + 6, tx.cy - 64, 'TAXI', { size: 15 });
    toggle('ext.taxi', 'TAXI light switch', [pos('OFF', 'up'), pos('AUTO', 'down')], { labels: 'br' });

    const apuX = tx.cx + 80;
    text(apuX, tx.cy - 64, 'APU', { size: 15 });
    switches.push({ id: `decor.switch${decor++}`, label: '', style: 'toggle', x: apuX, y: tx.cy, r: TOGGLE_R, positions: [{ id: 'fixed', dir: 'up' }] });
    text(apuX + 24, tx.cy - 36, 'OFF', { size: 12, anchor: 'start' });
    text(apuX + 30, tx.cy + 6, 'ON', { size: 12, anchor: 'start' });
    text(apuX, tx.cy + 47, 'START', { size: 13 });
    line([[box('ext.logo').x - 40, 1912], [box('ext.logo').x - 40, 2072]], 'light', 2);

    const s1 = box('eng.start1');
    const s2 = box('eng.start2');
    const ig = box('eng.ignition');
    const start: [string, number][] = [['GRD', -50], ['OFF', -17], ['CONT', 17], ['FLT', 50]];
    text(ig.cx, ig.cy - 66, 'ENGINE START', { size: 15 });
    for (const [b, id, n] of [[s1, 'eng.start1', '1'], [s2, 'eng.start2', '2']] as const) {
      text(b.x - 2, b.y + 12, 'GRD', { size: 13, anchor: 'end' });
      text(b.cx - 22, b.y - 12, 'OFF', { size: 13 });
      text(b.cx + 26, b.y - 12, 'CONT', { size: 13 });
      text(b.x2 + 2, b.y + 12, 'FLT', { size: 13, anchor: 'start' });
      knob(id, `ENGINE START switch ${n}`, start, { initial: 'OFF' });
    }
    text(ig.cx, ig.cy - 40, 'BOTH', { size: 13 });
    toggle('eng.ignition', 'Ignition select switch', [pos('IGN L', 'left'), pos('BOTH', 'center'), pos('IGN R', 'right')], {
      initial: 'BOTH',
      names: { 'IGN L': 'IGN\nL', 'IGN R': 'IGN\nR', BOTH: '' },
    });

    const single = (id: string, name: string, label: string) => {
      const b = box(id);
      text(b.cx, b.cy - 66, name, { size: 13 });
      toggle(id, label, OFF_ON, { labels: 'br' });
    };
    single('ext.logo', 'LOGO', 'LOGO light switch');
    const ps = box('ext.position');
    text(ps.cx, ps.cy - 72, 'POSITION', { size: 13 });
    text(ps.cx, ps.cy - 54, 'STROBE & STEADY', { size: 10 });
    text(ps.cx + 28, ps.cy, 'OFF', { size: 12, anchor: 'start' });
    text(ps.cx, ps.cy + 47, 'STEADY', { size: 13 });
    toggle('ext.position', 'POSITION light switch', [pos('STROBE & STEADY', 'up'), pos('OFF', 'center'), pos('STEADY', 'down')], {
      labels: 'none',
      initial: 'OFF',
    });
    single('ext.antiCollision', 'ANTI\nCOLLISION', 'ANTI COLLISION light switch');
    single('ext.wing', 'WING', 'WING light switch');
    single('ext.wheelWell', 'WHEEL\nWELL', 'WHEEL WELL light switch');
  }


  return { width: W, height: H, plates, lines, texts, gauges, lights, switches };
}
