import type { DisplayEl, GaugeEl, LightEl, LightLevel, LineEl, PlateEl, Schematic, SwitchEl, TextEl } from '../data/types';
import { view, type SimState } from '../sim';

/*
 * Draws a schematic panel as SVG markup in the realistic, high-contrast look:
 * blue-slate plates on a near-black frame, cream legends, metal toggles, filled
 * lit lights. Text is never filtered, so it stays sharp at any zoom.
 */

const INK = '#f6edd6';
const INK_DIM = '#c9bfa6';
const PRESSED = '#ffd23f';
const LAMP: Record<string, { lit: string; hi: string; unlit: string; text: string }> = {
  amber: { lit: '#ffab1f', hi: '#ffd47a', unlit: '#a3957a', text: '#1d1204' },
  green: { lit: '#2bd96d', hi: '#9dffc0', unlit: '#8ea292', text: '#04190b' },
  blue: { lit: '#3ba3ff', hi: '#a9d8ff', unlit: '#8c9cab', text: '#04121f' },
  white: { lit: '#f4f1e7', hi: '#ffffff', unlit: '#a6a39b', text: '#191814' },
};

type Box = { x: number; y: number; w: number; h: number };
const f = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function lightBox(l: LightEl): Box {
  if (l.poly) {
    const xs = l.poly.map((p) => p[0]);
    const ys = l.poly.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  const [x, y, w, h] = l.rect!;
  return { x, y, w, h };
}

export function switchBox(s: SwitchEl): Box {
  if (s.hit) return { x: s.hit[0], y: s.hit[1], w: s.hit[2], h: s.hit[3] };
  if (s.style === 'key') {
    const k = (s.size ?? 34) / 2 + 2;
    return { x: s.x - k, y: s.y - k, w: 2 * k, h: 2 * k };
  }
  const a = Math.max(s.guard ? s.guard.w / 2 : 0, s.r * 1.15, 14);
  const b = Math.max(s.guard ? s.guard.h / 2 : 0, s.r * 1.15, 14);
  return { x: s.x - a, y: s.y - b, w: 2 * a, h: 2 * b };
}

const overlaps = (b: Box, c?: Box) => !c || (b.x < c.x + c.w && b.x + b.w > c.x && b.y < c.y + c.h && b.y + b.h > c.y);

export const DEFS = `<defs>
<linearGradient id="pd-plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4d5762"/><stop offset="1" stop-color="#3f4851"/></linearGradient>
<linearGradient id="pd-plate-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ebe5d6"/><stop offset="1" stop-color="#d8d0bd"/></linearGradient>
<linearGradient id="pd-plate-black" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202327"/><stop offset="1" stop-color="#131517"/></linearGradient>
<radialGradient id="pd-screw" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#b9bfc5"/><stop offset=".6" stop-color="#6b737b"/><stop offset="1" stop-color="#30353a"/></radialGradient>
<linearGradient id="pd-lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2620"/><stop offset="1" stop-color="#181613"/></linearGradient>
<linearGradient id="pd-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".48" stop-color="#fff" stop-opacity=".04"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
${Object.entries(LAMP)
  .map(([c, L]) => `<radialGradient id="pd-lit-${c}" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="${L.hi}"/><stop offset="1" stop-color="${L.lit}"/></radialGradient>`)
  .join('')}
<radialGradient id="pd-nut" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#eef0f2"/><stop offset=".55" stop-color="#a2a8ae"/><stop offset="1" stop-color="#545a60"/></radialGradient>
<linearGradient id="pd-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d737a"/><stop offset=".38" stop-color="#ffffff"/><stop offset=".62" stop-color="#bfc4c9"/><stop offset="1" stop-color="#5f656b"/></linearGradient>
<radialGradient id="pd-tip" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cfd4d9"/><stop offset="1" stop-color="#737a81"/></radialGradient>
<radialGradient id="pd-tipw" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#efebe2"/><stop offset="1" stop-color="#aaa395"/></radialGradient>
<linearGradient id="pd-guard" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0f1012"/><stop offset=".32" stop-color="#3a3e43"/><stop offset=".6" stop-color="#25282c"/><stop offset="1" stop-color="#0c0d0e"/></linearGradient>
<linearGradient id="pd-guard-red" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8c1510"/><stop offset=".32" stop-color="#ea4134"/><stop offset=".6" stop-color="#c62b20"/><stop offset="1" stop-color="#7a120d"/></linearGradient>
<radialGradient id="pd-knob-light" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#ebe6da"/><stop offset="1" stop-color="#aaa394"/></radialGradient>
<radialGradient id="pd-knob-dark" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="#666c73"/><stop offset=".6" stop-color="#30343a"/><stop offset="1" stop-color="#141618"/></radialGradient>
<radialGradient id="pd-knob-red" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="#ff7a6a"/><stop offset=".6" stop-color="#c8281d"/><stop offset="1" stop-color="#6e0f0a"/></radialGradient>
<radialGradient id="pd-btn" cx=".42" cy=".35" r=".8"><stop offset="0" stop-color="#565b62"/><stop offset=".7" stop-color="#22252a"/><stop offset="1" stop-color="#0e0f11"/></radialGradient>
<radialGradient id="pd-btn-on" cx=".42" cy=".35" r=".8"><stop offset="0" stop-color="#fff2b8"/><stop offset=".6" stop-color="${PRESSED}"/><stop offset="1" stop-color="#b8901a"/></radialGradient>
<linearGradient id="pd-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f55"/><stop offset="1" stop-color="#2b2f33"/></linearGradient>
<radialGradient id="pd-flood" cx=".5" cy="0" r="1.1"><stop offset="0" stop-color="#fff6e0"/><stop offset="1" stop-color="#fff6e0" stop-opacity="0"/></radialGradient>
<filter id="pd-halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>`;

// ---------- static parts ----------

function plate(p: PlateEl): string {
  const [x, y, w, h] = p.rect;
  if (p.tone === 'base') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0d1013"/>`;
  const r = p.r ?? (p.tone === 'black' ? 4 : 6);
  const fill = p.tone === 'light' ? 'url(#pd-plate-light)' : p.tone === 'black' ? 'url(#pd-plate-black)' : 'url(#pd-plate)';
  let s = `<rect x="${f(x + 2)}" y="${f(y + 3)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="#000" opacity=".55"/>`;
  s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="${fill}" stroke="${p.tone === 'light' ? '#8f8774' : '#1b1f23'}" stroke-width="1.5"/>`;
  s += `<path d="M${f(x + r)} ${f(y + 1.6)}H${f(x + w - r)}M${f(x + 1.6)} ${f(y + r)}V${f(y + h - r)}" stroke="#fff" stroke-opacity="${p.tone === 'light' ? 0.6 : 0.16}" stroke-width="1.4"/>`;
  if (p.screws !== false && p.tone !== 'black' && w > 110 && h > 70) {
    const m = Math.min(15, Math.min(w, h) * 0.1);
    const sr = Math.min(7.5, Math.min(w, h) * 0.045);
    for (const [sx, sy] of [
      [x + m, y + m],
      [x + w - m, y + m],
      [x + m, y + h - m],
      [x + w - m, y + h - m],
    ])
      s += `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(sr)}" fill="url(#pd-screw)" stroke="#1a1d20"/><path d="M${f(sx - sr * 0.55)} ${f(sy)}H${f(sx + sr * 0.55)}M${f(sx)} ${f(sy - sr * 0.55)}V${f(sy + sr * 0.55)}" stroke="#1a1d20" stroke-width="${f(sr * 0.3)}" stroke-linecap="round"/>`;
  }
  return s;
}

function text(t: TextEl, centred: boolean): string {
  const rows = t.text.split('\n');
  const tr = t.rotate ? ` transform="rotate(${t.rotate} ${f(t.x)} ${f(t.y)})"` : '';
  let s = '';
  if (t.tone === 'dark' && t.text.trim()) {
    // stencil label box on the cream sub-panels
    const w = Math.max(...rows.map((r) => r.length)) * t.size * 0.6 + t.size * 0.55;
    const h = rows.length * t.size * 1.1 + t.size * 0.22;
    const bx = t.anchor === 'start' ? t.x - t.size * 0.28 : t.anchor === 'end' ? t.x - w + t.size * 0.28 : t.x - w / 2;
    s += `<rect x="${f(bx)}" y="${f(centred ? t.y - h / 2 : t.y - t.size * 0.98)}" width="${f(w)}" height="${f(h)}" rx="${f(t.size * 0.18)}" fill="#17150f"${tr}/>`;
  }
  s += `<text x="${f(t.x)}" y="${f(t.y)}" font-size="${f(t.size)}" font-weight="${t.size >= 15 ? 700 : 600}" text-anchor="${t.anchor}"${centred ? ' dominant-baseline="central"' : ''} fill="${t.tone === 'dim' ? INK_DIM : INK}"${tr}>`;
  rows.forEach((r, i) => (s += `<tspan x="${f(t.x)}" dy="${i ? f(t.size * 1.1) : 0}">${esc(r)}</tspan>`));
  return s + '</text>';
}

function line(l: LineEl): string {
  const d = l.points.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('');
  const c = l.tone === 'dark' ? '#1d1c19' : l.tone === 'shadow' ? '#161a1d' : INK;
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${l.tone === 'dark' ? l.width + 3 : l.width}" stroke-linejoin="round"/>`;
}

function gauge(g: GaugeEl): string {
  const { x, y, r } = g;
  let s = `<circle cx="${f(x + 2)}" cy="${f(y + 3)}" r="${f(r * 1.12)}" fill="#000" opacity=".5"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.12)}" fill="#2b2f33" stroke="#0d0e0f" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.96)}" fill="#0a0b0c"/>`;
  const sc = g.scale ?? { start: -135, end: 135, major: 9, minor: 1 };
  const ang = (a: number) => ((a - 90) * Math.PI) / 180;
  const n = (sc.major - 1) * (sc.minor + 1);
  for (let i = 0; i <= n; i++) {
    const a = ang(sc.start + ((sc.end - sc.start) * i) / n);
    const major = i % (sc.minor + 1) === 0;
    const r0 = r * (major ? 0.72 : 0.82);
    s += `<line x1="${f(x + Math.cos(a) * r0)}" y1="${f(y + Math.sin(a) * r0)}" x2="${f(x + Math.cos(a) * r * 0.9)}" y2="${f(y + Math.sin(a) * r * 0.9)}" stroke="${INK}" stroke-width="${f(major ? r * 0.04 : r * 0.02)}"/>`;
  }
  (sc.numbers ?? []).forEach((num, i, all) => {
    const a = ang(sc.start + ((sc.end - sc.start) * i) / (all.length - 1));
    s += `<text x="${f(x + Math.cos(a) * r * 0.56)}" y="${f(y + Math.sin(a) * r * 0.56 + r * 0.08)}" font-size="${f(r * 0.21)}" font-weight="700" text-anchor="middle" fill="${INK}">${num}</text>`;
  });
  g.label.forEach((t, i) => (s += `<text x="${f(x)}" y="${f(y + r * (g.labelAt ?? 0.42) + i * r * 0.18)}" font-size="${f(r * 0.15)}" font-weight="700" text-anchor="middle" fill="${INK}">${esc(t)}</text>`));
  const na = ((g.needle - 90) * Math.PI) / 180;
  const px = Math.cos(na + Math.PI / 2) * r * 0.05;
  const py = Math.sin(na + Math.PI / 2) * r * 0.05;
  s += `<path d="M${f(x + px)} ${f(y + py)}L${f(x + Math.cos(na) * r * 0.86)} ${f(y + Math.sin(na) * r * 0.86)}L${f(x - px)} ${f(y - py)}Z" fill="#f7f4ec"/>`;
  return s + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * (g.hub ?? 0.12))}" fill="#16181a" stroke="#40454a"/>`;
}

// ---------- lights ----------

function lamp(l: LightEl, level: LightLevel): string {
  const c = LAMP[l.color] ?? LAMP.amber;
  const b = lightBox(l);
  const shape = (inset: number, attrs: string) =>
    l.poly
      ? `<polygon points="${l.poly.map((p) => `${f(p[0])},${f(p[1])}`).join(' ')}" ${attrs}/>`
      : `<rect x="${f(b.x + inset)}" y="${f(b.y + inset)}" width="${f(b.w - 2 * inset)}" height="${f(b.h - 2 * inset)}" rx="2" ${attrs}/>`;
  if (l.dot) {
    return `<circle cx="${f(b.x + b.w / 2)}" cy="${f(b.y + b.h / 2)}" r="${f(b.w * 0.62)}" fill="${level === 'off' ? '#1c1f1c' : c.lit}" stroke="#000" opacity="${level === 'dim' ? 0.55 : 1}"/>`;
  }
  if (l.glyph === 'dots') {
    // cue lights on a keyboard key
    return [0.3, 0.7]
      .map((k) => `<circle cx="${f(b.x + b.w * k)}" cy="${f(b.y + b.h / 2)}" r="${f(b.h * 0.42)}" fill="${level === 'off' ? '#3a3d40' : c.lit}" stroke="#000" stroke-width=".6"/>`)
      .join('');
  }
  let s = '';
  if (!l.bare) s += shape(-2.5, 'fill="#08090a" stroke="#2a2e32"');
  if (level === 'on') s += shape(-3, `fill="${c.lit}" opacity=".5" filter="url(#pd-halo)"`);
  if (level === 'off') s += shape(1, 'fill="url(#pd-lens)"');
  else if (level === 'dim') s += shape(1, `fill="${c.lit}" fill-opacity=".42"`) + shape(1, 'fill="#1a1713" fill-opacity=".35"');
  else s += shape(1, `fill="url(#pd-lit-${l.color})"`);
  s += shape(1, 'fill="url(#pd-sheen)"');
  const ink = level === 'on' ? c.text : level === 'dim' ? c.hi : c.unlit;
  const rows = l.lines.filter((r) => r !== '');
  if (l.glyph === 'bars') {
    for (let i = 0; i < 3; i++) s += `<rect x="${f(b.x + b.w * 0.25)}" y="${f(b.y + b.h * (0.25 + i * 0.2))}" width="${f(b.w * 0.5)}" height="${f(b.h * 0.09)}" fill="${ink}"/>`;
  } else if (rows.length) {
    const fs = Math.min(b.h / (rows.length * 1.18 + 0.12), (b.w * 0.86) / (Math.max(...rows.map((r) => r.length)) * 0.6), b.h * 0.42);
    const cx = b.x + b.w / 2;
    const top = b.y + b.h / 2 - ((rows.length - 1) * fs * 1.06) / 2 + fs * 0.36;
    s += `<text x="${f(cx)}" y="${f(top)}" font-size="${f(fs)}" font-weight="700" text-anchor="middle" fill="${ink}">`;
    rows.forEach((r, i) => (s += `<tspan x="${f(cx)}" dy="${i ? f(fs * 1.06) : 0}">${esc(r)}</tspan>`));
    s += '</text>';
  }
  return s;
}

// ---------- switches ----------

const DIRS: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], center: [0, 0] };
const hex = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)}`;
  }).join(' ');

function lever(x: number, y: number, r: number, dir: string, white: boolean): string {
  const v = DIRS[dir] ?? DIRS.center;
  const tx = x + v[0] * r * 0.95;
  const ty = y + v[1] * r * 0.95;
  const tip = white ? 'pd-tipw' : 'pd-tip';
  let s = `<polygon points="${hex(x, y, r * 0.62)}" fill="url(#pd-nut)" stroke="#2c3034"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.36)}" fill="#202326" stroke="#7a8087"/>`;
  if (dir === 'center') return s + `<circle cx="${f(x + 1.5)}" cy="${f(y + 2.5)}" r="${f(r * 0.32)}" fill="#000" opacity=".45"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.3)}" fill="url(#${tip})" stroke="#555b61"/>`;
  const w = r * 0.24;
  const px = -v[1] * w;
  const py = v[0] * w;
  s += `<line x1="${f(x + 2)}" y1="${f(y + 3)}" x2="${f(tx + 2)}" y2="${f(ty + 3)}" stroke="#000" stroke-opacity=".45" stroke-width="${f(w * 1.4)}" stroke-linecap="round"/>`;
  s += `<polygon points="${f(x + px * 0.7)},${f(y + py * 0.7)} ${f(tx + px * 0.45)},${f(ty + py * 0.45)} ${f(tx - px * 0.45)},${f(ty - py * 0.45)} ${f(x - px * 0.7)},${f(y - py * 0.7)}" fill="url(#pd-chrome)" stroke="#4a5056" stroke-width=".8"/>`;
  return s + `<circle cx="${f(tx)}" cy="${f(ty)}" r="${f(white ? r * 0.36 : r * 0.28)}" fill="url(#${tip})" stroke="#5b6167" stroke-width=".8"/>`;
}

function guarded(sw: SwitchEl, pos: string): string {
  const { x, y } = sw;
  const { w, h, color } = sw.guard!;
  const open = pos !== 'closed';
  const red = color === 'red';
  const horiz = w > h;
  const dir = sw.positions?.find((p) => p.id === pos)?.dir ?? 'center';
  let s = `<rect x="${f(x - w / 2 - 3)}" y="${f(y - h / 2 - 3)}" width="${f(w + 6)}" height="${f(h + 6)}" rx="6" fill="#121416" stroke="#000"/>`;
  if (open) {
    s += lever(x, y, Math.max(12, Math.min(sw.r || 20, Math.min(w, h) * 0.55)), dir, false);
    s += horiz
      ? `<rect x="${f(x - w / 2)}" y="${f(y - h / 2 - h * 0.6)}" width="${f(w)}" height="${f(h * 0.5)}" rx="${f(h * 0.12)}" fill="#2a2e33" stroke="#050506"/><rect x="${f(x - w / 2 + 3)}" y="${f(y - h / 2 - h * 0.6 + 2)}" width="${f(w - 6)}" height="${f(h * 0.1)}" fill="${red ? '#d33a2e' : '#4a4f55'}"/>`
      : `<rect x="${f(x - w / 2)}" y="${f(y - h / 2 - h * 0.13)}" width="${f(w)}" height="${f(h * 0.14)}" rx="${f(w * 0.12)}" fill="#2a2e33" stroke="#050506"/><rect x="${f(x - w / 2 + 3)}" y="${f(y - h / 2 - h * 0.13 + 2)}" width="${f(w - 6)}" height="${f(h * 0.05)}" rx="2" fill="${red ? '#d33a2e' : '#4a4f55'}"/>`;
    return s;
  }
  s += `<rect x="${f(x - w / 2 + 2)}" y="${f(y - h / 2 + 4)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(w, h) * 0.18)}" fill="#000" opacity=".5"/>`;
  s += `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(Math.min(w, h) * 0.18)}" fill="url(#${red ? 'pd-guard-red' : 'pd-guard'})" stroke="${red ? '#5a0c08' : '#040405'}" stroke-width="1.2"/>`;
  s += horiz
    ? `<rect x="${f(x - w / 2 + 5)}" y="${f(y - h * 0.3)}" width="${f(w - 10)}" height="${f(h * 0.12)}" rx="2" fill="#fff" opacity="${red ? 0.28 : 0.13}"/>`
    : `<rect x="${f(x - w * 0.34)}" y="${f(y - h / 2 + 5)}" width="${f(w * 0.13)}" height="${f(h - 10)}" rx="2" fill="#fff" opacity="${red ? 0.28 : 0.13}"/>`;
  return s;
}

function knob(sw: SwitchEl, angle: number, pulled: boolean): string {
  const { x, y, r } = sw;
  const tone = sw.tone === 'dark' ? 'dark' : sw.tone === 'red' ? 'red' : 'light';
  let s = `<circle cx="${f(x + 2)}" cy="${f(y + 4)}" r="${f(r)}" fill="#000" opacity=".5"/>`;
  if (sw.bar) {
    return (
      s +
      `<g transform="rotate(${angle} ${f(x)} ${f(y)})"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.95)}" fill="url(#pd-knob-${tone})" stroke="#6f6a5e"/><rect x="${f(x - r * 0.2)}" y="${f(y - r * 1.02)}" width="${f(r * 0.4)}" height="${f(r * 2.04)}" rx="${f(r * 0.14)}" fill="url(#pd-knob-${tone})" stroke="#6f6a5e"/><path d="M${f(x - r * 0.07)} ${f(y - r * 0.95)}V${f(y + r * 0.95)}M${f(x + r * 0.07)} ${f(y - r * 0.95)}V${f(y + r * 0.95)}" stroke="#151515" stroke-width="${f(r * 0.06)}"/></g>`
    );
  }
  if (pulled) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.18)}" fill="none" stroke="${PRESSED}" stroke-width="2.5"/>`;
  s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#pd-knob-${tone})" stroke="${tone === 'light' ? '#6f6a5e' : '#090a0b'}" stroke-width="1.2"/>`;
  s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.72)}" fill="url(#pd-knob-${tone})" stroke="#000" stroke-opacity=".15"/>`;
  const light = tone === 'light';
  s += `<g transform="rotate(${angle} ${f(x)} ${f(y)})"><path d="M${f(x - r * 0.16)} ${f(y + r * 0.3)}L${f(x - r * 0.1)} ${f(y - r * 0.93)}L${f(x + r * 0.1)} ${f(y - r * 0.93)}L${f(x + r * 0.16)} ${f(y + r * 0.3)}Z" fill="${light ? '#d4cec0' : '#41464c'}" stroke="${light ? '#8b8475' : '#000'}" stroke-width=".8"/><line x1="${f(x)}" y1="${f(y - r * 0.12)}" x2="${f(x)}" y2="${f(y - r * 0.88)}" stroke="${light ? '#121110' : '#f6f1e5'}" stroke-width="${f(Math.max(2, r * 0.1))}" stroke-linecap="round"/></g>`;
  return s;
}

function button(sw: SwitchEl, down: boolean): string {
  const { x, y, r } = sw;
  let s = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#0b0c0d" stroke="${down ? PRESSED : '#50565c'}" stroke-width="${down ? 2.5 : 1.2}"/>`;
  s += `<circle cx="${f(x)}" cy="${f(y + (down ? 1.5 : 0))}" r="${f(r * (down ? 0.7 : 0.78))}" fill="url(#${down ? 'pd-btn-on' : sw.tone === 'red' ? 'pd-knob-red' : 'pd-btn'})" stroke="#000"/>`;
  if (!down) s += `<ellipse cx="${f(x - r * 0.18)}" cy="${f(y - r * 0.28)}" rx="${f(r * 0.34)}" ry="${f(r * 0.18)}" fill="#fff" opacity=".18"/>`;
  return s;
}

function key(sw: SwitchEl, down: boolean): string {
  const k = sw.size ?? 34;
  const d = down ? 2 : 0;
  const rows = (sw.legend ?? '').split('\n');
  let s = `<rect x="${f(sw.x - k / 2 - 2)}" y="${f(sw.y - k / 2 - 2)}" width="${f(k + 4)}" height="${f(k + 4)}" rx="5" fill="#08090a"/>`;
  s += `<rect x="${f(sw.x - k / 2)}" y="${f(sw.y - k / 2 + d)}" width="${f(k)}" height="${f(k - d)}" rx="4" fill="${down ? PRESSED : 'url(#pd-key)'}" stroke="#000"/>`;
  if (!down) s += `<rect x="${f(sw.x - k / 2 + 2)}" y="${f(sw.y - k / 2 + 1.5)}" width="${f(k - 4)}" height="${f(k * 0.2)}" rx="3" fill="#fff" opacity=".08"/>`;
  const col = down ? '#121417' : '#f7f2e6';
  rows.forEach(
    (t, i) =>
      (s += `<text x="${f(sw.x)}" y="${f(sw.y + (rows.length === 1 ? k * 0.15 : -k * 0.07 + i * k * 0.33) + d)}" font-size="${f(rows.length === 1 ? (t.length > 2 ? k * 0.34 : k * 0.42) : k * 0.31)}" font-weight="700" text-anchor="middle" fill="${col}">${esc(t)}</text>`),
  );
  return s;
}

/** A selector button that latches in when chosen, like the transmitter selectors. */
function selector(sw: SwitchEl, chosen: boolean): string {
  const [x, y, w, h] = sw.hit!;
  const d = chosen ? 3 : 0;
  let s = `<rect x="${f(x - 2)}" y="${f(y - 2)}" width="${f(w + 4)}" height="${f(h + 4)}" rx="4" fill="#050606"/>`;
  if (!chosen) s += `<rect x="${f(x)}" y="${f(y + h - 4)}" width="${f(w)}" height="6" rx="3" fill="#000" opacity=".6"/>`;
  s += `<rect x="${f(x)}" y="${f(y + d)}" width="${f(w)}" height="${f(h - d)}" rx="3" fill="${chosen ? '#141618' : '#2c3035'}" stroke="${chosen ? PRESSED : '#555b62'}" stroke-width="${chosen ? 2.5 : 1.2}"/>`;
  if (!chosen) s += `<rect x="${f(x + 2)}" y="${f(y + 2)}" width="${f(w - 4)}" height="${f(h * 0.16)}" rx="2" fill="#fff" opacity=".1"/>`;
  return s;
}

function switchEl(sw: SwitchEl, sim: SimState): string {
  const pos = sim.pos[sw.id];
  const pd = sw.positions?.find((p) => p.id === pos);
  const held = Boolean(sim.held[sw.id]);
  switch (sw.style) {
    case 'toggle':
      return lever(sw.x, sw.y, sw.r, pd?.dir ?? sw.positions?.[0]?.dir ?? 'center', sw.tone === 'light');
    case 'guarded':
      return guarded(sw, pos ?? 'closed');
    case 'knob':
      return knob(sw, pd?.angle ?? sw.pointer ?? 0, Boolean(sw.pulled?.includes(pos)));
    case 'button':
    case 'push':
      return button(sw, held || Boolean(sw.latched?.includes(pos)));
    case 'key':
      return key(sw, held);
    case 'switchlight': {
      const [x, y, w, h] = sw.hit!;
      return `<rect x="${f(x - 2)}" y="${f(y - 2)}" width="${f(w + 4)}" height="${f(h + 4)}" rx="5" fill="none" stroke="#c9c4b6" stroke-opacity=".55" stroke-width="2"/>`;
    }
    case 'select':
      return selector(sw, sim.pos[sw.group!] === sw.value);
    default:
      return '';
  }
}

function display(d: DisplayEl, sim: SimState): string {
  const [x, y, w, h] = d.rect;
  let s = `<rect x="${f(x - 3)}" y="${f(y - 3)}" width="${f(w + 6)}" height="${f(h + 6)}" rx="3" fill="#0b0c0d"/><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#030404"/>`;
  const txt = d.value(view(sim));
  if (txt) s += `<text x="${f(x + w - 8)}" y="${f(y + h * 0.74)}" font-family="'Share Tech Mono', ui-monospace, monospace" font-size="${f(h * 0.66)}" text-anchor="end" fill="#eaf3e4" xml:space="preserve">${esc(txt)}</text>`;
  return s;
}

/** The static part of the panel: plates, lines, gauges and legends. */
export function drawStatic(s: Schematic, clip?: Box): string {
  let out = '';
  for (const p of s.plates) if (overlaps({ x: p.rect[0], y: p.rect[1], w: p.rect[2], h: p.rect[3] }, clip)) out += plate(p);
  for (const l of s.lines) out += line(l);
  for (const g of s.gauges) if (overlaps({ x: g.x - g.r, y: g.y - g.r, w: 2 * g.r, h: 2 * g.r }, clip)) out += gauge(g);
  for (const t of s.texts) if (overlaps({ x: t.x - 60, y: t.y - 20, w: 120, h: 40 }, clip)) out += text(t, Boolean(s.centredText));
  return out;
}

/** The parts that change: displays, lights, switches and the flood light. */
export function drawDynamic(s: Schematic, sim: SimState, levels: Record<string, LightLevel>, clip?: Box): string {
  let out = '';
  for (const d of s.displays ?? []) out += display(d, sim);
  // selector buttons sit behind the lights they carry
  for (const sw of s.switches) if (sw.style === 'select' && overlaps(switchBox(sw), clip)) out += switchEl(sw, sim);
  for (const l of s.lights) if (overlaps(lightBox(l), clip)) out += lamp(l, levels[l.id] ?? 'off');
  for (const sw of s.switches) if (sw.style !== 'select' && overlaps(switchBox(sw), clip)) out += switchEl(sw, sim);
  const flood = s.flood?.(view(sim)) ?? 0;
  const [vx, vy, vw, vh] = s.view ?? [0, 0, s.width, s.height];
  if (flood > 0) out += `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#pd-flood)" opacity="${flood}" pointer-events="none"/>`;
  return out;
}
