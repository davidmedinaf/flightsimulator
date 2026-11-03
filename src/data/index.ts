import type { Control, Panel, Procedure, Step } from './types';
import fwdOverheadControls from './panels/fwd-overhead.controls.json';
import { buildAftOverhead } from './panels/aft-overhead.schematic';
import { buildFwdOverhead } from './panels/fwd-overhead.schematic';
import { lightBox, switchBox } from '../components/draw';
import preflightPfOverhead from './procedures/preflight-pf-overhead.json';

// To add a panel: add a <id>.controls.json and a <id>.schematic.ts next to the
// existing ones, and register the panel here.
export const panels: Record<string, Panel> = {
  'fwd-overhead': {
    id: 'fwd-overhead',
    name: 'Forward overhead panel',
    image: 'panels/fwd-overhead.jpg',
    width: 2170,
    height: 2100,
    controls: fwdOverheadControls.controls as unknown as Record<string, Control>,
    schematic: buildFwdOverhead(fwdOverheadControls.controls),
  },
  'aft-overhead': aftPanel(),
};

/**
 * The aft panel has no measured photo: its controls are taken from the drawing
 * itself, normalised to the part of it that is shown.
 */
function aftPanel(): Panel {
  const schematic = buildAftOverhead();
  const [vx, vy, vw, vh] = schematic.view!;
  const norm = (b: { x: number; y: number; w: number; h: number }) =>
    [(b.x - vx) / vw, (b.y - vy) / vh, b.w / vw, b.h / vh] as [number, number, number, number];
  const controls: Record<string, Control> = {};
  for (const sw of schematic.switches) if (sw.label) controls[sw.id] = { label: sw.label, kind: sw.style === 'knob' ? 'selector' : 'switch', rect: norm(switchBox(sw)) };
  for (const l of schematic.lights) controls[l.id] = { label: l.name ?? l.lines.join(' '), kind: 'light', rect: norm(lightBox(l)) };
  for (const r of schematic.regions ?? []) controls[`region.${r.label}`] = { label: r.label, kind: 'region', rect: norm({ x: r.rect[0], y: r.rect[1], w: r.rect[2], h: r.rect[3] }) };
  return { id: 'aft-overhead', name: 'Aft overhead panel', image: '', width: vw, height: vh, controls, schematic };
}

// To add a procedure: add its JSON file to ./procedures and list it here.
export const procedures: Procedure[] = [preflightPfOverhead as unknown as Procedure];

export function stepPanel(procedure: Procedure, step: Step): Panel | undefined {
  return panels[step.panel ?? procedure.defaultPanel];
}

export function stepControls(procedure: Procedure, step: Step): Control[] {
  const panel = stepPanel(procedure, step);
  if (!panel || !step.controls) return [];
  return step.controls.map((id) => panel.controls[id]).filter((c): c is Control => Boolean(c));
}

export function isMapped(procedure: Procedure, step: Step): boolean {
  return stepControls(procedure, step).length > 0;
}

/** Id of the level-1 item a step belongs to. */
export function groupOf(step: Step): string {
  return step.group ?? step.id;
}

/**
 * Name of a light, switch or guard for messages. Individual lights of a
 * measured group ("fuel.lowPress1.aft") fall back to the group's label.
 */
export function elementLabel(panel: Panel, id: string): string {
  const sw = panel.schematic.switches.find((s) => s.id === id);
  if (sw?.label) return sw.label;
  if (panel.controls[id]) return panel.controls[id].label;
  const parent = id.slice(0, id.lastIndexOf('.'));
  const light = panel.schematic.lights.find((l) => l.id === id);
  if (light?.name) return light.name;
  if (panel.controls[parent]) return `${panel.controls[parent].label} (${light?.lines.join(' ') ?? id})`;
  return light?.lines.join(' ') ?? id;
}
