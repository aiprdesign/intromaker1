/**
 * Rate limits for the routes that cost something when the app is hosted publicly: website
 * capture drives a headless browser, the asset proxy fetches third-party URLs, and generation
 * or voice can spend an AI key.
 *
 * Fixed windows per client, kept in memory: right for a single server instance (the Docker
 * deploy). Several instances would share them through Redis instead; the interface stays the same.
 *
 * On by default in production (`next start`), off in development. Environment:
 *   INTROMAKER_RATE_LIMIT=off         turn the limits off
 *   INTROMAKER_PROXY_HOPS=1           trusted reverse proxies in front (Render, Fly, nginx);
 *                                     0 when the server faces the internet directly
 *   INTROMAKER_AI_DAILY_BUDGET=200    AI generations per day, all visitors combined, when the
 *                                     server's own key pays (visitors' own keys aren't counted)
 */

export interface Rule {
  limit: number;
  windowMs: number;
}

const MIN = 60_000;
export const RULES = {
  /** Live capture: a headless browser session per request. */
  scrape: { limit: 8, windowMs: 10 * MIN },
  /** Third-party images and videos, proxied so the canvas stays untainted. */
  asset: { limit: 400, windowMs: 10 * MIN },
  /** Captured screenshots served back from disk. */
  shot: { limit: 800, windowMs: 10 * MIN },
  /** Storyboard generation (built-in director is cheap; AI is not). */
  generate: { limit: 30, windowMs: 10 * MIN },
  /** Generation paid by the server's own AI key, per visitor. */
  serverAi: { limit: 12, windowMs: 24 * 60 * MIN },
  /** Voice-over lines through a cloud voice. */
  tts: { limit: 80, windowMs: 10 * MIN },
  /** Checking an AI key / listing models. */
  aiCheck: { limit: 20, windowMs: 10 * MIN },
  /** Admin sign-in attempts: slows password guessing to a crawl. */
  adminLogin: { limit: 6, windowMs: 15 * MIN },
  /** Film events the studio reports (exports). */
  filmEvent: { limit: 60, windowMs: 10 * MIN },
  /** Account sign-in attempts. */
  accountLogin: { limit: 10, windowMs: 15 * MIN },
  /** New accounts from one address. */
  signup: { limit: 5, windowMs: 60 * MIN },
  /** Saving films / account changes. */
  account: { limit: 120, windowMs: 10 * MIN },
  /** Website imports per day without an account (the Free plan's number is passed in). */
  importDay: { limit: 3, windowMs: 24 * 60 * MIN },
} satisfies Record<string, Rule>;
export type RuleName = keyof typeof RULES;

export const enabled = () =>
  process.env.INTROMAKER_RATE_LIMIT !== "off" && (process.env.NODE_ENV === "production" || process.env.INTROMAKER_RATE_LIMIT === "on");

/**
 * Who is asking. Behind a reverse proxy the client address is the one the proxy appended to
 * X-Forwarded-For (counted from the right, so a client can't spoof it by sending its own header).
 */
export function clientKey(req: Request): string {
  const hops = Math.max(0, Number(process.env.INTROMAKER_PROXY_HOPS ?? 1) || 0);
  const fwd = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (hops === 0) return "direct"; // no trusted proxy: headers are client-controlled, so one shared bucket
  if (fwd.length >= hops) return fwd[fwd.length - hops];
  return req.headers.get("x-real-ip")?.trim() || "direct";
}

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
}

/** Count one request against `name` for this client; `ok: false` once the window is full. */
export function take(name: RuleName, key: string, now = Date.now(), limit?: number): { ok: boolean; remaining: number; retryAfter: number; limit: number } {
  const rule = { ...RULES[name], ...(limit !== undefined ? { limit } : {}) };
  sweep(now);
  const id = `${name}:${key}`;
  let b = buckets.get(id);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + rule.windowMs };
    buckets.set(id, b);
  }
  if (b.count >= rule.limit) return { ok: false, remaining: 0, retryAfter: Math.ceil((b.reset - now) / 1000), limit: rule.limit };
  b.count++;
  return { ok: true, remaining: rule.limit - b.count, retryAfter: 0, limit: rule.limit };
}

/**
 * Guard a route: returns a 429 response when the client is over the limit, otherwise null.
 *
 *   const limited = rateLimit(req, "scrape");
 *   if (limited) return limited;
 */
export function rateLimit(req: Request, name: RuleName): Response | null {
  if (!enabled()) return null;
  const r = take(name, clientKey(req));
  if (r.ok) return null;
  const mins = Math.ceil(r.retryAfter / 60);
  return Response.json(
    { error: `Too many requests. Try again in ${mins > 1 ? `${mins} minutes` : "a minute"}.` },
    { status: 429, headers: { "Retry-After": String(r.retryAfter), "X-RateLimit-Limit": String(r.limit), "X-RateLimit-Remaining": "0" } },
  );
}

/** Today's AI generations paid by the server's key, all visitors combined. */
let budget = { day: "", used: 0 };

/**
 * May this request spend the server's own AI key? Per visitor and per day overall. When it
 * can't, the caller falls back to the built-in director rather than failing.
 */
export function spendServerAi(req: Request, caps: { daily?: number; perVisitor?: number } = {}): { ok: true } | { ok: false; reason: string } {
  if (!enabled()) return { ok: true };
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) budget = { day, used: 0 };
  // The admin's settings win over the environment.
  const cap = Math.max(0, caps.daily ?? (Number(process.env.INTROMAKER_AI_DAILY_BUDGET ?? 200) || 0));
  if (budget.used >= cap) return { ok: false, reason: "The demo's daily AI budget is used up" };
  if (!take("serverAi", clientKey(req), Date.now(), caps.perVisitor).ok) return { ok: false, reason: "You've used today's AI generations on this demo" };
  budget.used++;
  return { ok: true };
}

/** Today's server-paid AI generations (for the admin overview). */
export const serverAiUsedToday = () => (budget.day === new Date().toISOString().slice(0, 10) ? budget.used : 0);

/** For tests. */
export function resetLimits() {
  buckets.clear();
  budget = { day: "", used: 0 };
}
