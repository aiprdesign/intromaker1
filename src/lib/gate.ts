import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Site PIN: when the owner turns it on in Admin → Site PIN (or sets the INTROMAKER_SITE_PIN
 * variable where the site is hosted, e.g. Railway → Variables), visitors enter a PIN before they
 * see the site (src/proxy.ts sends them to /unlock). Addresses on the allow list (Admin, or
 * INTROMAKER_SITE_PIN_ALLOW) skip the PIN.
 *
 * The PIN is kept as a salted scrypt hash in `admin/gate.json` (file mode 600), never in clear and
 * never sent back. Unlocking sets a signed, HttpOnly cookie whose key is replaced whenever the PIN
 * changes, so a new PIN locks out everyone who unlocked with the old one.
 */

const ROOT = process.env.INTROMAKER_DATA_DIR ? join(process.env.INTROMAKER_DATA_DIR, "admin") : join(tmpdir(), "intromaker-admin");
const FILE = join(ROOT, "gate.json");

export const GATE_COOKIE = "pi_gate";
/** How long an unlocked browser stays unlocked. */
export const GATE_MAX_AGE = 30 * 24 * 3600;
/** At most this many allowed addresses. */
const MAX_ALLOW = 50;

/** What's saved from Admin. */
interface Stored {
  on: boolean;
  salt?: string;
  hash?: string;
  /** Signs the unlock cookie; new with each PIN. */
  key?: string;
  /** Addresses that skip the PIN. */
  allow: string[];
  updatedAt: number;
}

/** The PIN in force (from Admin or the environment). */
export interface Gate {
  on: boolean;
  /** Set by INTROMAKER_SITE_PIN: on whatever Admin says. */
  env?: boolean;
  salt: string;
  hash: string;
  key: string;
  /** Admin's list and INTROMAKER_SITE_PIN_ALLOW together. */
  allow: string[];
  updatedAt: number;
}

const hashPin = (pin: string, salt: string) => scryptSync(pin, salt, 32).toString("hex");

/** A clean address list: valid IPv4 / IPv6 addresses, no duplicates. */
export function cleanAllow(list: unknown): string[] {
  const raw = Array.isArray(list) ? list : typeof list === "string" ? list.split(/[\s,;]+/) : [];
  return [...new Set(raw.map((x) => String(x).trim()).filter((x) => isIP(x) !== 0))].slice(0, MAX_ALLOW);
}

/** INTROMAKER_SITE_PIN_ALLOW: comma- or space-separated addresses. */
export const envAllow = () => cleanAllow(process.env.INTROMAKER_SITE_PIN_ALLOW ?? "");

// The proxy and the app's routes can be separate module copies: each re-reads the file when its
// timestamp changes, so a change in Admin applies on the next request everywhere.
let stored: { mtime: number; value: Stored | null } | null = null;

async function readStored(): Promise<Stored | null> {
  let mtime = -1;
  try {
    mtime = (await stat(FILE)).mtimeMs;
  } catch {
    /* never saved */
  }
  if (stored && stored.mtime === mtime) return stored.value;
  let value: Stored | null = null;
  if (mtime >= 0) {
    try {
      const raw = JSON.parse(await readFile(FILE, "utf8"));
      value = {
        on: raw.on === true,
        salt: typeof raw.salt === "string" ? raw.salt : undefined,
        hash: typeof raw.hash === "string" ? raw.hash : undefined,
        key: typeof raw.key === "string" ? raw.key : undefined,
        allow: cleanAllow(raw.allow),
        updatedAt: Number(raw.updatedAt) || 0,
      };
    } catch {
      /* unreadable: as if never saved */
    }
  }
  stored = { mtime, value };
  return value;
}

/** Admin's saved address list (for the Admin page). */
export async function savedAllow() {
  return (await readStored())?.allow ?? [];
}

/**
 * The PIN from the environment (INTROMAKER_SITE_PIN), if set: the site is private with it, and the
 * Admin switch can't turn it off (remove the variable to open the site). Its cookie key comes from
 * the PIN itself, so a new value locks out browsers unlocked with the old one, across restarts.
 */
let envCache: { pin: string; salt: string; hash: string; key: string } | null = null;
function envPinGate(pin: string) {
  if (envCache?.pin !== pin) {
    // (Hashing is slow on purpose, so it's done once per value.)
    const salt = createHmac("sha256", "prodintro-site-pin-salt").update(pin).digest("hex").slice(0, 32);
    envCache = { pin, salt, hash: hashPin(pin, salt), key: createHmac("sha256", "prodintro-site-pin").update(pin).digest("hex") };
  }
  return envCache;
}

export async function readGate(): Promise<Gate | null> {
  const s = await readStored();
  const allow = [...new Set([...(s?.allow ?? []), ...envAllow()])];
  const envPin = process.env.INTROMAKER_SITE_PIN?.trim();
  if (envPin) {
    const e = envPinGate(envPin);
    return { on: true, env: true, salt: e.salt, hash: e.hash, key: e.key, allow, updatedAt: 0 };
  }
  if (!s?.hash || !s.salt || !s.key) return null;
  return { on: s.on, salt: s.salt, hash: s.hash, key: s.key, allow, updatedAt: s.updatedAt };
}

/** A PIN the owner can set: 4–32 characters (digits like 2020, or any letters and symbols). */
export function pinProblem(pin: string): string | null {
  if (pin.length < 4) return "The PIN needs at least 4 characters.";
  if (pin.length > 32) return "The PIN can be up to 32 characters.";
  return null;
}

/**
 * Save from Admin: turn the PIN on or off, set a new PIN (which signs out every unlocked browser)
 * and the allowed addresses. With INTROMAKER_SITE_PIN set, only the address list can change here.
 */
export async function saveGate(opts: { on?: boolean; pin?: string; allow?: string[] }): Promise<void> {
  const env = !!process.env.INTROMAKER_SITE_PIN?.trim();
  if (env && opts.pin) throw new Error("The PIN is set by the INTROMAKER_SITE_PIN variable. Change or remove it where the site is hosted (Railway → Variables).");
  const cur: Stored = (await readStored()) ?? { on: false, allow: [], updatedAt: 0 };
  const next: Stored = { ...cur, updatedAt: Date.now() };
  if (opts.allow) next.allow = cleanAllow(opts.allow);
  if (!env && opts.on !== undefined) next.on = opts.on;
  if (opts.pin) {
    next.salt = randomBytes(16).toString("hex");
    next.hash = hashPin(opts.pin, next.salt);
    next.key = randomBytes(32).toString("hex");
  }
  if (next.on && !next.hash) throw new Error("Choose a PIN first.");
  await mkdir(ROOT, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(next), { mode: 0o600 });
  await chmod(tmp, 0o600);
  await rename(tmp, FILE);
  stored = null;
}

export function pinMatches(gate: Gate, pin: string) {
  const a = Buffer.from(hashPin(pin, gate.salt), "hex");
  const b = Buffer.from(gate.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The unlock cookie's value for the current PIN. */
export function gateToken(gate: Gate) {
  return createHmac("sha256", gate.key).update("unlocked").digest("base64url");
}

export function validGateToken(gate: Gate, token: string | undefined) {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(gateToken(gate));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The Set-Cookie header that unlocks this browser. */
export function gateCookie(gate: Gate, https: boolean) {
  return `${GATE_COOKIE}=${gateToken(gate)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GATE_MAX_AGE}${https ? "; Secure" : ""}`;
}
