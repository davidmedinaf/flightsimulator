import { useState, type FormEvent } from 'react';
import { authMessage, resetPassword, signIn, signUp } from '../auth';

type Mode = 'in' | 'up' | 'reset';

export function SignIn({ disclaimer }: { disclaimer: string }) {
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'in') await signIn(email, password);
      else if (mode === 'up') {
        if (!name.trim()) throw Object.assign(new Error(), { code: 'name' });
        await signUp(email, password, name.trim(), surname.trim());
      } else {
        await resetPassword(email);
        setInfo('If an account exists for that email, a link to set a new password is on its way.');
      }
    } catch (err) {
      setError((err as { code?: string }).code === 'name' ? 'Enter your name.' : authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create an account' : 'Reset your password';
  return (
    <div className="home">
      <main className="home-card auth-card">
        <p className="eyebrow">737 MAX flight simulator · proof of concept</p>
        <h1>Procedure Trainer</h1>
        <form className="form" onSubmit={submit}>
          <h2>{title}</h2>
          {mode === 'up' && (
            <div className="form-row">
              <label>
                Name
                <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required />
              </label>
              <label>
                Surname
                <input id="su-surname" value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" />
              </label>
            </div>
          )}
          <label>
            Email
            <input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          {mode !== 'reset' && (
            <label>
              Password
              <input
                id="si-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
          </button>
          <div className="form-links">
            {mode !== 'in' && (
              <button type="button" className="link" onClick={() => setMode('in')}>
                I have an account
              </button>
            )}
            {mode !== 'up' && (
              <button type="button" className="link" onClick={() => setMode('up')}>
                Create an account
              </button>
            )}
            {mode !== 'reset' && (
              <button type="button" className="link" onClick={() => setMode('reset')}>
                Forgot the password?
              </button>
            )}
          </div>
        </form>
        <p className="disclaimer">{disclaimer}</p>
      </main>
    </div>
  );
}
