import { parse, type HTMLElement } from "node-html-parser";
import type { SiteData } from "@/engine/types";
import { captureSite } from "./capture";
import { networkProblem } from "./scrape";
import { amazonApi, amazonImageByAsin, ebayApi, titleFromLink, type ApiProduct } from "./marketplaces";
import { assertPublicUrl, safeFetch, UrlError } from "./netguard";

/**
 * Marketplace listings (Amazon, eBay, Etsy, Walmart, AliExpress, Target, Best Buy, Shopify
 * stores): the product's title, brand, bullet points and full-size photos become a product
 * profile for a product video. Prices, ratings and reviews are left out (they change, and
 * they're claims), and so is everything of the marketplace's own (its logo, colours, page).
 */

export { canonicalListing, marketOf, type Market } from "./markets";
import { canonicalListing, marketOf, type Market } from "./markets";

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

/**
 * schema.org Product data from the page's JSON-LD (most marketplaces and stores publish it): the
 * page's own product. Products inside lists (related items, "customers also bought", a category
 * grid) are someone else's; with several left, the one named like the page's title wins.
 */
function jsonLdProduct(root: HTMLElement, title = ""): Partial<Product> | null {
  const found: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Record<string, unknown>;
    const type = o["@type"];
    if (type === "ItemList" || type === "OfferCatalog" || type === "CollectionPage") return;
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
  const words = (x: unknown) => new Set(String(x ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const want = words(title);
  const overlap = (o: Record<string, unknown>) => [...words(o.name)].filter((w) => want.has(w)).length;
  const p = want.size ? [...found].sort((a, b) => overlap(b) - overlap(a))[0] : found[0];
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
  // Amazon's markup changes often: every field has several places to come from.
  const byline = clean(root.querySelector("#bylineInfo, #brand, a#brand")?.text ?? "");
  const overview = new Map<string, string>();
  for (const row of root.querySelectorAll("#productOverview_feature_div tr, #poExpander tr, #productDetails_techSpec_section_1 tr")) {
    const cells = row.querySelectorAll("td, th").map((c) => clean(c.text));
    if (cells.length >= 2 && cells[0] && cells[1]) overview.set(cells[0].toLowerCase(), cells[1]);
  }
  const brand =
    byline.match(/^Visit the (.+?) Store$/i)?.[1] ?? byline.match(/^Brand:\s*(.+)$/i)?.[1] ?? overview.get("brand") ?? overview.get("manufacturer") ?? (byline.length <= 30 ? byline : "");
  const bullets = root
    .querySelectorAll(
      "#feature-bullets li span.a-list-item, #feature-bullets li, #featurebullets_feature_div li span.a-list-item, #feature-bullets-btf li, #productFactsDesktopExpander li span.a-list-item, #productFactsDesktop_feature_div li",
    )
    .map((el) => clean(el.text))
    .filter((t) => t.length > 8 && !/make sure this fits|see more product details|›\s*see more/i.test(t));
  const images: string[] = [];
  // The product's own photos live in its image block ('colorImages'); other widgets on the page
  // (sponsored and "also bought" carousels) carry image data too, so the block is read first.
  const block = html.match(/['"]colorImages['"]\s*:\s*\{\s*['"]initial['"]\s*:\s*(\[[\s\S]*?\])\s*\}/)?.[1] ?? "";
  for (const src of [block, html])
    for (const re of [/"hiRes":"(https:[^"]+)"/g, /"large":"(https:[^"]+)"/g, /"mainUrl":"(https:[^"]+)"/g]) {
      if (images.length) break;
      for (const m of src.matchAll(re)) images.push(m[1]);
    }
  const dyn = root.querySelector("#landingImage, #imgBlkFront, #main-image")?.getAttribute("data-a-dynamic-image");
  if (!images.length && dyn) {
    try {
      images.push(...Object.keys(JSON.parse(dyn.replace(/&quot;/g, '"'))));
    } catch {
      /* ignore */
    }
  }
  const main = root.querySelector("#landingImage, #imgTagWrapperId img, #main-image, #imgBlkFront");
  const hires = main?.getAttribute("data-old-hires") || main?.getAttribute("src");
  if (hires && /^https:/.test(hires)) images.unshift(hires);
  // The title: the product title element, else the page's own title tag ("Amazon.com: X : Category").
  const fromTag = clean(root.querySelector('meta[name="title"]')?.getAttribute("content") ?? root.querySelector("title")?.text ?? "")
    .replace(/^Amazon(\.[a-z.]+)?\s*:\s*/i, "")
    .replace(/\s*:\s*[^:]*$/, "");
  return {
    title: clean(root.querySelector("#productTitle, #title")?.text ?? "") || fromTag,
    brand: clean(brand),
    bullets: [...new Set(bullets)],
    description: clean(root.querySelector("#productDescription")?.text ?? "") || clean(root.querySelector('meta[name="description"]')?.getAttribute("content") ?? ""),
    images,
  };
}

function readEbay(root: HTMLElement, html: string): Partial<Product> {
  const images: string[] = [];
  const seen = new Set<string>();
  // The item's own picture panel (similar and sponsored items elsewhere on the page use the same
  // image host); the whole page only when the panel isn't there.
  const panel = root.querySelector('[data-testid="ux-image-carousel"], .ux-image-carousel-container, .ux-image-carousel, #PicturePanel, .picture-panel')?.toString() ?? "";
  for (const m of (panel || html).matchAll(/https:\/\/i\.ebayimg\.com\/images\/g\/([A-Za-z0-9~_-]+)\/s-l\d+\.(?:jpe?g|png|webp)/g)) {
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

/** Store and marketplace chrome, never product copy: buying, delivery, account, reviews, prices. */
const STORE_CHROME =
  /cookie|sign in|log ?in|account|wish ?list|(add to|view) (cart|bag|basket)|buy (it )?now|checkout|in stock|out of stock|ships? (from|in|to|within)|sold by|seller|free (shipping|delivery|returns)|shipping|delivery|returns?\b|refund|warranty|guarantee|price|\$|€|£|¥|₹|\breviews?\b|ratings?\b|stars?\b|questions?|answers?|size guide|klarna|afterpay|affirm|pay in \d|financing|coupon|promo code|\bdeal|\bsale\b|subscribe|newsletter|privacy|terms|customer service|help center|track (your )?order|gift card|share|compare|sponsored|similar|related|also (bought|viewed|like)|recently viewed/i;

/** Parts of a page that aren't the product: menus, footers, related and sponsored products, reviews, Q&A. */
const NOISE_WORDS = new Set([
  "related", "similar", "sponsored", "sponsor", "recommendations", "recommended", "recommend", "recs", "upsell", "crosssell", "alsobought",
  "footer", "nav", "navbar", "navigation", "breadcrumb", "breadcrumbs", "menu", "megamenu", "sidebar", "newsletter", "cookie", "cookies",
  "reviews", "review", "ratings", "questions", "faq", "qna", "recently", "viewed", "compare", "comparison", "advert", "ads", "promo",
]);
const NOISE_HEADING = /customers (who|also)|frequently bought|related|similar|sponsored|you (may|might) (also )?like|compare with|more (items|products|from)|recently viewed|reviews|questions|best ?sellers|trending|shop (the|by)|explore more|inspired by/i;

/**
 * The product's own part of the page: menus, footers, related and sponsored products, reviews and
 * Q&A taken out, then the block around the product's title (its schema.org Product element, else
 * the closest container with the title in it that has the product's copy). The page's main area
 * when there's no title to anchor on.
 */
function productScope(root: HTMLElement, title: string): HTMLElement {
  const doc = parse(root.toString(), { comment: false, blockTextElements: { script: false, style: false, noscript: false } });
  for (const el of doc.querySelectorAll("header, footer, nav, aside, form, iframe, dialog, [role=navigation], [role=banner], [role=contentinfo], [role=complementary], [aria-hidden=true]")) el.remove();
  const h1 = doc.querySelector("h1");
  for (const el of doc.querySelectorAll("section, div, ul, ol")) {
    if (!el.parentNode) continue;
    if (h1 && el.querySelector("h1")) continue;
    const tag = `${el.getAttribute("id") ?? ""} ${el.getAttribute("class") ?? ""} ${el.getAttribute("data-testid") ?? ""} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
    const words = tag.split(/[^a-z]+/).filter(Boolean);
    const head = el.querySelector("h2, h3, h4");
    const firstHeading = head && el.text.trim().startsWith(head.text.trim().slice(0, 20)) ? head.text : "";
    if (words.some((w) => NOISE_WORDS.has(w)) || /also[-_ ]?bought|you[-_ ]?may|recently[-_ ]?viewed/.test(tag) || (firstHeading && NOISE_HEADING.test(firstHeading))) el.remove();
  }
  const product = doc.querySelector('[itemtype*="schema.org/Product"]');
  if (product) return product;
  if (h1 && title) {
    // Up from the title to the block that holds the product's copy too (its bullets or description).
    let el: HTMLElement | null = h1.parentNode as HTMLElement | null;
    while (el && el.parentNode) {
      if (el.querySelectorAll("li").length >= 2 || el.querySelector('[class*="description"], [itemprop="description"]')) return el;
      el = el.parentNode as HTMLElement | null;
    }
  }
  return doc.querySelector("main, [role=main], #main, article") ?? doc;
}

/** "BRAND X Wireless Earbuds, 40H Playtime, IPX7 …" → "Wireless Earbuds" sized for a title. */
export function shortTitle(title: string, _brand = ""): string {
  // The brand stays: it's usually part of the product's name ("Aero Buds Pro").
  let t = clean(title.replace(/[【】[\]]/g, " "));
  t = t.split(/\s*(?:,|\||–|—|\s-\s|\(|;|:|\bwith\b|\bfor\b)\s*/i)[0] ?? t;
  const words = t.split(/\s+/).filter(Boolean);
  // Up to the product's own noun ("… Hair Clipper", "… Wireless Earbuds"): a
  // heading, not the listing's keyword string. (Without one, the brand and model: four words.)
  const head = words.findIndex((w, i) => i >= 1 && i <= 6 && PRODUCT_NOUNS.test(w.replace(/[^A-Za-z-]/g, "")));
  return (head >= 0 ? words.slice(0, head + 1) : words.slice(0, 4)).join(" ") || clean(title).split(/\s+/).slice(0, 4).join(" ");
}

/** What a listing's title is a name of: the noun its product name ends on. */
const PRODUCT_NOUNS =
  /^(clippers?|trimmers?|shavers?|razors?|earbuds|headphones|headsets?|speakers?|chargers?|cables?|cases?|covers?|bottles?|mugs?|cups?|tumblers?|lamps?|lights?|chairs?|desks?|tables?|bags?|backpacks?|wallets?|watch(es)?|rings?|necklaces?|bracelets?|earrings?|shoes|sneakers|boots|jackets?|shirts?|hoodies?|dress(es)?|kits?|sets?|cameras?|drones?|keyboards?|mice|mouse|monitors?|stands?|holders?|mounts?|mats?|pillows?|blankets?|knives|knife|pans?|pots?|blenders?|kettles?|toys?|games?|books?|creams?|serums?|oils?|shampoos?|brush(es)?|dryers?|straighteners?|purifiers?|humidifiers?|fans?|heaters?|trackers?|phones?|tablets?|laptops?|routers?|projectors?|scales?|toothbrush(es)?|organi[sz]ers?|racks?|shelves|shelf|rugs?|curtains?|sheets?|towels?|candles?|diffusers?|grinders?|makers?|machines?|cookers?|fryers?|ovens?|grills?|bikes?|scooters?|helmets?|gloves?|glasses|sunglasses|perfumes?|lipsticks?|palettes?|supplements?|vitamins?|leashes?|collars?|feeders?|beds?)$/i;

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
  const pageTitle = clean(root.querySelector("h1")?.text ?? "") || meta(root, "og:title", "twitter:title");
  const ld = jsonLdProduct(root, pageTitle) ?? {};
  const own = market.id === "amazon" ? readAmazon(root, html) : market.id === "ebay" ? readEbay(root, html) : market.id === "aliexpress" ? readAliExpress(html) : {};
  const pick = (k: "title" | "brand" | "description") => extra?.[k] || own[k] || ld[k] || "";
  const title = pick("title") || meta(root, "og:title", "twitter:title").replace(/\s*[|:–-]\s*(Amazon|eBay|Etsy|Walmart|AliExpress|Target|Best Buy).*$/i, "");
  if (!title) return null;
  const brand = pick("brand");
  // A store's own bullet list, from the product's own block (never related products, reviews,
  // the store's menus or footer).
  const scope = productScope(root, title);
  const pageBullets = scope
    .querySelectorAll('[class*="feature"] li, [class*="bullet"] li, [class*="highlight"] li, [class*="description"] li, [itemprop="description"] li, ul li')
    .map((el) => clean(el.text))
    .filter((t) => t.split(/\s+/).length >= 2 && t.split(/\s+/).length <= 30 && !STORE_CHROME.test(t));
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

/** Where the listing's product code and storefront are, for the APIs and image failsafe. */
function listingIds(url: string) {
  const u = new URL(url);
  const amazon = u.hostname.match(/(?:^|\.)amazon\.([a-z.]{2,6})$/)?.[1];
  const asin = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase();
  const ebay = u.hostname.match(/(?:^|\.)ebay\.([a-z.]{2,6})$/)?.[1];
  const item = u.pathname.match(/\/itm\/(\d{6,})/)?.[1];
  return { amazon, asin, ebay, item };
}

/** The marketplace's own API, when its keys are configured (the reliable route). */
async function fromApi(url: string): Promise<ApiProduct | null> {
  const id = listingIds(url);
  if (id.amazon && id.asin) return amazonApi(id.asin, id.amazon);
  if (id.ebay && id.item) return ebayApi(id.item, id.ebay);
  return null;
}

/**
 * Last resort when the page can't be read: the product name from the link and, for Amazon, the
 * main photo from Amazon's image server by its code. The film is made from that, and the studio
 * asks for more photos and the features.
 */
async function fromLink(url: string, rawUrl: string, market: Market): Promise<SiteData | null> {
  const id = listingIds(url);
  const image = id.asin ? await amazonImageByAsin(id.asin, id.amazon) : null;
  if (!image) return null;
  const title = titleFromLink(rawUrl) || "Your product";
  const site = readListing("<html></html>", new URL(url), market, { title, brand: "", description: "", bullets: [], images: [image] });
  return site ? { ...site, partial: true } : null;
}

/**
 * Read a listing, with failsafes: the marketplace's API when configured, then the page itself,
 * then a real browser, then what the link carries (name and, for Amazon, the main photo).
 */
export async function scrapeListing(rawUrl: string, market: Market): Promise<SiteData> {
  // The plain product link (https://www.amazon.com/dp/ASIN), not the long one with tracking.
  let url = canonicalListing(rawUrl);
  // 1. The marketplace's API.
  const api = await fromApi(url);
  if (api && api.images.length) {
    const site = readListing("<html></html>", new URL(url), market, api);
    if (site) return site;
  }
  // 2. The page.
  let html = "";
  let finalUrl = url;
  // A connection problem (the store is down) is reported as that, not as the marketplace blocking us.
  let down: UrlError | null = null;
  try {
    const res = await safeFetch(url, { headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-GB,en;q=0.9" } });
    finalUrl = canonicalListing(res.url || url);
    if (res.ok) html = (await res.text()).slice(0, 4_000_000);
    else if (res.status === 404 || res.status === 410) throw new UrlError(`That ${market.name} listing wasn't found. It may have ended or moved; check the link.`, "notfound");
  } catch (e) {
    if (e instanceof UrlError && e.code === "notfound") throw e;
    if (e instanceof UrlError && ["dns", "invalid"].includes(e.code)) throw e;
    const p = e instanceof UrlError ? e : networkProblem(e, new URL(url));
    if (["refused", "timeout", "tls", "unreachable"].includes(p.code)) down = p;
  }
  // Short links (amzn.to) land on the listing itself.
  url = finalUrl;
  const landed = marketOf(finalUrl) ?? market;
  const shop = landed.id === "shop" ? await readShopify(new URL(finalUrl)) : null;
  const blocked = (h: string) => !h || BLOCKED.test(h.slice(0, 20_000));
  if (blocked(html) && !shop) {
    // 3. A real browser.
    await assertPublicUrl(finalUrl);
    const live = await captureSite(finalUrl).catch(() => null);
    if (live?.html && !blocked(live.html)) {
      html = live.html;
      finalUrl = live.finalUrl || finalUrl;
    } else {
      // 4. What the link carries (or the API's details without photos, plus the image failsafe).
      const partial = await fromLink(url, rawUrl, landed);
      if (partial) return api ? { ...partial, ...pickInfo(readListing("<html></html>", new URL(url), landed, { ...api, images: partial.images })) } : partial;
      throw down ?? blockedError(landed);
    }
  }
  const site = readListing(html || "<html></html>", new URL(finalUrl), landed, shop ?? (api ? { ...api, images: [] } : null));
  if (!site) {
    const partial = await fromLink(url, rawUrl, landed);
    if (partial) return partial;
    throw blockedError(landed);
  }
  if (!site.images.length) {
    // The page was read but its photos weren't found: the API's photos, or Amazon's main photo.
    const id = listingIds(url);
    const image = api?.images[0] ?? (id.asin ? await amazonImageByAsin(id.asin, id.amazon) : null);
    if (image) return { ...site, images: [...(api?.images ?? [image])], partial: true };
    throw new UrlError(`We read the ${landed.name} listing but couldn't get its photos. Save them and add them with "Add product photos".`, "listing");
  }
  return site;
}

/** The product details of a read listing (name, pitch, features), without its photos. */
function pickInfo(site: SiteData | null): Partial<SiteData> {
  if (!site) return {};
  const { name, tagline, description, headlines, features } = site;
  return { name, tagline, description, headlines, features, partial: false };
}
