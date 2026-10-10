import type { Cond, Expect, LightLevel, Schematic, SwitchEl } from './data/types';

/**
 * State of the practice panel: the position of every operable switch. Lights
 * are never stored; they are derived from the switches by the panel's rules.
 */
export interface SimState {
  pos: Record<string, string>;
  /** Direction of travel for switches with three or more positions. */
  dir: Record<string, 1 | -1>;
}

export function operable(sw: SwitchEl): boolean {
  return (sw.positions?.length ?? 0) > 1;
}

export function initialSim(schematic: Schematic): SimState {
  const pos: Record<string, string> = {};
  for (const sw of schematic.switches) {
    if (operable(sw)) pos[sw.id] = sw.initial ?? sw.positions![0].id;
  }
  return { pos, dir: {} };
}

/** Moves a switch to its next position; at either end the direction reverses. */
export function operate(schematic: Schematic, sim: SimState, id: string): SimState {
  const sw = schematic.switches.find((s) => s.id === id);
  if (!sw || !operable(sw)) return sim;
  const ids = sw.positions!.map((p) => p.id);
  const i = Math.max(0, ids.indexOf(sim.pos[id]));
  let d = sim.dir[id] ?? 1;
  if (i + d < 0 || i + d >= ids.length) d = -d as 1 | -1;
  return { pos: { ...sim.pos, [id]: ids[i + d] }, dir: { ...sim.dir, [id]: d } };
}

function holds(sim: SimState, cond: Cond): boolean {
  return Object.entries(cond).every(([id, want]) =>
    Array.isArray(want) ? want.includes(sim.pos[id]) : sim.pos[id] === want,
  );
}

export function lightLevels(schematic: Schematic, sim: SimState): Record<string, LightLevel> {
  const out: Record<string, LightLevel> = {};
  for (const l of schematic.lights) {
    const rule = l.rules?.find((r) => r.when.some((c) => holds(sim, c)));
    out[l.id] = rule ? rule.then : (l.base ?? 'off');
  }
  return out;
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

const LEVEL_WORD: Record<string, string> = { off: 'extinguished', dim: 'illuminated dim', on: 'illuminated' };

/** Readable state of a light level, guard or switch position. */
export function stateWord(value: string): string {
  return LEVEL_WORD[value] ?? value;
}

const KEY = 'procedure-trainer:sim';

export function loadSim(schematic: Schematic): SimState {
  const fresh = initialSim(schematic);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as SimState;
    for (const sw of schematic.switches) {
      const p = saved.pos?.[sw.id];
      if (operable(sw) && sw.positions!.some((q) => q.id === p)) fresh.pos[sw.id] = p;
    }
    return fresh;
  } catch {
    return fresh;
  }
}

export function saveSim(sim: SimState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sim));
  } catch {
    // Storage unavailable: the panel simply starts from its initial state next time.
  }
}
