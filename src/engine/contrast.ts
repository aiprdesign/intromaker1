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
 * The second side (right, or the bottom of a stacked Split Contrast) is the new way.
 */
export function contrastSplit(plan: { scenes?: Scene[] }, index: number, portrait = false): "left" | "right" | "top" | "bottom" | "none" | undefined {
  const scenes = plan.scenes;
  const s = scenes?.[index];
  if (!s || !scenes) return undefined;
  if (s.contrast === "left" || s.contrast === "right") return s.contrast;
  if (s.contrast === true) return undefined;
  if (meaning(scenes, index) !== "split") return undefined;
  if (portrait) return s.skill === "contrast-split" ? "bottom" : s.skill === "problem-solution" ? "none" : "right";
  return "right";
}
