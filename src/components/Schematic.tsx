import { useMemo } from 'react';
import type { LightLevel, Schematic as SchematicData } from '../data/types';
import { operable, type SimState } from '../sim';
import { DEFS, drawDynamic, drawStatic, lightBox, switchBox } from './draw';

interface Props {
  schematic: SchematicData;
  sim: SimState;
  levels: Record<string, LightLevel>;
  /** Omit to draw a panel that cannot be operated. */
  onOperate?: (id: string) => void;
  /** Momentary controls (push buttons, keys): pressed and released. */
  onPress?: (id: string) => void;
  onRelease?: (id: string) => void;
  /** A light was tapped. */
  onLight?: (id: string) => void;
}

/** The panel drawn from data. Every operable switch and every light can be tapped. */
export function Schematic({ schematic, sim, levels, onOperate, onPress, onRelease, onLight }: Props) {
  const view = schematic.view ?? [0, 0, schematic.width, schematic.height];
  const staticPart = useMemo(() => DEFS + drawStatic(schematic), [schematic]);
  const dynamicPart = drawDynamic(schematic, sim, levels);

  function down(e: React.PointerEvent, id: string, momentary: boolean) {
    e.preventDefault();
    if (!momentary) return onOperate?.(id);
    onPress?.(id);
    const up = () => {
      onRelease?.(id);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  return (
    <svg className="schematic" viewBox={view.join(' ')} role="group" aria-label="Schematic of the panel">
      <g dangerouslySetInnerHTML={{ __html: staticPart }} />
      <g dangerouslySetInnerHTML={{ __html: dynamicPart }} />
      {onOperate && (
        <g>
          {onLight &&
            schematic.lights.map((l) => {
              const b = lightBox(l);
              return (
                <rect
                  key={l.id}
                  className="hit hit-light"
                  x={b.x - 2}
                  y={b.y - 2}
                  width={b.w + 4}
                  height={b.h + 4}
                  rx={4}
                  role="button"
                  aria-label={`${l.name ?? l.lines.join(' ')}: ${levels[l.id]}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onLight(l.id);
                  }}
                />
              );
            })}
          {schematic.switches.filter(operable).map((sw) => {
            const b = switchBox(sw);
            const momentary = Boolean(sw.momentary);
            return (
              <rect
                key={sw.id}
                className="hit"
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={8}
                role="button"
                tabIndex={0}
                aria-label={`${sw.label}${sim.pos[sw.id] ? `: ${sim.pos[sw.id]}` : ''}`}
                onPointerDown={(e) => down(e, sw.id, momentary)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  if (!momentary) return onOperate(sw.id);
                  onPress?.(sw.id);
                  setTimeout(() => onRelease?.(sw.id), 200);
                }}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
