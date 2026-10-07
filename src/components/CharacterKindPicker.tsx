"use client";

import { useEffect, useRef } from "react";
import { KINDS } from "@/engine/cast";
import { drawAbstract, makeCharacter } from "@/engine/skills/abstract";
import { castLook, drawCharacter } from "@/engine/skills/characters";
import { drawPro, proLook } from "@/engine/skills/charpro";
import type { ArtStyle, CharacterKind, Look, Palette } from "@/engine/types";

export type CharacterChoice = CharacterKind | "own";

export const CHARACTER_NAMES: Record<CharacterChoice, string> = {
  own: "Style's own",
  abstract: "Abstract",
  memphis: "Memphis",
  blob: "Blob",
  stick: "Stick figure",
  classic: "Classic",
};

const TOON_ART: Record<NonNullable<Look["toon"]>, ArtStyle> = { flat: "flat", comic: "outline", soft: "soft", doodle: "line" };

/** One option, drawn small in the video's colours and the style's drawing look. */
function Swatch({ choice, palette, look, own }: { choice: CharacterChoice; palette: Palette; look?: Look; own: "char" | "pro" | "abs" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = 64;
    const H = 72;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, palette.bg1);
    g.addColorStop(1, palette.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (choice === "own" && own === "char") drawCharacter(ctx, W / 2, H * 0.94, H * 0.8, castLook(palette, 0), { armL: 0.25, armR: 0.25, mouth: "smile" });
    else if (choice === "own" && own === "pro") drawPro(ctx, W / 2, H * 0.95, H * 0.86, proLook(palette, 0), { facing: 0, armL: [-0.1, -0.08], armR: [0.1, 0.08], smile: 0.6 });
    else {
      const kind = choice === "own" ? (look?.people ?? "abstract") : choice;
      const art = look?.art ?? TOON_ART[look?.toon ?? "flat"];
      const c = makeCharacter(7, palette, kind);
      drawAbstract(ctx, W / 2, H * 0.93, H * (kind === "blob" ? 0.9 : 0.8), art === "flat" ? c : { ...c, art }, { armL: 0.3, armR: 0.3, mouth: "smile" });
    }
  }, [choice, palette, look, own]);
  return <canvas ref={ref} style={{ width: 64, height: 72 }} aria-hidden="true" />;
}

/**
 * The characters a Cartoon style tells the story with: its own, or one of the generated kinds,
 * drawn in the style's look and the video's colours.
 */
export default function CharacterKindPicker({ value, auto, onChange, onAuto, palette, look, own }: { value: CharacterChoice; auto: boolean; onChange: (v: CharacterChoice) => void; onAuto: () => void; palette: Palette; look?: Look; own: "char" | "pro" | "abs" }) {
  const choices: CharacterChoice[] = ["own", ...KINDS.filter((k) => !(own === "abs" && k === (look?.people ?? "abstract")))];
  return (
    <div className="kind-picker">
      <button type="button" className={`chip auto-style${auto ? " active" : ""}`} aria-pressed={auto} onClick={onAuto}>
        ✦ Auto: best fit for your intro
      </button>
      <div className="cd-tiles" role="radiogroup" aria-label="Characters">
        {choices.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={c === value} className={`cd-tile${c === value ? " active" : ""}`} onClick={() => onChange(c)} title={CHARACTER_NAMES[c]}>
            <Swatch choice={c} palette={palette} look={look} own={own} />
            <span>{CHARACTER_NAMES[c]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
