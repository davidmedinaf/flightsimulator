import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createProfile, loadProfile } from './exercises/store';
import type { Profile, Role } from './exercises/model';
import { auth } from './firebase';

/** Addresses that start with a role other than "user" (the project owner's). Must match firestore.rules. */
const SEED_ROLES: Record<string, Role> = {
  'damefr@hotmail.com': 'admin',
  'damefr+creator@hotmail.com': 'creator',
};

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true, refresh: async () => {} });

export const useAuth = () => useContext(AuthContext);

let pendingName: { name: string; surname: string } | null = null;

async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await loadProfile(user.uid);
  if (existing) return existing;
  const email = user.email ?? '';
  const p: Profile = {
    uid: user.uid,
    email,
    name: pendingName?.name ?? email.split('@')[0],
    surname: pendingName?.surname ?? '',
    role: SEED_ROLES[email.toLowerCase()] ?? 'user',
    canVote: true,
    canReview: true,
    createdAt: Date.now(),
  };
  pendingName = null;
  await createProfile(p);
  return p;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setProfile(u ? await ensureProfile(u).catch(() => null) : null);
        setLoading(false);
      }),
    [],
  );

  const refresh = async () => {
    if (auth.currentUser) setProfile(await loadProfile(auth.currentUser.uid));
  };

  return <AuthContext.Provider value={{ user, profile, loading, refresh }}>{children}</AuthContext.Provider>;
}

export async function signUp(email: string, password: string, name: string, surname: string) {
  pendingName = { name, surname };
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export const signIn = (email: string, password: string) => signInWithEmailAndPassword(auth, email.trim(), password);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());
export const logOut = () => signOut(auth);

/** Firebase error codes as sentences a person can act on. */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const known: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is wrong.',
    'auth/wrong-password': 'The email or password is wrong.',
    'auth/user-not-found': 'There is no account with that email.',
    'auth/email-already-in-use': 'An account with that email already exists. Sign in instead, or reset the password.',
    'auth/weak-password': 'Choose a password of at least 6 characters.',
    'auth/invalid-email': 'That email address does not look right.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/network-request-failed': 'No connection. Check the network and try again.',
    'auth/user-disabled': 'This account has been disabled by an administrator.',
  };
  return known[code] ?? 'Something went wrong. Try again.';
}
