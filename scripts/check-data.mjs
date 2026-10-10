// Validates the procedure and panel data: every referenced control exists,
// ids are unique, explicit next/choice targets resolve, coordinates are in range.
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const panelDir = new URL('../src/data/panels/', import.meta.url);
const procDir = new URL('../src/data/procedures/', import.meta.url);

const panels = {};
for (const f of readdirSync(panelDir)) {
  const p = read(`../src/data/panels/${f}`);
  panels[p.panelId] = p.controls;
}

let errors = 0;
const fail = (msg) => {
  errors++;
  console.error('ERROR', msg);
};

for (const [panelId, controls] of Object.entries(panels)) {
  for (const [id, c] of Object.entries(controls)) {
    const [x, y, w, h] = c.rect;
    if (![x, y, w, h].every((n) => typeof n === 'number' && n >= 0 && n <= 1) || x + w > 1.0001 || y + h > 1.0001) {
      fail(`${panelId}/${id}: rect out of range ${JSON.stringify(c.rect)}`);
    }
  }
}

for (const f of readdirSync(procDir)) {
  const proc = read(`../src/data/procedures/${f}`);
  const ids = proc.steps.map((s) => s.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) fail(`${proc.id}: duplicate step ids`);
  let mapped = 0;
  for (const s of proc.steps) {
    const controls = panels[s.panel ?? proc.defaultPanel];
    if (!controls) fail(`${proc.id}/${s.id}: unknown panel`);
    for (const c of s.controls ?? []) if (!controls?.[c]) fail(`${proc.id}/${s.id}: unknown control ${c}`);
    if (s.controls?.length) mapped++;
    else if (!s.textOnly) fail(`${proc.id}/${s.id}: no controls and no textOnly reason`);
    if (s.controls?.length && s.textOnly) fail(`${proc.id}/${s.id}: has both controls and textOnly`);
    if (s.group && !idSet.has(s.group)) fail(`${proc.id}/${s.id}: unknown group ${s.group}`);
    if (s.next && !idSet.has(s.next)) fail(`${proc.id}/${s.id}: unknown next ${s.next}`);
    for (const c of s.choices ?? []) if (!idSet.has(c.next)) fail(`${proc.id}/${s.id}: unknown choice target ${c.next}`);
    if (s.type === 'choice' && !s.choices?.length) fail(`${proc.id}/${s.id}: choice step without choices`);
  }
  console.log(`${proc.id}: ${proc.steps.length} steps, ${mapped} mapped, ${proc.steps.length - mapped} text-only`);
}

if (errors) process.exit(1);
console.log('Data OK');
