// Checks exercise logic that needs no database: the example exercise, publishing rules,
// release notes and the bad-language filter. Run with `npm run check:exercises`.
import { badLanguage } from '../src/exercises/language';
import { problems, suggestReleaseNote, type ActionNode } from '../src/exercises/model';
import { seedExercise } from '../src/exercises/seed';

let failures = 0;
function expect(what: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}

const ex = seedExercise();
const actions = ex.content.nodes.filter((n): n is ActionNode => n.kind === 'action');
expect(`example exercise has one action per sub-panel (${actions.length})`, actions.length === 12);
expect('the first action sets the yaw damper ON', actions[0].substeps.some((s) => s.control === 'yawDamper.switch' && s.value === 'ON'));
expect('the example exercise can be published', problems(ex.content).length === 0);
console.log(`     ${actions.reduce((n, a) => n + a.substeps.length, 0)} sub-steps in total`);

const broken = { ...ex.content, nodes: ex.content.nodes.map((n) => (n.kind === 'action' && n === actions[3] ? { ...n, next: undefined } : n)) };
expect('a step that leads nowhere blocks publishing', problems(broken).length > 0);

const base = { id: 'x', name: 'A', description: 'd', ownerId: 'u', ownerName: 'U', content: ex.content, updatedAt: 0 };
const renamed = { ...base, name: 'B', content: { ...ex.content, nodes: ex.content.nodes.filter((n) => n.id !== actions[5].id) } };
const note = suggestReleaseNote(base, renamed);
expect(`release note names the changes: “${note}”`, note.includes('Renamed') && note.includes('Removed'));

const bad = ['what the f*ck is this', 'sh1t step', 'f u c k', 'esto es una mierda', 'WTF', 'eres un idiota', 'hdp', 'fuuuuck'];
const fine = ['The PPOS display shows N47324', 'Spoiler A guard stays closed', 'Turn the knob to ATT', 'Scunthorpe check', 'pass oxygen test', 'Assist on light'];
for (const t of bad) expect(`blocked: ${t}`, badLanguage(t).length > 0);
for (const t of fine) expect(`allowed: ${t}`, badLanguage(t).length === 0);

console.log(failures ? `${failures} failed` : 'Exercises OK');
process.exit(failures ? 1 : 0);
