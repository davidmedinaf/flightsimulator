import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import type { Profile, Role } from './model';
import { Toggle } from './ProfilePage';
import { deleteProfile, listProfiles, updateProfile } from './store';

/** Admin only: every user, with role, permissions, disabling and deleting. */
export function Users() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = () =>
    listProfiles()
      .then((u) => setUsers(u.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setError('Could not load the users.'));
  useEffect(() => {
    load();
  }, []);

  async function change(uid: string, patch: Partial<Profile>) {
    setError(null);
    try {
      await updateProfile(uid, patch);
      setUsers((list) => list?.map((u) => (u.uid === uid ? { ...u, ...patch } : u)) ?? null);
    } catch {
      setError('Could not save the change.');
    }
  }

  const shown = (users ?? []).filter((u) => `${u.name} ${u.surname} ${u.email} ${u.role}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Administration</p>
        <h1>Users</h1>
        <p className="lead">
          Change roles and permissions, disable accounts or delete them. Deleting removes the profile and all access; to remove the sign-in itself, also delete
          the account under Authentication in the Firebase console.
        </p>
      </header>
      <div className="toolbar">
        <input id="us-filter" className="search" placeholder="Filter by name, email or role" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="muted">{users ? `${shown.length} of ${users.length} users` : 'Loading…'}</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Votes</th>
              <th>Reviews</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const self = u.uid === me?.uid;
              return (
                <tr key={u.uid} className={u.disabled ? 'is-muted' : ''}>
                  <td>
                    <span className="who">
                      {u.photo ? <img src={u.photo} alt="" /> : <span className="avatar">{u.name.slice(0, 1).toUpperCase()}</span>}
                      {u.name} {u.surname}
                      {self && <small> (you)</small>}
                    </span>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select id={`role-${u.uid}`} value={u.role} disabled={self} onChange={(e) => change(u.uid, { role: e.target.value as Role })}>
                      <option value="user">User</option>
                      <option value="creator">Creator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <Toggle id={`vote-${u.uid}`} label="Votes" on={u.canVote} onChange={(v) => change(u.uid, { canVote: v })} />
                  </td>
                  <td>
                    <Toggle id={`rev-${u.uid}`} label="Reviews" on={u.canReview} onChange={(v) => change(u.uid, { canReview: v })} />
                  </td>
                  <td>
                    {self ? (
                      'Active'
                    ) : (
                      <button className="btn btn-quiet btn-sm" onClick={() => change(u.uid, { disabled: !u.disabled })}>
                        {u.disabled ? 'Disabled · enable' : 'Active · disable'}
                      </button>
                    )}
                  </td>
                  <td>
                    {!self &&
                      (confirm === u.uid ? (
                        <span className="confirm-inline">
                          Delete {u.name}?
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={async () => {
                              try {
                                await deleteProfile(u.uid);
                                setUsers((l) => l?.filter((x) => x.uid !== u.uid) ?? null);
                              } catch {
                                setError('Could not delete the user.');
                              }
                              setConfirm(null);
                            }}
                          >
                            Delete
                          </button>
                          <button className="btn btn-quiet btn-sm" onClick={() => setConfirm(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button className="btn btn-quiet btn-sm" onClick={() => setConfirm(u.uid)}>
                          Delete
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
