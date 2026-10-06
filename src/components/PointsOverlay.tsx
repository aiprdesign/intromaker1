"use client";

import { useRef, useState } from "react";
import type { EditLayout, Scene } from "@/engine/types";

type Area = [number, number, number, number];
const MIN = 0.03;

/**
 * A paused slide's editable points, drawn over the preview where they sit in the frame: UI Zoom
 * Tour's highlight areas (drag a box to move it, its corner to resize it) and Detail Zoom's lens
 * stops (drag a circle). Drawn in the frame's own pixels (the SVG's view box), so they line up
 * with the picture at any preview size. Clicks off the points still reach the preview.
 */
export default function PointsOverlay({ w, h, layout, scene, onCommit }: { w: number; h: number; layout: EditLayout; scene: Scene; onCommit: (patch: Partial<Scene>) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ i: number; mode: "move" | "size"; from: [number, number]; start: number[][]; now: number[][] } | null>(null);
  const { ox, oy, sx, sy } = layout.map;
  const k = Math.min(w, h) / 720;

  // A pointer's position in frame pixels.
  const at = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const base: number[][] = layout.kind === "tour" ? layout.areas : layout.points;
  const cur = drag?.now ?? base;

  const begin = (e: React.PointerEvent, i: number, mode: "move" | "size") => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const start = base.map((a) => [...a]);
    setDrag({ i, mode, from: at(e), start, now: start });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const [x, y] = at(e);
    const dx = (x - drag.from[0]) / sx;
    const dy = (y - drag.from[1]) / sy;
    const now = drag.start.map((a) => [...a]);
    const a = drag.start[drag.i];
    if (layout.kind === "lens") now[drag.i] = [Math.min(1, Math.max(0, a[0] + dx)), Math.min(1, Math.max(0, a[1] + dy))];
    else if (drag.mode === "move") now[drag.i] = [Math.min(1 - a[2], Math.max(0, a[0] + dx)), Math.min(1 - a[3], Math.max(0, a[1] + dy)), a[2], a[3]];
    else now[drag.i] = [a[0], a[1], Math.min(1 - a[0], Math.max(MIN, a[2] + dx)), Math.min(1 - a[1], Math.max(MIN, a[3] + dy))];
    setDrag({ ...drag, now });
  };
  const end = () => {
    if (!drag) return;
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const out = drag.now.map((a) => a.map(r3));
    setDrag(null);
    if (layout.kind === "tour") onCommit({ tour: { areas: out as Area[], src: layout.key } });
    else onCommit({ zoom: { ...(scene.zoom ?? {}), points: out as [number, number][] } });
  };

  const badge = (cx: number, cy: number, n: number, on: boolean) => (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={13 * k} fill={on ? "#7c5cff" : "#6d4dff"} stroke="#fff" strokeWidth={2 * k} />
      <text x={cx} y={cy + 0.5 * k} textAnchor="middle" dominantBaseline="middle" fontSize={14 * k} fontWeight={700} fill="#fff" fontFamily="Inter, system-ui, sans-serif">
        {n}
      </text>
    </g>
  );

  return (
    <svg ref={svgRef} className="points-overlay" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" onDoubleClick={(e) => e.stopPropagation()} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {layout.kind === "tour"
        ? cur.map(([ax, ay, aw, ah], i) => {
            const x = ox + ax * sx;
            const y = oy + ay * sy;
            const bw = aw * sx;
            const bh = ah * sy;
            const on = drag?.i === i;
            return (
              <g key={i}>
                <rect x={x} y={y} width={bw} height={bh} rx={8 * k} className="pt-area" data-on={on || undefined} strokeWidth={2.5 * k} onPointerDown={(e) => begin(e, i, "move")} />
                {badge(x + 16 * k, y + 16 * k, i + 1, on)}
                <rect x={x + bw - 16 * k} y={y + bh - 16 * k} width={13 * k} height={13 * k} rx={3 * k} className="pt-handle" strokeWidth={2 * k} onPointerDown={(e) => begin(e, i, "size")} />
              </g>
            );
          })
        : cur.map(([px, py], i) => {
            const x = ox + px * sx;
            const y = oy + py * sy;
            const on = drag?.i === i;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={Math.max(14 * k, layout.r)} className="pt-area" data-on={on || undefined} strokeWidth={2.5 * k} onPointerDown={(e) => begin(e, i, "move")} />
                {badge(x, y, i + 1, on)}
              </g>
            );
          })}
    </svg>
  );
}
