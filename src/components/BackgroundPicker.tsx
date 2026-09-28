"use client";

import type { PaletteId, Scene, VideoPlan } from "@/engine/types";
import LoopCanvas from "./LoopCanvas";

export type BgChoice = "template" | "none" | NonNullable<NonNullable<VideoPlan["look"]>["shader"]>;

export const BG_OPTIONS: { id: BgChoice; name: string }[] = [
  { id: "template", name: "Template default" },
  { id: "mesh", name: "Mesh gradient" },
  { id: "grain", name: "Grainy gradient" },
  { id: "warp", name: "Silk flow" },
  { id: "smoke", name: "Smoke ring" },
  { id: "neuro", name: "Neural glow" },
  { id: "rays", name: "Light rays" },
  { id: "none", name: "Clean (no gradient)" },
];

/** Apply a background choice on top of whatever look the template set. */
export function applyBackground(plan: VideoPlan, bg: BgChoice): VideoPlan {
  if (bg === "template" || plan.style !== "saas") return plan;
  const look = plan.look ?? { grid: true, beams: 1, aurora: 1 };
  if (bg === "none") return { ...plan, look: { ...look, shader: undefined, backdrop: look.backdrop === "blobs" ? "grid" : look.backdrop } };
  return { ...plan, look: { ...look, shader: bg, shaderStrength: Math.max(look.shaderStrength ?? 0.9, 0.8) } };
}

const SAMPLE: Scene = { skill: "blur-reveal", text: " ", duration: 8, transition: "cut" };

/** Live previews of the GPU gradient backgrounds in the current palette. */
export default function BackgroundPicker({
  value,
  onChange,
  palette,
  look,
}: {
  value: BgChoice;
  onChange: (b: BgChoice) => void;
  palette: PaletteId;
  look?: VideoPlan["look"];
}) {
  return (
    <div className="bg-grid">
      {BG_OPTIONS.map((o, i) => {
        const base = look ?? { grid: false, beams: 0, aurora: 1 };
        const preview =
          o.id === "template"
            ? base
            : o.id === "none"
              ? { ...base, shader: undefined, backdrop: base.backdrop === "blobs" ? ("grid" as const) : base.backdrop }
              : { ...base, shader: o.id, shaderStrength: 1 };
        return (
          <button key={o.id} className={`bg-card ${value === o.id ? "active" : ""}`} onClick={() => onChange(o.id)} title={o.name}>
            <LoopCanvas scene={SAMPLE} plan={{ palette, font: "inter", seed: 40 + i, style: "saas", look: preview }} long={220} fps={12} />
            <span className="bg-name">{o.name}</span>
          </button>
        );
      })}
    </div>
  );
}
