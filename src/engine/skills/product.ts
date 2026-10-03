/**
 * Physical products (from a marketplace listing or uploaded product photos): the product photo
 * cut out of its white studio background, standing on the stage with a floor shadow and a soft
 * reflection, a light sweep across it, and its features called out around it one by one.
 * Everything stays level: the product rises and floats straight, it never tilts.
 */
import { exitT, lightSweep } from "../fx";
import { clamp, ease, mixHex, range, rgba } from "../math";
import { getImage } from "../media";
import { backLight, blurInLayout, drawIcon, glassCard, iconsFor, saasBackground, sentence, spring } from "../saasfx";
import { scratch } from "../scratch";
import { fillTextFit, fitTextLines, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { ctaButton, ctaCursor, ctaTiming, topHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });

type Cut = { canvas: HTMLCanvasElement; cut: boolean };
const cuts = new Map<string, Cut>();

/**
 * The product without its studio background: when the photo's border is (nearly) all white, the
 * white connected to the edges is keyed out with a soft edge and the result trimmed to the
 * product. Lifestyle photos (no white border) are kept whole and shown as a rounded photo.
 */
export function productCutout(img: HTMLImageElement, key: string): Cut | null {
  if (!img.naturalWidth || typeof document === "undefined") return null;
  const hit = cuts.get(key);
  if (hit) return hit;
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const k = Math.min(1, 1000 / long);
  const W = Math.max(1, Math.round(img.naturalWidth * k));
  const H = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, W, H);
  let out: Cut = { canvas: c, cut: false };
  try {
    const data = g.getImageData(0, 0, W, H);
    const px = data.data;
    const white = (i: number, floor: number) => {
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      return px[i + 3] > 200 && Math.min(r, gg, b) >= floor && Math.max(r, gg, b) - Math.min(r, gg, b) < 22;
    };
    // Is the border a white studio background?
    let border = 0;
    let whiteBorder = 0;
    for (let x = 0; x < W; x += 2) for (const y of [0, H - 1]) {
      border++;
      if (white((y * W + x) * 4, 236)) whiteBorder++;
    }
    for (let y = 0; y < H; y += 2) for (const x of [0, W - 1]) {
      border++;
      if (white((y * W + x) * 4, 236)) whiteBorder++;
    }
    if (whiteBorder / border >= 0.8) {
      const box = keyStudioBackground(px, W, H);
      if (box) {
        g.putImageData(data, 0, 0);
        const pad = 2;
        const t = document.createElement("canvas");
        t.width = box.x1 - box.x0 + 1 + pad * 2;
        t.height = box.y1 - box.y0 + 1 + pad * 2;
        t.getContext("2d")!.drawImage(c, box.x0 - pad, box.y0 - pad, t.width, t.height, 0, 0, t.width, t.height);
        out = { canvas: t, cut: true };
      }
    }
  } catch {
    /* cross-origin pixels can't be read: show the photo as it is */
  }
  cuts.set(key, out);
  return out;
}

/**
 * Key a white studio background out of RGBA pixels in place; returns the product's bounds (or null).
 *
 * 1. The background's own colour is the border's median.
 * 2. The background also takes the soft shadow or reflection under the product (the film draws
 *    its own floor shadow): colourless, edge-free, and below the product's lowest definite
 *    feature. Everything else off the outline is product, white faces included (they can fade
 *    into a white backdrop with no outline). The outline band is split by a watershed, at its
 *    strongest edge.
 * 3. Background seen through enclosed gaps (a mug's handle) goes too, but only thick blobs of the
 *    exact background colour, so white print and lettering stay.
 * 4. Specks left in the background are dropped.
 * 5. The outline is matted: each edge pixel's opacity comes from how far it is from the
 *    background compared with the product just inside it, and the white mixed into it is taken
 *    back out, so there is no white fringe on a dark or coloured stage.
 */
function keyStudioBackground(px: Uint8ClampedArray, W: number, H: number) {
  const N = W * H;
  // The background colour: the border's median.
  const samples: number[][] = [];
  for (let x = 0; x < W; x += 3) for (const y of [0, H - 1]) samples.push([px[(y * W + x) * 4], px[(y * W + x) * 4 + 1], px[(y * W + x) * 4 + 2]]);
  for (let y = 0; y < H; y += 3) for (const x of [0, W - 1]) samples.push([px[(y * W + x) * 4], px[(y * W + x) * 4 + 1], px[(y * W + x) * 4 + 2]]);
  const med = [0, 1, 2].map((ch) => samples.map((v) => v[ch]).sort((a, b) => a - b)[samples.length >> 1]);
  const medL = 0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2];
  const dist = new Float32Array(N);
  const chroma = new Float32Array(N);
  const lum = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    dist[p] = px[i + 3] < 200 ? 0 : Math.max(Math.abs(px[i] - med[0]), Math.abs(px[i + 1] - med[1]), Math.abs(px[i + 2] - med[2]));
    chroma[p] = Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
    lum[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }
  // Brightness smoothed over 3×3 (so sensor and JPEG noise don't stop the flood).
  const smooth = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          sum += lum[yy * W + xx];
          n++;
        }
      smooth[y * W + x] = sum / n;
    }
  // Edge strength: Sobel on the smoothed brightness, plus colour changes.
  const grad = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      const gx = smooth[p - W + 1] + 2 * smooth[p + 1] + smooth[p + W + 1] - smooth[p - W - 1] - 2 * smooth[p - 1] - smooth[p + W - 1];
      const gy = smooth[p + W - 1] + 2 * smooth[p + W] + smooth[p + W + 1] - smooth[p - W - 1] - 2 * smooth[p - W] - smooth[p - W + 1];
      const gc = Math.max(Math.abs(chroma[p + 1] - chroma[p - 1]), Math.abs(chroma[p + W] - chroma[p - W]));
      grad[p] = Math.min(255, Math.round(Math.hypot(gx, gy) / 4 + gc / 2));
    }
  // Markers. Background: plain background (within a few levels of its colour) connected to the
  // border. Product: what can't be background or a soft shadow: colour, dark tones, strong edges.
  const PLAIN = 6;
  const lab = new Uint8Array(N); // 0 unknown, 1 background, 2 product
  const stack: number[] = [];
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p - x) / W;
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && dist[p] <= PLAIN + 4) {
      lab[p] = 1;
      stack.push(p);
    }
  }
  const plainStep = (q: number) => {
    if (!lab[q] && dist[q] <= PLAIN) {
      lab[q] = 1;
      stack.push(q);
    }
  };
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % W;
    if (x > 0) plainStep(p - 1);
    if (x < W - 1) plainStep(p + 1);
    if (p >= W) plainStep(p - W);
    if (p < N - W) plainStep(p + W);
  }
  // The background also takes the soft shadow or reflection under the product (the film draws its
  // own floor shadow): what it reaches from there without crossing an edge, colourless, no darker
  // than a shadow on white, and only below the product's lowest definite feature (colour, a dark
  // tone or a strong edge) in that column. White faces, which can fade into a white backdrop with
  // no outline at all, are never under the product, so they stay.
  const core = (p: number) => chroma[p] >= 18 || dist[p] >= 110 || grad[p] >= 14;
  const floor = new Int32Array(W).fill(-1);
  let coreTop = H;
  let coreBottom = -1;
  for (let p = 0; p < N; p++) {
    if (lab[p] || !core(p)) continue;
    const x = p % W;
    const y = (p - x) / W;
    if (y > floor[x]) floor[x] = y;
    if (y < coreTop) coreTop = y;
    if (y > coreBottom) coreBottom = y;
  }
  // Beside the product, a shadow only spreads at the height of its base.
  const sideLine = coreBottom - Math.max(4, (coreBottom - coreTop) * 0.12);
  const under = (p: number) => {
    const x = p % W;
    const y = (p - x) / W;
    return floor[x] >= 0 ? y > floor[x] : y > sideLine;
  };
  const shadowStep = (q: number) => {
    if (!lab[q] && grad[q] < 8 && chroma[q] <= 14 && dist[q] <= 95 && under(q)) {
      lab[q] = 1;
      stack.push(q);
    }
  };
  for (let p = 0; p < N; p++) if (lab[p] === 1) stack.push(p);
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % W;
    if (x > 0) shadowStep(p - 1);
    if (x < W - 1) shadowStep(p + 1);
    if (p >= W) shadowStep(p - W);
    if (p < N - W) shadowStep(p + W);
  }
  // Everything else that isn't on the outline band is product: colour, dark parts, white faces.
  for (let p = 0; p < N; p++) if (!lab[p] && grad[p] < 8) lab[p] = 2;
  // Watershed: both grow through the weakest edges first, meeting at the product's outline. A soft
  // shadow has no edge, so the background takes it; a white face joins the product it belongs to.
  const buckets: number[][] = Array.from({ length: 256 }, () => []);
  const push = (q: number) => buckets[grad[q]].push(q);
  for (let p = 0; p < N; p++) {
    if (!lab[p]) continue;
    const x = p % W;
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if (q >= 0 && q < N && !lab[q]) push(q);
  }
  const owner = (q: number) => {
    const x = q % W;
    // The neighbour label that reached it (background wins only where nothing else is next to it).
    let l = 0;
    for (const r of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, q - W, q + W]) {
      if (r < 0 || r >= N || !lab[r]) continue;
      if (lab[r] === 2) return 2;
      l = lab[r];
    }
    return l;
  };
  for (let level = 0; level < 256; level++) {
    const b = buckets[level];
    while (b.length) {
      const q = b.pop()!;
      if (lab[q]) continue;
      const l = owner(q);
      if (!l) continue;
      lab[q] = l;
      const x = q % W;
      for (const r of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, q - W, q + W]) {
        if (r < 0 || r >= N || lab[r]) continue;
        // Never step back to a lower level than the one being flooded.
        buckets[Math.max(level, grad[r])].push(r);
      }
    }
  }
  const bg = new Uint8Array(N);
  for (let p = 0; p < N; p++) bg[p] = lab[p] === 1 ? 1 : 0;
  // Enclosed gaps (a mug's handle): thick blobs of pure background colour inside the product.
  // Print (a white logo, lettering) is thin and stays.
  const seen = new Uint8Array(N);
  const gapMark = new Int32Array(N);
  let gapId = 0;
  const minGap = Math.max(60, N * 0.003);
  const thick = Math.max(6, Math.round(Math.min(W, H) * 0.025));
  for (let s0 = 0; s0 < N; s0++) {
    if (bg[s0] || seen[s0] || dist[s0] > 4) continue;
    const comp: number[] = [s0];
    seen[s0] = 1;
    for (let k = 0; k < comp.length; k++) {
      const p = comp[k];
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= N || seen[q] || bg[q] || dist[q] > 4) continue;
        seen[q] = 1;
        comp.push(q);
      }
    }
    if (comp.length < minGap) continue;
    // Thick: some pixel has the gap all around it for `thick` pixels.
    const mark = ++gapId;
    for (const p of comp) gapMark[p] = mark;
    const inGap = { has: (q: number) => gapMark[q] === mark };
    const deep = comp.some((p) => {
      const x = p % W;
      const y = (p - x) / W;
      if (x < thick || y < thick || x >= W - thick || y >= H - thick) return false;
      return [p - thick, p + thick, p - thick * W, p + thick * W, p - thick * (W + 1), p + thick * (W + 1), p - thick * (W - 1), p + thick * (W - 1)].every((q) => inGap.has(q));
    });
    if (!deep) continue;
    // Framed by product material (a contrasting edge), not by the smooth shading of a white face
    // whose brightest part this is.
    let ring = 0;
    let rn = 0;
    for (const p of comp) {
      const x = p % W;
      for (const q of [x > 2 ? p - 3 : -1, x < W - 3 ? p + 3 : -1, p - 3 * W, p + 3 * W]) {
        if (q < 0 || q >= N || inGap.has(q)) continue;
        ring += dist[q];
        rn++;
      }
    }
    if (rn && ring / rn >= 40) for (const p of comp) bg[p] = 1;
  }
  // Thin, light, colourless skirts left along the outline (the rim of a shadow or reflection):
  // a morphological opening finds what's thinner than a few pixels, and of that only the light
  // neutral pixels go (a thin dark or coloured part, like a strap or cable, stays).
  const r = Math.max(2, Math.round(Math.min(W, H) * 0.006));
  // One pass of a square erosion (max = false) or dilation (max = true) along rows or columns,
  // with a running count of set pixels in the window (outside the image counts as unset).
  const minPass = (src: Uint8Array, horizontal: boolean, max: boolean) => {
    const out = new Uint8Array(N);
    const full = 2 * r + 1;
    const len = horizontal ? W : H;
    const step = horizontal ? 1 : W;
    const lines = horizontal ? H : W;
    for (let line = 0; line < lines; line++) {
      const base = horizontal ? line * W : line;
      let count = 0;
      for (let k = 0; k <= r && k < len; k++) count += src[base + k * step];
      for (let k = 0, i = base; k < len; k++, i += step) {
        out[i] = max ? (count > 0 ? 1 : 0) : count === full ? 1 : 0;
        if (k + r + 1 < len) count += src[i + (r + 1) * step];
        if (k - r >= 0) count -= src[i - r * step];
      }
    }
    return out;
  };
  const solid = new Uint8Array(N);
  for (let p = 0; p < N; p++) solid[p] = bg[p] ? 0 : 1;
  // First a closing: a highlight stripe that runs out to the backdrop (a specular line down a
  // white earbud stem) is a thin white channel, not a gap: give it back to the product.
  // Next to a dark or coloured product, white is always backdrop: only light products get it.
  const closed = minPass(minPass(minPass(minPass(solid, true, true), false, true), true, false), false, false);
  const lightAround = (p: number) => {
    const x = p % W;
    const y = (p - x) / W;
    let strongest = 0;
    for (let dy = -4; dy <= 4; dy += 2)
      for (let dx = -4; dx <= 4; dx += 2) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const q = yy * W + xx;
        if (solid[q] && dist[q] > strongest) strongest = dist[q];
      }
    return strongest < 80;
  };
  const fill: number[] = [];
  for (let p = 0; p < N; p++) if (!solid[p] && closed[p] && dist[p] <= 12 && lightAround(p)) fill.push(p);
  for (const p of fill) {
    solid[p] = 1;
    bg[p] = 0;
  }
  const opened = minPass(minPass(minPass(minPass(solid, true, false), false, false), true, true), false, true);
  for (let p = 0; p < N; p++) if (solid[p] && !opened[p] && dist[p] < 45 && chroma[p] <= 12) bg[p] = 1;
  // Specks: keep only pieces of the product of a real size.
  const label = new Int32Array(N).fill(-1);
  const sizes: number[] = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (bg[s0] || label[s0] >= 0) continue;
    const id = sizes.length;
    const comp = [s0];
    label[s0] = id;
    for (let k = 0; k < comp.length; k++) {
      const p = comp[k];
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= N || bg[q] || label[q] >= 0) continue;
        label[q] = id;
        comp.push(q);
      }
    }
    sizes.push(comp.length);
  }
  const biggest = Math.max(0, ...sizes);
  if (!biggest) return null;
  // Per piece: bounds and how light it is, to drop thin light strips (what's left of a shadow or
  // reflection under the product) as well as specks.
  const bx0 = sizes.map(() => W), by0 = sizes.map(() => H), bx1 = sizes.map(() => 0), by1 = sizes.map(() => 0);
  const light = sizes.map(() => 0);
  for (let p = 0; p < N; p++) {
    const l = label[p];
    if (l < 0) continue;
    const x = p % W;
    const y = (p - x) / W;
    if (x < bx0[l]) bx0[l] = x;
    if (x > bx1[l]) bx1[l] = x;
    if (y < by0[l]) by0[l] = y;
    if (y > by1[l]) by1[l] = y;
    light[l] += dist[p];
  }
  const keepSize = Math.max(24, biggest * 0.004);
  const drop = sizes.map((n, l) => {
    if (n < keepSize) return true;
    if (n === biggest) return false;
    const h = by1[l] - by0[l] + 1;
    const w = bx1[l] - bx0[l] + 1;
    return h <= Math.max(4, H * 0.035) && w >= h * 4 && light[l] / n < 40;
  });
  for (let p = 0; p < N; p++) if (!bg[p] && drop[label[p]]) bg[p] = 1;
  // Matte the outline and write alpha (on pixels within 2px of the background).
  const nearBg = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const b0 = y * W + x;
      // Only background pixels on the outline spread the mark.
      if (!bg[b0] || ((x === 0 || bg[b0 - 1]) && (x === W - 1 || bg[b0 + 1]) && (y === 0 || bg[b0 - W]) && (y === H - 1 || bg[b0 + W]))) continue;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W && !bg[yy * W + xx]) nearBg[yy * W + xx] = 1;
        }
      }
    }
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const i = p * 4;
      if (bg[p]) {
        px[i + 3] = 0;
        continue;
      }
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      // Within 2px of the background?
      if (!nearBg[p] || dist[p] > 60) continue;
      // The product just inside: the strongest pixel 2-3px away that isn't background.
      let ref = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = yy * W + xx;
          if (!bg[q] && dist[q] > ref) ref = dist[q];
        }
      // A light product (little contrast with the background) keeps a firm edge.
      const a = ref >= 40 ? clamp(dist[p] / ref) : clamp(0.55 + (dist[p] / Math.max(1, ref)) * 0.45);
      if (a < 0.08) {
        px[i + 3] = 0;
        continue;
      }
      // Take the background mixed into the edge back out of its colour.
      if (a < 1)
        for (let ch = 0; ch < 3; ch++) px[i + ch] = clamp(med[ch] + (px[i + ch] - med[ch]) / a, 0, 255);
      px[i + 3] = Math.round(px[i + 3] * a);
    }
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

const cards = new Map<string, HTMLCanvasElement>();
/**
 * A product photo as a studio card for galleries: the cut-out product on a soft gradient in the
 * film's colours with a floor shadow, instead of a flat white rectangle. Photos that aren't on a
 * white background (lifestyle shots) are returned as they are.
 */
export function studioCard(img: HTMLImageElement, key: string, aspect: number, p: Palette): HTMLCanvasElement | HTMLImageElement {
  const cut = productCutout(img, key);
  if (!cut?.cut) return img;
  const id = `${key}@${aspect.toFixed(2)}${p.bg0}${p.primary}`;
  const hit = cards.get(id);
  if (hit) return hit;
  const ch = 900;
  const cw = Math.round(ch * aspect);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  const top = p.light ? mixHex(p.bg1, p.primary, 0.05) : mixHex(p.bg1, p.primary, 0.14);
  const floor = p.light ? mixHex(p.bg0, p.text, 0.06) : mixHex(p.bg0, "#000000", 0.25);
  const bg = g.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, top);
  bg.addColorStop(0.68, p.light ? p.bg1 : mixHex(p.bg1, p.bg0, 0.4));
  bg.addColorStop(1, floor);
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  const spot = g.createRadialGradient(cw / 2, ch * 0.42, 0, cw / 2, ch * 0.42, Math.max(cw, ch) * 0.55);
  spot.addColorStop(0, rgba(p.light ? "#ffffff" : p.primary, p.light ? 0.8 : 0.22));
  spot.addColorStop(1, rgba(p.light ? "#ffffff" : p.primary, 0));
  g.fillStyle = spot;
  g.fillRect(0, 0, cw, ch);
  const src = cut.canvas;
  const k = Math.min((cw * 0.7) / src.width, (ch * 0.7) / src.height);
  const pw = src.width * k;
  const ph = src.height * k;
  const x = (cw - pw) / 2;
  const y = (ch - ph) / 2 - ch * 0.03;
  g.save();
  g.translate(cw / 2, y + ph + ch * 0.015);
  g.scale(1, 0.12);
  const sh = g.createRadialGradient(0, 0, 0, 0, 0, pw * 0.6);
  sh.addColorStop(0, `rgba(0,0,0,${p.light ? 0.3 : 0.6})`);
  sh.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sh;
  g.beginPath();
  g.arc(0, 0, pw * 0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.imageSmoothingQuality = "high";
  g.drawImage(src, x, y, pw, ph);
  cards.set(id, c);
  return c;
}

/** The scene's product photo: its own media, else the first listing image. */
function productImage(sc: SkillContext): { img: HTMLImageElement; key: string } | null {
  const src = sc.scene.media?.kind === "image" ? sc.scene.media.src : sc.brand?.images?.[0];
  const img = getImage(src);
  if (!img || !src || !img.naturalWidth) return null;
  // The reveal, the close-ups and the end card stand the product on the stage: when this photo is a lifestyle
  // shot, the first photo that cuts out cleanly takes its place.
  if ((sc.scene.role === "reveal" || sc.scene.role === "cta" || sc.scene.skill === "product-zoom") && !productCutout(img, src)?.cut) {
    for (const alt of sc.brand?.images ?? []) {
      const a = getImage(alt);
      if (a?.naturalWidth && productCutout(a, alt)?.cut) return { img: a, key: alt };
    }
  }
  return { img, key: src };
}

function calloutItems(scene: Scene) {
  return (scene.items ?? []).map((x) => x.split(/\s+[—–]\s+/)[0].trim()).filter(Boolean).slice(0, 4);
}

function heroTiming(scene: Scene, beat: number) {
  const n = calloutItems(scene).length;
  const land = 0.15;
  const first = 0.9;
  const room = Math.max(0.3, (scene.duration - first - 1.4) / Math.max(1, n));
  const step = Math.min(Math.max(0.45, beat * 2), room);
  return { land, calls: Array.from({ length: n }, (_, i) => first + i * step) };
}

/** Draw the product (cut-out or rounded photo) centred in a box, with floor shadow, reflection and sheen. */
function drawProduct(sc: SkillContext, cx: number, cy: number, boxW: number, boxH: number, k: number, alpha: number, pi = productImage(sc)) {
  const { ctx, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  if (!pi) return null;
  const cut = productCutout(pi.img, pi.key);
  if (!cut) return null;
  const src = cut.canvas;
  const s = Math.min(boxW / src.width, boxH / src.height);
  const pw = src.width * s;
  const ph = src.height * s;
  // Rise in on a spring, then float gently; a slow push keeps it alive.
  const rise = (1 - Math.min(1, k)) * boxH * 0.35;
  const bob = Math.sin(T * 1.2) * 7 * u;
  const push = 1 + 0.035 * range(sc.t, 0, sc.d);
  const scale = (0.86 + 0.14 * Math.min(1, k)) * push;
  // Turntable sway: once landed the product turns a few degrees each way and leans with its
  // float, so it reads as an object in space rather than a pasted photo.
  const live = clamp(k);
  const yaw = Math.sin(T * 0.5) * 0.06 * live;
  const lean = Math.sin(T * 0.8 + 1) * 0.012 * live;
  const floorY = cy + ph / 2;
  backLight(sc, cx, cy + rise, pw * 0.7, ph * 0.6, alpha * clamp(k));
  ctx.save();
  ctx.globalAlpha = alpha;
  if (cut.cut) {
    // Floor shadow: tightens as the product settles.
    ctx.save();
    ctx.translate(cx, floorY + 6 * u);
    ctx.scale(1, 0.13);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, pw * 0.62);
    sh.addColorStop(0, `rgba(0,0,0,${palette.light ? 0.28 : 0.55})`);
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.globalAlpha = alpha * clamp(k) * (1 - clamp(bob / (40 * u)));
    ctx.beginPath();
    ctx.arc(0, 0, pw * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Soft reflection on the floor: the product flipped and squashed, faded out by a mask (so
    // no box is painted over the stage), turning with the product's sway.
    const rh = Math.max(1, Math.ceil(ph * 0.55));
    const refl = scratch("product-reflection", Math.max(1, Math.ceil(pw)), rh);
    refl.ctx.setTransform(1, 0, 0, -0.55, 0, ph * 0.55);
    refl.ctx.drawImage(src, 0, 0, pw, ph);
    refl.ctx.setTransform(1, 0, 0, 1, 0, 0);
    refl.ctx.globalCompositeOperation = "destination-in";
    const mask = refl.ctx.createLinearGradient(0, 0, 0, rh);
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(0.65, "rgba(0,0,0,0)");
    refl.ctx.fillStyle = mask;
    refl.ctx.fillRect(0, 0, pw, rh);
    ctx.save();
    ctx.translate(cx, cy + rise + bob + (ph * scale) / 2 - ph * 0.01);
    ctx.scale(scale * (1 - Math.abs(yaw) * 0.5), scale);
    ctx.transform(1, -yaw * 0.3, 0, 1, 0, 0);
    ctx.globalAlpha = alpha * (palette.light ? 0.14 : 0.2) * clamp(k);
    ctx.drawImage(refl.canvas, 0, 0, pw, rh, -pw / 2, 0, pw, rh);
    ctx.restore();
  }
  // The product itself, with a light sweep across it (clipped to its own shape).
  const layer = scratch("product-hero", Math.max(1, Math.ceil(pw)), Math.max(1, Math.ceil(ph)));
  const lc = layer.ctx;
  if (cut.cut) lc.drawImage(src, 0, 0, pw, ph);
  else {
    lc.save();
    lc.beginPath();
    lc.roundRect(0, 0, pw, ph, 22 * u);
    lc.clip();
    lc.drawImage(src, 0, 0, pw, ph);
    lc.restore();
  }
  const sweep = ((sc.t - 0.5) / 2.6) % 1.4;
  if (sweep > 0 && sweep < 1.2) {
    lightSweep(lc, 0, 0, pw, ph, sweep / 1.2, { alpha: 0.32, width: 0.18, op: "source-atop" });
  }
  ctx.translate(cx, cy + rise + bob);
  ctx.rotate(lean);
  ctx.scale(scale * (1 - Math.abs(yaw) * 0.5), scale);
  ctx.transform(1, yaw * 0.3, 0, 1, 0, 0);
  if (!cut.cut) {
    ctx.shadowColor = `rgba(0,0,0,${palette.light ? 0.25 : 0.5})`;
    ctx.shadowBlur = 50 * u;
    ctx.shadowOffsetY = 20 * u;
  } else if (!palette.light) {
    // A rim of the brand colour behind the product separates it from a dark stage.
    ctx.shadowColor = rgba(palette.primary, 0.35);
    ctx.shadowBlur = 60 * u;
  }
  ctx.drawImage(layer.canvas, 0, 0, pw, ph, -pw / 2, -ph / 2, pw, ph);
  ctx.restore();
  return { x: cx - (pw * scale) / 2, y: cy + rise + bob - (ph * scale) / 2, w: pw * scale, h: ph * scale, src, cut: cut.cut };
}

/** A feature chip: icon tile + short title, on glass. */
function callout(sc: SkillContext, text: string, icon: string, cx: number, cy: number, k: number, align: "left" | "right" | "center") {
  const { ctx, u, palette, w, h } = sc;
  const portrait = h >= w * 0.95;
  const fs = (portrait ? 36 : 33) * u;
  ctx.save();
  ctx.font = subFont(fs, 650);
  // Long callouts wrap onto two lines inside the chip rather than being squeezed.
  const fit = fitTextLines(ctx, text, w * (portrait ? 0.32 : 0.24), { maxLines: 2, minScale: 0.75 });
  const tw = fit.width;
  const ih = fs * 2.1;
  const cw = tw + ih + fs * 1.4;
  const x = align === "left" ? cx - cw : align === "right" ? cx : cx - cw / 2;
  const y = cy - ih / 2;
  const kk = clamp(k, 0, 1.1);
  ctx.globalAlpha *= clamp(k * 2);
  ctx.translate(x + cw / 2, cy);
  ctx.scale(0.85 + 0.15 * kk, 0.85 + 0.15 * kk);
  ctx.translate(-(x + cw / 2), -cy);
  glassCard(sc, x, y, cw, ih, { r: ih / 2 });
  const ts = ih * 0.72;
  const tx = x + ih / 2;
  ctx.beginPath();
  ctx.arc(tx, cy, ts / 2, 0, Math.PI * 2);
  const tile = ctx.createLinearGradient(tx - ts / 2, cy - ts / 2, tx + ts / 2, cy + ts / 2);
  tile.addColorStop(0, palette.primary);
  tile.addColorStop(1, palette.secondary);
  ctx.fillStyle = tile;
  ctx.fill();
  drawIcon(ctx, icon, tx, cy, ts * 0.58, palette.light ? "#ffffff" : palette.bg0, clamp(k * 1.4));
  ctx.fillStyle = palette.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  fillTextFit(ctx, text, x + ih + fs * 0.35, cy, tw + 1, { maxLines: 2, lineHeight: 1.08, minScale: 0.75 });
  ctx.restore();
  return { x, y, w: cw, h: ih };
}

/**
 * Product Hero: the product photo on the stage. Without items it's the reveal: the product rises
 * in with the name beneath. With items, the features are called out around it one by one, each
 * chip joined to the product by a hairline.
 */
function productHero(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  // Square frames stack the callouts under the product too (side columns would run off the edge).
  const portrait = h >= w * 0.95;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const items = calloutItems(scene);
  const T = heroTiming(scene, sc.beat);
  const k = clamp(spring(t - T.land, 7, 6), 0, 1.06);
  const alpha = clamp((t - T.land) / 0.25) * (1 - ex);
  if (!items.length) {
    // The reveal: product centre stage, the name and subtext beneath.
    const box = portrait ? { w: w * 0.78, h: h * 0.42, cy: h * 0.4 } : { w: w * 0.46, h: h * 0.56, cy: h * 0.41 };
    drawProduct(sc, w / 2, box.cy, box.w, box.h, k, alpha);
    const layout = sentence(sc, { cy: h * (portrait ? 0.72 : 0.8), sizeFrac: portrait ? 0.085 : 0.075, widthFrac: 0.84, maxLines: 2 });
    blurInLayout(sc, layout, 0.55, 0.07, { exitAt: d - 0.4 });
    if (scene.subtext) {
      const sk = ease.outCubic(range(t, 0.9, 1.4)) * (1 - ex);
      ctx.save();
      ctx.globalAlpha = sk;
      ctx.font = subFont((portrait ? 34 : 30) * u, 500);
      ctx.fillStyle = rgba(palette.text, 0.7);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const last = layout.ys[layout.ys.length - 1] ?? h * 0.8;
      ctx.fillText(scene.subtext.replace(/\*/g, ""), w / 2, last + layout.size * 0.85 + (1 - sk) * 10 * u, w * 0.8);
      ctx.restore();
    }
    return;
  }
  topHeadline(sc);
  const box = portrait ? { w: w * 0.72, h: h * 0.36, cx: w / 2, cy: h * 0.46 } : { w: w * 0.34, h: h * 0.56, cx: w / 2, cy: h * 0.6 };
  const rect = drawProduct(sc, box.cx, box.cy, box.w, box.h, k, alpha);
  const icons = iconsFor(items, sc);
  items.forEach((text, i) => {
    const lt = t - T.calls[i];
    if (lt <= 0) return;
    const ck = clamp(spring(lt, 10, 6.5), 0, 1.1);
    let cx: number, cy: number, align: "left" | "right" | "center";
    if (portrait) {
      // Two columns of chips under the product.
      align = "center";
      cx = w * (i % 2 ? 0.73 : 0.27);
      cy = h * (0.73 + Math.floor(i / 2) * 0.08);
    } else {
      // Alternating left and right of the product.
      const left = i % 2 === 0;
      align = left ? "left" : "right";
      cx = left ? w * 0.33 : w * 0.67;
      const row = Math.floor(i / 2);
      const rows = Math.ceil(items.length / 2);
      cy = h * (rows === 1 ? 0.58 : 0.47 + row * 0.24);
    }
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    const chip = callout(sc, text, icons[i], cx, cy, ck, align);
    // Hairline from the chip to a point on the product.
    if (rect) {
      const ax = portrait ? rect.x + rect.w * (i % 2 ? 0.7 : 0.3) : rect.x + rect.w * (align === "left" ? 0.28 : 0.72);
      const ay = portrait ? rect.y + rect.h * 0.82 : Math.min(rect.y + rect.h * 0.85, Math.max(rect.y + rect.h * 0.15, cy));
      const sx = portrait ? chip.x + chip.w / 2 : align === "left" ? chip.x + chip.w : chip.x;
      const sy = portrait ? chip.y : cy;
      const lk = ease.outCubic(range(lt, 0.1, 0.5));
      ctx.strokeStyle = rgba(palette.text, 0.45);
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (ax - sx) * lk, sy + (ay - sy) * lk);
      ctx.stroke();
      if (lk > 0.95) {
        ctx.fillStyle = palette.primary;
        ctx.beginPath();
        ctx.arc(ax, ay, 5 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(palette.primary, 0.4 * (1 - range(lt, 0.5, 1.2)));
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.arc(ax, ay, 5 * u + 16 * u * range(lt, 0.5, 1.2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

/**
 * Product End Card: the product beside the closing line and the button (stacked in vertical
 * films), with the brand above the line. The button presses on the final beat, like the SaaS
 * end card; the product keeps floating so the last frame is a clean thumbnail.
 */
function productEnd(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, brand } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  const T = ctaTiming(d, sc.beat);
  const k = clamp(spring(t - 0.05, 7, 6), 0, 1.06);
  const S = portrait ? 1.3 : 1;
  // The product: left of centre (landscape) or above the text (portrait).
  const box = portrait ? { cx: w / 2, cy: h * 0.33, w: w * 0.74, h: h * 0.34 } : { cx: w * 0.31, cy: h * 0.47, w: w * 0.34, h: h * 0.48 };
  drawProduct(sc, box.cx, box.cy, box.w, box.h, k, clamp(t / 0.25));
  const tx = portrait ? w / 2 : w * 0.68;
  // Brand name above the line.
  const nk = ease.outCubic(range(t, 0.25, 0.7));
  const nameY = portrait ? h * 0.58 : h * 0.3;
  if (brand?.name && nk > 0) {
    ctx.save();
    ctx.globalAlpha = nk;
    ctx.font = subFont(30 * u * S, 700);
    ctx.fillStyle = rgba(palette.text, 0.7);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brand.name.toUpperCase().split("").join("\u200A"), tx, nameY + (1 - nk) * 10 * u);
    ctx.restore();
  }
  const layout = sentence(sc, { cy: portrait ? h * 0.66 : h * 0.44, sizeFrac: portrait ? 0.1 : 0.085, widthFrac: portrait ? 0.86 : 0.5, maxLines: 2 });
  ctx.save();
  ctx.translate(tx - w / 2, 0);
  blurInLayout(sc, layout, 0.3, 0.07, { exitAt: d + 1 });
  ctx.restore();
  const by = layout.ys[layout.ys.length - 1] + layout.size * 0.6 + 70 * u;
  const button = ctaButton(sc, tx, by, S, T);
  ctaCursor(sc, tx + button.bw * 0.1, by + 4 * u, T);
}

/* ───────────────────────── Every Angle ───────────────────────── */

/** The product's photos (up to 6), each with its cache key. */
function productPhotos(sc: SkillContext) {
  const srcs = [...new Set([...(sc.scene.media?.kind === "image" ? [sc.scene.media.src] : []), ...(sc.brand?.images ?? [])])].slice(0, 6);
  return srcs.map((key) => ({ key, img: getImage(key) })).filter((p): p is { key: string; img: HTMLImageElement } => !!p.img && !!p.img.naturalWidth);
}

function spinTiming(d: number, n: number) {
  const start = 0.35;
  const seg = (d - start - 0.3) / Math.max(1, n);
  return { start, seg, swap: Math.min(0.5, seg * 0.35) };
}

/**
 * Every Angle: the product's photos take turns on the same spot of the stage, each sliding off
 * level to one side as the next glides in from the other, over one floor shadow, with a row of
 * dots counting the angles. A turntable feel without ever tilting the product.
 */
function productSpin(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  topHeadline(sc);
  const photos = productPhotos(sc);
  if (!photos.length) return;
  const n = photos.length;
  const T = spinTiming(d, n);
  const box = portrait ? { cx: w / 2, cy: h * 0.52, w: w * 0.78, h: h * 0.4 } : { cx: w / 2, cy: h * 0.56, w: w * 0.42, h: h * 0.5 };
  const ex = ease.inCubic(exitT(sc, 0.4));
  const i = clamp(Math.floor((t - T.start) / T.seg), 0, n - 1);
  const into = t - T.start - i * T.seg;
  const k = clamp(spring(t - 0.1, 7, 6), 0, 1.06);
  // The swap: the previous angle slides off as this one arrives.
  const sw = i > 0 ? ease.inOutCubic(clamp(into / T.swap)) : 1;
  const slide = box.w * 0.55;
  if (i > 0 && sw < 1) {
    ctx.save();
    ctx.translate(-slide * sw, 0);
    drawProduct(sc, box.cx, box.cy, box.w, box.h, 1, (1 - sw) * (1 - ex), photos[i - 1]);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(slide * (1 - sw), 0);
  drawProduct(sc, box.cx, box.cy, box.w, box.h, i === 0 ? k : 1, clamp(t / 0.25) * sw * (1 - ex), photos[i]);
  ctx.restore();
  // Angle dots.
  const dy = portrait ? h * 0.86 : h * 0.92;
  const gap = 22 * u;
  for (let j = 0; j < n; j++) {
    const on = j === i ? sw : j === i - 1 ? 1 - sw : 0;
    ctx.save();
    ctx.globalAlpha = (0.35 + 0.65 * on) * (1 - ex) * clamp(t / 0.4);
    ctx.fillStyle = on > 0.5 ? palette.primary : palette.text;
    const x = w / 2 + (j - (n - 1) / 2) * gap;
    ctx.beginPath();
    ctx.roundRect(x - (5 + 8 * on) * u, dy - 5 * u, (10 + 16 * on) * u, 10 * u, 5 * u);
    ctx.fill();
    ctx.restore();
  }
}

/* ───────────────────────── Detail Zoom ───────────────────────── */

const detailCache = new Map<string, [number, number][]>();
/**
 * Where the product has the most detail: cells of the cut-out with the most opaque, busy pixels
 * (edges, buttons, textures), picked well apart. Fractions of the cut-out's width and height.
 */
function detailPoints(src: HTMLCanvasElement, key: string, want = 3): [number, number][] {
  const hit = detailCache.get(key);
  if (hit) return hit;
  const N = 12;
  const pts: { x: number; y: number; s: number }[] = [];
  try {
    const W = 144;
    const H = Math.max(1, Math.round((W * src.height) / src.width));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(src, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const at = (x: number, y: number) => (y * W + x) * 4;
    const lum = (i: number) => 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    // Per cell: how much of it is product, and how busy (edges + colour) it is inside.
    const cover: number[] = [];
    const busy: number[] = [];
    for (let cy = 0; cy < N; cy++)
      for (let cx = 0; cx < N; cx++) {
        let opaque = 0;
        let cells = 0;
        let edge = 0;
        let chroma = 0;
        for (let y = Math.floor((cy * H) / N); y < Math.floor(((cy + 1) * H) / N) - 1; y++)
          for (let x = Math.floor((cx * W) / N); x < Math.floor(((cx + 1) * W) / N) - 1; x++) {
            cells++;
            const i = at(x, y);
            if (px[i + 3] < 200) continue;
            opaque++;
            const r = at(x + 1, y);
            const d = at(x, y + 1);
            if (px[r + 3] >= 200) edge += Math.abs(lum(i) - lum(r));
            if (px[d + 3] >= 200) edge += Math.abs(lum(i) - lum(d));
            chroma += Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
          }
        cover.push(cells ? opaque / cells : 0);
        busy.push(cells ? (edge + chroma * 1.5) / cells : 0);
      }
    // Only cells well inside the product (they and their neighbours are all product), so the lens
    // never magnifies empty background at the outline.
    for (let cy = 1; cy < N - 1; cy++)
      for (let cx = 1; cx < N - 1; cx++) {
        const i = cy * N + cx;
        const inside = [i, i - 1, i + 1, i - N, i + N].every((j) => cover[j] > 0.92);
        if (inside) pts.push({ x: (cx + 0.5) / N, y: (cy + 0.5) / N, s: busy[i] });
      }
  } catch {
    /* unreadable: fall back below */
  }
  pts.sort((a, b) => b.s - a.s);
  const out: [number, number][] = [];
  for (const p of pts) {
    if (out.every(([x, y]) => Math.hypot(x - p.x, y - p.y) > 0.28)) out.push([p.x, p.y]);
    if (out.length >= want) break;
  }
  const fallback: [number, number][] = [[0.5, 0.45], [0.38, 0.6], [0.62, 0.6]];
  while (out.length < want) out.push(fallback[out.length]);
  // Visit them in reading order, so the lens travels smoothly.
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  detailCache.set(key, out);
  return out;
}

/**
 * The lens's stops: the ones set in the studio (in their order), topped up with the automatic
 * ones (the product's most detailed parts) so there are always three.
 */
function lensStops(scene: Scene, src: HTMLCanvasElement, key: string): [number, number][] {
  const auto = detailPoints(src, key, 3);
  const own = scene.zoom?.points ?? [];
  if (!own.length) return auto;
  const out = own.slice(0, 3).map(([x, y]) => [clamp(x, 0, 1), clamp(y, 0, 1)] as [number, number]);
  for (const p of auto) if (out.length < 3 && out.every(([x, y]) => Math.hypot(x - p[0], y - p[1]) > 0.15)) out.push(p);
  return out;
}

/**
 * For the studio's lens editor: the product cut-out the lens magnifies and the stops it visits
 * (null until the photo has loaded).
 */
export function zoomLensSource(scene: Scene, brand: SkillContext["brand"]) {
  const pi = productImage({ scene, brand } as SkillContext);
  if (!pi) return null;
  const cut = productCutout(pi.img, pi.key);
  if (!cut) return null;
  return { canvas: cut.canvas, auto: detailPoints(cut.canvas, pi.key, 3), stops: lensStops(scene, cut.canvas, pi.key) };
}

function zoomTiming(d: number, n: number) {
  const first = 0.9;
  const each = (d - first - 0.5) / Math.max(1, n);
  return { first, each, move: Math.min(0.55, each * 0.4) };
}

/**
 * Detail Zoom: the product centre stage while a magnifying lens glides to its most detailed
 * parts in turn, enlarging each, with the feature it shows called out beside the lens.
 */
function productZoom(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h >= w * 0.95;
  topHeadline(sc);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const k = clamp(spring(t - 0.1, 7, 6), 0, 1.06);
  const box = portrait ? { cx: w / 2, cy: h * 0.55, w: w * 0.78, h: h * 0.46 } : { cx: w / 2, cy: h * 0.58, w: w * 0.44, h: h * 0.6 };
  const rect = drawProduct(sc, box.cx, box.cy, box.w, box.h, k, clamp(t / 0.25) * (1 - ex));
  if (!rect) return;
  const pi = productImage(sc);
  const pts = lensStops(scene, rect.src, pi?.key ?? "product");
  const labels = calloutItems(scene);
  const T = zoomTiming(d, pts.length);
  if (t < T.first - T.move) return;
  // Which stop, and how far between the previous and this one.
  const idx = clamp(Math.floor((t - T.first) / T.each), 0, pts.length - 1);
  const local = t - T.first - idx * T.each;
  const mv = idx === 0 ? ease.outCubic(clamp((t - (T.first - T.move)) / T.move)) : ease.inOutCubic(clamp(local / T.move));
  const from = idx === 0 ? [0.5, 1.1] : pts[idx - 1];
  const to = pts[idx];
  const fx = from[0] + (to[0] - from[0]) * mv;
  const fy = from[1] + (to[1] - from[1]) * mv;
  // Lens size and zoom strength as set in the studio (× the defaults).
  const R = Math.min(w, h) * (portrait ? 0.17 : 0.14) * clamp(scene.zoom?.size ?? 1, 0.6, 1.6);
  // The lens sits over the spot it magnifies, kept inside the frame and below the headline (it
  // still shows exactly that spot, wherever it has to sit).
  const lx = clamp(rect.x + fx * rect.w, w * 0.05 + R, w * 0.95 - R);
  const ly = clamp(rect.y + fy * rect.h, h * (portrait ? 0.2 : 0.17) + R, h * 0.93 - R);
  const zoom = clamp(scene.zoom?.power ?? 2.7, 1.5, 4.5);
  const appear = idx === 0 ? mv : 1;
  ctx.save();
  ctx.globalAlpha = appear * (1 - ex);
  // Lens shadow and glass.
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 14 * u;
  ctx.fillStyle = palette.light ? mixHex(palette.bg0, palette.text, 0.05) : palette.bg1;
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // The magnified product inside the lens.
  ctx.save();
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.clip();
  const sx = fx * rect.src.width;
  const sy = fy * rect.src.height;
  const scale = (rect.w / rect.src.width) * zoom;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(rect.src, lx - sx * scale, ly - sy * scale, rect.src.width * scale, rect.src.height * scale);
  // Glass highlight.
  const gl = ctx.createLinearGradient(lx - R, ly - R, lx + R * 0.2, ly + R * 0.2);
  gl.addColorStop(0, "rgba(255,255,255,0.35)");
  gl.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  const inner = ctx.createRadialGradient(lx, ly, R * 0.72, lx, ly, R);
  inner.addColorStop(0, "rgba(0,0,0,0)");
  inner.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = inner;
  ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  ctx.restore();
  // Rim.
  ctx.lineWidth = 6 * u;
  ctx.strokeStyle = palette.light ? "#ffffff" : rgba(palette.text, 0.9);
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(lx, ly, R + 5 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // The feature this stop shows, beside the lens on the open side.
  const label = labels[idx];
  if (label) {
    const lk = clamp(spring(local - T.move, 10, 6.5), 0, 1.1);
    if (lk > 0) {
      const right = lx < w / 2;
      const cx = portrait ? w / 2 : right ? lx + R + 30 * u : lx - R - 30 * u;
      const cy = portrait ? Math.min(h * 0.9, ly + R + 60 * u) : ly;
      ctx.save();
      ctx.globalAlpha = 1 - ex;
      callout(sc, label, iconsFor(labels, sc)[idx], cx, cy, lk, portrait ? "center" : right ? "right" : "left");
      ctx.restore();
    }
  }
}

/* ───────────────────────── Trailer Cold Open ───────────────────────── */

/** The cold open's words: one per shot (the feature titles), or its headline alone. */
function teaserWords(scene: Scene) {
  const items = calloutItems(scene).slice(0, 3);
  return items.length ? items : [scene.text].filter(Boolean);
}

/**
 * Shots share the scene (it starts on a beat and lasts whole beats, so the cuts land on the music);
 * the last moments flash white into the reveal.
 */
function teaserTiming(d: number, n: number, beat: number) {
  const out = Math.min(0.45, d * 0.1, beat);
  const seg = (d - out) / Math.max(1, n);
  return { seg, end: d - out, out };
}

/**
 * Trailer Cold Open: the movie-trailer start of a product video. Hard cuts on the beat between
 * tight, slowly pushing close-ups of the product's photos (on its most detailed parts), each with
 * one big word, a light flash on every cut and cinema bars, then a white flash into the reveal.
 */
function productTeaser(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, beat } = sc;
  const portrait = h >= w * 0.95;
  saasBackground(sc, { beams: 0, grid: false });
  // Trailers live in the dark: dark stages go darker still (light stages keep their look).
  if (!palette.light) {
    ctx.fillStyle = rgba("#000000", 0.55);
    ctx.fillRect(0, 0, w, h);
  }
  const photos = productPhotos(sc);
  const words = teaserWords(scene);
  const n = Math.max(1, words.length);
  const T = teaserTiming(d, n, beat);
  const i = clamp(Math.floor(t / T.seg), 0, n - 1);
  const local = t - i * T.seg;
  const shotT = clamp(local / T.seg);
  const pic = photos.length ? photos[i % photos.length] : null;
  if (pic) {
    const cut = productCutout(pic.img, pic.key);
    const src: HTMLCanvasElement | HTMLImageElement = cut?.canvas ?? pic.img;
    const sw = src.width;
    const sh = src.height;
    const focus = cut ? detailPoints(cut.canvas, `${pic.key}#teaser`, 3)[i % 3] : [0.5, 0.5];
    // Close-up, wider, closer: each shot frames the product differently, pushing in slowly. The
    // product's longest side is sized against the frame's shorter side, so a close-up crops into
    // it without ever filling the frame with one flat surface (its outline always shows).
    const side = i % 2 ? -1 : 1;
    const short = Math.min(w, h);
    const size = [1.25, 0.8, 1.05][i % 3] * (1 + 0.08 * ease.outQuad(shotT));
    const scale = (short * size) / Math.max(sw, sh);
    const dw = sw * scale;
    const dh = sh * scale;
    // The detail sits off-centre (alternating sides on wide frames), above the word.
    const fxp = portrait ? w * 0.5 : w * (0.5 + side * 0.14);
    const fyp = portrait ? h * 0.42 : h * 0.46;
    const drift = side * 18 * u * shotT;
    // Keep at least a third of the product's outline inside the frame on every side it crosses.
    const x = clamp(fxp - focus[0] * dw + drift, Math.min(0, w - dw) - dw * 0.3, Math.max(0, w - dw) + dw * 0.3);
    const y = clamp(fyp - focus[1] * dh, Math.min(0, h * 0.72 - dh) - dh * 0.25, h * 0.08);
    // A pool of key light behind the product.
    if (cut?.cut) {
      const g = ctx.createRadialGradient(fxp, fyp, 0, fxp, fyp, Math.max(w, h) * 0.55);
      g.addColorStop(0, rgba(palette.primary, palette.light ? 0.18 : 0.32));
      g.addColorStop(1, rgba(palette.primary, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.save();
    ctx.globalAlpha = clamp(local / 0.06);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, x, y, dw, dh);
    ctx.restore();
    // A light sweep across the shot.
    const sx = -w * 0.3 + (w * 1.6) * ease.inOutCubic(shotT);
    const sweep = ctx.createLinearGradient(sx - 160 * u, 0, sx + 160 * u, h * 0.3);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.5, `rgba(255,255,255,${palette.light ? 0.12 : 0.1})`);
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
    ctx.fillStyle = sweep;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // Vignette and a scrim where the word sits.
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${palette.light ? 0.18 : 0.6})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  const wordY = portrait ? h * 0.76 : h * 0.8;
  const scrim = ctx.createLinearGradient(0, wordY - h * 0.22, 0, h);
  scrim.addColorStop(0, rgba(palette.bg0, 0));
  scrim.addColorStop(1, rgba(palette.bg0, 0.85));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, wordY - h * 0.22, w, h);
  // The word for this shot, in the style's own type treatment.
  const word = words[i];
  if (word && t < T.end) {
    const shot = { ...sc, t: local, d: T.seg };
    const layout = sentence(shot, { text: word, cy: wordY, sizeFrac: portrait ? 0.1 : 0.09, widthFrac: 0.8, maxLines: 2 });
    blurInLayout(shot, layout, 0.04, 0.05, { exitAt: T.seg - 0.32 });
  }
  // Cinema bars (wide frames only).
  if (!portrait) {
    const bar = Math.max(0, (h - w / 2.39) / 2) * ease.outCubic(clamp(t / 0.4)) * (1 - ease.inCubic(clamp((t - T.end) / T.out)));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
  }
  // A flash on every cut, out of black at the start, and a white-out into the reveal.
  const flash = i > 0 ? 0.7 * (1 - clamp(local / 0.14)) : 0;
  const white = ease.inCubic(clamp((t - T.end) / T.out));
  if (flash + white > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(flash + white);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (t < 0.18) {
    ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.18})`;
    ctx.fillRect(0, 0, w, h);
  }
}

export const productSkills: Skill[] = [
  {
    id: "product-hero",
    name: "Product Hero",
    tagline: "Your product photo cut out of its white background, rising onto the stage with a floor shadow and light sweep; features called out around it one by one.",
    bestFor:
      "Physical products (marketplace listings, uploaded product photos). Without items: the product reveal (headline = product name, subtext = a short line). With items: 2-4 short feature callouts around the product (titles of 1-4 words).",
    sample: { text: "Meet *Aero Buds*", items: ["Noise cancelling", "USB-C charging", "Water resistant"] },
    itemsHint: "Feature callouts around the product (1-4 words each)",
    render: productHero,
    sfx: (scene, beat) => {
      const T = heroTiming(scene, beat);
      return [at(0.05, "whoosh"), at(T.land + 0.35, "shimmer"), ...T.calls.map((c) => at(c, "pop"))];
    },
  },
  {
    id: "product-end",
    name: "Product End Card",
    tagline: "The product beside the closing line and a button that presses on the final beat.",
    bestFor: "The last scene of a product video. Headline = closing line ('Get yours *today*'); subtext = the button label ('Shop now'); media = the product photo.",
    sample: { text: "Get yours *today*", subtext: "Shop now" },
    render: productEnd,
    sfx: (scene, beat) => {
      const T = ctaTiming(scene.duration, beat);
      return [at(0.05, "whoosh"), at(T.button, "pop"), at(T.click, "click"), at(T.click + 0.05, "success")];
    },
  },
  {
    id: "product-spin",
    name: "Every Angle",
    tagline: "The product's photos take turns on the stage, each sliding off level as the next glides in, with dots counting the angles.",
    bestFor: "Physical products with 2+ photos from different angles. Headline = a short line ('From each *angle*'); the photos come from the product images.",
    sample: { text: "From each *angle*" },
    render: productSpin,
    sfx: (scene) => {
      const n = 4;
      const T = spinTiming(scene.duration, n);
      return [at(0.05, "whoosh"), ...Array.from({ length: n - 1 }, (_, i) => at(T.start + (i + 1) * T.seg, "swoosh"))];
    },
  },
  {
    id: "product-zoom",
    name: "Detail Zoom",
    tagline: "A magnifying lens glides over the product to its most detailed parts, enlarging each, with the feature it shows called out beside it.",
    bestFor: "Physical products: the close-up moment. Headline = a short line ('The *details*'); items = up to 3 short feature titles, one per stop (optional).",
    sample: { text: "The *details*", items: ["Soft-touch finish", "Magnetic case", "Charging light"] },
    itemsHint: "One short feature per close-up (optional)",
    render: productZoom,
    sfx: (scene) => {
      const T = zoomTiming(scene.duration, 3);
      return [at(T.first - 0.3, "whoosh"), ...[0, 1, 2].map((i) => at(T.first + i * T.each + T.move, "pop"))];
    },
  },
  {
    id: "product-teaser",
    name: "Trailer Cold Open",
    tagline: "Hard cuts on the beat between tight close-ups of the product, one big word on each, with flashes and cinema bars, then a white flash into the reveal.",
    bestFor:
      "The opening of a product trailer (trailer styles). Items = 2-3 punchy feature words, one per shot ('Noise cancelling', 'USB-C charging'); headline = a fallback line. Put the product reveal right after it.",
    sample: { text: "Introducing", items: ["Noise cancelling", "USB-C charging", "Pocket case"] },
    itemsHint: "One punchy word or two per shot (2-3 shots)",
    render: productTeaser,
    sfx: (scene, beat) => {
      const n = Math.max(1, teaserWords(scene).length);
      const T = teaserTiming(scene.duration, n, beat);
      return [at(0.02, "whoosh"), ...Array.from({ length: n - 1 }, (_, i) => at((i + 1) * T.seg, "strike")), at(T.end, "shimmer")];
    },
  },
];
