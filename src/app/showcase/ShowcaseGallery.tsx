"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import LoopCanvas from "@/components/LoopCanvas";
import { encodePlan } from "@/engine/planner";
import { totalDuration } from "@/engine/renderer";
import { GROUP_ICONS, SHOWCASE_GROUPS, showcaseIntros, type ShowcaseGroup, type ShowcaseIntro } from "@/engine/showcase";
import { TEMPLATE_MAP } from "@/engine/templates";

const secs = (plan: ShowcaseIntro["plan"]) => `${Math.round(totalDuration(plan))}s`;

/**
 * The showcase gallery: one intro per random-intro topic, playing live while on screen. A card
 * opens larger on click, and links into the studio (the intro itself, to edit, or its brief).
 */
export default function ShowcaseGallery() {
  // (Made in the browser: the plans are built by the engine, and the canvases play there.)
  const [items, setItems] = useState<ShowcaseIntro[] | null>(null);
  const [group, setGroup] = useState<ShowcaseGroup | "Any">("Any");
  const [open, setOpen] = useState<ShowcaseIntro | null>(null);
  useEffect(() => setItems(showcaseIntros()), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = (items ?? []).filter((x) => group === "Any" || x.group === group);
  const count = (g: ShowcaseGroup | "Any") => (items ?? []).filter((x) => g === "Any" || x.group === g).length;
  return (
    <>
      <div className="show-tabs" role="tablist" aria-label="Sort the showcase by business">
        {(["Any", ...SHOWCASE_GROUPS] as const).map((g) => (
          <button key={g} role="tab" aria-selected={group === g} className={`show-tab ${group === g ? "active" : ""}`} onClick={() => setGroup(g)}>
            <Icon name={g === "Any" ? "LayoutGrid" : GROUP_ICONS[g]} size={18} />
            <span>{g === "Any" ? "All businesses" : g}</span>
            {items && <em>{count(g)}</em>}
          </button>
        ))}
      </div>
      <div className="skill-grid show-grid">
        {!items &&
          Array.from({ length: 6 }, (_, i) => (
            <article className="skill-card show-card show-skeleton" key={i} aria-hidden>
              <div className="skill-canvas" />
              <div className="skill-meta" />
            </article>
          ))}
        {shown.map((x) => (
          <article className="skill-card show-card" key={x.kind}>
            <button className="skill-canvas show-play" onClick={() => setOpen(x)} aria-label={`Watch the ${x.name} intro larger`}>
              <LoopCanvas plan={x.plan} long={640} live3d />
            </button>
            <div className="skill-meta">
              <div className="skill-head">
                <h3>{x.name}</h3>
                <span className="skill-num">{secs(x.plan)}</span>
              </div>
              <div className="show-tags">
                <span className="show-kind">
                  <Icon name={x.icon} size={13} />
                  {x.kind}
                </span>
                {x.plan.template && TEMPLATE_MAP[x.plan.template] && <span>{TEMPLATE_MAP[x.plan.template].name}</span>}
              </div>
              <p className="show-tagline">“{x.tagline}”</p>
              <details className="show-brief">
                <summary>The brief</summary>
                <pre>{x.prompt}</pre>
              </details>
              <div className="show-links">
                <Link className="skill-use" href={`/studio#plan=${encodePlan(x.plan)}`}>
                  Edit this intro →
                </Link>
                <Link className="skill-use" href={`/studio?prompt=${encodeURIComponent(x.prompt)}`}>
                  Remake from the brief
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="show-modal" role="dialog" aria-modal="true" aria-label={`${open.name} intro`} onClick={() => setOpen(null)}>
          <div className="show-modal-box" onClick={(e) => e.stopPropagation()}>
            <LoopCanvas plan={open.plan} long={1280} className="show-modal-canvas" live3d />
            <div className="show-modal-bar">
              <div>
                <strong>{open.name}</strong> <span className="show-muted">· {open.kind}</span>
              </div>
              <div className="show-links">
                <Link className="btn btn-primary" href={`/studio#plan=${encodePlan(open.plan)}`}>
                  Edit this intro
                </Link>
                <button className="btn btn-ghost" onClick={() => setOpen(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
