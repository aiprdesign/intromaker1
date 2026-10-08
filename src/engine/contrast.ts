import { hashString } from "./math";
import type { Scene, SkillId, VideoPlan } from "./types";

/**
 * Contrast slides: every few slides, one text beat flips the stage to a bold block of the video's
 * own colour (type flipped to match), so a run of same-looking slides gets a change of pace. The
 * director picks them; a slide's own `contrast` (true or false) overrides, and `plan.contrast =
 * false` turns the automatic ones off. Every other one the director picks is a split instead:
 * only the left or right half of the frame flips, so the type crossing the seam changes colour
 * mid-word, like a split poster.
 *
 * Only words-only slides take it: big type reads well on a colour block, while screenshots, logos,
 * product photos and the end card keep the video's normal stage.
 */
export const CONTRAST_SKILLS = new Set<SkillId>([
  "blur-reveal", "word-swap", "type-rows", "type-poster", "poster-grid", "poster-split", "type-echo", "type-slots", "rapid-fire", "flip-switch", "zoom-through", "slice-switch", "style-shuffle", "split-flap", "whip-pan", "stack-stomp", "speed-ticker", "cube-spin", "speed-type", "bar-wipe", "crash-zoom", "word-grid", "orbit-text", "tape-rush", "jump-cut", "letter-rush", "stamp-rush", "rally", "spiral-in", "domino", "slipstream", "stretch-snap", "rack-focus", "number-ticker", "testimonial", "type-cascade", "split-wipe",
]);

/** At least this many normal slides before an automatic contrast slide, and between two of them. */
const GAP = 2;

/** Whether a slide could be a contrast slide (a words-only design without pictures). */
export function canContrast(scene: Scene) {
  return CONTRAST_SKILLS.has(scene.skill) && !scene.media;
}

const chosen = (s: Scene) => s.contrast === true || s.contrast === "left" || s.contrast === "right";

/** The indexes of the contrast slides in a plan. */
export function contrastSlides(plan: Pick<VideoPlan, "style" | "contrast"> & { scenes?: Scene[] }): Set<number> {
  const scenes = plan.scenes;
  if (!scenes?.length) return new Set();
  const out = new Set<number>();
  const auto = plan.style === "saas" && plan.contrast !== false && scenes.length >= 5;
  const n = scenes.length;
  let since = 0;
  scenes.forEach((s, i) => {
    let on = false;
    if (chosen(s)) on = canContrast(s);
    else if (s.contrast === undefined && auto) {
      // Never the opener or the end card, never two in a row, never right before a chosen one.
      const end = i === n - 1 || s.role === "cta";
      const nextChosen = !!scenes[i + 1] && chosen(scenes[i + 1]);
      on = i > 0 && !end && since >= GAP && !nextChosen && canContrast(s);
    }
    if (on) {
      out.add(i);
      since = 0;
    } else since++;
  });
  return out;
}

/**
 * Which half of a contrast slide flips, when it's a split (undefined: the whole frame flips). A
 * slide's own "left" or "right" wins; of the director's picks, every other one is a split, its
 * side varied by the video's seed.
 */
export function contrastSplit(plan: Pick<VideoPlan, "style" | "contrast"> & { scenes?: Scene[]; seed?: number }, index: number): "left" | "right" | undefined {
  const s = plan.scenes?.[index];
  if (!s) return undefined;
  if (s.contrast === "left" || s.contrast === "right") return s.contrast;
  if (s.contrast !== undefined) return undefined;
  const picks = Array.from(contrastSlides(plan)).filter((i) => plan.scenes![i].contrast === undefined).sort((a, b) => a - b);
  const k = picks.indexOf(index);
  const seed = plan.seed ?? 0;
  if (k < 0 || (k + seed) % 2 === 0) return undefined;
  return hashString(`${seed}:${index}`) % 2 ? "left" : "right";
}
