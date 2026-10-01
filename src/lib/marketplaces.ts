import { createHash, createHmac } from "node:crypto";
import { safeFetch } from "./netguard";

/**
 * Failsafes for product listings, used when a marketplace won't serve its page to a server:
 *
 * 1. The marketplaces' own product APIs, when the owner adds keys (the reliable, sanctioned way):
 *    Amazon's Product Advertising API 5 (AMAZON_PAAPI_ACCESS_KEY, AMAZON_PAAPI_SECRET_KEY,
 *    AMAZON_PAAPI_PARTNER_TAG) and eBay's Browse API (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET).
 * 2. What the link itself carries: the product name in its path ("/Aero-Buds-Wireless-Earbuds/dp/…")
 *    and, for Amazon, the product's main photo from Amazon's public image server by its code.
 *
 * Prices, ratings and reviews are never requested.
 */

export interface ApiProduct {
  title: string;
  brand: string;
  description: string;
  bullets: string[];
  images: string[];
  source: string;
}

/* ───────── Amazon Product Advertising API 5 ───────── */

/** PA-API host and AWS region per Amazon storefront (by its top-level domain). */
const PAAPI: Record<string, [string, string]> = {
  com: ["webservices.amazon.com", "us-east-1"],
  ca: ["webservices.amazon.ca", "us-east-1"],
  "com.mx": ["webservices.amazon.com.mx", "us-east-1"],
  "com.br": ["webservices.amazon.com.br", "us-east-1"],
  "co.uk": ["webservices.amazon.co.uk", "eu-west-1"],
  de: ["webservices.amazon.de", "eu-west-1"],
  fr: ["webservices.amazon.fr", "eu-west-1"],
  it: ["webservices.amazon.it", "eu-west-1"],
  es: ["webservices.amazon.es", "eu-west-1"],
  nl: ["webservices.amazon.nl", "eu-west-1"],
  se: ["webservices.amazon.se", "eu-west-1"],
  pl: ["webservices.amazon.pl", "eu-west-1"],
  "com.be": ["webservices.amazon.com.be", "eu-west-1"],
  "com.tr": ["webservices.amazon.com.tr", "eu-west-1"],
  ae: ["webservices.amazon.ae", "eu-west-1"],
  sa: ["webservices.amazon.sa", "eu-west-1"],
  eg: ["webservices.amazon.eg", "eu-west-1"],
  in: ["webservices.amazon.in", "eu-west-1"],
  "co.jp": ["webservices.amazon.co.jp", "us-west-2"],
  "com.au": ["webservices.amazon.com.au", "us-west-2"],
  sg: ["webservices.amazon.sg", "us-west-2"],
};

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();

/** AWS Signature Version 4 signing key (exported for the hosting check's known-answer test). */
export function sigV4Key(secret: string, date: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), "aws4_request");
}

export const amazonApiConfigured = () => !!(process.env.AMAZON_PAAPI_ACCESS_KEY && process.env.AMAZON_PAAPI_SECRET_KEY && process.env.AMAZON_PAAPI_PARTNER_TAG);

/** The product from Amazon's Product Advertising API (null when not configured or not found). */
export async function amazonApi(asin: string, tld: string): Promise<ApiProduct | null> {
  const access = process.env.AMAZON_PAAPI_ACCESS_KEY;
  const secret = process.env.AMAZON_PAAPI_SECRET_KEY;
  const tag = process.env.AMAZON_PAAPI_PARTNER_TAG;
  const target = PAAPI[tld];
  if (!access || !secret || !tag || !target) return null;
  const [host, region] = target;
  const service = "ProductAdvertisingAPI";
  const path = "/paapi5/getitems";
  const body = JSON.stringify({
    ItemIds: [asin],
    ItemIdType: "ASIN",
    PartnerTag: tag,
    PartnerType: "Associates",
    Marketplace: `www.amazon.${tld}`,
    Resources: ["ItemInfo.Title", "ItemInfo.Features", "ItemInfo.ByLineInfo", "Images.Primary.Large", "Images.Variants.Large"],
  });
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    "content-encoding": "amz-1.0",
    "content-type": "application/json; charset=utf-8",
    host,
    "x-amz-date": amzDate,
    "x-amz-target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems",
  };
  const names = Object.keys(headers).sort();
  const canonical = ["POST", path, "", ...names.map((k) => `${k}:${headers[k]}`), "", names.join(";"), sha256(body)].join("\n");
  const scope = `${date}/${region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signature = createHmac("sha256", sigV4Key(secret, date, region, service)).update(toSign, "utf8").digest("hex");
  try {
    const res = await safeFetch(`https://${host}${path}`, {
      method: "POST",
      body,
      headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` },
    });
    if (!res.ok) {
      console.warn("[listing] Amazon API", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    type Img = { Large?: { URL?: string } };
    const data = (await res.json()) as {
      ItemsResult?: {
        Items?: {
          ItemInfo?: { Title?: { DisplayValue?: string }; Features?: { DisplayValues?: string[] }; ByLineInfo?: { Brand?: { DisplayValue?: string } } };
          Images?: { Primary?: Img; Variants?: Img[] };
        }[];
      };
    };
    const item = data.ItemsResult?.Items?.[0];
    if (!item?.ItemInfo?.Title?.DisplayValue) return null;
    return {
      title: item.ItemInfo.Title.DisplayValue,
      brand: item.ItemInfo.ByLineInfo?.Brand?.DisplayValue ?? "",
      description: "",
      bullets: item.ItemInfo.Features?.DisplayValues ?? [],
      images: [item.Images?.Primary?.Large?.URL, ...(item.Images?.Variants ?? []).map((v) => v.Large?.URL)].filter((u): u is string => !!u),
      source: "Amazon Product Advertising API",
    };
  } catch (e) {
    console.warn("[listing] Amazon API failed:", (e as Error).message);
    return null;
  }
}

/* ───────── eBay Browse API ───────── */

const EBAY_MARKETS: Record<string, string> = { com: "EBAY_US", "co.uk": "EBAY_GB", de: "EBAY_DE", "com.au": "EBAY_AU", ca: "EBAY_CA", fr: "EBAY_FR", it: "EBAY_IT", es: "EBAY_ES", nl: "EBAY_NL", at: "EBAY_AT", ch: "EBAY_CH", ie: "EBAY_IE", pl: "EBAY_PL", be: "EBAY_BE" };

export const ebayApiConfigured = () => !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);

let ebayToken: { value: string; until: number } | null = null;
async function ebayAccessToken(): Promise<string | null> {
  if (ebayToken && Date.now() < ebayToken.until) return ebayToken.value;
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await safeFetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) return null;
  const t = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!t.access_token) return null;
  ebayToken = { value: t.access_token, until: Date.now() + Math.max(60, (t.expires_in ?? 7200) - 120) * 1000 };
  return ebayToken.value;
}

/** The item from eBay's Browse API (null when not configured or not found). */
export async function ebayApi(itemId: string, tld: string): Promise<ApiProduct | null> {
  if (!ebayApiConfigured()) return null;
  try {
    const token = await ebayAccessToken();
    if (!token) return null;
    const res = await safeFetch(`https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(itemId)}`, {
      headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETS[tld] ?? "EBAY_US", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const it = (await res.json()) as {
      title?: string;
      brand?: string;
      shortDescription?: string;
      image?: { imageUrl?: string };
      additionalImages?: { imageUrl?: string }[];
      localizedAspects?: { name?: string; value?: string }[];
    };
    if (!it.title) return null;
    const features = (it.localizedAspects ?? []).find((a) => /^features?$/i.test(a.name ?? ""))?.value ?? "";
    return {
      title: it.title,
      brand: it.brand ?? (it.localizedAspects ?? []).find((a) => /^brand$/i.test(a.name ?? ""))?.value ?? "",
      description: it.shortDescription ?? "",
      bullets: features.split(/,|;|\|/).map((s) => s.trim()).filter((s) => s.length > 2),
      images: [it.image?.imageUrl, ...(it.additionalImages ?? []).map((a) => a.imageUrl)].filter((u): u is string => !!u),
      source: "eBay Browse API",
    };
  } catch (e) {
    console.warn("[listing] eBay API failed:", (e as Error).message);
    return null;
  }
}

/* ───────── What the link itself carries ───────── */

/**
 * The product name many listing links carry in their path: Amazon "/Aero-Buds-Wireless-Earbuds/dp/…",
 * Walmart "/ip/Aero-Buds-Wireless-Earbuds/123", eBay "/itm/Aero-Buds-Wireless/123", Etsy
 * "/listing/123/aero-buds-wireless", Target "/p/aero-buds-wireless/-/A-123", Best Buy
 * "/site/aero-buds-wireless/123.p". Empty when the link has none.
 */
export function titleFromLink(raw: string): string {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return "";
  }
  const p = u.pathname;
  const slug =
    p.match(/^\/([^/]+)\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i)?.[1] ??
    p.match(/\/ip\/([^/]+)\/\d+/i)?.[1] ??
    p.match(/\/itm\/([^/]+)\/\d+/i)?.[1] ??
    p.match(/\/listing\/\d+\/([^/?#]+)/i)?.[1] ??
    p.match(/\/p\/([^/]+)\/-\//i)?.[1] ??
    p.match(/\/site\/([^/]+)\/\d+\.p/i)?.[1] ??
    p.match(/\/products\/([^/?#]+)/i)?.[1] ??
    "";
  let text = "";
  try {
    text = decodeURIComponent(slug);
  } catch {
    text = slug;
  }
  text = text.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  // A real name has letters and a few words (not an id or a single code).
  if (!/[a-z]{3}/i.test(text) || text.split(" ").length < 2) return "";
  // All-lowercase slugs (Etsy, Shopify) read better capitalised.
  return text === text.toLowerCase() ? text.replace(/\b([a-z])/g, (c) => c.toUpperCase()) : text;
}

/** Amazon's image-link service per store (the one Amazon provides for showing a product's photo). */
const IMAGE_LINK: Record<string, [string, string]> = {
  com: ["ws-na", "US"],
  ca: ["ws-na", "CA"],
  "com.mx": ["ws-na", "MX"],
  "com.br": ["ws-na", "BR"],
  "co.uk": ["ws-eu", "GB"],
  de: ["ws-eu", "DE"],
  fr: ["ws-eu", "FR"],
  it: ["ws-eu", "IT"],
  es: ["ws-eu", "ES"],
  in: ["ws-in", "IN"],
  "co.jp": ["ws-fe", "JP"],
};

/**
 * The product's main photo by its 10-character code, or null: Amazon's public image server, then
 * Amazon's own image-link service for the listing's store. (An unknown code returns a small
 * placeholder, so the response must be a real JPEG of some size.) Returns the photo's final address.
 */
export async function amazonImageByAsin(asin: string, tld = "com"): Promise<string | null> {
  const [ws, market] = IMAGE_LINK[tld] ?? IMAGE_LINK.com;
  const sources = [
    `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX1500_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg`,
    `https://${ws}.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=${asin}&Format=_SL1500_&ID=AsinImage&MarketPlace=${market}&ServiceVersion=20070822&WS=1`,
  ];
  for (const url of sources) {
    try {
      const res = await safeFetch(url, { headers: { Accept: "image/*" } });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      const size = (await res.arrayBuffer()).byteLength;
      if (type.startsWith("image/jpeg") && size > 2000) return res.url && /^https:\/\//.test(res.url) ? res.url : url;
    } catch {
      /* try the next address */
    }
  }
  return null;
}
