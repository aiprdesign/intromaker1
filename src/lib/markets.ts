/**
 * Which links are product listings: marketplaces (Amazon, eBay, AliExpress…) and shop product
 * pages, recognised from the address alone. Shared by the importer and the homepage (which says
 * "this will be a product video" as soon as a listing link is pasted). Pages on other shops are
 * recognised after loading, from their product data (see src/lib/scrape.ts).
 */

export interface Market {
  id: string;
  name: string;
}

/** Marketplaces and big stores: the host, and the path of one product's page. Short links have no path. */
const MARKETS: { id: string; name: string; host: RegExp; path?: RegExp }[] = [
  { id: "amazon", name: "Amazon", host: /(^|\.)amazon\.[a-z.]{2,6}$/i, path: /\/(dp|gp\/product|gp\/aw\/d|d|o\/ASIN|exec\/obidos\/ASIN)\/[A-Z0-9]{10}/i },
  { id: "amazon", name: "Amazon", host: /^(amzn\.(to|eu|asia|com)|a\.co)$/i },
  { id: "ebay", name: "eBay", host: /(^|\.)ebay\.[a-z.]{2,6}$/i, path: /\/(itm|p)\//i },
  { id: "ebay", name: "eBay", host: /^ebay\.(us|to)$/i },
  { id: "aliexpress", name: "AliExpress", host: /(^|\.)aliexpress\.[a-z.]{2,6}$/i, path: /\/(item|i)\/[\w-]*\d+/i },
  { id: "aliexpress", name: "AliExpress", host: /^(a|s\.click)\.aliexpress\.com$/i },
  { id: "alibaba", name: "Alibaba", host: /(^|\.)alibaba\.com$/i, path: /\/product-detail\//i },
  { id: "etsy", name: "Etsy", host: /(^|\.)etsy\.com$/i, path: /\/listing\/\d+/i },
  { id: "etsy", name: "Etsy", host: /^etsy\.me$/i },
  { id: "walmart", name: "Walmart", host: /(^|\.)walmart\.(com|ca)$/i, path: /\/ip\//i },
  { id: "target", name: "Target", host: /(^|\.)target\.com$/i, path: /\/p\//i },
  { id: "bestbuy", name: "Best Buy", host: /(^|\.)bestbuy\.(com|ca)$/i, path: /\/site\/|\/product\//i },
  { id: "temu", name: "Temu", host: /(^|\.)temu\.com$/i, path: /-g-\d+\.html|\/goods\.html/i },
  { id: "shein", name: "SHEIN", host: /(^|\.)shein\.[a-z.]{2,6}$/i, path: /-p-\d+/i },
  { id: "flipkart", name: "Flipkart", host: /(^|\.)flipkart\.com$/i, path: /\/p\/itm/i },
  { id: "mercadolibre", name: "Mercado Libre", host: /(^|\.)mercadoli[bv]re\.[a-z.]{2,6}$/i, path: /\/(p\/)?ML[A-Z]-?\d+/i },
  { id: "rakuten", name: "Rakuten", host: /(^|\.)rakuten\.[a-z.]{2,6}$/i, path: /\/(item|product|shop)\//i },
  { id: "newegg", name: "Newegg", host: /(^|\.)newegg\.(com|ca)$/i, path: /\/p\//i },
  { id: "wayfair", name: "Wayfair", host: /(^|\.)wayfair\.[a-z.]{2,6}$/i, path: /\/pdp\//i },
  { id: "homedepot", name: "The Home Depot", host: /(^|\.)homedepot\.(com|ca)$/i, path: /\/p\//i },
  { id: "ikea", name: "IKEA", host: /(^|\.)ikea\.com$/i, path: /\/p\//i },
  { id: "noon", name: "noon", host: /(^|\.)noon\.com$/i, path: /\/p\//i },
  { id: "shopee", name: "Shopee", host: /(^|\.)shopee\.[a-z.]{2,6}$/i, path: /-i\.\d+\.\d+/i },
  { id: "lazada", name: "Lazada", host: /(^|\.)lazada\.[a-z.]{2,6}$/i, path: /-i\d+(-s\d+)?\.html/i },
  { id: "jd", name: "JD", host: /^item\.jd\.com$/i },
  { id: "costco", name: "Costco", host: /(^|\.)costco\.[a-z.]{2,6}$/i, path: /\.product\.\d+\.html/i },
  { id: "zalando", name: "Zalando", host: /(^|\.)zalando\.[a-z.]{2,6}$/i, path: /\.html$/i },
];

/**
 * A listing link in its plain canonical form: everything after the product's code is dropped
 * (the product-name slug, ref= paths, tracking and session parameters). Amazon links become
 * https://www.amazon.<tld>/dp/<ASIN> (the 10-character product code), eBay /itm/<id>, Etsy
 * /listing/<id>; other stores keep their path without the query. A bare ASIN ("B0C1234XYZ") is
 * read as an amazon.com link.
 */
export function canonicalListing(raw: string): string {
  const typed = raw.trim();
  if (/^[A-Z0-9]{10}$/.test(typed) && /\d/.test(typed)) return `https://www.amazon.com/dp/${typed}`;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`);
  } catch {
    return typed;
  }
  const host = u.hostname.toLowerCase();
  const amazon = host.match(/(?:^|\.)amazon\.([a-z.]{2,6})$/);
  if (amazon) {
    const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|d|o\/ASIN|exec\/obidos\/ASIN|exec\/obidos\/tg\/detail\/-)\/([A-Z0-9]{10})(?=[/?#]|$)/i)?.[1] ?? u.searchParams.get("asin");
    if (asin && /^[A-Z0-9]{10}$/i.test(asin)) return `https://www.amazon.${amazon[1]}/dp/${asin.toUpperCase()}`;
  }
  const ebay = host.match(/(?:^|\.)ebay\.([a-z.]{2,6})$/);
  const ebayItem = u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{6,})/)?.[1];
  if (ebay && ebayItem) return `https://www.ebay.${ebay[1]}/itm/${ebayItem}`;
  const etsy = /(?:^|\.)etsy\.com$/.test(host) ? u.pathname.match(/\/listing\/(\d+)/)?.[1] : null;
  if (etsy) return `https://www.etsy.com/listing/${etsy}`;
  const ali = /(?:^|\.)aliexpress\.[a-z.]{2,6}$/.test(host) ? u.pathname.match(/\/(?:item|i)\/(?:[\w-]*?)(\d{6,})\.html/)?.[1] : null;
  if (ali) return `https://www.aliexpress.com/item/${ali}.html`;
  // Short links and other stores: the page itself, without tracking parameters.
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "") || "/"}`;
}

/** Which marketplace a listing URL is on (null for other sites). */
export function marketOf(raw: string): Market | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  for (const m of MARKETS) if (m.host.test(u.hostname) && (!m.path || m.path.test(u.pathname))) return { id: m.id, name: m.name };
  // Shopify-style stores: /products/<handle>; WooCommerce: /product/<slug>.
  if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:collections\/[^/]+\/)?products\/[^/]+\/?$/i.test(u.pathname)) return { id: "shop", name: u.hostname.replace(/^www\./, "") };
  return null;
}
