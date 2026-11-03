import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { go } from '../Shell';
import { day, panelName } from './ExerciseList';
import { Flowchart } from './Flowchart';
import { badLanguage } from './language';
import { COMMENT_LIMIT, type Draft, type Profile, type Published, type Review } from './model';
import { deleteExercise, deleteReview, discardDraft, draftFromPublished, listProfiles, loadDraft, loadPublished, notifyAdmins, saveReview, setSharing, watchReviews } from './store';

function Stars({ value, onPick, disabled }: { value: number | null; onPick?: (n: number) => void; disabled?: boolean }) {
  return (
    <span className="stars" role={onPick ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) =>
        onPick ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} disabled={disabled} className={value && n <= value ? 'on' : ''} onClick={() => onPick(n)}>
            ★
          </button>
        ) : (
          <span key={n} className={value && n <= Math.round(value) ? 'on' : ''} aria-hidden="true">
            ★
          </span>
        ),
      )}
    </span>
  );
}

export function ExerciseView({ id }: { id: string }) {
  const { profile } = useAuth();
  const me = profile!;
  const [pub, setPub] = useState<Published | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<'edit' | 'delete' | 'discard' | null>(null);

  useEffect(() => {
    loadPublished(id)
      .then(setPub)
      .catch(() => setPub(null));
    loadDraft(id).then(setDraft);
    return watchReviews(id, setReviews);
  }, [id]);

  const owner = (pub?.ownerId ?? draft?.ownerId) === me.uid;
  const manage = me.role === 'admin' || (me.role === 'creator' && owner);
  useEffect(() => {
    if (manage) listProfiles().then(setUsers).catch(() => {});
  }, [manage]);

  if (pub === undefined) return <main className="page">Loading…</main>;
  const shown = pub ?? draft;
  if (!shown)
    return (
      <main className="page">
        <p className="lead">This exercise does not exist or is not shared with you.</p>
        <a className="btn" href="#/exercises">
          All exercises
        </a>
      </main>
    );

  const mine = reviews.find((r) => r.uid === me.uid);
  const rated = reviews.filter((r) => r.stars);
  const avg = rated.length ? rated.reduce((a, r) => a + (r.stars ?? 0), 0) / rated.length : null;
  const multi = (pub?.version ?? 0) > 1;

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: ok });
    } catch {
      setMsg({ text: 'That did not work. Check the connection and try again.', error: true });
    }
  }

  return (
    <main className="page">
      <header className="page-head row-head">
        <div>
          <p className="eyebrow">
            {pub ? `${pub.visibility === 'public' ? 'Public' : 'Private'} · version ${pub.version} · published ${day(pub.publishedAt)}` : 'Draft · not published yet'}
          </p>
          <h1>{shown.name}</h1>
          <p className="muted">
            By {shown.ownerName} · {shown.content.panels.map(panelName).join(', ')}
          </p>
        </div>
        <div className="form-actions">
          {pub && (
            <a className="btn btn-primary" href={`#/play/${id}`}>
              Start exercise
            </a>
          )}
          {manage && draft && (
            <a className="btn" href={`#/play/${id}/draft`}>
              Try the draft
            </a>
          )}
          {manage &&
            (draft ? (
              <a className="btn" href={`#/edit/${id}`}>
                Edit draft
              </a>
            ) : confirm === 'edit' ? (
              <span className="confirm-inline">
                Editing creates draft v{(pub?.version ?? 0) + 1}.
                <button className="btn btn-sm" onClick={() => act(async () => (await draftFromPublished(pub!), go(`edit/${id}`)), '')}>
                  Create draft
                </button>
                <button className="btn btn-quiet btn-sm" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className="btn" onClick={() => setConfirm('edit')}>
                Edit
              </button>
            ))}
        </div>
      </header>

      {msg?.text && <p className={msg.error ? 'form-error' : 'form-info'}>{msg.text}</p>}

      <div className="detail">
        <section className="card-block">
          <h2>What this exercise is for</h2>
          <p className="prewrap">{shown.description || 'No description.'}</p>
          {pub && (
            <p className="muted">
              <b>Release note, v{pub.version}.</b> {pub.releaseNote}
            </p>
          )}
          <h3>Steps</h3>
          <div className="flow-wrap">
            <Flowchart nodes={shown.content.nodes} />
          </div>
        </section>

        <aside className="detail-side">
          {manage && pub && (
            <section className="card-block">
              <h2>Who can see it</h2>
              <div className="seg" role="radiogroup" aria-label="Visibility">
                {(['private', 'public'] as const).map((v) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={pub.visibility === v}
                    className={pub.visibility === v ? 'is-on' : ''}
                    onClick={() => act(async () => (await setSharing(id, v, pub.sharedWith), setPub({ ...pub, visibility: v })), v === 'public' ? 'Now visible to every registered user.' : 'Now private.')}
                  >
                    {v === 'public' ? 'Public' : 'Private'}
                  </button>
                ))}
              </div>
              <p className="muted small">
                {pub.visibility === 'public' ? 'Every registered user can see it.' : 'Only you, administrators and the people below can see it.'}
              </p>
              {pub.visibility === 'private' && (
                <div className="share-list">
                  {users
                    .filter((u) => u.uid !== pub.ownerId && u.role !== 'admin')
                    .map((u) => (
                      <label key={u.uid}>
                        <input
                          type="checkbox"
                          checked={pub.sharedWith.includes(u.uid)}
                          onChange={(e) => {
                            const list = e.target.checked ? [...pub.sharedWith, u.uid] : pub.sharedWith.filter((x) => x !== u.uid);
                            act(async () => (await setSharing(id, pub.visibility, list), setPub({ ...pub, sharedWith: list })), 'Sharing updated.');
                          }}
                        />
                        {u.name} {u.surname} <small className="muted">{u.email}</small>
                      </label>
                    ))}
                </div>
              )}
            </section>
          )}

          {pub && (
            <ReviewBox
              me={me}
              exerciseId={id}
              exerciseName={pub.name}
              version={pub.version}
              mine={mine}
              onMessage={setMsg}
            />
          )}

          {pub && (
            <section className="card-block">
              <h2>
                Reviews {avg !== null && <Stars value={avg} />} {avg !== null && <small className="muted">{avg.toFixed(1)} from {rated.length}</small>}
              </h2>
              {reviews.filter((r) => r.comment).length === 0 && <p className="muted">No comments yet.</p>}
              <ul className="reviews">
                {reviews
                  .filter((r) => r.comment)
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map((r) => (
                    <li key={r.id}>
                      <p>
                        <b>{r.userName}</b> {r.stars && <Stars value={r.stars} />}
                        {multi && <small className="muted"> on v{r.version}</small>}
                        <small className="muted"> · {day(r.updatedAt)}</small>
                      </p>
                      <p className="prewrap">{r.comment}</p>
                      {me.role === 'admin' && r.uid !== me.uid && (
                        <button className="link" onClick={() => act(() => deleteReview(id, r.uid), 'Review deleted.')}>
                          Delete this review
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {manage && (
            <section className="card-block danger-zone">
              {draft && pub && (
                <p>
                  {confirm === 'discard' ? (
                    <span className="confirm-inline">
                      Discard the draft?
                      <button className="btn btn-danger btn-sm" onClick={() => act(async () => (await discardDraft(id), setDraft(null), setConfirm(null)), 'Draft discarded.')}>
                        Discard
                      </button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setConfirm(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button className="btn btn-quiet" onClick={() => setConfirm('discard')}>
                      Discard draft
                    </button>
                  )}
                </p>
              )}
              {confirm === 'delete' ? (
                <span className="confirm-inline">
                  Delete the exercise and its draft for everyone?
                  <button className="btn btn-danger btn-sm" onClick={() => act(async () => (await deleteExercise(id), go('exercises')), '')}>
                    Delete
                  </button>
                  <button className="btn btn-quiet btn-sm" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="btn btn-quiet" onClick={() => setConfirm('delete')}>
                  Delete exercise
                </button>
              )}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function ReviewBox({
  me,
  exerciseId,
  exerciseName,
  version,
  mine,
  onMessage,
}: {
  me: Profile;
  exerciseId: string;
  exerciseName: string;
  version: number;
  mine?: Review;
  onMessage: (m: { text: string; error?: boolean }) => void;
}) {
  const [stars, setStars] = useState<number | null>(mine?.stars ?? null);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStars(mine?.stars ?? null);
    setComment(mine?.comment ?? '');
  }, [mine?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const userName = `${me.name} ${me.surname}`.trim();
  async function submit() {
    const text = comment.trim();
    const bad = badLanguage(text);
    setBusy(true);
    try {
      if (bad.length) {
        await notifyAdmins({ type: 'language', exerciseId, exerciseName, uid: me.uid, userName, text });
        onMessage({ text: 'The comment was not saved: it contains language that is not allowed. An administrator has been notified.', error: true });
        return;
      }
      await saveReview({ exerciseId, uid: me.uid, userName, stars, comment: text, version });
      onMessage({ text: mine ? 'Your review was updated.' : 'Thanks, your review was saved.' });
    } catch {
      onMessage({ text: 'Could not save the review.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-block">
      <h2>{mine ? 'Your review' : 'Rate this exercise'}</h2>
      <div className="field">
        <Stars value={stars} onPick={setStars} disabled={!me.canVote} />
        {!me.canVote && <p className="muted small">Voting has been turned off for your account.</p>}
      </div>
      <label className="field">
        Comment
        <textarea
          id="rv-comment"
          rows={4}
          maxLength={COMMENT_LIMIT}
          value={comment}
          disabled={!me.canReview}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What worked, what was unclear, what is wrong"
        />
        <small className="muted">
          {comment.length} / {COMMENT_LIMIT}
        </small>
      </label>
      {!me.canReview && <p className="muted small">Reviews have been turned off for your account.</p>}
      <p className="muted small">One vote and one comment per person; saving again replaces them.</p>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy || (!stars && !comment.trim())} onClick={submit}>
          {mine ? 'Update review' : 'Save review'}
        </button>
      </div>
    </section>
  );
}
