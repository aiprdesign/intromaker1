"use client";

import { PALETTES } from "@/engine/palettes";
import { PALETTE_IDS, type Brand, type Palette, type PaletteId } from "@/engine/types";

export type ColourChoice = "template" | "brand" | PaletteId;

/** Colour bar in 60 / 30 / 10 proportions: dominant background, supporting colour, accent. */
function Stripes({ bg, a, b }: { bg: string; a: string; b: string; c?: string }) {
  return (
    <span className="pal-stripes">
      <span style={{ background: bg, flex: 6 }} />
      <span style={{ background: b, flex: 3 }} />
      <span style={{ background: a, flex: 1 }} />
    </span>
  );
}

/**
 * Colour picker for the film: the template's own palette, the website's brand colours, or any
 * named palette (dark and light). Each option previews background + accent colours.
 */
export default function PaletteChooser({
  value,
  onChange,
  templatePalette,
  templateName,
  brandColors,
}: {
  value: ColourChoice;
  onChange: (c: ColourChoice) => void;
  templatePalette: PaletteId;
  templateName?: string;
  brandColors?: Brand["colors"];
}) {
  const tp = PALETTES[templatePalette];
  const card = (id: ColourChoice, name: string, p: Pick<Palette, "bg0" | "primary" | "secondary" | "accent">, hint?: string) => (
    <button key={id} className={`pal-card ${value === id ? "active" : ""}`} onClick={() => onChange(id)} title={hint ?? name}>
      <Stripes bg={p.bg0} a={p.primary} b={p.secondary} c={p.accent} />
      <span className="pal-name">{name}</span>
    </button>
  );
  const dark = PALETTE_IDS.filter((id) => !PALETTES[id].light);
  const light = PALETTE_IDS.filter((id) => PALETTES[id].light);
  return (
    <div className="pal-chooser">
      <div className="pal-grid top">
        {card("template", templateName ? `Template (${templateName})` : "Template colours", tp, "Use the style template's own colours")}
        {brandColors &&
          card(
            "brand",
            "Brand colours",
            { bg0: tp.bg0, primary: brandColors.primary, secondary: brandColors.secondary, accent: brandColors.primary },
            "Colours detected from the website's logo and images",
          )}
      </div>
      <div className="pal-group">Dark</div>
      <div className="pal-grid">{dark.map((id) => card(id, PALETTES[id].name, PALETTES[id]))}</div>
      <div className="pal-group">Light</div>
      <div className="pal-grid">{light.map((id) => card(id, PALETTES[id].name.replace(/ \(light\)$/, ""), PALETTES[id]))}</div>
    </div>
  );
}
