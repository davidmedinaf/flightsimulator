// Checks the deployed security rules with the test accounts: what each role may
// and may not do. Cleans up after itself. Run with `npm run check:rules`.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase/config';
import { SEED_ID } from '../src/exercises/seed';

const env = Object.fromEntries(
  readFileSync('C:/AI/PROJECTS/_secrets/flightsim-test-users.env', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => [m[1], m[2]]),
);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let failures = 0;
const as = async (key: string) => {
  await signOut(auth);
  return (await signInWithEmailAndPassword(auth, env[`${key}_EMAIL`], env[`${key}_PASSWORD`])).user.uid;
};
async function check(what: string, allowed: boolean, fn: () => Promise<unknown>) {
  let ok: boolean;
  try {
    await fn();
    ok = allowed;
  } catch (e) {
    ok = !allowed && (e as { code?: string }).code === 'permission-denied';
    if (allowed) console.log('     ', (e as Error).message);
  }
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what} (${allowed ? 'allowed' : 'refused'})`);
}

const testId = `rules-test-${Date.now()}`;
const creator = await as('CREATOR');
const draft = { name: 'Rules test', description: '', ownerId: creator, ownerName: 'Creator Test', content: { panels: ['fwd-overhead'], initial: {}, nodes: [] }, releaseNote: '', basedOn: 0, updatedAt: Date.now() };
await check('creator saves a draft', true, () => setDoc(doc(db, 'drafts', testId), draft));
await check('creator publishes it as private', true, () =>
  setDoc(doc(db, 'exercises', testId), { ...draft, visibility: 'private', sharedWith: [], version: 1, publishedAt: Date.now(), hasDraft: false }),
);
await check('creator cannot make themselves admin', false, () => updateDoc(doc(db, 'users', creator), { role: 'admin' }));
await check('creator cannot publish under another owner', false, () => setDoc(doc(db, 'exercises', `${testId}-x`), { ...draft, ownerId: 'someone-else', visibility: 'public', sharedWith: [] }));

const t1 = await as('TEST1');
await check('user reads the public example exercise', true, () => getDoc(doc(db, 'exercises', SEED_ID)));
await check("user cannot read the creator's private exercise", false, () => getDoc(doc(db, 'exercises', testId)));
await check("user cannot read the creator's draft", false, () => getDoc(doc(db, 'drafts', testId)));
await check('user cannot edit the example exercise', false, () => updateDoc(doc(db, 'exercises', SEED_ID), { name: 'hacked' }));
await check('user cannot create an exercise', false, () => setDoc(doc(db, 'drafts', `${testId}-u`), { ...draft, ownerId: t1 }));
await check('user cannot change own permissions', false, () => updateDoc(doc(db, 'users', t1), { canVote: false }));
await check('user edits own name', true, () => updateDoc(doc(db, 'users', t1), { surname: 'User One' }));
const rid = `${SEED_ID}_${t1}`;
await check('user votes and comments', true, () => setDoc(doc(db, 'reviews', rid), { exerciseId: SEED_ID, uid: t1, userName: 'Test User One', stars: 4, comment: 'Clear.', version: 1, updatedAt: Date.now() }));
await check('a vote above 5 is refused', false, () => setDoc(doc(db, 'reviews', rid), { exerciseId: SEED_ID, uid: t1, userName: 'Test', stars: 6, comment: '', version: 1, updatedAt: Date.now() }));
await check("user cannot write another user's review", false, () => setDoc(doc(db, 'reviews', `${SEED_ID}_other`), { exerciseId: SEED_ID, uid: 'other', userName: 'x', stars: 1, comment: '', version: 1, updatedAt: 0 }));
await check('user cannot read notifications', false, () => getDoc(doc(db, 'notifications', 'any')));
await check('user removes own review', true, () => deleteDoc(doc(db, 'reviews', rid)));

await as('CREATOR');
await check('creator shares the private exercise with test user 1', true, () => updateDoc(doc(db, 'exercises', testId), { sharedWith: [t1] }));
await as('TEST1');
await check('test user 1 now reads it', true, () => getDoc(doc(db, 'exercises', testId)));
await as('TEST2');
await check('test user 2 still cannot', false, () => getDoc(doc(db, 'exercises', testId)));

await as('CREATOR');
await check('creator deletes the test exercise', true, async () => {
  await deleteDoc(doc(db, 'drafts', testId));
  await deleteDoc(doc(db, 'exercises', testId));
});
await signOut(auth);
console.log(failures ? `${failures} failed` : 'Rules OK');
process.exit(failures ? 1 : 0);
