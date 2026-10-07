/**
 * Cinematography pass: the director of photography's last look at a storyboard before it plays,
 * after the style is applied (so it runs for SaaS and product videos and on every style switch).
 * It keeps the cut readable and on-brand without changing the story or the copy:
 *
 * - Transition grammar: the video opens clean (no transition into the first shot); the brand
 *   reveal arrives on a confident move, not a busy one (it lands on the music's drop); the end card
 *   arrives calmly; two big transitions never run back to back (the second becomes a cut on the
 *   beat), and one transition never plays three times in a row. Out of a product cold open, the
 *   product still lands on its flash.
 * - Holds: the brand reveal and the end card get enough time to read (a beat-snapped floor), so the
 *   logo and the call to action never flash past.
 * - Variety: the same slide twice in a row reads as a mistake, so the second becomes the style's own
 *   slide for that part of the story.
 *
 * - Contrast slides (see contrast.ts) land on a hard cut or a flash and leave on a cut or a zoom,
 *   so the colour change hits like an edit, not a fade.
 *
 * Idempotent: running it again changes nothing.
 */
import { contrastSlides } from "./contrast";
import type { Scene, SkillId, Transition, VideoPlan } from "./types";

/** Transitions with a lot of movement or texture: one at a time. */
const BIG = new Set<Transition>(["cube", "spin", "portal", "split", "liquid", "glitch", "whip", "swipe", "shutter"]);
/** Busy transitions that would fight the logo landing on the drop. */
const BUSY = new Set<Transition>(["glitch", "swipe", "split", "spin", "shutter", "cube", "whip"]);
/** Calm transitions for the end card. */
const CALM = new Set<Transition>(["dissolve", "dolly", "push", "morph", "leak", "iris", "cut"]);

/** Zoom moves: a zoom-through (dolly) or a punch-in (zoom). */
export const ZOOMS = new Set<Transition>(["dolly", "zoom"]);

/**
 * Which transitions fit going into each part of the story, best first: a zoom that reveals the
 * product, the brand or the answer; sideways moves between lists; hard cuts and flashes into
 * punchy lines; calm moves into quotes and the end card.
 */
const FIT: Record<string, Transition[]> = {
  reveal: ["dolly", "zoom", "iris", "portal", "morph", "flash"],
  meet: ["dolly", "zoom", "push", "morph", "cube"],
  tour: ["zoom", "dolly", "push", "morph"],
  demo: ["push", "zoom", "swipe", "dolly", "morph"],
  solve: ["dolly", "zoom", "split", "push"],
  compare: ["split", "swipe", "push", "zoom"],
  how: ["push", "swipe", "whip", "split", "cube"],
  features: ["swipe", "push", "whip", "cube", "spin", "dissolve"],
  bento: ["push", "swipe", "cube", "whip", "dissolve"],
  cards: ["swipe", "push", "whip", "spin", "dissolve"],
  integrations: ["push", "swipe", "spin", "dissolve"],
  logos: ["push", "dissolve", "swipe"],
  gallery: ["swipe", "push", "whip", "dissolve"],
  reach: ["zoom", "push", "dissolve"],
  support: ["push", "dissolve", "swipe"],
  hook: ["cut", "flash", "glitch", "shutter"],
  pain: ["cut", "glitch", "shutter", "flash", "split"],
  promise: ["whip", "cut", "flash", "spin", "shutter", "swipe"],
  stat: ["zoom", "cut", "flash", "push"],
  metric: ["zoom", "push", "cut", "flash"],
  quote: ["dissolve", "leak", "morph", "dolly"],
  cta: ["dissolve", "dolly", "iris", "morph", "leak", "push"],
};
/** Story parts a zoom reveals: added even when the style's own set has no zoom. */
const ZOOM_INTO = new Set(["reveal", "meet", "tour", "solve"]);

/**
 * The transition into a slide, chosen for where it is in the story rather than at random: from the
 * style's own set where it has a fitting move, plus a zoom to reveal the brand, the product or the
 * answer to a problem. Never the transition just used, never two zooms in a row, and at most one
 * zoom in three. `r` is the plan's seeded random, so a remake gets a different mix.
 */
export function mixTransition(role: string | undefined, prevRole: string | undefined, pool: readonly Transition[], last: Transition, zooms: number, count: number, r: () => number): Transition {
  // A style with one signature move (Liquid) keeps it.
  if (pool.length === 1) return pool[0];
  const afterPain = prevRole === "pain" && role !== "pain";
  const want = afterPain ? ["dolly", "zoom", ...(FIT[role ?? ""] ?? [])] : FIT[role ?? ""] ?? [];
  const zoomOk = !ZOOMS.has(last) && zooms < Math.max(1, Math.ceil(count / 3));
  const fits = [...new Set(want as Transition[])].filter(
    (t) => t !== last && (pool.includes(t) || (ZOOMS.has(t) && (afterPain || ZOOM_INTO.has(role ?? "")))) && (zoomOk || !ZOOMS.has(t)),
  );
  if (fits.length) {
    // Mostly the best fit, sometimes the next ones, so videos in one style don't cut alike.
    const x = r();
    return fits[x < 0.55 || fits.length === 1 ? 0 : x < 0.85 || fits.length === 2 ? 1 : 2];
  }
  const rest = pool.filter((t) => t !== last && (zoomOk || !ZOOMS.has(t)));
  const from = rest.length ? rest : pool.filter((t) => t !== last);
  return from.length ? from[Math.floor(r() * from.length)] : "cut";
}

const isEnd = (s: Scene, i: number, n: number) => i === n - 1 || s.role === "cta" || /^(cta|qr-end|product-end)$/.test(s.skill);
const isReveal = (s: Scene) => s.role === "reveal" || /^logo-|^liquid-logo$/.test(s.skill);

export type CinemaOpts = {
  /** The style's transitions, used for replacements (falls back to a neutral set). */
  pool?: readonly Transition[];
  /** The style's slide for each part of the story, for de-duplicating back-to-back slides. */
  roleSkill?: (role: string) => SkillId | undefined;
};

export function cinematography(plan: VideoPlan, opts: CinemaOpts = {}): VideoPlan {
  const n = plan.scenes.length;
  if (!n) return plan;
  const pool: readonly Transition[] = opts.pool?.length ? opts.pool : ["dolly", "push", "dissolve", "cut"];
  const beat = 60 / (plan.bpm || 120);
  const snap = (d: number) => Math.max(4, Math.round(d / beat)) * beat;
  let changed = false;
  const scenes = plan.scenes.map((s) => ({ ...s }));
  const flips = contrastSlides(plan);
  scenes.forEach((s, i) => {
    let tr = s.transition;
    const prev = i > 0 ? scenes[i - 1] : undefined;
    // A replacement never repeats the transitions either side of it (the same move twice in a row
    // reads as a stutter), falling back to a cut on the beat.
    const next = scenes[i + 1];
    const fresh = (want: Transition[]) => want.find((t) => pool.includes(t) && t !== prev?.transition && t !== next?.transition) ?? "cut";
    if (i === 0) tr = "cut";
    else if (prev?.skill === "product-teaser") tr = "flash";
    else {
      if (isReveal(s) && BUSY.has(tr)) tr = fresh(["dolly", "push", "dissolve"]);
      if (prev && BIG.has(prev.transition) && BIG.has(tr)) tr = "cut";
      const before = i > 1 ? scenes[i - 2] : undefined;
      if (prev && before && prev.transition === tr && before.transition === tr && tr !== "cut") tr = pool.find((t) => t !== tr && !(BIG.has(t) && BIG.has(prev.transition))) ?? "cut";
      // Contrast slides cut in hard (or flash, where the style has it) and leave on a cut or a zoom.
      if (flips.has(i) && !["cut", "flash", "glitch", "shutter"].includes(tr)) tr = pool.includes("flash") && prev?.transition !== "flash" ? "flash" : "cut";
      else if (flips.has(i - 1) && !["cut", "zoom", "dolly", "flash"].includes(tr)) tr = prev?.transition !== "zoom" && !isEnd(s, i, n) ? "zoom" : "cut";
      // Last word: the end card always arrives calmly (a different calm move if this one would repeat).
      if (isEnd(s, i, n) && !CALM.has(tr)) tr = fresh(["dissolve", "dolly", "morph", "push", "iris", "leak"]);
    }
    if (tr !== s.transition) {
      s.transition = tr;
      changed = true;
    }
    // Holds: the reveal and the end card get time to read.
    const floor = isReveal(s) ? 2.4 : isEnd(s, i, n) ? 2.8 : 0;
    if (floor && s.duration < floor - 1e-6) {
      s.duration = snap(floor);
      changed = true;
    }
    // Variety: never the same slide twice in a row.
    if (prev && prev.skill === s.skill && s.role && opts.roleSkill) {
      const alt = opts.roleSkill(s.role);
      if (alt && alt !== s.skill && alt !== prev.skill) {
        s.skill = alt;
        changed = true;
      }
    }
  });
  return changed ? { ...plan, scenes } : plan;
}
