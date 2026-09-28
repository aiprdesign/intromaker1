/**
 * Component-level product motion, cut like a product film rather than a collage: the real page
 * sits behind in soft focus, then its best components are pulled out one at a time and shown
 * big and isolated (a clean close-up with a soft shadow, no outlines), each glides back into its
 * exact slot as the next comes out, and finally the whole page racks into focus as one piece.
 *
 * Nothing is drawn around the sections (no skeletons, rings or borders), and a returned
 * component lands pixel-aligned on the page it was cut from, so the combine is seamless.
 * Components come from the live capture (cut out of the page at 2× resolution). Any other
 * screenshot is never cut up: the camera itself zooms into its strongest blocks (found by
 * segmentation) and pulls back, so there are no edges to show.
 */
import { exitT } from "../fx";
import { clamp, ease, lerp, range, rgba, TAU } from "../math";
import { getImage, getMedia, segmentShot } from "../media";
import { glassCard, saasBackground, spring } from "../saasfx";
import { subFont } from "../text";
import type { Brand, Scene, SfxCue, Skill, SkillContext, SitePart } from "../types";
import { topHeadline } from "./saas";

/** Live captures are laid out at a 1440px-wide viewport; part boxes are in those page pixels. */
const CAPTURE_WIDTH = 1440;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  kind: SitePart["kind"];
  text?: string;
  src?: string;
}

interface Piece extends Box {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const isCapture = (scene: Scene) => /-(hero|full)$/.test(scene.media?.src ?? "");

/** Captured parts inside the base screenshot, in base-image pixels (cropped at the fold). */
function captureBoxes(scene: Scene, brand: Brand | undefined, W: number, H: number): Box[] {
  if (!isCapture(scene)) return [];
  const k = W / CAPTURE_WIDTH;
  return (brand?.parts ?? [])
    .map((p) => ({ ...p, x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k, r: p.r * k }))
    .filter((p) => p.x + p.w <= W + 2 && p.y < H && (H - p.y) / p.h >= 0.55)
    .map((p) => ({ ...p, h: Math.min(p.h, H - p.y) }));
}

const area = (b: Box) => b.w * b.h;
const inside = (a: Box, b: Box) => a.x >= b.x - 2 && a.y >= b.y - 2 && a.x + a.w <= b.x + b.w + 2 && a.y + a.h <= b.y + b.h + 2;
function overlap(a: Box, b: Box) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.min(area(a), area(b)) : 0;
}

/**
 * The components worth a close-up: well-shaped blocks of a sensible size, the children rather
 * than the container that holds them, never two that overlap. Product media and cards that carry
 * numbers or charts first; returned in reading order.
 */
function pickFeatures(boxes: Box[], W: number, H: number, max: number): Box[] {
  const cand = boxes.filter((b) => {
    const a = area(b) / (W * H);
    const ar = b.w / b.h;
    return b.kind !== "button" && a >= 0.012 && a <= 0.5 && ar >= 0.35 && ar <= 4.5;
  });
  const leaves = cand.filter((a) => cand.filter((b) => b !== a && inside(b, a)).length < 2);
  const score = (b: Box) => (b.kind === "media" ? 3 : b.kind === "card" ? (/\d/.test(b.text ?? "") ? 2.5 : 2) : 1) + Math.min(1, area(b) / (W * H * 0.15));
  const out: Box[] = [];
  for (const b of [...leaves].sort((a, c) => score(c) - score(a))) {
    if (out.length >= max) break;
    if (out.some((o) => overlap(o, b) > 0.05)) continue;
    out.push(b);
  }
  return out.sort((a, b) => Math.round(a.y / 60) - Math.round(b.y / 60) || a.x - b.x);
}

/** Frame the region where the product lives, at a screen-friendly aspect (≤1.9× zoom). */
function framing(boxes: Box[], W: number, H: number, aspect: number) {
  const src = boxes.filter((b) => b.kind !== "button");
  if (!src.length) return { x: 0, y: 0, w: W, h: Math.min(H, W / aspect) };
  let x0 = Math.min(...src.map((p) => p.x));
  let y0 = Math.min(...src.map((p) => p.y));
  let x1 = Math.max(...src.map((p) => p.x + p.w));
  let y1 = Math.max(...src.map((p) => p.y + p.h));
  const m = Math.max(x1 - x0, y1 - y0) * 0.07;
  x0 -= m;
  y0 -= m;
  x1 += m;
  y1 += m;
  let w = x1 - x0;
  let h = y1 - y0;
  if (w / h > aspect) {
    const nh = w / aspect;
    y0 -= (nh - h) * 0.65;
    h = nh;
  } else {
    const nw = h * aspect;
    x0 -= (nw - w) / 2;
    w = nw;
  }
  if (w < W / 1.9) {
    const k = W / 1.9 / w;
    x0 -= (w * (k - 1)) / 2;
    y0 -= (h * (k - 1)) / 2;
    w *= k;
    h *= k;
  }
  w = Math.min(w, W);
  h = Math.min(h, H);
  return { x: clamp(x0, 0, W - w), y: clamp(y0, 0, H - h), w, h };
}

/** Pieces to feature, with their images, plus the framing of the page. */
function layout(sc: SkillContext, base: HTMLImageElement, aspect: number) {
  const W = base.naturalWidth;
  const H = base.naturalHeight;
  const boxes = captureBoxes(sc.scene, sc.brand, W, H);
  if (boxes.filter((b) => b.kind !== "button").length >= 2) {
    const frame = framing(boxes, W, H, aspect);
    const within = boxes.filter((b) => inside(b, { ...frame, r: 0, kind: "panel" }));
    const pieces: Piece[] = [];
    for (const b of pickFeatures(within, W, H, 3)) {
      const img = getImage(b.src);
      if (!img?.naturalWidth) continue;
      const full = sc.brand?.parts?.find((p) => p.src === b.src);
      const vis = full ? Math.min(1, b.h / (full.h * (W / CAPTURE_WIDTH))) : 1;
      pieces.push({ ...b, img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight * vis });
    }
    return { frame, pieces, camera: false };
  }
  // Any other screenshot: camera moves onto its two strongest, well-shaped blocks.
  const frame = { x: 0, y: 0, w: W, h: Math.min(H, W / aspect) };
  const segs = segmentShot(base)
    .map((s) => ({ ...s, r: 0, kind: "card" as const }))
    .filter((b) => area(b) >= W * H * 0.04 && b.w / b.h >= 0.5 && b.w / b.h <= 3.2 && inside(b, { ...frame, r: 0, kind: "panel" }));
  const pieces = pickFeatures(segs, W, H, 2).map((b) => ({ ...b, img: base, sx: b.x, sy: b.y, sw: b.w, sh: b.h }));
  return { frame, pieces, camera: true };
}

/** A view of the page centred on `b`, at the frame's aspect, zoomed at most 2.2×. */
function viewOn(b: Box, frame: { x: number; y: number; w: number; h: number }, W: number, H: number) {
  const aspect = frame.w / frame.h;
  let w = Math.max(b.w * 1.35, (b.h * 1.35) * aspect, frame.w / 2.2);
  w = Math.min(w, frame.w);
  const h = w / aspect;
  return { x: clamp(b.x + b.w / 2 - w / 2, 0, W - w), y: clamp(b.y + b.h / 2 - h / 2, 0, H - h), w, h };
}

/** How many close-ups the scene shows (sound design runs before images load). */
function featureCount(scene: Scene, brand: Brand | undefined) {
  const W = CAPTURE_WIDTH;
  const H = 900;
  const boxes = captureBoxes(scene, brand, W, H);
  if (boxes.filter((b) => b.kind !== "button").length < 2) return 2;
  const frame = framing(boxes, W, H, 1.6);
  return pickFeatures(boxes.filter((b) => inside(b, { ...frame, r: 0, kind: "panel" })), W, H, 3).length;
}

/**
 * Close-ups on a two-beat grid: each piece is pulled out on a beat, held, and returns while the
 * next comes out; then the page racks into focus. Fewer close-ups when the scene is short.
 */
function assembleTiming(count: number, beat: number, d: number) {
  const step = beat * Math.max(2, Math.round(1.1 / beat));
  const move = 0.45;
  const p0 = beat;
  let n = count;
  while (n > 0 && p0 + n * step + move + 0.9 > d - 0.3) n--;
  const pulls = Array.from({ length: n }, (_, i) => p0 + i * step);
  const returns = pulls.map((p) => p + step - 0.2);
  // The rack focus starts as the last component lands, so no half-sharp page is ever seen.
  const resolve = n ? returns[n - 1] + move * 0.45 : Math.min(0.7, d * 0.2);
  return { n, pulls, returns, move, resolve, sharp: resolve + 0.5, sweep: resolve + 0.25 };
}

function rounded(ctx: CanvasRenderingContext2D, p: Piece, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, x, y, w, h);
  ctx.restore();
}

function uiAssemble(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand, beat } = sc;
  saasBackground(sc, { beams: 1 });
  topHeadline(sc);
  const portrait = h > w;
  const media = getMedia(scene.media, t);
  const base = media instanceof HTMLImageElement && media.naturalWidth ? media : null;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const aspect = portrait ? 1.15 : 1.6;
  const { frame, pieces, camera } = base ? layout(sc, base, aspect) : { frame: { x: 0, y: 0, w: 1440, h: 900 }, pieces: [] as Piece[], camera: true };
  const T = assembleTiming(pieces.length, beat, d);
  const shown = pieces.slice(0, T.n);

  // Browser window below the headline.
  const barH = 40 * u * (portrait ? 1.1 : 1);
  const maxW = portrait ? w * 0.92 : w * 0.8;
  const maxH = portrait ? h * 0.6 : h * 0.7;
  const cw = Math.min(maxW, (maxH - barH) * aspect);
  const ch = cw / aspect;
  const wx = (w - cw) / 2;
  const wy = portrait ? h * 0.3 : Math.max(h * 0.25, h * 0.6 - (ch + barH) / 2);
  const s = cw / frame.w;
  const cx0 = wx;
  const cy0 = wy + barH;
  const slot = (p: Box) => ({ x: cx0 + (p.x - frame.x) * s, y: cy0 + (p.y - frame.y) * s, w: p.w * s, h: p.h * s, r: Math.max(4 * u, p.r * s) });

  // The window rises in and the camera pushes in slowly across the scene.
  const k0 = clamp(spring(t - 0.05, 9, 7), 0, 1.04);
  const push = 0.97 + 0.05 * ease.inOutCubic(range(t, 0, d));
  const pcx = w / 2;
  const pcy = wy + (barH + ch) / 2;
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.25) * (1 - ex);
  ctx.translate(pcx, pcy + (1 - Math.min(1, k0)) * 70 * u);
  ctx.scale(push * (0.94 + 0.06 * k0), push * (0.94 + 0.06 * k0));
  ctx.translate(-pcx, -pcy);

  ctx.save();
  ctx.shadowColor = rgba(palette.primary, palette.light ? 0.16 : 0.32);
  ctx.shadowBlur = 70 * u;
  glassCard(sc, wx, wy, cw, ch + barH, { r: 16 * u });
  ctx.restore();
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(wx + 22 * u + i * 20 * u, wy + barH / 2, 6 * u, 0, TAU);
    ctx.fillStyle = c;
    ctx.fill();
  });
  const url = brand?.domain ?? brand?.name?.toLowerCase().replace(/\s+/g, "") ?? "";
  if (url) {
    ctx.font = subFont(15 * u, 500);
    const uw = Math.min(cw * 0.4, ctx.measureText(url).width + 60 * u);
    ctx.beginPath();
    ctx.roundRect(wx + cw / 2 - uw / 2, wy + barH / 2 - 13 * u, uw, 26 * u, 13 * u);
    ctx.fillStyle = palette.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.fillStyle = rgba(palette.text, 0.6);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(url, wx + cw / 2, wy + barH / 2 + 1 * u);
  }

  // How far the current close-up is pulled out (0 = on the page, 1 = isolated, centre stage).
  const pulled = shown.map((_, i) => ease.inOutCubic(range(t, T.pulls[i], T.pulls[i] + T.move)) * (1 - ease.inOutCubic(range(t, T.returns[i], T.returns[i] + T.move))));
  // Camera mode: the page sharpens as the first zoom begins (the zoom itself is the reveal).
  const focus = camera && T.n ? ease.inOutCubic(range(t, T.pulls[0] - 0.15, T.pulls[0] + 0.35)) : ease.inOutCubic(range(t, T.resolve, T.sharp));
  const isolate = camera ? 0 : Math.max(0, ...pulled);

  // The page: soft focus and dimmed until everything is back, then one clean rack focus.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx0, cy0, cw, ch, [0, 0, 16 * u, 16 * u]);
  ctx.clip();
  ctx.fillStyle = palette.bg1;
  ctx.fillRect(cx0, cy0, cw, ch);
  if (base) {
    const blur = (1 - focus) * 9 * u;
    ctx.save();
    if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    let view = frame;
    if (camera) {
      shown.forEach((p, i) => {
        const v = viewOn(p, frame, base.naturalWidth, base.naturalHeight);
        const m = pulled[i];
        view = { x: lerp(view.x, v.x, m), y: lerp(view.y, v.y, m), w: lerp(view.w, v.w, m), h: lerp(view.h, v.h, m) };
      });
    }
    ctx.drawImage(base, view.x, view.y, view.w, view.h, cx0, cy0, cw, ch);
    ctx.restore();
    // Returned components sit sharp on the soft page until the whole page is in focus.
    shown.forEach((p, i) => {
      const back = t >= T.returns[i] + T.move;
      if (camera || !back || focus >= 1) return;
      const r = slot(p);
      ctx.save();
      ctx.globalAlpha *= 1 - focus;
      rounded(ctx, p, r.x, r.y, r.w, r.h, r.r);
      ctx.restore();
    });
    const dim = (palette.light ? 0.28 : 0.42) * (1 - focus) + (palette.light ? 0.2 : 0.3) * isolate;
    if (dim > 0.01) {
      ctx.fillStyle = rgba(palette.bg0, dim);
      ctx.fillRect(cx0, cy0, cw, ch);
    }
  }
  // A light sweep as the page comes into focus.
  const sk = range(t, T.sweep, T.sweep + 0.9);
  if (sk > 0 && sk < 1) {
    const sx = lerp(cx0 - cw * 0.3, cx0 + cw * 1.3, ease.inOutCubic(sk));
    const g = ctx.createLinearGradient(sx - cw * 0.12, cy0, sx + cw * 0.12, cy0 + ch * 0.3);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${palette.light ? 0.3 : 0.12})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(cx0, cy0, cw, ch);
  }
  ctx.restore();

  // Close-ups: the component lifts out of its slot to centre stage, big and isolated.
  shown.forEach((p, i) => {
    const m = camera ? 0 : pulled[i];
    if (m <= 0.001) return;
    const from = slot(p);
    // As large as the window allows, but never upscaled past what the capture holds sharply.
    const nativeW = p.sw * 1.25;
    const zoom = Math.min((cw * (portrait ? 0.86 : 0.68)) / from.w, (ch * 0.66) / from.h, Math.max(1, nativeW / from.w));
    const tw = from.w * Math.max(1, zoom);
    const th = from.h * Math.max(1, zoom);
    const tx = cx0 + cw / 2 - tw / 2;
    const ty = cy0 + ch * 0.5 - th / 2 + Math.sin((sc.globalT ?? t) * 1.6) * 3 * u * m;
    const x = lerp(from.x, tx, m);
    const y = lerp(from.y, ty, m);
    const pw = lerp(from.w, tw, m);
    const ph = lerp(from.h, th, m);
    const r = lerp(from.r, Math.max(10 * u, from.r * zoom * 0.6), m);
    ctx.save();
    ctx.shadowColor = palette.light ? `rgba(15,20,40,${0.28 * m})` : `rgba(0,0,0,${0.6 * m})`;
    ctx.shadowBlur = 60 * u * m;
    ctx.shadowOffsetY = 26 * u * m;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, r);
    ctx.fillStyle = palette.bg1;
    ctx.fill();
    ctx.restore();
    rounded(ctx, p, x, y, pw, ph, r);
  });
  ctx.restore();
}

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });

export const componentSkills: Skill[] = [
  {
    id: "ui-assemble",
    name: "UI Assemble",
    tagline: "Your real product page in soft focus; its best components are pulled out one by one for a close-up, glide back into place, and the whole page racks into focus.",
    bestFor: "Showing the real product without a flat screenshot, right after the brand reveal. Uses the hero screenshot and the UI components captured from the live site.",
    sample: { text: "Meet your new *dashboard*" },
    render: uiAssemble,
    sfx: (scene, beat, brand) => {
      const T = assembleTiming(featureCount(scene, brand), beat, scene.duration);
      return [at(0.05, "swoosh"), ...T.pulls.map((p) => at(p, "swoosh")), ...T.returns.map((r) => at(r + T.move, "tick")), at(T.resolve, "shimmer")];
    },
  },
];
