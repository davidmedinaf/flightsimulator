import { useEffect, useMemo, useRef, useState } from 'react';
import { elementLabel } from './data';
import type { Panel } from './data/types';
import { cycleLight, isTimed, lightLevels, operate, press, release, stateWord, type SimState } from './sim';

/** Sounds for the warning tests, made in the browser; they play only after a tap. */
const sound = (() => {
  let ctx: AudioContext | null = null;
  const loops: Record<string, () => void> = {};
  const ac = () => (ctx ??= new AudioContext());
  function clacker(id: string) {
    const a = ac();
    const tick = () => {
      const buf = a.createBuffer(1, a.sampleRate * 0.03, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * 0.006));
      const n = a.createBufferSource();
      n.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      n.connect(f).connect(a.destination);
      n.start();
    };
    tick();
    const t = setInterval(tick, 105);
    loops[id] = () => clearInterval(t);
  }
  function shaker(id: string) {
    const a = ac();
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 22;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 140;
    const g = a.createGain();
    g.gain.value = 0.5;
    o.connect(lp).connect(g).connect(a.destination);
    o.start();
    loops[id] = () => o.stop();
  }
  return {
    start(kind: 'clacker' | 'shaker', id: string) {
      try {
        (kind === 'clacker' ? clacker : shaker)(id);
      } catch {
        // no audio available: the message still shows
      }
    },
    stop(id: string) {
      loops[id]?.();
      delete loops[id];
    },
  };
})();

/**
 * Operating a panel: switch taps, momentary buttons, light previews, the
 * warning-test sounds, and redrawing while lights depend on time.
 */
export function usePanel(panel: Panel, sim: SimState, setSim: (u: (s: SimState) => SimState) => void) {
  const schematic = panel.schematic;
  const [lastOp, setLastOp] = useState<string | null>(null);
  const [effect, setEffect] = useState<{ message: string; shake: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const simRef = useRef(sim);
  simRef.current = sim;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const levels = useMemo(() => lightLevels(schematic, sim), [schematic, sim, tick]);

  useEffect(() => {
    if (!isTimed(schematic, sim)) return;
    const t = setTimeout(() => setTick((n) => n + 1), 300);
    return () => clearTimeout(t);
  }, [schematic, sim, tick]);

  const label = (id: string) => elementLabel(panel, id);

  return {
    levels,
    lastOp,
    effect,
    setLastOp,
    onOperate(id: string) {
      const next = operate(schematic, simRef.current, id);
      setSim(() => next);
      const sw = schematic.switches.find((s) => s.id === id);
      const shownId = sw?.style === 'select' ? sw.group! : id;
      const value = next.pos[shownId];
      const posLabel = sw?.positions?.find((p) => p.id === value)?.label;
      setLastOp(`${sw?.style === 'select' ? sw.label : label(id)}: ${posLabel ?? stateWord(value)}`);
    },
    onPress(id: string) {
      setSim((s) => press(schematic, s, id));
      const sw = schematic.switches.find((s) => s.id === id);
      if (sw?.effect) {
        sound.start(sw.effect.sound, id);
        setEffect({ message: sw.effect.message, shake: sw.effect.sound === 'shaker' });
      }
      setLastOp(`${label(id)}: pushed`);
    },
    onRelease(id: string) {
      setSim((s) => release(s, id));
      sound.stop(id);
      setEffect(null);
    },
    onLight(id: string) {
      const next = cycleLight(schematic, simRef.current, id);
      setSim(() => next);
      const o = next.override[id];
      setLastOp(`${label(id)}: ${o ? `${stateWord(o)} (preview)` : 'back to what the panel shows'}`);
    },
  };
}
