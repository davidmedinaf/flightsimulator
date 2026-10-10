// Validates the procedure and panel data: every referenced control exists,
// ids are unique, explicit next/choice targets resolve, coordinates are in
// range, and every expectation names a real switch position or light.
// Needs Node 22.18 or later (it imports the TypeScript schematic directly).
import { readFileSync, readdirSync } from 'node:fs';
import { conditionHolds, initialSim, lightLevels, mismatches } from '../src/sim.ts';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const panelDir = new URL('../src/data/panels/', import.meta.url);
const procDir = new URL('../src/data/procedures/', import.meta.url);

let errors = 0;
const fail = (msg) => {
  errors++;
  console.error('ERROR', msg);
};

const panels = {};
for (const f of readdirSync(panelDir).filter((f) => f.endsWith('.controls.json'))) {
  const p = read(`../src/data/panels/${f}`);
  const mod = await import(`../src/data/panels/${f.replace('.controls.json', '.schematic.ts')}`);
  const build = Object.values(mod).find((v) => typeof v === 'function');
  panels[p.panelId] = { controls: p.controls, schematic: build(p.controls) };
}

const LEVELS = ['off', 'dim', 'on'];

for (const [panelId, { controls, schematic }] of Object.entries(panels)) {
  for (const [id, c] of Object.entries(controls)) {
    const [x, y, w, h] = c.rect;
    if (![x, y, w, h].every((n) => typeof n === 'number' && n >= 0 && n <= 1) || x + w > 1.0001 || y + h > 1.0001) {
      fail(`${panelId}/${id}: rect out of range ${JSON.stringify(c.rect)}`);
    }
  }
  const ids = [...schematic.lights, ...schematic.switches].map((e) => e.id);
  if (new Set(ids).size !== ids.length) fail(`${panelId}: duplicate schematic ids`);
  const switches = new Map(schematic.switches.map((s) => [s.id, (s.positions ?? []).map((p) => p.id)]));
  for (const sw of schematic.switches) {
    if (sw.initial && !switches.get(sw.id).includes(sw.initial)) fail(`${panelId}/${sw.id}: unknown initial position`);
  }
  for (const l of schematic.lights) {
    for (const rule of l.rules ?? []) {
      for (const cond of rule.when) {
        for (const [id, want] of Object.entries(cond)) {
          const positions = switches.get(id);
          if (!positions) fail(`${panelId}/${l.id}: rule names unknown switch ${id}`);
          else for (const w of [want].flat()) if (!positions.includes(w)) fail(`${panelId}/${l.id}: ${id} has no position ${w}`);
        }
      }
    }
  }
  const operable = schematic.switches.filter((s) => (s.positions?.length ?? 0) > 1).length;
  const live = schematic.lights.filter((l) => l.rules || l.base).length;
  console.log(`${panelId}: ${Object.keys(controls).length} mapped positions, ${operable} operable switches, ${schematic.lights.length} lights (${live} respond to the panel)`);
}

/** Checks one expectation or condition against the panel's switches and lights. */
function checkState(where, panel, state) {
  const switches = new Map(panel.schematic.switches.map((s) => [s.id, (s.positions ?? []).map((p) => p.id)]));
  const lights = new Set(panel.schematic.lights.map((l) => l.id));
  for (const [id, want] of Object.entries(state ?? {})) {
    for (const w of [want].flat()) {
      if (lights.has(id)) {
        if (!LEVELS.includes(w)) fail(`${where}: light ${id} cannot be "${w}"`);
      } else if (switches.has(id)) {
        if (!switches.get(id).includes(w)) fail(`${where}: switch ${id} has no position "${w}"`);
      } else fail(`${where}: unknown switch or light ${id}`);
    }
  }
}

for (const f of readdirSync(procDir)) {
  const proc = read(`../src/data/procedures/${f}`);
  const ids = proc.steps.map((s) => s.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) fail(`${proc.id}: duplicate step ids`);
  let mapped = 0;
  let verified = 0;
  for (const s of proc.steps) {
    const where = `${proc.id}/${s.id}`;
    const panel = panels[s.panel ?? proc.defaultPanel];
    if (!panel) fail(`${where}: unknown panel`);
    for (const c of s.controls ?? []) if (!panel?.controls[c]) fail(`${where}: unknown control ${c}`);
    if (s.controls?.length) mapped++;
    else if (!s.textOnly) fail(`${where}: no controls and no textOnly reason`);
    if (s.controls?.length && s.textOnly) fail(`${where}: has both controls and textOnly`);
    if (s.group && !idSet.has(s.group)) fail(`${where}: unknown group ${s.group}`);
    if (s.next && !idSet.has(s.next)) fail(`${where}: unknown next ${s.next}`);
    for (const c of s.choices ?? []) if (!idSet.has(c.next)) fail(`${where}: unknown choice target ${c.next}`);
    if (s.type === 'choice' && !s.choices?.length) fail(`${where}: choice step without choices`);
    if (panel) {
      checkState(where, panel, s.expect);
      checkState(where, panel, s.when);
    }
    if (s.expect) verified++;
  }

  // Dry run: starting from the initial panel, perform every action in order and
  // confirm that each check then finds the panel in the state it asks for.
  for (const [panelId, panel] of Object.entries(panels)) {
    let sim = initialSim(panel.schematic);
    for (const s of proc.steps.filter((s) => s.expect && (s.panel ?? proc.defaultPanel) === panelId)) {
      if (s.type === 'action') {
        for (const [id, want] of Object.entries(s.expect)) sim = { ...sim, pos: { ...sim.pos, [id]: [want].flat()[0] } };
      } else if (conditionHolds(sim, s.when)) {
        for (const m of mismatches(s.expect, sim, lightLevels(panel.schematic, sim))) {
          fail(`${proc.id}/${s.id}: after the preceding actions the panel shows ${m.id} = ${m.have}, the step expects ${m.want}`);
        }
      }
    }
  }

  // Every step belongs to exactly one practice section; hand-written lines name real steps.
  const seen = new Map();
  for (const sec of proc.practice ?? []) {
    for (const id of sec.steps) {
      if (!idSet.has(id)) fail(`${proc.id}/practice/${sec.id}: unknown step ${id}`);
      if (seen.has(id)) fail(`${proc.id}/practice/${sec.id}: step ${id} is also in ${seen.get(id)}`);
      seen.set(id, sec.id);
    }
    const written = [...(sec.actions ?? []), ...(sec.checks ?? [])];
    for (const item of written) {
      for (const id of item.steps) if (!sec.steps.includes(id)) fail(`${proc.id}/practice/${sec.id}: line names step ${id} outside the section`);
    }
    if (written.length) {
      const used = new Set(written.flatMap((i) => i.steps));
      const left = sec.steps.filter((id) => !used.has(id) && !['section', 'note'].includes(proc.steps.find((s) => s.id === id).type));
      if (left.length) console.log(`  note: practice section "${sec.id}" has no line for: ${left.join(', ')}`);
    }
  }
  for (const id of ids) if (!seen.has(id)) fail(`${proc.id}: step ${id} is in no practice section`);

  console.log(
    `${proc.id}: ${proc.steps.length} steps, ${mapped} mapped, ${proc.steps.length - mapped} text-only, ${verified} verified on the practice panel, ${proc.practice.length} practice sections`,
  );
}

if (errors) process.exit(1);
console.log('Data OK');
