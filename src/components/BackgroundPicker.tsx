"use client";

import type { PaletteId, Scene, VideoPlan } from "@/engine/types";
import LoopCanvas from "./LoopCanvas";

type Stage = "eclipse" | "studio" | "ribbon" | "beam" | "bloom";
export type BgChoice = "template" | "none" | NonNullable<NonNullable<VideoPlan["look"]>["shader"]> | `stage-${Stage}`;

export const BG_OPTIONS: { id: BgChoice; name: string }[] = [
  { id: "template", name: "Template default" },
  { id: "stage-eclipse", name: "Eclipse rim" },
  { id: "stage-studio", name: "Studio light" },
  { id: "stage-ribbon", name: "Silk ribbons" },
  { id: "stage-beam", name: "Light beam" },
  { id: "stage-bloom", name: "Colour bloom" },
  { id: "mesh", name: "Mesh gradient" },
  { id: "grain", name: "Grainy gradient" },
  { id: "warp", name: "Silk flow" },
  { id: "smoke", name: "Smoke ring" },
  { id: "neuro", name: "Neural glow" },
  { id: "rays", name: "Light rays" },
  { id: "panels", name: "3D light panels" },
  { id: "metaballs", name: "3D metaballs" },
  { id: "swirl", name: "Chrome swirl" },
  { id: "voronoi", name: "Sci-fi cells" },
  { id: "waves", name: "Line waves" },
  { id: "dither", name: "Retro dither" },
  { id: "none", name: "Clean (no gradient)" },
];

type Look = NonNullable<VideoPlan["look"]>;

/** The look with this background: a GPU gradient, one of the drawn stages, or neither. */
function withBackground(look: Look, bg: Exclude<BgChoice, "template">, strength: number): Look {
  if (bg === "none") return { ...look, shader: undefined, backdrop: look.backdrop === "blobs" ? "grid" : look.backdrop };
  if (bg.startsWith("stage-")) return { ...look, shader: undefined, grid: false, beams: 0, backdrop: bg.slice(6) as Stage };
  return { ...look, shader: bg as Look["shader"], shaderStrength: strength };
}

/** Apply a background choice on top of whatever look the template set. */
export function applyBackground(plan: VideoPlan, bg: BgChoice): VideoPlan {
  if (bg === "template" || plan.style !== "saas") return plan;
  const look = plan.look ?? { grid: true, beams: 1, aurora: 1 };
  return { ...plan, look: withBackground(look, bg, Math.max(look.shaderStrength ?? 0.9, 0.8)) };
}

const SAMPLE: Scene = { skill: "blur-reveal", text: " ", duration: 8, transition: "cut" };

/** Live previews of the backgrounds (drawn stages and GPU gradients) in the current palette. */
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
        const preview = o.id === "template" ? base : withBackground(base, o.id, 1);
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
