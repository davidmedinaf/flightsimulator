// Exercises panel behaviour that the data check cannot see: keyboard entry,
// SATCOM calls, guarded switches and light previews. Run with `npm run check:panels`.
import { panels } from '../src/data';
import { cycleLight, initialSim, lightLevels, operate, press, release, setPosition, type SimState } from '../src/sim';

let failures = 0;
function expect(what: string, ok: boolean) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}

const aft = panels['aft-overhead'].schematic;
const fwd = panels['fwd-overhead'].schematic;
const tap = (s: SimState, id: string) => release(press(aft, s, id), id);
const keys = (s: SimState, ...ids: string[]) => ids.reduce((acc, k) => tap(acc, `irs.key.${k}`), s);
const kb = (s: SimState) => s.data.kb as { field?: string; digits: string; failed?: boolean; entered?: Record<string, string> } | undefined;
const display = (s: SimState, i: number) => aft.displays![i].value({ pos: s.pos, held: s.held, data: s.data, since: () => 0, from: () => undefined });

// IRS keyboard
let s = initialSim(aft);
s = keys(s, 'N2', 'W4', '7');
expect('N arms latitude and digits follow', kb(s)?.field === 'lat' && kb(s)?.digits === '47');
expect('the entry shows in the left IRS window', display(s, 0) === 'N47');
expect('ENT cue lights illuminate while keying', lightLevels(aft, s)['irs.ent'] === 'on');
s = keys(s, '3', 'N2', '1', 'ENT');
expect('ENT with the IRS off is refused and CLR illuminates', lightLevels(aft, s)['irs.clr'] === 'on');
s = keys(s, 'CLR');
expect('CLR clears the entry', !kb(s)?.field && lightLevels(aft, s)['irs.clr'] === 'off');
s = operate(aft, s, 'irs.L'); // OFF -> ALIGN
s = keys(s, 'N2', 'W4', '7', '3', 'N2', 'W4', 'ENT');
expect('position is accepted while aligning', kb(s)?.entered?.lat === 'N47324' && !kb(s)?.failed);
s = keys(s, 'W4', '1', 'N2', 'N2', '1', 'N2', '3', 'ENT');
expect('longitude is accepted', kb(s)?.entered?.lon === 'W122123');

// SATCOM call
s = setPosition(s, 'acp.satCall', 'SAT1');
expect('an incoming call lights SAT 1 CALL', lightLevels(aft, s)['acp.call.SAT1'] === 'on');
s = tap(s, 'acp.sat.SAT1');
expect('the SAT 1 switch ends the call', s.pos['acp.satCall'] === 'NONE' && lightLevels(aft, s)['acp.call.SAT1'] === 'off');

// transmitter selectors, receivers, ALT-NORM
s = operate(aft, s, 'acp.tx.HF1');
expect('a transmitter selector latches and lights its MIC bars', s.pos['acp.tx'] === 'HF1' && lightLevels(aft, s)['acp.mic.HF1'] === 'on');
s = operate(aft, s, 'acp.rx.0.VHF2');
expect('a receiver knob turns on and lights its indicator', s.pos['acp.rx.0.VHF2'] !== 'OFF' && lightLevels(aft, s)['acp.rx.0.VHF2.dot'] === 'on');
s = operate(aft, s, 'acp.alt');
expect('ALT-NORM latches in ALT', s.pos['acp.alt'] === 'ALT');

// guarded switches on the forward panel: guard opens, then the switch moves
let f = initialSim(fwd);
f = operate(fwd, f, 'fltCtl.A');
expect('FLT CONTROL A guard opens with the switch at A ON', f.pos['fltCtl.A'] === 'A ON');
f = operate(fwd, f, 'fltCtl.A');
f = operate(fwd, f, 'fltCtl.A');
expect('then the switch goes to OFF and STBY RUD', f.pos['fltCtl.A'] === 'STBY RUD');
f = operate(fwd, operate(fwd, operate(fwd, f, 'fltCtl.A'), 'fltCtl.A'), 'fltCtl.A');
expect('and back to A ON, guard closed', f.pos['fltCtl.A'] === 'closed');
f = operate(fwd, operate(fwd, f, 'altFlaps.master'), 'altFlaps.master');
expect('ALTERNATE FLAPS master can be armed', f.pos['altFlaps.master'] === 'ARM');
const decor = fwd.switches.filter((w) => w.id.startsWith('decor.') && !(w.positions && w.positions.length > 1) && !w.momentary);
expect(`every forward-panel control can be operated (${decor.length} left fixed: ${decor.map((w) => w.style).join(', ')})`, decor.length === 0);

// light previews
const id = 'maint';
let p = cycleLight(aft, initialSim(aft), id);
expect('tapping MAINT previews it dim (it is extinguished)', lightLevels(aft, p)[id] === 'dim');
p = cycleLight(aft, cycleLight(aft, p, id), id);
expect('two more taps return it to what the panel shows', !p.override[id]);

console.log(failures ? `${failures} failed` : 'Panels OK');
process.exit(failures ? 1 : 0);
