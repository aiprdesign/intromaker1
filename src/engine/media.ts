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

const darkCache = new Map<string, boolean>();

/** True if the logo is mostly dark ink (made for light backgrounds) and should be inverted. */
export function isDarkLogo(img: HTMLImageElement) {
  const hit = darkCache.get(img.src);
  if (hit !== undefined) return hit;
  let dark = false;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, 48, 48);
    const d = g.getImageData(0, 0, 48, 48).data;
    let lum = 0;
    let n = 0;
    let opaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 128) {
        opaque++;
        lum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        n++;
      }
    }
    // Opaque square logos (e.g. app icons) are shown as-is.
    dark = n > 0 && opaque < 48 * 48 * 0.9 && lum / n < 0.35;
  } catch {
    dark = false;
  }
  darkCache.set(img.src, dark);
  return dark;
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
  const buckets = new Map<number, { w: number; s: number; l: number; h: number }>();
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
  const ranked = [...buckets.values()].sort((a, b) => b.w - a.w);
  if (!ranked.length) return null;
  const top = ranked[0];
  const h1 = top.h / top.w;
  const second = ranked.find((b) => {
    const dh = Math.abs(b.h / b.w - h1);
    return Math.min(dh, 360 - dh) > 35;
  });
  const h2 = second ? second.h / second.w : (h1 + 45) % 360;
  // Normalise for a dark stage: saturated and bright enough to glow.
  const s1 = Math.max(0.7, top.s / top.w);
  return {
    primary: hslToHex(h1, s1, 0.58),
    secondary: hslToHex(h2, Math.max(0.65, second ? second.s / second.w : 0.8), 0.62),
  };
}
