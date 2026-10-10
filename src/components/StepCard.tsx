import { useState } from 'react';
import { elementLabel } from '../data';
import type { Control, LightLevel, Panel, Step, StepNote } from '../data/types';
import { conditionHolds, mismatches, stateWord, type Mismatch, type SimState } from '../sim';

export const TYPE_LABEL: Record<Step['type'], string> = {
  section: 'Section',
  action: 'Action',
  check: 'Check',
  note: 'Information',
  choice: 'Decision',
};

export const PRACTICE_PANEL_NOTE =
  'The panel in this app is a practice panel. It is not connected to the simulator and cannot see its state: confirm the real switches and lights in the simulator.';

export function Notes({ notes }: { notes: StepNote[] }) {
  return (
    <>
      {notes.map((n) => (
        <p className={`callout callout-${n.kind}`} key={n.text}>
          <strong>{n.kind === 'caution' ? 'CAUTION:' : 'Note:'}</strong> {n.text}
        </p>
      ))}
    </>
  );
}

export function MismatchList({ panel, list }: { panel: Panel; list: Mismatch[] }) {
  return (
    <ul className="mismatches">
      {list.map((m) => (
        <li key={m.id}>
          {elementLabel(panel, m.id)}: <b>{stateWord(m.have)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Where the behaviour of the lights a step relies on comes from. */
export function lightSources(panel: Panel, ids: string[]): string[] {
  const sources = ids.map((id) => panel.schematic.lights.find((l) => l.id === id)?.source);
  return [...new Set(sources.filter((s): s is string => Boolean(s)))];
}

interface Props {
  step: Step;
  panel: Panel | undefined;
  controls: Control[];
  sim: SimState;
  levels: Record<string, LightLevel>;
}

/** The current step in full. Secondary details stay behind the information button. */
export function StepCard({ step, panel, controls, sim, levels }: Props) {
  const [info, setInfo] = useState(false);
  const reviewNotes = controls.filter((c) => c.reviewNote);
  const applies = conditionHolds(sim, step.when);
  const missing = step.expect && panel ? mismatches(step.expect, sim, levels) : null;
  const sources = panel && step.expect ? lightSources(panel, Object.keys(step.expect)) : [];

  return (
    <article className="step">
      <div className="step-top">
        <span className={`badge badge-${step.type}`}>{TYPE_LABEL[step.type]}</span>
        <button
          className={`info-btn${info ? ' is-open' : ''}`}
          aria-expanded={info}
          aria-label="More about this step"
          onClick={() => setInfo(!info)}
        >
          i
        </button>
      </div>

      <h2 className="step-title">{step.title}</h2>
      {step.target && <p className="step-target">{step.target}</p>}

      {step.body?.map((p) => (
        <p className="step-body" key={p}>
          {p}
        </p>
      ))}

      {step.bullets && (
        <ul className="step-bullets">
          {step.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      <Notes notes={step.notes ?? []} />

      {step.textOnly === 'off-panel' && <p className="panel-state">Not on this panel: check it in the simulator.</p>}
      {missing && panel && !applies &&<p className="panel-state">Does not apply with the panel as it is now.</p>}
      {missing && panel && applies && missing.length === 0 && (
        <p className="panel-state is-ok">{step.type === 'check' ? 'The panel shows this.' : 'Set on the panel.'}</p>
      )}
      {missing && panel && applies && missing.length > 0 && (
        <div className="panel-state is-todo">
          {step.type === 'check' ? 'The panel does not show this yet:' : 'Not set yet. Tap the highlighted control:'}
          <MismatchList panel={panel} list={missing} />
        </div>
      )}

      {info && (
        <div className="step-meta">
          <p>{PRACTICE_PANEL_NOTE}</p>
          {controls.length > 0 ? (
            <p>
              <b>Highlighted:</b> {controls.map((c) => c.label).join(', ')}
            </p>
          ) : (
            <p>
              <b>{step.textOnly === 'info' ? 'Information only.' : 'Text-only step.'}</b>{' '}
              {step.textOnly === 'info'
                ? 'Nothing to highlight for this item.'
                : 'This item is not on the forward overhead panel, and no drawing of its panel is available yet.'}
            </p>
          )}
          {reviewNotes.map((c) => (
            <p className="meta-review" key={c.label}>
              <b>Mapping to be confirmed:</b> {c.reviewNote}
            </p>
          ))}
          {sources.map((s) => (
            <p key={s}>
              <b>Panel behaviour:</b> {s}
            </p>
          ))}
          <p className="step-source">
            Source: FCOM {step.ref} · PDF page {step.pdfPage}
          </p>
        </div>
      )}
    </article>
  );
}
