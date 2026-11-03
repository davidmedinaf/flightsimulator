import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import App from './App';
import { logOut, useAuth } from './auth';
import { Explorer } from './components/Explorer';
import { SignIn } from './components/SignIn';
import { Editor } from './exercises/Editor';
import { ExerciseList } from './exercises/ExerciseList';
import { ExerciseView } from './exercises/ExerciseView';
import { Notifications } from './exercises/Notifications';
import { Player } from './exercises/Player';
import { ProfilePage } from './exercises/ProfilePage';
import { Users } from './exercises/Users';
import { watchNotices } from './exercises/store';

export const DISCLAIMER =
  'Simulator training aid only. Not a certified aviation procedure system. Follow approved training materials and instructor guidance.';

/** Routes: #/exercises, #/exercise/<id>, #/play/<id>, #/edit/<id>, #/new, #/users, #/notifications, #/profile, #/panels/<id>, #/trainer. */
function readRoute(): string[] {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return ['exercises'];
  // links from before accounts existed open the trainer as they did
  if (!h.startsWith('/')) return h.startsWith('explore') ? ['panels', h.split('/')[1] ?? ''] : ['trainer'];
  return h.slice(1).split('/');
}

export const go = (path: string) => {
  location.hash = `#/${path}`;
};

export function Shell() {
  const { user, profile, loading } = useAuth();
  const [route, setRoute] = useState(readRoute);
  const [unread, setUnread] = useState(0);
  const bar = useRef<HTMLElement>(null);

  // page headers stick just below the menu bar, which can wrap onto two lines
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  });

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    return watchNotices((n) => setUnread(n.filter((x) => !x.read).length));
  }, [profile?.role]);

  if (loading) return <div className="splash">Loading…</div>;
  if (!user) return <SignIn disclaimer={DISCLAIMER} />;
  if (!profile)
    return (
      <div className="home">
        <main className="home-card">
          <h1>Account unavailable</h1>
          <p className="lead">This account has no profile, or it was removed by an administrator.</p>
          <button className="btn" onClick={logOut}>
            Sign out
          </button>
        </main>
      </div>
    );
  if (profile.disabled)
    return (
      <div className="home">
        <main className="home-card">
          <h1>Account disabled</h1>
          <p className="lead">An administrator has disabled this account. Contact them to have it restored.</p>
          <button className="btn" onClick={logOut}>
            Sign out
          </button>
        </main>
      </div>
    );

  const [page, arg] = route;
  // full-screen tools keep their own header
  if (page === 'trainer') return <App onExit={() => go('exercises')} />;
  if (page === 'panels') return <Explorer initialPanel={arg} onClose={() => go('exercises')} disclaimer={DISCLAIMER} />;
  if (page === 'play' && arg) return <Player id={arg} draft={route[2] === 'draft'} />;

  const creator = profile.role === 'admin' || profile.role === 'creator';
  const item = (path: string, label: string, badge?: number) => (
    <a href={`#/${path}`} className={`nav-item${page === path.split('/')[0] ? ' is-active' : ''}`}>
      {label}
      {badge ? <span className="badge">{badge}</span> : null}
    </a>
  );

  return (
    <div className="shell">
      <header className="shell-bar" ref={bar}>
        <a href="#/exercises" className="brand">
          Procedure Trainer
        </a>
        <nav className="shell-nav" aria-label="Main">
          {item('exercises', 'Exercises')}
          {creator && item('new', 'Create exercise')}
          {item('panels', 'Panels')}
          {item('trainer', 'Classic trainer')}
          {profile.role === 'admin' && item('users', 'Users')}
          {profile.role === 'admin' && item('notifications', 'Notifications', unread)}
        </nav>
        <a href="#/profile" className={`me${page === 'profile' ? ' is-active' : ''}`}>
          {profile.photo ? <img src={profile.photo} alt="" /> : <span className="avatar">{profile.name.slice(0, 1).toUpperCase()}</span>}
          <span>
            {profile.name} <small>{profile.role}</small>
          </span>
        </a>
      </header>
      <div className="shell-main">
        {page === 'exercises' && <ExerciseList />}
        {page === 'exercise' && arg && <ExerciseView id={arg} />}
        {page === 'new' && creator && <Editor id={null} />}
        {page === 'edit' && arg && creator && <Editor id={arg} />}
        {page === 'users' && profile.role === 'admin' && <Users />}
        {page === 'notifications' && profile.role === 'admin' && <Notifications />}
        {page === 'profile' && <ProfilePage />}
      </div>
      <footer className="footer">{DISCLAIMER}</footer>
    </div>
  );
}
