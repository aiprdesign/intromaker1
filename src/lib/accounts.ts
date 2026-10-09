import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { VideoPlan } from "@/engine/types";
import { forgetAccount, planLimits } from "./admin";
import { cookieOf, isHttps, sameOrigin } from "./http";
import type { PlanId, PlanLimits } from "./plans";
import { isCountry, REGIONS, regionLabel } from "./regions";

/**
 * Visitor accounts: email + password, saved films, and a plan (Free or Pro).
 *
 * Stored on the persistent volume (INTROMAKER_DATA_DIR), in `accounts/`:
 *   users/<id>.json          the account (password as an scrypt hash, never the password)
 *   emails.json              email → id
 *   films/<id>/<film>.json   saved films
 *   secret                   the session signing key (mode 600)
 * Right for one server instance (writes are serialised in-process), like the rest of the app.
 *
 * Sessions are signed HttpOnly cookies naming the account and its session version: changing the
 * password, a reset by the owner, or "sign out everywhere" bumps the version and ends every session.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const ROOT = process.env.INTROMAKER_DATA_DIR ? join(process.env.INTROMAKER_DATA_DIR, "accounts") : join(tmpdir(), "intromaker-accounts");
const USERS = join(ROOT, "users");
const FILMS = join(ROOT, "films");
const EMAILS = join(ROOT, "emails.json");
const SECRET = join(ROOT, "secret");
const RESETS = join(ROOT, "resets.json");

export const USER_COOKIE = "im_user";
const SESSION_MS = 30 * 86_400_000;
const MAX_FILM_BYTES = 600_000;
const MAX_THUMB = 120_000;

export interface User {
  id: string;
  email: string;
  pass: string;
  /** Session version: bumping it signs the account out everywhere. */
  sv: number;
  plan: PlanId;
  /** The little sign-up asks for: a first name, a country (ISO code) and a state or region. */
  firstName?: string;
  country?: string;
  region?: string;
  createdAt: number;
  lastLoginAt?: number;
  disabled?: boolean;
  /** Asked the owner for Pro (no payment provider yet). */
  upgradeRequestedAt?: number;
  /** Must choose a new password (after a reset by the owner). */
  mustChangePassword?: boolean;
  usage?: { aiMonth?: string; ai?: number; importDay?: string; imports?: number; exports?: number };
  /** Who set the plan: the owner by hand, or Stripe (only a Stripe plan is taken back by Stripe). */
  planSource?: "admin" | "stripe";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: "active" | "past_due" | "canceling" | "canceled";
  /** When the paid period ends (ms). */
  periodEnd?: number;
  /** The newest Stripe event applied (seconds), so a late retry of an older one is skipped. */
  stripeEventAt?: number;
  /** Whether their Stripe customer is in live mode (false: test mode), for the dashboard link. */
  stripeLive?: boolean;
  /** A payment of theirs was refunded or disputed: for the owner to look at. */
  billingFlag?: "refunded" | "disputed";
}

/** What an intro was made from (the studio's Create fields), so opening it fills them in again. */
export interface FilmInputs {
  url?: string;
  prompt?: string;
  photos?: string[];
  length?: string;
  story?: string;
}

export interface SavedFilm {
  id: string;
  title: string;
  plan: VideoPlan;
  thumb?: string;
  inputs?: FilmInputs;
  createdAt: number;
  updatedAt: number;
}

export class AccountError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// ───────────────────────── Storage ─────────────────────────

/** Writes run one at a time: read-modify-write of the email index and counters stays consistent. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function writeJson(path: string, value: unknown) {
  const tmp = `${path}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
  await rename(tmp, path);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

const validId = (id: string) => /^[a-f0-9-]{36}$/.test(id);
const userPath = (id: string) => join(USERS, `${id}.json`);

export async function getUser(id: string) {
  return validId(id) ? readJson<User>(userPath(id)) : null;
}

async function saveUser(u: User) {
  await mkdir(USERS, { recursive: true });
  await writeJson(userPath(u.id), u);
}

async function emailIndex() {
  return (await readJson<Record<string, string>>(EMAILS)) ?? {};
}

export const normEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase().slice(0, 254) : "");
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// ───────────────────────── Passwords ─────────────────────────

const KDF = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, KDF);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(pw: string, stored: string) {
  const [, salt, key] = stored.split("$");
  if (!salt || !key) return false;
  const got = await scrypt(pw, Buffer.from(salt, "base64"), 32, KDF);
  const want = Buffer.from(key, "base64");
  return got.length === want.length && timingSafeEqual(got, want);
}

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "Use at least 8 characters for the password.";
  if (pw.length > 200) return "That password is too long.";
  return null;
}

// A fixed dummy hash, so a login for an unknown email takes as long as one for a real account.
let dummy: string | null = null;

// ───────────────────────── Accounts ─────────────────────────

/** Sign-up's profile: a first name, a country and, optionally, a state or region. */
export interface Profile {
  firstName?: unknown;
  country?: unknown;
  region?: unknown;
}

/** The profile, checked and tidied (throws an AccountError naming what to fix). */
export function readProfile(p: Profile): { firstName: string; country: string; region?: string } {
  const firstName = typeof p.firstName === "string" ? p.firstName.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (!firstName || !/^[\p{L}][\p{L}\p{M}' .-]*$/u.test(firstName)) throw new AccountError("Enter your first name.");
  if (!isCountry(p.country)) throw new AccountError("Choose your country.");
  const listed = REGIONS[p.country];
  const region = typeof p.region === "string" ? p.region.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  // (The state or region is optional; one given for a country with a list must be on it.)
  if (region && listed && !listed.includes(region)) throw new AccountError(`Choose your ${regionLabel(p.country).toLowerCase()} from the list.`);
  if (region && !/^[\p{L}\p{M}\p{N}' .,()-]+$/u.test(region)) throw new AccountError("Enter a valid state or region.");
  return { firstName, country: p.country, region: region || undefined };
}

export async function createUser(emailRaw: unknown, password: unknown, profile?: Profile): Promise<User> {
  const email = normEmail(emailRaw);
  if (!emailOk(email)) throw new AccountError("Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) throw new AccountError(problem);
  // (Accounts made by the owner or by tests may come without a profile.)
  const who = profile ? readProfile(profile) : {};
  const pass = await hashPassword(password as string);
  return serial(async () => {
    const index = await emailIndex();
    if (index[email]) throw new AccountError("An account with this email already exists. Sign in instead.", 409);
    const u: User = { id: randomUUID(), email, pass, sv: 1, plan: "free", ...who, createdAt: Date.now(), lastLoginAt: Date.now() };
    await saveUser(u);
    index[email] = u.id;
    await mkdir(ROOT, { recursive: true });
    await writeJson(EMAILS, index);
    return u;
  });
}

/**
 * Count one exported video against the account's allowance (Free: a few, for commercial use).
 * Returns the count after this one, or an AccountError (402) when the allowance is used up.
 */
export async function recordExport(u: User): Promise<{ used: number; limit: number }> {
  const limit = (await limitsFor(u)).exports;
  let used = 0;
  let over = false;
  await updateUser(u.id, (x) => {
    const n = x.usage?.exports ?? 0;
    if (n >= limit) {
      over = true;
      used = n;
      return;
    }
    x.usage = { ...(x.usage ?? {}), exports: n + 1 };
    used = n + 1;
  });
  if (over) throw new AccountError(`You've used your ${limit} free video${limit === 1 ? "" : "s"}. Upgrade to Pro for unlimited videos.`, 402);
  return { used, limit };
}

export async function login(emailRaw: unknown, password: unknown): Promise<User> {
  const email = normEmail(emailRaw);
  const id = (await emailIndex())[email];
  const u = id ? await getUser(id) : null;
  dummy ??= await hashPassword(randomBytes(12).toString("hex"));
  const ok = await verifyPassword(typeof password === "string" ? password : "", u?.pass ?? dummy);
  if (!u || !ok) throw new AccountError("Wrong email or password.", 401);
  if (u.disabled) throw new AccountError("This account is disabled. Contact the site owner.", 403);
  // Saved through updateUser, so a webhook landing during the password check isn't undone.
  return (await updateUser(u.id, (x) => void (x.lastLoginAt = Date.now()))) ?? u;
}

export async function changePassword(u: User, current: unknown, next: unknown) {
  if (!u.mustChangePassword && !(await verifyPassword(typeof current === "string" ? current : "", u.pass))) throw new AccountError("Your current password is wrong.", 401);
  const problem = passwordProblem(next);
  if (problem) throw new AccountError(problem);
  const pass = await hashPassword(next as string);
  const fresh = await updateUser(u.id, (x) => {
    x.pass = pass;
    x.sv += 1;
    x.mustChangePassword = false;
  });
  if (!fresh) throw new AccountError("Account not found.", 404);
  return fresh;
}

export async function deleteUser(id: string) {
  const u = await getUser(id);
  if (!u) return false;
  await serial(async () => {
    const index = await emailIndex();
    delete index[u.email];
    await writeJson(EMAILS, index);
    await rm(userPath(id), { force: true });
    await rm(join(FILMS, id), { recursive: true, force: true });
  });
  await forgetAccount(id);
  return true;
}

/** A Stripe subscription that still charges (active, retrying a failed payment, or cancelling at period end). */
export const subscribed = (u: User) => u.planSource === "stripe" && (u.billingStatus === "active" || u.billingStatus === "past_due" || u.billingStatus === "canceling");

/** Update an account (owner actions, usage counters). */
export async function updateUser(id: string, fn: (u: User) => void) {
  return serial(async () => {
    const u = await getUser(id);
    if (!u) return null;
    fn(u);
    await saveUser(u);
    return u;
  });
}

/** The owner resets a password: a one-time password to hand over; the user picks a new one. */
export async function resetPassword(id: string) {
  const temp = randomBytes(9).toString("base64url");
  const pass = await hashPassword(temp);
  const u = await updateUser(id, (x) => {
    x.pass = pass;
    x.sv += 1;
    x.mustChangePassword = true;
  });
  return u ? temp : null;
}

export async function listUsers() {
  let names: string[] = [];
  try {
    names = await readdir(USERS);
  } catch {
    /* none yet */
  }
  const users = (await Promise.all(names.filter((n) => n.endsWith(".json")).map((n) => readJson<User>(join(USERS, n))))).filter((u): u is User => !!u);
  const films = await Promise.all(users.map((u) => countFilms(u.id)));
  return users.map((u, i) => ({ ...adminUser(u), films: films[i], disabled: !!u.disabled })).sort((a, b) => b.createdAt - a.createdAt);
}

export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    plan: u.plan,
    firstName: u.firstName,
    country: u.country,
    region: u.region,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    upgradeRequestedAt: u.upgradeRequestedAt,
    mustChangePassword: !!u.mustChangePassword,
    usage: u.usage ?? {},
    planSource: u.planSource,
    billingStatus: u.billingStatus,
    periodEnd: u.periodEnd,
  };
}

/** For the owner's view: also the Stripe customer, to open it in the Stripe dashboard. */
export function adminUser(u: User) {
  return { ...publicUser(u), stripeCustomerId: u.stripeCustomerId, stripeLive: u.stripeLive, billingFlag: u.billingFlag };
}

export async function findUserByEmail(email: string) {
  const id = (await emailIndex())[normEmail(email)];
  return id ? getUser(id) : null;
}

export async function findUserByStripeCustomer(customer: string) {
  let names: string[] = [];
  try {
    names = await readdir(USERS);
  } catch {
    return null;
  }
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    const u = await readJson<User>(join(USERS, n));
    if (u?.stripeCustomerId === customer) return u;
  }
  return null;
}

// ───────────────────────── Password reset by email ─────────────────────────

/** How long a password-reset link works. */
export const RESET_MINUTES = 30;
type ResetRecord = { uid: string; sv: number; exp: number };
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * A one-time password-reset token for this email's account, or null when there's no (enabled)
 * account. Only a hash of the token is kept; it lasts RESET_MINUTES, works once, and stops working
 * once the password changes another way (it's tied to the account's session version).
 */
export async function createReset(emailRaw: unknown): Promise<{ token: string; user: User } | null> {
  const email = normEmail(emailRaw);
  if (!emailOk(email)) throw new AccountError("Enter a valid email address.");
  const u = await findUserByEmail(email);
  if (!u || u.disabled) return null;
  const token = randomBytes(32).toString("base64url");
  await serial(async () => {
    const now = Date.now();
    const all = (await readJson<Record<string, ResetRecord>>(RESETS)) ?? {};
    // (Expired ones go, and so do this account's older links: only the newest works.)
    for (const [k, v] of Object.entries(all)) if (v.exp < now || v.uid === u.id) delete all[k];
    all[tokenHash(token)] = { uid: u.id, sv: u.sv, exp: now + RESET_MINUTES * 60_000 };
    await mkdir(ROOT, { recursive: true });
    await writeJson(RESETS, all);
  });
  return { token, user: u };
}

/** Set a new password with a reset link's token. The token is spent, other sessions end. */
export async function useReset(token: unknown, next: unknown): Promise<User> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw new AccountError("This reset link isn't valid. Ask for a new one.", 400);
  const problem = passwordProblem(next);
  if (problem) throw new AccountError(problem);
  const rec = await serial(async () => {
    const all = (await readJson<Record<string, ResetRecord>>(RESETS)) ?? {};
    const k = tokenHash(token);
    const r = all[k];
    if (r) {
      delete all[k];
      await writeJson(RESETS, all);
    }
    return r;
  });
  if (!rec) throw new AccountError("This reset link has already been used or isn't valid. Ask for a new one.", 400);
  if (rec.exp < Date.now()) throw new AccountError("This reset link has expired. Ask for a new one.", 400);
  const u = await getUser(rec.uid);
  if (!u || u.sv !== rec.sv) throw new AccountError("This reset link is out of date. Ask for a new one.", 400);
  if (u.disabled) throw new AccountError("This account is disabled. Contact the site owner.", 403);
  const pass = await hashPassword(next as string);
  const fresh = await updateUser(u.id, (x) => {
    x.pass = pass;
    x.sv += 1;
    x.mustChangePassword = false;
    x.lastLoginAt = Date.now();
  });
  if (!fresh) throw new AccountError("Account not found.", 404);
  return fresh;
}

// ───────────────────────── Sessions ─────────────────────────

let secretCache: Buffer | null = null;
async function secret() {
  if (secretCache) return secretCache;
  await mkdir(ROOT, { recursive: true });
  const saved = await readFile(SECRET).catch(() => null);
  if (saved && saved.length >= 32) return (secretCache = saved);
  const fresh = randomBytes(32);
  await writeFile(SECRET, fresh, { mode: 0o600 });
  return (secretCache = fresh);
}

const sign = async (body: string) => createHmac("sha256", await secret()).update(body).digest("base64url");

export async function sessionFor(u: User, now = Date.now()) {
  const body = `${u.id}.${u.sv}.${now + SESSION_MS}`;
  return { token: `${body}.${await sign(body)}`, maxAge: SESSION_MS / 1000 };
}

export function userCookie(req: Request, token: string, maxAge: number) {
  return `${USER_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? "; Secure" : ""}`;
}

/** The signed-in account for this request, or null. */
export async function currentUser(req: Request, now = Date.now()): Promise<User | null> {
  const token = cookieOf(req, USER_COOKIE);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, sv, exp, sig] = parts;
  if (!(Number(exp) > now)) return null;
  const want = Buffer.from(await sign(`${id}.${sv}.${exp}`));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const u = await getUser(id);
  if (!u || u.disabled || String(u.sv) !== sv) return null;
  return u;
}

/** Guard an account API route: the user, or the response to send. */
export async function requireUser(req: Request): Promise<User | Response> {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-origin request refused" }, { status: 403 });
  const u = await currentUser(req);
  return u ?? Response.json({ error: "Sign in first." }, { status: 401 });
}

// ───────────────────────── Plans and usage ─────────────────────────

export async function limitsFor(u: User | null): Promise<PlanLimits> {
  return (await planLimits())[u?.plan ?? "free"];
}

const month = () => new Date().toISOString().slice(0, 7);
const day = () => new Date().toISOString().slice(0, 10);

/** Use one AI-directed film from the account's monthly allowance, if any is left. */
export async function spendAi(u: User): Promise<boolean> {
  const limit = (await limitsFor(u)).aiPerMonth;
  let ok = false;
  await updateUser(u.id, (x) => {
    const usage = (x.usage ??= {});
    if (usage.aiMonth !== month()) Object.assign(usage, { aiMonth: month(), ai: 0 });
    if ((usage.ai ?? 0) < limit) {
      usage.ai = (usage.ai ?? 0) + 1;
      ok = true;
    }
  });
  return ok;
}

/** Use one website import from the account's daily allowance. */
export async function spendImport(u: User): Promise<boolean> {
  const limit = (await limitsFor(u)).importsPerDay;
  let ok = false;
  await updateUser(u.id, (x) => {
    const usage = (x.usage ??= {});
    if (usage.importDay !== day()) Object.assign(usage, { importDay: day(), imports: 0 });
    if ((usage.imports ?? 0) < limit) {
      usage.imports = (usage.imports ?? 0) + 1;
      ok = true;
    }
  });
  return ok;
}

/** This month's and today's usage, reset when the period rolls over. */
export function usageOf(u: User) {
  const usage = u.usage ?? {};
  return { ai: usage.aiMonth === month() ? (usage.ai ?? 0) : 0, imports: usage.importDay === day() ? (usage.imports ?? 0) : 0, exports: usage.exports ?? 0 };
}

// ───────────────────────── Saved films ─────────────────────────

const filmDir = (uid: string) => join(FILMS, uid);
const validFilm = (id: string) => /^[a-z0-9]{8,32}$/.test(id);

async function countFilms(uid: string) {
  try {
    return (await readdir(filmDir(uid))).filter((n) => n.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

export async function listSavedFilms(uid: string) {
  let names: string[] = [];
  try {
    names = await readdir(filmDir(uid));
  } catch {
    return [];
  }
  const films = await Promise.all(names.filter((n) => n.endsWith(".json")).map((n) => readJson<SavedFilm>(join(filmDir(uid), n))));
  return films
    .filter((f): f is SavedFilm => !!f)
    .map(({ plan, inputs: _inputs, ...rest }) => ({ ...rest, aspect: plan.aspect, scenes: plan.scenes.length, seconds: Math.round(plan.scenes.reduce((a, s) => a + s.duration, 0) * 10) / 10 }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSavedFilm(uid: string, id: string) {
  return validFilm(id) ? readJson<SavedFilm>(join(filmDir(uid), `${id}.json`)) : null;
}

/** Save a film: a new one (within the plan's limit), or an update of one the account owns. */
/** Only plain, short values: a link, the description, uploaded photo links and two choices. */
export function sanitizeInputs(raw: unknown): FilmInputs | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const out: FilmInputs = {
    url: str(r.url, 2000),
    prompt: str(r.prompt, 1000),
    photos: Array.isArray(r.photos) ? r.photos.filter((x): x is string => typeof x === "string" && /^(\/api\/shot\/|https?:\/\/)/.test(x) && x.length <= 600).slice(0, 12) : undefined,
    length: typeof r.length === "string" && /^[a-z]{2,12}$/.test(r.length) ? r.length : undefined,
    story: typeof r.story === "string" && /^[a-z]{2,12}$/.test(r.story) ? r.story : undefined,
  };
  if (!out.photos?.length) delete out.photos;
  return Object.values(out).some((v) => v !== undefined) ? out : undefined;
}

export async function saveFilm(u: User, input: { id?: string; title?: string; plan: VideoPlan; thumb?: string; inputs?: unknown }) {
  const planJson = JSON.stringify(input.plan);
  if (planJson.length > MAX_FILM_BYTES) throw new AccountError("This video is too large to save (it holds very large images).", 413);
  const thumb = typeof input.thumb === "string" && input.thumb.startsWith("data:image/") && input.thumb.length <= MAX_THUMB ? input.thumb : undefined;
  return serial(async () => {
    await mkdir(filmDir(u.id), { recursive: true });
    const existing = input.id ? await getSavedFilm(u.id, input.id) : null;
    // Saving again keeps a title you gave it (a rename) unless a new one is passed.
    const title = (input.title || existing?.title || input.plan.title || "Untitled").trim().slice(0, 120);
    if (!existing) {
      const limit = (await limitsFor(u)).savedFilms;
      if ((await countFilms(u.id)) >= limit)
        throw new AccountError(`Your ${u.plan === "pro" ? "Pro" : "Free"} plan keeps ${limit} saved intro${limit === 1 ? "" : "s"}. Delete one, or upgrade to keep more.`, 402);
    }
    const now = Date.now();
    const film: SavedFilm = {
      id: existing?.id ?? randomBytes(8).toString("hex"),
      title,
      plan: input.plan,
      thumb: thumb ?? existing?.thumb,
      inputs: sanitizeInputs(input.inputs) ?? existing?.inputs,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await writeJson(join(filmDir(u.id), `${film.id}.json`), film);
    return film;
  });
}

export async function renameFilm(uid: string, id: string, title: unknown) {
  const f = await getSavedFilm(uid, id);
  if (!f || typeof title !== "string" || !title.trim()) return null;
  f.title = title.trim().slice(0, 120);
  f.updatedAt = Date.now();
  await serial(() => writeJson(join(filmDir(uid), `${id}.json`), f));
  return f;
}

export async function deleteSavedFilm(uid: string, id: string) {
  if (!validFilm(id)) return false;
  await rm(join(filmDir(uid), `${id}.json`), { force: true });
  return true;
}
