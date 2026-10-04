import { createHash } from "node:crypto";
import { clientKey, enabled } from "./ratelimit";

/**
 * Sign-in lockout: after INTROMAKER_LOGIN_TRIES wrong passwords (default 3) from one address within
 * 15 minutes, that address can't sign in (admin or accounts) for INTROMAKER_LOGIN_BLOCK_MIN minutes
 * (default 60). A correct password clears the count. Kept in memory only (never written to disk),
 * like the rate limits; the owner can lift a block in Admin → Setup. On with the rate limits.
 */

const WINDOW_MS = 15 * 60_000;
export const maxTries = () => Math.max(1, Math.floor(Number(process.env.INTROMAKER_LOGIN_TRIES ?? 3)) || 3);
const blockMs = () => Math.min(24 * 60, Math.max(1, Number(process.env.INTROMAKER_LOGIN_BLOCK_MIN ?? 60) || 60)) * 60_000;

type Fails = { count: number; first: number };
type Block = { until: number; at: number; where: "admin" | "account"; fails: number };
const fails = new Map<string, Fails>();
const blocks = new Map<string, Block>();

/** An address's id for the admin page (the address itself stays on the server). */
const idOf = (ip: string) => createHash("sha256").update(`lockout|${ip}`).digest("hex").slice(0, 16);

/** "203.0.113.50" → "203.0.113.x"; IPv6 keeps its first four groups. */
function masked(ip: string) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, ".x");
  if (ip.includes(":")) return `${ip.split(":").slice(0, 4).join(":")}:…`;
  return ip === "direct" ? "every visitor (no proxy address: check INTROMAKER_PROXY_HOPS)" : ip;
}

function blocked(ip: string, now = Date.now()) {
  const b = blocks.get(ip);
  if (b && b.until <= now) {
    blocks.delete(ip);
    return null;
  }
  return b ?? null;
}

const minutes = (ms: number) => {
  const m = Math.ceil(ms / 60_000);
  return m > 1 ? `${m} minutes` : "a minute";
};

/** Before checking a password: a 429 when this address is blocked, else null. */
export function lockedOut(req: Request, now = Date.now()): Response | null {
  if (!enabled()) return null;
  const b = blocked(clientKey(req), now);
  if (!b) return null;
  const retry = Math.ceil((b.until - now) / 1000);
  return Response.json(
    { error: `Too many wrong passwords from your network. Signing in is blocked for ${minutes(b.until - now)}.`, blocked: true },
    { status: 429, headers: { "Retry-After": String(retry), "Cache-Control": "no-store" } },
  );
}

/**
 * After a wrong password: count it, and block the address on the last try. Returns the message
 * to show (with the tries left, or the block).
 */
export function wrongPassword(req: Request, where: "admin" | "account", base: string, now = Date.now()): { message: string; blocked: boolean } {
  if (!enabled()) return { message: base, blocked: false };
  const ip = clientKey(req);
  let f = fails.get(ip);
  if (!f || now - f.first > WINDOW_MS) f = { count: 0, first: now };
  f.count++;
  fails.set(ip, f);
  const left = maxTries() - f.count;
  if (left <= 0) {
    fails.delete(ip);
    blocks.set(ip, { until: now + blockMs(), at: now, where, fails: f.count });
    return { message: `${base} Too many wrong passwords: signing in from your network is blocked for ${minutes(blockMs())}.`, blocked: true };
  }
  return { message: `${base} ${left} ${left === 1 ? "try" : "tries"} left before signing in is blocked for ${minutes(blockMs())}.`, blocked: false };
}

/** After a correct password: the address starts afresh. */
export function signedIn(req: Request) {
  fails.delete(clientKey(req));
}

/** For the owner: the addresses blocked right now (masked). */
export function listBlocks(now = Date.now()) {
  const out: { id: string; address: string; where: "admin" | "account"; at: number; until: number; fails: number }[] = [];
  for (const [ip, b] of blocks) {
    if (b.until <= now) {
      blocks.delete(ip);
      continue;
    }
    out.push({ id: idOf(ip), address: masked(ip), where: b.where, at: b.at, until: b.until, fails: b.fails });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** The owner lifts a block (by its id from listBlocks). */
export function unblock(id: string) {
  for (const ip of blocks.keys())
    if (idOf(ip) === id) {
      blocks.delete(ip);
      fails.delete(ip);
      return true;
    }
  return false;
}

/** For tests. */
export function resetLockout() {
  fails.clear();
  blocks.clear();
}
