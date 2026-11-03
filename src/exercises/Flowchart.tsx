import type { ExerciseNode } from './model';
import { nodeTitle } from './model';

interface Props {
  nodes: ExerciseNode[];
  selected?: string | null;
  /** Steps already passed, while an exercise is played. */
  done?: Set<string>;
  onSelect?: (id: string) => void;
  compact?: boolean;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
}

function edgesOf(n: ExerciseNode): Edge[] {
  if (n.kind === 'end') return [];
  if (n.kind === 'decision') {
    const list = n.answer.type === 'choice' ? n.answer.options : n.answer.ranges;
    return list.filter((o) => o.next).map((o) => ({ from: n.id, to: o.next!, label: o.label }));
  }
  return n.next ? [{ from: n.id, to: n.next }] : [];
}

/** Layers by distance from Start; steps that cannot be reached are placed last. */
function layout(nodes: ExerciseNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const layer = new Map<string, number>();
  const queue = ['start'];
  layer.set('start', 0);
  while (queue.length) {
    const id = queue.shift()!;
    const n = byId.get(id);
    if (!n) continue;
    for (const e of edgesOf(n)) {
      if (!layer.has(e.to) && byId.has(e.to) && e.to !== 'end') {
        layer.set(e.to, layer.get(id)! + 1);
        queue.push(e.to);
      }
    }
  }
  const maxL = Math.max(0, ...layer.values());
  let extra = maxL + 1;
  for (const n of nodes) if (!layer.has(n.id) && n.id !== 'end') layer.set(n.id, extra++);
  layer.set('end', Math.max(...layer.values()) + 1);
  const rows: string[][] = [];
  for (const n of nodes) (rows[layer.get(n.id)!] ??= []).push(n.id);
  return { rows: rows.filter(Boolean), edges: nodes.flatMap(edgesOf) };
}

const KIND = { start: 'Start', end: 'End', action: 'Action', decision: 'Decision' } as const;

export function Flowchart({ nodes, selected, done, onSelect, compact }: Props) {
  const W = compact ? 180 : 220;
  const H = compact ? 50 : 56;
  const GX = 28;
  const GY = 44;
  const { rows, edges } = layout(nodes);
  const baseWidth = Math.max(...rows.map((r) => r.length * W + (r.length - 1) * GX), W) + 48;
  const height = rows.length * H + (rows.length - 1) * GY + 24;
  const pos = new Map<string, { x: number; y: number; row: number }>();
  rows.forEach((r, ri) => {
    const rowW = r.length * W + (r.length - 1) * GX;
    r.forEach((id, i) => pos.set(id, { x: (baseWidth - rowW) / 2 + i * (W + GX), y: 12 + ri * (H + GY), row: ri }));
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // arrows that go back up run in their own lane to the right of the steps they pass
  const LANE = 22;
  const backs = edges.filter((e) => {
    const p = pos.get(e.from);
    const q = pos.get(e.to);
    return p && q && q.row <= p.row;
  });
  const rightOf = (r0: number, r1: number) =>
    Math.max(...[...pos.values()].filter((p) => p.row >= Math.min(r0, r1) && p.row <= Math.max(r0, r1)).map((p) => p.x + W));
  const laneX = new Map(
    backs.map((e, i) => {
      const p = pos.get(e.from)!;
      const q = pos.get(e.to)!;
      return [e, rightOf(p.row, q.row) + LANE * (i + 1)] as const;
    }),
  );
  const labelRoom = backs.some((e) => e.label) ? 60 : 12;
  const width = Math.max(baseWidth, ...[...laneX.values()].map((x) => x + labelRoom));

  return (
    <div className="flow" style={{ width, height }}>
      <svg className="flow-edges" width={width} height={height} aria-hidden="true">
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#8794a0" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const p = pos.get(e.from);
          const q = pos.get(e.to);
          if (!p || !q) return null;
          const lx = laneX.get(e);
          let d: string;
          let label: { x: number; y: number; anchor: 'middle' | 'start' };
          if (lx !== undefined) {
            // out of the right side, up the lane, back into the right side of the earlier step
            const y1 = p.y + H / 2;
            const y2 = q.y + H / 2;
            const r = Math.min(10, Math.abs(y1 - y2) / 2 || 10);
            d = `M${p.x + W} ${y1} H${lx - r} Q${lx} ${y1} ${lx} ${y1 - r} V${y2 + r} Q${lx} ${y2} ${lx - r} ${y2} H${q.x + W + 2}`;
            // the answer sits where the arrow leaves its step, so labels of different lanes never meet
            label = { x: p.x + W + 6, y: y1 - 6, anchor: 'start' };
          } else {
            const x1 = p.x + W / 2;
            const y1 = p.y + H;
            const x2 = q.x + W / 2;
            const y2 = q.y;
            d = `M${x1} ${y1} C${x1} ${y1 + GY / 1.4}, ${x2} ${y2 - GY / 1.4}, ${x2} ${y2}`;
            label = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + 4, anchor: 'middle' };
          }
          const passed = done?.has(e.from) && (done?.has(e.to) || e.to === selected);
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={passed ? '#e08e00' : '#9aa7b3'} strokeWidth={passed ? 2.5 : 1.6} markerEnd="url(#flow-arrow)" />
              {e.label && (
                <text x={label.x} y={label.y} className="flow-label" textAnchor={label.anchor}>
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {[...pos.entries()].map(([id, p]) => {
        const n = byId.get(id)!;
        const cls = `flow-node kind-${n.kind}${selected === id ? ' is-selected' : ''}${done?.has(id) ? ' is-done' : ''}`;
        const body = (
          <>
            <span className="flow-kind">{KIND[n.kind]}</span>
            <strong title={nodeTitle(n)}>{nodeTitle(n)}</strong>
          </>
        );
        return onSelect ? (
          <button key={id} className={cls} style={{ left: p.x, top: p.y, width: W, height: H }} onClick={() => onSelect(id)}>
            {body}
          </button>
        ) : (
          <div key={id} className={cls} style={{ left: p.x, top: p.y, width: W, height: H }}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
