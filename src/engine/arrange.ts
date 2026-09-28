/**
 * The film's musical arrangement, shared by the score and the picture so they hit together.
 *
 * A professional launch-film cue is edited like a record: a filtered intro under the hook,
 * a build (snare roll, riser, filter sweep) that drops exactly on the brand reveal, a groove
 * through the product beats, one breakdown mid-film to reset the ear, a re-drop, and a clean
 * ending that resolves on the call to action. The camera punches on the kicks the music
 * actually plays, and harder on each drop.
 */
import type { Scene, VideoPlan } from "./types";

export type SectionKind = "intro" | "drop" | "groove" | "break" | "outro";

export interface Section {
  kind: SectionKind;
  start: number;
  end: number;
  scene: number;
}

export interface Arrangement {
  beat: number;
  bar: number;
  total: number;
  starts: number[];
  sections: Section[];
  /** Times the music drops (full groove re-enters on a downbeat with a crash). */
  drops: number[];
  /** Build windows [start, end] leading into each drop. */
  builds: [number, number][];
  /** Music stops here (the last couple of beats ring out). */
  ending: number;
}

type PlanLike = Pick<VideoPlan, "bpm"> & { scenes: Pick<Scene, "duration" | "role">[] };

const BREAK_ROLES = new Set(["promise", "quote", "how"]);

export function arrange(plan: PlanLike): Arrangement {
  const beat = 60 / (plan.bpm || 120);
  const bar = beat * 4;
  const starts: number[] = [];
  let acc = 0;
  for (const s of plan.scenes) {
    starts.push(acc);
    acc += s.duration;
  }
  const total = acc;
  const n = plan.scenes.length;
  const ending = Math.max(0, total - beat * 2);
  // One breakdown, on the calm beat nearest the middle of a film long enough to need one.
  let breakAt = -1;
  if (total >= 20 && n >= 5) {
    let best = Infinity;
    plan.scenes.forEach((s, i) => {
      if (i < 2 || i > n - 2 || !BREAK_ROLES.has(s.role ?? "")) return;
      const mid = Math.abs(starts[i] + s.duration / 2 - total / 2);
      if (mid < best) {
        best = mid;
        breakAt = i;
      }
    });
  }
  const sections: Section[] = plan.scenes.map((s, i) => {
    const kind: SectionKind = n <= 2 ? (i === 0 ? "drop" : "outro") : i === 0 ? "intro" : i === n - 1 ? "outro" : i === 1 ? "drop" : i === breakAt ? "break" : "groove";
    return { kind, start: starts[i], end: starts[i] + s.duration, scene: i };
  });
  const drops: number[] = [];
  const builds: [number, number][] = [];
  const dropAt = n > 2 ? starts[1] : 0;
  if (dropAt > beat * 1.5) {
    drops.push(dropAt);
    builds.push([Math.max(0, dropAt - Math.min(bar, dropAt * 0.55)), dropAt]);
  }
  if (breakAt > 0 && breakAt + 1 < n) {
    const re = starts[breakAt + 1];
    drops.push(re);
    builds.push([Math.max(starts[breakAt], re - Math.min(beat * 2, plan.scenes[breakAt].duration * 0.4)), re]);
  }
  return { beat, bar, total, starts, sections, drops, builds, ending };
}

export function sectionAt(a: Arrangement, t: number): Section | undefined {
  return a.sections.find((s) => t >= s.start && t < s.end) ?? a.sections[a.sections.length - 1];
}

/** Does the kick play on the beat at time `t`? (Four-on-the-floor in drops and grooves.) */
export function kickAt(a: Arrangement, t: number) {
  if (t >= a.ending) return false;
  const s = sectionAt(a, t);
  return !!s && (s.kind === "drop" || s.kind === "groove" || s.kind === "outro");
}

/** Musical energy 0..1 at `t` (drives camera punch and background motion). */
export function energyAt(a: Arrangement, t: number) {
  for (const [b0, b1] of a.builds) if (t >= b0 && t < b1) return 0.4 + 0.6 * ((t - b0) / Math.max(0.01, b1 - b0));
  const s = sectionAt(a, t);
  if (!s || t >= a.ending) return 0.2;
  return s.kind === "intro" ? 0.35 : s.kind === "break" ? 0.45 : s.kind === "outro" ? 0.85 : 1;
}

/** Seconds since the most recent drop (Infinity if none yet). */
export function sinceDrop(a: Arrangement, t: number) {
  let best = Infinity;
  for (const d of a.drops) if (t >= d) best = Math.min(best, t - d);
  return best;
}

/**
 * Seconds since the last kick the score actually played (the pattern is in 16ths from the
 * film's first bar), or Infinity. Drives the camera punch so picture and music hit together.
 */
export function sinceKick(a: Arrangement, t: number, kicks: number[]) {
  const step = a.beat / 4;
  const idx = Math.floor(t / step + 1e-6);
  for (let k = idx; k >= Math.max(0, idx - 16); k--) {
    const kt = k * step;
    if (kicks.includes(((k % 16) + 16) % 16) && kickAt(a, kt)) return t - kt;
  }
  return Infinity;
}
