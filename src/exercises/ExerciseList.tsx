import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { panels } from '../data';
import { go } from '../Shell';
import type { Draft, Published } from './model';
import { draftFromPublished, listExercises } from './store';

export type Status = 'Draft' | 'Public' | 'Private';

interface Row {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  publishedAt: number | null;
  panels: string[];
  status: Status;
  version: number;
  draft: Draft | null;
  published: Published | null;
}

type Key = 'name' | 'description' | 'ownerName' | 'publishedAt' | 'panels' | 'status';

export const panelName = (id: string) => panels[id]?.name ?? id;
export const day = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function MultiFilter({ id, label, options, chosen, onChange }: { id: string; label: string; options: string[]; chosen: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="multi">
      <button id={id} className={`btn btn-quiet btn-sm${chosen.length ? ' is-on' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        {chosen.length ? ` · ${chosen.length}` : ''} ▾
      </button>
      {open && (
        <div className="multi-menu" role="group" aria-label={label}>
          {options.map((o) => (
            <label key={o}>
              <input type="checkbox" checked={chosen.includes(o)} onChange={(e) => onChange(e.target.checked ? [...chosen, o] : chosen.filter((c) => c !== o))} />
              {o}
            </label>
          ))}
          {chosen.length > 0 && (
            <button className="link" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ExerciseList() {
  const { profile } = useAuth();
  const me = profile!;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'publishedAt', dir: -1 });
  const [text, setText] = useState('');
  const [owners, setOwners] = useState<string[]>([]);
  const [panelF, setPanelF] = useState<string[]>([]);
  const [statusF, setStatusF] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [confirmEdit, setConfirmEdit] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listExercises(me)
      .then(({ published, drafts }) => {
        const byId = new Map<string, Row>();
        for (const p of published)
          byId.set(p.id, {
            id: p.id,
            name: p.name,
            description: p.description,
            ownerId: p.ownerId,
            ownerName: p.ownerName,
            publishedAt: p.publishedAt,
            panels: p.content.panels,
            status: p.visibility === 'public' ? 'Public' : 'Private',
            version: p.version,
            draft: null,
            published: p,
          });
        for (const d of drafts) {
          const row = byId.get(d.id);
          if (row) row.draft = d;
          else
            byId.set(d.id, {
              id: d.id,
              name: d.name,
              description: d.description,
              ownerId: d.ownerId,
              ownerName: d.ownerName,
              publishedAt: null,
              panels: d.content.panels,
              status: 'Draft',
              version: 0,
              draft: d,
              published: null,
            });
        }
        setRows([...byId.values()]);
      })
      .catch(() => setError('Could not load the exercises. Check the connection and reload.'));
  }, [me]);

  const canEdit = (r: Row) => me.role === 'admin' || (me.role === 'creator' && r.ownerId === me.uid);

  const shown = useMemo(() => {
    const t0 = from ? new Date(from).getTime() : -Infinity;
    const t1 = to ? new Date(to).getTime() + 86400000 - 1 : Infinity;
    const list = (rows ?? []).filter(
      (r) =>
        `${r.name} ${r.description}`.toLowerCase().includes(text.toLowerCase()) &&
        (!owners.length || owners.includes(r.ownerName)) &&
        (!panelF.length || r.panels.some((p) => panelF.includes(panelName(p)))) &&
        (!statusF.length || statusF.includes(r.status)) &&
        (!(from || to) || (r.publishedAt !== null && r.publishedAt >= t0 && r.publishedAt <= t1)),
    );
    const val = (r: Row): string | number => (sort.key === 'panels' ? r.panels.map(panelName).join(', ') : (r[sort.key] ?? 0));
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [rows, text, owners, panelF, statusF, from, to, sort]);

  const head = (key: Key, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-sort" onClick={() => setSort({ key, dir: sort.key === key ? (-sort.dir as 1 | -1) : 1 })}>
        {label}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  );

  const preset = (days: number) => {
    const d = new Date(Date.now() - days * 86400000);
    setFrom(d.toISOString().slice(0, 10));
    setTo('');
  };

  async function edit(r: Row) {
    if (r.draft) return go(`edit/${r.id}`);
    if (confirmEdit !== r.id) return setConfirmEdit(r.id);
    try {
      await draftFromPublished(r.published!);
      go(`edit/${r.id}`);
    } catch {
      setError('Could not create the draft.');
    }
  }

  const all = rows ?? [];
  return (
    <main className="page">
      <header className="page-head row-head">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Exercises</h1>
        </div>
        {(me.role === 'admin' || me.role === 'creator') && (
          <a className="btn btn-primary" href="#/new">
            Create exercise
          </a>
        )}
      </header>

      <div className="toolbar filters">
        <input id="ex-search" className="search" placeholder="Search name and description" value={text} onChange={(e) => setText(e.target.value)} />
        <MultiFilter id="f-owner" label="Owner" options={[...new Set(all.map((r) => r.ownerName))].sort()} chosen={owners} onChange={setOwners} />
        <MultiFilter id="f-panels" label="Panels" options={[...new Set(all.flatMap((r) => r.panels.map(panelName)))].sort()} chosen={panelF} onChange={setPanelF} />
        <MultiFilter id="f-status" label="Status" options={['Draft', 'Public', 'Private'].filter((s) => all.some((r) => r.status === s))} chosen={statusF} onChange={setStatusF} />
        <div className="dates" role="group" aria-label="Date published">
          <label>
            Published from <input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            to <input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="btn btn-quiet btn-sm" onClick={() => preset(7)}>
            7 days
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => preset(30)}>
            30 days
          </button>
          {(from || to) && (
            <button className="link" onClick={() => (setFrom(''), setTo(''))}>
              Any date
            </button>
          )}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap tall">
        <table className="table">
          <thead>
            <tr>
              {head('name', 'Name')}
              {head('description', 'Description')}
              {head('ownerName', 'Owner')}
              {head('publishedAt', 'Published')}
              {head('panels', 'Panels')}
              {head('status', 'Status')}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {!rows && (
              <tr>
                <td colSpan={7} className="muted">
                  Loading…
                </td>
              </tr>
            )}
            {rows && shown.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  {all.length ? 'No exercise matches these filters.' : 'No exercises yet.'}
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={`#/exercise/${r.id}`} className="strong">
                    {r.name}
                  </a>
                  {r.version > 0 && <small className="muted"> v{r.version}</small>}
                </td>
                <td className="desc-cell">
                  {expanded === r.id || r.description.length <= 70 ? (
                    r.description
                  ) : (
                    <>
                      {r.description.slice(0, 70).trimEnd()}
                      <button className="link" onClick={() => setExpanded(r.id)} aria-label="Show the full description">
                        …
                      </button>
                    </>
                  )}
                </td>
                <td>{r.ownerName}</td>
                <td className="nowrap">{r.publishedAt ? day(r.publishedAt) : '—'}</td>
                <td>
                  <span className="chips">
                    {r.panels.map((p) => (
                      <span key={p} className="chip">
                        {panelName(p)}
                      </span>
                    ))}
                  </span>
                </td>
                <td>
                  <span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span>
                  {r.draft && r.status !== 'Draft' && <small className="muted"> + draft</small>}
                </td>
                <td className="nowrap actions">
                  <a className="btn btn-quiet btn-sm" href={`#/exercise/${r.id}`}>
                    Open
                  </a>
                  {canEdit(r) &&
                    (confirmEdit === r.id ? (
                      <span className="confirm-inline">
                        Editing creates draft v{r.version + 1}.
                        <button className="btn btn-sm" onClick={() => edit(r)}>
                          Create draft
                        </button>
                        <button className="btn btn-quiet btn-sm" onClick={() => setConfirmEdit(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button className="btn btn-sm" onClick={() => edit(r)}>
                        Edit
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
