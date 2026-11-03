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
import type { Profile } from '../src/exercises/model';
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

const view = location.hash.slice(1) || 'editor';
createRoot(document.getElementById('root')!).render(
  <AuthContext.Provider value={{ user: null, profile, loading: false, refresh: async () => {} }}>
    {view === 'play' ? <Run id={ex.id} name={ex.name} content={ex.content} draft={false} /> : view === 'steps' ? <Steps /> : <div className="shell"><div className="shell-main"><Editor id={null} /></div></div>}
  </AuthContext.Provider>,
);
