"use client";

import Link from "next/link";
import { useState } from "react";
import { PALETTES } from "@/engine/palettes";
import { SKILLS } from "@/engine/skills";
import { PALETTE_IDS, type PaletteId } from "@/engine/types";
import LoopCanvas from "./LoopCanvas";

const DEFAULT_PALETTES: PaletteId[] = [
  "cosmos", "cyber", "aurora", "ice", "cosmos", "synthwave", "cyber", "gold", "cosmos", "aurora",
  "gold", "ice", "cosmos", "cyber", "inferno", "toxic", "inferno", "aurora", "synthwave", "synthwave",
  "cosmos", "ice", "gold", "mono", "cyber", "synthwave", "cyber", "cyber", "inferno",
  "cosmos", "aurora", "ice", "synthwave",
];

export default function SkillGrid({ limit, pickers = false }: { limit?: number; pickers?: boolean }) {
  const [palette, setPalette] = useState<PaletteId | "mix">("mix");
  const skills = limit ? SKILLS.slice(0, limit) : SKILLS;
  return (
    <>
      {pickers && (
        <div className="palette-row">
          <button className={`chip ${palette === "mix" ? "active" : ""}`} onClick={() => setPalette("mix")}>
            Curated
          </button>
          {PALETTE_IDS.map((id) => (
            <button key={id} className={`chip ${palette === id ? "active" : ""}`} onClick={() => setPalette(id)}>
              <span className="swatch" style={{ background: `linear-gradient(135deg, ${PALETTES[id].primary}, ${PALETTES[id].secondary})` }} />
              {PALETTES[id].name}
            </button>
          ))}
        </div>
      )}
      <div className="skill-grid">
        {skills.map((s, i) => {
          const pal = palette === "mix" ? DEFAULT_PALETTES[i % DEFAULT_PALETTES.length] : palette;
          const scene = { skill: s.id, text: s.sample.text, subtext: s.sample.subtext, items: s.sample.items, duration: 4.6, transition: "cut" as const };
          return (
            <article className="skill-card" key={s.id}>
              <div className="skill-canvas">
                <LoopCanvas scene={scene} plan={{ style: i < 10 ? "saas" : "trailer", palette: pal, font: i < 10 ? "inter" : i % 3 === 1 ? "grotesk" : "anton", seed: 77 + i }} long={640} />
              </div>
              <div className="skill-meta">
                <div className="skill-head">
                  <h3>{s.name}</h3>
                  <span className="skill-num">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <p>{s.tagline}</p>
                <Link className="skill-use" href={`/studio?skill=${s.id}&palette=${pal}`}>
                  Use this skill →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
