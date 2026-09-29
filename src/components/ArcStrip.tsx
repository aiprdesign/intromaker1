"use client";

import { ROLE_ICONS, type ConceptRole } from "@/engine/concepts";
import { SKILL_MAP } from "@/engine/skills";
import type { VideoPlan } from "@/engine/types";
import Icon from "./Icon";

const ROLE_NAMES: Partial<Record<string, string>> = {
  pain: "Problem",
  hook: "Hook",
  reveal: "Reveal",
  meet: "Meet",
  how: "How it works",
  tour: "Product tour",
  features: "Features",
  bento: "Features",
  cards: "Results",
  stat: "Numbers",
  quote: "Testimonial",
  logos: "Customers",
  integrations: "Integrations",
  promise: "Promise",
  metric: "Numbers",
  gallery: "Gallery",
  reach: "Global",
  compare: "Before & after",
  cta: "Call to action",
};

/** Interaction moments are named after what the viewer sees. */
const DEMO_ICONS: Record<string, string> = {
  "command-k": "Command",
  "ai-prompt": "Sparkles",
  "click-flow": "MousePointerClick",
  "notify-stack": "BellRing",
  "code-deploy": "SquareTerminal",
  kanban: "SquareKanban",
  "live-cursors": "Users",
  "chat-thread": "MessagesSquare",
};

/** The film's story arc at a glance: one chip per beat; click to jump to its editor. */
export default function ArcStrip({ plan, onPick }: { plan: VideoPlan; onPick: (i: number) => void }) {
  const total = plan.scenes.reduce((a, s) => a + s.duration, 0);
  return (
    <div className="arc-strip" aria-label="Story arc">
      {plan.scenes.map((s, i) => {
        const role = s.role ?? "";
        const name = (role === "demo" ? SKILL_MAP[s.skill]?.name : ROLE_NAMES[role]) ?? SKILL_MAP[s.skill]?.name ?? s.skill;
        const icon = (role === "demo" ? DEMO_ICONS[s.skill] : undefined) ?? ROLE_ICONS[role as ConceptRole] ?? (role === "reveal" ? "Sparkles" : role === "cta" ? "MousePointerClick" : "Clapperboard");
        return (
          <button key={i} className="arc-chip" onClick={() => onPick(i)} title={`${name}: ${s.text.replace(/\*/g, "")}${s.why ? `\n${s.why}` : ""}`} style={{ flexGrow: s.duration / total }}>
            <Icon name={icon} size={13} />
            <span>{name}</span>
            <small>{s.duration.toFixed(1)}s</small>
          </button>
        );
      })}
    </div>
  );
}
