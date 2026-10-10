import { useMemo, useState } from 'react';
import { isMapped, panels, stepControls } from '../data';
import type { Procedure } from '../data/types';
import { initialSim, lightLevels } from '../sim';
import { Schematic } from './Schematic';

interface Props {
  procedure: Procedure;
  onClose: () => void;
}

/**
 * Mapping review: every highlight of a panel drawn at once, so a person who
 * knows the flight deck can confirm or correct the coordinates.
 */
export function Review({ procedure, onClose }: Props) {
  const panel = panels[procedure.defaultPanel];
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'schematic' | 'photo'>('schematic');
  const sim = useMemo(() => initialSim(panel.schematic), [panel]);
  const levels = useMemo(() => lightLevels(panel.schematic, sim), [panel, sim]);
  const entries = Object.entries(panel.controls);
  const flagged = entries.filter(([, c]) => c.reviewNote);
  const used = new Set(procedure.steps.flatMap((s) => s.controls ?? []));

  return (
    <div className="review">
      <header className="topbar">
        <div className="topbar-title">
          <strong>Mapping review</strong>
          <span>{panel.name}</span>
        </div>
        <button className="btn btn-quiet" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="review-body">
        <p className="review-intro">
          All {entries.length} mapped positions are shown. Tap a box to see what it is meant to mark. Positions were
          measured on the reference photo, and the schematic is drawn from the same measurements; they have not yet
          been confirmed by an instructor. The schematic shows the panel in its initial state.
        </p>

        <p className="review-selected" aria-live="polite">
          {selected ? (
            <>
              <b>{panel.controls[selected].label}</b> <code>{selected}</code>
              {panel.controls[selected].reviewNote && <em> — {panel.controls[selected].reviewNote}</em>}
            </>
          ) : (
            'No box selected.'
          )}
        </p>

        <div className="home-actions">
          <button className="btn btn-quiet" onClick={() => setView(view === 'photo' ? 'schematic' : 'photo')}>
            {view === 'photo' ? 'Show the schematic' : 'Show the reference photo'}
          </button>
        </div>

        <div className="review-panel" style={{ aspectRatio: `${panel.width} / ${panel.height}` }}>
          {view === 'photo' ? (
            <img src={panel.image} alt={panel.name} draggable={false} />
          ) : (
            <Schematic schematic={panel.schematic} sim={sim} levels={levels} />
          )}
          {entries.map(([id, c]) => (
            <button
              key={id}
              type="button"
              aria-label={c.label}
              title={c.label}
              className={`review-box review-${c.kind}${selected === id ? ' is-selected' : ''}${c.reviewNote ? ' is-flagged' : ''}`}
              style={{
                left: `${c.rect[0] * 100}%`,
                top: `${c.rect[1] * 100}%`,
                width: `${c.rect[2] * 100}%`,
                height: `${c.rect[3] * 100}%`,
              }}
              onClick={() => setSelected(id)}
            />
          ))}
        </div>

        {flagged.length > 0 && (
          <>
            <h3>Flagged for confirmation</h3>
            <ul className="review-list">
              {flagged.map(([id, c]) => (
                <li key={id}>
                  <button className="link" onClick={() => setSelected(id)}>
                    {c.label}
                  </button>
                  : {c.reviewNote}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3>Steps and their mapping</h3>
        <table className="review-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Step</th>
              <th>Highlights</th>
            </tr>
          </thead>
          <tbody>
            {procedure.steps.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>
                  {s.title}
                  {s.target && <span className="muted"> — {s.target}</span>}
                </td>
                <td>
                  {isMapped(procedure, s) ? (
                    s.controls!.map((id, j) => (
                      <span key={id}>
                        {j > 0 && ', '}
                        <button className="link" onClick={() => setSelected(id)}>
                          {stepControls(procedure, s)[j]?.label ?? id}
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="muted">{s.textOnly === 'info' ? 'Information only' : 'Text-only (not on this panel)'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted">
          {entries.filter(([id]) => !used.has(id)).length} mapped positions are not used by this procedure.
        </p>
      </div>
    </div>
  );
}
