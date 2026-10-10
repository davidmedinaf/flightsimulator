import { useEffect, useRef } from 'react';
import { groupOf, stepControls, stepPanel } from '../data';
import type { LightLevel, Procedure, Step } from '../data/types';
import { conditionHolds, mismatches, type SimState } from '../sim';
import { StepCard } from './StepCard';

interface Props {
  procedure: Procedure;
  step: Step;
  sim: SimState;
  levels: Record<string, LightLevel>;
  onJump: (id: string) => void;
}

/** True when the practice panel already shows what the step asks for. */
export function stepSatisfied(step: Step, sim: SimState, levels: Record<string, LightLevel>): boolean {
  if (!step.expect) return false;
  return !conditionHolds(sim, step.when) || mismatches(step.expect, sim, levels).length === 0;
}

/**
 * Step-by-step view: the steps of the current sub-panel as a list, with the
 * current one opened in full. Any row can be tapped to go to that step.
 */
export function GuidedPane({ procedure, step, sim, levels, onJump }: Props) {
  const group = groupOf(step);
  const head = procedure.steps.find((s) => s.id === group);
  const rows = procedure.steps.filter((s) => groupOf(s) === group);
  const current = useRef<HTMLLIElement>(null);

  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' });
  }, [step.id]);

  return (
    <>
      <header className="pane-head">
        <h2>
          {head?.title}
          {head?.target && <span> … {head.target}</span>}
        </h2>
        <span className="pane-count">
          {rows.findIndex((s) => s.id === step.id) + 1} / {rows.length}
        </span>
      </header>
      <ol className="rows">
        {rows.map((s) => {
          const n = procedure.steps.indexOf(s) + 1;
          if (s.id === step.id) {
            return (
              <li key={s.id} className="row-current" ref={current} aria-current="step">
                <span className="row-num">{n}</span>
                <StepCard
                  step={s}
                  panel={stepPanel(procedure, s)}
                  controls={stepControls(procedure, s)}
                  sim={sim}
                  levels={levels}
                />
              </li>
            );
          }
          return (
            <li key={s.id}>
              <button className={`row row-${s.type} row-l${s.level}`} onClick={() => onJump(s.id)}>
                <span className="row-num">{n}</span>
                <span className="row-text">
                  {s.title}
                  {s.target && <em> … {s.target}</em>}
                </span>
                {stepSatisfied(s, sim, levels) && <span className="row-ok" aria-label="Shown on the panel" />}
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}
