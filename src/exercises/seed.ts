import { panels, procedures } from '../data';
import { buildPractice } from '../practice';
import type { ActionNode, ExerciseContent, ExerciseNode } from './model';
import { subStepLabel } from './WorkPanels';

export const SEED_ID = 'preflight-pf-fwd-overhead';

/**
 * The procedure the app started with, as an exercise: one action per
 * sub-panel, its switch settings as ordered sub-steps and its checks as the
 * expected result.
 */
export function seedExercise() {
  const procedure = procedures[0];
  const panelId = procedure.defaultPanel;
  const schematic = panels[panelId].schematic;
  const isSwitch = (id: string) => schematic.switches.some((s) => s.id === id && (s.positions?.length ?? 0) > 1);
  const sections = buildPractice(procedure);

  const actions: ActionNode[] = sections.map((sec, i) => {
    const substeps = sec.actions.flatMap((item) =>
      Object.entries(item.expect ?? {})
        .filter(([id]) => isSwitch(id))
        .map(([control, want]) => {
          const value = Array.isArray(want) ? want[0] : want;
          return { panel: panelId, control, value, label: subStepLabel(panelId, control, value) };
        }),
    );
    const doText = sec.actions.map((a) => a.text).join(' ');
    return {
      id: `s${i + 1}-${sec.id}`,
      kind: 'action',
      name: sec.title,
      summary: `${substeps.length} on the panel, ${sec.checks.length} check${sec.checks.length === 1 ? '' : 's'}`,
      description: [sec.initial ? `Initial state: ${sec.initial}` : '', doText].filter(Boolean).join('\n\n'),
      result: sec.checks.map((c) => c.text).join(' '),
      substeps,
    };
  });
  actions.forEach((a, i) => (a.next = actions[i + 1]?.id ?? 'end'));

  const nodes: ExerciseNode[] = [{ id: 'start', kind: 'start', next: actions[0]?.id ?? 'end' }, ...actions, { id: 'end', kind: 'end' }];
  const content: ExerciseContent = { panels: [panelId], initial: {}, nodes };
  return {
    id: SEED_ID,
    name: procedure.title,
    description: `${procedure.summary}\n\nSource: ${procedure.source.document}, ${procedure.source.chapter}, ${procedure.source.manualPages}. The original step-by-step and grouped practice modes are still available under Classic trainer in the menu.`,
    content,
    releaseNote: 'First version: moved from the original procedure trainer, one action per sub-panel.',
  };
}
