import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { elementControl, elementLabel, panels } from '../data';
import type { Tone } from '../components/PanelView';
import { Schematic } from '../components/Schematic';
import { initialSim, operate, stateWord, type SimState } from '../sim';
import { usePanel } from '../usePanel';
import type { PanelSetup, SubStep } from './model';

/** Panel state for each panel of an exercise, started from its setup. */
export function startSims(panelIds: string[], initial: Record<string, PanelSetup>): Record<string, SimState> {
  return Object.fromEntries(
    panelIds.map((id) => {
      const fresh = initialSim(panels[id].schematic);
      const setup = initial[id];
      return [id, setup ? { ...fresh, pos: { ...fresh.pos, ...setup.pos }, override: { ...setup.override } } : fresh];
    }),
  );
}

export function subStepLabel(panelId: string, control: string, value: string): string {
  const panel = panels[panelId];
  const sw = panel.schematic.switches.find((s) => s.id === control);
  if (value === 'PUSH') return `${elementLabel(panel, control)}: push`;
  if (sw?.style === 'select') return `${sw.label}: push`;
  const p = sw?.positions?.find((q) => q.id === value);
  return `${elementLabel(panel, control)}: ${p?.label ?? stateWord(value)}`;
}

interface Props {
  panelIds: string[];
  sims: Record<string, SimState>;
  setSims: (u: (all: Record<string, SimState>) => Record<string, SimState>) => void;
  /** Something the user did on a panel (lights are not actions). */
  onAction?: (s: SubStep) => void;
  /** A light was tapped. */
  onLightTap?: (panel: string, light: string) => void;
  /** Elements to highlight, per panel. */
  highlight?: { panel: string; control: string; tone: Tone }[];
  active?: string;
  onActive?: (id: string) => void;
}

const MAX_ZOOM = 5;

/**
 * The panels of an exercise, one shown at a time, with tabs to move between
 * them. The panel can be zoomed and scrolled; zooming resizes the drawing
 * rather than scaling it, so it stays sharp.
 */
export function WorkPanels({ panelIds, sims, setSims, onAction, onLightTap, highlight = [], active, onActive }: Props) {
  const [own, setOwn] = useState(panelIds[0]);
  const current = active && panelIds.includes(active) ? active : panelIds.includes(own) ? own : panelIds[0];
  const panel = panels[current];
  const sim = sims[current];
  const setSim = (u: (s: SimState) => SimState) => setSims((all) => ({ ...all, [current]: u(all[current]) }));
  const p = usePanel(panel, sim, setSim);

  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  const [zoom, setZoom] = useState(1);
  const view = panel.schematic.view ?? [0, 0, panel.schematic.width, panel.schematic.height];
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setFit(Math.max(200, Math.min(el.clientWidth, (el.clientHeight * view[2]) / view[3])));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const mine = highlight.filter((h) => h.panel === current);
  const marks = mine.map((h) => ({ h, c: elementControl(panel, h.control) })).filter((m) => m.c);
  const markKey = mine.map((h) => h.control).join(',');

  // bring a highlighted control into view when it changes
  useEffect(() => {
    const el = stage.current?.querySelector('.highlight');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [markKey, zoom, current]);

  function setZoomAt(z: number) {
    const el = stage.current;
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    if (!el) return setZoom(next);
    // keep the centre of the view in place
    const cx = (el.scrollLeft + el.clientWidth / 2) / (fit * zoom);
    const cy = (el.scrollTop + el.clientHeight / 2) / ((fit * zoom * view[3]) / view[2]);
    setZoom(next);
    requestAnimationFrame(() => {
      el.scrollLeft = cx * fit * next - el.clientWidth / 2;
      el.scrollTop = cy * ((fit * next * view[3]) / view[2]) - el.clientHeight / 2;
    });
  }

  const pick = (id: string) => {
    if (onActive) onActive(id);
    else setOwn(id);
    setZoom(1);
  };
  const elsewhere = highlight.filter((h) => h.panel !== current).map((h) => h.panel);

  return (
    <section className="work">
      {panelIds.length > 1 && (
        <div className="tabs work-tabs" role="tablist" aria-label="Panels of this exercise">
          {panelIds.map((id) => (
            <button key={id} role="tab" aria-selected={id === current} className={`tab${id === current ? ' is-active' : ''}`} onClick={() => pick(id)}>
              {panels[id].name}
              {elsewhere.includes(id) && <span className="dot" aria-label="has a highlighted control" />}
            </button>
          ))}
        </div>
      )}
      <div
        className="work-stage"
        ref={stage}
        onWheel={(e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          setZoomAt(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
        }}
      >
        {fit > 0 && (
          <div className="work-layer" style={{ width: Math.floor(fit * zoom) - 2 }}>
            <Schematic
              schematic={panel.schematic}
              sim={sim}
              levels={p.levels}
              onOperate={(id) => {
                const sw = panel.schematic.switches.find((s) => s.id === id);
                p.onOperate(id);
                if (!onAction || !sw) return;
                if (sw.style === 'select') onAction({ panel: current, control: id, value: 'PUSH', label: subStepLabel(current, id, 'PUSH') });
                else {
                  const value = operate(panel.schematic, sim, id).pos[id];
                  onAction({ panel: current, control: id, value, label: subStepLabel(current, id, value) });
                }
              }}
              onPress={(id) => {
                p.onPress(id);
                onAction?.({ panel: current, control: id, value: 'PUSH', label: subStepLabel(current, id, 'PUSH') });
              }}
              onRelease={p.onRelease}
              onLight={(id) => {
                p.onLight(id);
                onLightTap?.(current, id);
              }}
            />
            {marks.map(({ h, c }, i) => (
              <div
                key={`${h.control}-${i}`}
                className={`highlight highlight-${c!.kind} tone-${h.tone} is-pulsing`}
                style={{ left: `${c!.rect[0] * 100}%`, top: `${c!.rect[1] * 100}%`, width: `${c!.rect[2] * 100}%`, height: `${c!.rect[3] * 100}%` }}
              >
                <span />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="work-bar">
        <span className="panel-name" aria-live="polite">
          {p.effect?.message ?? p.lastOp ?? `${panel.name}: tap a switch to move it, or a light to change how it looks`}
        </span>
        <div className="zoom">
          <button className="btn btn-sm" aria-label="Zoom out" onClick={() => setZoomAt(zoom / 1.4)} disabled={zoom <= 1}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button className="btn btn-sm" aria-label="Zoom in" onClick={() => setZoomAt(zoom * 1.4)} disabled={zoom >= MAX_ZOOM}>
            +
          </button>
          <button className="btn btn-sm btn-quiet" onClick={() => setZoom(1)} disabled={zoom === 1}>
            Fit
          </button>
        </div>
      </div>
    </section>
  );
}
