/* AFT OVERHEAD PANEL, 737 MAX (1F076 - 1F157 layout, as on the reference image).
   Coordinates are pixels of the reference image shown 2000 px wide.
   Behaviour: airplane on the ground, electrical power on, engines shut down. */
import type {
  DisplayEl,
  GaugeEl,
  LightColor,
  LightEl,
  LightLevel,
  LineEl,
  PlateEl,
  Schematic,
  SimView,
  SwitchEl,
  TextEl,
  VirtualEl,
} from '../types';
import { IRS_KEYS, irsKeyboard, type Keyboard } from './irs-keyboard';

export function buildAftOverhead(): Schematic {
  const plates: PlateEl[] = [];
  const texts: TextEl[] = [];
  const lines: LineEl[] = [];
  const gauges: GaugeEl[] = [];
  const lights: LightEl[] = [];
  const switches: SwitchEl[] = [];
  const virtual: VirtualEl[] = [];
  const displays: DisplayEl[] = [];

  const plate = (x: number, y: number, w: number, h: number, tone: PlateEl['tone'] = 'dark', o: Partial<PlateEl> = {}) =>
    plates.push({ rect: [x, y, w, h], tone, ...o });
  // small legends are drawn a little larger than on the airplane so they stay readable on a tablet
  const t = (x: number, y: number, text: string, size = 12, anchor: TextEl['anchor'] = 'middle', o: Partial<TextEl> = {}) =>
    texts.push({ x, y, text, size: size <= 12 ? size + 1.5 : size, anchor, tone: 'light', ...o });
  const ln = (pts: [number, number][], width = 2, tone: LineEl['tone'] = 'light') => lines.push({ points: pts, width, tone });
  const light = (id: string, rect: LightEl['rect'], lines_: string[], color: LightColor, o: Partial<LightEl> = {}) =>
    lights.push({ id, rect, lines: lines_, color, ...o });

  const NP = (page: number, ref: string) => `FCOM ${ref} (PDF page ${page})`;
  const PDF = (page: number) => `FCOM, PDF page ${page}`;

  // ---------------- frame ----------------
  plate(130, 140, 1740, 945, 'base');
  plate(140, 140, 1720, 32, 'dark', { r: 3, screws: false });
  plate(140, 1042, 1720, 40, 'dark', { r: 3, screws: false });

  // blanking plates
  plate(145, 222, 380, 275);
  plate(535, 222, 375, 118);
  plate(145, 500, 380, 64);
  plate(915, 222, 165, 383);
  plate(1468, 222, 387, 146);
  plate(1468, 372, 387, 144);
  plate(1468, 792, 387, 100);
  plate(915, 728, 165, 165);

  // ---------------- ELT ----------------
  plate(140, 568, 385, 142);
  t(328, 590, 'ELT', 17);
  light('elt.light', [217, 621, 68, 36], ['ELT'], 'amber', {
    name: 'ELT light',
    logic: (c) => (c.pos['elt.switch'] === 'ON' ? 'on' : 'off'),
    source: `Illuminated (amber) when the ELT has been activated and is transmitting. ${NP(735, '1.30.9')}`,
  });
  t(372, 597, 'ARM', 12, 'end');
  t(372, 684, 'ON', 12, 'end');
  switches.push({
    id: 'elt.switch',
    label: 'ELT switch',
    style: 'guarded',
    x: 415,
    y: 640,
    r: 26,
    guard: { w: 58, h: 118, color: 'black' },
    positions: [
      { id: 'closed', label: 'ARM, guard closed', dir: 'up' },
      { id: 'open', label: 'ARM, guard open', dir: 'up' },
      { id: 'ON', label: 'ON', dir: 'down' },
    ],
    initial: 'closed',
    desc: [
      ['ARM (guarded position)', 'The ELT transmits automatically when it reaches its preset G-load limit.'],
      ['ON', 'Manually activates the ELT.'],
    ],
    source: `${NP(735, '1.30.9')}. Preflight: ELT … ARM, ELT light extinguished (${NP(147, 'NP.21.9')}).`,
  });

  // ---------------- LE DEVICES ----------------
  plate(140, 714, 385, 178);
  t(328, 733, 'LE DEVICES', 17);
  t(328, 750, 'FLAPS', 11);
  ln([[262, 745], [300, 745]], 1.5);
  ln([[356, 745], [394, 745]], 1.5);
  t(252, 763, '1', 10);
  t(284, 758, '2', 10);
  t(372, 758, '3', 10);
  t(404, 763, '4', 10);
  t(328, 790, 'TRANSIT', 11);
  t(328, 808, 'EXT', 11);
  t(328, 826, 'FULL EXT', 11);
  t(212, 856, 'SLATS', 11);
  t(444, 856, 'SLATS', 11);
  ln([[178, 848], [190, 848]], 1.5);
  ln([[234, 848], [248, 848]], 1.5);
  ln([[408, 848], [420, 848]], 1.5);
  ln([[466, 848], [480, 848]], 1.5);

  const LE_ROWS = ['TRANSIT', 'EXT', 'FULL EXT'];
  const leLevel = (kind: string, row: string) => (c: SimView): LightLevel => {
    const s = c.pos['le.position'];
    if (s === 'TRANSIT') return row === 'TRANSIT' ? 'on' : 'off';
    if (s === 'EXT') return kind === 'slat' ? (row === 'EXT' ? 'on' : 'off') : row === 'FULL EXT' ? 'on' : 'off';
    if (s === 'FULL EXT') return row === 'FULL EXT' ? 'on' : 'off';
    return 'off';
  };
  const leTest = (c: SimView) => Boolean(c.held['le.test']);
  // each wing: 4 slat columns (outboard first) and 2 flap columns, cells drawn as parallelograms
  function wing(side: 'L' | 'R', ox: number, oy: number, nums: number[]) {
    const sx = side === 'L' ? 1 : -1;
    const col = [18.5 * sx, -6.5];
    const row = [0, 21];
    for (let ci = 0; ci < 6; ci++) {
      const kind = ci < 4 ? 'slat' : 'flap';
      const rows = kind === 'slat' ? [0, 1, 2] : [0, 2];
      for (const ri of rows) {
        const p0: [number, number] = [ox + col[0] * ci + row[0] * ri, oy + col[1] * ci + row[1] * ri];
        const cw = [col[0] * 0.84, col[1] * 0.84];
        const rh = [0, row[1] * 0.82];
        const poly: [number, number][] = [p0, [p0[0] + cw[0], p0[1] + cw[1]], [p0[0] + cw[0] + rh[0], p0[1] + cw[1] + rh[1]], [p0[0] + rh[0], p0[1] + rh[1]]];
        const rname = LE_ROWS[ri];
        const n = nums[ci];
        light(`le.${kind}${n}.${rname.replace(' ', '')}`, null, [], rname === 'TRANSIT' ? 'amber' : 'green', {
          poly,
          name: `${kind === 'slat' ? 'Slat' : 'Flap'} ${n} ${rname} light`,
          group: 'le.position',
          logic: leLevel(kind, rname),
          test: leTest,
          bare: false,
        });
      }
    }
  }
  wing('L', 180, 782, [1, 2, 3, 4, 1, 2]);
  wing('R', 476, 782, [8, 7, 6, 5, 4, 3]);
  t(186, 836, '1', 9);
  t(205, 830, '2', 9);
  t(224, 823, '3', 9);
  t(242, 817, '4', 9);
  t(414, 817, '5', 9);
  t(432, 823, '6', 9);
  t(451, 830, '7', 9);
  t(470, 836, '8', 9);
  ln([[312, 846], [306, 846], [306, 884], [312, 884]], 1.5);
  ln([[344, 846], [350, 846], [350, 884], [344, 884]], 1.5);
  switches.push({
    id: 'le.test',
    label: 'LE DEVICES TEST switch',
    style: 'push',
    momentary: true,
    x: 328,
    y: 862,
    r: 11,
    desc: [['Press', 'Tests all annunciator panel lights.']],
    source: NP(1044, '9.10.12'),
  });
  t(328, 888, 'TEST', 10);
  virtual.push({
    id: 'le.position',
    label: 'Leading edge devices',
    region: 'LE DEVICES annunciator panel',
    note: 'The leading edge devices are moved by the flap lever on the control stand, not from this panel. Pick a position to see the annunciator.',
    positions: [
      { id: 'UP', label: 'Retracted' },
      { id: 'TRANSIT', label: 'In transit' },
      { id: 'EXT', label: 'Extended' },
      { id: 'FULL EXT', label: 'Full extended' },
    ],
    initial: 'UP',
    box: [170, 716, 316, 132],
    desc: [
      ['TRANSIT (amber)', 'Related LE device in transit.'],
      ['EXT (green)', 'Related LE slat in the extended (intermediate) position.'],
      ['FULL EXT (green)', 'Related LE device fully extended.'],
      ['No lights', 'Leading edge devices retracted.'],
    ],
    source: `${NP(1044, '9.10.12')}; ${NP(1071, '9.20')}. Simplified: flaps show FULL EXT whenever the slats are extended.`,
  });

  // ---------------- IRS ----------------
  plate(535, 343, 375, 77);
  t(722, 357, 'IRS DISPLAY', 9, 'middle', { tone: 'dim' });
  displays.push({ rect: [575, 364, 130, 46], value: irsText(0) });
  displays.push({ rect: [715, 364, 155, 46], value: irsText(1) });
  plate(535, 422, 168, 214);
  plate(705, 422, 205, 214);
  t(618, 437, 'DSPL SEL', 10);
  ln([[577, 441], [577, 433], [593, 433]], 1.2);
  ln([[643, 433], [661, 433], [661, 441]], 1.2);
  t(567, 485, 'TEST', 9, 'end');
  t(582, 465, 'TK/GS', 9, 'end');
  t(598, 449, 'PPOS', 9);
  t(640, 449, 'WIND', 9);
  t(646, 467, 'HDG/STS', 9, 'start');
  switches.push({
    id: 'irs.dspl',
    label: 'IRS DISPLAY SELECTOR',
    style: 'knob',
    tone: 'dark',
    x: 607,
    y: 488,
    r: 21,
    positions: [
      { id: 'TEST', angle: -95 },
      { id: 'TK/GS', angle: -55 },
      { id: 'PPOS', angle: -15 },
      { id: 'WIND', angle: 25 },
      { id: 'HDG/STS', angle: 65 },
    ],
    initial: 'PPOS',
    desc: [['Positions', 'Selects what the two IRS DISPLAY windows show for the IRS chosen with SYS DSPL.']],
    source: `${NP(1235, '11.10.13')}. The values shown are examples.`,
  });
  t(617, 532, 'SYS DSPL', 10);
  t(604, 546, 'L', 10);
  t(630, 546, 'R', 10);
  ln([[581, 536], [581, 528], [589, 528]], 1.2);
  ln([[645, 528], [653, 528], [653, 536]], 1.2);
  switches.push({
    id: 'irs.sys',
    label: 'IRS SYSTEM DISPLAY selector',
    style: 'knob',
    tone: 'light',
    x: 617,
    y: 580,
    r: 20,
    positions: [
      { id: 'L', angle: -30 },
      { id: 'R', angle: 30 },
    ],
    initial: 'L',
    desc: [['L / R', 'Chooses which IRS the data displays show.']],
    source: NP(1235, '11.10.13'),
  });
  // keyboard
  const keys = [
    ['1', 'N\n2', '3'],
    ['W\n4', 'H\n5', 'E\n6'],
    ['7', 'S\n8', '9'],
    ['ENT', '0', 'CLR'],
  ];
  keys.forEach((row, ri) =>
    row.forEach((k, ci) => {
      const code = IRS_KEYS[k.replace('\n', '')];
      switches.push({
        id: `irs.key.${k.replace('\n', '')}`,
        label: `IRS keyboard ${k.replace('\n', ' / ')} key`,
        style: 'key',
        momentary: true,
        size: 34,
        legend: k,
        x: 770 + ci * 42,
        y: 470 + ri * 40,
        r: 18,
        region: 'IRS keyboard',
        act: (data, v) => ({ ...data, kb: irsKeyboard(data.kb as Keyboard | undefined, code, irsCanAccept(v)) }),
        desc: [
          ['N, S, E, W, H', 'Arm the keyboard: N or S for latitude, E or W for longitude, H for magnetic heading. The entry shows in the display.'],
          ['Numbers', 'Key the value; the last digit is tenths.'],
          ['ENT', 'Enters the value. Present position is accepted while the ALIGN light is illuminated; heading with the selector in ATT. Otherwise CLR illuminates.'],
          ['CLR', 'Clears what has not been entered yet.'],
        ],
        source: NP(1234, '11.10.12') + '; ' + NP(1235, '11.10.13'),
      });
    }),
  );
  // cue lights on ENT and CLR
  light('irs.ent', [753, 590, 34, 7], [], 'white', {
    name: 'ENT key cue lights',
    glyph: 'dots',
    bare: true,
    logic: (c) => ((c.data.kb as Keyboard | undefined)?.field ? 'on' : 'off'),
    source: `Illuminated (white) while N, S, E, W or H entries are being keyed. ${NP(1234, '11.10.12')}`,
  });
  light('irs.clr', [837, 590, 34, 7], [], 'white', {
    name: 'CLR key cue lights',
    glyph: 'dots',
    bare: true,
    logic: (c) => ((c.data.kb as Keyboard | undefined)?.failed ? 'on' : 'off'),
    source: `Illuminated (white) when an ENT attempt has failed (entry not accepted by the IRS). ${NP(1235, '11.10.13')}`,
  });
  // mode selector unit
  plate(535, 640, 375, 252);
  light('irs.gps', [583, 651, 66, 30], ['GPS'], 'amber', { source: `Preflight: GPS light … Extinguished (${NP(147, 'NP.21.9')}). Failures are not simulated.` });
  light('irs.ils', [652, 651, 66, 30], ['ILS'], 'amber', { source: `Preflight: ILS light … Extinguished (${NP(147, 'NP.21.9')}). Failures are not simulated.` });
  light('irs.gls', [721, 651, 66, 30], ['GLS'], 'amber', { source: `Preflight: GLS light … Extinguished (${NP(147, 'NP.21.9')}). Failures are not simulated.` });

  const ALIGN_S = 20; // demo length of an alignment; several minutes on the airplane
  const ATT_S = 8;
  const SHUT_S = 4;
  function irsMode(c: SimView, side: string) {
    return c.pos[`irs.${side}`];
  }
  /** The keyboard accepts present position while the selected IRS aligns, heading while it is in ATT. */
  function irsCanAccept(c: SimView) {
    const side = c.pos['irs.sys'];
    const m = irsMode(c, side);
    return { position: alignLight(side)(c) === 'on' && m !== 'OFF', heading: m === 'ATT' };
  }
  function alignLight(side: string) {
    return (c: SimView): LightLevel => {
      const id = `irs.${side}`;
      const m = irsMode(c, side);
      const since = c.since(id);
      if (m === 'OFF') return c.from(id) && c.from(id) !== 'OFF' && since < SHUT_S ? 'on' : 'off';
      if (m === 'ALIGN') return 'on';
      if (m === 'NAV') return c.from(id) === 'ALIGN' || c.from(id) === 'OFF' ? (since < ALIGN_S ? 'on' : 'off') : 'off';
      if (m === 'ATT') return since < ATT_S ? 'on' : 'off';
      return 'off';
    };
  }
  function onDcLight(side: string) {
    return (c: SimView): LightLevel => {
      const id = `irs.${side}`;
      const m = irsMode(c, side);
      return m !== 'OFF' && c.from(id) === 'OFF' && c.since(id) < 3 ? 'on' : 'off';
    };
  }
  function irsText(win: number) {
    return (c: SimView): string => {
      const kb = c.data.kb as Keyboard | undefined;
      if (kb?.field === 'lat' && win === 0) return kb.prefix + kb.digits;
      if (kb?.field === 'lon' && win === 1) return kb.prefix + kb.digits;
      if (kb?.field === 'hdg' && win === 0) return 'H' + kb.digits;
      const side = c.pos['irs.sys'];
      const m = c.pos[`irs.${side}`];
      if (m === 'OFF') return '';
      const sel = c.pos['irs.dspl'];
      if (sel === 'TEST') return '8888888';
      const aligned = m === 'NAV' && alignLight(side)(c) === 'off';
      const entered = (c.data.kb as Keyboard | undefined)?.entered;
      if (sel === 'PPOS') return win === 0 ? (entered?.lat ?? 'N47324') : (entered?.lon ?? 'W122123');
      if (sel === 'TK/GS') return aligned ? (win === 0 ? '0000' : '0') : '';
      if (sel === 'WIND') return '';
      if (sel === 'HDG/STS') return win === 0 ? (aligned ? (entered?.hdg ?? '0315') : '') : m === 'ALIGN' || !aligned ? String(Math.max(0, Math.ceil((ALIGN_S - c.since(`irs.${side}`)) / 2))).padStart(2, '0') : '';
      return '';
    };
  }

  for (const [side, x0] of [
    ['L', 568],
    ['R', 740],
  ] as const) {
    const name = side === 'L' ? 'left' : 'right';
    light(`irs.${side}.align`, [x0, 705, 62, 30], ['ALIGN'], 'white', {
      name: `ALIGN light (${name} IRS)`,
      logic: alignLight(side),
      source: `Illuminated (white), steady: the IRS is in the ALIGN mode, the initial ATT mode, or the shutdown cycle. Flashing: alignment cannot be completed (not simulated). ${NP(1236, '11.10.14')}. Alignment is shortened to ${ALIGN_S} s here; on the airplane it takes several minutes.`,
    });
    light(`irs.${side}.ondc`, [x0 + 66, 705, 62, 30], ['ON DC'], 'amber', {
      name: `ON DC light (${name} IRS)`,
      logic: onDcLight(side),
      source: `Illuminated (amber): the IRS is operating on DC power from the switched hot battery bus. At the start of an alignment both ON DC lights illuminate momentarily (${NP(147, 'NP.21.9')}; ${NP(1237, '11.10.15')}).`,
    });
    light(`irs.${side}.fault`, [x0, 738, 62, 30], ['FAULT'], 'amber', {
      name: `FAULT light (${name} IRS)`,
      source: `Illuminated (amber): a system fault affecting the related IRS ATT and/or NAV modes has been detected. ${NP(1236, '11.10.14')}. Faults are not simulated.`,
    });
    light(`irs.${side}.dcfail`, [x0 + 66, 738, 62, 30], ['DC FAIL'], 'amber', {
      name: `DC FAIL light (${name} IRS)`,
      source: `Illuminated (amber): DC power for the related IRS is abnormal. ${NP(1237, '11.10.15')}. Not simulated.`,
    });
    const kx = side === 'L' ? 630 : 810;
    t(kx - 56, 822, 'OFF', 10);
    t(kx - 34, 800, 'ALIGN', 10);
    t(kx + 28, 800, 'NAV', 10);
    t(kx + 60, 822, 'ATT', 10);
    switches.push({
      id: `irs.${side}`,
      label: `IRS MODE SELECTOR (${side})`,
      style: 'knob',
      tone: 'light',
      x: kx,
      y: 850,
      r: 27,
      positions: [
        { id: 'OFF', angle: -62 },
        { id: 'ALIGN', angle: -32 },
        { id: 'NAV', angle: 28 },
        { id: 'ATT', angle: 62 },
      ],
      initial: 'OFF',
      desc: [
        ['OFF', 'Alignment is lost; all electrical power is removed from the system after a short shutdown cycle.'],
        ['ALIGN', 'From OFF, starts the alignment cycle. From NAV, updates the alignment and corrects ground speed error.'],
        ['NAV (detented)', 'The system enters NAV mode after alignment and entry of present position.'],
        ['ATT', 'Attitude and heading reference only; attitude is invalid until the ALIGN light extinguishes.'],
      ],
      source: `${NP(1237, '11.10.15')}. Preflight: IRS MODE SELECTORS … NAV; both ON DC lights illuminate momentarily, then the ALIGN lights stay illuminated until NAV mode (${NP(147, 'NP.21.9')}).`,
    });
  }
  t(670, 888, 'L', 12);
  t(720, 888, 'IRS', 13);
  t(770, 888, 'R', 12);

  // ---------------- SERVICE INTERPHONE ----------------
  plate(915, 608, 165, 118, 'black');
  t(997, 624, 'SERVICE', 11);
  t(997, 638, 'INTERPHONE', 11);
  t(997, 652, 'OFF', 9);
  t(997, 716, 'ON', 11);
  switches.push({
    id: 'svcInt',
    label: 'SERVICE INTERPHONE switch',
    style: 'toggle',
    tone: 'light',
    x: 997,
    y: 680,
    r: 19,
    positions: [
      { id: 'OFF', dir: 'up' },
      { id: 'ON', dir: 'down' },
    ],
    initial: 'OFF',
    desc: [
      ['OFF', 'External jacks are deactivated; flight deck and flight attendants can still talk.'],
      ['ON', 'Adds the external jacks to the service interphone system.'],
    ],
    source: `${NP(916, '5.10.10')}. Preflight: SERVICE INTERPHONE switch … As required (${NP(147, 'NP.21.9')}).`,
  });
  // stowed handle in the centre column
  plate(985, 444, 26, 118, 'black', { r: 5 });

  // ---------------- AUDIO CONTROL PANEL ----------------
  plate(1085, 220, 377, 298);
  const TX = ['VHF1', 'VHF2', 'VHF3', 'HF1', 'HF2', 'INT', 'CABIN', 'PA'];
  TX.forEach((n, i) => {
    const x = 1117 + i * 40.5;
    t(x + 15, 232, n, 10);
    light(`acp.mic.${n}`, [x + 3, 244, 24, 26], [], 'white', {
      name: `${n} transmitter selector MIC light`,
      glyph: 'bars',
      bare: true,
      logic: (c) => (c.pos['acp.tx'] === n ? 'on' : 'off'),
      source: 'Shows which transmitter is selected. Simplified for this preview.',
    });
    switches.push({ id: `acp.tx.${n}`, label: `${n} transmitter selector`, style: 'select', group: 'acp.tx', value: n, hit: [x, 240, 30, 56], x: x + 15, y: 268, r: 16, region: 'Audio control panel' });
    light(`acp.call.${n}`, [x + 5, 279, 20, 12], ['C'], 'white', {
      name: `${n} CALL light`,
      bare: true,
      region: 'Audio control panel',
      source: 'Illuminates for an incoming call on that system (not simulated; tap to preview).',
    });
  });
  for (const [n, x] of [
    ['SAT1', 1318],
    ['SAT2', 1358],
  ] as const) {
    switches.push({ id: `acp.tx.${n}`, label: `${n.replace('SAT', 'SAT ')} microphone selector`, style: 'select', group: 'acp.tx', value: n, hit: [x, 440, 30, 48], x: x + 15, y: 464, r: 16, region: 'Audio control panel' });
    light(`acp.call.${n}`, [x + 5, 470, 20, 12], ['CALL'], 'white', {
      name: `${n.replace('SAT', 'SAT ')} CALL light`,
      bare: true,
      region: 'Audio control panel',
      logic: (c) => (c.pos['acp.satCall'] === n ? 'on' : 'off'),
      source: `Incoming SATCOM calls illuminate the CALL light; it extinguishes when the call is terminated. ${PDF(935)}`,
    });
    light(`acp.mic.${n}`, [x + 4, 446, 22, 20], [], 'white', {
      name: `${n.replace('SAT', 'SAT ')} MIC light`,
      glyph: 'bars',
      bare: true,
      logic: (c) => (c.pos['acp.tx'] === n ? 'on' : 'off'),
    });
  }
  virtual.push({
    id: 'acp.satCall',
    label: 'Incoming SATCOM call',
    region: 'Audio control panel',
    note: 'Calls come from outside the airplane. Pick one to see its CALL light; the SAT switch beside it ends the call.',
    positions: [{ id: 'NONE', label: 'No call' }, { id: 'SAT1', label: 'Call on SAT 1' }, { id: 'SAT2', label: 'Call on SAT 2' }],
    initial: 'NONE',
    box: [1280, 430, 160, 70],
    source: PDF(935),
  });
  virtual.push({
    id: 'acp.tx',
    label: 'Transmitter selector',
    region: 'Audio control panel',
    positions: [...TX, 'SAT1', 'SAT2'].map((n) => ({ id: n })),
    initial: 'VHF1',
    box: [1095, 225, 357, 75],
    note: 'One transmitter is selected at a time. Tap a selector on the panel or pick one here.',
    source: `Audio control panel, ${NP(905, '5.10')}. Simplified.`,
  });
  const RX1 = TX;
  const RX2 = ['NAV1', 'NAV2', 'ADF1', 'ADF2', 'MKR', 'SAT1', 'SAT2', 'SPKR'];
  [RX1, RX2].forEach((row, ri) =>
    row.forEach((n, i) => {
      const x = 1132 + i * 40.5;
      const y = ri ? 395 : 335;
      const id = `acp.rx.${ri}.${n}`;
      light(`${id}.dot`, [x - 4, y - 28, 8, 8], [], 'green', {
        name: `${n} receiver light`,
        dot: true,
        logic: (c) => (c.pos[id] && c.pos[id] !== 'OFF' ? 'on' : 'off'),
        source: 'Receiver switch selected on (pulled out). Simplified for this preview.',
      });
      switches.push({
        id,
        label: `${n} receiver switch`,
        style: 'knob',
        tone: 'light',
        x,
        y,
        r: 14,
        pulled: ['LOW', 'MID', 'HIGH'],
        positions: [
          { id: 'OFF', label: 'Off (pushed in)', angle: -135 },
          { id: 'LOW', label: 'On, volume low', angle: -95 },
          { id: 'MID', label: 'On, volume medium', angle: -15 },
          { id: 'HIGH', label: 'On, volume high', angle: 65 },
        ],
        initial: ri === 0 && n === 'VHF1' ? 'MID' : 'OFF',
        region: 'Audio control panel',
        desc: [['Push / rotate', 'Push to turn the receiver on or off; rotate to set its volume.']],
      });
    }),
  );
  t(1152, 425, '1-NAV-2', 9);
  t(1233, 425, '1-ADF-2', 9);
  t(1294, 425, 'MKR', 9);
  t(1416, 425, 'SPKR', 9);
  t(1140, 440, 'RADIO', 9);
  t(1140, 502, 'INT', 9);
  switches.push({
    id: 'acp.ptt',
    label: 'Push-to-talk switch',
    style: 'toggle',
    tone: 'light',
    x: 1140,
    y: 470,
    r: 15,
    positions: [
      { id: 'RADIO', dir: 'up' },
      { id: 'OFF', label: 'Neutral', dir: 'center' },
      { id: 'INT', dir: 'down' },
    ],
    initial: 'OFF',
    region: 'Audio control panel',
    desc: [['RADIO / INT', 'Keys the selected transmitter (RADIO) or the flight interphone (INT). Simplified.']],
  });
  t(1177, 438, 'V', 9);
  t(1194, 432, 'B', 9);
  t(1212, 438, 'R', 9);
  switches.push({
    id: 'acp.filter',
    label: 'Filter selector',
    style: 'knob',
    tone: 'light',
    x: 1195,
    y: 470,
    r: 20,
    positions: [
      { id: 'V', label: 'V (voice)', angle: -40 },
      { id: 'B', label: 'B (both)', angle: 0 },
      { id: 'R', label: 'R (range)', angle: 40 },
    ],
    initial: 'B',
    region: 'Audio control panel',
  });
  t(1250, 440, 'ALT', 9);
  t(1250, 508, 'NORM', 9);
  switches.push({ id: 'acp.alt', label: 'ALT-NORM switch', style: 'button', x: 1250, y: 470, r: 19, positions: [{ id: 'NORM' }, { id: 'ALT' }], latched: ['ALT'], initial: 'NORM', region: 'Audio control panel', desc: [['ALT', 'Degraded (alternate) audio mode. Simplified.']] });
  for (const [n, x] of [
    ['SAT1', 1294],
    ['SAT2', 1418],
  ] as const) {
    t(x, 444, n.replace('SAT', 'SAT '), 8);
    switches.push({
      id: `acp.sat.${n}`,
      label: `${n.replace('SAT', 'SAT ')} switch`,
      style: 'push',
      momentary: true,
      x,
      y: 470,
      r: 13,
      region: 'Audio control panel',
      // ends a call on that system
      act: (data, v) => (v.pos['acp.satCall'] === n ? { ...data, _set: { 'acp.satCall': 'NONE' } } : data),
      desc: [['Push', 'Terminates the SATCOM call connection.']],
      source: PDF(913),
    });
  }
  plate(1310, 500, 86, 14, 'black', { r: 3 });
  t(1353, 511, 'SAT CALL', 8, 'middle', { tone: 'dim' });

  // ---------------- ENGINE ----------------
  plate(1085, 520, 357, 172);
  plate(1105, 522, 337, 64, 'dark', { screws: false });
  ln([[1135, 572], [1175, 572]], 1.5);
  ln([[1192, 572], [1238, 572]], 1.5);
  ln([[1306, 572], [1352, 572]], 1.5);
  ln([[1370, 572], [1410, 572]], 1.5);
  t(1272, 577, 'ENGINE', 13);
  t(1184, 577, '1', 12);
  t(1361, 577, '2', 12);
  light('eng.revCmd', [1209, 528, 62, 30], ['REVERSER', 'COMMAND'], 'amber', {
    source: `Illuminated (amber): the reverse thrust lever is not in the down position in flight. ${NP(986, '7.10.12')}. Preflight: extinguished (${NP(146, 'NP.21.8')}).`,
  });
  light('eng.revAirGnd', [1274, 528, 62, 30], ['REVERSER', 'AIR/GND'], 'amber', {
    source: `Illuminated (amber): the air/ground thrust reverser logic has failed. ${NP(986, '7.10.12')}. Preflight: extinguished (${NP(146, 'NP.21.8')}).`,
  });
  for (const [n, lx, ex] of [
    [1, 1123, 1196],
    [2, 1364, 1285],
  ]) {
    light(`eng${n}.revLimited`, [lx, 597, 62, 30], ['REVERSER', 'LIMITED'], 'amber', {
      name: `REVERSER LIMITED light (engine ${n})`,
      source: `Illuminated (amber): a fault in the thrust reverser system; in flight it limits reverse thrust. ${NP(986, '7.10.12')}. Preflight: extinguished (${NP(146, 'NP.21.8')}).`,
    });
    light(`eng${n}.control`, [lx, 630, 62, 30], ['ENGINE', 'CONTROL'], 'amber', {
      name: `ENGINE CONTROL light (engine ${n})`,
      source: `Illuminated (amber): the engine control system is not dispatchable due to faults in the system. ${NP(986, '7.10.12')}. Preflight: extinguished (${NP(146, 'NP.21.8')}).`,
    });
    t(ex + 35, 597, 'EEC', 10);
    plate(ex + 2, 606, 66, 74, 'black', { r: 4 });
    light(`eng${n}.eecOn`, [ex + 6, 611, 58, 30], ['ON'], 'white', {
      name: `EEC ON (engine ${n})`,
      logic: (c) => (c.pos[`eec${n}`] === 'ON' ? 'on' : 'off'),
      source: `ON in view (white): the normal control mode is selected. ${NP(987, '7.10.13')}.`,
    });
    light(`eng${n}.eecAltn`, [ex + 6, 645, 58, 30], ['ALTN'], 'amber', {
      name: `EEC ALTN (engine ${n})`,
      logic: (c) => (c.pos[`eec${n}`] === 'ALTN' ? 'on' : 'off'),
      source: `Illuminated (amber): the EEC is in the alternate mode. Preflight: EEC switches ON, ALTERNATE lights extinguished (${NP(146, 'NP.21.8')}).`,
    });
    switches.push({
      id: `eec${n}`,
      label: `EEC switch (engine ${n})`,
      style: 'switchlight',
      x: ex + 35,
      y: 643,
      r: 34,
      hit: [ex + 2, 606, 66, 74],
      positions: [{ id: 'ON' }, { id: 'ALTN' }],
      initial: 'ON',
      region: 'ENGINE panel',
      desc: [
        ['ON', 'Normal control mode: engine ratings are calculated by the EEC from sensed conditions and bleed air demand.'],
        ['ALTN', 'Push to select the alternate mode manually.'],
      ],
      source: `${NP(987, '7.10.13')}. Preflight: EEC switches … ON (${NP(146, 'NP.21.8')}).`,
    });
  }

  // ---------------- OXYGEN ----------------
  plate(1085, 695, 190, 197);
  plate(1275, 695, 167, 197);
  t(1203, 714, 'CREW', 14);
  t(1203, 730, 'OXYGEN', 14);
  ln([[1278, 703], [1278, 730]], 2);
  gauges.push({
    x: 1196,
    y: 812,
    r: 66,
    label: ['OXY. PRESS.', 'PSI X 100'],
    labelAt: 0.5,
    hub: 0.28,
    needle: 107,
    scale: { start: -120, end: 120, major: 5, minor: 4, numbers: ['0', '5', '10', '15', '20'] },
  });
  t(1355, 714, 'PASS OXYGEN', 14);
  t(1338, 768, 'NORMAL', 11);
  t(1352, 828, 'ON', 11);
  light('passOxy.on', [1288, 845, 66, 34], ['PASS OXY', 'ON'], 'amber', {
    name: 'PASS OXY ON light',
    logic: (c) => (c.pos.passOxy === 'ON' ? 'on' : 'off'),
    source: `Illuminated (amber): the passenger oxygen system is operating and the masks have dropped. ${NP(741, '1.40')}. Preflight: extinguished (${NP(147, 'NP.21.9')}).`,
  });
  switches.push({
    id: 'passOxy',
    label: 'PASSENGER OXYGEN switch',
    style: 'guarded',
    x: 1397,
    y: 790,
    r: 22,
    guard: { w: 50, h: 108, color: 'black' },
    positions: [
      { id: 'closed', label: 'NORMAL, guard closed', dir: 'up' },
      { id: 'open', label: 'NORMAL, guard open', dir: 'up' },
      { id: 'ON', label: 'ON', dir: 'down' },
    ],
    initial: 'closed',
    caution: 'Switch activation will cause deployment of passenger oxygen masks.',
    desc: [
      ['NORMAL (guarded)', 'The system activates automatically at a cabin altitude of 14,000 feet.'],
      ['ON', 'Activates the system and drops the masks; the PASS OXY ON light illuminates.'],
    ],
    source: `${NP(766, '1.40')}. Preflight: PASSENGER OXYGEN switch – Guard closed; PASS OXY ON light extinguished (${NP(147, 'NP.21.9')}).`,
  });

  // ---------------- FLIGHT RECORDER / MACH AIRSPEED WARNING ----------------
  plate(1468, 520, 387, 148);
  plate(1490, 523, 342, 76, 'black');
  t(1578, 555, 'FLIGHT RECORDER', 15);
  t(1518, 590, 'TEST', 11);
  t(1596, 590, 'NORMAL', 11);
  ln([[1708, 530], [1708, 594]], 2);
  t(1770, 538, 'MACH', 13);
  t(1770, 553, 'AIRSPEED', 13);
  t(1770, 568, 'WARNING', 13);
  t(1775, 581, 'TEST', 9);
  t(1746, 594, 'NO. 1', 9);
  t(1805, 594, 'NO. 2', 9);
  light('fltRec.off', [1650, 603, 58, 30], ['OFF'], 'amber', {
    name: 'FLIGHT RECORDER OFF light',
    logic: (c) => (c.pos.fltRec === 'TEST' ? 'off' : 'on'),
    source: `On the ground with engines shut down the OFF light is illuminated; with the test switch in TEST it extinguishes (${NP(146, 'NP.21.8')}).`,
  });
  switches.push({
    id: 'fltRec',
    label: 'FLIGHT RECORDER test switch',
    style: 'guarded',
    x: 1570,
    y: 618,
    r: 18,
    guard: { w: 146, h: 40, color: 'black' },
    positions: [
      { id: 'closed', label: 'NORMAL, guard closed', dir: 'right' },
      { id: 'open', label: 'NORMAL, guard open', dir: 'right' },
      { id: 'TEST', label: 'TEST', dir: 'left' },
    ],
    initial: 'closed',
    caution: 'This switch should not be confused with the Passenger Oxygen Switch, as this will cause deployment of the Passenger Oxygen System.',
    desc: [
      ['Preflight', 'FLIGHT RECORDER … Test, guard closed: OFF light illuminated; switch to TEST, OFF light extinguishes; switch back to NORMAL.'],
    ],
    source: NP(146, 'NP.21.8'),
  });
  for (const [n, x] of [
    [1, 1747],
    [2, 1806],
  ])
    switches.push({
      id: `mach${n}`,
      label: `MACH AIRSPEED WARNING TEST switch NO. ${n}`,
      style: 'push',
      momentary: true,
      x,
      y: 620,
      r: 12,
      effect: { sound: 'clacker', message: `Clacker sounding: mach/airspeed warning system ${n} test` },
      desc: [['Push', 'Tests the respective mach/airspeed warning system: the clacker sounds. Inhibited while airborne.']],
      source: `${NP(1672, '15.10.4')}. Preflight: push, one at a time; verify that the clacker sounds (${NP(146, 'NP.21.8')}).`,
    });

  // ---------------- STALL WARNING TEST ----------------
  plate(1468, 670, 387, 120);
  plate(1528, 703, 268, 38, 'black');
  t(1662, 718, 'STALL WARNING TEST', 15);
  t(1593, 734, 'NO. 1', 10);
  t(1730, 734, 'NO. 2', 10);
  for (const [n, x] of [
    [1, 1593],
    [2, 1730],
  ])
    switches.push({
      id: `stall${n}`,
      label: `STALL WARNING TEST switch NO. ${n}`,
      style: 'push',
      momentary: true,
      x,
      y: 765,
      r: 14,
      effect: { sound: 'shaker', message: `Stick shaker: ${n === 1 ? "Captain's" : "First Officer's"} control column vibrates (SMYD ${n} test)` },
      desc: [['Push and hold', `Tests SMYD computer ${n}, which shakes the ${n === 1 ? "Captain's" : "First Officer's"} control column; vibrations can be felt on both columns. Needs AC power; inhibited while airborne.`]],
      caution: 'With hydraulic power off, the leading edge flaps may droop enough to cause an asymmetry signal and fail the test.',
      source: `${NP(1672, '15.10.4')}; preflight note on ${NP(146, 'NP.21.8')}.`,
    });

  // ---------------- bottom row ----------------
  plate(236, 897, 1525, 142);
  ln([[492, 904], [492, 1034]], 2, 'shadow');
  ln([[924, 904], [924, 1034]], 2, 'shadow');
  ln([[1073, 904], [1073, 1034]], 2, 'shadow');
  t(325, 919, 'ELEVATOR JAM', 15);
  t(323, 936, 'LANDING ASSIST', 15);
  t(462, 919, 'OFF', 11, 'start');
  t(462, 987, 'ON', 11, 'start');
  light('elevJam.assistOn', [289, 951, 68, 36], ['ASSIST ON'], 'amber', {
    name: 'ASSIST ON light',
    logic: (c) => (c.pos.elevJam === 'ON' ? 'on' : 'off'),
    source: `Illuminated (amber): the Elevator Jam Landing Assist function is activated. ${NP(1036, '9.10.4')}. Simplified: illuminates with the switch ON (the function also needs flaps 1 or greater and the autopilot disengaged).`,
  });
  switches.push({
    id: 'elevJam',
    label: 'ELEVATOR JAM LANDING ASSIST switch',
    style: 'guarded',
    x: 422,
    y: 968,
    r: 22,
    guard: { w: 52, h: 108, color: 'black' },
    positions: [
      { id: 'closed', label: 'OFF, guard closed', dir: 'up' },
      { id: 'open', label: 'OFF, guard open', dir: 'up' },
      { id: 'ON', label: 'ON', dir: 'down' },
    ],
    initial: 'closed',
    desc: [
      ['OFF (guarded)', 'Normal operating position.'],
      ['ON', 'Activates the Elevator Jam Landing Assist function when flaps are 1 or greater and the autopilot is disengaged.'],
    ],
    source: `${NP(1036, '9.10.4')}. Preflight: switch guard closed, ASSIST ON light extinguished (${NP(148, 'NP.21.10')}).`,
  });
  light('maint', [512, 966, 68, 36], ['MAINT'], 'amber', {
    name: 'MAINT light',
    source: `Illuminated (amber) when designated faults are detected; the OVERHEAD annunciator and MASTER CAUTION illuminate too. Preflight: extinguished (${NP(147, 'NP.21.9')}). Faults are not simulated.`,
  });
  t(995, 922, 'DOME WHITE', 15);
  t(995, 940, 'DIM', 11);
  t(1036, 972, 'OFF', 11, 'start');
  t(995, 1012, 'BRIGHT', 11);
  switches.push({
    id: 'dome',
    label: 'DOME WHITE light control',
    style: 'toggle',
    tone: 'light',
    x: 995,
    y: 968,
    r: 18,
    positions: [
      { id: 'DIM', dir: 'up' },
      { id: 'OFF', dir: 'center' },
      { id: 'BRIGHT', dir: 'down' },
    ],
    initial: 'OFF',
    desc: [
      ['DIM', 'Sets the overhead dome lights to low brightness.'],
      ['OFF', 'Overhead dome lights extinguished.'],
      ['BRIGHT', 'Sets the overhead dome lights to full brightness.'],
    ],
    source: NP(730, '1.30.4'),
  });
  for (const [id, rect, txt] of [
    ['gear.left', [1124, 928, 68, 32], ['LEFT', 'GEAR']],
    ['gear.right', [1204, 928, 68, 32], ['RIGHT', 'GEAR']],
    ['gear.nose', [1164, 966, 68, 32], ['NOSE', 'GEAR']],
  ] as [string, [number, number, number, number], string[]][])
    light(id, rect, txt, 'green', {
      name: `${txt.join(' ')} light`,
      region: 'Landing gear indicator lights',
      base: 'on',
      source: `Illuminated (green): related gear down and locked. A redundant, separate set of the landing gear indicator lights. ${NP(1651, '14.10.3')}. On the ground the gear is down and locked.`,
    });
  // index-to-lock latches
  for (const x of [138, 1768]) {
    plate(x, 958, 90, 78, 'black');
    t(x + 18, 997, 'INDEX', 8, 'middle', { rotate: 90 });
    t(x + 72, 997, 'TO LOCK', 8, 'middle', { rotate: 90 });
    plate(x + 40, 965, 10, 64, 'dark', { r: 2, screws: false });
    switches.push({ id: `latch${x}`, label: '', style: 'knob', tone: 'dark', x: x + 45, y: 997, r: 11, pointer: 0, bar: true });
  }

  return {
    width: 1740,
    height: 945,
    view: [130, 140, 1740, 945],
    plates,
    lines,
    texts,
    gauges,
    lights,
    switches,
    virtual,
    displays,
    regions: REGIONS,
    flood: (v) => (v.pos.dome === 'BRIGHT' ? 0.34 : v.pos.dome === 'DIM' ? 0.16 : 0),
    timed: (v) => ['L', 'R'].some((side) => v.since(`irs.${side}`) < ALIGN_S + 1),
  };
}

const REGIONS: Schematic['regions'] = [
  { label: 'ELT', rect: [140, 568, 385, 142] },
  { label: 'LE DEVICES annunciator panel', rect: [140, 714, 385, 178] },
  { label: 'IRS display and keyboard', rect: [535, 343, 375, 293] },
  { label: 'IRS mode selector unit', rect: [535, 640, 375, 252] },
  { label: 'SERVICE INTERPHONE', rect: [915, 608, 165, 118] },
  { label: 'Audio control panel', rect: [1085, 220, 377, 298] },
  { label: 'ENGINE panel', rect: [1085, 520, 357, 172] },
  { label: 'Oxygen panel', rect: [1085, 695, 357, 197] },
  { label: 'FLIGHT RECORDER', rect: [1468, 520, 240, 148] },
  { label: 'MACH AIRSPEED WARNING TEST', rect: [1708, 520, 147, 148] },
  { label: 'STALL WARNING TEST', rect: [1468, 670, 387, 120] },
  { label: 'ELEVATOR JAM LANDING ASSIST', rect: [236, 897, 256, 142] },
  { label: 'DOME WHITE', rect: [924, 897, 149, 142] },
  { label: 'Landing gear indicator lights', rect: [1073, 897, 220, 142] },
];
