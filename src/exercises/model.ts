import type { LightLevel } from '../data/types';

export type Role = 'admin' | 'creator' | 'user';

export interface Profile {
  uid: string;
  email: string;
  name: string;
  surname: string;
  /** Small picture stored as a data URL. */
  photo?: string;
  role: Role;
  canVote: boolean;
  canReview: boolean;
  disabled?: boolean;
  createdAt: number;
}

/** One thing the user does on a panel: a switch moved to a position, or a button or key pushed. */
export interface SubStep {
  panel: string;
  control: string;
  /** Position reached, or "PUSH" for a push button or key. */
  value: string;
  /** Readable text, e.g. "YAW DAMPER switch: ON". */
  label: string;
}

export interface StartNode {
  id: 'start';
  kind: 'start';
  next?: string;
}

export interface EndNode {
  id: 'end';
  kind: 'end';
}

export interface ActionNode {
  id: string;
  kind: 'action';
  name: string;
  /** Short text shown in the flowchart. */
  summary?: string;
  description?: string;
  /** Expected outcome, e.g. "YAW DAMPER light extinguished". */
  result?: string;
  /** Done in this order. */
  substeps: SubStep[];
  next?: string;
}

export interface ChoiceOption {
  label: string;
  next?: string;
}

export interface NumberRange {
  label: string;
  min?: number;
  max?: number;
  next?: string;
}

export interface DecisionNode {
  id: string;
  kind: 'decision';
  name: string;
  summary?: string;
  question: string;
  description?: string;
  /** Panel element the question is about, if any (e.g. a light). */
  about?: { panel: string; control: string };
  answer: { type: 'choice'; options: ChoiceOption[] } | { type: 'number'; unit?: string; ranges: NumberRange[] };
}

export type ExerciseNode = StartNode | EndNode | ActionNode | DecisionNode;

/** How each panel looks when the exercise starts. */
export interface PanelSetup {
  pos: Record<string, string>;
  override: Record<string, LightLevel>;
}

export interface ExerciseContent {
  panels: string[];
  initial: Record<string, PanelSetup>;
  nodes: ExerciseNode[];
}

export type Visibility = 'private' | 'public';

interface Common {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  content: ExerciseContent;
  updatedAt: number;
}

/** The published version (collection "exercises"). */
export interface Published extends Common {
  visibility: Visibility;
  sharedWith: string[];
  /** Number of times published. */
  version: number;
  publishedAt: number;
  releaseNote: string;
  hasDraft: boolean;
}

/** The draft (collection "drafts"): the only version that can be edited. */
export interface Draft extends Common {
  releaseNote: string;
  /** Version of the published exercise this draft was made from; 0 if never published. */
  basedOn: number;
}

export interface Review {
  id: string;
  exerciseId: string;
  uid: string;
  userName: string;
  stars: number | null;
  comment: string;
  /** Exercise version the review was written against. */
  version: number;
  updatedAt: number;
}

export interface Notice {
  id: string;
  type: 'language';
  exerciseId: string;
  exerciseName: string;
  uid: string;
  userName: string;
  text: string;
  createdAt: number;
  read: boolean;
}

export const COMMENT_LIMIT = 1000;

export function emptyContent(panels: string[]): ExerciseContent {
  return {
    panels,
    initial: {},
    nodes: [
      { id: 'start', kind: 'start', next: 'end' },
      { id: 'end', kind: 'end' },
    ],
  };
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Ids a node leads to. */
export function successors(n: ExerciseNode): string[] {
  if (n.kind === 'end') return [];
  if (n.kind === 'decision') {
    const list = n.answer.type === 'choice' ? n.answer.options : n.answer.ranges;
    return list.map((o) => o.next).filter((x): x is string => Boolean(x));
  }
  return n.next ? [n.next] : [];
}

export function nodeTitle(n: ExerciseNode): string {
  return n.kind === 'start' ? 'Start' : n.kind === 'end' ? 'End' : n.name || (n.kind === 'action' ? 'Untitled action' : 'Untitled decision');
}

/** Problems that stop a draft from being published. */
export function problems(c: ExerciseContent): string[] {
  const out: string[] = [];
  const ids = new Set(c.nodes.map((n) => n.id));
  if (c.panels.length === 0) out.push('Choose at least one panel.');
  for (const n of c.nodes) {
    if (n.kind === 'end') continue;
    if (n.kind !== 'start' && !n.name.trim()) out.push(`A ${n.kind} has no name.`);
    if (n.kind === 'decision') {
      const list = n.answer.type === 'choice' ? n.answer.options : n.answer.ranges;
      if (list.length < 2) out.push(`Decision “${n.name || 'untitled'}” needs at least two answers.`);
      if (list.some((o) => !o.next)) out.push(`Decision “${n.name || 'untitled'}” has an answer that leads nowhere.`);
    } else if (!n.next) out.push(`${nodeTitle(n)} does not lead to a next step.`);
    for (const s of successors(n)) if (!ids.has(s)) out.push(`${nodeTitle(n)} leads to a step that no longer exists.`);
  }
  // every node reachable from start
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = c.nodes.find((x) => x.id === id);
    if (n) successors(n).forEach(walk);
  };
  walk('start');
  const lost = c.nodes.filter((n) => !seen.has(n.id));
  if (lost.length) out.push(`${lost.length} step${lost.length > 1 ? 's are' : ' is'} not reachable from Start: ${lost.map(nodeTitle).join(', ')}.`);
  if (!seen.has('end')) out.push('End cannot be reached from Start.');
  return out;
}

/** Release note suggested from what changed between two versions. */
export function suggestReleaseNote(before: Common | null, after: Common): string {
  if (!before) return 'First version.';
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`Renamed to “${after.name}”.`);
  if (before.description !== after.description) parts.push('Description updated.');
  const a = before.content;
  const b = after.content;
  const added = b.panels.filter((p) => !a.panels.includes(p));
  const removed = a.panels.filter((p) => !b.panels.includes(p));
  if (added.length) parts.push(`Panels added: ${added.join(', ')}.`);
  if (removed.length) parts.push(`Panels removed: ${removed.join(', ')}.`);
  if (JSON.stringify(a.initial) !== JSON.stringify(b.initial)) parts.push('Initial panel state changed.');
  const byId = new Map(a.nodes.map((n) => [n.id, n]));
  const newNodes = b.nodes.filter((n) => !byId.has(n.id));
  const gone = a.nodes.filter((n) => !b.nodes.some((m) => m.id === n.id));
  const changed = b.nodes.filter((n) => byId.has(n.id) && JSON.stringify(byId.get(n.id)) !== JSON.stringify(n));
  if (newNodes.length) parts.push(`Added: ${newNodes.map(nodeTitle).join(', ')}.`);
  if (gone.length) parts.push(`Removed: ${gone.map(nodeTitle).join(', ')}.`);
  if (changed.length) parts.push(`Changed: ${changed.map(nodeTitle).join(', ')}.`);
  return parts.join(' ') || 'No content changes.';
}
