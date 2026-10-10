import { useMemo } from 'react';
import type { Dir, LightEl, LightLevel, PlateEl, Schematic as SchematicData, SwitchEl, TextEl } from '../data/types';
import { operable, type SimState } from '../sim';

interface Props {
  schematic: SchematicData;
  sim: SimState;
  levels: Record<string, LightLevel>;
  /** Omit to draw a panel that cannot be operated. */
  onOperate?: (id: string) => void;
}

/** Engraved lettering on the grey panels, and the lettering of the label boxes on the cream ones. */
const LEGEND = '#e6dcc2';
const INK = { light: LEGEND, dark: LEGEND, dim: '#a9a391' };
const LAMP = {
  amber: { on: '#ffb000', dim: '#b98420', ink: '#fff0c2' },
  blue: { on: '#4aa8ff', dim: '#3f7fb8', ink: '#e2f1ff' },
  green: { on: '#35d964', dim: '#2f9a4f', ink: '#dcffe6' },
};
const ANGLE: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270, center: 0 };

/** Rough width of a string in the panel typeface; enough to size label boxes and avoid overlaps. */
function textWidth(t: { text: string; size: number }) {
  return t.text.length * t.size * 0.6;
}

function textLeft(t: TextEl) {
  const w = textWidth(t);
  return t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2;
}

function Plate({ plate }: { plate: PlateEl }) {
  const [x, y, w, h] = plate.rect;
  const r = plate.r ?? 14;
  if (plate.tone === 'base') return <rect x={x} y={y} width={w} height={h} fill="#17191b" />;
  if (plate.tone === 'black') {
    return <rect x={x} y={y} width={w} height={h} rx={r} fill="#07080a" stroke="#2b2e31" strokeWidth={3} />;
  }
  const light = plate.tone === 'light';
  return (
    <g>
      <rect x={x + 2} y={y + 4} width={w} height={h} rx={r} fill="#000" opacity={0.45} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#plate-${plate.tone})`} stroke={light ? '#8f8975' : '#2f3337'} strokeWidth={2} />
      <rect
        x={x + 3}
        y={y + 3}
        width={w - 6}
        height={h - 6}
        rx={r - 2}
        fill="none"
        stroke={light ? '#f4eedb' : '#8a9198'}
        strokeOpacity={light ? 0.7 : 0.28}
        strokeWidth={2}
      />
    </g>
  );
}

function Screw({ x, y, light }: { x: number; y: number; light: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y + 1.5} r={11} fill="#000" opacity={0.4} />
      <circle cx={x} cy={y} r={10} fill={light ? 'url(#screw-light)' : 'url(#screw-dark)'} stroke={light ? '#7d7868' : '#1a1c1e'} strokeWidth={1.5} />
      <path
        d={`M${x - 5.5} ${y}H${x + 5.5}M${x} ${y - 5.5}V${y + 5.5}`}
        stroke={light ? '#5f5b4e' : '#0c0d0e'}
        strokeWidth={2.6}
        strokeLinecap="round"
        transform={`rotate(${(x * 7 + y * 3) % 90} ${x} ${y})`}
      />
    </g>
  );
}

function Light({ light, level }: { light: LightEl; level: LightLevel }) {
  const [x, y, w, h] = light.rect;
  const n = light.lines.length;
  const longest = Math.max(...light.lines.map((l) => l.length));
  const size = Math.min((h * 0.74) / n, (w - 12) / (longest * 0.58), 17);
  const lamp = LAMP[light.color];
  return (
    <g className={`lamp lamp-${level}`}>
      {level === 'on' && (
        <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={6} fill={lamp.on} opacity={0.5} filter="url(#glow)" />
      )}
      {/* bezel */}
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={4} fill="#24241f" stroke="#6f6c58" strokeWidth={1.5} />
      {/* glass */}
      <rect x={x + 3.5} y={y + 3.5} width={w - 7} height={h - 7} rx={2.5} fill="url(#glass)" />
      {level !== 'off' && (
        <rect
          x={x + 3.5}
          y={y + 3.5}
          width={w - 7}
          height={h - 7}
          rx={2.5}
          fill={level === 'on' ? lamp.on : lamp.dim}
          opacity={level === 'on' ? 0.62 : 0.16}
        />
      )}
      <rect x={x + 4.5} y={y + 4.5} width={w - 9} height={(h - 9) * 0.42} rx={2} fill="#fff" opacity={level === 'on' ? 0.16 : 0.05} />
      {light.lines.map((row, i) => (
        <text
          key={i}
          x={x + w / 2}
          y={y + h / 2 + (i - (n - 1) / 2) * size * 1.04}
          fontSize={size}
          fill={level === 'on' ? lamp.ink : level === 'dim' ? lamp.dim : '#8d856d'}
        >
          {row}
        </text>
      ))}
    </g>
  );
}

function hexagon(x: number, y: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
  }).join(' ');
}

function Toggle({ sw, dir }: { sw: SwitchEl; dir: Dir }) {
  const { x, y, r } = sw;
  const metal = sw.tone === 'dark';
  const len = r * 1.18;
  const tip = r * 0.34;
  return (
    <g>
      <polygon points={hexagon(x, y + 2, r * 0.82)} fill="#000" opacity={0.45} />
      <polygon points={hexagon(x, y, r * 0.8)} fill="url(#nut)" stroke="#1b1d1f" strokeWidth={1.5} />
      <circle cx={x} cy={y} r={r * 0.52} fill="url(#collar)" stroke="#111" strokeWidth={1.5} />
      <circle cx={x} cy={y} r={r * 0.34} fill="#0b0c0d" />
      {dir === 'center' ? (
        <>
          <circle cx={x + 1.5} cy={y + 3} r={r * 0.46} fill="#000" opacity={0.45} />
          <circle cx={x} cy={y} r={r * 0.44} fill={metal ? 'url(#cap-metal)' : 'url(#cap-white)'} stroke={metal ? '#33373b' : '#9a988c'} strokeWidth={1} />
        </>
      ) : (
        <g transform={`rotate(${ANGLE[dir]} ${x} ${y})`}>
          {/* The lever is drawn pointing up and turned to its position. */}
          <path
            d={`M${x - r * 0.15} ${y} L${x - tip} ${y - len} A${tip} ${tip} 0 0 1 ${x + tip} ${y - len} L${x + r * 0.15} ${y} Z`}
            fill="#000"
            opacity={0.35}
            transform="translate(3 3)"
          />
          <path
            d={`M${x - r * 0.15} ${y} L${x - tip} ${y - len} A${tip} ${tip} 0 0 1 ${x + tip} ${y - len} L${x + r * 0.15} ${y} Z`}
            fill={metal ? 'url(#bat-metal)' : 'url(#bat-white)'}
            stroke={metal ? '#2c3034' : '#8f8d82'}
            strokeWidth={1}
          />
          <ellipse cx={x - tip * 0.3} cy={y - len - tip * 0.25} rx={tip * 0.36} ry={tip * 0.5} fill="#fff" opacity={metal ? 0.35 : 0.75} />
        </g>
      )}
    </g>
  );
}

function Guard({ sw, open }: { sw: SwitchEl; open: boolean }) {
  const { w, h, color } = sw.guard!;
  const x = sw.x - w / 2;
  const y = sw.y - h / 2;
  const tall = h >= w;
  const red = color === 'red';
  // The cover is drawn upright (hinge at the top) and turned for the horizontal guards.
  const cw = tall ? w : h;
  const ch = tall ? h : w;
  const cx = sw.x - cw / 2;
  const cy = sw.y - ch / 2;
  return (
    <g>
      <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={8} fill="#0d0e0f" stroke="#33373a" strokeWidth={1.5} />
      {open ? (
        <>
          <circle cx={sw.x} cy={sw.y} r={Math.min(w, h) * 0.2} fill="url(#cap-metal)" />
          <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={6} fill={red ? '#c9212b' : '#3a3d40'} fillOpacity={0.18} stroke="#ffffff" strokeWidth={3} strokeDasharray="9 6" />
          <text x={sw.x} y={sw.y + (tall ? 0 : h * 0.3)} fontSize={15} fill="#ffffff" transform={tall ? `rotate(-90 ${sw.x} ${sw.y})` : undefined}>
            GUARD OPEN
          </text>
        </>
      ) : (
        <g transform={tall ? undefined : `rotate(-90 ${sw.x} ${sw.y})`}>
          <rect x={cx + 5} y={cy + 6} width={cw - 6} height={ch - 6} rx={9} fill="#000" opacity={0.5} />
          {/* hinge */}
          <rect x={cx + cw * 0.16} y={cy + 2} width={cw * 0.68} height={ch * 0.1} rx={4} fill={red ? '#8e1820' : '#1a1b1d'} />
          <rect x={cx + cw * 0.36} y={cy + 4} width={cw * 0.28} height={ch * 0.07} rx={3} fill="url(#cap-metal)" />
          {/* cover, wider towards the bottom */}
          <path
            d={`M${cx + cw * 0.12} ${cy + ch * 0.09} Q${cx + cw * 0.5} ${cy + ch * 0.15} ${cx + cw * 0.88} ${cy + ch * 0.09} L${cx + cw - 3} ${cy + ch - 10} Q${cx + cw - 3} ${cy + ch - 3} ${cx + cw - 10} ${cy + ch - 3} L${cx + 10} ${cy + ch - 3} Q${cx + 3} ${cy + ch - 3} ${cx + 3} ${cy + ch - 10} Z`}
            fill={red ? 'url(#guard-red)' : 'url(#guard-black)'}
            stroke={red ? '#7c141b' : '#060607'}
            strokeWidth={1.5}
          />
          <path
            d={`M${cx + cw * 0.22} ${cy + ch * 0.2} L${cx + cw * 0.16} ${cy + ch * 0.86}`}
            stroke="#fff"
            strokeOpacity={red ? 0.3 : 0.14}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
    </g>
  );
}

function Knob({ sw, angle }: { sw: SwitchEl; angle: number }) {
  const { x, y, r } = sw;
  return (
    <g>
      {sw.positions?.map((p) => (
        <line
          key={p.id}
          x1={x}
          y1={y - r - 4}
          x2={x}
          y2={y - r - 15}
          stroke={LEGEND}
          strokeWidth={3}
          transform={`rotate(${p.angle ?? 0} ${x} ${y})`}
        />
      ))}
      <circle cx={x + 3} cy={y + 5} r={r} fill="#000" opacity={0.45} />
      <circle cx={x} cy={y} r={r} fill="url(#knob-skirt)" stroke="#77756a" strokeWidth={1.5} />
      <g className="knob-rotor" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${x}px ${y}px` }}>
        {sw.bar ? (
          <>
            <circle cx={x} cy={y} r={r * 0.92} fill="url(#knob-top)" />
            {[-0.2, 0, 0.2].map((o) => (
              <rect key={o} x={x + r * o - r * 0.045} y={y - r * 0.9} width={r * 0.09} height={r * 1.8} rx={2} fill="#17181a" />
            ))}
          </>
        ) : (
          <>
            {/* pointer body: a raised bar, wider at the grip end */}
            <path
              d={`M${x - r * 0.2} ${y - r * 0.98} H${x + r * 0.2} L${x + r * 0.42} ${y + r * 0.62} Q${x} ${y + r * 0.86} ${x - r * 0.42} ${y + r * 0.62} Z`}
              fill="#000"
              opacity={0.3}
              transform="translate(3 3)"
            />
            <path
              d={`M${x - r * 0.2} ${y - r * 0.98} H${x + r * 0.2} L${x + r * 0.42} ${y + r * 0.62} Q${x} ${y + r * 0.86} ${x - r * 0.42} ${y + r * 0.62} Z`}
              fill="url(#knob-top)"
              stroke="#8a887c"
              strokeWidth={1}
            />
            <rect x={x - r * 0.055} y={y - r * 0.94} width={r * 0.11} height={r * 0.95} rx={2} fill="#17181a" />
          </>
        )}
      </g>
    </g>
  );
}

function Switch({ sw, position }: { sw: SwitchEl; position: string | undefined }) {
  const current = sw.positions?.find((p) => p.id === position) ?? sw.positions?.[0];
  if (sw.style === 'guard') return <Guard sw={sw} open={position === 'open'} />;
  if (sw.style === 'knob') return <Knob sw={sw} angle={current?.angle ?? sw.pointer ?? 0} />;
  if (sw.style === 'button') {
    return (
      <g>
        <circle cx={sw.x} cy={sw.y} r={sw.r + 4} fill="url(#collar)" stroke="#111" strokeWidth={1.5} />
        <circle cx={sw.x} cy={sw.y} r={sw.r * 0.78} fill={sw.tone === 'red' ? 'url(#button-red)' : 'url(#button-dark)'} />
      </g>
    );
  }
  return <Toggle sw={sw} dir={current?.dir ?? 'center'} />;
}

/** Corner screws for the larger panels, left out where a corner is occupied. */
function screws(schematic: SchematicData) {
  const blocked: [number, number, number, number][] = [
    ...schematic.lights.map((l) => l.rect),
    ...schematic.switches.map((s): [number, number, number, number] => {
      const w = s.guard?.w ?? s.r * 2.6;
      const h = s.guard?.h ?? s.r * 2.6;
      return [s.x - w / 2, s.y - h / 2, w, h];
    }),
    ...schematic.gauges.map((g): [number, number, number, number] => [g.x - g.r, g.y - g.r, g.r * 2, g.r * 2]),
    ...schematic.texts.map((t): [number, number, number, number] => [textLeft(t), t.y - t.size / 2, textWidth(t), t.size]),
    ...schematic.plates.filter((p) => p.tone === 'black').map((p) => p.rect),
  ];
  const out: { x: number; y: number; light: boolean }[] = [];
  for (const p of schematic.plates) {
    const [x, y, w, h] = p.rect;
    if ((p.tone !== 'dark' && p.tone !== 'light') || w < 180 || h < 100) continue;
    for (const [sx, sy] of [[x + 24, y + 24], [x + w - 24, y + 24], [x + 24, y + h - 24], [x + w - 24, y + h - 24]]) {
      const free = blocked.every(([bx, by, bw, bh]) => sx < bx - 16 || sx > bx + bw + 16 || sy < by - 16 || sy > by + bh + 16);
      // A cream panel lies on a grey one; the grey panel's screws under it are hidden.
      const covered =
        p.tone === 'dark' &&
        schematic.plates.some((q) => q.tone === 'light' && sx > q.rect[0] - 12 && sx < q.rect[0] + q.rect[2] + 12 && sy > q.rect[1] - 12 && sy < q.rect[1] + q.rect[3] + 12);
      if (free && !covered) out.push({ x: sx, y: sy, light: p.tone === 'light' });
    }
  }
  return out;
}

/** The panel drawn from data. Lights take their level from `levels`; operable switches report taps. */
export function Schematic({ schematic, sim, levels, onOperate }: Props) {
  const screwList = useMemo(() => screws(schematic), [schematic]);

  return (
    <svg
      className="schematic"
      viewBox={`0 0 ${schematic.width} ${schematic.height}`}
      role="group"
      aria-label="Schematic of the panel"
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <linearGradient id="plate-dark" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#62686e" />
          <stop offset="1" stopColor="#4c5157" />
        </linearGradient>
        <linearGradient id="plate-light" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#ddd5bf" />
          <stop offset="1" stopColor="#c6bea6" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2620" />
          <stop offset="1" stopColor="#14120f" />
        </linearGradient>
        <radialGradient id="screw-dark" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#5d6368" />
          <stop offset="1" stopColor="#25282b" />
        </radialGradient>
        <radialGradient id="screw-light" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#efe9d8" />
          <stop offset="1" stopColor="#a9a390" />
        </radialGradient>
        <linearGradient id="nut" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9bcbe" />
          <stop offset="0.5" stopColor="#6d7175" />
          <stop offset="1" stopColor="#3c3f42" />
        </linearGradient>
        <radialGradient id="collar" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#4a4e52" />
          <stop offset="1" stopColor="#141516" />
        </radialGradient>
        <linearGradient id="bat-white" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#ecebe4" />
          <stop offset="1" stopColor="#a7a59a" />
        </linearGradient>
        <linearGradient id="bat-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e3e5e6" />
          <stop offset="0.45" stopColor="#8e9296" />
          <stop offset="1" stopColor="#3d4043" />
        </linearGradient>
        <radialGradient id="cap-white" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#e9e7df" />
          <stop offset="1" stopColor="#a09e93" />
        </radialGradient>
        <radialGradient id="cap-metal" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#f0f1f2" />
          <stop offset="0.5" stopColor="#8b8f93" />
          <stop offset="1" stopColor="#2f3235" />
        </radialGradient>
        <linearGradient id="guard-black" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a4c4f" />
          <stop offset="0.25" stopColor="#2c2e30" />
          <stop offset="1" stopColor="#0f1011" />
        </linearGradient>
        <linearGradient id="guard-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f0564f" />
          <stop offset="0.3" stopColor="#d3262c" />
          <stop offset="1" stopColor="#8d1219" />
        </linearGradient>
        <radialGradient id="knob-skirt" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#d8d5c8" />
          <stop offset="1" stopColor="#8f8c80" />
        </radialGradient>
        <linearGradient id="knob-top" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#fbfaf4" />
          <stop offset="0.6" stopColor="#e2dfd2" />
          <stop offset="1" stopColor="#b3b0a2" />
        </linearGradient>
        <radialGradient id="button-dark" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#3b3e41" />
          <stop offset="1" stopColor="#0b0c0d" />
        </radialGradient>
        <radialGradient id="button-red" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ff6b63" />
          <stop offset="1" stopColor="#8d1219" />
        </radialGradient>
        <radialGradient id="bezel" cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#7d848a" />
          <stop offset="1" stopColor="#33373b" />
        </radialGradient>
        <radialGradient id="dial" cx="0.5" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#1b1c1d" />
          <stop offset="1" stopColor="#050506" />
        </radialGradient>
      </defs>

      {schematic.plates.map((p, i) => (
        <Plate key={i} plate={p} />
      ))}

      {screwList.map((s) => (
        <Screw key={`${s.x}-${s.y}`} {...s} />
      ))}

      {schematic.lines.map((l, i) => (
        <polyline
          key={i}
          points={l.points.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={l.tone === 'dark' ? '#1d1c19' : LEGEND}
          strokeWidth={l.tone === 'dark' ? l.width + 3 : l.width}
          strokeLinejoin="miter"
        />
      ))}

      {schematic.gauges.map((g, i) => (
        <g key={i}>
          <circle cx={g.x + 3} cy={g.y + 5} r={g.r + 9} fill="#000" opacity={0.45} />
          <circle cx={g.x} cy={g.y} r={g.r + 9} fill="url(#bezel)" stroke="#1d1f21" strokeWidth={2} />
          <circle cx={g.x} cy={g.y} r={g.r} fill="url(#dial)" stroke="#000" strokeWidth={2} />
          {Array.from({ length: 24 }, (_, t) => (
            <line
              key={t}
              x1={g.x}
              y1={g.y - g.r + 6}
              x2={g.x}
              y2={g.y - g.r + (t % 2 ? 14 : 22)}
              stroke={LEGEND}
              strokeWidth={t % 2 ? 2 : 3.5}
              transform={`rotate(${t * 15} ${g.x} ${g.y})`}
            />
          ))}
          {g.label.map((row, r) => (
            <text key={row} x={g.x} y={g.y + g.r * 0.3 + r * g.r * 0.15} fontSize={Math.max(9, g.r * 0.12)} fill={LEGEND}>
              {row}
            </text>
          ))}
          <path
            d={`M${g.x - g.r * 0.05} ${g.y} L${g.x} ${g.y - g.r * 0.78} L${g.x + g.r * 0.05} ${g.y} Z`}
            fill="#f6f3e8"
            transform={`rotate(${g.needle} ${g.x} ${g.y})`}
          />
          <circle cx={g.x} cy={g.y} r={g.r * 0.2} fill="url(#collar)" stroke="#000" strokeWidth={1} />
        </g>
      ))}

      {/* On the cream panels the lettering sits in black label boxes. */}
      {schematic.texts
        .filter((t) => t.tone === 'dark' && t.text.trim())
        .map((t, i) => (
          <rect
            key={i}
            x={textLeft(t) - 4}
            y={t.y - t.size * 0.56}
            width={textWidth(t) + 8}
            height={t.size * 1.1}
            rx={3}
            fill="#17171a"
          />
        ))}

      {schematic.texts.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={t.y}
          fontSize={t.size}
          fill={INK[t.tone]}
          textAnchor={t.anchor}
          transform={t.rotate ? `rotate(${t.rotate} ${t.x} ${t.y})` : undefined}
        >
          {t.text}
        </text>
      ))}

      {schematic.lights.map((l) => (
        <Light key={l.id} light={l} level={levels[l.id] ?? 'off'} />
      ))}

      {schematic.switches.map((sw) => (
        <Switch key={sw.id} sw={sw} position={sim.pos[sw.id]} />
      ))}

      {onOperate &&
        schematic.switches.filter(operable).map((sw) => {
          const w = Math.max(sw.guard?.w ?? 0, sw.r * 2 + 30);
          const h = Math.max(sw.guard?.h ?? 0, sw.r * 2 + 30);
          return (
            <rect
              key={sw.id}
              className="hit"
              x={sw.x - w / 2}
              y={sw.y - h / 2}
              width={w}
              height={h}
              rx={12}
              role="button"
              tabIndex={0}
              aria-label={`${sw.label}: ${sim.pos[sw.id]}`}
              onClick={() => onOperate(sw.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOperate(sw.id);
                }
              }}
            />
          );
        })}
    </svg>
  );
}
