import { useEffect, useState } from 'react';
import type { LightLevel, Panel } from '../data/types';
import type { PracticeItem, PracticeSection } from '../practice';
import { conditionHolds, mismatches, type Mismatch, type SimState } from '../sim';
import { lightSources, MismatchList, Notes, PRACTICE_PANEL_NOTE } from './StepCard';

export type ItemStatus = 'done' | 'todo' | 'na';

/**
 * Actions the panel can verify are done when the panel shows them. Checks, and
 * anything the panel cannot verify, are done when the student ticks them.
 */
export function itemStatus(item: PracticeItem, sim: SimState, levels: Record<string, LightLevel>, ticks: string[]): ItemStatus {
  if (!conditionHolds(sim, item.when)) return 'na';
  if (item.kind === 'action' && item.expect) return mismatches(item.expect, sim, levels).length === 0 ? 'done' : 'todo';
  return ticks.includes(item.id) ? 'done' : 'todo';
}

interface Props {
  panel: Panel;
  section: PracticeSection;
  index: number;
  total: number;
  sim: SimState;
  levels: Record<string, LightLevel>;
  ticks: string[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onTick: (id: string, ticked: boolean) => void;
}

/** Grouped view of one sub-panel: its initial state, the actions and the checks. */
export function PracticePane({ panel, section, index, total, sim, levels, ticks, selected, onSelect, onTick }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ id: string; list: Mismatch[] } | null>(null);

  useEffect(() => {
    setOpen(null);
    setRefused(null);
  }, [section.id]);

  function tap(item: PracticeItem, status: ItemStatus) {
    onSelect(item.id);
    setRefused(null);
    if (status === 'na' || (item.kind === 'action' && item.expect)) return;
    if (status === 'done') return onTick(item.id, false);
    // A check is only accepted when the practice panel really shows it.
    const missing = item.expect ? mismatches(item.expect, sim, levels) : [];
    if (missing.length > 0) setRefused({ id: item.id, list: missing });
    else onTick(item.id, true);
  }

  function group(kind: 'action' | 'check', items: PracticeItem[]) {
    if (items.length === 0) return null;
    const statuses = items.map((i) => itemStatus(i, sim, levels, ticks));
    const done = statuses.filter((s) => s !== 'todo').length;
    return (
      <section className={`group group-${kind}`}>
        <h3>
          {kind === 'action' ? 'Actions' : 'Checks'}
          <span>
            {done} / {items.length}
          </span>
        </h3>
        <ul>
          {items.map((item, i) => {
            const status = statuses[i];
            const auto = item.kind === 'action' && Boolean(item.expect);
            const sources = item.expect ? lightSources(panel, Object.keys(item.expect)) : [];
            return (
              <li key={item.id} className={`item is-${status}${selected === item.id ? ' is-selected' : ''}`}>
                <div className="item-line">
                  <button className="item-main" onClick={() => tap(item, status)} aria-pressed={status === 'done'}>
                    <span className={`tick${auto ? ' tick-auto' : ''}`} aria-hidden="true" />
                    <span className="item-text">
                      {item.text}
                      {item.offPanel && <small> Not on this panel: check it in the simulator.</small>}
                      {status === 'na' && <small> Does not apply with the panel as it is now.</small>}
                      {auto && status === 'todo' && <small> Do it on the panel.</small>}
                    </span>
                  </button>
                  <button
                    className={`info-btn${open === item.id ? ' is-open' : ''}`}
                    aria-expanded={open === item.id}
                    aria-label="More about this item"
                    onClick={() => setOpen(open === item.id ? null : item.id)}
                  >
                    i
                  </button>
                </div>
                {item.notes.some((n) => n.kind === 'caution') && <Notes notes={item.notes.filter((n) => n.kind === 'caution')} />}
                {refused?.id === item.id && (
                  <div className="panel-state is-todo">
                    The panel does not show this yet:
                    <MismatchList panel={panel} list={refused.list} />
                  </div>
                )}
                {open === item.id && (
                  <div className="step-meta">
                    {item.detail.map((d) => (
                      <p key={d}>{d}</p>
                    ))}
                    <Notes notes={item.notes.filter((n) => n.kind !== 'caution')} />
                    <p>
                      <b>From the manual:</b>
                    </p>
                    <ul className="source-steps">
                      {item.steps.map((s) => (
                        <li key={s.id}>
                          {s.title}
                          {s.target && <em> … {s.target}</em>}
                        </li>
                      ))}
                    </ul>
                    {sources.map((s) => (
                      <p key={s}>
                        <b>Panel behaviour:</b> {s}
                      </p>
                    ))}
                    <p className="step-source">
                      Source: FCOM {[...new Set(item.steps.map((s) => s.ref))].join(', ')} · PDF page{' '}
                      {[...new Set(item.steps.map((s) => s.pdfPage))].join(', ')}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <>
      <header className="pane-head">
        <h2>{section.title}</h2>
        <span className="pane-count">
          {index + 1} / {total}
        </span>
      </header>
      <div className="rows">
        {section.initial && (
          <p className="initial">
            <b>Initial state.</b> {section.initial}
          </p>
        )}
        <Notes notes={section.notes} />
        {group('action', section.actions)}
        {group('check', section.checks)}
        {section.info.map((s) => (
          <div className="info-item" key={s.id}>
            <p>{s.title}</p>
            {s.bullets && (
              <ul>
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <p className="pane-foot">{PRACTICE_PANEL_NOTE}</p>
      </div>
    </>
  );
}
