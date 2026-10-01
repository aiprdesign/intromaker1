import { parse, type HTMLElement } from "node-html-parser";
import type { SiteData } from "@/engine/types";
import { captureSite } from "./capture";
import { networkProblem } from "./scrape";
import { assertPublicUrl, safeFetch, UrlError } from "./netguard";

/**
 * Marketplace listings (Amazon, eBay, Etsy, Walmart, AliExpress, Target, Best Buy, Shopify
 * stores): the product's title, brand, bullet points and full-size photos become a product
 * profile for a product video. Prices, ratings and reviews are left out (they change, and
 * they're claims), and so is everything of the marketplace's own (its logo, colours, page).
 */

export interface Market {
  id: string;
  name: string;
}

const MARKETS: { id: string; name: string; host: RegExp; path?: RegExp }[] = [
  { id: "amazon", name: "Amazon", host: /(^|\.)amazon\.[a-z.]{2,6}$/i, path: /\/(dp|gp\/product|gp\/aw\/d|d)\/[A-Z0-9]{10}/i },
  { id: "amazon", name: "Amazon", host: /^(amzn\.(to|eu|asia)|a\.co)$/i },
  { id: "ebay", name: "eBay", host: /(^|\.)ebay\.[a-z.]{2,6}$/i, path: /\/itm\//i },
  { id: "etsy", name: "Etsy", host: /(^|\.)etsy\.com$/i, path: /\/listing\/\d+/i },
  { id: "walmart", name: "Walmart", host: /(^|\.)walmart\.(com|ca)$/i, path: /\/ip\//i },
  { id: "aliexpress", name: "AliExpress", host: /(^|\.)aliexpress\.[a-z.]{2,6}$/i, path: /\/item\//i },
  { id: "target", name: "Target", host: /(^|\.)target\.com$/i, path: /\/p\//i },
  { id: "bestbuy", name: "Best Buy", host: /(^|\.)bestbuy\.(com|ca)$/i, path: /\/site\/|\/product\//i },
];

/** Which marketplace a listing URL is on (null for other sites). */
export function marketOf(raw: string): Market | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  for (const m of MARKETS) if (m.host.test(u.hostname) && (!m.path || m.path.test(u.pathname))) return { id: m.id, name: m.name };
  // Shopify-style stores: /products/<handle>.
  if (/^\/(?:collections\/[^/]+\/)?products\/[^/]+\/?$/i.test(u.pathname)) return { id: "shop", name: u.hostname.replace(/^www\./, "") };
  return null;
}

const BLOCKED = /captcha|robot check|automated access|enter the characters you see|pardon our interruption|access denied|are you a human|unusual traffic|verify you are human|px-captcha|security check/i;

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();

/** Full-size image URLs: marketplaces serve thumbnails with size codes in the address. */
export function fullSize(url: string): string {
  return url
    .replace(/\._[A-Za-z0-9,_+-]+_\.(jpe?g|png|webp)(\?.*)?$/i, ".$1") // Amazon ._AC_SX679_.
    .replace(/\/s-l\d+\.(jpe?g|png|webp)/i, "/s-l1600.$1") // eBay
    .replace(/\/il_\d+x[\dN]+\./i, "/il_fullxfull.") // Etsy
    .replace(/_\d+x\d+(q\d+)?\.(jpe?g|png|webp)(_\.webp)?$/i, ".$2"); // AliExpress
}

type Product = { title: string; brand: string; description: string; bullets: string[]; images: string[] };

/** schema.org Product data from the page's JSON-LD (most marketplaces and stores publish it). */
function jsonLdProduct(root: HTMLElement): Partial<Product> | null {
  const found: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Record<string, unknown>;
    const type = o["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product")) || type === "ProductGroup") found.push(o);
    if (o["@graph"]) walk(o["@graph"]);
  };
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(s.text));
    } catch {
      /* malformed block */
    }
  }
  const p = found[0];
  if (!p) return null;
  const img = (v: unknown): string[] =>
    typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(img) : v && typeof v === "object" ? img((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).contentUrl) : [];
  const brand = p.brand;
  return {
    title: typeof p.name === "string" ? clean(p.name) : "",
    brand: typeof brand === "string" ? clean(brand) : brand && typeof brand === "object" && typeof (brand as Record<string, unknown>).name === "string" ? clean((brand as Record<string, string>).name) : "",
    description: typeof p.description === "string" ? clean(p.description.replace(/<[^>]+>/g, " ")) : "",
    images: img(p.image),
  };
}

const meta = (root: HTMLElement, ...keys: string[]) => {
  for (const k of keys) {
    const v = root.querySelector(`meta[property="${k}"], meta[name="${k}"]`)?.getAttribute("content");
    if (v) return clean(v);
  }
  return "";
};

function readAmazon(root: HTMLElement, html: string): Partial<Product> {
  const byline = clean(root.querySelector("#bylineInfo")?.text ?? "");
  const brand = byline.match(/^Visit the (.+?) Store$/i)?.[1] ?? byline.match(/^Brand:\s*(.+)$/i)?.[1] ?? "";
  const bullets = root
    .querySelectorAll("#feature-bullets li span.a-list-item, #feature-bullets li")
    .map((el) => clean(el.text))
    .filter((t) => t.length > 8 && !/make sure this fits|see more product details/i.test(t));
  const images: string[] = [];
  for (const re of [/"hiRes":"(https:[^"]+)"/g, /"large":"(https:[^"]+)"/g]) {
    for (const m of html.matchAll(re)) images.push(m[1]);
    if (images.length) break;
  }
  const dyn = root.querySelector("#landingImage, #imgBlkFront")?.getAttribute("data-a-dynamic-image");
  if (!images.length && dyn) {
    try {
      images.push(...Object.keys(JSON.parse(dyn.replace(/&quot;/g, '"'))));
    } catch {
      /* ignore */
    }
  }
  const hires = root.querySelector("#landingImage")?.getAttribute("data-old-hires");
  if (hires) images.unshift(hires);
  return {
    title: clean(root.querySelector("#productTitle")?.text ?? ""),
    brand: clean(brand),
    bullets: [...new Set(bullets)],
    description: clean(root.querySelector("#productDescription")?.text ?? ""),
    images,
  };
}

function readEbay(root: HTMLElement, html: string): Partial<Product> {
  const images: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/https:\/\/i\.ebayimg\.com\/images\/g\/([A-Za-z0-9~_-]+)\/s-l\d+\.(?:jpe?g|png|webp)/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    images.push(m[0]);
  }
  // Item specifics: the brand, and feature lists the seller filled in.
  const specifics = new Map<string, string>();
  for (const row of root.querySelectorAll(".ux-labels-values, .ux-layout-section-evo__col")) {
    const label = clean(row.querySelector(".ux-labels-values__labels")?.text ?? "").replace(/:$/, "");
    const value = clean(row.querySelector(".ux-labels-values__values")?.text ?? "");
    if (label && value) specifics.set(label.toLowerCase(), value);
  }
  const bullets = ["features", "feature", "key features"]
    .flatMap((k) => (specifics.get(k) ?? "").split(/,|;|\|/))
    .map((s) => clean(s))
    .filter((s) => s.length > 2);
  return {
    title: clean(root.querySelector("h1.x-item-title__mainTitle, h1 .ux-textspans, h1")?.text ?? "").replace(/\s*\|\s*eBay$/i, ""),
    brand: specifics.get("brand") ?? "",
    bullets,
    images,
  };
}

function readAliExpress(html: string): Partial<Product> {
  const list = html.match(/"imagePathList":\[([^\]]+)\]/)?.[1];
  return { images: list ? [...list.matchAll(/"(https?:[^"]+)"/g)].map((m) => m[1]) : [] };
}

/** A Shopify store answers /products/<handle>.json with the product's own data. */
async function readShopify(url: URL): Promise<Partial<Product> | null> {
  const m = url.pathname.match(/\/products\/([^/]+)\/?$/i);
  if (!m) return null;
  try {
    const res = await safeFetch(`${url.origin}/products/${m[1]}.json`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const p = ((await res.json()) as { product?: { title?: string; vendor?: string; body_html?: string; images?: { src?: string }[] } }).product;
    if (!p?.title) return null;
    const body = p.body_html ?? "";
    const bullets = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => clean(x[1].replace(/<[^>]+>/g, " "))).filter((t) => t.length > 3);
    return {
      title: clean(p.title),
      brand: clean(p.vendor ?? ""),
      description: clean(body.replace(/<li[\s\S]*?<\/li>/gi, " ").replace(/<[^>]+>/g, " ")),
      bullets,
      images: (p.images ?? []).map((i) => i.src ?? "").filter(Boolean),
    };
  } catch {
    return null;
  }
}

/** "BRAND X Wireless Earbuds, 40H Playtime, IPX7 …" → "Wireless Earbuds" sized for a title. */
export function shortTitle(title: string, _brand = ""): string {
  // The brand stays: it's usually part of the product's name ("Aero Buds Pro").
  let t = clean(title.replace(/[【】[\]]/g, " "));
  t = t.split(/\s*(?:,|\||–|—|\s-\s|\(|;|:|\bwith\b|\bfor\b)\s*/i)[0] ?? t;
  const words = t.split(/\s+/).filter(Boolean);
  return words.slice(0, 7).join(" ") || clean(title).split(/\s+/).slice(0, 6).join(" ");
}

/** "LONG BATTERY LIFE: up to 40 hours…" / "【Long Battery】 up to…" → ["Long battery life", "Up to 40 hours…"]. */
export function splitBullet(b: string): [string, string] {
  const t = clean(b);
  const m = t.match(/^【([^】]{2,60})】\s*(.*)$/) ?? t.match(/^\[([^\]]{2,60})\]\s*(.*)$/) ?? t.match(/^([^:：.!?]{3,60})[:：]\s+(.*)$/) ?? t.match(/^([^–—]{3,50})\s[–—-]\s(.*)$/);
  const tidy = (words: string[]) => {
    const out = [...words];
    while (out.length > 1 && /^(for|and|with|to|of|the|a|an|in|on|or|your|by)$/i.test(out[out.length - 1])) out.pop();
    return out.join(" ");
  };
  // No heading of its own: the words before the first connector ("Wireless earbuds with …").
  const lead = t.split(/\s+/);
  const cut = lead.findIndex((w, i) => i >= 2 && /^(with|and|for|that|which|to|so|in|on)$/i.test(w));
  let title = m ? m[1].trim() : tidy(lead.slice(0, cut > 0 ? Math.min(cut, 5) : 4));
  const desc = m ? m[2].trim() : t;
  // ALL CAPS headings read as shouting: sentence case them, keeping model codes and acronyms (IPX5, USB).
  if (title === title.toUpperCase() && /[A-Z]{3}/.test(title))
    title = title
      .split(/\s+/)
      .map((w, i) => (/\d/.test(w) || w.length <= 3 ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
      .join(" ");
  title = title.replace(/[^\p{L}\p{N}\s&'+/.-]/gu, "").trim();
  // Short enough for a callout: up to the first connector ("Premium sound with deep bass" →
  // "Premium sound"), at most four words.
  const tw = title.split(/\s+/);
  const join = tw.findIndex((w, i) => i >= 2 && /^(with|and|for|that|to|in|on|so)$/i.test(w));
  if (join > 0) title = tidy(tw.slice(0, join));
  if (title.split(/\s+/).length > 4) title = tidy(title.split(/\s+/).slice(0, 4));
  return [title, desc.charAt(0).toUpperCase() + desc.slice(1)];
}

/** Read a listing page into a product profile (null when it isn't one). */
export function readListing(html: string, base: URL, market: Market, extra?: Partial<Product> | null): SiteData | null {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: false, noscript: false } });
  const ld = jsonLdProduct(root) ?? {};
  const own = market.id === "amazon" ? readAmazon(root, html) : market.id === "ebay" ? readEbay(root, html) : market.id === "aliexpress" ? readAliExpress(html) : {};
  const pick = (k: "title" | "brand" | "description") => extra?.[k] || own[k] || ld[k] || "";
  const title = pick("title") || meta(root, "og:title", "twitter:title").replace(/\s*[|:–-]\s*(Amazon|eBay|Etsy|Walmart|AliExpress|Target|Best Buy).*$/i, "");
  if (!title) return null;
  const brand = pick("brand");
  // A store's own bullet list (inside the product's description or feature block).
  const pageBullets = root
    .querySelectorAll('[class*="feature"] li, [class*="bullet"] li, [class*="highlight"] li, [class*="description"] li, [itemprop="description"] li, main ul li')
    .map((el) => clean(el.text))
    .filter((t) => t.split(/\s+/).length >= 2 && t.split(/\s+/).length <= 30 && !/cookie|sign in|log in|cart|checkout|shipping|returns|privacy/i.test(t));
  const bullets = (extra?.bullets?.length ? extra.bullets : own.bullets?.length ? own.bullets : pageBullets.length >= 2 ? [...new Set(pageBullets)] : []).slice(0, 8);
  const description = pick("description") || meta(root, "og:description", "description");
  const imgs = [...(extra?.images ?? []), ...(own.images ?? []), ...(ld.images ?? []), meta(root, "og:image")]
    .filter((s) => /^https?:\/\//i.test(s ?? "") || /^\/\//.test(s ?? ""))
    .map((s) => fullSize(s.startsWith("//") ? `https:${s}` : s))
    .filter((s) => !/sprite|logo|icon|badge|play-button|\.gif(\?|$)|\.svg(\?|$)/i.test(s));
  const images = [...new Set(imgs)].slice(0, 12);
  const product = shortTitle(title, brand);
  const parts = bullets.map(splitBullet);
  // Without bullets, the description's sentences carry the features.
  if (!parts.length && description) {
    for (const s of description.split(/(?<=[.!?])\s+/).slice(0, 4)) if (s.split(/\s+/).length >= 4) parts.push(splitBullet(s));
  }
  // Title Case headings ("Comfortable Fit") in sentence case, keeping names the listing itself
  // capitalises mid-sentence ("works with Alexa"), model codes and acronyms (IPX5, USB-C).
  const prose = `${description} ${parts.map((p) => p[1]).join(" ")}`;
  const proper = new Set([...prose.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]+)\b/g)].map((m) => m[1]));
  for (const p of parts) {
    const words = p[0].split(/\s+/);
    if (words.length > 1 && words.every((w) => /^[A-Z0-9]/.test(w)))
      p[0] = words.map((w, i) => (i === 0 || /\d|^[A-Z]{2,}|[a-z][A-Z]/.test(w) || proper.has(w) ? w : w.toLowerCase())).join(" ");
  }
  return {
    url: base.toString(),
    domain: base.hostname.replace(/^www\./, ""),
    name: brand && brand.length <= 30 ? brand : product.split(/\s+/).slice(0, 3).join(" "),
    tagline: product,
    description: description.slice(0, 400) || title,
    headlines: parts.map((p) => p[0]),
    features: parts.map((p) => p[1].slice(0, 160)),
    stats: [],
    testimonials: [],
    clientLogos: [],
    steps: [],
    pains: [],
    font: null,
    shots: { hero: null, full: null, sections: [] },
    cta: null,
    logo: null,
    icon: null,
    images,
    videos: [],
    themeColor: null,
    kind: "product",
    marketplace: market.name,
  };
}

const blockedError = (market: Market) =>
  new UrlError(
    `${market.name} didn't let us read this listing automatically (marketplaces often block it). Save the listing's photos and add them with "Add product photos", then describe the product in the prompt.`,
    "listing",
  );

/** Fetch and read a listing: a plain fetch first, a real browser when the marketplace blocks that. */
export async function scrapeListing(rawUrl: string, market: Market): Promise<SiteData> {
  const url = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  let html = "";
  let finalUrl = url;
  // A connection problem (the store is down) is reported as that, not as the marketplace blocking us.
  let down: UrlError | null = null;
  try {
    const res = await safeFetch(url, { headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-GB,en;q=0.9" } });
    finalUrl = res.url || url;
    if (res.ok) html = (await res.text()).slice(0, 4_000_000);
    else if (res.status === 404 || res.status === 410) throw new UrlError(`That ${market.name} listing wasn't found. It may have ended or moved; check the link.`, "notfound");
  } catch (e) {
    if (e instanceof UrlError && e.code === "notfound") throw e;
    if (e instanceof UrlError && ["dns", "invalid"].includes(e.code)) throw e;
    const p = e instanceof UrlError ? e : networkProblem(e, new URL(url));
    if (["refused", "timeout", "tls", "unreachable"].includes(p.code)) down = p;
  }
  // Short links (amzn.to) land on the listing itself.
  const landed = marketOf(finalUrl) ?? market;
  const shop = landed.id === "shop" ? await readShopify(new URL(finalUrl)) : null;
  if ((!html || BLOCKED.test(html.slice(0, 20_000))) && !shop) {
    await assertPublicUrl(finalUrl);
    const live = await captureSite(finalUrl).catch(() => null);
    if (live?.html && !BLOCKED.test(live.html.slice(0, 20_000))) {
      html = live.html;
      finalUrl = live.finalUrl || finalUrl;
    } else throw down ?? blockedError(landed);
  }
  const site = readListing(html || "<html></html>", new URL(finalUrl), landed, shop);
  if (!site) throw blockedError(landed);
  if (!site.images.length)
    throw new UrlError(`We read the ${landed.name} listing but couldn't get its photos. Save them and add them with "Add product photos".`, "listing");
  return site;
}
