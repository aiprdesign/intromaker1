import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateV4(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export class UrlError extends Error {}

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
    throw new UrlError("That address is not reachable.");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UrlError(`Couldn't resolve ${host}.`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new UrlError("That address is not reachable.");
  return url;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 IntroMaker/1.0";

/** fetch() that re-validates every redirect hop. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "*/*", ...(init.headers ?? {}) },
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  throw new UrlError("Too many redirects.");
}
