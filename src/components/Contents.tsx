import { useEffect, type ReactNode } from 'react';

export interface ContentsGroup {
  id: string;
  title: string;
  /** Short progress text such as "3 / 5". */
  count?: string;
  current?: boolean;
  done?: boolean;
  /** Tapping the heading itself goes here, when given. */
  onOpen?: () => void;
  rows?: { id: string; n: number; text: ReactNode; current: boolean; onOpen: () => void }[];
}

interface Props {
  title: string;
  groups: ContentsGroup[];
  onClose: () => void;
}

/** Drawer listing the whole procedure, to jump straight to any part of it. */
export function Contents({ title, groups, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.querySelector('.contents .is-current')?.scrollIntoView({ block: 'center' });
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="contents-backdrop" onClick={onClose}>
      <aside className="contents" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>{title}</strong>
          <button className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="contents-body">
          {groups.map((g) => (
            <section key={g.id}>
              {g.onOpen ? (
                <button className={`contents-group${g.current ? ' is-current' : ''}${g.done ? ' is-done' : ''}`} onClick={g.onOpen}>
                  <span>{g.title}</span>
                  {g.count && <small>{g.count}</small>}
                </button>
              ) : (
                <h3 className="contents-group">
                  <span>{g.title}</span>
                  {g.count && <small>{g.count}</small>}
                </h3>
              )}
              {g.rows?.map((r) => (
                <button key={r.id} className={`contents-row${r.current ? ' is-current' : ''}`} onClick={r.onOpen}>
                  <span className="row-num">{r.n}</span>
                  <span>{r.text}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
