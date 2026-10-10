import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Control, LightLevel, Panel } from '../data/types';
import type { SimState } from '../sim';
import { Schematic } from './Schematic';

export type ViewMode = 'focus' | 'full';
export type Tone = 'neutral' | 'action' | 'check' | 'done';

export interface Highlight {
  control: Control;
  tone: Tone;
  /** Draws attention to the highlight of the line the student selected. */
  pulse?: boolean;
}

interface Props {
  panel: Panel;
  highlights: Highlight[];
  /** Controls the zoomed view should show. Defaults to the highlighted ones. */
  frame?: Control[];
  mode: ViewMode;
  sim: SimState;
  levels: Record<string, LightLevel>;
  onOperate?: (id: string) => void;
  /** Greys the panel out; used for steps that have nothing to highlight on it. */
  dimmed?: boolean;
}

const MAX_ZOOM = 3.4;
/** Smallest share of the panel shown when zoomed in, so the surroundings stay recognisable. */
const MIN_VIEW = 0.3;
const PADDING = 0.06;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Shows the schematic panel with the highlights drawn in a separate overlay
 * layer. Both share one box, so highlights stay aligned at any size or zoom.
 * Zooming resizes that box rather than scaling it, which keeps the drawing sharp.
 */
export function PanelView({ panel, highlights, frame, mode, sim, levels, onOperate, dimmed }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const aspect = panel.width / panel.height;
  const baseW = Math.min(size.w, size.h * aspect);
  const baseH = baseW / aspect;

  let scale = 1;
  let tx = (size.w - baseW) / 2;
  let ty = (size.h - baseH) / 2;

  const rects = (frame ?? highlights.map((h) => h.control)).map((c) => c.rect);
  if (mode === 'focus' && rects.length > 0 && baseW > 0) {
    let x0 = Math.min(...rects.map((r) => r[0]));
    let y0 = Math.min(...rects.map((r) => r[1]));
    let x1 = Math.max(...rects.map((r) => r[0] + r[2]));
    let y1 = Math.max(...rects.map((r) => r[1] + r[3]));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const w = Math.max(x1 - x0 + 2 * PADDING, MIN_VIEW);
    const h = Math.max(y1 - y0 + 2 * PADDING, MIN_VIEW);
    x0 = cx - w / 2;
    x1 = cx + w / 2;
    y0 = cy - h / 2;
    y1 = cy + h / 2;

    scale = clamp(Math.min(size.w / (w * baseW), size.h / (h * baseH)), 1, MAX_ZOOM);
    const scaledW = baseW * scale;
    const scaledH = baseH * scale;
    tx = scaledW <= size.w ? (size.w - scaledW) / 2 : clamp(size.w / 2 - cx * scaledW, size.w - scaledW, 0);
    ty = scaledH <= size.h ? (size.h - scaledH) / 2 : clamp(size.h / 2 - cy * scaledH, size.h - scaledH, 0);
  }

  const layerStyle: CSSProperties = {
    width: baseW * scale,
    height: baseH * scale,
    transform: `translate(${tx}px, ${ty}px)`,
  };

  return (
    <div className="panel-view" ref={ref}>
      {baseW > 0 && (
        <div className={`panel-layer${dimmed ? ' is-dimmed' : ''}`} style={layerStyle}>
          <Schematic schematic={panel.schematic} sim={sim} levels={levels} onOperate={onOperate} />
          {highlights.map((h, i) => (
            <div
              key={`${h.control.label}-${i}`}
              className={`highlight highlight-${h.control.kind} tone-${h.tone}${h.pulse ? ' is-pulsing' : ''}`}
              style={{
                left: `${h.control.rect[0] * 100}%`,
                top: `${h.control.rect[1] * 100}%`,
                width: `${h.control.rect[2] * 100}%`,
                height: `${h.control.rect[3] * 100}%`,
              }}
            >
              <span />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
