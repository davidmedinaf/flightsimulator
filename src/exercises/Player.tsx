import { useEffect, useMemo, useState } from 'react';
import { panels } from '../data';
import { go } from '../Shell';
import type { SimState } from '../sim';
import { Flowchart } from './Flowchart';
import type { ActionNode, DecisionNode, ExerciseContent, ExerciseNode, SubStep } from './model';
import { nodeTitle } from './model';
import { loadDraft, loadPublished } from './store';
import { startSims, WorkPanels } from './WorkPanels';

interface Props {
  id: string;
  /** Try out the draft instead of the published version (creator and admins). */
  draft?: boolean;
}

const same = (a: SubStep, b: SubStep) => a.panel === b.panel && a.control === b.control && a.value === b.value;

export function Player({ id, draft }: Props) {
  const [meta, setMeta] = useState<{ name: string; content: ExerciseContent; version: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (draft ? loadDraft(id) : loadPublished(id))
      .then((x) => (x ? setMeta({ name: x.name, content: x.content, version: 'version' in x ? x.version : 0 }) : setError('This exercise does not exist or is not shared with you.')))
      .catch(() => setError('Could not load the exercise.'));
  }, [id, draft]);

  if (error)
    return (
      <div className="home">
        <main className="home-card">
          <p className="lead">{error}</p>
          <a className="btn" href="#/exercises">
            All exercises
          </a>
        </main>
      </div>
    );
  if (!meta) return <div className="splash">Loading…</div>;
  return <Run id={id} name={meta.name} content={meta.content} draft={Boolean(draft)} />;
}

function Run({ id, name, content, draft }: { id: string; name: string; content: ExerciseContent; draft: boolean }) {
  const byId = useMemo(() => new Map(content.nodes.map((n) => [n.id, n])), [content]);
  const first = (byId.get('start') as { next?: string } | undefined)?.next ?? 'end';
  const [sims, setSims] = useState<Record<string, SimState>>(() => startSims(content.panels, content.initial));
  const [nodeId, setNodeId] = useState(first);
  const [trail, setTrail] = useState<string[]>(['start']);
  const [step, setStep] = useState(0); // sub-step reached in the current action
  const [warning, setWarning] = useState<string | null>(null);
  const [flowOpen, setFlowOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<string | undefined>(undefined);
  const [number, setNumber] = useState('');

  const node = byId.get(nodeId) as ExerciseNode | undefined;
  const action = node?.kind === 'action' ? (node as ActionNode) : null;
  const decision = node?.kind === 'decision' ? (node as DecisionNode) : null;
  const expected = action?.substeps[step];

  // a sub-step that asks for a position the panel already shows counts as done
  useEffect(() => {
    if (!expected || expected.value === 'PUSH') return;
    if (sims[expected.panel]?.pos[expected.control] === expected.value) setStep((s) => s + 1);
  }, [expected, sims]);

  // show the panel where the next thing happens
  useEffect(() => {
    const target = expected?.panel ?? decision?.about?.panel;
    if (target) setActivePanel(target);
  }, [expected, decision]);

  function onAction(s: SubStep) {
    if (!action || !expected) return;
    if (same(s, expected)) {
      setWarning(null);
      setStep((i) => i + 1);
      return;
    }
    const later = action.substeps.slice(step + 1).findIndex((x) => same(x, s));
    if (later >= 0) setWarning(`The order matters: first “${expected.label}”.`);
  }

  function goTo(next?: string) {
    if (!next) return;
    setTrail((t) => [...t, nodeId]);
    setNodeId(next);
    setStep(0);
    setWarning(null);
    setNumber('');
  }

  function back() {
    const prev = trail[trail.length - 1];
    if (!prev || prev === 'start') return;
    setTrail((t) => t.slice(0, -1));
    setNodeId(prev);
    setStep(0);
    setWarning(null);
  }

  const done = new Set(trail);
  const highlight = expected
    ? [{ panel: expected.panel, control: expected.control, tone: 'action' as const }]
    : decision?.about
      ? [{ panel: decision.about.panel, control: decision.about.control, tone: 'check' as const }]
      : [];
  const complete = action ? step >= action.substeps.length : false;

  return (
    <div className="run">
      <header className="topbar">
        <div className="topbar-title">
          <strong>{name}</strong>
          <span>{draft ? 'Trying the draft' : 'Exercise'}</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-quiet" aria-pressed={flowOpen} onClick={() => setFlowOpen(!flowOpen)}>
            Flowchart
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => {
              setSims(startSims(content.panels, content.initial));
              setNodeId(first);
              setTrail(['start']);
              setStep(0);
            }}
          >
            Restart
          </button>
          <button className="btn btn-quiet" onClick={() => go(draft ? `edit/${id}` : `exercise/${id}`)}>
            Close
          </button>
        </div>
      </header>
      <main className={`play${flowOpen ? ' with-flow' : ''}`}>
        {flowOpen && (
          <aside className="flow-side" aria-label="Steps of the exercise">
            <Flowchart nodes={content.nodes} selected={nodeId} done={done} compact />
          </aside>
        )}
        <WorkPanels panelIds={content.panels} sims={sims} setSims={setSims} onAction={onAction} highlight={highlight} active={activePanel} onActive={setActivePanel} />
        <section className="card play-card">
          {node?.kind === 'end' || !node ? (
            <div className="pane-body">
              <p className="eyebrow">End of the exercise</p>
              <h2>Exercise complete</h2>
              <p>The panel in this app is a practice panel. It is not connected to the simulator.</p>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={() => go(draft ? `edit/${id}` : `exercise/${id}`)}>
                  {draft ? 'Back to the editor' : 'Rate this exercise'}
                </button>
                <button className="btn" onClick={back}>
                  Back to the last step
                </button>
              </div>
            </div>
          ) : action ? (
            <div className="pane-body">
              <p className="eyebrow">Action · {panelNames(action)}</p>
              <h2>{action.name}</h2>
              {action.description && <p>{action.description}</p>}
              {action.substeps.length > 0 && (
                <ol className="substeps">
                  {action.substeps.map((s, i) => (
                    <li key={i} className={i < step ? 'is-done' : i === step ? 'is-current' : ''}>
                      <span className="n">{i + 1}</span>
                      {s.label}
                    </li>
                  ))}
                </ol>
              )}
              {warning && <p className="panel-state is-todo">{warning}</p>}
              {complete && action.result && (
                <p className="result">
                  <b>Expected result.</b> {action.result}
                </p>
              )}
              <nav className="nav">
                <button className="btn" onClick={back} disabled={trail.length <= 1}>
                  Previous
                </button>
                <button className={`btn${complete ? ' btn-primary' : ''}`} onClick={() => goTo(action.next)} disabled={!complete}>
                  {complete ? 'Next' : `${action.substeps.length - step} to do on the panel`}
                </button>
              </nav>
            </div>
          ) : decision ? (
            <div className="pane-body">
              <p className="eyebrow">Decision</p>
              <h2>{decision.question || decision.name}</h2>
              {decision.description && <p>{decision.description}</p>}
              {decision.about && <p className="muted">Look at the highlighted element on the panel.</p>}
              {decision.answer.type === 'choice' ? (
                <div className="answers">
                  {decision.answer.options.map((o, i) => (
                    <button key={i} className="btn btn-primary" onClick={() => goTo(o.next)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  className="answers"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = Number(number);
                    const answer = decision.answer;
                    if (answer.type !== 'number' || number === '' || Number.isNaN(v)) return;
                    const r = answer.ranges.find((x) => (x.min === undefined || v >= x.min) && (x.max === undefined || v < x.max));
                    if (r) goTo(r.next);
                    else setWarning('That value is outside every range of this question.');
                  }}
                >
                  <label>
                    Value{decision.answer.unit ? ` (${decision.answer.unit})` : ''}
                    <input id="pl-number" type="number" inputMode="decimal" value={number} onChange={(e) => setNumber(e.target.value)} />
                  </label>
                  <button className="btn btn-primary">Answer</button>
                  {warning && <p className="form-error">{warning}</p>}
                </form>
              )}
              <nav className="nav">
                <button className="btn" onClick={back} disabled={trail.length <= 1}>
                  Previous
                </button>
              </nav>
            </div>
          ) : (
            <p className="pane-body">Unknown step: {nodeTitle(node)}</p>
          )}
        </section>
      </main>
    </div>
  );
}

function panelNames(a: ActionNode) {
  const ids = [...new Set(a.substeps.map((s) => s.panel))];
  return ids.length ? ids.map((p) => panels[p]?.name ?? p).join(', ') : 'check';
}
