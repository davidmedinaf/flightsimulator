import { useEffect, useState } from 'react';
import type { Notice } from './model';
import { deleteNotice, markNotice, watchNotices } from './store';

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Admin only: comments that were blocked for bad language. */
export function Notifications() {
  const [list, setList] = useState<Notice[] | null>(null);
  useEffect(() => watchNotices(setList), []);

  return (
    <main className="page narrow">
      <header className="page-head">
        <p className="eyebrow">Administration</p>
        <h1>Notifications</h1>
        <p className="lead">Comments that were not published because they contained bad language. From the Users page you can revoke someone's reviews.</p>
      </header>
      {!list ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="empty">No notifications.</p>
      ) : (
        <ul className="notices">
          {list.map((n) => (
            <li key={n.id} className={n.read ? 'is-read' : ''}>
              <div>
                <p>
                  <b>{n.userName}</b> on <a href={`#/exercise/${n.exerciseId}`}>{n.exerciseName}</a> · <span className="muted">{when(n.createdAt)}</span>
                </p>
                <blockquote>{n.text}</blockquote>
              </div>
              <div className="notice-actions">
                <button className="btn btn-quiet btn-sm" onClick={() => markNotice(n.id, !n.read)}>
                  {n.read ? 'Mark unread' : 'Mark read'}
                </button>
                <button className="btn btn-quiet btn-sm" onClick={() => deleteNotice(n.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
