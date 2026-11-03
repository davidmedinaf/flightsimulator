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

export type LightColor = 'amber' | 'blue' | 'green' | 'white';
export type LightLevel = 'off' | 'dim' | 'on';

/** All listed switches must be in (one of) the given position(s). */
export type Cond = Record<string, string | string[]>;

export interface LightRule {
  /** The rule applies when any one of these conditions holds. */
  when: Cond[];
  then: LightLevel;
}

/** What light logic and displays can read about the panel. */
export interface SimView {
  pos: Record<string, string>;
  held: Record<string, boolean>;
  data: PanelData;
  /** Seconds since the switch last moved (Infinity if it never did). */
  since: (id: string) => number;
  /** Position the switch was in before its last move. */
  from: (id: string) => string | undefined;
}

/** Free-form panel memory, e.g. what is being keyed on a keyboard. */
export type PanelData = Record<string, unknown>;

export interface LightEl {
  id: string;
  /** Pixel rectangle in the schematic's own coordinate space. */
  rect: [number, number, number, number] | null;
  /** Drawn as this polygon instead of a rectangle. */
  poly?: [number, number][];
  lines: string[];
  color: LightColor;
  /** Readable name; defaults to the legend. */
  name?: string;
  /** First matching rule wins; `base` applies when none matches. Lights with neither are always extinguished. */
  rules?: LightRule[];
  base?: LightLevel;
  /** Logic written as code, for behaviour rules cannot express (timing, keyboards). */
  logic?: (v: SimView) => LightLevel;
  /** Forces the light on, e.g. while a test button is held. */
  test?: (v: SimView) => boolean;
  /** Small round indicator instead of a lens. */
  dot?: boolean;
  /** Three bars instead of a legend (transmitter selectors). */
  glyph?: 'bars' | 'dots';
  /** No bezel; the light sits inside another control. */
  bare?: boolean;
  /** Selecting the light shows this virtual condition instead (e.g. LE devices position). */
  group?: string;
  region?: string;
  /** Where the behaviour comes from. */
  source?: string;
}

export type Dir = 'up' | 'down' | 'left' | 'right' | 'center';

export interface SwitchPosition {
  id: string;
  /** Readable name when it differs from the id. */
  label?: string;
  /** Lever direction for toggles and guarded switches. */
  dir?: Dir;
  /** Pointer angle in degrees for rotary selectors, 0 = up, clockwise. */
  angle?: number;
}

export type SwitchStyle = 'toggle' | 'guarded' | 'knob' | 'button' | 'push' | 'key' | 'switchlight' | 'select';

export interface SwitchEl {
  id: string;
  label: string;
  style: SwitchStyle;
  x: number;
  y: number;
  r: number;
  /** Two or more positions make the control operable. Guarded switches: "closed" first, then the open positions. */
  positions?: SwitchPosition[];
  initial?: string;
  /** Acts only while held (push buttons, keys). */
  momentary?: boolean;
  /** Guarded switches: size and colour of the guard. */
  guard?: { w: number; h: number; color: 'black' | 'red' };
  /** Rotary selector drawn with a bar across it instead of a pointer. */
  bar?: boolean;
  /** Fixed pointer angle for knobs without positions. */
  pointer?: number;
  tone?: 'light' | 'dark' | 'red';
  /** Tap area, when it differs from the drawn control. */
  hit?: [number, number, number, number];
  /** Keys: legend, size. */
  legend?: string;
  size?: number;
  /** Buttons: positions in which the button is latched in. */
  latched?: string[];
  /** Knobs: positions in which the knob is pulled out (switched on). */
  pulled?: string[];
  /** Selector buttons: the virtual switch they set, and to what. */
  group?: string;
  value?: string;
  /** Called when a momentary control is pressed; may change panel memory. */
  act?: (data: PanelData, v: SimView) => PanelData;
  /** Sound or message while held. */
  effect?: { sound: 'clacker' | 'shaker'; message: string };
  desc?: [string, string][];
  caution?: string;
  region?: string;
  source?: string;
}

/** A condition outside the panel that can be set to see its effect (e.g. LE devices position). */
export interface VirtualEl {
  id: string;
  label: string;
  positions: SwitchPosition[];
  initial?: string;
  box?: [number, number, number, number];
  note?: string;
  region?: string;
  desc?: [string, string][];
  source?: string;
}

export interface PlateEl {
  rect: [number, number, number, number];
  tone: 'dark' | 'light' | 'black' | 'base';
  r?: number;
  screws?: boolean;
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
  tone: 'light' | 'dark' | 'shadow';
  width: number;
}

export interface GaugeEl {
  x: number;
  y: number;
  r: number;
  label: string[];
  /** Needle angle in degrees, 0 = up, clockwise. */
  needle: number;
  labelAt?: number;
  hub?: number;
  scale?: { start: number; end: number; major: number; minor: number; numbers?: string[] };
}

export interface DisplayEl {
  rect: [number, number, number, number];
  value: (v: SimView) => string;
}

export interface Schematic {
  width: number;
  height: number;
  /** Part of the drawing to show: [x, y, w, h]. Defaults to the whole of it. */
  view?: [number, number, number, number];
  plates: PlateEl[];
  lines: LineEl[];
  texts: TextEl[];
  gauges: GaugeEl[];
  lights: LightEl[];
  switches: SwitchEl[];
  displays?: DisplayEl[];
  virtual?: VirtualEl[];
  regions?: { label: string; rect: [number, number, number, number] }[];
  /** Legends are positioned on their vertical centre (forward panel data) instead of their baseline. */
  centredText?: boolean;
  /** Panel-wide light, e.g. the dome light, drawn over everything. */
  flood?: (v: SimView) => number;
  /** True while something on the panel changes with time, so it keeps redrawing. */
  timed?: (v: SimView) => boolean;
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
