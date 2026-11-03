import { panels } from '../data';
import type { ExerciseNode } from './model';
import { nodeTitle } from './model';

/** Everything about one step of an exercise, for reading before or after playing it. */
export function NodeDetails({ node, nodes, onSelect }: { node: ExerciseNode; nodes: ExerciseNode[]; onSelect: (id: string) => void }) {
  const title = (id?: string) => {
    const n = nodes.find((x) => x.id === id);
    return n ? nodeTitle(n) : '—';
  };
  const go = (id?: string) =>
    id ? (
      <button className="link" onClick={() => onSelect(id)}>
        {title(id)}
      </button>
    ) : (
      '—'
    );

  if (node.kind === 'start')
    return (
      <div className="node-details">
        <p className="eyebrow">Start</p>
        <p>First step: {go(node.next)}</p>
      </div>
    );
  if (node.kind === 'end')
    return (
      <div className="node-details">
        <p className="eyebrow">End</p>
        <p>The exercise ends here.</p>
      </div>
    );
  if (node.kind === 'action')
    return (
      <div className="node-details">
        <p className="eyebrow">Action</p>
        <h3>{node.name}</h3>
        {node.description && <p className="prewrap">{node.description}</p>}
        {node.substeps.length > 0 ? (
          <>
            <p className="sub">On the panel, in this order</p>
            <ol className="substeps">
              {node.substeps.map((s, i) => (
                <li key={i}>
                  <span className="n">{i + 1}</span>
                  <span className="grow">{s.label}</span>
                  <small className="muted">{panels[s.panel]?.name}</small>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="muted">Nothing to do on the panel: a check.</p>
        )}
        {node.result && (
          <p className="result">
            <b>Expected result.</b> {node.result}
          </p>
        )}
        <p>Then: {go(node.next)}</p>
      </div>
    );
  const a = node.answer;
  return (
    <div className="node-details">
      <p className="eyebrow">Decision</p>
      <h3>{node.question || node.name}</h3>
      {node.description && <p className="prewrap">{node.description}</p>}
      <p className="sub">Answers</p>
      <ul className="answer-list">
        {a.type === 'choice'
          ? a.options.map((o, i) => (
              <li key={i}>
                <b>{o.label}</b> → {go(o.next)}
              </li>
            ))
          : a.ranges.map((r, i) => (
              <li key={i}>
                <b>{r.label}</b>{' '}
                <span className="muted">
                  ({r.min !== undefined ? `from ${r.min}` : ''}
                  {r.min !== undefined && r.max !== undefined ? ' ' : ''}
                  {r.max !== undefined ? `below ${r.max}` : ''}
                  {a.unit ? ` ${a.unit}` : ''})
                </span>{' '}
                → {go(r.next)}
              </li>
            ))}
      </ul>
    </div>
  );
}
