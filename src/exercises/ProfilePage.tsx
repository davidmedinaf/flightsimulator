import { useState } from 'react';
import { authMessage, logOut, resetPassword, useAuth } from '../auth';
import { updateProfile } from './store';

/** Shrinks a picture to a small square JPEG so it can live in the profile itself. */
export function shrinkPicture(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('That file is not a picture this browser can open.'));
    img.src = URL.createObjectURL(file);
  });
}

export function Toggle({ id, label, on, disabled, onChange }: { id: string; label: string; on: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className={`toggle${disabled ? ' is-readonly' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>
        {label}: <b>{on ? 'ON' : 'OFF'}</b>
      </span>
    </label>
  );
}

export function ProfilePage() {
  const { profile, refresh } = useAuth();
  const [name, setName] = useState(profile!.name);
  const [surname, setSurname] = useState(profile!.surname);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const p = profile!;
  const admin = p.role === 'admin';

  async function save(patch: Parameters<typeof updateProfile>[1], done = 'Saved.') {
    try {
      await updateProfile(p.uid, patch);
      await refresh();
      setMsg({ text: done });
    } catch {
      setMsg({ text: 'Could not save. Check the connection and try again.', error: true });
    }
  }

  return (
    <main className="page narrow">
      <header className="page-head">
        <p className="eyebrow">Your account</p>
        <h1>Profile</h1>
      </header>
      <section className="card-block profile">
        <div className="photo">
          {p.photo ? <img src={p.photo} alt="Profile picture" /> : <span className="avatar avatar-lg">{p.name.slice(0, 1).toUpperCase()}</span>}
          <label className="btn btn-quiet">
            {p.photo ? 'Change picture' : 'Add a picture'}
            <input
              id="pf-photo"
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await save({ photo: await shrinkPicture(f) }, 'Picture saved.');
                } catch (err) {
                  setMsg({ text: (err as Error).message, error: true });
                }
              }}
            />
          </label>
          {p.photo && (
            <button className="btn btn-quiet" onClick={() => save({ photo: '' }, 'Picture removed.')}>
              Remove picture
            </button>
          )}
        </div>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            save({ name: name.trim(), surname: surname.trim() });
          }}
        >
          <div className="form-row">
            <label>
              Name
              <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Surname
              <input id="pf-surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
            </label>
          </div>
          <label>
            Email
            <input id="pf-email" value={p.email} readOnly />
          </label>
          <p className="muted">
            Role: <b>{p.role}</b>
          </p>
          <Toggle id="pf-votes" label="Votes allowed" on={p.canVote} disabled={!admin} onChange={(v) => save({ canVote: v })} />
          <Toggle id="pf-reviews" label="Reviews allowed" on={p.canReview} disabled={!admin} onChange={(v) => save({ canReview: v })} />
          {!admin && <p className="muted small">Only an administrator can change these two.</p>}
          {msg && <p className={msg.error ? 'form-error' : 'form-info'}>{msg.text}</p>}
          <div className="form-actions">
            <button className="btn btn-primary">Save</button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await resetPassword(p.email);
                  setMsg({ text: `A link to set a new password was sent to ${p.email}.` });
                } catch (err) {
                  setMsg({ text: authMessage(err), error: true });
                }
              }}
            >
              Reset password
            </button>
            <button type="button" className="btn btn-quiet" onClick={logOut}>
              Sign out
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
