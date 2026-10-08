import type { Scene, SkillId, VideoPlan } from "./types";

/**
 * Contrast slides: the stage flips to inverse colours where the story itself turns on a contrast,
 * so the colour change carries meaning rather than just breaking the rhythm. The director picks
 * them; a slide's own `contrast` overrides, and `plan.contrast = false` turns the automatic ones off.
 *
 * - A split (one half of the frame in inverse colours) where two sides are set against each other:
 *   the Split Contrast slide (the old way against the new), the problem → solution columns (the
 *   answers on the inverse side), and a words-only line that states an opposition ("Less typing,
 *   more selling", "From commit to live", "Instead of spreadsheets…").
 * - A full colour block for the turn: the answer straight after the problem (a words-only slide
 *   that follows a pain or before/after slide).
 *
 * Screenshots, logos, product photos, the opener and the end card keep the video's normal stage.
 */
export const CONTRAST_SKILLS = new Set<SkillId>([
  "blur-reveal", "word-swap", "type-rows", "type-poster", "poster-grid", "poster-split", "type-echo", "type-slots", "rapid-fire", "flip-switch", "zoom-through", "slice-switch", "style-shuffle", "split-flap", "whip-pan", "stack-stomp", "speed-ticker", "cube-spin", "speed-type", "bar-wipe", "crash-zoom", "word-grid", "orbit-text", "tape-rush", "jump-cut", "letter-rush", "stamp-rush", "rally", "spiral-in", "domino", "slipstream", "stretch-snap", "rack-focus", "number-ticker", "testimonial", "type-cascade", "split-wipe",
]);

/** Slides whose layout sets two sides against each other: they split, the second side inverse. */
const TWO_SIDED = new Set<SkillId>(["contrast-split", "problem-solution"]);

/** Words that set two things against each other. */
const OPPOSE = /\b(vs\.?|versus|instead of|rather than|no more|not just|less\b.+\bmore|more\b.+\bless|from\b.+\bto\b|before\b.+\bafter|old\b.+\bnew|stop\b.+\bstart|out with|goodbye)\b/i;

/** Slides that state the problem (the slide after one is the turn). */
const PROBLEM = (s: Scene | undefined) => !!s && (s.role === "pain" || s.skill === "pain-strike" || s.skill === "before-after");

const plain = (s: Scene) => (s.text ?? "").replace(/[*|]/g, " ");

/** Whether a slide could be a contrast slide (a words-only or two-sided design without pictures). */
export function canContrast(scene: Scene) {
  return (CONTRAST_SKILLS.has(scene.skill) || TWO_SIDED.has(scene.skill)) && !scene.media;
}

/** What contrast, if any, a slide's meaning calls for: a split, a full block for the turn, or none. */
function meaning(scenes: Scene[], i: number): "split" | "block" | undefined {
  const s = scenes[i];
  if (!canContrast(s)) return undefined;
  if (TWO_SIDED.has(s.skill)) return "split";
  if (OPPOSE.test(plain(s))) return "split";
  if (PROBLEM(scenes[i - 1]) && (s.role === "solve" || s.role === "promise" || s.role === "meet" || !s.role)) return "block";
  return undefined;
}

const chosen = (s: Scene) => s.contrast === true || s.contrast === "left" || s.contrast === "right";

/** The indexes of the contrast slides in a plan. */
export function contrastSlides(plan: Pick<VideoPlan, "style" | "contrast"> & { scenes?: Scene[] }): Set<number> {
  const scenes = plan.scenes;
  if (!scenes?.length) return new Set();
  const out = new Set<number>();
  const auto = plan.style === "saas" && plan.contrast !== false;
  const n = scenes.length;
  scenes.forEach((s, i) => {
    let on = false;
    if (chosen(s)) on = canContrast(s);
    else if (s.contrast === undefined && auto) {
      // Never the opener or the end card, never two in a row, never right before a chosen one.
      const end = i === n - 1 || s.role === "cta";
      const nextChosen = !!scenes[i + 1] && chosen(scenes[i + 1]);
      on = i > 0 && !end && !out.has(i - 1) && !nextChosen && !!meaning(scenes, i);
    }
    if (on) out.add(i);
  });
  return out;
}

/**
 * How a contrast slide flips: which side of a split shows the inverse colours ("none": not at
 * all, as for side-by-side columns stacked in a tall frame), or undefined for the full block.
 * The right side is the new way, on a phone too (split down a vertical line).
 */
export function contrastSplit(plan: { scenes?: Scene[] }, index: number, portrait = false): "left" | "right" | "top" | "bottom" | "none" | undefined {
  const scenes = plan.scenes;
  const s = scenes?.[index];
  if (!s || !scenes) return undefined;
  if (s.contrast === "left" || s.contrast === "right") return s.contrast;
  if (s.contrast === true) return undefined;
  if (meaning(scenes, index) !== "split") return undefined;
  // (A phone frame splits down a vertical line too; only problem → solution, whose pairs stack
  // full width there, doesn't split.)
  if (portrait && s.skill === "problem-solution") return "none";
  return "right";
}

/** Slides that keep the style's own stage in a light/dark rhythm (logos, product shots, characters, homes, the close). */
const OWN_STAGE = /^(logo-|liquid-logo|qr-end|cta|product-|char-|pro-|abs-|ind-|home-)/;

/**
 * Light and dark slides: so a video doesn't sit on one tone throughout, some middle slides switch
 * to the opposite tone of the style (a dark style's slide goes light, a light style's goes deep
 * and dark), every other eligible slide, the starting one varied by the video's seed. The opener,
 * the logo reveal, the end card, logos, product shots, character and home scenes keep the style's
 * own stage, and contrast slides keep theirs. `plan.tones = false` turns it off.
 */
export function toneSlides(plan: Pick<VideoPlan, "style"> & { scenes?: Scene[]; seed?: number; tones?: boolean }): Set<number> {
  const scenes = plan.scenes;
  const out = new Set<number>();
  if (!scenes || scenes.length < 4 || plan.style !== "saas" || plan.tones === false) return out;
  const flips = contrastSlides({ ...plan, contrast: (plan as { contrast?: boolean }).contrast });
  const eligible = scenes
    .map((s, i) => i)
    .filter((i) => {
      const s = scenes[i];
      return i > 0 && i < scenes.length - 1 && s.role !== "reveal" && s.role !== "cta" && !OWN_STAGE.test(s.skill) && !flips.has(i);
    });
  const start = (plan.seed ?? 0) % 2;
  eligible.forEach((i, k) => {
    if (k % 2 === start) out.add(i);
  });
  return out;
}
