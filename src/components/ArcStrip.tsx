"use client";

import { ROLE_ICONS, type ConceptRole } from "@/engine/concepts";
import { SKILL_MAP } from "@/engine/skills";
import type { VideoPlan } from "@/engine/types";

export const ROLE_NAMES: Partial<Record<string, string>> = {
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
  solve: "Problem → solution",
  support: "Support",
  cta: "Call to action",
};

/** Interaction moments are named after what the viewer sees. */
export const DEMO_ICONS: Record<string, string> = {
  "command-k": "Command",
  "ai-prompt": "Sparkles",
  "click-flow": "MousePointerClick",
  "notify-stack": "BellRing",
  "code-deploy": "SquareTerminal",
  kanban: "SquareKanban",
  "live-cursors": "Users",
  "chat-thread": "MessagesSquare",
};

/** A slide's name and icon on the timeline: its story beat, or the moment it shows. */
export function beatOf(s: VideoPlan["scenes"][number]) {
  const role = s.role ?? "";
  const name = (role === "demo" ? SKILL_MAP[s.skill]?.name : ROLE_NAMES[role]) ?? SKILL_MAP[s.skill]?.name ?? s.skill;
  const icon = (role === "demo" ? DEMO_ICONS[s.skill] : undefined) ?? ROLE_ICONS[role as ConceptRole] ?? (role === "reveal" ? "Sparkles" : role === "cta" ? "MousePointerClick" : "Clapperboard");
  return { name, icon };
}
