import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { appendFile, chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VideoPlan } from "@/engine/types";
import { readAiConfig, type AiConfig } from "./ai";
import { cookieOf, isHttps, noStore, sameOrigin } from "./http";
import { stripeLink, type BillingLinks } from "./stripe-links";
import { DEFAULT_LIMITS, PLANS_VERSION, readLimits, type PlanId, type PlanLimits } from "./plans";
import { clientKey } from "./ratelimit";

/**
 * The owner's admin area: a log of the films visitors make, and the server's AI settings.
 *
 * Enabled only when ADMIN_PASSWORD is set; without it nothing is logged. Sessions are signed, HttpOnly, SameSite=Strict cookies
 * whose key is derived from the password, so changing the password signs everyone out. Data lives
 * next to the captures (INTROMAKER_DATA_DIR, the persistent volume), in `admin/`:
 *   films.jsonl     one summary line per film event (generated, remade, exported)
 *   films/<id>.json the storyboard of each event, for preview
 *   settings.json   server AI provider, key, model and daily budget (file mode 600)
 * Visitors appear as a salted hash of their address, never the address itself.
 */

const ROOT = process.env.INTROMAKER_DATA_DIR ? join(process.env.INTROMAKER_DATA_DIR, "admin") : join(tmpdir(), "intromaker-admin");
const INDEX = join(ROOT, "films.jsonl");
const FILMS = join(ROOT, "films");
const SETTINGS = join(ROOT, "settings.json");
const SALT_FILE = join(ROOT, "salt");
/** Film events kept (oldest dropped first). */
const MAX_FILMS = Math.max(100, Number(process.env.INTROMAKER_FILMS_MAX ?? 3000) || 3000);
const MAX_PLAN_BYTES = 400_000;

export const COOKIE = "im_admin";
const SESSION_MS = 12 * 60 * 60_000;

// ───────────────────────── Auth ─────────────────────────

export const adminEnabled = () => (process.env.ADMIN_PASSWORD ?? "").length > 0;

let keyCache: { pw: string; key: Buffer } | null = null;
function sessionKey(): Buffer {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  if (keyCache?.pw !== pw) keyCache = { pw, key: scryptSync(pw, "intromaker-admin-session", 32) };
  return keyCache.key;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time password check. */
export function checkPassword(given: unknown): boolean {
  if (!adminEnabled() || typeof given !== "string" || !given) return false;
  return timingSafeEqual(digest(given), digest(process.env.ADMIN_PASSWORD!));
}

export function newSession(now = Date.now()) {
  const exp = now + SESSION_MS;
  const body = `${exp}.${randomBytes(12).toString("base64url")}`;
  return { token: `${body}.${createHmac("sha256", sessionKey()).update(body).digest("base64url")}`, maxAge: SESSION_MS / 1000 };
}

export function validSession(token: string | undefined, now = Date.now()): boolean {
  if (!adminEnabled() || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !(Number(parts[0]) > now)) return false;
  const expected = createHmac("sha256", sessionKey()).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], "base64url");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Guard an admin API route: null when the request is signed in (and same-origin for writes),
 * otherwise the response to send. 404 while the admin area is off, so it isn't advertised.
 */
export function requireAdmin(req: Request): Response | null {
  if (!adminEnabled()) return Response.json({ error: "Not found" }, { status: 404 });
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  if (!validSession(cookieOf(req, COOKIE))) return Response.json({ error: "Sign in required" }, { status: 401 });
  return null;
}

export function sessionCookie(req: Request, token: string, maxAge: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps(req) ? "; Secure" : ""}`;
}

export { noStore, sameOrigin };

// ───────────────────────── Film log ─────────────────────────

export type FilmKind = "generated" | "remake" | "take" | "exported";

export interface FilmEntry {
  id: string;
  at: number;
  kind: FilmKind;
  /** Salted hash of the visitor's address (groups one visitor's films). */
  visitor: string;
  source: "prompt" | "site";
  prompt?: string;
  url?: string;
  title: string;
  engine: string;
  aspect: string;
  seconds: number;
  scenes: number;
  skills: string[];
  template?: string;
  /** Export preset, for exports. */
  preset?: string;
  /** The signed-in account that made it (none for visitors without an account). */
  account?: { id: string; email: string };
}

async function ensureDir() {
  await mkdir(FILMS, { recursive: true });
}

let saltCache: string | null = null;
async function salt() {
  if (saltCache) return saltCache;
  await ensureDir();
  try {
    saltCache = (await readFile(SALT_FILE, "utf8")).trim();
  } catch {
    saltCache = randomBytes(16).toString("hex");
    await writeFile(SALT_FILE, saltCache, { mode: 0o600 });
  }
  return saltCache;
}

export async function visitorOf(req: Request) {
  return createHash("sha256")
    .update(`${await salt()}|${clientKey(req)}`)
    .digest("hex")
    .slice(0, 10);
}

let writes = 0;

/**
 * Log one film event. Never throws: a full disk or a read-only volume must not break making films.
 */
export async function recordFilm(
  req: Request,
  e: { kind: FilmKind; plan: VideoPlan; engine: string; prompt?: string; url?: string; preset?: string; account?: { id: string; email: string } | null },
) {
  // Nothing is kept unless the owner has turned the admin area on.
  if (!adminEnabled()) return;
  try {
    // Inline images (data: URLs) are what make a plan large; the preview works without them.
    let planJson = JSON.stringify(e.plan);
    if (planJson.length > MAX_PLAN_BYTES) planJson = JSON.stringify(e.plan, (_k, v) => (typeof v === "string" && v.startsWith("data:") && v.length > 2000 ? "" : v));
    if (planJson.length > MAX_PLAN_BYTES) return;
    await ensureDir();
    const id = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
    const entry: FilmEntry = {
      id,
      at: Date.now(),
      kind: e.kind,
      visitor: await visitorOf(req),
      source: e.url ? "site" : "prompt",
      prompt: e.prompt?.trim().slice(0, 400) || undefined,
      url: e.url?.slice(0, 300) || undefined,
      title: (e.plan.title || "Untitled").slice(0, 120),
      engine: e.engine.slice(0, 80),
      aspect: e.plan.aspect,
      seconds: Math.round(e.plan.scenes.reduce((a, s) => a + (s.duration || 0), 0) * 10) / 10,
      scenes: e.plan.scenes.length,
      skills: [...new Set(e.plan.scenes.map((s) => s.skill))].slice(0, 20),
      template: e.plan.template,
      preset: e.preset?.slice(0, 40),
      account: e.account ? { id: e.account.id, email: e.account.email } : undefined,
    };
    await writeFile(join(FILMS, `${id}.json`), planJson);
    await appendFile(INDEX, JSON.stringify(entry) + "\n");
    if (++writes % 50 === 0) void prune();
  } catch (err) {
    console.error("[admin] could not log film:", (err as Error).message);
  }
}

async function readIndex(): Promise<FilmEntry[]> {
  try {
    const text = await readFile(INDEX, "utf8");
    const out: FilmEntry[] = [];
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        /* a torn last line after a crash */
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function writeIndex(entries: FilmEntry[]) {
  const tmp = `${INDEX}.tmp`;
  await writeFile(tmp, entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : ""));
  await rename(tmp, INDEX);
}

/** Keep the newest MAX_FILMS events. */
async function prune() {
  const all = await readIndex();
  if (all.length <= MAX_FILMS) return;
  const drop = all.slice(0, all.length - MAX_FILMS);
  await writeIndex(all.slice(all.length - MAX_FILMS));
  await Promise.all(drop.map((e) => rm(join(FILMS, `${e.id}.json`), { force: true })));
}

export interface FilmQuery {
  q?: string;
  kind?: string;
  visitor?: string;
  /** An account id: only that account's films. */
  account?: string;
  page?: number;
  size?: number;
}

export async function listFilms(query: FilmQuery) {
  const all = (await readIndex()).reverse();
  const q = query.q?.trim().toLowerCase();
  const filtered = all.filter(
    (e) =>
      (!query.kind || e.kind === query.kind) &&
      (!query.visitor || e.visitor === query.visitor) &&
      (!query.account || e.account?.id === query.account) &&
      (!q || [e.title, e.prompt, e.url, e.engine, e.template, e.account?.email, ...e.skills].some((x) => x?.toLowerCase().includes(q))),
  );
  const size = Math.min(100, Math.max(1, query.size ?? 30));
  const page = Math.max(0, query.page ?? 0);
  // Overview across everything logged.
  const day = 86_400_000;
  const now = Date.now();
  const count = <K extends string>(pick: (e: FilmEntry) => K | K[] | undefined) => {
    const m = new Map<string, number>();
    for (const e of all) for (const k of ([] as (K | undefined)[]).concat(pick(e))) if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const stats = {
    total: all.length,
    today: all.filter((e) => now - e.at < day).length,
    week: all.filter((e) => now - e.at < 7 * day).length,
    visitors: new Set(all.map((e) => e.visitor)).size,
    accounts: new Set(all.map((e) => e.account?.id).filter(Boolean)).size,
    keywords: keywordsOf(all).slice(0, 24),
    exported: all.filter((e) => e.kind === "exported").length,
    fromSites: all.filter((e) => e.source === "site").length,
    engines: count((e) => (e.kind === "exported" ? undefined : e.engine.startsWith("builtin") ? "Built-in director" : e.engine.split(" · ")[0])).slice(0, 6),
    skills: count((e) => e.skills).slice(0, 10),
    templates: count((e) => e.template).slice(0, 6),
    perDay: Array.from({ length: 14 }, (_, i) => {
      const start = new Date(now - (13 - i) * day);
      start.setHours(0, 0, 0, 0);
      const s = start.getTime();
      return { day: start.toISOString().slice(0, 10), films: all.filter((e) => e.at >= s && e.at < s + day).length };
    }),
  };
  return { items: filtered.slice(page * size, page * size + size), total: filtered.length, page, size, stats };
}

export async function getFilm(id: string) {
  if (!/^[a-z0-9]+-[a-f0-9]{8}$/.test(id)) return null;
  const entry = (await readIndex()).find((e) => e.id === id);
  if (!entry) return null;
  try {
    const plan = JSON.parse(await readFile(join(FILMS, `${id}.json`), "utf8")) as VideoPlan;
    return { entry, plan };
  } catch {
    return { entry, plan: null };
  }
}

/** Words people use in their prompts, most used first (a word counts once per film). */
const STOPWORDS = new Set(
  ("the and for with from that this your our their its into onto about over under than then them they you are was were has have had " +
    "will can just very more most some any not but all each every also only like make made makes making create want need please " +
    "video videos intro intros film films clip one two three new get use using who what when where which how why out off per via " +
    "a an of to in on at by as is be it or my we us me so do if no up").split(" "),
);
function keywordsOf(entries: FilmEntry[]): [string, number][] {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (!e.prompt || e.kind === "exported") continue;
    const words = new Set((e.prompt.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).map((w) => w.replace(/['’]s$/, "")));
    for (const w of words) if (w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)) m.set(w, (m.get(w) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Per account: how many films it made, when it last made one, and its latest prompts or sites. */
export async function filmsByAccount() {
  const out = new Map<string, { made: number; lastAt: number; recent: string[] }>();
  for (const e of (await readIndex()).reverse()) {
    if (!e.account) continue;
    const a = out.get(e.account.id) ?? { made: 0, lastAt: e.at, recent: [] };
    a.made++;
    const said = e.url ?? e.prompt;
    if (said && a.recent.length < 3 && !a.recent.includes(said)) a.recent.push(said);
    out.set(e.account.id, a);
  }
  return out;
}

/** A deleted account: its films stay in the log, no longer linked to its email. */
export async function forgetAccount(id: string) {
  const all = await readIndex();
  if (!all.some((e) => e.account?.id === id)) return;
  await ensureDir();
  await writeIndex(all.map((e) => (e.account?.id === id ? { ...e, account: undefined } : e)));
}

export async function deleteFilms(ids: string[] | "all") {
  const all = await readIndex();
  const drop = ids === "all" ? all : all.filter((e) => ids.includes(e.id));
  const keep = ids === "all" ? [] : all.filter((e) => !ids.includes(e.id));
  await ensureDir();
  await writeIndex(keep);
  await Promise.all(drop.map((e) => rm(join(FILMS, `${e.id}.json`), { force: true })));
  return drop.length;
}

// ───────────────────────── Server AI settings ─────────────────────────

export interface AdminSettings {
  /** The AI the server's director uses when a visitor brings no key of their own. */
  ai?: AiConfig;
  /** AI generations per day on the server's key, all visitors combined. */
  dailyBudget?: number;
  /** Per visitor per day. */
  perVisitor?: number;
  /** Plan limits (overrides of DEFAULT_LIMITS). */
  plans?: Record<PlanId, PlanLimits>;
  /** Set when the owner saved the plans (PLANS_VERSION), so they're read exactly as saved. */
  plansVersion?: number;
  /** How the Pro price reads on the pricing page, e.g. "$9 / month". */
  proPrice?: string;
  /** Where visitors reach the owner (upgrades, password resets). */
  contactEmail?: string;
  /** Stripe Payment Links and customer portal (see billing.ts). */
  billing?: BillingLinks;
  updatedAt?: number;
}

let settingsCache: { at: number; value: AdminSettings } | null = null;

export async function readSettings(): Promise<AdminSettings> {
  if (settingsCache && Date.now() - settingsCache.at < 5_000) return settingsCache.value;
  let value: AdminSettings = {};
  try {
    const raw = JSON.parse(await readFile(SETTINGS, "utf8"));
    value = {
      ai: readAiConfig(raw.ai) ?? undefined,
      dailyBudget: Number.isFinite(raw.dailyBudget) ? raw.dailyBudget : undefined,
      perVisitor: Number.isFinite(raw.perVisitor) ? raw.perVisitor : undefined,
      plans: raw.plans ? readLimits(raw.plans, { legacy: raw.plansVersion !== PLANS_VERSION }) : undefined,
      plansVersion: raw.plans && raw.plansVersion === PLANS_VERSION ? PLANS_VERSION : undefined,
      proPrice: typeof raw.proPrice === "string" ? raw.proPrice.slice(0, 40) : undefined,
      contactEmail: typeof raw.contactEmail === "string" ? raw.contactEmail.slice(0, 120) : undefined,
      billing: raw.billing
        ? {
            monthlyLink: stripeLink(raw.billing.monthlyLink, "pay"),
            yearlyLink: stripeLink(raw.billing.yearlyLink, "pay"),
            portalLink: stripeLink(raw.billing.portalLink, "portal"),
            yearlyPrice: typeof raw.billing.yearlyPrice === "string" ? raw.billing.yearlyPrice.slice(0, 40) : undefined,
          }
        : undefined,
      updatedAt: raw.updatedAt,
    };
  } catch {
    /* none saved */
  }
  settingsCache = { at: Date.now(), value };
  return value;
}

/** Save settings: the given fields replace the saved ones, the rest are kept. */
export async function writeSettings(patch: AdminSettings) {
  settingsCache = null;
  const next = { ...(await readSettings()), ...patch };
  await ensureDir();
  const tmp = `${SETTINGS}.tmp`;
  await writeFile(tmp, JSON.stringify({ ...next, updatedAt: Date.now() }, null, 2), { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, SETTINGS);
  settingsCache = null;
}

/**
 * The AI the server pays for: the admin's saved provider, else ANTHROPIC_API_KEY from the
 * environment, else none (the built-in director).
 */
export async function serverAi(): Promise<{ ai: AiConfig; source: "admin" | "env" } | null> {
  const s = await readSettings();
  if (s.ai && s.ai.provider !== "builtin") return { ai: s.ai, source: "admin" };
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return { ai: { provider: "anthropic", mode: "balanced", images: true }, source: "env" };
  return null;
}

/** The limits in force for each plan (the owner's, else the defaults). */
export async function planLimits(): Promise<Record<PlanId, PlanLimits>> {
  return (await readSettings()).plans ?? DEFAULT_LIMITS;
}

/** A key shown back to the admin: enough to recognise it, never the whole thing. */
export const maskKey = (key?: string) => (key ? (key.length > 10 ? `${key.slice(0, 4)}…${key.slice(-4)}` : "••••") : "");
