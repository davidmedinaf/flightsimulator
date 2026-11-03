import { useState } from 'react';
import { elementControl, elementLabel, panels } from '../data';
import { PanelView, type Highlight, type Tone } from '../components/PanelView';
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

/** The panels of an exercise, one shown at a time, with tabs to move between them. */
export function WorkPanels({ panelIds, sims, setSims, onAction, onLightTap, highlight = [], active, onActive }: Props) {
  const [own, setOwn] = useState(panelIds[0]);
  const current = active && panelIds.includes(active) ? active : panelIds.includes(own) ? own : panelIds[0];
  const panel = panels[current];
  const sim = sims[current];
  const setSim = (u: (s: SimState) => SimState) => setSims((all) => ({ ...all, [current]: u(all[current]) }));
  const p = usePanel(panel, sim, setSim);

  const highlights: Highlight[] = highlight
    .filter((h) => h.panel === current)
    .map((h) => ({ control: elementControl(panel, h.control)!, tone: h.tone, pulse: true }))
    .filter((h) => h.control);

  const pick = (id: string) => (onActive ? onActive(id) : setOwn(id));
  const elsewhere = highlight.filter((h) => h.panel !== current).map((h) => h.panel);

  return (
    <section className="panel-area work">
      {panelIds.length > 1 && (
        <div className="tabs work-tabs" role="tablist">
          {panelIds.map((id) => (
            <button key={id} role="tab" aria-selected={id === current} className={`tab${id === current ? ' is-active' : ''}`} onClick={() => pick(id)}>
              {panels[id].name}
              {elsewhere.includes(id) && <span className="dot" aria-label="has a highlighted control" />}
            </button>
          ))}
        </div>
      )}
      <PanelView
        panel={panel}
        highlights={highlights}
        mode="full"
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
      <div className="panel-chrome">
        <span className="panel-name" aria-live="polite">
          {p.effect?.message ?? p.lastOp ?? `${panel.name}: tap a switch to move it, or a light to change how it looks`}
        </span>
      </div>
    </section>
  );
}
