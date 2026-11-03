import { useLayoutEffect, useRef, useState } from 'react';
import { panels } from '../data';
import { initialSim, loadSim, saveSim, type SimState } from '../sim';
import { usePanel } from '../usePanel';
import { Schematic } from './Schematic';

interface Props {
  initialPanel?: string;
  onClose: () => void;
  disclaimer: string;
}

const ORDER = ['fwd-overhead', 'aft-overhead'];
const key = (id: string) => `procedure-trainer:explore:${id}`;

/** Free play: every panel, every control operable, no exercise. */
export function Explorer({ initialPanel, onClose, disclaimer }: Props) {
  const [panelId, setPanelId] = useState(initialPanel && ORDER.includes(initialPanel) ? initialPanel : ORDER[0]);
  const panel = panels[panelId];
  const [sims, setSims] = useState<Record<string, SimState>>(() =>
    Object.fromEntries(ORDER.map((id) => [id, loadSim(panels[id].schematic, key(id))])),
  );
  const sim = sims[panelId];
  const setSim = (u: (s: SimState) => SimState) =>
    setSims((all) => {
      const next = u(all[panelId]);
      saveSim(next, key(panelId));
      return { ...all, [panelId]: next };
    });
  const p = usePanel(panel, sim, setSim);

  // zoom: the drawing is resized, not scaled, so it stays sharp
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  const [zoom, setZoom] = useState(1);
  const view = panel.schematic.view ?? [0, 0, panel.schematic.width, panel.schematic.height];
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setFit(Math.min(el.clientWidth, (el.clientHeight * view[2]) / view[3]));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  return (
    <div className={`explore${p.effect?.shake ? ' is-shaking' : ''}`}>
      <header className="topbar">
        <div className="topbar-title">
          <strong>Panels</strong>
          <span>Free play: operate anything</span>
        </div>
        <div className="tabs" role="tablist">
          {ORDER.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={id === panelId}
              className={`tab${id === panelId ? ' is-active' : ''}`}
              onClick={() => {
                setPanelId(id);
                setZoom(1);
                p.setLastOp(null);
              }}
            >
              {panels[id].name}
            </button>
          ))}
        </div>
        <div className="topbar-actions">
          <button className="btn btn-quiet" aria-pressed={Boolean(sim.test)} onClick={() => setSim((s) => ({ ...s, test: !s.test }))}>
            Lights test
          </button>
          <button className="btn btn-quiet" onClick={() => setSim(() => initialSim(panel.schematic))}>
            Reset panel
          </button>
          <button className="btn btn-quiet" onClick={onClose}>
            Home
          </button>
        </div>
      </header>
      <main className="explore-stage" ref={stage}>
        {fit > 0 && (
          <div className="explore-panel" style={{ width: Math.floor(fit * zoom) - 2 }}>
            <Schematic
              schematic={panel.schematic}
              sim={sim}
              levels={p.levels}
              onOperate={p.onOperate}
              onPress={p.onPress}
              onRelease={p.onRelease}
              onLight={p.onLight}
            />
          </div>
        )}
      </main>
      <div className="explore-bar">
        <span className="panel-name" aria-live="polite">
          {p.effect?.message ?? p.lastOp ?? 'Tap a switch to move it, or a light to preview its states.'}
        </span>
        <div className="zoom">
          <button className="btn btn-overlay" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z / 1.4))}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button className="btn btn-overlay" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z * 1.4))}>
            +
          </button>
        </div>
      </div>
      <footer className="footer">{disclaimer}</footer>
    </div>
  );
}
