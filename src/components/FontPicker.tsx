"use client";

import { FONT_FAMILY, FONT_LABELS, pairedSubFamily } from "@/engine/text";
import type { FontId } from "@/engine/types";

/** The faces offered for each kind of film (trailers get the movie-title faces first). */
export const SAAS_FONTS: FontId[] = ["inter", "manrope", "grotesk", "jost", "playfair", "serif", "mono", "cinzel"];
export const TRAILER_FONTS: FontId[] = ["cinzel", "bebas", "anton", "playfair", "jost", "grotesk", "serif"];

/**
 * Headline font picker: each choice previews itself in its own face, with the subtitle face it
 * pairs with underneath (trailers pair their title type with a contrasting family).
 */
export default function FontPicker({
  value,
  onChange,
  kind,
  current,
}: {
  value: FontId | null;
  onChange: (f: FontId | null) => void;
  kind: "saas" | "trailer";
  /** The face the film uses now (the style's own when no choice is made). */
  current: FontId;
}) {
  const fonts = kind === "trailer" ? TRAILER_FONTS : SAAS_FONTS;
  const sample = kind === "trailer" ? "LEGACY" : "Ship it together";
  return (
    <div className="font-picker" role="radiogroup" aria-label="Heading font">
      <button type="button" role="radio" aria-checked={value === null} className={`font-opt${value === null ? " active" : ""}`} onClick={() => onChange(null)}>
        <span className="font-sample" style={{ fontFamily: `"${FONT_FAMILY[current].display}"`, fontWeight: FONT_FAMILY[current].weight }}>
          {sample}
        </span>
        <span className="font-name">Style default</span>
        <span className="font-note">{FONT_LABELS[current].name}</span>
      </button>
      {fonts.map((f) => {
        const fam = FONT_FAMILY[f];
        const sub = pairedSubFamily(f, kind);
        return (
          <button key={f} type="button" role="radio" aria-checked={value === f} className={`font-opt${value === f ? " active" : ""}`} onClick={() => onChange(f)} title={FONT_LABELS[f].note}>
            <span className="font-sample" style={{ fontFamily: `"${fam.display}"`, fontWeight: fam.weight, letterSpacing: `${fam.tracking}em` }}>
              {sample}
            </span>
            <span className="font-sub" style={{ fontFamily: `"${sub}"` }}>
              with {sub}
            </span>
            <span className="font-name">{FONT_LABELS[f].name}</span>
            <span className="font-note">{FONT_LABELS[f].note}</span>
          </button>
        );
      })}
    </div>
  );
}
