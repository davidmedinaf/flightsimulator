import type { Cond, Expect, LightLevel, PanelData, Schematic, SimView, SwitchEl } from './data/types';

/**
 * State of a practice panel: the position of every operable switch, what is
 * held down, and free-form panel memory (e.g. a keyboard entry). Lights are
 * never stored; they are derived from the switches by the panel's rules, unless
 * the student previews a light state by tapping it.
 */
export interface SimState {
  pos: Record<string, string>;
  /** Direction of travel for switches with three or more positions. */
  dir: Record<string, 1 | -1>;
  /** When each switch last moved, and from where. */
  changed: Record<string, { t: number; from: string }>;
  held: Record<string, boolean>;
  /** Light states set by tapping a light. */
  override: Record<string, LightLevel>;
  data: PanelData;
  /** Lights test: every light illuminated. */
  test?: boolean;
}

export function operable(sw: SwitchEl): boolean {
  return (sw.positions?.length ?? 0) > 1 || Boolean(sw.momentary) || sw.style === 'select';
}

export function initialSim(schematic: Schematic): SimState {
  const pos: Record<string, string> = {};
  for (const sw of schematic.switches) if ((sw.positions?.length ?? 0) > 1) pos[sw.id] = sw.initial ?? sw.positions![0].id;
  for (const v of schematic.virtual ?? []) pos[v.id] = v.initial ?? v.positions[0].id;
  return { pos, dir: {}, changed: {}, held: {}, override: {}, data: {} };
}

/** Puts a switch (or a condition outside the panel) in a given position. */
export function setPosition(sim: SimState, id: string, value: string): SimState {
  if (sim.pos[id] === value) return sim;
  return {
    ...sim,
    pos: { ...sim.pos, [id]: value },
    changed: { ...sim.changed, [id]: { t: Date.now(), from: sim.pos[id] } },
  };
}

/** Moves a switch to its next position; at either end the direction reverses. */
export function operate(schematic: Schematic, sim: SimState, id: string): SimState {
  const sw = schematic.switches.find((s) => s.id === id);
  if (!sw) return sim;
  if (sw.style === 'select' && sw.group && sw.value) return setPosition(sim, sw.group, sw.value);
  if ((sw.positions?.length ?? 0) < 2) return sim;
  const ids = sw.positions!.map((p) => p.id);
  const i = Math.max(0, ids.indexOf(sim.pos[id]));
  let d = sim.dir[id] ?? 1;
  if (i + d < 0 || i + d >= ids.length) d = -d as 1 | -1;
  return setPosition({ ...sim, dir: { ...sim.dir, [id]: d } }, id, ids[i + d]);
}

/** A momentary control goes down: it is held, and may change panel memory. */
export function press(schematic: Schematic, sim: SimState, id: string): SimState {
  const sw = schematic.switches.find((s) => s.id === id);
  if (!sw) return sim;
  let next: SimState = { ...sim, held: { ...sim.held, [id]: true } };
  if (!sw.act) return next;
  // `_set` in the returned memory moves switches or conditions (e.g. a call that ends)
  const { _set, ...data } = sw.act(sim.data, view(next));
  next = { ...next, data };
  for (const [k, v] of Object.entries((_set as Record<string, string>) ?? {})) next = setPosition(next, k, v);
  return next;
}

export function release(sim: SimState, id: string): SimState {
  if (!sim.held[id]) return sim;
  const held = { ...sim.held };
  delete held[id];
  return { ...sim, held };
}

/** Steps a light's preview through extinguished, dim, illuminated, then back to what the panel shows. */
export function cycleLight(schematic: Schematic, sim: SimState, id: string): SimState {
  const shown = lightLevels(schematic, { ...sim, override: {} })[id];
  const order: (LightLevel | undefined)[] = [undefined, 'off', 'dim', 'on'];
  let next = order[(order.indexOf(sim.override[id]) + 1) % order.length];
  if (sim.override[id] === undefined && next === shown) next = order[(order.indexOf(next) + 1) % order.length];
  const override = { ...sim.override };
  if (next) override[id] = next;
  else delete override[id];
  return { ...sim, override };
}

export function view(sim: SimState, now = Date.now()): SimView {
  return {
    pos: sim.pos,
    held: sim.held,
    data: sim.data,
    since: (id) => (sim.changed[id] ? (now - sim.changed[id].t) / 1000 : Infinity),
    from: (id) => sim.changed[id]?.from,
  };
}

function holds(sim: SimState, cond: Cond): boolean {
  return Object.entries(cond).every(([id, want]) =>
    Array.isArray(want) ? want.includes(sim.pos[id]) : sim.pos[id] === want,
  );
}

export function lightLevels(schematic: Schematic, sim: SimState, now = Date.now()): Record<string, LightLevel> {
  const out: Record<string, LightLevel> = {};
  const v = view(sim, now);
  for (const l of schematic.lights) {
    let level: LightLevel;
    if (l.logic) level = l.logic(v) ?? 'off';
    else {
      const rule = l.rules?.find((r) => r.when.some((c) => holds(sim, c)));
      level = rule ? rule.then : (l.base ?? 'off');
    }
    if (sim.override[l.id]) level = sim.override[l.id];
    if (sim.test || l.test?.(v)) level = 'on';
    out[l.id] = level;
  }
  return out;
}

/** True while lights or displays depend on time or a held button, so the panel keeps redrawing. */
export function isTimed(schematic: Schematic, sim: SimState): boolean {
  return Object.keys(sim.held).length > 0 || Boolean(schematic.timed?.(view(sim)));
}

export function conditionHolds(sim: SimState, cond: Cond | undefined): boolean {
  return !cond || holds(sim, cond);
}

export interface Mismatch {
  id: string;
  want: string | string[];
  have: string;
}

/** Entries of `expect` the panel does not currently satisfy. */
export function mismatches(expect: Expect, sim: SimState, levels: Record<string, LightLevel>): Mismatch[] {
  const out: Mismatch[] = [];
  for (const [id, want] of Object.entries(expect)) {
    const have = levels[id] ?? sim.pos[id];
    const ok = Array.isArray(want) ? want.includes(have) : want === have;
    if (!ok) out.push({ id, want, have });
  }
  return out;
}

const LEVEL_WORD: Record<string, string> = { off: 'extinguished', dim: 'illuminated dim', on: 'illuminated', closed: 'guard closed' };

/** Readable state of a light level, guard or switch position. */
export function stateWord(value: string): string {
  return LEVEL_WORD[value] ?? value;
}

const KEY = 'procedure-trainer:sim';

export function loadSim(schematic: Schematic, key = KEY): SimState {
  const fresh = initialSim(schematic);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<SimState>;
    for (const sw of schematic.switches) {
      const p = saved.pos?.[sw.id];
      if ((sw.positions?.length ?? 0) > 1 && sw.positions!.some((q) => q.id === p)) fresh.pos[sw.id] = p!;
    }
    return fresh;
  } catch {
    return fresh;
  }
}

export function saveSim(sim: SimState, key = KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify({ pos: sim.pos }));
  } catch {
    // Storage unavailable: the panel simply starts from its initial state next time.
  }
}
