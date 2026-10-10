import { useEffect, useMemo, useState } from 'react';
import { Contents, type ContentsGroup } from './components/Contents';
import { GuidedPane } from './components/GuidedPane';
import { PanelView, type Highlight, type Tone, type ViewMode } from './components/PanelView';
import { itemStatus, PracticePane } from './components/PracticePane';
import { Review } from './components/Review';
import { elementLabel, groupOf, isMapped, panels, procedures, stepControls } from './data';
import { advance, currentStep, goBack, jumpTo, loadRun, nextStepId, saveRun, startRun, type RunState } from './engine';
import { buildPractice, freshPractice, loadPractice, savePractice, type PracticeState } from './practice';
import { initialSim, lightLevels, loadSim, operate, saveSim, stateWord, type SimState } from './sim';

const DISCLAIMER =
  'Simulator training aid only. Not a certified aviation procedure system. Follow approved training materials and instructor guidance.';

type Screen = 'home' | 'guided' | 'practice' | 'review';

/**
 * Optional deep link, read once at start: #guided/<step id> or
 * #practice/<section id>, optionally followed by /full, /contents and
 * /<switch>=<position>,...
 */
function readLink() {
  const [screen, target, ...rest] = decodeURIComponent(location.hash.slice(1)).split('/');
  const set = rest.find((p) => p.includes('='));
  return {
    screen: (['guided', 'practice', 'review'].includes(screen) ? screen : 'home') as Screen,
    target,
    full: rest.includes('full'),
    contents: rest.includes('contents'),
    set: set ? set.split(',').map((pair) => pair.split('=') as [string, string]) : [],
  };
}

export default function App() {
  const procedure = procedures[0];
  const panel = panels[procedure.defaultPanel];
  const sections = useMemo(() => buildPractice(procedure), [procedure]);
  const [link] = useState(readLink);

  const [screen, setScreen] = useState<Screen>(link.screen);
  const [run, setRun] = useState<RunState | null>(() => {
    const saved = loadRun(procedure);
    return link.screen === 'guided' ? jumpTo(procedure, saved ?? startRun(procedure), link.target) : saved;
  });
  const [practice, setPractice] = useState<PracticeState>(() => {
    const saved = loadPractice(sections);
    const i = sections.findIndex((s) => s.id === link.target);
    return link.screen === 'practice' && i >= 0 ? { ...saved, section: i, finished: false } : saved;
  });
  const [sim, setSim] = useState<SimState>(() => {
    const saved = loadSim(panel.schematic);
    return { ...saved, pos: { ...saved.pos, ...Object.fromEntries(link.set.filter(([id]) => id in saved.pos)) } };
  });
  const [mode, setMode] = useState<ViewMode>(link.full ? 'full' : 'focus');
  const [contents, setContents] = useState(link.contents);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastOp, setLastOp] = useState<string | null>(null);

  useEffect(() => saveRun(run), [run]);
  useEffect(() => savePractice(practice), [practice]);
  useEffect(() => saveSim(sim), [sim]);

  const levels = useMemo(() => lightLevels(panel.schematic, sim), [panel, sim]);
  const total = procedure.steps.length;
  const mappedCount = procedure.steps.filter((s) => isMapped(procedure, s)).length;

  function onOperate(id: string) {
    const next = operate(panel.schematic, sim, id);
    setSim(next);
    setLastOp(`${elementLabel(panel, id)}: ${stateWord(next.pos[id])}`);
  }

  // Functional updates, so quick repeated taps each act on the latest state.
  const forward = (choiceNext?: string) => setRun((r) => (r ? advance(procedure, r, choiceNext) : r));
  const back = () => setRun((r) => (r ? goBack(r) : r));
  const jump = (id: string) => {
    setRun((r) => jumpTo(procedure, r ?? startRun(procedure), id));
    setContents(false);
  };
  const goSection = (i: number) => {
    setPractice((p) => (i >= sections.length ? { ...p, finished: true } : { ...p, section: Math.max(0, i), finished: false }));
    setSelected(null);
    setContents(false);
  };

  function restart() {
    setRun(startRun(procedure));
    setPractice(freshPractice);
    setSim(initialSim(panel.schematic));
    setSelected(null);
    setLastOp(null);
    setConfirmRestart(false);
  }

  function open(target: 'guided' | 'practice') {
    if (target === 'guided' && !run) setRun(startRun(procedure));
    setConfirmRestart(false);
    setScreen(target);
  }

  useEffect(() => {
    if (screen !== 'guided' || !run || contents) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !run.finished && currentStep(procedure, run).type !== 'choice') forward();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, run, procedure, contents]);

  if (screen === 'review') {
    return <Review procedure={procedure} onClose={() => setScreen('home')} />;
  }

  if (screen === 'home' || (screen === 'guided' && !run)) {
    const started = (run && (run.history.length > 1 || run.finished)) || practice.section > 0 || practice.ticks.length > 0;
    return (
      <div className="home">
        <main className="home-card">
          <p className="eyebrow">Proof of concept · 737 MAX flight simulator</p>
          <h1>Procedure Trainer</h1>
          <p className="lead">
            Practise a flight deck procedure on a schematic panel you can operate: switches move when you tap them and
            the lights respond.
          </p>

          <section className="procedure">
            <h2>{procedure.title}</h2>
            <p>{procedure.summary}</p>
            <p className="muted">
              Source: {procedure.source.document}, {procedure.source.chapter}, {procedure.source.manualPages} (
              {procedure.source.revision}).
            </p>
          </section>

          <div className="modes">
            <button className="mode" onClick={() => open('guided')}>
              <strong>Step by step</strong>
              <span>
                {total} steps, one at a time, in the manual's wording. {mappedCount} are shown on the panel. For learning
                the procedure.
              </span>
            </button>
            <button className="mode" onClick={() => open('practice')}>
              <strong>Practice</strong>
              <span>
                {sections.length} sub-panels. For each one, the actions to perform and the checks to make, grouped. For
                regular practice.
              </span>
            </button>
          </div>

          <div className="home-actions">
            {started && (
              <button className="btn" onClick={restart}>
                Reset panel and progress
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

  const guided = screen === 'guided' && run ? run : null;
  const step = guided ? currentStep(procedure, guided) : null;
  const index = step ? procedure.steps.findIndex((s) => s.id === step.id) : practice.section;
  const section = sections[practice.section];
  const finished = guided ? guided.finished : practice.finished;
  const count = guided ? total : sections.length;
  const unit = guided ? 'Step' : 'Sub-panel';

  // What to mark on the panel.
  let highlights: Highlight[] = [];
  if (step) {
    const tone: Tone = step.type === 'action' ? 'action' : step.type === 'check' ? 'check' : 'neutral';
    highlights = stepControls(procedure, step).map((control) => ({ control, tone, pulse: true }));
  } else {
    for (const item of [...section.actions, ...section.checks]) {
      const done = itemStatus(item, sim, levels, practice.ticks) !== 'todo';
      for (const id of item.controls) {
        if (panel.controls[id]) {
          highlights.push({ control: panel.controls[id], tone: done ? 'done' : item.kind, pulse: selected === item.id });
        }
      }
    }
  }

  const todo = sections.map(
    (s) => [...s.actions, ...s.checks].filter((i) => itemStatus(i, sim, levels, practice.ticks) === 'todo').length,
  );

  const groups: ContentsGroup[] = guided
    ? procedure.steps
        .filter((s) => groupOf(s) === s.id)
        .map((head) => ({
          id: head.id,
          title: head.target ? `${head.title} … ${head.target}` : head.title,
          rows: procedure.steps
            .filter((s) => groupOf(s) === head.id)
            .map((s) => ({
              id: s.id,
              n: procedure.steps.indexOf(s) + 1,
              text: s.target ? `${s.title} … ${s.target}` : s.title,
              current: s.id === step?.id,
              onOpen: () => jump(s.id),
            })),
        }))
    : sections.map((s, i) => {
        const items = s.actions.length + s.checks.length;
        return {
          id: s.id,
          title: `${i + 1}. ${s.title}`,
          count: `${items - todo[i]} / ${items}`,
          current: i === practice.section,
          done: todo[i] === 0,
          onOpen: () => goSection(i),
        };
      });

  const isLast = guided && step ? nextStepId(procedure, step) === null : practice.section === sections.length - 1;
  const progress = finished ? 100 : ((index + 1) / count) * 100;
  const remaining = todo.reduce((a, b) => a + b, 0);

  return (
    <div className="run">
      <header className="topbar">
        <div className="topbar-title">
          <strong>{procedure.title}</strong>
          <span>{finished ? 'Complete' : `${unit} ${index + 1} of ${count}`}</span>
        </div>
        {confirmRestart ? (
          <div className="confirm">
            <span>Reset the panel and start again?</span>
            <button className="btn btn-danger" onClick={restart}>
              Restart
            </button>
            <button className="btn btn-quiet" onClick={() => setConfirmRestart(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="topbar-actions">
            <button className="btn btn-quiet btn-contents" onClick={() => setContents(true)}>
              {guided ? 'All steps' : 'All sub-panels'}
            </button>
            <button className="btn btn-quiet" onClick={() => setScreen('home')}>
              Home
            </button>
            <button className="btn btn-quiet" onClick={() => setConfirmRestart(true)}>
              Restart
            </button>
          </div>
        )}
      </header>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={count} aria-valuenow={finished ? count : index + 1}>
        <div style={{ width: `${progress}%` }} />
      </div>

      {finished ? (
        <main className="done">
          <div className="home-card">
            <p className="eyebrow">End of the exercise</p>
            <h1>{guided ? 'Walkthrough complete' : 'Practice complete'}</h1>
            {guided ? (
              <p className="lead">
                You have stepped through all {total} items, from “{procedure.steps[0].title} …{' '}
                {procedure.steps[0].target}” to “{procedure.steps[total - 1].title} … {procedure.steps[total - 1].target}
                ”.
              </p>
            ) : (
              <p className="lead">
                You have been through all {sections.length} sub-panels.{' '}
                {remaining === 0
                  ? 'Every action and check is done.'
                  : `${remaining} ${remaining === 1 ? 'item is' : 'items are'} still open; “All sub-panels” shows where.`}
              </p>
            )}
            <p>
              The panel in this app is a practice panel. It is not connected to the simulator and has not checked that
              any real switch or indication is in the stated condition.
            </p>
            <div className="home-actions">
              <button className="btn btn-primary" onClick={restart}>
                Restart exercise
              </button>
              <button className="btn" onClick={() => (guided ? back() : goSection(sections.length - 1))}>
                {guided ? 'Back to the last step' : 'Back to the last sub-panel'}
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
            <PanelView
              panel={panel}
              highlights={highlights}
              mode={mode}
              sim={sim}
              levels={levels}
              onOperate={onOperate}
              dimmed={highlights.length === 0}
            />
            <div className="panel-chrome">
              <span className="panel-name" aria-live="polite">
                {highlights.length === 0
                  ? step?.textOnly === 'info'
                    ? 'Nothing to highlight for this step'
                    : 'Not on this panel'
                  : (lastOp ?? 'Tap a switch to move it')}
              </span>
              {highlights.length > 0 && (
                <button className="btn btn-overlay" onClick={() => setMode(mode === 'focus' ? 'full' : 'focus')}>
                  {mode === 'focus' ? 'Show full panel' : 'Zoom in'}
                </button>
              )}
            </div>
          </section>

          <section className="card">
            {guided && step ? (
              <GuidedPane procedure={procedure} step={step} sim={sim} levels={levels} onJump={jump} />
            ) : (
              <PracticePane
                panel={panel}
                section={section}
                index={practice.section}
                total={sections.length}
                sim={sim}
                levels={levels}
                ticks={practice.ticks}
                selected={selected}
                onSelect={setSelected}
                onTick={(id, ticked) =>
                  setPractice((p) => ({ ...p, ticks: ticked ? [...p.ticks, id] : p.ticks.filter((t) => t !== id) }))
                }
              />
            )}
            {guided && step?.type === 'choice' && step.choices ? (
              <nav className="nav nav-choices">
                <button className="btn" onClick={() => back()} disabled={guided.history.length <= 1}>
                  Previous
                </button>
                {step.choices.map((c) => (
                  <button key={c.next} className="btn btn-primary" onClick={() => forward(c.next)}>
                    {c.label}
                  </button>
                ))}
              </nav>
            ) : guided ? (
              <nav className="nav">
                <button className="btn" onClick={() => back()} disabled={guided.history.length <= 1}>
                  Previous
                </button>
                <button className="btn btn-primary" onClick={() => forward()}>
                  {isLast ? 'Finish' : 'Next'}
                </button>
              </nav>
            ) : (
              <nav className="nav">
                <button className="btn" onClick={() => goSection(practice.section - 1)} disabled={practice.section === 0}>
                  Previous
                </button>
                <button
                  className={`btn${todo[practice.section] === 0 ? ' btn-primary' : ''}`}
                  onClick={() => goSection(practice.section + 1)}
                >
                  {isLast ? 'Finish' : 'Next sub-panel'}
                  {todo[practice.section] > 0 && <small> · {todo[practice.section]} open</small>}
                </button>
              </nav>
            )}
          </section>
        </main>
      )}

      <footer className="footer">{DISCLAIMER}</footer>

      {contents && (
        <Contents title={guided ? 'All steps' : 'All sub-panels'} groups={groups} onClose={() => setContents(false)} />
      )}
    </div>
  );
}
