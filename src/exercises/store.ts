import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Draft, Notice, Profile, Published, Review } from './model';

/*
 * All database access. The security rules in firestore.rules decide what each
 * role may read and write; the queries here only ask for what the rules allow,
 * because Firestore refuses a query that could return a forbidden document.
 */

const clean = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

// ---------- profiles ----------

export async function loadProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ uid, ...snap.data() } as Profile) : null;
}

export async function createProfile(p: Profile): Promise<void> {
  const { uid, ...data } = p;
  await setDoc(doc(db, 'users', uid), clean(data));
}

export async function updateProfile(uid: string, patch: Partial<Profile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), clean(patch));
}

export async function listProfiles(): Promise<Profile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Profile);
}

/** Removes a profile. The sign-in account itself is removed from the Firebase console. */
export async function deleteProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}

// ---------- exercises ----------

const merge = <T extends { id: string }>(lists: T[][]) => [...new Map(lists.flat().map((x) => [x.id, x])).values()];

export async function listExercises(me: Profile): Promise<{ published: Published[]; drafts: Draft[] }> {
  const ex = collection(db, 'exercises');
  const dr = collection(db, 'drafts');
  const read = async <T,>(q: Parameters<typeof getDocs>[0]) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
  if (me.role === 'admin') {
    const [published, drafts] = await Promise.all([read<Published>(ex), read<Draft>(dr)]);
    return { published, drafts };
  }
  const queries = [read<Published>(query(ex, where('visibility', '==', 'public'))), read<Published>(query(ex, where('sharedWith', 'array-contains', me.uid)))];
  if (me.role === 'creator') queries.push(read<Published>(query(ex, where('ownerId', '==', me.uid))));
  const drafts = me.role === 'creator' ? await read<Draft>(query(dr, where('ownerId', '==', me.uid))) : [];
  return { published: merge(await Promise.all(queries)), drafts };
}

export async function loadPublished(id: string): Promise<Published | null> {
  const snap = await getDoc(doc(db, 'exercises', id));
  return snap.exists() ? ({ id, ...snap.data() } as Published) : null;
}

export async function loadDraft(id: string): Promise<Draft | null> {
  try {
    const snap = await getDoc(doc(db, 'drafts', id));
    return snap.exists() ? ({ id, ...snap.data() } as Draft) : null;
  } catch {
    return null; // not allowed to see it
  }
}

export async function saveDraft(d: Draft): Promise<void> {
  const { id, ...data } = d;
  await setDoc(doc(db, 'drafts', id), clean({ ...data, updatedAt: Date.now() }));
  // the published version, if any, notes that a draft exists
  const pub = await getDoc(doc(db, 'exercises', id));
  if (pub.exists() && !pub.data().hasDraft) await updateDoc(doc(db, 'exercises', id), { hasDraft: true });
}

/** Starts a draft from the published version (version N becomes the base of draft N + 1). */
export async function draftFromPublished(p: Published): Promise<Draft> {
  const d: Draft = {
    id: p.id,
    name: p.name,
    description: p.description,
    ownerId: p.ownerId,
    ownerName: p.ownerName,
    content: p.content,
    releaseNote: '',
    basedOn: p.version,
    updatedAt: Date.now(),
  };
  await saveDraft(d);
  return d;
}

/** Publishing overwrites the published version and deletes the draft. */
export async function publishDraft(d: Draft, existing: Published | null): Promise<Published> {
  const now = Date.now();
  const p: Published = {
    id: d.id,
    name: d.name,
    description: d.description,
    ownerId: d.ownerId,
    ownerName: d.ownerName,
    content: d.content,
    updatedAt: now,
    visibility: existing?.visibility ?? 'private',
    sharedWith: existing?.sharedWith ?? [],
    version: (existing?.version ?? 0) + 1,
    publishedAt: now,
    releaseNote: d.releaseNote,
    hasDraft: false,
  };
  const { id, ...data } = p;
  const batch = writeBatch(db);
  batch.set(doc(db, 'exercises', id), clean(data));
  batch.delete(doc(db, 'drafts', id));
  await batch.commit();
  return p;
}

export async function discardDraft(id: string): Promise<void> {
  await deleteDoc(doc(db, 'drafts', id));
  const pub = await getDoc(doc(db, 'exercises', id));
  if (pub.exists()) await updateDoc(doc(db, 'exercises', id), { hasDraft: false });
}

export async function setSharing(id: string, visibility: Published['visibility'], sharedWith: string[]): Promise<void> {
  await updateDoc(doc(db, 'exercises', id), { visibility, sharedWith, updatedAt: Date.now() });
}

export async function deleteExercise(id: string): Promise<void> {
  await Promise.allSettled([deleteDoc(doc(db, 'drafts', id)), deleteDoc(doc(db, 'exercises', id))]);
}

// ---------- reviews ----------

export function watchReviews(exerciseId: string, cb: (r: Review[]) => void): () => void {
  return onSnapshot(query(collection(db, 'reviews'), where('exerciseId', '==', exerciseId)), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review)),
  );
}

export async function saveReview(r: Omit<Review, 'id' | 'updatedAt'>): Promise<void> {
  await setDoc(doc(db, 'reviews', `${r.exerciseId}_${r.uid}`), clean({ ...r, updatedAt: Date.now() }));
}

export async function deleteReview(exerciseId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'reviews', `${exerciseId}_${uid}`));
}

// ---------- notifications ----------

export async function notifyAdmins(n: Omit<Notice, 'id' | 'createdAt' | 'read'>): Promise<void> {
  await setDoc(doc(collection(db, 'notifications')), clean({ ...n, createdAt: Date.now(), read: false }));
}

export function watchNotices(cb: (n: Notice[]) => void): () => void {
  return onSnapshot(collection(db, 'notifications'), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notice).sort((a, b) => b.createdAt - a.createdAt)),
  );
}

export async function markNotice(id: string, read: boolean): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read });
}

export async function deleteNotice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', id));
}
