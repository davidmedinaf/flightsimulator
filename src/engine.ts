import type { Procedure, Step } from './data/types';

/**
 * The walkthrough is a path through the step list. `history` holds the ids
 * visited so far, so Previous retraces the path actually taken even when a
 * procedure branches.
 */
export interface RunState {
  procedureId: string;
  history: string[];
  finished: boolean;
}

export function startRun(procedure: Procedure): RunState {
  return { procedureId: procedure.id, history: [procedure.steps[0].id], finished: false };
}

export function currentStep(procedure: Procedure, run: RunState): Step {
  const id = run.history[run.history.length - 1];
  return procedure.steps.find((s) => s.id === id) ?? procedure.steps[0];
}

/** Id of the step that follows `step`, or null at the end of the procedure. */
export function nextStepId(procedure: Procedure, step: Step, choiceNext?: string): string | null {
  if (choiceNext) return choiceNext;
  if (step.next) return step.next;
  const i = procedure.steps.findIndex((s) => s.id === step.id);
  return procedure.steps[i + 1]?.id ?? null;
}

export function advance(procedure: Procedure, run: RunState, choiceNext?: string): RunState {
  const next = nextStepId(procedure, currentStep(procedure, run), choiceNext);
  if (next === null || !procedure.steps.some((s) => s.id === next)) return { ...run, finished: true };
  return { ...run, history: [...run.history, next] };
}

export function goBack(run: RunState): RunState {
  if (run.finished) return { ...run, finished: false };
  if (run.history.length <= 1) return run;
  return { ...run, history: run.history.slice(0, -1) };
}

const KEY = 'procedure-trainer:run';

export function loadRun(procedure: Procedure): RunState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    const ids = new Set(procedure.steps.map((s) => s.id));
    if (run.procedureId !== procedure.id || !Array.isArray(run.history) || run.history.length === 0) return null;
    if (!run.history.every((id) => ids.has(id))) return null;
    return { procedureId: run.procedureId, history: run.history, finished: Boolean(run.finished) };
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null): void {
  try {
    if (run) localStorage.setItem(KEY, JSON.stringify(run));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode): progress simply is not remembered.
  }
}
