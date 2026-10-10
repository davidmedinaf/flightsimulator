import type { Control, Procedure, Step } from '../data/types';

const TYPE_LABEL: Record<Step['type'], string> = {
  section: 'Section',
  action: 'Action',
  check: 'Check',
  note: 'Information',
  choice: 'Decision',
};

interface Props {
  procedure: Procedure;
  step: Step;
  controls: Control[];
  panelName?: string;
}

export function StepCard({ procedure, step, controls, panelName }: Props) {
  const group = step.group ? procedure.steps.find((s) => s.id === step.group) : undefined;
  const mapped = controls.length > 0;
  const reviewNotes = controls.filter((c) => c.reviewNote);

  return (
    <article className="step">
      {group && (
        <p className="step-group">
          {group.title}
          {group.target && <span> … {group.target}</span>}
        </p>
      )}

      <span className={`badge badge-${step.type}`}>{TYPE_LABEL[step.type]}</span>

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

      {step.notes?.map((n) => (
        <p className={`callout callout-${n.kind}`} key={n.text}>
          <strong>{n.kind === 'caution' ? 'CAUTION:' : 'Note:'}</strong> {n.text}
        </p>
      ))}

      {step.type === 'check' && (
        <p className="self-check">
          Confirm this yourself in the simulator. This app is not connected to it and cannot see its state.
        </p>
      )}

      <div className="step-meta">
        {mapped ? (
          <p className="status status-mapped">
            <b>Mapped to panel image</b>
            <span>
              {panelName}: {controls.map((c) => c.label).join(', ')}
            </span>
          </p>
        ) : step.textOnly === 'info' ? (
          <p className="status status-text">
            <b>Information only</b>
            <span>Nothing to highlight for this item.</span>
          </p>
        ) : (
          <p className="status status-text">
            <b>Text-only step in this POC</b>
            <span>This item is not on the forward overhead panel, and no image of its panel is available yet.</span>
          </p>
        )}

        {reviewNotes.map((c) => (
          <p className="status status-review" key={c.label}>
            <b>Mapping to be confirmed</b>
            <span>{c.reviewNote}</span>
          </p>
        ))}

        <p className="step-source">
          Source: FCOM {step.ref} · PDF page {step.pdfPage}
        </p>
      </div>
    </article>
  );
}
