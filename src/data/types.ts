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

// ---------- schematic panel ----------

export type LightColor = 'amber' | 'blue' | 'green';
export type LightLevel = 'off' | 'dim' | 'on';

/** All listed switches must be in (one of) the given position(s). */
export type Cond = Record<string, string | string[]>;

export interface LightRule {
  /** The rule applies when any one of these conditions holds. */
  when: Cond[];
  then: LightLevel;
}

export interface LightEl {
  id: string;
  /** Pixel rectangle in the schematic's own coordinate space. */
  rect: [number, number, number, number];
  lines: string[];
  color: LightColor;
  /** First matching rule wins; `base` applies when none matches. Lights with neither are always extinguished. */
  rules?: LightRule[];
  base?: LightLevel;
  /** Where the behaviour comes from. */
  source?: string;
}

export type Dir = 'up' | 'down' | 'left' | 'right' | 'center';

export interface SwitchPosition {
  id: string;
  /** Lever direction for toggles. */
  dir?: Dir;
  /** Pointer angle in degrees for rotary selectors, 0 = up, clockwise. */
  angle?: number;
}

export interface SwitchEl {
  id: string;
  label: string;
  style: 'toggle' | 'guard' | 'knob' | 'button';
  x: number;
  y: number;
  r: number;
  /** Two or more positions make the control operable. */
  positions?: SwitchPosition[];
  initial?: string;
  /** Guarded switches: size and colour of the guard. Only the guard moves in this POC. */
  guard?: { w: number; h: number; color: 'black' | 'red' };
  /** Rotary selector drawn with a bar across it instead of a pointer. */
  bar?: boolean;
  /** Fixed pointer angle for controls that are not operable. */
  pointer?: number;
  tone?: 'light' | 'dark' | 'red';
}

export interface PlateEl {
  rect: [number, number, number, number];
  tone: 'dark' | 'light' | 'black' | 'base';
  r?: number;
}

export interface TextEl {
  x: number;
  y: number;
  text: string;
  size: number;
  anchor: 'start' | 'middle' | 'end';
  tone: 'light' | 'dark' | 'dim';
  rotate?: number;
}

export interface LineEl {
  points: [number, number][];
  tone: 'light' | 'dark';
  width: number;
}

export interface GaugeEl {
  x: number;
  y: number;
  r: number;
  label: string[];
  needle: number;
}

export interface Schematic {
  width: number;
  height: number;
  plates: PlateEl[];
  lines: LineEl[];
  texts: TextEl[];
  gauges: GaugeEl[];
  lights: LightEl[];
  switches: SwitchEl[];
}

export interface Panel {
  id: string;
  name: string;
  /** Reference photo the control positions were measured on. */
  image: string;
  /** Pixel size of the photo; the schematic uses the same coordinate space. */
  width: number;
  height: number;
  controls: Record<string, Control>;
  schematic: Schematic;
}

// ---------- procedures ----------

export type StepType = 'section' | 'action' | 'check' | 'note' | 'choice';

export interface StepNote {
  kind: 'note' | 'caution';
  text: string;
}

export interface StepChoice {
  label: string;
  next: string;
}

/**
 * State the practice panel must show for a step to count as done: switch id ->
 * position (or any of several), light id -> "off" | "dim" | "on", guarded
 * switch id -> "closed".
 */
export type Expect = Record<string, string | string[]>;

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
  /** Short name used when several checks are merged into one line. */
  short?: string;
  body?: string[];
  bullets?: string[];
  notes?: StepNote[];
  /** Panel the controls are on; defaults to the procedure's defaultPanel. */
  panel?: string;
  controls?: string[];
  /** Why the step has no highlight: the item is on a panel with no image yet, or it is information only. */
  textOnly?: 'off-panel' | 'info';
  expect?: Expect;
  /** The expectation only applies while this condition holds on the panel. */
  when?: Cond;
  pdfPage: number;
  ref: string;
  /** Explicit next step. Omitted = the following step in the list. */
  next?: string;
  /** For type "choice": the student picks one and the walkthrough continues at its `next`. */
  choices?: StepChoice[];
}

/** One line of a grouped practice section, written by hand. */
export interface PracticeItemDef {
  text: string;
  detail?: string;
  /** Detailed steps this line stands for; their controls and expectations are combined. */
  steps: string[];
}

export interface PracticeSectionDef {
  id: string;
  title: string;
  /** Detailed steps covered by this section, in source order. */
  steps: string[];
  /** Initial state of the sub-panel, as described by the instructor. */
  initial?: string;
  /** When given, these replace the automatically grouped lines. */
  actions?: PracticeItemDef[];
  checks?: PracticeItemDef[];
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
  practice: PracticeSectionDef[];
}
