import type { Dir, LightEl, LightLevel, Schematic as SchematicData, SwitchEl } from '../data/types';
import { operable, type SimState } from '../sim';

interface Props {
  schematic: SchematicData;
  sim: SimState;
  levels: Record<string, LightLevel>;
  /** Omit to draw a panel that cannot be operated. */
  onOperate?: (id: string) => void;
}

const PLATE = {
  base: { fill: '#0a0d10', stroke: 'none' },
  dark: { fill: '#2b3640', stroke: '#141a1f' },
  light: { fill: '#b9bdb6', stroke: '#6d726c' },
  black: { fill: '#05070a', stroke: '#3a444d' },
};
const INK = { light: '#e9eef2', dark: '#161b20', dim: '#8b98a5' };
const LAMP = {
  amber: { on: '#ffb400', dim: '#b07a12' },
  blue: { on: '#63b8ff', dim: '#3c76ad' },
  green: { on: '#45e070', dim: '#2c8f49' },
};
const VECTOR: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  center: [0, 0],
};

function Light({ light, level }: { light: LightEl; level: LightLevel }) {
  const [x, y, w, h] = light.rect;
  const n = light.lines.length;
  const longest = Math.max(...light.lines.map((l) => l.length));
  const size = Math.min((h * 0.8) / n, (w - 8) / (longest * 0.6), 17);
  const lit = level !== 'off';
  const color = lit ? LAMP[light.color][level] : '#5d6a76';
  return (
    <g className={`lamp lamp-${level}`}>
      {level === 'on' && (
        <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={5} fill={color} opacity={0.35} filter="url(#glow)" />
      )}
      <rect
        x={x + 1.5}
        y={y + 1.5}
        width={w - 3}
        height={h - 3}
        rx={3}
        fill="#090c0f"
        stroke={lit ? color : '#39434c'}
        strokeWidth={level === 'on' ? 3 : 2}
      />
      {lit && (
        <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={2} fill={color} opacity={level === 'on' ? 0.3 : 0.1} />
      )}
      {light.lines.map((row, i) => (
        <text
          key={i}
          x={x + w / 2}
          y={y + h / 2 + (i - (n - 1) / 2) * size * 1.05}
          fontSize={size}
          fill={level === 'on' ? lightInk(light.color) : color}
        >
          {row}
        </text>
      ))}
    </g>
  );
}

function lightInk(color: LightEl['color']) {
  return color === 'amber' ? '#ffd76a' : color === 'blue' ? '#bfe2ff' : '#b4ffc8';
}

function Toggle({ sw, dir }: { sw: SwitchEl; dir: Dir }) {
  const [dx, dy] = VECTOR[dir];
  const len = sw.r * 1.12;
  const lever = sw.tone === 'dark' ? '#565f68' : '#f2f4f5';
  return (
    <g>
      <circle cx={sw.x} cy={sw.y} r={sw.r * 0.7} fill="#12171b" stroke="#69747e" strokeWidth={3} />
      <circle cx={sw.x} cy={sw.y} r={sw.r * 0.36} fill="#2a3138" />
      {dir === 'center' ? (
        <circle cx={sw.x} cy={sw.y} r={sw.r * 0.4} fill={lever} stroke="#8d969e" strokeWidth={2} />
      ) : (
        <>
          <line
            x1={sw.x}
            y1={sw.y}
            x2={sw.x + dx * len}
            y2={sw.y + dy * len}
            stroke={lever}
            strokeWidth={sw.r * 0.44}
            strokeLinecap="round"
          />
          <circle cx={sw.x + dx * len} cy={sw.y + dy * len} r={sw.r * 0.3} fill="#ffffff" opacity={0.85} />
        </>
      )}
    </g>
  );
}

function Guard({ sw, open }: { sw: SwitchEl; open: boolean }) {
  const { w, h, color } = sw.guard!;
  const x = sw.x - w / 2;
  const y = sw.y - h / 2;
  const fill = color === 'red' ? '#c4202b' : '#0b0d0f';
  const edge = color === 'red' ? '#ff6a70' : '#59636d';
  const tall = h >= w;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} fill="#12171b" stroke="#3a444d" strokeWidth={2} />
      {open ? (
        <>
          <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={6} fill={fill} fillOpacity={0.22} stroke="#ffffff" strokeWidth={3} strokeDasharray="9 6" />
          <text x={sw.x} y={sw.y} fontSize={15} fill="#ffffff" transform={tall ? `rotate(-90 ${sw.x} ${sw.y})` : undefined}>
            GUARD OPEN
          </text>
        </>
      ) : (
        <>
          <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={6} fill={fill} stroke={edge} strokeWidth={2} />
          {tall ? (
            <rect x={x + w * 0.22} y={y + h * 0.1} width={w * 0.56} height={h * 0.16} rx={5} fill="#000" opacity={0.45} />
          ) : (
            <rect x={x + w * 0.1} y={y + h * 0.22} width={w * 0.16} height={h * 0.56} rx={5} fill="#000" opacity={0.45} />
          )}
        </>
      )}
    </g>
  );
}

function Knob({ sw, angle }: { sw: SwitchEl; angle: number }) {
  const r = sw.r;
  return (
    <g>
      {sw.positions?.map((p) => (
        <line
          key={p.id}
          x1={sw.x}
          y1={sw.y - r - 5}
          x2={sw.x}
          y2={sw.y - r - 14}
          stroke="#e9eef2"
          strokeWidth={3}
          transform={`rotate(${p.angle ?? 0} ${sw.x} ${sw.y})`}
        />
      ))}
      <circle cx={sw.x} cy={sw.y} r={r} fill="#14191d" stroke="#6b7680" strokeWidth={3} />
      <g className="knob-rotor" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${sw.x}px ${sw.y}px` }}>
        <circle cx={sw.x} cy={sw.y} r={r * 0.8} fill="#d9dbd5" stroke="#8a908a" strokeWidth={2} />
        {sw.bar ? (
          <rect x={sw.x - r * 0.2} y={sw.y - r * 0.95} width={r * 0.4} height={r * 1.9} rx={4} fill="#1b2025" />
        ) : (
          <rect x={sw.x - r * 0.09} y={sw.y - r * 0.95} width={r * 0.18} height={r * 0.8} rx={3} fill="#1b2025" />
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
    const fill = sw.tone === 'red' ? '#b3202a' : '#12171b';
    return <circle cx={sw.x} cy={sw.y} r={sw.r} fill={fill} stroke="#7a858f" strokeWidth={3} />;
  }
  return <Toggle sw={sw} dir={current?.dir ?? 'center'} />;
}

/** The panel drawn from data. Lights take their level from `levels`; operable switches report taps. */
export function Schematic({ schematic, sim, levels, onOperate }: Props) {
  return (
    <svg
      className="schematic"
      viewBox={`0 0 ${schematic.width} ${schematic.height}`}
      role="group"
      aria-label="Schematic of the panel"
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {schematic.plates.map((p, i) => (
        <rect
          key={i}
          x={p.rect[0]}
          y={p.rect[1]}
          width={p.rect[2]}
          height={p.rect[3]}
          rx={p.r ?? 10}
          fill={PLATE[p.tone].fill}
          stroke={PLATE[p.tone].stroke}
          strokeWidth={3}
        />
      ))}

      {schematic.lines.map((l, i) => (
        <polyline
          key={i}
          points={l.points.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={INK[l.tone]}
          strokeWidth={l.width}
          strokeLinejoin="round"
        />
      ))}

      {schematic.gauges.map((g, i) => (
        <g key={i}>
          <circle cx={g.x} cy={g.y} r={g.r} fill="#06080a" stroke="#8b96a0" strokeWidth={4} />
          {Array.from({ length: 24 }, (_, t) => (
            <line
              key={t}
              x1={g.x}
              y1={g.y - g.r + 6}
              x2={g.x}
              y2={g.y - g.r + (t % 2 ? 13 : 20)}
              stroke="#e9eef2"
              strokeWidth={2}
              transform={`rotate(${t * 15} ${g.x} ${g.y})`}
            />
          ))}
          {g.label.map((row, r) => (
            <text key={row} x={g.x} y={g.y + g.r * 0.26 + r * g.r * 0.15} fontSize={Math.max(9, g.r * 0.12)} fill="#c9d2da">
              {row}
            </text>
          ))}
          <line
            x1={g.x}
            y1={g.y}
            x2={g.x}
            y2={g.y - g.r * 0.72}
            stroke="#ffffff"
            strokeWidth={5}
            strokeLinecap="round"
            transform={`rotate(${g.needle} ${g.x} ${g.y})`}
          />
          <circle cx={g.x} cy={g.y} r={g.r * 0.09} fill="#ffffff" />
        </g>
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
