"use client";

import { useEffect, useState } from "react";
import { TEMPLATE_CATEGORIES, TEMPLATE_MAP, TEMPLATES, type TemplateCategory } from "@/engine/templates";
import LoopCanvas from "./LoopCanvas";

/**
 * Gallery of SaaS style templates, one category at a time (chips on top) so it stays compact;
 * each template previews live in its own look.
 */
export default function TemplatePicker({
  value,
  onChange,
  categories = TEMPLATE_CATEGORIES,
}: {
  value: string;
  onChange: (id: string) => void;
  /** The groups to offer (e.g. only the trailer styles for a product trailer). */
  categories?: TemplateCategory[];
}) {
  const [picked, setCat] = useState<TemplateCategory>((TEMPLATE_MAP[value]?.category as TemplateCategory) ?? "Modern");
  // Opens on the chosen style's group, and follows it when the style changes elsewhere (Auto, a new film).
  useEffect(() => {
    const c = TEMPLATE_MAP[value]?.category as TemplateCategory | undefined;
    if (c) setCat(c);
  }, [value]);
  const cat = categories.includes(picked) ? picked : categories[0];
  const items = TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => (t.category ?? "Modern") === cat);
  return (
    <div className="template-groups">
      {categories.length > 1 && (
      <div className="template-cats" role="tablist" aria-label="Template category">
        {categories.map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} className={`chip ${c === cat ? "on" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      )}
      <div className="template-grid">
        {items.map(({ t, i }) => (
          <button key={t.id} className={`template-card ${value === t.id ? "active" : ""}`} onClick={() => onChange(t.id)} title={t.description}>
            <LoopCanvas scene={t.sample} plan={{ palette: t.palette, font: t.font, seed: 300 + i, style: "saas", look: t.look, bpm: t.bpm }} long={320} fps={15} />
            <span className="template-name">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
