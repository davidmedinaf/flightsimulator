import { useEffect, useState } from 'react';
import { PanelView, type ViewMode } from './components/PanelView';
import { Review } from './components/Review';
import { StepCard } from './components/StepCard';
import { isMapped, procedures, stepControls, stepPanel } from './data';
import { advance, currentStep, goBack, loadRun, nextStepId, saveRun, startRun, type RunState } from './engine';

const DISCLAIMER =
  'Simulator training aid only. Not a certified aviation procedure system. Follow approved training materials and instructor guidance.';

type Screen = 'home' | 'run' | 'review';

export default function App() {
  const procedure = procedures[0];
  const [screen, setScreen] = useState<Screen>('home');
  const [run, setRun] = useState<RunState | null>(() => loadRun(procedure));
  const [mode, setMode] = useState<ViewMode>('focus');
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => saveRun(run), [run]);

  const total = procedure.steps.length;
  const mappedCount = procedure.steps.filter((s) => isMapped(procedure, s)).length;

  function begin(fresh: boolean) {
    if (fresh || !run) setRun(startRun(procedure));
    setConfirmRestart(false);
    setScreen('run');
  }

  // Functional updates, so quick repeated taps each act on the latest state.
  const forward = (choiceNext?: string) => setRun((r) => (r ? advance(procedure, r, choiceNext) : r));
  const back = () => setRun((r) => (r ? goBack(r) : r));

  function restart() {
    setRun(startRun(procedure));
    setConfirmRestart(false);
  }

  useEffect(() => {
    if (screen !== 'run' || !run) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !run.finished && currentStep(procedure, run).type !== 'choice') {
        forward();
      }
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, run, procedure]);

  if (screen === 'review') {
    return <Review procedure={procedure} onClose={() => setScreen(run ? 'run' : 'home')} />;
  }

  if (screen === 'home' || !run) {
    const resumable = run && (run.history.length > 1 || run.finished);
    return (
      <div className="home">
        <main className="home-card">
          <p className="eyebrow">Proof of concept · 737 MAX flight simulator</p>
          <h1>Procedure Trainer</h1>
          <p className="lead">
            A guided walkthrough of a flight deck procedure. Each step shows the instruction from the manual and, where
            the control is on the panel photo, highlights it.
          </p>

          <section className="procedure">
            <h2>{procedure.title}</h2>
            <p>{procedure.summary}</p>
            <dl>
              <div>
                <dt>Steps</dt>
                <dd>{total}</dd>
              </div>
              <div>
                <dt>Shown on the panel photo</dt>
                <dd>{mappedCount}</dd>
              </div>
              <div>
                <dt>Text-only</dt>
                <dd>{total - mappedCount}</dd>
              </div>
            </dl>
            <p className="muted">
              Source: {procedure.source.document}, {procedure.source.chapter}, {procedure.source.manualPages} (
              {procedure.source.revision}).
            </p>
          </section>

          <div className="home-actions">
            {resumable ? (
              <>
                <button className="btn btn-primary" onClick={() => begin(false)}>
                  Resume exercise
                </button>
                <button className="btn" onClick={() => begin(true)}>
                  Start from the beginning
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => begin(true)}>
                Start exercise
              </button>
            )}
            <button className="btn btn-quiet" onClick={() => setScreen('review')}>
              Mapping review
            </button>
          </div>

          <p className="disclaimer">{DISCLAIMER}</p>
        </main>
      </div>
    );
  }

  const step = currentStep(procedure, run);
  const index = procedure.steps.findIndex((s) => s.id === step.id);
  const panel = stepPanel(procedure, step);
  const controls = stepControls(procedure, step);
  const isLast = nextStepId(procedure, step) === null;
  const progress = run.finished ? 100 : ((index + 1) / total) * 100;

  return (
    <div className="run">
      <header className="topbar">
        <div className="topbar-title">
          <strong>{procedure.title}</strong>
          <span>{run.finished ? 'Complete' : `Step ${index + 1} of ${total}`}</span>
        </div>
        {confirmRestart ? (
          <div className="confirm">
            <span>Restart from step 1?</span>
            <button className="btn btn-danger" onClick={restart}>
              Restart
            </button>
            <button className="btn btn-quiet" onClick={() => setConfirmRestart(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="topbar-actions">
            <button className="btn btn-quiet" onClick={() => setScreen('home')}>
              Home
            </button>
            <button className="btn btn-quiet" onClick={() => setConfirmRestart(true)}>
              Restart exercise
            </button>
          </div>
        )}
      </header>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={run.finished ? total : index + 1}
      >
        <div style={{ width: `${progress}%` }} />
      </div>

      {run.finished ? (
        <main className="done">
          <div className="home-card">
            <p className="eyebrow">End of the exercise</p>
            <h1>Walkthrough complete</h1>
            <p className="lead">
              You have stepped through all {total} items, from “{procedure.steps[0].title} …{' '}
              {procedure.steps[0].target}” to “{procedure.steps[total - 1].title} … {procedure.steps[total - 1].target}
              ”.
            </p>
            <p>
              This app only presents the steps. It is not connected to the simulator and has not checked that any
              switch or indication is in the stated condition.
            </p>
            <div className="home-actions">
              <button className="btn btn-primary" onClick={restart}>
                Restart exercise
              </button>
              <button className="btn" onClick={() => back()}>
                Back to the last step
              </button>
              <button className="btn btn-quiet" onClick={() => setScreen('home')}>
                Home
              </button>
            </div>
            <p className="disclaimer">{DISCLAIMER}</p>
          </div>
        </main>
      ) : (
        <main className="stage">
          <section className="panel-area">
            {panel && <PanelView panel={panel} highlights={controls} mode={mode} dimmed={controls.length === 0} />}
            <div className="panel-chrome">
              <span className="panel-name">{panel?.name}</span>
              {controls.length > 0 ? (
                <button className="btn btn-overlay" onClick={() => setMode(mode === 'focus' ? 'full' : 'focus')}>
                  {mode === 'focus' ? 'Show full panel' : 'Zoom to control'}
                </button>
              ) : (
                <span className="panel-note">
                  {step.textOnly === 'info' ? 'Nothing to highlight for this step' : 'Panel image not available in this POC'}
                </span>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-scroll">
              <StepCard procedure={procedure} step={step} controls={controls} panelName={panel?.name} />
            </div>
            {step.type === 'choice' && step.choices ? (
              <nav className="nav nav-choices">
                <button className="btn" onClick={() => back()} disabled={run.history.length <= 1}>
                  Previous
                </button>
                {step.choices.map((c) => (
                  <button key={c.next} className="btn btn-primary" onClick={() => forward(c.next)}>
                    {c.label}
                  </button>
                ))}
              </nav>
            ) : (
              <nav className="nav">
                <button className="btn" onClick={() => back()} disabled={run.history.length <= 1}>
                  Previous
                </button>
                <button className="btn btn-primary" onClick={() => forward()}>
                  {isLast ? 'Finish' : 'Next'}
                </button>
              </nav>
            )}
          </section>
        </main>
      )}

      <footer className="footer">{DISCLAIMER}</footer>
    </div>
  );
}
