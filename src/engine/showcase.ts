/**
 * The showcase: one random intro per topic, made the way the studio's dice button makes them (the
 * brief, its showcase style, characters where the brief asks for them), from a fixed seed so the
 * gallery stays the same between visits.
 */
import { cartoonPick, motifPick, scenePick, themePick, WANTS_CHARACTERS } from "./charpick";
import { planFromPrompt } from "./planner";
import { introFor, looksOf, RANDOM_TOPICS, type RandomIntro } from "./surprise";
import { applyTemplate } from "./templates";
import type { VideoPlan } from "./types";

export const SHOWCASE_GROUPS = ["Food & drink", "Beauty & wellness", "Health", "Home services", "Auto", "Shops", "Professional", "Community", "Arts & learning", "Apps", "Tech & AI"] as const;
export type ShowcaseGroup = (typeof SHOWCASE_GROUPS)[number];

/** Each group's icon (Lucide), for the gallery's tabs. */
export const GROUP_ICONS: Record<ShowcaseGroup, string> = {
  "Food & drink": "Utensils",
  "Beauty & wellness": "Scissors",
  Health: "Stethoscope",
  "Home services": "Wrench",
  Auto: "CarFront",
  Shops: "Store",
  Professional: "Briefcase",
  Community: "HandHeart",
  "Arts & learning": "Palette",
  Apps: "Smartphone",
  "Tech & AI": "Cpu",
};

const GROUPS: Record<ShowcaseGroup, string[]> = {
  "Food & drink": ["Restaurant", "Coffee shop", "Bakery", "Pizza place", "Chinese buffet", "Indian restaurant", "Sushi bar", "Thai kitchen", "Italian trattoria", "Mexican restaurant", "BBQ smokehouse", "Taco truck", "Ice cream shop"],
  "Beauty & wellness": ["Barber shop", "Hair salon", "Nail salon", "Tattoo studio", "Yoga studio", "Boxing gym", "Pet grooming"],
  Health: ["Family doctor", "Dental clinic", "Eyeglasses shop"],
  "Home services": ["Plumber", "Electrician", "Heating and cooling", "Landscaping", "Cleaning service", "Roofing company", "Moving company", "Construction company", "Homebuilder"],
  Auto: ["Used car dealership", "New car dealership", "Auto repair shop", "Collision repair", "Car wash"],
  Shops: ["Florist", "Plant shop", "Bookstore", "Antique shop", "Thrift shop", "Music shop", "Phone repair shop", "Bed and breakfast"],
  Professional: ["Law firm", "Tax preparer", "Insurance agency", "Real estate agency", "Marketing agency"],
  Community: ["Community church", "Food bank", "Family farm", "Daycare"],
  "Arts & learning": ["Art studio", "Dance studio", "Music teacher", "Photography studio", "Online course"],
  Apps: ["Fitness app", "Budget app", "Travel app", "Language app", "Kids learning app", "Pet care app", "EV charging app", "Event ticketing app", "Recipe app", "Delivery service", "Smart home app"],
  "Tech & AI": ["Analytics app", "AI copilot", "Developer platform", "Cybersecurity platform", "Team chat app"],
};
const GROUP = new Map(Object.entries(GROUPS).flatMap(([g, kinds]) => kinds.map((k) => [k, g as ShowcaseGroup] as const)));

/** The topics in gallery order: one from each group in turn, so the first rows already mix them. */
function galleryOrder() {
  const lists = SHOWCASE_GROUPS.map((g) => GROUPS[g].filter((k) => RANDOM_TOPICS.includes(k)));
  const rest = RANDOM_TOPICS.filter((k) => !GROUP.has(k));
  const out: string[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return [...out, ...rest];
}

/** `icon`: the business's own icon (a cone, a wrench), else its group's, for the card's tag. */
export type ShowcaseIntro = RandomIntro & { group: ShowcaseGroup; icon: string; plan: VideoPlan };

export function showcaseIntros(): ShowcaseIntro[] {
  // A gallery of different looks: a topic takes the least-shown of its styles.
  const used = new Map<string, number>();
  return galleryOrder().map((kind, i) => {
    let s = 4099 + i * 7919;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const brief = introFor(kind, rand)!;
    const looks = looksOf(kind);
    const look = looks.length ? looks.reduce((a, b) => ((used.get(b) ?? 0) < (used.get(a) ?? 0) ? b : a)) : brief.look;
    if (look) used.set(look, (used.get(look) ?? 0) + 1);
    const r = { ...brief, look };
    let plan = planFromPrompt({ prompt: r.prompt, aspect: "16:9", length: "standard", palette: "auto", seed: 101 + i * 13, template: r.look, style: "saas", safe: true });
    // No showcase style: the studio's own pick (characters where the brief asks for them).
    if (!r.look) {
      const pick = WANTS_CHARACTERS.test(r.prompt) ? cartoonPick(r.prompt) : themePick(r.prompt);
      if (pick) plan = applyTemplate({ ...plan, characters: pick.characters, setting: scenePick(r.prompt) }, pick.template);
    }
    // The business's own scene (a bakery, a barber shop…) for its industry slides.
    plan = { ...plan, setting: scenePick(r.prompt) ?? plan.setting, motifs: motifPick(r.prompt) };
    // The niche's colours (cosy browns for a restaurant, red and yellow for pizza…).
    if (r.colors && plan.brand) plan = { ...plan, brand: { ...plan.brand, colors: r.colors } };
    const group = GROUP.get(kind) ?? "Apps";
    return { ...r, group, icon: plan.motifs?.[0] ?? GROUP_ICONS[group], plan };
  });
}
