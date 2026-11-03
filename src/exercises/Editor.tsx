import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { elementLabel, panels } from '../data';
import type { LightLevel } from '../data/types';
import { go } from '../Shell';
import { lightLevels, stateWord, type SimState } from '../sim';
import { Flowchart } from './Flowchart';
import type { ActionNode, DecisionNode, Draft, ExerciseContent, ExerciseNode, Published, SubStep } from './model';
import { emptyContent, newId, nodeTitle, problems, suggestReleaseNote } from './model';
import { draftFromPublished, loadDraft, loadPublished, publishDraft, saveDraft } from './store';
import { startSims, WorkPanels } from './WorkPanels';

const PANEL_IDS = Object.keys(panels);

/** What changed on the lights between two moments, as a suggested result. */
function lightChanges(before: Record<string, SimState>, after: Record<string, SimState>): string {
  const parts: string[] = [];
  for (const pid of Object.keys(after)) {
    const s = panels[pid].schematic;
    const a = lightLevels(s, before[pid] ?? after[pid]);
    const b = lightLevels(s, after[pid]);
    for (const l of s.lights) if (a[l.id] !== b[l.id]) parts.push(`${elementLabel(panels[pid], l.id)} ${stateWord(b[l.id])}`);
  }
  return parts.length ? `${parts.join('; ')}.` : '';
}

export function Editor({ id }: { id: string | null }) {
  const { profile } = useAuth();
  const me = profile!;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pub, setPub] = useState<Published | null>(null);
  const [missing, setMissing] = useState<'none' | 'published-only' | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<string | null>(null); // node id, or 'initial'
  const [sims, setSims] = useState<Record<string, SimState>>({});
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!id) {
      setDraft({
        id: newId('ex'),
        name: '',
        description: '',
        ownerId: me.uid,
        ownerName: `${me.name} ${me.surname}`.trim(),
        content: emptyContent([]),
        releaseNote: '',
        basedOn: 0,
        updatedAt: Date.now(),
      });
      return;
    }
    Promise.all([loadDraft(id), loadPublished(id).catch(() => null)]).then(([d, p]) => {
      setPub(p);
      if (d) setDraft(d);
      else setMissing(p ? 'published-only' : 'none');
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // panel state follows the chosen panels, starting from the initial set-up
  const panelKey = draft?.content.panels.join(',') ?? '';
  useEffect(() => {
    if (draft) setSims(startSims(draft.content.panels, draft.content.initial));
  }, [panelKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (missing === 'none') return <main className="page">This exercise does not exist, or you cannot edit it.</main>;
  if (missing === 'published-only' && pub)
    return (
      <main className="page narrow">
        <h1>{pub.name}</h1>
        <p className="lead">Published exercises cannot be edited directly. Editing creates draft v{pub.version + 1}; the published version stays as it is until you publish the draft.</p>
        <button className="btn btn-primary" onClick={async () => (setDraft(await draftFromPublished(pub)), setMissing(null))}>
          Create draft v{pub.version + 1}
        </button>
      </main>
    );
  if (!draft) return <main className="page">Loading…</main>;

  const c = draft.content;
  const update = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };
  const setContent = (content: ExerciseContent) => update({ content });
  const setNode = (n: ExerciseNode) => setContent({ ...c, nodes: c.nodes.map((x) => (x.id === n.id ? n : x)) });
  const ready = Boolean(draft.name.trim() && c.panels.length);

  function addNode(kind: 'action' | 'decision', after?: string) {
    const nid = newId(kind === 'action' ? 'a' : 'd');
    const prev = c.nodes.find((n) => n.id === (after ?? lastBeforeEnd()));
    const follow = prev && prev.kind !== 'end' && prev.kind !== 'decision' ? prev.next : 'end';
    const node: ExerciseNode =
      kind === 'action'
        ? { id: nid, kind, name: '', substeps: [], next: follow ?? 'end' }
        : { id: nid, kind, name: '', question: '', answer: { type: 'choice', options: [{ label: 'ON' }, { label: 'OFF' }] } };
    const nodes = c.nodes.map((n) => (prev && n.id === prev.id && n.kind !== 'end' && n.kind !== 'decision' ? { ...n, next: nid } : n));
    const endAt = nodes.findIndex((n) => n.id === 'end');
    nodes.splice(endAt, 0, node);
    setContent({ ...c, nodes });
    setOpen(nid);
  }

  /** The step that currently leads to End along the main path, to append after it. */
  function lastBeforeEnd(): string {
    let cur = 'start';
    const seen = new Set<string>();
    for (;;) {
      const n = c.nodes.find((x) => x.id === cur);
      if (!n || seen.has(cur) || n.kind === 'decision' || n.kind === 'end') return cur;
      seen.add(cur);
      if (!n.next || n.next === 'end') return cur;
      cur = n.next;
    }
  }

  function removeNode(nid: string) {
    const gone = c.nodes.find((n) => n.id === nid);
    const forward = gone && gone.kind === 'action' ? gone.next : undefined;
    const nodes = c.nodes
      .filter((n) => n.id !== nid)
      .map((n) => {
        if (n.kind === 'start' || n.kind === 'action') return n.next === nid ? { ...n, next: forward } : n;
        if (n.kind === 'decision') {
          const a = n.answer;
          return a.type === 'choice'
            ? { ...n, answer: { ...a, options: a.options.map((o) => (o.next === nid ? { ...o, next: forward } : o)) } }
            : { ...n, answer: { ...a, ranges: a.ranges.map((o) => (o.next === nid ? { ...o, next: forward } : o)) } };
        }
        return n;
      });
    setContent({ ...c, nodes });
    setOpen(null);
  }

  async function save(quiet = false) {
    if (!draft!.name.trim()) return setMsg({ text: 'Give the exercise a name first.', error: true });
    try {
      await saveDraft(draft!);
      setDirty(false);
      if (!quiet) setMsg({ text: 'Draft saved.' });
      if (!id) go(`edit/${draft!.id}`);
    } catch {
      setMsg({ text: 'Could not save the draft. Check the connection and try again.', error: true });
    }
  }

  const issues = problems(c);
  const nodeOptions = c.nodes.filter((n) => n.kind !== 'start');
  const current = open && open !== 'initial' ? c.nodes.find((n) => n.id === open) : null;

  return (
    <main className="page editor">
      <header className="page-head row-head">
        <div>
          <p className="eyebrow">
            {pub ? `Draft v${draft.basedOn + 1} · published v${pub.version} stays live until you publish` : 'New exercise · draft'}
            {dirty && ' · unsaved changes'}
          </p>
          <h1>{draft.name || 'Untitled exercise'}</h1>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => save()}>
            Save draft
          </button>
          {id && (
            <a className="btn btn-quiet" href={`#/play/${draft.id}/draft`} onClick={() => dirty && save(true)}>
              Try it
            </a>
          )}
          <button className="btn btn-primary" onClick={() => setPublishing(true)} disabled={!ready}>
            Publish…
          </button>
        </div>
      </header>
      {msg && <p className={msg.error ? 'form-error' : 'form-info'}>{msg.text}</p>}

      {publishing && (
        <PublishBox
          draft={draft}
          pub={pub}
          issues={issues}
          onNote={(releaseNote) => update({ releaseNote })}
          onCancel={() => setPublishing(false)}
          onPublish={async () => {
            try {
              await saveDraft(draft);
              const p = await publishDraft(draft, pub);
              go(`exercise/${p.id}`);
            } catch {
              setMsg({ text: 'Could not publish. Check the connection and try again.', error: true });
            }
          }}
        />
      )}

      <section className="card-block meta">
        <div className="form-row">
          <label className="grow">
            Name
            <input id="ed-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Fix a LOW PRESSURE light on the fuel panel" />
          </label>
        </div>
        <label>
          Description: what the exercise is for
          <textarea id="ed-desc" rows={3} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
        </label>
        <fieldset className="panels-pick">
          <legend>Panels used in this exercise</legend>
          {PANEL_IDS.map((pid) => (
            <label key={pid}>
              <input
                type="checkbox"
                checked={c.panels.includes(pid)}
                onChange={(e) => setContent({ ...c, panels: e.target.checked ? [...c.panels, pid] : c.panels.filter((x) => x !== pid) })}
              />
              {panels[pid].name}
            </label>
          ))}
        </fieldset>
      </section>

      {!ready ? (
        <p className="empty">Give the exercise a name and choose its panels to start adding steps.</p>
      ) : (
        <div className={`builder${open ? ' is-open' : ''}`}>
          <aside className="flow-side">
            <div className="flow-tools">
              <button className="btn btn-sm" onClick={() => addNode('action')}>
                + Action
              </button>
              <button className="btn btn-sm" onClick={() => addNode('decision')}>
                + Decision
              </button>
              <button className={`btn btn-sm btn-quiet${open === 'initial' ? ' is-on' : ''}`} onClick={() => setOpen(open === 'initial' ? null : 'initial')}>
                Initial state
              </button>
            </div>
            <div className="flow-scroll">
              <Flowchart nodes={c.nodes} selected={open} onSelect={(nid) => setOpen(nid === 'end' ? null : nid)} compact={Boolean(open)} />
            </div>
            {issues.length > 0 && (
              <ul className="issues">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </aside>

          {open === 'initial' && (
            <InitialState
              content={c}
              sims={sims}
              setSims={setSims}
              onSave={() => {
                const initial = Object.fromEntries(c.panels.map((pid) => [pid, { pos: sims[pid].pos, override: sims[pid].override as Record<string, LightLevel> }]));
                setContent({ ...c, initial });
                setMsg({ text: 'Initial state set. Save the draft to keep it.' });
              }}
              onReset={() => setSims(startSims(c.panels, c.initial))}
              onClose={() => setOpen(null)}
            />
          )}

          {current?.kind === 'start' && (
            <section className="card node-form">
              <h2>Start</h2>
              <label>
                First step
                <NextSelect id="nx-start" value={current.next} options={nodeOptions} onChange={(next) => setNode({ ...current, next })} />
              </label>
              <button className="btn btn-quiet" onClick={() => setOpen(null)}>
                Close
              </button>
            </section>
          )}
          {current?.kind === 'action' && (
            <ActionForm
              key={current.id}
              node={current}
              options={nodeOptions.filter((n) => n.id !== current.id)}
              content={c}
              sims={sims}
              setSims={setSims}
              onChange={setNode}
              onAddAfter={(kind) => addNode(kind, current.id)}
              onDelete={() => removeNode(current.id)}
              onClose={() => setOpen(null)}
            />
          )}
          {current?.kind === 'decision' && (
            <DecisionForm
              key={current.id}
              node={current}
              options={nodeOptions.filter((n) => n.id !== current.id)}
              content={c}
              sims={sims}
              setSims={setSims}
              onChange={setNode}
              onDelete={() => removeNode(current.id)}
              onClose={() => setOpen(null)}
            />
          )}
        </div>
      )}
    </main>
  );
}

function NextSelect({ id, value, options, onChange, placeholder = 'Choose the next step' }: { id: string; value?: string; options: ExerciseNode[]; onChange: (v?: string) => void; placeholder?: string }) {
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{placeholder}</option>
      {options.map((n) => (
        <option key={n.id} value={n.id}>
          {nodeTitle(n)}
        </option>
      ))}
    </select>
  );
}

function InitialState({
  content,
  sims,
  setSims,
  onSave,
  onReset,
  onClose,
}: {
  content: ExerciseContent;
  sims: Record<string, SimState>;
  setSims: (u: (s: Record<string, SimState>) => Record<string, SimState>) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <WorkPanels panelIds={content.panels} sims={sims} setSims={setSims} />
      <section className="card node-form">
        <p className="eyebrow">Set-up</p>
        <h2>Initial state of the panels</h2>
        <p>Put every switch where it should be when the exercise starts, and tap any light to make it extinguished, illuminated dim or illuminated, for example to start from a fault.</p>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={onSave}>
            Use this as the initial state
          </button>
          <button className="btn" onClick={onReset}>
            Back to the saved initial state
          </button>
          <button className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </>
  );
}

function ActionForm({
  node,
  options,
  content,
  sims,
  setSims,
  onChange,
  onAddAfter,
  onDelete,
  onClose,
}: {
  node: ActionNode;
  options: ExerciseNode[];
  content: ExerciseContent;
  sims: Record<string, SimState>;
  setSims: (u: (s: Record<string, SimState>) => Record<string, SimState>) => void;
  onChange: (n: ActionNode) => void;
  onAddAfter: (kind: 'action' | 'decision') => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const before = useRef<Record<string, SimState> | null>(null);
  const nodeRef = useRef(node);
  nodeRef.current = node;

  const record = (s: SubStep) => {
    if (!recording) return;
    const n = nodeRef.current;
    onChange({ ...n, substeps: [...n.substeps, s] });
  };
  const move = (i: number, d: -1 | 1) => {
    const list = [...node.substeps];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    onChange({ ...node, substeps: list });
  };
  const suggestion = useMemo(() => (before.current ? lightChanges(before.current, sims) : ''), [sims]);

  return (
    <>
      <WorkPanels
        panelIds={content.panels}
        sims={sims}
        setSims={setSims}
        onAction={record}
        highlight={node.substeps.length ? [{ ...node.substeps[node.substeps.length - 1], tone: 'done' as const }] : []}
      />
      <section className="card node-form">
        <p className="eyebrow">Action</p>
        <label>
          Name
          <input id="ac-name" value={node.name} onChange={(e) => onChange({ ...node, name: e.target.value })} placeholder="e.g. Set the yaw damper" />
        </label>
        <label>
          Short text for the flowchart
          <input id="ac-sum" value={node.summary ?? ''} maxLength={80} onChange={(e) => onChange({ ...node, summary: e.target.value })} />
        </label>
        <label>
          Description (optional): what this action is for
          <textarea id="ac-desc" rows={2} value={node.description ?? ''} onChange={(e) => onChange({ ...node, description: e.target.value })} />
        </label>

        <div className="substeps-edit">
          <div className="row-head">
            <h3>Sub-steps, in order</h3>
            <button
              className={`btn btn-sm${recording ? ' btn-rec' : ''}`}
              aria-pressed={recording}
              onClick={() => {
                if (!recording) before.current = sims;
                setRecording(!recording);
              }}
            >
              {recording ? '● Recording: operate the panel' : 'Record on the panel'}
            </button>
          </div>
          {node.substeps.length === 0 && <p className="muted small">Press Record, then operate the panel: each switch moved and each button or key pushed is added here, in that order.</p>}
          <ol className="substeps">
            {node.substeps.map((s, i) => (
              <li key={i}>
                <span className="n">{i + 1}</span>
                <span className="grow">{s.label}</span>
                <button className="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button className="icon" aria-label="Move down" disabled={i === node.substeps.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button className="icon" aria-label="Remove" onClick={() => onChange({ ...node, substeps: node.substeps.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </li>
            ))}
          </ol>
        </div>

        <label>
          Result (optional): expected outcome
          <textarea id="ac-result" rows={2} value={node.result ?? ''} onChange={(e) => onChange({ ...node, result: e.target.value })} />
        </label>
        {suggestion && suggestion !== node.result && (
          <button className="link" onClick={() => onChange({ ...node, result: suggestion })}>
            Use what the panel shows: “{suggestion}”
          </button>
        )}

        <label>
          Next step
          <NextSelect id="ac-next" value={node.next} options={options} onChange={(next) => onChange({ ...node, next })} />
        </label>
        <div className="form-actions">
          <button className="btn btn-sm" onClick={() => onAddAfter('action')}>
            + Action after this
          </button>
          <button className="btn btn-sm" onClick={() => onAddAfter('decision')}>
            + Decision after this
          </button>
        </div>
        <div className="form-actions">
          <button className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
          {confirmDelete ? (
            <span className="confirm-inline">
              Delete this action?
              <button className="btn btn-danger btn-sm" onClick={onDelete}>
                Delete
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button className="btn btn-quiet" onClick={() => setConfirmDelete(true)}>
              Delete action
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function DecisionForm({
  node,
  options,
  content,
  sims,
  setSims,
  onChange,
  onDelete,
  onClose,
}: {
  node: DecisionNode;
  options: ExerciseNode[];
  content: ExerciseContent;
  sims: Record<string, SimState>;
  setSims: (u: (s: Record<string, SimState>) => Record<string, SimState>) => void;
  onChange: (n: DecisionNode) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const a = node.answer;
  const about = node.about ? `${panels[node.about.panel]?.name}: ${elementLabel(panels[node.about.panel], node.about.control)}` : null;

  return (
    <>
      <WorkPanels
        panelIds={content.panels}
        sims={sims}
        setSims={setSims}
        onAction={(s) => {
          if (!picking) return;
          onChange({ ...node, about: { panel: s.panel, control: s.control } });
          setPicking(false);
        }}
        onLightTap={(panel, control) => {
          if (!picking) return;
          onChange({ ...node, about: { panel, control } });
          setPicking(false);
        }}
        highlight={node.about ? [{ ...node.about, tone: 'check' as const }] : []}
      />
      <section className="card node-form">
        <p className="eyebrow">Decision</p>
        <label>
          Name
          <input id="dc-name" value={node.name} onChange={(e) => onChange({ ...node, name: e.target.value })} placeholder="e.g. Is the LOW PRESSURE light illuminated?" />
        </label>
        <label>
          Question shown to the user
          <input id="dc-q" value={node.question} onChange={(e) => onChange({ ...node, question: e.target.value })} />
        </label>
        <label>
          Short text for the flowchart
          <input id="dc-sum" value={node.summary ?? ''} maxLength={80} onChange={(e) => onChange({ ...node, summary: e.target.value })} />
        </label>
        <label>
          Description (optional)
          <textarea id="dc-desc" rows={2} value={node.description ?? ''} onChange={(e) => onChange({ ...node, description: e.target.value })} />
        </label>
        <div className="field">
          <span>Panel element it is about (optional): {about ?? <i>none</i>}</span>
          <div className="form-actions">
            <button className={`btn btn-sm${picking ? ' btn-rec' : ''}`} onClick={() => setPicking(!picking)}>
              {picking ? 'Tap a switch or light on the panel…' : 'Pick on the panel'}
            </button>
            {node.about && (
              <button className="link" onClick={() => onChange({ ...node, about: undefined })}>
                Remove
              </button>
            )}
          </div>
          <p className="muted small">It is highlighted while the user answers.</p>
        </div>

        <div className="seg" role="radiogroup" aria-label="Kind of answer">
          <button role="radio" aria-checked={a.type === 'choice'} className={a.type === 'choice' ? 'is-on' : ''} onClick={() => a.type !== 'choice' && onChange({ ...node, answer: { type: 'choice', options: [{ label: 'ON' }, { label: 'OFF' }] } })}>
            Fixed answers
          </button>
          <button role="radio" aria-checked={a.type === 'number'} className={a.type === 'number' ? 'is-on' : ''} onClick={() => a.type !== 'number' && onChange({ ...node, answer: { type: 'number', unit: '', ranges: [{ label: 'Below', max: 0 }, { label: 'From', min: 0 }] } })}>
            A number, in ranges
          </button>
        </div>

        {a.type === 'choice' ? (
          <div className="answers-edit">
            {a.options.map((o, i) => (
              <div className="answer-row" key={i}>
                <input aria-label={`Answer ${i + 1}`} value={o.label} onChange={(e) => onChange({ ...node, answer: { ...a, options: a.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })} />
                <span>→</span>
                <NextSelect id={`dc-o${i}`} value={o.next} options={options} onChange={(next) => onChange({ ...node, answer: { ...a, options: a.options.map((x, j) => (j === i ? { ...x, next } : x)) } })} />
                <button className="icon" aria-label="Remove answer" disabled={a.options.length <= 2} onClick={() => onChange({ ...node, answer: { ...a, options: a.options.filter((_, j) => j !== i) } })}>
                  ×
                </button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => onChange({ ...node, answer: { ...a, options: [...a.options, { label: '' }] } })}>
              + Answer
            </button>
          </div>
        ) : (
          <div className="answers-edit">
            <label>
              Unit
              <input id="dc-unit" value={a.unit ?? ''} onChange={(e) => onChange({ ...node, answer: { ...a, unit: e.target.value } })} placeholder="e.g. ft" />
            </label>
            {a.ranges.map((r, i) => {
              const set = (patch: Partial<typeof r>) => onChange({ ...node, answer: { ...a, ranges: a.ranges.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
              const num = (v: string) => (v === '' ? undefined : Number(v));
              return (
                <div className="answer-row" key={i}>
                  <input aria-label={`Range ${i + 1} name`} value={r.label} onChange={(e) => set({ label: e.target.value })} />
                  <input aria-label="From (included)" type="number" placeholder="from" value={r.min ?? ''} onChange={(e) => set({ min: num(e.target.value) })} />
                  <input aria-label="Up to (not included)" type="number" placeholder="below" value={r.max ?? ''} onChange={(e) => set({ max: num(e.target.value) })} />
                  <span>→</span>
                  <NextSelect id={`dc-r${i}`} value={r.next} options={options} onChange={(next) => set({ next })} />
                  <button className="icon" aria-label="Remove range" disabled={a.ranges.length <= 2} onClick={() => onChange({ ...node, answer: { ...a, ranges: a.ranges.filter((_, j) => j !== i) } })}>
                    ×
                  </button>
                </div>
              );
            })}
            <p className="muted small">Each range includes its “from” value and stops below its “below” value. Leave one empty for no limit.</p>
            <button className="btn btn-sm" onClick={() => onChange({ ...node, answer: { ...a, ranges: [...a.ranges, { label: '' }] } })}>
              + Range
            </button>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
          {confirmDelete ? (
            <span className="confirm-inline">
              Delete this decision?
              <button className="btn btn-danger btn-sm" onClick={onDelete}>
                Delete
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button className="btn btn-quiet" onClick={() => setConfirmDelete(true)}>
              Delete decision
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function PublishBox({
  draft,
  pub,
  issues,
  onNote,
  onCancel,
  onPublish,
}: {
  draft: Draft;
  pub: Published | null;
  issues: string[];
  onNote: (s: string) => void;
  onCancel: () => void;
  onPublish: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const next = (pub?.version ?? 0) + 1;
  return (
    <section className="card-block publish">
      <h2>Publish version {next}</h2>
      {issues.length > 0 ? (
        <>
          <p>Fix these first:</p>
          <ul className="issues">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">
          {pub ? `Publishing replaces version ${pub.version} for everyone who can see it, and deletes this draft.` : 'The exercise is published as private: only you and administrators see it until you make it public or share it.'}
        </p>
      )}
      <label>
        Release note (required): what changed in this version
        <textarea id="pb-note" rows={3} value={draft.releaseNote} onChange={(e) => onNote(e.target.value)} />
      </label>
      <button className="link" onClick={() => onNote(suggestReleaseNote(pub, draft))}>
        Write it for me from the changes
      </button>
      <div className="form-actions">
        <button
          className="btn btn-primary"
          disabled={busy || issues.length > 0 || !draft.releaseNote.trim()}
          onClick={async () => {
            setBusy(true);
            await onPublish();
            setBusy(false);
          }}
        >
          Publish v{next}
        </button>
        <button className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
