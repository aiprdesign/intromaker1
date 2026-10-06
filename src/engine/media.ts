import { needsPicture, placeholderSources } from "./placeholders";
import type { Media, VideoPlan } from "./types";

/**
 * Loads and caches images/videos for media skills. All sources are same-origin
 * (/api/asset proxy), so drawing them never taints the canvas.
 */

export type Drawable = HTMLImageElement | HTMLVideoElement;

const images = new Map<string, HTMLImageElement>();
const videos = new Map<string, HTMLVideoElement>();
const pending = new Map<string, Promise<void>>();
const failed = new Set<string>();
let failures = 0;

/** Whether this picture failed to load. */
export function imageFailed(src: string | undefined) {
  return !!src && failed.has(src);
}

/** Bumps whenever a picture fails to load (so cached decisions about it can be redone). */
export function imageFailures() {
  return failures;
}

/** When true (offline export), skills must not touch video playback; syncVideos drives it. */
export const mediaState = { exporting: false };

/** Listeners notified when an image loads or a video has a new frame ready (for paused previews). */
const readyListeners = new Set<() => void>();
export function onMediaReady(fn: () => void) {
  readyListeners.add(fn);
  return () => void readyListeners.delete(fn);
}
const notifyReady = () => readyListeners.forEach((fn) => fn());

export { assetUrl } from "./assets";
import { loadBrandFont } from "./fonts";

/** Load images ahead of a still render (resolves when each has loaded or failed). */
export function preloadImages(srcs: string[]) {
  return Promise.all(srcs.map(loadImage));
}

function loadImage(src: string) {
  if (pending.has(src)) return pending.get(src)!;
  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => {
      // A picture that can't load (a dead link, an expired upload) is remembered, so its slide
      // shows a placeholder instead of an empty stage.
      failed.add(src);
      failures++;
      resolve();
      notifyReady();
    };
    const shot = shotKey(src);
    if (shot) {
      // Website captures come from this browser's own copy when it has one (the server may have
      // let them go), else from the server, keeping a copy for next time.
      void cachedShot(src, shot).then((blob) => {
        let url = src;
        if (blob) {
          url = URL.createObjectURL(blob);
          if (/svg/i.test(blob.type)) {
            vectorLogos.add(url);
            probes.set(url, Promise.resolve());
          }
        }
        img.onload = () => {
          images.set(src, img);
          resolve();
          notifyReady();
        };
        img.src = url;
      });
      return;
    }
    // Captured logos: learn whether the file is SVG before first use, so it's drawn as vector
    // from the first frame.
    const kind = /-logo$/.test(src) ? probeVector(src) : Promise.resolve();
    img.onload = () => {
      void kind.then(() => {
        images.set(src, img);
        resolve();
        notifyReady();
      });
    };
    img.src = src;
  });
  pending.set(src, p);
  return p;
}

/* ── This browser's copy of website captures (IndexedDB) ── */

const SHOT_DB = "intromaker-captures";
const SHOT_STORE = "shots";
const SHOT_KEEP = 400;
/** Like the server's copy, this browser's copy of a capture goes 48 hours after it was first saved. */
const SHOT_MAX_AGE_MS = 48 * 3_600_000;

/** The capture id in a /api/shot URL, or null. */
function shotKey(src: string) {
  return src.match(/\/api\/shot\?id=([a-f0-9]{16}-[a-z0-9]+)$/)?.[1] ?? null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function shotDb() {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(SHOT_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(SHOT_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null); // private mode or no IndexedDB: go to the server every time
    }
  });
  return dbPromise;
}

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return shotDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = run(db.transaction(SHOT_STORE, mode).objectStore(SHOT_STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

let stored = 0;
async function cachedShot(src: string, key: string): Promise<Blob | null> {
  const hit = await idb<{ blob: Blob; at: number; saved?: number } | undefined>("readonly", (st) => st.get(key));
  const saved = hit?.saved ?? hit?.at ?? 0;
  if (hit?.blob && Date.now() - saved <= SHOT_MAX_AGE_MS) {
    void idb("readwrite", (st) => st.put({ blob: hit.blob, at: Date.now(), saved }, key));
    return hit.blob;
  }
  if (hit) await idb("readwrite", (st) => st.delete(key));
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    await idb("readwrite", (st) => st.put({ blob, at: Date.now(), saved: Date.now() }, key));
    if (++stored % 25 === 0) void pruneShots();
    return blob;
  } catch {
    return null;
  }
}

/** Keep the most recently used captures. */
async function pruneShots() {
  const all = await idb<{ blob: Blob; at: number }[]>("readonly", (st) => st.getAll());
  const keys = await idb<IDBValidKey[]>("readonly", (st) => st.getAllKeys());
  if (!all || !keys || all.length <= SHOT_KEEP) return;
  const order = keys.map((k, i) => ({ k, at: all[i]?.at ?? 0 })).sort((a, b) => a.at - b.at);
  for (const { k } of order.slice(0, all.length - SHOT_KEEP)) await idb("readwrite", (st) => st.delete(k));
}

function loadVideo(src: string) {
  if (pending.has(src)) return pending.get(src)!;
  const p = new Promise<void>((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    const done = () => {
      videos.set(src, v);
      resolve();
      notifyReady();
    };
    v.addEventListener("seeked", () => !mediaState.exporting && notifyReady());
    v.addEventListener("loadeddata", done, { once: true });
    v.addEventListener("error", () => resolve(), { once: true });
    setTimeout(resolve, 12_000);
    v.src = src;
  });
  pending.set(src, p);
  return p;
}

export function getImage(src: string | undefined): HTMLImageElement | null {
  if (!src) return null;
  const img = images.get(src);
  if (!img) {
    void loadImage(src);
    return null;
  }
  return img;
}

/**
 * Current frame of a video for scene-local time `t`. In preview it keeps the element
 * playing roughly in sync; during export the frame is positioned by syncVideos().
 */
export function getVideoFrame(src: string, t: number): HTMLVideoElement | null {
  const v = videos.get(src);
  if (!v) {
    void loadVideo(src);
    return null;
  }
  if (!mediaState.exporting && v.duration) {
    const want = t % v.duration;
    if (Math.abs(v.currentTime - want) > 0.35) v.currentTime = want;
    if (v.paused) void v.play().catch(() => {});
  }
  return v.readyState >= 2 ? v : null;
}

export function getMedia(media: Media | undefined, t: number): Drawable | null {
  if (!media) return null;
  return media.kind === "video" ? getVideoFrame(media.src, t) : getImage(media.src);
}

export function mediaSize(d: Drawable) {
  return d instanceof HTMLVideoElement ? { w: d.videoWidth, h: d.videoHeight } : { w: d.naturalWidth, h: d.naturalHeight };
}

/** Every asset a plan references. */
function planAssets(plan: VideoPlan) {
  const imgs = new Set<string>();
  const vids = new Set<string>();
  if (plan.brand?.logo) imgs.add(plan.brand.logo);
  if (plan.brand?.icon) imgs.add(plan.brand.icon);
  for (const i of plan.brand?.images ?? []) imgs.add(i);
  for (const part of plan.brand?.parts ?? []) imgs.add(part.src);
  for (const s of plan.scenes) {
    if (s.media?.kind === "image") imgs.add(s.media.src);
    if (s.media?.kind === "video") vids.add(s.media.src);
  }
  return { imgs: [...imgs], vids: [...vids] };
}

/** Resolve once every asset the plan uses has loaded (or failed). */
export async function preloadPlanMedia(plan: VideoPlan) {
  const { imgs, vids } = planAssets(plan);
  // GPU transitions are a separate chunk, fetched only when the film uses them.
  const transitions = plan.scenes.some((s) => s.skill === "gallery-flow" || s.transition === "cube")
    ? import("./gl").then((m) => m.loadTransitions()).then(() => notifyReady())
    : Promise.resolve();
  // Slides still waiting for a picture show placeholder graphics: have those ready too.
  const placeholders = plan.scenes.some((s) => needsPicture(s, plan)) ? placeholderSources() : [];
  await Promise.all([...imgs.map(loadImage), ...placeholders.map(loadImage), ...vids.map(loadVideo), loadBrandFont(plan.brand?.font), transitions]);
}

/** Export: seek every video used at time `time` to its exact frame. */
export async function syncVideos(plan: VideoPlan, sceneIndex: number, local: number) {
  const media = plan.scenes[sceneIndex]?.media;
  if (media?.kind !== "video") return;
  const v = videos.get(media.src);
  if (!v || !v.duration) return;
  v.pause();
  const want = local % v.duration;
  if (Math.abs(v.currentTime - want) < 1 / 240) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 1500);
    v.addEventListener(
      "seeked",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
    v.currentTime = want;
  });
}

/* ───────── Logo analysis ───────── */

/** Logos whose file is vector (SVG): drawn fresh at every size, so edges are always sharp. */
const vectorLogos = new Set<string>();
const looksVector = (src: string) => /^data:image\/svg/i.test(src) || /\.svg(\?|#|$)/i.test(decodeURIComponent(src.replace(/^\/api\/asset\?url=/, "")));
const probes = new Map<string, Promise<void>>();
const absolute = (src: string) => (typeof location !== "undefined" ? new URL(src, location.href).href : src);
function probeVector(raw: string): Promise<void> {
  const src = absolute(raw);
  const known = probes.get(src);
  if (known) return known;
  let p: Promise<void> = Promise.resolve();
  if (looksVector(raw)) vectorLogos.add(src);
  else if (/-logo$/.test(src) && typeof fetch !== "undefined") {
    // Captured logos (/api/shot?id=…-logo) are SVG or PNG; the server says which.
    p = fetch(src, { method: "HEAD" })
      .then((r) => {
        if (!/svg/i.test(r.headers.get("content-type") ?? "")) return;
        vectorLogos.add(src);
        for (const k of Array.from(levelCache.keys())) if (k.startsWith(`${src}|`)) levelCache.delete(k);
        notifyReady();
      })
      .catch(() => {});
  }
  probes.set(src, p);
  return p;
}

const levelCache = new Map<string, HTMLCanvasElement | HTMLImageElement>();
const baseCache = new Map<string, HTMLCanvasElement | null>();

/**
 * Draw a logo at its best: SVGs are rasterised at the size they're shown; PNG, JPG and GIF logos
 * are cleaned once (a plain white box keyed out, GIF's hard 1-bit edges smoothed, small files
 * upscaled with high-quality filtering), then scaled down in steps so small copies (the brand bug)
 * stay smooth instead of aliased. Neutral ink adapts to the stage (see adaptInk).
 */
/** Logos this much wider than tall are wordmarks: too small in a centred lock-up. */
export const WIDE_LOGO = 1.8;
export const isWideLogo = (img: HTMLImageElement | null | undefined) => !!img && !!img.naturalWidth && img.naturalWidth / Math.max(1, img.naturalHeight) >= WIDE_LOGO;

/**
 * The mark for a centred lock-up: the logo itself, or — when the logo is a wide wordmark — the
 * site's app icon (null: draw the generated brand glyph). `stacked` means the name goes beneath.
 */
export function lockupMark(brand: { logo?: string; icon?: string } | undefined): { img: HTMLImageElement | null; icon: boolean; stacked: boolean } {
  const logo = getImage(brand?.logo);
  if (!isWideLogo(logo)) return { img: logo && logo.naturalWidth ? logo : null, icon: false, stacked: false };
  const icon = getImage(brand?.icon);
  return { img: icon && icon.naturalWidth ? icon : null, icon: true, stacked: true };
}

/** An app icon as a rounded tile, like on a phone's home screen. */
export function drawAppIcon(ctx: CanvasRenderingContext2D, img: HTMLImageElement, lightStage: boolean, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.22);
  ctx.clip();
  drawLogo(ctx, img, lightStage, x, y, w, h);
  ctx.restore();
}

export function drawLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, lightStage: boolean, x: number, y: number, w: number, h: number) {
  const m = ctx.getTransform();
  const px = Math.max(w, h) * Math.max(1e-3, Math.hypot(m.a, m.b));
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logoAt(img, lightStage, px), x, y, w, h);
  ctx.restore();
}

/** The logo prepared for drawing about `px` pixels on its long side (power-of-two buckets). */
export function logoAt(img: HTMLImageElement, lightStage: boolean, px = 1024): HTMLCanvasElement | HTMLImageElement {
  if (!img.naturalWidth || typeof document === "undefined") return img;
  void probeVector(img.src);
  const bucket = Math.min(2048, Math.max(32, 2 ** Math.ceil(Math.log2(Math.max(1, px)))));
  const key = `${img.src}|${lightStage ? "l" : "d"}|${bucket}`;
  const hit = levelCache.get(key);
  if (hit) return hit;
  let out: HTMLCanvasElement | HTMLImageElement = img;
  try {
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    if (vectorLogos.has(img.src)) {
      // Vector: render straight at the bucket size.
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round((img.naturalWidth / long) * bucket));
      c.height = Math.max(1, Math.round((img.naturalHeight / long) * bucket));
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, c.width, c.height);
      adaptInk(g, c.width, c.height, lightStage);
      out = c;
    } else {
      const bkey = `${img.src}|${lightStage ? "l" : "d"}`;
      if (!baseCache.has(bkey)) baseCache.set(bkey, prepareRaster(img, lightStage));
      const base = baseCache.get(bkey);
      out = base ? stepDown(base, bucket) : img;
    }
  } catch {
    out = img;
  }
  levelCache.set(key, out);
  return out;
}

/**
 * Largest on-screen width (in canvas pixels) a logo can be shown at without looking enlarged:
 * unlimited for SVG, 2.5× the file's own pixels for PNG / JPG / GIF (clean and a little smaller
 * beats big and blocky).
 */
export function logoMaxWidth(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  if (vectorLogos.has(img.src)) return Infinity;
  const m = ctx.getTransform();
  return (img.naturalWidth * 2.5) / Math.max(1e-3, Math.hypot(m.a, m.b));
}

/** Back-compat: the logo prepared at a generous size. */
export function stageLogo(img: HTMLImageElement, lightStage: boolean) {
  return logoAt(img, lightStage, 1024);
}

/** Halve with smoothing until close, then a final high-quality step: no aliasing on small copies. */
function stepDown(src: HTMLCanvasElement, bucket: number): HTMLCanvasElement {
  let cur = src;
  const target = (c: HTMLCanvasElement) => Math.max(c.width, c.height);
  while (target(cur) > bucket * 2) {
    const n = document.createElement("canvas");
    n.width = Math.max(1, Math.round(cur.width / 2));
    n.height = Math.max(1, Math.round(cur.height / 2));
    const g = n.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, 0, 0, n.width, n.height);
    cur = n;
  }
  if (target(cur) <= bucket) return cur;
  const k = bucket / target(cur);
  const n = document.createElement("canvas");
  n.width = Math.max(1, Math.round(cur.width * k));
  n.height = Math.max(1, Math.round(cur.height * k));
  const g = n.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(cur, 0, 0, n.width, n.height);
  return n;
}

/** Clean a raster logo once, at a working size of at least ~1200px on its long side. */
export function prepareRaster(img: HTMLImageElement, lightStage: boolean): HTMLCanvasElement | null {
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const fit = Math.min(1, 2048 / long);
  const w0 = Math.max(1, Math.round(img.naturalWidth * fit));
  const h0 = Math.max(1, Math.round(img.naturalHeight * fit));
  const c0 = document.createElement("canvas");
  c0.width = w0;
  c0.height = h0;
  const g0 = c0.getContext("2d", { willReadFrequently: true })!;
  g0.drawImage(img, 0, 0, w0, h0);
  const d0 = g0.getImageData(0, 0, w0, h0);
  const px = d0.data;
  const n = w0 * h0;

  // A logo saved on a plain white box (common for JPG logos): key the box out with a soft edge.
  const at = (x: number, y: number) => (y * w0 + x) * 4;
  const corners = [at(0, 0), at(w0 - 1, 0), at(0, h0 - 1), at(w0 - 1, h0 - 1)];
  const whiteBox = corners.every((i) => px[i + 3] > 250 && px[i] > 238 && px[i + 1] > 238 && px[i + 2] > 238);
  if (whiteBox) keyWhite(px, w0, h0);

  // Hard 1-bit transparency (GIF, some PNG-8): every pixel fully on or off.
  let clear = 0;
  let partial = 0;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] === 0) clear++;
    else if (px[i] < 255) partial++;
  }
  const hardEdges = !whiteBox && clear > n * 0.03 && partial < n * 0.004;
  // Transparent pixels often hold junk colour (black, or the GIF's matte): pull the neighbouring
  // opaque colour into them so smoothing never drags in a fringe.
  bleed(px, w0, h0, 3);
  g0.putImageData(d0, 0, 0);

  // Upscale small logos with high-quality filtering so the film never enlarges raw pixels.
  const f = Math.min(4, Math.max(1, Math.ceil(1200 / Math.max(w0, h0))));
  let c = c0;
  if (f > 1) {
    c = document.createElement("canvas");
    c.width = w0 * f;
    c.height = h0 * f;
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(c0, 0, 0, c.width, c.height);
  }
  const g = c.getContext("2d", { willReadFrequently: true })!;
  if (hardEdges) {
    // Smooth the staircase: blur the alpha a little, then re-sharpen it with a soft threshold,
    // which traces a clean anti-aliased curve through the steps.
    const d = g.getImageData(0, 0, c.width, c.height);
    smoothAlpha(d.data, c.width, c.height, Math.max(1, Math.round(f * 0.75)));
    g.putImageData(d, 0, 0);
  }
  adaptInk(g, c.width, c.height, lightStage);
  return c;
}

/**
 * Remove the white box a logo was saved on. Background is the white connected to the border,
 * plus enclosed white surrounded by neutral ink (the holes in "o", "e", "a"); enclosed white
 * surrounded by colour (a dot in a coloured mark) is part of the logo and stays. Pixels on and
 * next to the background get colour-to-alpha, so anti-aliased edges fade out cleanly instead of
 * leaving a grey outline.
 */
function keyWhite(px: Uint8ClampedArray, w: number, h: number) {
  const n = w * h;
  const light = (p: number) => 765 - px[p * 4] - px[p * 4 + 1] - px[p * 4 + 2] <= 88;
  const bg = new Uint8Array(n);
  const fill = (seeds: number[], mark: Uint8Array, value: number) => {
    const out: number[] = [];
    const stack = seeds;
    while (stack.length) {
      const p = stack.pop()!;
      if (mark[p] || !light(p)) continue;
      mark[p] = value;
      out.push(p);
      const x = p % w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < n - w) stack.push(p + w);
    }
    return out;
  };
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  fill(border, bg, 1);
  // Enclosed light regions: the holes in letters ("o", "e", "a") are background too, but white
  // that is part of the design stays: a white letter or symbol knocked out of a solid badge or
  // pill, a large white area, or white inside a coloured mark.
  // Ink components (connected non-light pixels), to tell thin letter strokes from solid shapes.
  const comp = new Int32Array(n).fill(-1);
  const comps: { area: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let p = 0; p < n; p++) {
    if (comp[p] >= 0 || light(p)) continue;
    const id = comps.length;
    const c = { area: 0, x0: w, y0: h, x1: 0, y1: 0 };
    comps.push(c);
    const stack = [p];
    comp[p] = id;
    while (stack.length) {
      const q = stack.pop()!;
      const x = q % w;
      const y = (q - x) / w;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q >= w ? q - w : -1, q < n - w ? q + w : -1]) {
        if (r >= 0 && comp[r] < 0 && !light(r)) {
          comp[r] = id;
          stack.push(r);
        }
      }
    }
  }
  // How solid a component is: its ink over its filled shape (ink plus the holes it encloses). A
  // letter's ring is thin (an "o" is ~0.5–0.75 ink); a badge with a knocked-out glyph is ~0.8+.
  const solidity = new Map<number, number>();
  const solidOf = (id: number) => {
    const hit = solidity.get(id);
    if (hit !== undefined) return hit;
    const c = comps[id];
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    const out = new Uint8Array(bw * bh);
    const stack: number[] = [];
    const seed = (x: number, y: number) => {
      const k = (y - c.y0) * bw + (x - c.x0);
      if (!out[k] && comp[y * w + x] !== id) {
        out[k] = 1;
        stack.push(k);
      }
    };
    for (let x = c.x0; x <= c.x1; x++) {
      seed(x, c.y0);
      seed(x, c.y1);
    }
    for (let y = c.y0; y <= c.y1; y++) {
      seed(c.x0, y);
      seed(c.x1, y);
    }
    let outside = 0;
    while (stack.length) {
      const k = stack.pop()!;
      outside++;
      const x = (k % bw) + c.x0;
      const y = Math.floor(k / bw) + c.y0;
      if (x > c.x0) seed(x - 1, y);
      if (x < c.x1) seed(x + 1, y);
      if (y > c.y0) seed(x, y - 1);
      if (y < c.y1) seed(x, y + 1);
    }
    const filled = bw * bh - outside;
    const v = filled > 0 ? c.area / filled : 1;
    solidity.set(id, v);
    return v;
  };
  // Each enclosed light region, with the ink component that surrounds it.
  const seen = new Uint8Array(n);
  const regions: { px: number[]; owner: number; neutral: boolean }[] = [];
  for (let p = 0; p < n; p++) {
    if (bg[p] || seen[p] || !light(p)) continue;
    const region = fill([p], seen, 1);
    let rim = 0;
    let coloured = 0;
    const owners = new Map<number, number>();
    for (const q of region) {
      const x = q % w;
      for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) {
        if (r < 0 || r >= n || light(r)) continue;
        const i = r * 4;
        const mx = Math.max(px[i], px[i + 1], px[i + 2]);
        const mn = Math.min(px[i], px[i + 1], px[i + 2]);
        rim++;
        if (mx - mn > 40) coloured++;
        owners.set(comp[r], (owners.get(comp[r]) ?? 0) + 1);
      }
    }
    const owner = [...owners.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    regions.push({ px: region, owner, neutral: rim > 0 && coloured / rim < 0.5 });
  }
  // A single letter encloses one or two holes; a shape with text knocked out of it ("ACME" in a
  // pill) encloses several white regions, and those are its lettering.
  const holes = new Map<number, number>();
  for (const r of regions) holes.set(r.owner, (holes.get(r.owner) ?? 0) + 1);
  for (const { px: region, owner, neutral } of regions) {
    // White inside a coloured mark is part of the logo.
    if (!neutral) continue;
    // Large white areas are design, not letter holes.
    if (region.length > n * 0.03) continue;
    if (owner >= 0 && (holes.get(owner) ?? 0) >= 3) continue;
    // A letter's hole is a compact blob (it fills ~0.6–0.8 of its box); a white letter or symbol
    // knocked out of a badge ("N", "A", "C") is a stroke shape that fills much less of its box.
    let rx0 = w, ry0 = h, rx1 = 0, ry1 = 0;
    for (const q of region) {
      const x = q % w;
      const y = (q - x) / w;
      if (x < rx0) rx0 = x;
      if (x > rx1) rx1 = x;
      if (y < ry0) ry0 = y;
      if (y > ry1) ry1 = y;
    }
    if (region.length / ((rx1 - rx0 + 1) * (ry1 - ry0 + 1)) < 0.55) continue;
    // White inside a very solid shape (a small dot in a big badge) is part of the logo too.
    if (owner >= 0 && solidOf(owner) >= 0.9) continue;
    for (const q of region) bg[q] = 1;
  }
  // Edge band: background plus two pixels around it.
  let band = bg;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(band);
    for (let p = 0; p < n; p++) {
      if (band[p]) continue;
      const x = p % w;
      if ((x > 0 && band[p - 1]) || (x < w - 1 && band[p + 1]) || (p >= w && band[p - w]) || (p < n - w && band[p + w])) next[p] = 1;
    }
    band = next;
  }
  for (let p = 0; p < n; p++) {
    if (!band[p]) continue;
    const i = p * 4;
    // Colour-to-alpha against white.
    const a = Math.max(255 - px[i], 255 - px[i + 1], 255 - px[i + 2]) / 255;
    // Tiny residue on the white (JPEG noise) is cleared outright.
    const alpha = bg[p] ? Math.max(0, (a - 0.07) / 0.93) : a;
    if (alpha <= 0) {
      px[i + 3] = 0;
      continue;
    }
    for (let k = 0; k < 3; k++) px[i + k] = Math.max(0, Math.min(255, Math.round((px[i + k] - 255 * (1 - a)) / a)));
    px[i + 3] = Math.round(px[i + 3] * alpha);
  }
}

function bleed(px: Uint8ClampedArray, w: number, h: number, passes: number) {
  for (let p = 0; p < passes; p++) {
    const src = new Uint8ClampedArray(px);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] > 0) continue;
        let r = 0, gg = 0, b = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = (yy * w + xx) * 4;
            if (src[j + 3] === 0) continue;
            r += src[j];
            gg += src[j + 1];
            b += src[j + 2];
            k++;
          }
        }
        if (k) {
          px[i] = r / k;
          px[i + 1] = gg / k;
          px[i + 2] = b / k;
        }
      }
    }
  }
}

function smoothAlpha(px: Uint8ClampedArray, w: number, h: number, r: number) {
  const a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3] / 255;
  // Separable box blur.
  const tmp = new Float32Array(a.length);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += a[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (2 * r + 1);
      sum += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      const v = sum / (2 * r + 1);
      // Soft threshold around the edge.
      const t = Math.min(1, Math.max(0, (v - 0.3) / 0.4));
      px[(y * w + x) * 4 + 3] = Math.round(t * t * (3 - 2 * t) * 255);
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

/**
 * The logo made legible on the stage without touching its brand colours: only the neutral ink
 * is adapted (near-black wordmark text turns white on dark styles, near-white text turns dark
 * on light styles), so a coloured mark next to a wordmark keeps its colours. Opaque rectangles
 * (app icons, photos) and logos with hardly any ink are left alone.
 */
function adaptInk(g: CanvasRenderingContext2D, w: number, h: number, lightStage: boolean) {
  const d = g.getImageData(0, 0, w, h);
  const px = d.data;
  let opaque = 0;
  let ink = 0;
  const inkness = (i: number) => {
    const mx = Math.max(px[i], px[i + 1], px[i + 2]);
    const mn = Math.min(px[i], px[i + 1], px[i + 2]);
    const sat = mx ? (mx - mn) / mx : 0;
    const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    // Neutral: low saturation, or so little chroma it only looks tinted (JPEG noise on black).
    if (sat >= 0.22 && mx - mn > 30) return 0;
    // Soft band instead of a hard cut, so anti-aliased edges recolour smoothly.
    return lightStage ? Math.min(1, Math.max(0, (lum - 0.72) / 0.12)) : Math.min(1, Math.max(0, (0.34 - lum) / 0.12));
  };
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 40) continue;
    opaque++;
    if (inkness(i) > 0.5) ink++;
  }
  if (!(opaque > 0 && opaque < (px.length / 4) * 0.92 && ink / opaque > 0.06)) return;
  // Only wordmark ink is adapted: connected ink that sits on the transparent background. Ink
  // enclosed by the logo's own colours (white text in a coloured badge, black text in a white
  // pill) and solid neutral shapes (the pill itself) keep their colour.
  const n = w * h;
  const inkAt = new Float32Array(n);
  for (let p = 0; p < n; p++) inkAt[p] = px[p * 4 + 3] >= 4 ? inkness(p * 4) : 0;
  const label = new Int32Array(n).fill(-1);
  const adapt = new Uint8Array(0 + n);
  for (let p = 0; p < n; p++) {
    if (label[p] >= 0 || inkAt[p] <= 0.05) continue;
    const members: number[] = [];
    const stack = [p];
    label[p] = p;
    let onClear = false;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const q = stack.pop()!;
      members.push(q);
      const x = q % w;
      const y = (q - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q >= w ? q - w : -1, q < n - w ? q + w : -1]) {
        if (r < 0) {
          onClear = true;
          continue;
        }
        if (px[r * 4 + 3] < 40) onClear = true;
        else if (label[r] < 0 && inkAt[r] > 0.05) {
          label[r] = p;
          stack.push(r);
        }
      }
    }
    // A shape that holds other opaque content (a badge with a letter in it, a pill with text) is
    // a container: recolouring it would hide what's inside. A letter's holes are transparent.
    let container = false;
    if (onClear) {
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      const mine = new Uint8Array(bw * bh);
      for (const q of members) mine[(Math.floor(q / w) - y0) * bw + ((q % w) - x0)] = 1;
      const out = new Uint8Array(bw * bh);
      const st: number[] = [];
      const seed = (k: number) => {
        if (!out[k] && !mine[k]) {
          out[k] = 1;
          st.push(k);
        }
      };
      for (let x = 0; x < bw; x++) {
        seed(x);
        seed((bh - 1) * bw + x);
      }
      for (let y = 0; y < bh; y++) {
        seed(y * bw);
        seed(y * bw + bw - 1);
      }
      while (st.length) {
        const k = st.pop()!;
        const x = k % bw;
        if (x > 0) seed(k - 1);
        if (x < bw - 1) seed(k + 1);
        if (k >= bw) seed(k - bw);
        if (k < bw * (bh - 1)) seed(k + bw);
      }
      let inside = 0;
      for (let k = 0; k < bw * bh; k++) {
        if (mine[k] || out[k]) continue;
        const q = (Math.floor(k / bw) + y0) * w + (k % bw) + x0;
        if (px[q * 4 + 3] >= 40) inside++;
      }
      container = inside > Math.max(4, members.length * 0.005);
    }
    if (onClear && !container) for (const q of members) adapt[q] = 1;
  }
  const to = lightStage ? [17, 17, 24] : [255, 255, 255];
  let changed = false;
  for (let p = 0; p < n; p++) {
    if (!adapt[p]) continue;
    const i = p * 4;
    const k = inkAt[p];
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] + (to[c] - px[i + c]) * k);
    changed = true;
  }
  if (changed) g.putImageData(d, 0, 0);
}

/* ───────── Brand colours ───────── */

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Pull two vivid brand colours from the logo / hero images (plus theme-color), tuned
 * to glow on a dark background.
 */
export async function extractBrandColors(srcs: string[], themeColor?: string | null) {
  const buckets: Buckets = new Map();
  const add = (h: number, s: number, l: number, weight: number) => {
    if (s < 0.3 || l < 0.18 || l > 0.85) return;
    const key = Math.round(h / 20) % 18;
    const b = buckets.get(key) ?? { w: 0, s: 0, l: 0, h: 0 };
    b.w += weight;
    b.s += s * weight;
    b.l += l * weight;
    b.h += h * weight;
    buckets.set(key, b);
  };
  if (themeColor && /^#[0-9a-f]{6}$/i.test(themeColor)) {
    const n = parseInt(themeColor.slice(1), 16);
    const [h, s, l] = rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
    add(h, s, l, 400);
  }
  for (const [i, src] of srcs.entries()) {
    await loadImage(src);
    const img = images.get(src);
    if (!img) continue;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 40;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, 40, 40);
      const d = g.getImageData(0, 0, 40, 40).data;
      const weight = i === 0 ? 3 : 1; // the logo counts most
      for (let p = 0; p < d.length; p += 4) {
        if (d[p + 3] < 128) continue;
        const [h, s, l] = rgbToHsl(d[p], d[p + 1], d[p + 2]);
        add(h, s, l, weight * s);
      }
    } catch {
      /* ignore undecodable images */
    }
  }
  return colorsFrom(buckets);
}

type Buckets = Map<number, { w: number; s: number; l: number; h: number }>;

/**
 * Colours from the logo alone: its dominant brand hue and a second hue that's actually in the
 * logo, or, for a single-colour logo, a harmonious analogous partner (colour theory: ±30° on the
 * wheel reads as one family). Returns null for a black / white / grey logo.
 */
export async function extractLogoColors(src: string | undefined) {
  if (!src) return null;
  await loadImage(src);
  const img = images.get(src);
  if (!img?.naturalWidth) return null;
  const buckets: Buckets = new Map();
  try {
    const n = 64;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 3] < 128) continue;
      const [h, sat, l] = rgbToHsl(d[p], d[p + 1], d[p + 2]);
      if (sat < 0.25 || l < 0.12 || l > 0.9) continue;
      const key = Math.round(h / 20) % 18;
      const bk = buckets.get(key) ?? { w: 0, s: 0, l: 0, h: 0 };
      const wt = 0.5 + sat;
      bk.w += wt;
      bk.s += sat * wt;
      bk.l += l * wt;
      bk.h += h * wt;
      buckets.set(key, bk);
    }
  } catch {
    return null;
  }
  // A few stray coloured pixels (anti-aliasing) don't make a colour logo.
  const total = [...buckets.values()].reduce((a, b) => a + b.w, 0);
  if (total < 40) return null;
  return colorsFrom(buckets, 30);
}

/** Two stage-ready colours from hue buckets: the strongest hue and a distinct second one. */
function colorsFrom(buckets: Buckets, analogous = 45) {
  const ranked = [...buckets.values()].sort((a, b) => b.w - a.w);
  if (!ranked.length) return null;
  const top = ranked[0];
  const h1 = top.h / top.w;
  const second = ranked.find((b) => {
    const dh = Math.abs(b.h / b.w - h1);
    return Math.min(dh, 360 - dh) > 35 && b.w > top.w * 0.08;
  });
  const h2 = second ? second.h / second.w : (h1 + analogous) % 360;
  // Normalise for a dark stage: saturated and bright enough to glow.
  const s1 = Math.max(0.7, top.s / top.w);
  return {
    primary: hslToHex(h1, s1, 0.58),
    secondary: hslToHex(h2, Math.max(0.65, second ? second.s / second.w : 0.8), 0.62),
  };
}

const hotCache = new Map<string, { x: number; y: number }[] | null>();

/**
 * Find the two busiest UI regions (buttons, cards, charts) in a screenshot, as fractions
 * of a `frameW`×`frameH` window the image is cover-fitted into with focal point (fx, fy).
 * Used by the product tour so the zooms and clicks land on real interface elements.
 * Returns null until the media has a readable frame (or if it can't be read).
 */
export function findHotspots(d: Drawable, frameW: number, frameH: number, fx = 0.5, fy = 0.2) {
  // Videos are analysed once, from their first decoded frame.
  if (d instanceof HTMLVideoElement ? d.readyState < 2 || !d.videoWidth : !d.naturalWidth) return null;
  const aspect = frameW / frameH;
  const key = `${d.src}|${aspect.toFixed(3)}|${fx}|${fy}`;
  if (hotCache.has(key)) return hotCache.get(key)!;
  let out: { x: number; y: number }[] | null = null;
  try {
    const { w: iw, h: ih } = mediaSize(d);
    // Visible crop of the source image (same maths as drawCover).
    const s = Math.max(frameW / iw, frameH / ih);
    const cw = frameW / s;
    const ch = frameH / s;
    const cx = (iw - cw) * fx;
    const cy = (ih - ch) * fy;
    const GW = 96;
    const GH = Math.max(24, Math.round(GW / aspect));
    const c = document.createElement("canvas");
    c.width = GW;
    c.height = GH;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(d, cx, cy, cw, ch, 0, 0, GW, GH);
    const px = g.getImageData(0, 0, GW, GH).data;
    const lum = new Float32Array(GW * GH);
    for (let i = 0; i < GW * GH; i++) lum[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    // Edge energy per pixel, accumulated into a coarse grid.
    const CX = 8;
    const CY = 6;
    const grid = new Float32Array(CX * CY);
    for (let y = 1; y < GH - 1; y++) {
      for (let x = 1; x < GW - 1; x++) {
        const i = y * GW + x;
        const e = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + GW] - lum[i - GW]);
        if (e < 18) continue; // ignore gradients/noise, keep crisp UI edges
        grid[Math.min(CY - 1, Math.floor((y / GH) * CY)) * CX + Math.min(CX - 1, Math.floor((x / GW) * CX))] += Math.min(e, 120);
      }
    }
    const cells: { x: number; y: number; score: number }[] = [];
    for (let gy = 0; gy < CY; gy++) {
      for (let gx = 0; gx < CX; gx++) {
        const x = (gx + 0.5) / CX;
        const y = (gy + 0.5) / CY;
        // Avoid the frame edges and the top nav band; favour the content area.
        const centre = 1 - 0.55 * Math.abs(x - 0.5) - 0.35 * Math.abs(y - 0.55);
        const nav = y < 0.14 ? 0.35 : 1;
        // Smooth with neighbours so a cluster beats a single noisy cell.
        let sum = 0;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const nx = gx + ox;
            const ny = gy + oy;
            if (nx >= 0 && ny >= 0 && nx < CX && ny < CY) sum += grid[ny * CX + nx] * (ox || oy ? 0.35 : 1);
          }
        cells.push({ x, y, score: sum * centre * nav });
      }
    }
    cells.sort((a, b) => b.score - a.score);
    const best = cells[0];
    const second = cells.find((c) => Math.hypot((c.x - best.x) * aspect, c.y - best.y) > 0.45);
    if (best && best.score > 0 && second && second.score > best.score * 0.15) {
      const clampP = (p: { x: number; y: number }) => ({
        x: Math.min(0.84, Math.max(0.16, p.x)),
        y: Math.min(0.84, Math.max(0.18, p.y)),
      });
      // Tour reads left-to-right / top-to-bottom.
      out = [best, second].sort((a, b) => a.x + a.y * 0.5 - (b.x + b.y * 0.5)).map(clampP);
    }
  } catch {
    out = null;
  }
  hotCache.set(key, out);
  return out;
}

const bandCache = new Map<string, [number, number][]>();

/** A place a page could be split, with how sure we are that a section ends there. */
interface Divider {
  y: number;
  score: number;
}
const dividerCache = new Map<string, { H: number; dividers: Divider[]; busy: Float32Array }>();

/**
 * Where a full-page screenshot could be divided into sections, scored (in rows of a 160px-wide
 * copy):
 * - the background colour changes from one full-width colour to another (score 3);
 * - a thin full-width rule between two areas of the same background (score 2);
 * - an empty gutter, by its height: a section break is a tall gap, the space between a heading
 *   and its content is a short one (up to 2.5).
 * Each row's background is its most common colour (so text and pictures on it don't move it),
 * and a row is empty when almost none of it has edges.
 */
function pageDividers(img: HTMLImageElement) {
  const hit = dividerCache.get(img.src);
  if (hit) return hit;
  const W = 160;
  const H = Math.max(40, Math.round((W * img.naturalHeight) / img.naturalWidth));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const busy = new Float32Array(H);
  const bgc: number[][] = [];
  const pure = new Float32Array(H);
  const hist = new Map<number, number>();
  for (let y = 0; y < H; y++) {
    hist.clear();
    let edges = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const q = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
      hist.set(q, (hist.get(q) ?? 0) + 1);
      // Only changes along the row: a full-width rule or a background edge is still an empty row.
      if (x > 0 && Math.abs(px[i] - px[i - 4]) + Math.abs(px[i + 1] - px[i - 3]) + Math.abs(px[i + 2] - px[i - 2]) > 36) edges++;
    }
    let n = 0;
    for (const k of hist.values()) if (k > n) n = k;
    // The row's colour: its median (steady across text and pictures, and along a gradient).
    const ch = [0, 1, 2].map((o) => {
      const v: number[] = [];
      for (let x = 0; x < W; x += 2) v.push(px[(y * W + x) * 4 + o]);
      return v.sort((a, b) => a - b)[v.length >> 1];
    });
    bgc.push(ch);
    pure[y] = n / W;
    busy[y] = edges / W;
  }
  const dividers: Divider[] = [];
  const diff = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const pixel = (x: number, y: number) => [px[(y * W + x) * 4], px[(y * W + x) * 4 + 1], px[(y * W + x) * 4 + 2]];
  const edgeMatch = (y: number) => diff(pixel(1, y), bgc[y]) < 30 && diff(pixel(W - 2, y), bgc[y]) < 30;
  // Background changes: a jump between steady runs of rows above and below (a gradient changes
  // a little every row, so it doesn't count). Only the strongest row of a jump is kept.
  for (let y = 3; y < H - 3; y++) {
    const jump = diff(bgc[y - 1], bgc[y]);
    if (jump < 40 || diff(bgc[y - 3], bgc[y - 1]) >= 18 || diff(bgc[y], bgc[y + 2]) >= 18) continue;
    // A section's background runs to both edges of the page (a row of cards doesn't).
    if (!edgeMatch(y - 1) || !edgeMatch(y)) continue;
    if (jump >= diff(bgc[y - 2], bgc[y - 1]) && jump >= diff(bgc[y], bgc[y + 1])) dividers.push({ y, score: 3 });
  }
  // Rules: a thin row that differs from matching backgrounds on both sides.
  for (let y = 2; y < H - 2; y++) {
    if (pure[y] < 0.8 || pure[y - 2] < 0.6 || pure[y + 2] < 0.6) continue;
    if (diff(bgc[y - 2], bgc[y + 2]) < 16 && diff(bgc[y], bgc[y - 2]) >= 24) dividers.push({ y, score: 2 });
  }
  // Gutters: runs of empty rows; the cut goes in the middle (on the rule, if there is one). A
  // gutter counts only when it's comparable to the page's widest: sections are set apart by more
  // space than a heading is from its content.
  const rowH = img.naturalWidth / W; // page px per row
  const gutters: Divider[] = [];
  // Where the content above a gutter began (the end of the previous real gap).
  let contentFrom = 0;
  for (let y = 0; y < H; ) {
    if (busy[y] > 0.02) {
      y++;
      continue;
    }
    let e = y;
    while (e < H && busy[e] <= 0.02) e++;
    const tall = (e - y) * rowH;
    if (y > 0 && e < H && tall >= 24) {
      let mid = Math.round((y + e) / 2);
      for (let k = y; k < e; k++) if (diff(bgc[k], bgc[Math.max(0, y - 1)]) >= 24 && diff(bgc[k], bgc[Math.min(H - 1, e)]) >= 24) mid = k;
      // Under a short block (a heading), the gap leads into that heading's content.
      const above = (y - contentFrom) * rowH;
      gutters.push({ y: mid, score: Math.min(2.5, tall / 70) * (above < 100 ? 0.5 : 1) });
    }
    if (tall >= 24) contentFrom = e;
    y = e;
  }
  const widest = Math.max(0, ...gutters.map((g) => g.score));
  for (const g of gutters) if (g.score >= widest * 0.6) dividers.push(g);
  const out = { H, dividers, busy };
  dividerCache.set(img.src, out);
  return out;
}

/**
 * Pick the cuts: the surest dividers first, keeping every section at least `minH` rows tall; then
 * any section taller than `maxH` is split at its best remaining divider. Returns [top, bottom]
 * fractions.
 */
function chooseBands(H: number, dividers: Divider[], minH: number, maxH: number, fixed: number[] = []) {
  const cuts = [0, H, ...fixed].sort((a, b) => a - b);
  const fits = (y: number, gap: number) => cuts.every((c) => Math.abs(c - y) >= gap);
  for (const d of [...dividers].sort((a, b) => b.score - a.score || a.y - b.y)) {
    if (d.score < 1) break;
    if (fits(d.y, minH)) {
      cuts.push(d.y);
      cuts.sort((a, b) => a - b);
    }
  }
  // Over-tall sections: split at their best inner divider (a smaller minimum is fine there).
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let i = 0; i < cuts.length - 1; i++) {
      const [a, b] = [cuts[i], cuts[i + 1]];
      if (b - a <= maxH) continue;
      const inner = dividers.filter((d) => d.y > a + minH * 0.6 && d.y < b - minH * 0.6).sort((p, q) => q.score - p.score || Math.abs(p.y - (a + b) / 2) - Math.abs(q.y - (a + b) / 2));
      if (!inner.length) continue;
      cuts.splice(i + 1, 0, inner[0].y);
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return cuts.slice(0, -1).map((a, i) => [a / H, cuts[i + 1] / H] as [number, number]);
}

/**
 * A full-page screenshot's sections when the page's own layout wasn't recorded, from its scored
 * dividers (see pageDividers): background changes and rules first, then the tallest gutters,
 * never cutting a section shorter than about a fifth of a screen, and splitting any taller than
 * about a screen and a half. Returns [top, bottom] fractions of the image height.
 */
export function pageBands(img: HTMLImageElement): [number, number][] {
  if (!img.naturalWidth) return [];
  const hit = bandCache.get(img.src);
  if (hit) return hit;
  let out: [number, number][] = [];
  try {
    const { H, dividers } = pageDividers(img);
    // In rows of the 160px copy: a 1440px page's screen is ~100 rows tall.
    const bands = chooseBands(H, dividers, Math.round(160 * 0.2), Math.round(160 * 0.95));
    out = bands.length >= 2 ? bands : [];
  } catch {
    out = [];
  }
  bandCache.set(img.src, out);
  return out;
}

const snapCache = new Map<string, [number, number][]>();
/**
 * The page's own sections (from its layout) checked against the screenshot: a boundary that falls
 * on content (a block's box can include margins, or end mid-way through a background) moves to the
 * nearest real divider within reach, so a section never starts or ends through text or a picture.
 */
export function snapBands(img: HTMLImageElement, bands: [number, number][]): [number, number][] {
  if (!img.naturalWidth || bands.length < 2) return bands;
  const key = `${img.src}|${bands.map((b) => b[0].toFixed(4)).join(",")}`;
  const hit = snapCache.get(key);
  if (hit) return hit;
  let out = bands;
  try {
    const { H, dividers, busy } = pageDividers(img);
    const reach = Math.round(160 * 0.07);
    const edges = bands.map((b) => b[0]).slice(1).map((f) => {
      const y = Math.round(f * H);
      // Already on an empty row: keep it.
      if (busy[Math.min(H - 1, Math.max(0, y))] <= 0.02) return y;
      const near = dividers.filter((d) => Math.abs(d.y - y) <= reach).sort((a, b) => b.score - a.score || Math.abs(a.y - y) - Math.abs(b.y - y));
      return near.length ? near[0].y : y;
    });
    const cuts = [bands[0][0] * H, ...edges, bands[bands.length - 1][1] * H].sort((a, b) => a - b).filter((y, i, a) => i === 0 || y - a[i - 1] >= 2);
    out = cuts.slice(0, -1).map((a, i) => [a / H, cuts[i + 1] / H] as [number, number]);
  } catch {
    out = bands;
  }
  snapCache.set(key, out);
  return out;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}
const segCache = new Map<string, Region[]>();

/**
 * Split a screenshot into its UI blocks (cards, panels, media, buttons) when the page's own
 * components weren't captured: rows of content separated by empty gutters form bands, and each
 * band splits into columns at its vertical gutters. Returns boxes in image pixels, largest
 * blocks first (at most 8), for animating the pieces individually.
 */
export function segmentShot(img: HTMLImageElement): Region[] {
  if (!img.naturalWidth) return [];
  const hit = segCache.get(img.src);
  if (hit) return hit;
  let out: Region[] = [];
  try {
    const W = 180;
    const H = Math.max(40, Math.round((W * img.naturalHeight) / img.naturalWidth));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    const busy = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + W] - lum[i - W]) > 14) busy[i] = 1;
      }
    const runs = (flags: boolean[], gap: number) => {
      const res: [number, number][] = [];
      let s0 = -1;
      let quiet = 0;
      flags.forEach((f, i) => {
        if (f) {
          if (s0 < 0) s0 = i;
          quiet = 0;
        } else if (s0 >= 0 && ++quiet > gap) {
          res.push([s0, i - quiet]);
          s0 = -1;
          quiet = 0;
        }
      });
      if (s0 >= 0) res.push([s0, flags.length - 1 - quiet]);
      return res;
    };
    const rowBusy = (y: number, x0: number, x1: number) => {
      let n = 0;
      for (let x = x0; x <= x1; x++) n += busy[y * W + x];
      return n;
    };
    const colBusy = (x: number, y0: number, y1: number) => {
      let n = 0;
      for (let y = y0; y <= y1; y++) n += busy[y * W + x];
      return n;
    };
    const boxes: Region[] = [];
    const split = (x0: number, y0: number, x1: number, y1: number, depth: number) => {
      const bands = runs(Array.from({ length: y1 - y0 + 1 }, (_, i) => rowBusy(y0 + i, x0, x1) > 1), 2).map(([a, b]) => [a + y0, b + y0]);
      for (const [by0, by1] of bands) {
        if (by1 - by0 < 3) continue;
        const cols = runs(Array.from({ length: x1 - x0 + 1 }, (_, i) => colBusy(x0 + i, by0, by1) > 0), 3).map(([a, b]) => [a + x0, b + x0]);
        for (const [cx0, cx1] of cols) {
          const w = cx1 - cx0 + 1;
          const h = by1 - by0 + 1;
          if (w < 6 || h < 4) continue;
          // A big block with inner gutters is split once more (a dashboard's panels).
          if (depth < 1 && w * h > W * H * 0.3 && (cx0 > x0 || cx1 < x1 || by0 > y0 || by1 < y1)) split(cx0 + 1, by0 + 1, cx1 - 1, by1 - 1, depth + 1);
          else boxes.push({ x: cx0, y: by0, w, h });
        }
      }
    };
    split(0, 0, W - 1, H - 1, 0);
    const k = img.naturalWidth / W;
    out = boxes
      .filter((b) => b.w * b.h >= W * H * 0.01 && b.w * b.h <= W * H * 0.7)
      .sort((a, b) => b.w * b.h - a.w * a.h)
      .slice(0, 8)
      .map((b) => ({ x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k }));
  } catch {
    out = [];
  }
  segCache.set(img.src, out);
  return out;
}
