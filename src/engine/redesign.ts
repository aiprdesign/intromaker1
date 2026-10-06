import { MEDIA_SKILLS } from "./skills";
import type { Scene, SkillId, VideoPlan } from "./types";

/**
 * Remake design: the same story (its slides, words, pictures, timing and edits) shown in other
 * designs. Each slide moves to the next design in its family, a family being designs that take the
 * same content: openers, logo reveals, positioning lines, feature lists, services, overview cards,
 * process layouts, product screens and galleries. Product moments, problems and the end card keep
 * theirs (their content is made for the one design).
 */
const FAMILIES: readonly (readonly SkillId[])[] = [
  ["blur-reveal", "type-cascade", "split-wipe", "type-echo", "style-shuffle"],
  ["logo-reveal", "logo-extrude", "logo-pop", "logo-spin", "logo-draw", "logo-stage", "logo-wipe", "logo-shatter", "logo-type", "logo-orbit", "logo-shapes", "logo-layers", "logo-morph", "logo-tunnel", "logo-dots", "logo-flip", "logo-slices", "liquid-logo", "particle-assemble"],
  ["word-swap", "type-poster", "type-rows", "poster-split", "type-slots", "rapid-fire", "flip-switch", "split-flap", "poster-grid"],
  ["icon-features", "showreel", "card-stack", "contact-sheet"],
  ["services", "service-orbit", "service-carousel", "service-hex", "service-cube", "service-bloom", "service-fan", "service-board", "service-bento", "service-spotlight"],
  ["bento", "card-system", "spec-sheet", "widget-set"],
  ["steps", "process-chevrons", "step-stairs", "step-cards", "step-portals", "light-trail", "arrow-rise"],
  ["ui-tour", "spotlight", "exploded-ui", "device-trio"],
  ["gallery-flow", "carousel-3d", "photo-fan", "card-spread", "photo-drop"],
];

/** Designs that need a picture of the product, and the lists that need enough items to read. */
const NEEDS_LOGO = new Set<SkillId>(["logo-extrude", "logo-spin", "logo-stage", "logo-shatter", "logo-orbit", "logo-layers", "logo-tunnel", "logo-flip"]);
const MIN_ITEMS: Partial<Record<SkillId, number>> = {
  showreel: 3, "card-stack": 3, "contact-sheet": 3, "service-orbit": 3, "service-bloom": 3, "service-bento": 3, "card-system": 3, "spec-sheet": 3, "widget-set": 3, "process-chevrons": 2, "step-stairs": 2, "step-cards": 2, "step-portals": 2, "light-trail": 2,
};
const MAX_ITEMS: Partial<Record<SkillId, number>> = { "service-spotlight": 5, "arrow-rise": 4 };

export function familyOf(skill: SkillId) {
  return FAMILIES.find((f) => f.includes(skill));
}

/**
 * The plan with each slide in another design of its family (the `n`th redesign: each call moves on,
 * offset per family so slides don't change in step). `restyle` carries a slide's content over to
 * the new design, as picking it from the slide's menu does.
 */
export function redesignPlan(plan: VideoPlan, n: number, restyle: (scene: Scene, skill: SkillId, plan: VideoPlan) => Scene): { plan: VideoPlan; changed: number } {
  const used = new Set(plan.scenes.map((s) => s.skill));
  let changed = 0;
  const scenes = plan.scenes.map((s) => {
    const family = familyOf(s.skill);
    if (!family) return s;
    const items = s.items?.length ?? 0;
    const fits = (k: SkillId) =>
      k !== s.skill &&
      !used.has(k) &&
      !(NEEDS_LOGO.has(k) && !plan.brand?.logo) &&
      // A design that shows the product's pictures only where the slide has one.
      !(MEDIA_SKILLS.has(k) && !MEDIA_SKILLS.has(s.skill) && !s.media) &&
      items >= (MIN_ITEMS[k] ?? 0) &&
      items <= (MAX_ITEMS[k] ?? Infinity);
    const offset = family[0].length + family.length;
    const start = family.indexOf(s.skill) + 1 + ((n + offset) % family.length);
    for (let k = 0; k < family.length; k++) {
      const next = family[(start + k) % family.length];
      if (!fits(next)) continue;
      used.add(next);
      changed++;
      return { ...restyle(s, next, plan), why: undefined };
    }
    return s;
  });
  return { plan: { ...plan, scenes }, changed };
}
