"use client";

import { useEffect, useRef } from "react";
import { brandPalette } from "@/engine/renderer";
import { drawCursor } from "@/engine/saasfx";
import { POINTER_STYLES, type PointerStyle, type SkillContext, type VideoPlan } from "@/engine/types";

export const POINTER_NAMES: Record<PointerStyle, string> = {
  auto: "Auto",
  white: "White",
  graphite: "Graphite",
  brand: "Brand",
  glass: "Glass",
  clay: "Clay",
  classic: "Classic",
};

/** One pointer, drawn in the video's own colours on its own background. */
function PointerSwatch({ plan, style }: { plan: VideoPlan; style: PointerStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const palette = brandPalette(plan.palette, plan.brand, plan.scheme);
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, palette.bg1);
    g.addColorStop(1, palette.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    drawCursor({ ctx, u: c.height / 1080, palette, pointer: style } as SkillContext, c.width * 0.36, c.height * 0.16, 0, 12.5);
  }, [plan.palette, plan.brand, plan.scheme, style]);
  return <canvas ref={ref} width={112} height={84} aria-hidden="true" />;
}

/** The mouse pointer's look in product moments, tours and buttons. */
export default function PointerPicker({ plan, value, onChange }: { plan: VideoPlan; value: PointerStyle; onChange: (v: PointerStyle) => void }) {
  return (
    <div className="pointer-picker" role="radiogroup" aria-label="Mouse pointer">
      {POINTER_STYLES.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} className={`pointer-tile${value === s ? " active" : ""}`} onClick={() => onChange(s)}>
          <PointerSwatch plan={plan} style={s} />
          <span>{POINTER_NAMES[s]}</span>
        </button>
      ))}
    </div>
  );
}
