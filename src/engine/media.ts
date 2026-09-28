import type { Media, VideoPlan } from "./types";

/**
 * Loads and caches images/videos for media skills. All sources are same-origin
 * (/api/asset proxy), so drawing them never taints the canvas.
 */

export type Drawable = HTMLImageElement | HTMLVideoElement;

const images = new Map<string, HTMLImageElement>();
const videos = new Map<string, HTMLVideoElement>();
const pending = new Map<string, Promise<void>>();

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

function loadImage(src: string) {
  if (pending.has(src)) return pending.get(src)!;
  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      images.set(src, img);
      resolve();
      notifyReady();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
  pending.set(src, p);
  return p;
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
  await Promise.all([...imgs.map(loadImage), ...vids.map(loadVideo), loadBrandFont(plan.brand?.font)]);
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

const adaptCache = new Map<string, HTMLCanvasElement | HTMLImageElement>();

/**
 * The logo, made legible on the stage without touching its brand colours: only the neutral ink
 * is adapted (near-black wordmark text turns white on dark styles, near-white text turns dark
 * on light styles), so a coloured mark next to a wordmark keeps its colours. Logos that need
 * nothing are returned as they are.
 */
export function stageLogo(img: HTMLImageElement, lightStage: boolean): HTMLCanvasElement | HTMLImageElement {
  if (!img.naturalWidth) return img;
  const key = `${img.src}|${lightStage ? "l" : "d"}`;
  const hit = adaptCache.get(key);
  if (hit) return hit;
  let out: HTMLCanvasElement | HTMLImageElement = img;
  try {
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height);
    const px = d.data;
    let opaque = 0;
    let ink = 0;
    const isInk = (i: number) => {
      const mx = Math.max(px[i], px[i + 1], px[i + 2]);
      const mn = Math.min(px[i], px[i + 1], px[i + 2]);
      const sat = mx ? (mx - mn) / mx : 0;
      const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      return sat < 0.22 && (lightStage ? lum > 0.78 : lum < 0.28);
    };
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 40) continue;
      opaque++;
      if (isInk(i)) ink++;
    }
    // Opaque rectangles (app icons, photos) are left alone; so is a logo with hardly any ink.
    if (opaque > 0 && opaque < (px.length / 4) * 0.92 && ink / opaque > 0.06) {
      const to = lightStage ? [17, 17, 24] : [255, 255, 255];
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 8 || !isInk(i)) continue;
        px[i] = to[0];
        px[i + 1] = to[1];
        px[i + 2] = to[2];
      }
      g.putImageData(d, 0, 0);
      out = c;
    }
  } catch {
    out = img;
  }
  adaptCache.set(key, out);
  return out;
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
