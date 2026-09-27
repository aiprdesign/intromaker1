"use client";

import { TEMPLATES } from "@/engine/templates";
import LoopCanvas from "./LoopCanvas";

/** Gallery of SaaS style templates, each previewed live in its own look. */
export default function TemplatePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="template-grid">
      {TEMPLATES.map((t, i) => (
        <button key={t.id} className={`template-card ${value === t.id ? "active" : ""}`} onClick={() => onChange(t.id)} title={t.description}>
          <LoopCanvas
            scene={t.sample}
            plan={{ palette: t.palette, font: t.font, seed: 300 + i, style: "saas", look: t.look, bpm: t.bpm }}
            long={320}
            fps={24}
          />
          <span className="template-name">{t.name}</span>
        </button>
      ))}
    </div>
  );
}
