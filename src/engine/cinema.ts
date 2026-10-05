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
 * Idempotent: running it again changes nothing.
 */
import type { Scene, SkillId, Transition, VideoPlan } from "./types";

/** Transitions with a lot of movement or texture: one at a time. */
const BIG = new Set<Transition>(["cube", "spin", "portal", "split", "liquid", "glitch", "whip", "swipe", "shutter"]);
/** Busy transitions that would fight the logo landing on the drop. */
const BUSY = new Set<Transition>(["glitch", "swipe", "split", "spin", "shutter", "cube", "whip"]);
/** Calm transitions for the end card. */
const CALM = new Set<Transition>(["dissolve", "dolly", "push", "morph", "leak", "iris", "cut"]);

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
