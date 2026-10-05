"use client";

import { SHAPE_SET_INFO } from "@/engine/shapes";
import { SHAPE_SETS, type Scene, type ShapeSet, type VideoPlan } from "@/engine/types";
import LoopCanvas from "./LoopCanvas";

const SAMPLE: Scene = { skill: "blur-reveal", text: "Your *story*", duration: 3.2, transition: "cut" };

/**
 * Pick what floats behind SaaS slides: a set of animated shapes, watermark text, or nothing. Each
 * tile plays the set live in the video's own look.
 */
export default function ShapesPicker({
  value,
  onChange,
  watermark,
  onWatermark,
  plan,
}: {
  value: ShapeSet | "off";
  onChange: (v: ShapeSet | "off") => void;
  watermark: string;
  onWatermark: (text: string) => void;
  plan: Pick<VideoPlan, "palette" | "font" | "seed" | "look" | "bpm" | "brand">;
}) {
  return (
    <>
      <div className="fx-grid" role="listbox" aria-label="Background shapes">
        <button role="option" aria-selected={value === "off"} className={`fx-card default ${value === "off" ? "active" : ""}`} onClick={() => onChange("off")}>
          <span className="fx-name">Off</span>
          <span className="fx-note">A clean stage</span>
        </button>
        {SHAPE_SETS.map((id) => (
          <button key={id} role="option" aria-selected={value === id} className={`fx-card ${value === id ? "active" : ""}`} onClick={() => onChange(id)} title={SHAPE_SET_INFO[id].note}>
            <LoopCanvas
              scene={SAMPLE}
              plan={{ palette: plan.palette, font: plan.font, seed: plan.seed, style: "saas", bpm: plan.bpm, look: plan.look, brand: plan.brand, shapeSet: id, watermark: watermark || undefined }}
              long={240}
              fps={20}
            />
            <span className="fx-name">{SHAPE_SET_INFO[id].name}</span>
          </button>
        ))}
      </div>
      {value === "text" && (
        <label className="watermark-field">
          <span className="field-label">Watermark text</span>
          <input className="input sm" value={watermark} maxLength={40} placeholder={plan.brand?.name || "Your brand"} onChange={(e) => onWatermark(e.target.value)} aria-label="Watermark text" />
        </label>
      )}
    </>
  );
}
