import type { SiteData } from "@/engine/types";

/**
 * Storyboard QA for AI drafts: a deterministic checklist (story arc, copy length, pacing,
 * no invented quotes/logos/numbers) used to decide whether the AI should revise its draft,
 * to brief that revision, and to repair whatever still slips through.
 */

export interface DraftScene {
  skill: string;
  text: string;
  items?: string[];
  eyebrow?: string;
  subtext?: string;
  duration: number;
  media?: number;
}

export interface Draft {
  style: "saas" | "trailer";
  scenes: DraftScene[];
}

export interface LintContext {
  site: SiteData | null;
  targetSeconds: number;
}

const HOOKS = new Set(["blur-reveal", "pain-strike", "word-swap", "cinematic-title", "type-cascade"]);
const NEEDS_ITEMS: Record<string, number> = { "ui-tour": 2, bento: 3, "pain-strike": 2, steps: 2, "word-swap": 2, "command-k": 3, "click-flow": 3, "notify-stack": 3, "ai-prompt": 1 };
const DEMO_SKILLS = new Set(["command-k", "ai-prompt", "click-flow", "notify-stack"]);

const words = (s: string) => s.replace(/\*/g, "").split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Every number a site actually states, normalised ("12,000+" → "12000"). */
function siteNumbers(site: SiteData) {
  const all = [
    site.tagline,
    site.description,
    ...site.headlines,
    ...site.stats,
    ...site.features,
    ...site.steps,
    ...site.testimonials.map((q) => q.quote),
  ].join(" ");
  return new Set((all.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]/g, "")));
}

export function lintStoryboard(draft: Draft, ctx: LintContext): string[] {
  const issues: string[] = [];
  const { scenes } = draft;
  if (!scenes.length) return ["The storyboard has no scenes."];
  const saas = draft.style === "saas";
  const total = scenes.reduce((a, s) => a + s.duration, 0);
  if (Math.abs(total - ctx.targetSeconds) > ctx.targetSeconds * 0.3) {
    issues.push(`Total length is ${total.toFixed(1)}s; aim for about ${ctx.targetSeconds}s (add or cut beats, don't just stretch durations).`);
  }
  if (saas) {
    if (!HOOKS.has(scenes[0].skill)) issues.push(`Open with a hook (blur-reveal with the promise, or pain-strike with real pains), not ${scenes[0].skill}.`);
    if (scenes[scenes.length - 1].skill !== "cta") issues.push("End on a cta scene whose subtext is the button label.");
    if (scenes.filter((s) => DEMO_SKILLS.has(s.skill)).length > 1) issues.push("Use at most one interaction moment (command-k, ai-prompt, click-flow or notify-stack) per film.");
    const withEyebrow = scenes.filter((s) => s.eyebrow?.trim()).length;
    if (scenes.length >= 4 && withEyebrow < scenes.length / 2) issues.push("Give most scenes an eyebrow chapter label so the film reads as one story.");
  }
  const numbers = ctx.site ? siteNumbers(ctx.site) : null;
  scenes.forEach((s, i) => {
    const n = `Scene ${i + 1} (${s.skill})`;
    if (i > 0 && scenes[i - 1].skill === s.skill && s.skill !== "photo-montage") issues.push(`${n} repeats the previous scene's skill; vary the visuals.`);
    if (s.skill !== "testimonial" && words(s.text) > (saas ? 9 : 5)) {
      issues.push(`${n} headline "${s.text}" is too long; cut it to ${saas ? "3-9" : "1-4"} punchy words.`);
    }
    const need = NEEDS_ITEMS[s.skill];
    if (need && (s.items?.filter(Boolean).length ?? 0) < need) issues.push(`${n} needs at least ${need} items.`);
    if (s.skill === "chart-grow" && !/\d/.test(s.subtext ?? "")) issues.push(`${n} needs subtext = one real stat with a number (e.g. "30,000+ businesses").`);
    if (s.skill === "cta" && !s.subtext?.trim()) issues.push(`${n} needs subtext = the button label${ctx.site?.cta ? ` ("${ctx.site.cta}")` : ""}.`);
    if (s.duration < 1.8 || s.duration > 8) issues.push(`${n} lasts ${s.duration}s; keep scenes between 2.5 and 6.5 seconds.`);
    if (!ctx.site) return;
    if (s.skill === "testimonial" && !ctx.site.testimonials.some((q) => norm(s.text).includes(norm(q.quote).slice(0, 40)))) {
      issues.push(`${n} quote is not from the site's TESTIMONIALS; use one verbatim or drop the scene.`);
    }
    if (s.skill === "logo-marquee" && !ctx.site.clientLogos.length) issues.push(`${n}: the site has no customer logos; drop logo-marquee.`);
    const copy = [s.text, s.subtext ?? "", ...(s.items ?? [])].join(" ");
    for (const num of copy.match(/\d[\d,.]*/g) ?? []) {
      const bare = num.replace(/[,.]/g, "");
      if (bare.length > 1 && numbers && !numbers.has(bare)) issues.push(`${n} uses the number "${num}", which the site never states; only use real figures.`);
    }
  });
  return issues;
}

/** Brief for the revision pass: the draft, what's wrong with it, and the quality bar. */
export function reviewBrief(draft: unknown, issues: string[]) {
  return [
    "",
    "REVIEW PASS. Below is your first-draft storyboard. Critique it as a demanding creative director, then return the improved storyboard in the same format.",
    "Quality bar: one coherent story with a clear arc; every headline short, concrete and benefit-led in one consistent voice; the strongest real product visuals; no invented quotes, logos or numbers; rhythm that alternates big type moments with product moments; a confident CTA.",
    issues.length ? `Must fix:\n${issues.map((i) => `- ${i}`).join("\n")}` : "The checklist passed; focus on sharper copy, stronger visuals and better pacing.",
    `DRAFT:\n${JSON.stringify(draft)}`,
  ].join("\n");
}

/**
 * Last-resort fixes for anything the AI still got wrong: drop scenes that would show
 * invented social proof and make sure a SaaS film ends on its CTA.
 */
export function repairStoryboard<T extends Draft>(draft: T, ctx: LintContext): T {
  const site = ctx.site;
  let scenes = draft.scenes.filter((s) => {
    if (!site) return true;
    if (s.skill === "testimonial") return site.testimonials.some((q) => norm(s.text).includes(norm(q.quote).slice(0, 40)));
    if (s.skill === "logo-marquee") return site.clientLogos.length > 0;
    return true;
  });
  if (!scenes.length) scenes = draft.scenes;
  if (draft.style === "saas") {
    const i = scenes.findIndex((s) => s.skill === "cta");
    if (i >= 0 && i !== scenes.length - 1) scenes = [...scenes.slice(0, i), ...scenes.slice(i + 1), scenes[i]];
    const last = scenes[scenes.length - 1];
    if (last.skill === "cta" && !last.subtext?.trim() && site?.cta) scenes[scenes.length - 1] = { ...last, subtext: site.cta };
  }
  return { ...draft, scenes };
}
