import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Control, Panel } from '../data/types';

export type ViewMode = 'focus' | 'full';

interface Props {
  panel: Panel;
  highlights: Control[];
  mode: ViewMode;
  /** Greys the image out; used for steps that have nothing to highlight on this panel. */
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
 * Shows the panel image with the highlights drawn in a separate overlay layer.
 * Image and overlay share one transformed box, so highlights stay aligned at
 * any size or zoom, and the image is never stretched.
 */
export function PanelView({ panel, highlights, mode, dimmed }: Props) {
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

  if (mode === 'focus' && highlights.length > 0 && baseW > 0) {
    let x0 = Math.min(...highlights.map((c) => c.rect[0]));
    let y0 = Math.min(...highlights.map((c) => c.rect[1]));
    let x1 = Math.max(...highlights.map((c) => c.rect[0] + c.rect[2]));
    let y1 = Math.max(...highlights.map((c) => c.rect[1] + c.rect[3]));
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

  const layerStyle = {
    width: baseW,
    height: baseH,
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    '--k': 1 / scale,
  } as CSSProperties;

  return (
    <div className="panel-view" ref={ref}>
      {baseW > 0 && (
        <div className={`panel-layer${dimmed ? ' is-dimmed' : ''}`} style={layerStyle}>
          <img src={panel.image} alt={panel.name} draggable={false} />
          {highlights.map((c, i) => (
            <div
              key={`${c.label}-${i}`}
              className={`highlight highlight-${c.kind}`}
              style={{
                left: `${c.rect[0] * 100}%`,
                top: `${c.rect[1] * 100}%`,
                width: `${c.rect[2] * 100}%`,
                height: `${c.rect[3] * 100}%`,
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
