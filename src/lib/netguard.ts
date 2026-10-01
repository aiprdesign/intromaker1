import { lookup as lookupCb, type LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * Server-side fetch of user-supplied URLs, guarded against SSRF: only http(s), no credentials,
 * and every hop (including redirects) must resolve to a public IP address.
 * Set INTROMAKER_ALLOW_PRIVATE_URLS=1 to allow private hosts for local development.
 */

const allowPrivate = () => process.env.INTROMAKER_ALLOW_PRIVATE_URLS === "1";

function isPrivateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** An IPv6 address as its eight 16-bit groups (accepts "::" shorthand and a dotted IPv4 tail). */
function v6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    s = s.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail ? tail.split(":") : [];
  const fill = s.includes("::") ? 8 - h.length - t.length : 0;
  const groups = [...h, ...Array(Math.max(0, fill)).fill("0"), ...t].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const g = v6Groups(ip);
  if (!g) return true; // can't classify it: don't fetch it
  const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) carry an IPv4 address.
  if (zeros(5) && (g[5] === 0xffff || g[5] === 0)) return g[6] === 0 && g[7] <= 1 ? true : isPrivateV4(v4(g[6], g[7]));
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateV4(v4(g[6], g[7]));
  return (
    (g[0] & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (g[0] & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (g[0] & 0xff00) === 0xff00 || // multicast
    (g[0] === 0x2001 && g[1] === 0x0db8) // documentation
  );
}

/** Why a website couldn't be used. The message is written for the visitor. */
export type SiteProblem = "invalid" | "unreachable" | "dns" | "refused" | "timeout" | "tls" | "notfound" | "blocked" | "busy" | "server" | "notpage" | "parked" | "empty" | "redirects" | "listing";

export class UrlError extends Error {
  constructor(
    message: string,
    public code: SiteProblem = "invalid",
    /** Another address worth trying (e.g. the site's home page after a 404). */
    public suggestion?: string,
  ) {
    super(message);
  }
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UrlError("Only http(s) URLs are supported.");
  if (url.username || url.password) throw new UrlError("URLs with credentials are not allowed.");
  if (allowPrivate()) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UrlError("That address is not reachable.", "unreachable");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UrlError(`We couldn't find ${host}. Check the spelling of the address.`, "dns");
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UrlError("That address is not reachable.", "unreachable");
  return url;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 IntroMaker/1.0";

/**
 * DNS rebinding guard: the address is checked again at connect time, and the connection goes to
 * exactly the address that was checked. (Otherwise a hostile DNS server could answer the check
 * with a public IP and the real connection with 127.0.0.1.)
 */
export const pinned = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      lookupCb(hostname, { ...options, all: true }, (err, addrs: LookupAddress[]) => {
        if (err) return callback(err, "", 4);
        if (!allowPrivate() && (!addrs.length || addrs.some((a) => isPrivateIp(a.address)))) {
          return callback(new UrlError("That address is not reachable.", "unreachable"), "", 4);
        }
        if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addrs);
        callback(null, addrs[0].address, addrs[0].family);
      });
    },
  },
});

/** fetch() that re-validates every redirect hop and pins each connection to a checked address. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    const url = await assertPublicUrl(current);
    const res = (await undiciFetch(url, {
      ...(init as Parameters<typeof undiciFetch>[1]),
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "*/*", ...((init.headers as Record<string, string>) ?? {}) },
      signal: init.signal ?? AbortSignal.timeout(15_000),
      dispatcher: pinned,
    })) as unknown as Response;
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new UrlError("That address redirects too many times to open.", "redirects");
}

/**
 * fetch() for user-supplied API endpoints (a custom AI or voice server): on a hosted server each
 * connection is pinned to a checked public address, like safeFetch. Set `local` when the server
 * runs on the user's own machine and may reach local model servers.
 */
export function guardedFetch(url: string, init: RequestInit & { local?: boolean } = {}): Promise<Response> {
  const { local, ...rest } = init;
  if (local || allowPrivate()) return fetch(url, rest);
  return undiciFetch(url, { ...(rest as Parameters<typeof undiciFetch>[1]), dispatcher: pinned }) as unknown as Promise<Response>;
}
