/** Rectangle normalised to the panel image: [x, y, width, height], each 0..1. */
export type NormRect = [number, number, number, number];

export type ControlKind = 'region' | 'switch' | 'selector' | 'light' | 'gauge';

export interface Control {
  label: string;
  kind: ControlKind;
  rect: NormRect;
  /** Present when the mapping needs a human to confirm it. */
  reviewNote?: string;
}

export interface Panel {
  id: string;
  name: string;
  image: string;
  /** Pixel size of the image asset; only the aspect ratio matters to the UI. */
  width: number;
  height: number;
  controls: Record<string, Control>;
}

export type StepType = 'section' | 'action' | 'check' | 'note' | 'choice';

export interface StepNote {
  kind: 'note' | 'caution';
  text: string;
}

export interface StepChoice {
  label: string;
  next: string;
}

export interface Step {
  id: string;
  type: StepType;
  /** Indentation level in the source: 1 = dotted-leader item, 2 and 3 = sub-items. */
  level: 1 | 2 | 3;
  /** Id of the level-1 step this one belongs to. */
  group?: string;
  /** Control or item name, in the source's wording. */
  title: string;
  /** Required position, value or condition, in the source's wording. */
  target?: string;
  body?: string[];
  bullets?: string[];
  notes?: StepNote[];
  /** Panel the controls are on; defaults to the procedure's defaultPanel. */
  panel?: string;
  controls?: string[];
  /** Why the step has no highlight: the item is on a panel with no image yet, or it is information only. */
  textOnly?: 'off-panel' | 'info';
  pdfPage: number;
  ref: string;
  /** Explicit next step. Omitted = the following step in the list. */
  next?: string;
  /** For type "choice": the student picks one and the walkthrough continues at its `next`. */
  choices?: StepChoice[];
}

export interface Procedure {
  id: string;
  title: string;
  summary: string;
  source: {
    document: string;
    chapter: string;
    manualPages: string;
    pdfPages: string;
    revision: string;
  };
  defaultPanel: string;
  steps: Step[];
}
