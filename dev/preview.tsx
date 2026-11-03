// Development only (not part of the published site): renders screens with a
// stand-in profile so they can be looked at without signing in.
// Open /dev/preview.html#editor, #play or #steps on `npm run dev`.
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../src/auth';
import { Editor } from '../src/exercises/Editor';
import { Flowchart } from '../src/exercises/Flowchart';
import { NodeDetails } from '../src/exercises/NodeDetails';
import { Run } from '../src/exercises/Player';
import { seedExercise } from '../src/exercises/seed';
import type { ExerciseNode, Profile } from '../src/exercises/model';
import { useState } from 'react';
import '../src/styles.css';
import '../src/app.css';
import '../src/work.css';

const profile: Profile = { uid: 'preview', email: 'preview@example.test', name: 'Preview', surname: 'User', role: 'admin', canVote: true, canReview: true, createdAt: 0 };
const ex = seedExercise();

function Steps() {
  const [step, setStep] = useState<string | null>(ex.content.nodes[1].id);
  return (
    <main className="page">
      <section className="card-block">
        <div className="steps-read">
          <div className="flow-wrap">
            <Flowchart nodes={ex.content.nodes} selected={step} onSelect={setStep} compact />
          </div>
          {step && <NodeDetails node={ex.content.nodes.find((n) => n.id === step)!} nodes={ex.content.nodes} onSelect={setStep} />}
        </div>
      </section>
    </main>
  );
}

/** Steps that loop back, to check how arrows going up are drawn. */
const loop: ExerciseNode[] = [
  { id: 'start', kind: 'start', next: 'a1' },
  { id: 'a1', kind: 'action', name: 'Set the IRS to ALIGN', substeps: [], next: 'a2' },
  { id: 'a2', kind: 'action', name: 'Enter present position', substeps: [], next: 'd1' },
  { id: 'd1', kind: 'decision', name: 'Is CLR illuminated?', question: '', answer: { type: 'choice', options: [{ label: 'Yes', next: 'a2' }, { label: 'No', next: 'd2' }] } },
  { id: 'd2', kind: 'decision', name: 'ALIGN light still on?', question: '', answer: { type: 'choice', options: [{ label: 'Restart', next: 'a1' }, { label: 'Done', next: 'end' }] } },
  { id: 'end', kind: 'end' },
];

function Loop({ compact }: { compact: boolean }) {
  const [step, setStep] = useState<string | null>('d1');
  return (
    <main className="page">
      <section className="card-block" style={{ maxWidth: compact ? 260 : undefined }}>
        <div className="flow-wrap">
          <Flowchart nodes={loop} selected={step} onSelect={setStep} compact={compact} />
        </div>
      </section>
    </main>
  );
}

// no menu bar here, so page headers stick to the very top
document.documentElement.style.setProperty('--bar-h', '0px');
const view = location.hash.slice(1) || 'editor';
createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider value={{ user: null, profile, loading: false, refresh: async () => {} }}>
    {view === 'loop' ? <Loop compact={false} /> : view === 'loop-narrow' ? <Loop compact /> : view === 'play' ? <Run id={ex.id} name={ex.name} content={ex.content} draft={false} /> : view === 'steps' ? <Steps /> : <div className="shell"><div className="shell-main"><Editor id={null} /></div></div>}
  </AuthContext.Provider>,
);
