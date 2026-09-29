"use client";

import type { Scene, TextFx, VideoPlan } from "@/engine/types";
import LoopCanvas from "./LoopCanvas";

/** Headline text effects offered in the studio, with a one-line description each. */
export const TEXT_FX_OPTIONS: { id: TextFx; name: string; note: string }[] = [
  { id: "blur", name: "Blur rise", note: "Words rise out of a soft blur" },
  { id: "mask", name: "Mask slide", note: "Words slide up out of a crisp mask" },
  { id: "decode", name: "Decode", note: "Characters scramble, then lock in" },
  { id: "roll", name: "Odometer", note: "Letters roll up like a slot machine" },
  { id: "letters", name: "Letter wave", note: "Letters spring up one by one" },
  { id: "streak", name: "Streak", note: "Words fly in on motion trails" },
  { id: "chroma", name: "Chromatic", note: "RGB ghosts converge into crisp type" },
  { id: "flip", name: "Flip", note: "Words flip up like a split-flap board" },
  { id: "focus", name: "Focus", note: "The line lights up word by word" },
  { id: "highlight", name: "Highlight", note: "A marker wipes behind the key word" },
  { id: "shine", name: "Shine", note: "A light sweep crosses the headline" },
  { id: "pop", name: "Pop", note: "Words spring up from small" },
  { id: "type", name: "Typewriter", note: "Typed out behind a block cursor" },
  { id: "glow", name: "Glow", note: "Slow glowing fade-in" },
];

const SAMPLE: Scene = { skill: "blur-reveal", text: "Meet your new *workspace*", duration: 3.2, transition: "cut" };

/**
 * Pick the headline text effect: "Template default" keeps each style's own; any other choice
 * applies to every headline in the film. Each tile plays the effect live in the current look.
 */
export default function TextFxPicker({
  value,
  onChange,
  plan,
}: {
  value: TextFx | null;
  onChange: (fx: TextFx | null) => void;
  plan: Pick<VideoPlan, "palette" | "font" | "seed" | "look" | "bpm">;
}) {
  return (
    <div className="fx-grid" role="listbox" aria-label="Text effect">
      <button role="option" aria-selected={value === null} className={`fx-card default ${value === null ? "active" : ""}`} onClick={() => onChange(null)}>
        <span className="fx-name">Template default</span>
        <span className="fx-note">Each style&apos;s own effect</span>
      </button>
      {TEXT_FX_OPTIONS.map((o) => (
        <button key={o.id} role="option" aria-selected={value === o.id} className={`fx-card ${value === o.id ? "active" : ""}`} onClick={() => onChange(o.id)} title={o.note}>
          <LoopCanvas
            scene={SAMPLE}
            plan={{ palette: plan.palette, font: plan.font, seed: plan.seed, style: "saas", bpm: plan.bpm, look: { ...(plan.look ?? { grid: false, beams: 0, aurora: 0.6 }), text: o.id } }}
            long={240}
            fps={20}
          />
          <span className="fx-name">{o.name}</span>
        </button>
      ))}
    </div>
  );
}
