import type { Cond, Expect, PracticeItemDef, Procedure, Step, StepNote } from './data/types';

/**
 * The grouped ("practice") version of a procedure: per sub-panel, the actions
 * the student performs and the checks the student makes. It is derived from
 * the detailed steps, so both versions always describe the same procedure.
 */
export interface PracticeItem {
  id: string;
  kind: 'action' | 'check';
  text: string;
  detail: string[];
  notes: StepNote[];
  steps: Step[];
  controls: string[];
  /** Absent for items the panel cannot verify; the student ticks those. */
  expect?: Expect;
  when?: Cond;
  offPanel: boolean;
}

export interface PracticeSection {
  id: string;
  title: string;
  initial?: string;
  /** Notes attached to the section headings in the source. */
  notes: StepNote[];
  /** Information-only items of the source. */
  info: Step[];
  actions: PracticeItem[];
  checks: PracticeItem[];
  controls: string[];
}

const LEVEL_HEADING: Record<string, string> = {
  off: 'Extinguished',
  dim: 'Illuminated dim',
  on: 'Illuminated',
};

const unique = <T,>(list: T[]) => [...new Set(list)];

function sourceText(step: Step): string {
  return step.target ? `${step.title} … ${step.target}` : step.title;
}

/** The single state every entry of the expectation shares, if there is one. */
function uniformValue(expect: Expect | undefined): string | undefined {
  if (!expect) return undefined;
  const values = unique(Object.values(expect).map((v) => (Array.isArray(v) ? v.join('|') : v)));
  return values.length === 1 ? values[0] : undefined;
}

function combine(id: string, kind: PracticeItem['kind'], text: string, steps: Step[], detail: string[] = []): PracticeItem {
  const expects = steps.filter((s) => s.expect);
  return {
    id,
    kind,
    text,
    detail: [...detail, ...steps.flatMap((s) => s.body ?? [])],
    notes: steps.flatMap((s) => s.notes ?? []),
    steps,
    controls: unique(steps.flatMap((s) => s.controls ?? [])),
    // An item is verifiable only when every step behind it is.
    expect: expects.length === steps.length ? Object.assign({}, ...expects.map((s) => s.expect)) : undefined,
    when: steps.length === 1 ? steps[0].when : undefined,
    offPanel: steps.every((s) => s.textOnly === 'off-panel'),
  };
}

function isCheck(step: Step): boolean {
  // A switch whose only requirement is a closed guard is something to verify, not to move.
  return step.type === 'check' || uniformValue(step.expect) === 'closed';
}

function autoItems(steps: Step[]): { actions: PracticeItem[]; checks: PracticeItem[] } {
  const actions: PracticeItem[] = [];
  const checks: PracticeItem[] = [];
  const merged = new Map<string, Step[]>();

  for (const step of steps) {
    if (!isCheck(step)) {
      actions.push(combine(step.id, 'action', sourceText(step), [step]));
      continue;
    }
    const level = uniformValue(step.expect);
    const mergeable = level && LEVEL_HEADING[level] && !step.when && !step.notes && !step.body;
    if (!mergeable) {
      checks.push(combine(step.id, 'check', sourceText(step), [step]));
      continue;
    }
    // Lights that must show the same state become one line.
    if (!merged.has(level)) {
      merged.set(level, []);
      checks.push({ id: `merged:${level}` } as PracticeItem);
    }
    merged.get(level)!.push(step);
  }

  return {
    actions,
    checks: checks.map((item) => {
      if (!item.id.startsWith('merged:')) return item;
      const level = item.id.slice(7);
      const group = merged.get(level)!;
      if (group.length === 1) return combine(group[0].id, 'check', sourceText(group[0]), group);
      const names = group.map((s) => s.short ?? s.title).join(', ');
      return combine(`${group[0].id}+${group.length - 1}`, 'check', `${LEVEL_HEADING[level]}: ${names}`, group);
    }),
  };
}

export function buildPractice(procedure: Procedure): PracticeSection[] {
  const byId = new Map(procedure.steps.map((s) => [s.id, s]));
  const fromDefs = (defs: PracticeItemDef[], kind: PracticeItem['kind'], sectionId: string) =>
    defs.map((d, i) =>
      combine(`${sectionId}:${kind}:${i}`, kind, d.text, d.steps.map((id) => byId.get(id)!), d.detail ? [d.detail] : []),
    );

  return procedure.practice.map((def) => {
    const steps = def.steps.map((id) => byId.get(id)!);
    const items = steps.filter((s) => s.type !== 'section' && s.type !== 'note');
    const auto = autoItems(items);
    const actions = def.actions ? fromDefs(def.actions, 'action', def.id) : auto.actions;
    const checks = def.checks ? fromDefs(def.checks, 'check', def.id) : auto.checks;
    return {
      id: def.id,
      title: def.title,
      initial: def.initial,
      notes: steps.filter((s) => s.type === 'section').flatMap((s) => s.notes ?? []),
      info: steps.filter((s) => s.type === 'note'),
      actions,
      checks,
      controls: unique(steps.flatMap((s) => s.controls ?? [])),
    };
  });
}

export interface PracticeState {
  section: number;
  /** Ids of the items the student has ticked. */
  ticks: string[];
  finished: boolean;
}

export const freshPractice: PracticeState = { section: 0, ticks: [], finished: false };

const KEY = 'procedure-trainer:practice';

export function loadPractice(sections: PracticeSection[]): PracticeState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PracticeState | null;
    if (!saved || !Array.isArray(saved.ticks)) return freshPractice;
    const section = Number.isInteger(saved.section) && saved.section >= 0 && saved.section < sections.length ? saved.section : 0;
    return { section, ticks: saved.ticks.filter((t) => typeof t === 'string'), finished: Boolean(saved.finished) };
  } catch {
    return freshPractice;
  }
}

export function savePractice(state: PracticeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: progress simply is not remembered.
  }
}
