/**
 * The showcase: one random intro per topic, made the way the studio's dice button makes them (the
 * brief, its showcase style, characters where the brief asks for them), from a fixed seed so the
 * gallery stays the same between visits.
 */
import { cartoonPick, scenePick, themePick, WANTS_CHARACTERS } from "./charpick";
import { planFromPrompt } from "./planner";
import { introFor, looksOf, RANDOM_TOPICS, type RandomIntro } from "./surprise";
import { applyTemplate } from "./templates";
import type { VideoPlan } from "./types";

export const SHOWCASE_GROUPS = ["Apps", "Tech & AI", "Local business", "Services"] as const;
export type ShowcaseGroup = (typeof SHOWCASE_GROUPS)[number];

const GROUP: Record<string, ShowcaseGroup> = {
  "Analytics app": "Tech & AI",
  "AI copilot": "Tech & AI",
  "Developer platform": "Tech & AI",
  "Cybersecurity platform": "Tech & AI",
  "Team chat app": "Tech & AI",
  "Smart home app": "Apps",
  "Fitness app": "Apps",
  "Budget app": "Apps",
  "Travel app": "Apps",
  "Language app": "Apps",
  "Kids learning app": "Apps",
  "Pet care app": "Apps",
  "EV charging app": "Apps",
  "Event ticketing app": "Apps",
  "Recipe app": "Apps",
  "Delivery service": "Apps",
  "Coffee shop": "Local business",
  "Restaurant": "Local business",
  "Dental clinic": "Local business",
  "Plant shop": "Local business",
  "Homebuilder": "Local business",
  "Real estate agency": "Services",
  "Law firm": "Services",
  "Construction company": "Services",
  "Marketing agency": "Services",
  "Online course": "Services",
};

export type ShowcaseIntro = RandomIntro & { group: ShowcaseGroup; plan: VideoPlan };

export function showcaseIntros(): ShowcaseIntro[] {
  // A gallery of different looks: a topic takes the first of its styles not shown yet.
  const used = new Set<string>();
  return RANDOM_TOPICS.map((kind, i) => {
    let s = 4099 + i * 7919;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const brief = introFor(kind, rand)!;
    const looks = looksOf(kind);
    const look = looks.find((l) => !used.has(l)) ?? brief.look;
    if (look) used.add(look);
    const r = { ...brief, look };
    let plan = planFromPrompt({ prompt: r.prompt, aspect: "16:9", length: "standard", palette: "auto", seed: 101 + i * 13, template: r.look, style: "saas", safe: true });
    // No showcase style: the studio's own pick (characters where the brief asks for them).
    if (!r.look) {
      const pick = WANTS_CHARACTERS.test(r.prompt) ? cartoonPick(r.prompt) : themePick(r.prompt);
      if (pick) plan = applyTemplate({ ...plan, characters: pick.characters, setting: scenePick(r.prompt) }, pick.template);
    }
    return { ...r, group: GROUP[kind] ?? "Apps", plan };
  });
}
