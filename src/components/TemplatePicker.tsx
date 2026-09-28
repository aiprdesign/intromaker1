"use client";

import { TEMPLATE_CATEGORIES, TEMPLATES } from "@/engine/templates";
import LoopCanvas from "./LoopCanvas";

/** Gallery of SaaS style templates, grouped by category, each previewed live in its own look. */
export default function TemplatePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="template-groups">
      {TEMPLATE_CATEGORIES.map((cat) => {
        const items = TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => (t.category ?? "Modern") === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="template-group">{cat}</div>
            <div className="template-grid">
              {items.map(({ t, i }) => (
                <button key={t.id} className={`template-card ${value === t.id ? "active" : ""}`} onClick={() => onChange(t.id)} title={t.description}>
                  <LoopCanvas
                    scene={t.sample}
                    plan={{ palette: t.palette, font: t.font, seed: 300 + i, style: "saas", look: t.look, bpm: t.bpm }}
                    long={320}
                    fps={15}
                  />
                  <span className="template-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
