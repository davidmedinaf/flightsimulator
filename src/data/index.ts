import type { Control, Panel, Procedure, Step } from './types';
import fwdOverheadControls from './panels/fwd-overhead.controls.json';
import preflightPfOverhead from './procedures/preflight-pf-overhead.json';

// To add a panel: put its image in public/panels/, add a <id>.controls.json next
// to the existing one, and register it here.
export const panels: Record<string, Panel> = {
  'fwd-overhead': {
    id: 'fwd-overhead',
    name: 'Forward overhead panel',
    image: 'panels/fwd-overhead.jpg',
    width: 2170,
    height: 2100,
    controls: fwdOverheadControls.controls as unknown as Record<string, Control>,
  },
};

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
