/**
 * Free and Pro plans: what each one allows. Shared by the server (which enforces saved films,
 * the AI allowance and website imports) and the studio (which applies the export limits, since
 * videos are rendered in the browser). The owner can change every number in the admin area.
 * No Node imports here.
 */

export type PlanId = "free" | "pro";
export const PLAN_IDS: PlanId[] = ["free", "pro"];

export interface PlanLimits {
  /** Films kept in the account. */
  savedFilms: number;
  /** AI-directed films per month on the site's own AI (a visitor's own key is never counted). */
  aiPerMonth: number;
  /** Website imports per day. */
  importsPerDay: number;
  /** Exports carry a small "Made with IntroMaker" mark. */
  watermark: boolean;
  /** Largest export: long side in pixels, and frame rate. */
  maxLong: number;
  maxFps: number;
}

/** Unlimited, for now: every plan gets everything (abuse rate limits and the AI budget still apply). */
const UNLIMITED: PlanLimits = { savedFilms: 100_000, aiPerMonth: 1_000_000, importsPerDay: 100_000, watermark: false, maxLong: 3840, maxFps: 60 };
export const DEFAULT_LIMITS: Record<PlanId, PlanLimits> = {
  free: { ...UNLIMITED },
  pro: { ...UNLIMITED },
};

export const PLAN_NAMES: Record<PlanId, string> = { free: "Free", pro: "Pro" };

export const WATERMARK = "Made with IntroMaker";

/**
 * The defaults before plans went unlimited. Admin → Plans saves the whole table, so a saved plan
 * that still equals these was never customised: it gets today's (unlimited) defaults.
 */
const OLD_DEFAULTS: Record<PlanId, PlanLimits> = {
  free: { savedFilms: 3, aiPerMonth: 0, importsPerDay: 3, watermark: true, maxLong: 1920, maxFps: 30 },
  pro: { savedFilms: 200, aiPerMonth: 100, importsPerDay: 50, watermark: false, maxLong: 3840, maxFps: 60 },
};
const sameLimits = (a: Partial<PlanLimits>, b: PlanLimits) => (Object.keys(b) as (keyof PlanLimits)[]).every((k) => a[k] === b[k]);

/** Merge saved overrides onto the defaults, clamping each number to a sane range. */
export function readLimits(raw: unknown): Record<PlanId, PlanLimits> {
  const saved = (raw ?? {}) as Partial<Record<PlanId, Partial<PlanLimits>>>;
  const r = Object.fromEntries(PLAN_IDS.map((id) => [id, saved[id] && sameLimits(saved[id]!, OLD_DEFAULTS[id]) ? {} : saved[id]])) as Partial<Record<PlanId, Partial<PlanLimits>>>;
  const num = (v: unknown, d: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : d);
  const one = (id: PlanId): PlanLimits => {
    const d = DEFAULT_LIMITS[id];
    const o = r[id] ?? {};
    return {
      savedFilms: num(o.savedFilms, d.savedFilms, 100_000),
      aiPerMonth: num(o.aiPerMonth, d.aiPerMonth, 1_000_000),
      importsPerDay: num(o.importsPerDay, d.importsPerDay, 100_000),
      watermark: typeof o.watermark === "boolean" ? o.watermark : d.watermark,
      maxLong: [1280, 1920, 2560, 3840].includes(o.maxLong as number) ? (o.maxLong as number) : d.maxLong,
      maxFps: o.maxFps === 30 || o.maxFps === 60 ? o.maxFps : d.maxFps,
    };
  };
  return { free: one("free"), pro: one("pro") };
}

/** One line per limit, for the pricing and account pages. */
export function describeLimits(l: PlanLimits): string[] {
  const res = l.maxLong >= 3840 ? "4K" : l.maxLong >= 2560 ? "1440p" : l.maxLong >= 1920 ? "1080p" : "720p";
  return [
    l.savedFilms >= 100_000 ? "Unlimited saved intros" : `${l.savedFilms} saved intro${l.savedFilms === 1 ? "" : "s"}`,
    l.aiPerMonth >= 1_000_000 ? "Unlimited AI-directed films" : l.aiPerMonth > 0 ? `AI director: ${l.aiPerMonth} films a month` : "Built-in director (or your own AI key)",
    l.importsPerDay >= 100_000 ? "Unlimited website and listing imports" : `${l.importsPerDay} website import${l.importsPerDay === 1 ? "" : "s"} a day`,
    `Export up to ${res} at ${l.maxFps} fps`,
    l.watermark ? "Small IntroMaker watermark" : "No watermark",
  ];
}
