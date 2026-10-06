"use client";

import Link from "next/link";
import { useState } from "react";
import { PALETTES } from "@/engine/palettes";
import { SKILL_GROUPS, SKILLS } from "@/engine/skills";
import { PALETTE_IDS, type PaletteId } from "@/engine/types";
import LoopCanvas from "./LoopCanvas";

const DEFAULT_PALETTES: PaletteId[] = [
  "cosmos", "cyber", "aurora", "ice", "cosmos", "synthwave", "cyber", "gold", "cosmos", "aurora",
  "gold", "ice", "cosmos", "cyber", "inferno", "toxic", "inferno", "aurora", "synthwave", "synthwave",
  "cosmos", "ice", "gold", "mono", "cyber", "synthwave", "cyber", "cyber", "inferno",
  "cosmos", "aurora", "ice", "synthwave",
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** The first skill of each picker group carries the group's anchor (/skills#fast-type). */
const ANCHORS = new Map(SKILL_GROUPS.map((g) => [g.skills[0]?.id, slug(g.name)]));

export default function SkillGrid({ limit, pickers = false, group, ids, swipe = false }: { limit?: number; pickers?: boolean; group?: string; ids?: string[]; /** Phones: a sideways-swiping row instead of a grid. */ swipe?: boolean }) {
  const [palette, setPalette] = useState<PaletteId | "mix">("mix");
  const inGroup = group ? (SKILL_GROUPS.find((g) => g.name === group)?.skills ?? []) : SKILLS;
  // An explicit pick (in its own order) narrows the group.
  const pool = ids ? ids.map((id) => inGroup.find((s) => s.id === id)).filter((s) => !!s) : inGroup;
  const skills = limit ? pool.slice(0, limit) : pool;
  // A group's own grid (the homepage's fast type row) plays in the SaaS look throughout.
  const saasAll = !!group;
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
      <div className={`skill-grid${swipe ? " swipe" : ""}`}>
        {skills.map((s, i) => {
          const pal = palette === "mix" ? DEFAULT_PALETTES[i % DEFAULT_PALETTES.length] : palette;
          const scene = { skill: s.id, text: s.sample.text, subtext: s.sample.subtext, items: s.sample.items, duration: 4.6, transition: "cut" as const };
          return (
            <article className="skill-card" key={s.id} id={!group && pickers ? ANCHORS.get(s.id) : undefined}>
              <div className="skill-canvas">
                <LoopCanvas scene={scene} plan={{ style: saasAll || i < 10 ? "saas" : "trailer", palette: pal, font: saasAll || i < 10 ? "inter" : i % 3 === 1 ? "grotesk" : "anton", seed: 77 + i }} long={640} />
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
