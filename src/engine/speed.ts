import type { VideoPlan } from "./types";

/** The playback speeds offered: slow motion to triple speed. */
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** The video's playback speed (1 unless set to one of SPEEDS). */
export function playSpeed(plan: Pick<VideoPlan, "speed">) {
  const k = plan.speed ?? 1;
  return (SPEEDS as readonly number[]).includes(k) ? k : 1;
}

/** How long the video runs at its playback speed (what the export lasts). */
export function outputDuration(plan: Pick<VideoPlan, "speed" | "scenes">) {
  return plan.scenes.reduce((a, s) => a + s.duration, 0) / playSpeed(plan);
}

/**
 * The plan as the soundtrack hears it at its speed: every scene that much shorter (or longer) and
 * the tempo scaled to match, so the music is composed for the new timing (in tune, cuts on the
 * beat) rather than sped up. Past 1.5× the groove halves (and below 0.75× doubles) so the tempo
 * stays musical; the cuts still land on beats.
 */
export function audioTiming<T extends Pick<VideoPlan, "speed" | "scenes" | "bpm">>(plan: T): T {
  const k = playSpeed(plan);
  if (k === 1) return plan;
  const feel = k >= 2 ? 0.5 : k <= 0.5 ? 2 : 1;
  return { ...plan, bpm: plan.bpm * k * feel, scenes: plan.scenes.map((s) => ({ ...s, duration: s.duration / k })) };
}
