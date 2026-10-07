/**
 * World-class SaaS launch-video skills: the techniques used by top product videos
 * (Linear, Vercel, Stripe, Apple, Raycast, Framer): sentence-case blur reveals, rotating
 * words, cursor-driven UI zoom tours with callouts, bento feature grids, floating glass
 * widgets, pain → solution strikes, integration orbits, real testimonials, logo marquees
 * and a CTA lock-up with a clicked button.
 */
import { exitT, lightSweep } from "../fx";
import { clamp, ease, hashString, lerp, range, rgba, rng, TAU } from "../math";
import { tokens } from "../grid";
import { drawAppIcon, drawLogo, lockupMark, logoMaxWidth, findHotspots, getImage, getMedia, mediaSize, pageBands, segmentShot, snapBands } from "../media";
import {
  blurInLayout,
  borderBeam,
  clickRipple,
  cursorLean,
  drawCursor,
  drawIcon,
  eyebrow,
  brandGlyph,
  iconConstellation,
  imageless,
  glassCard,
  iconFor,
  iconsFor,
  landedAt,
  lensStreak,
  backLight,
  pill,
  saasBackground,
  saasFont,
  sentence,
  spring,
  type IconKind,
} from "../saasfx";
import { autoAccent, displayFont, fillTextFit, fillTextMid, fitTextLines, subFont } from "../text";
import { drawLucide } from "../icons";
import { ctaClickAt } from "../arrange";
import { CONCEPT_MAP } from "../concepts";
import type { Brand, Scene, SfxCue, Skill, SkillContext } from "../types";
import { parseStat } from "./worlds";
import { drawCover, mockUi } from "./media";

/* ───────── shared helpers ───────── */

const norm = (s: string) => s.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Muted sentence-case supporting line with a soft blur-in. */
function subText(sc: SkillContext, text: string | undefined, y: number, k: number, opts: { size?: number; maxWidth?: number } = {}) {
  if (!text || k <= 0) return;
  const { ctx, w, u, palette } = sc;
  ctx.save();
  let size = opts.size ?? 34 * u;
  ctx.font = subFont(size, 500);
  const maxW = opts.maxWidth ?? w * 0.7;
  const tw = ctx.measureText(text).width;
  if (tw > maxW) {
    size *= maxW / tw;
    ctx.font = subFont(size, 500);
  }
  const e = ease.outCubic(clamp(k));
  ctx.globalAlpha = e * 0.72;
  const blur = (1 - e) * 8 * u;
  if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.fillStyle = palette.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, y + (1 - e) * 12 * u);
  ctx.restore();
}

/** Auto-highlight the last word with the brand gradient when the copy has no *accent*. */
function accented(text: string) {
  return autoAccent(text);
}

function stagger(sc: SkillContext) {
  return Math.min(0.11, sc.beat / 2);
}

/** Top-of-frame headline with an optional chapter eyebrow ("How it works") above it. */
export function topHeadline(sc: SkillContext) {
  const { w, h, t, d, u, scene } = sc;
  const portrait = h > w;
  const hasEb = !!scene.eyebrow;
  // With an eyebrow the block sits lower, so the pill clears the top and the headline sits closer
  // to the content under it.
  const cy = h * 0.12 + (hasEb ? h * (portrait ? 0.04 : 0.065) : 0);
  const layout = sentence(sc, { text: accented(scene.text), cy, sizeFrac: portrait ? 0.075 : 0.068, widthFrac: 0.84, maxLines: 2 });
  // Design grid: the eyebrow pill (27pt type, 54pt tall) sits 4 grid steps above the headline's
  // ascenders, and the whole block never rises above the title-safe top.
  const g = tokens(w, h);
  const ebH = 27 * u;
  const capTop = layout.ys[0] - layout.size * 0.5;
  const gap = g.space(4);
  const blockTop = hasEb ? capTop - gap - ebH * 2 : capTop;
  const shift = Math.max(0, g.safe.top - blockTop);
  if (shift) layout.ys = layout.ys.map((y) => y + shift);
  if (hasEb) eyebrow(sc, scene.eyebrow!, capTop + shift - gap - ebH, range(t, 0.05, 0.45) * (1 - range(t, d - 0.4, d)));
  blurInLayout(sc, layout, 0.1, 0.06, { exitAt: d - 0.4 });
  return layout;
}

/** Chapter eyebrow above a centred block whose first line sits at `top`. */
function chapter(sc: SkillContext, top: number, start = 0.05) {
  const { t, d, u, scene } = sc;
  if (scene.eyebrow) eyebrow(sc, scene.eyebrow, top - 52 * u, range(t, start, start + 0.4) * (1 - range(t, d - 0.4, d)));
}

function drawLogoMark(sc: SkillContext, src: string | undefined, cx: number, cy: number, box: number, alpha = 1) {
  const img = getImage(src);
  if (!img || !img.naturalWidth) return false;
  const { ctx } = sc;
  const ar = img.naturalWidth / img.naturalHeight;
  const lw = Math.min(ar >= 1 ? Math.min(box * 2.2, box * ar) : box * ar, logoMaxWidth(ctx, img));
  const lh = lw / ar;
  ctx.save();
  ctx.globalAlpha *= alpha;
  drawLogo(ctx, img, !!sc.palette.light, cx - lw / 2, cy - lh / 2, lw, lh);
  ctx.restore();
  return true;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/* ───────────────────────── Blur Reveal ───────────────────────── */

function blurReveal(sc: SkillContext) {
  const { w, h, t, d, u, scene } = sc;
  saasBackground(sc);
  const exitAt = d - 0.45;
  // A film made from a concept (no website imagery): its icons float around the words.
  if (imageless(sc)) iconConstellation(sc, { fade: range(t, exitAt, exitAt + 0.4) });
  const layout = sentence(sc, { text: accented(scene.text), cy: h * 0.47, sizeFrac: 0.115, widthFrac: 0.8, maxLines: h > w ? 4 : 3 });
  const top = layout.ys[0] - layout.size * 0.62;
  const midY = (layout.ys[0] + layout.ys[layout.ys.length - 1]) / 2;
  // Light gathers behind the sentence as it forms; a lens streak flashes as the last word lands.
  const land = landedAt(sc, layout, 0.2, stagger(sc));
  backLight(sc, w / 2, midY, w * 0.36, layout.size * (layout.lines.length + 1.2), ease.inOutCubic(range(t, 0.2, land + 0.3)) * (1 - range(t, exitAt, exitAt + 0.4)));
  eyebrow(sc, scene.eyebrow ?? scene.items?.[0] ?? "", top - 52 * u, range(t, 0.05, 0.5) * (1 - range(t, exitAt, exitAt + 0.3)));
  const n = blurInLayout(sc, layout, 0.2, stagger(sc), { exitAt });
  lensStreak(sc, w / 2, midY, range(t, land - 0.2, land + 0.9));
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.62;
  subText(sc, scene.subtext, bottom + 46 * u, range(t, 0.35 + n * stagger(sc), 0.95 + n * stagger(sc)) * (1 - range(t, exitAt, exitAt + 0.4)));
}

/* ───────────────────────── Word Swap ───────────────────────── */

function parseSwap(scene: Scene) {
  const text = scene.text.trim();
  if (text.includes("|")) {
    const parts = text.split("|").map((p) => p.trim());
    const firstWords = parts[0].split(/\s+/);
    const firstAlt = firstWords.pop() ?? "";
    return { prefix: firstWords.join(" "), alts: [firstAlt, ...parts.slice(1)].filter(Boolean) };
  }
  if (scene.items?.length) return { prefix: text, alts: scene.items };
  const words = text.split(/\s+/);
  const last = words.pop() ?? "";
  return { prefix: words.join(" "), alts: [last] };
}

function swapTiming(scene: Scene, beat: number) {
  const { alts } = parseSwap(scene);
  const interval = Math.max(0.55, beat * 2);
  const first = 0.35;
  const swaps = alts.slice(1).map((_, i) => first + 0.5 + interval * (i + 1) - interval / 2);
  return { interval, first, swaps };
}

function wordSwap(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc);
  if (imageless(sc)) iconConstellation(sc, { fade: range(t, d - 0.45, d - 0.05), clear: 1.08 });
  const { prefix, alts } = parseSwap(scene);
  const { swaps } = swapTiming(scene, sc.beat);
  const font = saasFont(sc);
  const short = Math.min(w, h);
  // Fit "prefix + widest alternative" on one line.
  ctx.font = displayFont(font, 100);
  const trk = (s: string, size: number) => -0.045 * size * Math.max(0, s.length - 1);
  const widest = Math.max(...alts.map((a) => ctx.measureText(a).width + trk(a, 100)));
  const pw100 = prefix ? ctx.measureText(prefix).width + trk(prefix, 100) : 0;
  const space100 = prefix ? ctx.measureText(" ").width : 0;
  const size = Math.min(short * 0.14, (100 * w * 0.86) / (pw100 + space100 + widest));
  const k = size / 100;
  ctx.font = displayFont(font, size);
  ctx.textBaseline = "middle";
  const cy = h * 0.46;
  const widths = alts.map((a) => (ctx.measureText(a).width + trk(a, size)));
  let idx = 0;
  for (let i = 0; i < swaps.length; i++) if (t >= swaps[i]) idx = i + 1;
  const since = idx > 0 ? t - swaps[idx - 1] : t;
  const sp = idx > 0 ? clamp(spring(since, 11, 8)) : 1;
  const slotW = idx > 0 ? lerp(widths[idx - 1], widths[idx], sp) : widths[0];
  const total = pw100 * k + space100 * k + slotW;
  const x0 = w / 2 - total / 2;
  const intro = ease.outCubic(range(t, 0.25, 0.9));
  const ex = range(t, d - 0.45, d);

  const drawWord = (word: string, x: number, y: number) => {
    let cx = x;
    for (const ch of word) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width - 0.045 * size;
    }
  };
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  const blur = (1 - intro) * 12 * u + ex * 10 * u;
  if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.text;
  if (prefix) drawWord(prefix, x0, cy + (1 - intro) * 20 * u);
  // Rotating word inside a clipped slot.
  const sx = x0 + (pw100 + space100) * k;
  ctx.beginPath();
  ctx.rect(sx - size * 0.1, cy - size * 0.72, slotW + size * 0.3, size * 1.44);
  ctx.clip();
  const grad = (x: number, wd: number) => {
    const g = ctx.createLinearGradient(x, cy - size / 2, x + wd, cy + size / 2);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    return g;
  };
  if (idx > 0 && sp < 1.2) {
    const out = clamp(since / 0.35);
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    ctx.fillStyle = grad(sx, widths[idx - 1]);
    drawWord(alts[idx - 1], sx, cy - out * size * 0.9);
    ctx.restore();
  }
  ctx.fillStyle = grad(sx, widths[idx]);
  ctx.shadowColor = rgba(palette.primary, 0.6);
  ctx.shadowBlur = 30 * u;
  drawWord(alts[idx], sx, cy + (1 - sp) * size * 0.9 + (1 - intro) * 20 * u);
  ctx.restore();
  // Underline sweep under the active word.
  ctx.save();
  ctx.globalAlpha = intro * (1 - ex);
  ctx.fillStyle = palette.primary;
  const uw = slotW * ease.outExpo(clamp(idx > 0 ? since / 0.6 : range(t, 0.5, 1.1)));
  ctx.fillRect(sx, cy + size * 0.62, uw, 4 * u);
  ctx.restore();
  subText(sc, scene.subtext, cy + size * 1.25, range(t, 0.8, 1.4) * (1 - ex));
}

/* ───────────────────────── UI Zoom Tour ───────────────────────── */

function tourTiming(d: number) {
  const zoomA = 0.95;
  const clickA = zoomA + 0.95;
  const zoomB = Math.max(clickA + 0.9, d * 0.5);
  const clickB = zoomB + 0.95;
  const out = Math.max(clickB + 0.7, d - 1.05);
  return { zoomA, clickA, zoomB, clickB, out };
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * The tour's layout in a w×h frame: the browser window, the two stops (hot) and the real UI
 * component framed at each stop (comps). Areas set in the studio (scene.tour, as fractions of the
 * screenshot) take the place of the automatic ones. `img` maps screenshot pixels onto the frame.
 */
function tourGeometry(w: number, h: number, u: number, seed: number, scene: Scene, media: ReturnType<typeof getMedia>, src: string | undefined) {
  const portrait = h > w;
  const square = !portrait && w / h < 1.25;
  const bar = 30 * u;
  const r = rng(seed);
  // The window takes the screenshot's own shape, so the whole UI shows in every format (a tall
  // window would crop a desktop screenshot's sides). Vertical and square frames use their width;
  // widescreen frames keep the window clear of the headline and the edges.
  const shotAr = media ? clamp(mediaSize(media).w / Math.max(1, mediaSize(media).h), 0.9, 1.9) : 1.6;
  const ww = portrait ? w * 0.86 : square ? w * 0.82 : Math.min(w * 0.74, (h * 0.62 - bar) * shotAr);
  const wh = Math.min(ww / shotAr + bar, h * (portrait ? 0.5 : 0.66));
  const fcx = w / 2;
  const fcy = portrait ? h * 0.46 : square ? h * 0.57 : h * 0.585;
  const fx0 = fcx - ww / 2;
  const fy0 = fcy - wh / 2;
  // How far a close-up may zoom: in vertical and square frames, until the component fills the width.
  const zMax = portrait ? 2.6 : square ? 2.2 : 1.9;
  const zoomFor = (c: { w: number; h: number }) =>
    clamp(portrait || square ? Math.min((w * 0.86) / c.w, (h * (portrait ? 0.42 : 0.55)) / c.h) : Math.min((ww * 0.8) / c.w, ((wh - bar) * 0.8) / c.h), 1.1, zMax);
  // Screenshot pixels → frame: the shot covers the window's content area, anchored as drawCover is.
  let img: { ox: number; oy: number; cs: number; iw: number; ih: number } | null = null;
  if (media) {
    const { w: iw, h: ih } = mediaSize(media);
    const cs = Math.max(ww / iw, (wh - bar) / ih);
    img = { ox: fx0 + (ww - iw * cs) * 0.5, oy: fy0 + bar + (wh - bar - ih * cs) * 0.2, cs, iw, ih };
  }
  // Areas set in the studio, for this screenshot.
  const set = img && scene.tour?.areas?.length && (!scene.tour.src || scene.tour.src === tourSrcKey(src)) ? scene.tour.areas : null;
  if (set && img) {
    const I = img;
    const comps: (Box | null)[] = [0, 1].map((i) => {
      const a = set[Math.min(i, set.length - 1)];
      return { x: I.ox + a[0] * I.iw * I.cs, y: I.oy + a[1] * I.ih * I.cs, w: Math.max(8 * u, a[2] * I.iw * I.cs), h: Math.max(8 * u, a[3] * I.ih * I.cs) };
    });
    const hot = comps.map((c) => ({ x: c!.x + c!.w / 2, y: c!.y + c!.h / 2 }));
    return { portrait, square, bar, ww, wh, fcx, fcy, fx0, fy0, zoomFor, hot, comps, img };
  }
  // Zoom to the busiest real UI regions of the screenshot; seeded spots otherwise.
  const found = media ? findHotspots(media, ww, wh - bar, 0.5, 0.2) : null;
  const hot = (
    found ?? [
      { x: 0.26 + r() * 0.12, y: 0.32 + r() * 0.12 },
      { x: 0.62 + r() * 0.12, y: 0.55 + r() * 0.15 },
    ]
  ).map((p) => ({ x: fx0 + p.x * ww, y: fy0 + bar + p.y * (wh - bar) }));
  // The real UI component under each hotspot (from segmenting the screenshot), so the focus ring
  // hugs an actual card or panel and everything around it can be dimmed.
  const comps = hot.map(() => null as Box | null);
  if (media instanceof HTMLImageElement && found && img) {
    const { ox, oy, cs, iw, ih } = img;
    const segs = segmentShot(media);
    const onScreen = segs.map((g) => ({ x: ox + g.x * cs, y: oy + g.y * cs, w: g.w * cs, h: g.h * cs }));
    hot.forEach((p, i) => {
      const ix = (p.x - ox) / cs;
      const iy = (p.y - oy) / cs;
      const fit = segs
        .filter((g) => ix >= g.x && ix <= g.x + g.w && iy >= g.y && iy <= g.y + g.h && g.w * g.h >= iw * ih * 0.015 && g.w * g.h <= iw * ih * 0.4)
        .sort((a, b) => a.w * a.h - b.w * b.h)[0];
      if (!fit) return;
      // The close-up takes in whole blocks only: any block the zoomed view would slice through
      // (a card's edge, a chart, a headline row) joins the framing, so nothing is cut.
      let c = { x: ox + fit.x * cs, y: oy + fit.y * cs, w: fit.w * cs, h: fit.h * cs };
      for (let pass = 0; pass < 3; pass++) {
        const zz = zoomFor(c);
        const vw = ww / zz;
        const vh = (wh - bar) / zz;
        const vx = c.x + c.w / 2 - vw / 2;
        const vy = c.y + c.h / 2 - vh / 2;
        const cut = onScreen.filter((g) => {
          const ix2 = Math.min(g.x + g.w, vx + vw) - Math.max(g.x, vx);
          const iy2 = Math.min(g.y + g.h, vy + vh) - Math.max(g.y, vy);
          return ix2 > 0 && iy2 > 0 && !(ix2 >= g.w - 1 && iy2 >= g.h - 1) && (ix2 * iy2) / (g.w * g.h) > 0.08;
        });
        if (!cut.length) break;
        const x0 = Math.min(c.x, ...cut.map((g) => g.x));
        const y0 = Math.min(c.y, ...cut.map((g) => g.y));
        const x1 = Math.max(c.x + c.w, ...cut.map((g) => g.x + g.w));
        const y1 = Math.max(c.y + c.h, ...cut.map((g) => g.y + g.h));
        c = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      comps[i] = c;
    });
  }
  return { portrait, square, bar, ww, wh, fcx, fcy, fx0, fy0, zoomFor, hot, comps, img };
}

/** The screenshot the tour shows: the scene's own, else the site's first. */
const mediaSrc = (scene: Scene, brand?: Brand) => (scene.media ? scene.media.src : brand?.images[0]);

/** What scene.tour.src stores for a screenshot (a short key for long data URLs; the last one is kept, as frames ask every time). */
let keyMemo: [string, string] | null = null;
export function tourSrcKey(src: string | undefined) {
  if (!src) return undefined;
  if (src.length <= 300) return src;
  if (keyMemo?.[0] !== src) keyMemo = [src, `#${hashString(src).toString(36)}-${src.length}`];
  return keyMemo[1];
}

/**
 * For the studio's area editor: the tour's screenshot, the two highlight areas the slide uses in a
 * w×h frame (as fractions of the screenshot: x, y, width, height) and the part of the
 * screenshot that frame shows. Null until the screenshot has loaded (or without one).
 */
export function tourAreas(scene: Scene, brand: Brand | undefined, w: number, h: number, seed: number) {
  const src = mediaSrc(scene, brand);
  const kind = scene.media?.kind ?? "image";
  if (!src || kind !== "image") return null;
  const media = getMedia({ src, kind: "image" }, 0);
  if (!(media instanceof HTMLImageElement)) return null;
  const u = Math.min(w, h) / 1080;
  const g = tourGeometry(w, h, u, seed, scene, media, src);
  if (!g.img) return null;
  return { image: media, key: tourSrcKey(src), ...editAreas(g, scene) };
}

/**
 * The highlight areas as the studio edits them, as fractions of the screenshot, and the part of
 * it the frame shows. (An automatic area that takes in most of the screenshot starts as a box at
 * its stop instead, so the boxes can be told apart and moved.)
 */
function editAreas(g: ReturnType<typeof tourGeometry>, scene: Scene) {
  const { ox, oy, cs, iw, ih } = g.img!;
  const toImg = (b: Box): [number, number, number, number] => [(b.x - ox) / (iw * cs), (b.y - oy) / (ih * cs), b.w / (iw * cs), b.h / (ih * cs)];
  const areas = g.hot.map((p, i) => {
    const a = toImg(g.comps[i] ?? { x: p.x - g.ww * 0.12, y: p.y - (g.wh - g.bar) * 0.09, w: g.ww * 0.24, h: (g.wh - g.bar) * 0.18 });
    if (scene.tour?.areas?.length || a[2] * a[3] < 0.35) return a;
    const [px, py] = toImg({ x: p.x, y: p.y, w: 0, h: 0 });
    return [clamp(px - 0.16, 0, 0.68), clamp(py - 0.14, 0, 0.72), 0.32, 0.28] as [number, number, number, number];
  });
  const visible = toImg({ x: g.fx0, y: g.fy0 + g.bar, w: g.ww, h: g.wh - g.bar });
  return { areas, visible };
}

function uiTour(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand, seed } = sc;
  saasBackground(sc, { beams: 3 });
  const T = tourTiming(d);
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  const geo = tourGeometry(w, h, u, seed, scene, media, mediaSrc(scene, brand));
  const { portrait, bar, ww, wh, fcx, fcy, fx0, fy0, zoomFor, hot, comps } = geo;
  const Z = 1.85;
  // Editing its areas on the paused preview: the whole window, unzoomed, with nothing over it.
  const editing = !!sc.edit;

  // Camera keyframes.
  const center = { x: fcx, y: fcy };
  const kA = editing ? 0 : ease.inOutCubic(range(t, T.zoomA, T.zoomA + 0.85));
  const kB = editing ? 0 : ease.inOutCubic(range(t, T.zoomB, T.zoomB + 0.85));
  const kOut = editing ? 0 : ease.inOutCubic(range(t, T.out, T.out + 0.75));
  // Each stop frames a whole component (never cutting through it): zoomed until the component
  // fills about three quarters of the window, gentler when no clear component was found.
  // The camera stays inside the window where the zoom lets it, so a component near the window's
  // edge is framed without showing the empty stage past it (at the top, the stage under the
  // headline band may show, so a component at the top isn't hidden under the headline). Vertical
  // frames keep the stage above and below the window (the stops are listed under it).
  const inside = (v: number, lo: number, hi: number) => (lo <= hi ? clamp(v, lo, hi) : v);
  const stops = hot
    .map((p, i) => {
      const c = comps[i];
      if (!c) return { x: p.x, y: p.y, z: 1.5 };
      return { x: c.x + c.w / 2, y: c.y + c.h / 2, z: zoomFor(c) };
    })
    .map((st) => ({ ...st, x: inside(st.x, fx0 + w / 2 / st.z, fx0 + ww - w / 2 / st.z), y: portrait ? st.y : inside(st.y, fy0 + (fcy - h * 0.3) / st.z, fy0 + wh - (h - fcy) / st.z) }));
  let focus = { x: lerp(center.x, stops[0].x, kA), y: lerp(center.y, stops[0].y, kA) };
  focus = { x: lerp(focus.x, stops[1].x, kB), y: lerp(focus.y, stops[1].y, kB) };
  focus = { x: lerp(focus.x, center.x, kOut), y: lerp(focus.y, center.y, kOut) };
  const z = lerp(lerp(lerp(1, stops[0].z, kA), stops[1].z, kB), 1, kOut);
  const toScreen = (p: { x: number; y: number }) => ({ x: (p.x - focus.x) * z + fcx, y: (p.y - focus.y) * z + fcy });

  const intro = editing ? 1 : clamp(spring(t - 0.1, 10, 7));
  const ex = editing ? 0 : ease.inCubic(exitT(sc, 0.4));
  ctx.save();
  ctx.globalAlpha = editing ? 1 : clamp(t / 0.3) * (1 - ex);
  ctx.translate(fcx, fcy + (1 - intro) * h * 0.12);
  ctx.scale(z * lerp(0.88, 1, intro), z * lerp(0.88, 1, intro));
  ctx.translate(-focus.x, -focus.y);
  // Browser frame.
  glassCard(sc, fx0 - 1, fy0 - 1, ww + 2, wh + 2, { r: 16 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(fx0, fy0, ww, wh, 16 * u);
  ctx.clip();
  ctx.fillStyle = palette.light ? "#e8e8ef" : "#121019";
  ctx.fillRect(fx0, fy0, ww, bar);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(fx0 + 18 * u + i * 16 * u, fy0 + bar / 2, 5 * u, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(fcx - ww * 0.18, fy0 + bar * 0.2, ww * 0.36, bar * 0.6, bar * 0.3);
  ctx.fill();
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)";
  ctx.font = subFont(11 * u, 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brand?.domain ?? "app.yourproduct.com", fcx, fy0 + bar / 2);
  if (media) drawCover(ctx, media, fx0, fy0 + bar, ww, wh - bar, 1, 0.5, 0.2);
  else mockUi(sc, fx0, fy0 + bar, ww, wh - bar);
  // Focal isolation: once a component is clicked, the rest of the screen dims around it.
  if (!editing) hot.forEach((_, i) => {
    const c = comps[i];
    const click = i === 0 ? T.clickA : T.clickB;
    const until = i === 0 ? T.zoomB + 0.2 : T.out;
    const k = ease.inOutCubic(range(t, click - 0.05, click + 0.3)) * (1 - ease.inOutCubic(range(t, until, until + 0.4)));
    if (!c || k <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx0, fy0 + bar, ww, wh - bar);
    ctx.roundRect(c.x - 3 * u, c.y - 3 * u, c.w + 6 * u, c.h + 6 * u, 10 * u);
    ctx.fillStyle = rgba(palette.light ? "#ffffff" : "#000000", (palette.light ? 0.55 : 0.58) * k);
    ctx.fill("evenodd");
    ctx.restore();
  });
  ctx.restore();
  // Highlight rings: hugging the real component when found, else a soft box round the click.
  if (!editing) hot.forEach((p, i) => {
    const click = i === 0 ? T.clickA : T.clickB;
    const k = clamp(spring(t - click, 12, 8)) * (1 - kOut * 0.6);
    if (t < click) return;
    const c = comps[i];
    const rw = c ? c.w + 6 * u : ww * 0.24;
    const rh = c ? c.h + 6 * u : (wh - bar) * 0.18;
    const rcx = c ? c.x + c.w / 2 : p.x;
    const rcy = c ? c.y + c.h / 2 : p.y;
    const grow = 1 + (1 - Math.min(1, k)) * 0.12;
    ctx.save();
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2.2 * u / z;
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 18 * u;
    ctx.globalAlpha *= clamp(k);
    ctx.beginPath();
    ctx.roundRect(rcx - (rw / 2) * grow, rcy - (rh / 2) * grow, rw * grow, rh * grow, 10 * u);
    ctx.stroke();
    ctx.fillStyle = rgba(palette.primary, c ? 0.04 : 0.08);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  if (editing) {
    // The headline stays (the boxes are placed against the frame as it plays); then the areas.
    topHeadline(sc);
    const { areas } = geo.img ? editAreas(geo, scene) : { areas: [] };
    if (geo.img) {
      const { ox, oy, cs, iw, ih } = geo.img;
      sc.edit!({ kind: "tour", areas, key: tourSrcKey(mediaSrc(scene, brand)), map: { ox, oy, sx: iw * cs, sy: ih * cs }, clip: { x: fx0, y: fy0 + bar, w: ww, h: wh - bar } });
    }
    return;
  }
  // Callouts + cursor in screen space.
  const labels = [scene.items?.[0] ?? scene.subtext, scene.items?.[1]];
  hot.forEach((p, i) => {
    const click = i === 0 ? T.clickA : T.clickB;
    const until = i === 0 ? T.zoomB + 0.3 : T.out + 0.2;
    const k = clamp(spring(t - click - 0.12, 12, 8)) * (1 - range(t, until, until + 0.3));
    if (!labels[i] || k <= 0) return;
    const s = toScreen(p);
    ctx.save();
    ctx.globalAlpha = clamp(k) * (1 - ex);
    const y = s.y - 70 * u - (1 - k) * 16 * u;
    pill(sc, labels[i]!, clamp(s.x + 60 * u, 240 * u, w - 240 * u), y, {
      size: 28 * u,
      fill: rgba(palette.bg0, 0.9),
      border: rgba(palette.primary, 0.7),
    });
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 5 * u, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
  // Vertical frames have room under the window: the tour's stops as numbered steps, the current one lit.
  if (portrait) {
    const active = t >= T.clickA && t < T.zoomB + 0.3 ? 0 : t >= T.clickB && t < T.out + 0.2 ? 1 : -1;
    const k0 = ease.outCubic(range(t, 0.5, 1.1)) * (1 - ex);
    const y0 = fcy + wh / 2 + 70 * u;
    labels.forEach((label, i) => {
      if (!label || k0 <= 0) return;
      const on = i === active;
      ctx.save();
      ctx.globalAlpha = k0 * (on ? 1 : 0.7);
      pill(sc, `${i + 1}   ${label}`, w / 2, y0 + i * 76 * u + (1 - k0) * 14 * u, {
        size: 26 * u,
        fill: on ? rgba(palette.primary, 0.22) : rgba(palette.bg0, 0.85),
        border: on ? rgba(palette.primary, 0.9) : rgba(palette.text, 0.18),
        color: palette.text,
      });
      ctx.restore();
    });
  }
  const a = toScreen(hot[0]);
  const b = toScreen(hot[1]);
  const start = { x: w * 0.92, y: h * 1.05 };
  let cur = start;
  const at = (tt: number) => {
    const toA = ease.inOutCubic(range(tt, T.zoomA + 0.1, T.clickA - 0.05));
    let c = { x: lerp(start.x, a.x, toA), y: lerp(start.y, a.y, toA) };
    const toB = ease.inOutCubic(range(tt, T.zoomB + 0.1, T.clickB - 0.05));
    c = { x: lerp(c.x, b.x, toB), y: lerp(c.y, b.y, toB) };
    const away = ease.inCubic(range(tt, T.out, T.out + 0.6));
    return { x: lerp(c.x, w * 1.05, away), y: lerp(c.y, h * 1.1, away) };
  };
  cur = at(t);
  const press = Math.max(1 - Math.abs(t - T.clickA) / 0.12, 1 - Math.abs(t - T.clickB) / 0.12, 0);
  clickRipple(sc, a.x, a.y, range(t, T.clickA, T.clickA + 0.6));
  clickRipple(sc, b.x, b.y, range(t, T.clickB, T.clickB + 0.6));
  if (t > T.zoomA) drawCursor(sc, cur.x, cur.y, press, 1, cursorLean(at, t, w));

  // Pinned headline on a shade band.
  // Deepens while zoomed so the headline stays legible over bright screenshots.
  const zk = clamp((z - 1) / (Z - 1));
  const bandH = h * lerp(0.26, 0.34, zk);
  const band = ctx.createLinearGradient(0, 0, 0, bandH);
  band.addColorStop(0, rgba(palette.bg0, 0.95));
  band.addColorStop(lerp(0.3, 0.62, zk), rgba(palette.bg0, lerp(0.75, 0.94, zk)));
  band.addColorStop(1, rgba(palette.bg0, 0));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, bandH);
  topHeadline(sc);
}

/* ───────────────────────── Bento Grid ───────────────────────── */

type Cell = [number, number, number, number];
const BENTO_LAND: Record<number, Cell[]> = {
  2: [[0, 0, 2, 2], [2, 0, 2, 2]],
  3: [[0, 0, 2, 2], [2, 0, 2, 1], [2, 1, 2, 1]],
  4: [[0, 0, 2, 1], [2, 0, 2, 1], [0, 1, 2, 1], [2, 1, 2, 1]],
  5: [[0, 0, 2, 1], [2, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 2, 1]],
  6: [[0, 0, 2, 1], [2, 0, 1, 1], [3, 0, 1, 2], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]],
};
const BENTO_PORT: Record<number, Cell[]> = {
  2: [[0, 0, 2, 2], [0, 2, 2, 2]],
  3: [[0, 0, 2, 2], [0, 2, 2, 1], [0, 3, 2, 1]],
  4: [[0, 0, 2, 1], [0, 1, 2, 1], [0, 2, 2, 1], [0, 3, 2, 1]],
  5: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1], [0, 2, 2, 1], [0, 3, 2, 1]],
  6: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 1, 1, 1], [0, 2, 1, 1], [1, 2, 1, 1], [0, 3, 2, 1]],
};

function bentoItems(scene: Scene) {
  const items = (scene.items ?? []).filter(Boolean).slice(0, 6);
  return items.length >= 2 ? items : ["Feature one", "Feature two", "Feature three", "Feature four"];
}

function bentoTiming(scene: Scene, beat: number) {
  const n = bentoItems(scene).length;
  const st = Math.min(0.14, beat / 2);
  return Array.from({ length: n }, (_, i) => 0.45 + i * st);
}

/**
 * The small live visual in each bento tile, chosen for what the tile is about: bars or a sparkline
 * for analytics and growth, teammates for collaboration, a checklist for tasks and approvals, a
 * switch for settings, access and automation, a progress ring for goals, uploads and launches.
 * Two tiles don't show the same visual while another one is free.
 */
const MICRO: [RegExp, number[]][] = [
  [/\b(invoice|expense|cash|money|spend|budget|payment|billing|receipt|payroll|finance|accounting)/, [4, 0]],
  [/\b(analytic|insight|report|metric|kpi|dashboard|chart|stats|forecast|growth|revenue|sales|conversion|traffic|trend)/, [0, 4]],
  [/\b(team|collab|together|people|member|share|shared|customer|client|user|candidate|hire|community|guest)/, [3]],
  [/\b(task|todo|to-do|checklist|project|approv|onboard|review|workflow|step|process|compliance|audit)/, [5]],
  [/\b(automat|setting|config|control|toggle|access|permission|role|privacy|secur|integrat|sync|alert|notif|switch)/, [1]],
  [/\b(goal|target|progress|upload|backup|storage|deploy|launch|release|ship(?!p)|build|speed|performance|uptime|budget|plan)/, [2]],
];

function microKinds(items: string[]) {
  const used = new Set<number>();
  return items.map((it, i) => {
    const text = it.toLowerCase();
    const want = MICRO.filter(([re]) => re.test(text)).flatMap(([, k]) => k);
    // Nothing specific: the neutral visuals (ring, checklist) before the ones that imply a meaning.
    const pick = want.find((k) => !used.has(k)) ?? [2, 5, 3, 1, 0, 4].find((k) => !used.has(k)) ?? want[0] ?? i % 6;
    used.add(pick);
    return pick;
  });
}

function microVisual(sc: SkillContext, kind: number, x: number, y: number, mw: number, mh: number, lt: number) {
  const { ctx, u, palette } = sc;
  const g = ctx.createLinearGradient(x, y + mh, x + mw, y);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.save();
  switch (kind % 6) {
    case 0: {
      // Bars growing.
      const n = 7;
      const bw = mw / (n * 1.6);
      for (let i = 0; i < n; i++) {
        const hh = mh * (0.25 + 0.7 * ((i * 37) % 100) / 100) * ease.outExpo(range(lt, 0.2 + i * 0.06, 1 + i * 0.06));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x + i * bw * 1.6, y + mh - hh, bw, hh, 4 * u);
        ctx.fill();
      }
      break;
    }
    case 1: {
      // Toggle flips on.
      const on = ease.outBack(range(lt, 0.7, 1.1));
      const tw = Math.min(mw * 0.5, 110 * u);
      const th = tw * 0.52;
      const tx = x + mw - tw;
      const ty = y + mh / 2 - th / 2;
      ctx.fillStyle = on > 0.5 ? g : "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, th / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(tx + th / 2 + (tw - th) * clamp(on), ty + th / 2, th * 0.4, 0, TAU);
      ctx.fill();
      break;
    }
    case 2: {
      // Progress ring.
      const rr = Math.min(mw, mh) * 0.42;
      const cx = x + mw - rr - 4 * u;
      const cy = y + mh / 2;
      // It fills all the way and ticks: no percentage, so the tile never shows a made-up number.
      const p = ease.inOutCubic(range(lt, 0.3, 1.5));
      ctx.lineWidth = 9 * u;
      ctx.lineCap = "round";
      ctx.strokeStyle = palette.light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * p);
      ctx.stroke();
      const tick = clamp(spring(lt - 1.5, 12, 6.5), 0, 1.15);
      if (tick > 0) drawLucide(ctx, "Check", cx, cy, rr * 0.9 * tick, palette.primary, { progress: Math.min(1, tick) });
      break;
    }
    case 3: {
      // Avatar stack.
      const rr = Math.min(mh * 0.32, 26 * u);
      const cols = [palette.primary, palette.secondary, palette.accent, "#f59e0b"];
      for (let i = 0; i < 4; i++) {
        const k = ease.outBack(range(lt, 0.3 + i * 0.1, 0.7 + i * 0.1));
        const cx = x + mw - rr - i * rr * 1.4;
        ctx.save();
        ctx.translate(cx, y + mh / 2);
        ctx.scale(k, k);
        ctx.fillStyle = cols[i];
        ctx.strokeStyle = sc.palette.bg0;
        ctx.lineWidth = 4 * u;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(0, -rr * 0.2, rr * 0.35, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, rr * 0.55, rr * 0.6, rr * 0.4, 0, Math.PI, 0);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 4: {
      // Sparkline drawing on.
      const p = ease.inOutCubic(range(lt, 0.2, 1.3));
      ctx.lineWidth = 4 * u;
      ctx.lineJoin = "round";
      ctx.strokeStyle = g;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 12 * u;
      ctx.beginPath();
      const n = 24;
      for (let i = 0; i <= n * p; i++) {
        const px = x + (i / n) * mw;
        const py = y + mh * (0.85 - 0.6 * (i / n) - 0.12 * Math.sin(i * 1.3));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    default: {
      // Checklist ticking.
      for (let i = 0; i < 3; i++) {
        const k = ease.outBack(range(lt, 0.3 + i * 0.2, 0.7 + i * 0.2));
        const ry = y + (i + 0.5) * (mh / 3);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.roundRect(x + mw * 0.35, ry - 6 * u, mw * 0.6, 12 * u, 6 * u);
        ctx.fill();
        ctx.save();
        ctx.translate(x + mw * 0.22, ry);
        ctx.scale(k, k);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 11 * u, 0, TAU);
        ctx.fill();
        drawIcon(ctx, "check", 0, 0, 20 * u, "#fff");
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function bento(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 2 });
  // Square frames take the two-column layout too (a row of four is too tight).
  const square = w <= h * 1.25 && w >= h;
  const portrait = h > w || square;
  const items = bentoItems(scene);
  const n = items.length;
  const cells = (portrait ? BENTO_PORT : BENTO_LAND)[n];
  const cols = portrait ? 2 : 4;
  const rows = portrait ? 4 : 2;
  topHeadline(sc);
  const gx0 = w * 0.07;
  const gy0 = h * (square ? 0.25 : portrait ? 0.2 : 0.25);
  const gw = w * 0.86;
  const gh = Math.min(h * (portrait ? 0.74 : 0.68), h - tokens(w, h).safe.bottom - gy0);
  const gap = 16 * u;
  const cw = (gw - gap * (cols - 1)) / cols;
  const rh = (gh - gap * (rows - 1)) / rows;
  const times = bentoTiming(scene, sc.beat);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const active = Math.floor(Math.max(0, t - 1.4) / Math.max(0.5, sc.beat * 2)) % n;
  // Real product UI from the live page (KPI tiles, charts, panels) goes into the biggest cells,
  // in place of the generic micro-visuals; the site's own feature cards aren't reused here.
  const titles = items.map((it) => norm(it.split(/\s+[—–]\s+/)[0]));
  const ui = (sc.brand?.parts ?? [])
    .filter((p) => p.kind !== "button" && !titles.some((tt) => tt && norm(p.text ?? "").includes(tt)))
    .sort((a, b) => b.w * b.h - a.w * a.h);
  const byArea = cells.map((cell, i) => ({ i, a: cell[2] * cell[3] })).sort((a, b) => b.a - a.a || a.i - b.i);
  // Each tile's icon and visual come from its own words (title and description).
  const icons = iconsFor(items, sc);
  const micros = microKinds(items);
  const partFor = new Map(byArea.slice(0, ui.length).map((c, k) => [c.i, ui[k]]));
  cells.forEach(([c, r, cs, rs], i) => {
    const x = gx0 + c * (cw + gap);
    const y = gy0 + r * (rh + gap);
    const bw = cs * cw + (cs - 1) * gap;
    const bh = rs * rh + (rs - 1) * gap;
    const lt = t - times[i];
    if (lt <= 0) return;
    const s = clamp(spring(lt, 11, 7), 0, 1.1);
    ctx.save();
    ctx.globalAlpha = clamp(lt / 0.25) * (1 - ex);
    ctx.translate(x + bw / 2, y + bh / 2 + (1 - Math.min(1, s)) * 36 * u - ex * 20 * u);
    const sc2 = 0.9 + 0.1 * s;
    ctx.scale(sc2, sc2);
    ctx.translate(-(x + bw / 2), -(y + bh / 2));
    const lit = i === active && t > 1.4;
    glassCard(sc, x, y, bw, bh, { r: 20 * u, tint: lit ? palette.bg1 : undefined });
    if (lit) borderBeam(sc, x, y, bw, bh, (t - 1.4) * 0.6, { r: 20 * u });
    // One inset on the 8pt grid (24px) for the icon tile, the label and the visual.
    const pad = 24 * u;
    // Icon tile.
    const it = 52 * u;
    const ig = ctx.createLinearGradient(x + pad, y + pad, x + pad + it, y + pad + it);
    ig.addColorStop(0, palette.primary);
    ig.addColorStop(1, palette.secondary);
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, it, it, 14 * u);
    ctx.fill();
    const [title, desc] = items[i].split(/\s+[—–]\s+/);
    drawIcon(ctx, icons[i], x + pad + it / 2, y + pad + it / 2, it * 0.56, "#fff", ease.outCubic(range(lt, 0.15, 0.9)));
    // Label, with the feature's one-line description under it in roomy cells.
    const fs = portrait ? Math.min(46 * u, bw / 14) : Math.min(30 * u, bw / 11);
    const wrap = (text: string, font: string) => {
      ctx.font = font;
      const lines: string[] = [];
      let line = "";
      for (const wd of text.split(" ")) {
        const next = line ? `${line} ${wd}` : wd;
        if (ctx.measureText(next).width > bw - pad * 2 && line) {
          lines.push(line);
          line = wd;
        } else line = next;
      }
      lines.push(line);
      if (lines.length > 2) lines[1] = `${lines[1].replace(/[\s,.;:]+$/, "")}…`;
      return lines.slice(0, 2);
    };
    const ds = fs * 0.66;
    const dFont = `500 ${Math.round(ds)}px Inter, sans-serif`;
    const dLines = desc && bh > 170 * u && bw > 260 * u ? wrap(desc, dFont) : [];
    const tFont = `700 ${Math.round(fs)}px Inter, sans-serif`;
    const lines = wrap(title, tFont);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const baseY = y + bh - pad;
    ctx.font = dFont;
    ctx.fillStyle = rgba(palette.text, 0.62);
    dLines.forEach((l, li) => ctx.fillText(l, x + pad, baseY - (dLines.length - 1 - li) * ds * 1.3));
    const titleBase = dLines.length ? baseY - dLines.length * ds * 1.3 - fs * 0.25 : baseY;
    ctx.font = tFont;
    ctx.fillStyle = palette.text;
    lines.forEach((l, li, arr) => ctx.fillText(l, x + pad, titleBase - (arr.length - 1 - li) * fs * 1.2));
    // Visual in the upper-right area: a real UI component when we have one, else a micro-animation.
    const mx = x + bw * 0.45;
    const my = y + pad;
    const mw = bw * 0.5 - pad;
    const mh = Math.max(40 * u, bh - pad - (lines.length > 1 ? fs * 2.6 : fs * 1.5) - dLines.length * ds * 1.3 - 40 * u);
    const part = partFor.get(i);
    const pimg = part ? getImage(part.src) : null;
    const titleTop = titleBase - (lines.length - 1) * fs * 1.2 - fs;
    const ph = Math.min(titleTop - 16 * u - (y + 18 * u), bh * 0.7);
    if (part && pimg?.naturalWidth && ph > 60 * u) {
      // The component peeks out of the card, cropped by its edge, drifting gently.
      const aspect = pimg.naturalWidth / pimg.naturalHeight;
      const px0 = x + Math.max(22 * u + it + 20 * u, bw * (aspect > 2.2 ? 0.2 : 0.34));
      const pw = Math.max(ph * aspect, x + bw - px0 + 24 * u);
      const phh = pw / aspect;
      const rise = (1 - ease.outCubic(range(lt, 0.1, 0.8))) * 40 * u;
      const drift = Math.sin((sc.globalT ?? t) * 0.8 + i) * 4 * u;
      const py0 = y + 18 * u + rise + drift;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, bw, Math.max(0, titleTop - 10 * u - y), [20 * u, 20 * u, 0, 0]);
      ctx.clip();
      ctx.shadowColor = palette.light ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 24 * u;
      ctx.shadowOffsetY = 8 * u;
      ctx.beginPath();
      ctx.roundRect(px0, py0, pw, phh, Math.max(6 * u, part.r * (pw / part.w)));
      ctx.fillStyle = palette.bg1;
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.clip();
      ctx.drawImage(pimg, px0, py0, pw, phh);
      ctx.restore();
    } else microVisual(sc, micros[i], mx, my, mw, Math.min(mh, bh * 0.55), lt);
    ctx.restore();
  });
}

/* ───────────────────────── Feature Icons ───────────────────────── */

function iconFeatureItems(scene: Scene) {
  const items = (scene.items ?? []).filter(Boolean).slice(0, 6);
  return items.length >= 2 ? items : ["Quick setup", "Access controls", "Built for teams", "Real-time insights"];
}

/** One card per beat (clearly one after another), fitted to the scene's length. */
function iconFeaturesTiming(scene: Scene, beat: number) {
  const n = iconFeatureItems(scene).length;
  const room = Math.max(0.2, (scene.duration - 1.9) / Math.max(1, n - 1));
  const st = Math.min(Math.max(0.34, Math.min(0.6, beat)), room);
  return Array.from({ length: n }, (_, i) => 0.5 + i * st);
}

/**
 * The classic SaaS feature row: big line-art icons draw themselves on inside glowing tiles,
 * each with a short title and (when given as "Title — description") a one-line benefit.
 */
function iconFeatures(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  // Square frames are too narrow for a row of four: two columns, like vertical ones.
  const square = !portrait && w / h < 1.25;
  topHeadline(sc);
  const items = iconFeatureItems(scene);
  const n = items.length;
  const cols = portrait || square ? Math.min(2, n) : n <= 4 ? n : 3;
  const rows = Math.ceil(n / cols);
  const times = iconFeaturesTiming(scene, sc.beat);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const gx0 = w * (portrait ? 0.07 : square ? 0.1 : 0.08);
  const gw = w * (portrait ? 0.86 : square ? 0.8 : 0.84);
  const gy0 = h * (portrait ? 0.26 : square ? 0.3 : 0.32);
  const gh = h * (portrait ? 0.62 : square ? 0.62 : 0.56);
  const gap = 22 * u;
  const cw = (gw - gap * (cols - 1)) / cols;
  const ch = Math.min((gh - gap * (rows - 1)) / rows, cw * (portrait ? 1.15 : square ? 0.8 : 0.95));
  const S = portrait ? 1.3 : square ? 1.15 : 1;
  items.forEach((item, i) => {
    const [title, desc] = item.split(/\s+[—–]\s+/);
    const c = i % cols;
    const r = Math.floor(i / cols);
    const rowCount = r === rows - 1 ? n - r * cols : cols;
    const rowOffset = ((cols - rowCount) * (cw + gap)) / 2;
    const x = gx0 + rowOffset + c * (cw + gap);
    const y = gy0 + r * (ch + gap);
    const lt = t - times[i];
    if (lt <= 0) return;
    // Each card rises in on its own beat (staying level), then stays lifted and outlined
    // ("in the spotlight") until the next card arrives.
    const k = clamp(spring(lt, 10, 6.5), 0, 1.1);
    const settleK = Math.min(1, k);
    const next = times[i + 1] ?? times[n - 1] + 0.7;
    // While cards arrive, the newest is in the spotlight; once all have landed the spotlight keeps
    // moving through them on the beat, so the slide stays alive until it leaves.
    const cycle = times[n - 1] + 0.7;
    const period = Math.max(0.6, sc.beat * 2);
    const since = t - cycle;
    const onCycle = since >= 0 && Math.floor(since / period) % n === i ? ease.outCubic(range(since % period, 0, 0.25)) * (1 - ease.inCubic(range(since % period, period - 0.2, period))) : 0;
    const spot = Math.max(ease.outCubic(range(lt, 0.15, 0.4)) * (1 - ease.inOutCubic(range(t, next, next + 0.35))), onCycle) * (1 - ex);
    const float = Math.sin((sc.globalT ?? t) * 1.3 + i) * 4 * u;
    ctx.save();
    ctx.globalAlpha = clamp(lt / 0.2) * (1 - ex);
    ctx.translate(x + cw / 2, y + ch / 2 + (1 - settleK) * 90 * u + float - spot * 8 * u);
    const sk = (0.8 + 0.2 * k) * (1 + 0.035 * spot);
    ctx.scale(sk, sk);
    ctx.translate(-(x + cw / 2), -(y + ch / 2));
    glassCard(sc, x, y, cw, ch, { r: 22 * u });
    if (spot > 0.01) borderBeam(sc, x, y, cw, ch, (sc.globalT ?? t) * 0.6 + i * 0.25, { r: 22 * u, alpha: spot });
    // Arrival ring: a soft outline expands off the card as it lands.
    const ring = range(lt, 0.12, 0.7);
    if (ring > 0 && ring < 1) {
      const g = 18 * u * ease.outCubic(ring);
      ctx.save();
      ctx.strokeStyle = rgba(palette.primary, 0.55 * (1 - ring));
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.roundRect(x - g, y - g, cw + g * 2, ch + g * 2, 22 * u + g);
      ctx.stroke();
      ctx.restore();
    }
    // Icon tile with an accent glow; the icon draws itself on.
    // The icon pops in just after its card lands.
    const pop = clamp(spring(lt - 0.12, 12, 6), 0, 1.15);
    const ts = Math.min(cw * 0.36, 104 * u * S) * (0.6 + 0.4 * pop);
    const tx = x + cw / 2;
    const ty = y + ch * 0.36;
    const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, ts * 1.2);
    glow.addColorStop(0, rgba(palette.primary, palette.light ? 0.18 : 0.32));
    glow.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(tx - ts * 1.3, ty - ts * 1.3, ts * 2.6, ts * 2.6);
    ctx.beginPath();
    ctx.roundRect(tx - ts / 2, ty - ts / 2, ts, ts, ts * 0.28);
    const tile = ctx.createLinearGradient(tx - ts / 2, ty - ts / 2, tx + ts / 2, ty + ts / 2);
    tile.addColorStop(0, rgba(palette.primary, 0.95));
    tile.addColorStop(1, rgba(palette.secondary, 0.95));
    ctx.fillStyle = tile;
    ctx.shadowColor = rgba(palette.primary, 0.6);
    ctx.shadowBlur = 24 * u;
    ctx.fill();
    ctx.shadowBlur = 0;
    drawIcon(ctx, iconsFor(items, sc)[i], tx, ty, ts * 0.56, palette.light ? "#ffffff" : palette.bg0, ease.outCubic(range(lt, 0.15, 1)));
    // Title (wrapped to two lines, shrinking if needed) + optional description.
    const wrapLines = (text: string, font: string, maxW: number) => {
      ctx.font = font;
      const out: string[] = [];
      let line = "";
      for (const wd of text.split(" ")) {
        const next = line ? `${line} ${wd}` : wd;
        if (ctx.measureText(next).width > maxW && line) {
          out.push(line);
          line = wd;
        } else line = next;
      }
      out.push(line);
      return out;
    };
    let fs = Math.min(30 * u * S, cw / 9);
    let tl = wrapLines(title, `700 ${Math.round(fs)}px Inter, sans-serif`, cw - 36 * u);
    while (tl.length > 2 && fs > 16 * u) {
      fs *= 0.88;
      tl = wrapLines(title, `700 ${Math.round(fs)}px Inter, sans-serif`, cw - 36 * u);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.font = `700 ${Math.round(fs)}px Inter, sans-serif`;
    const titleTop = y + ch * 0.64;
    tl.slice(0, 2).forEach((l, li) => fillTextMid(ctx, l, tx, titleTop + li * fs * 1.15));
    const descTop = titleTop + (Math.min(2, tl.length) - 1) * fs * 1.15;
    if (desc && ch > 150 * u) {
      ctx.font = `500 ${Math.round(fs * 0.66)}px Inter, sans-serif`;
      ctx.fillStyle = rgba(palette.text, 0.62);
      // Two lines; a longer description sets a touch smaller before anything is shortened.
      const dfit = fitTextLines(ctx, desc, cw - 44 * u, { maxLines: 2, minScale: 0.8 });
      ctx.font = dfit.font;
      dfit.lines.forEach((l, li) => fillTextMid(ctx, l, tx, descTop + fs * 1.1 + li * fs * 0.9));
    }
    ctx.restore();
  });
}

/* ───────────────────────── Floating UI Cards ───────────────────────── */

function cardsTiming(beat: number) {
  const st = Math.max(0.3, beat);
  return [0.8, 0.8 + st, 0.8 + st * 2, 0.8 + st * 3];
}

function uiCards(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  topHeadline(sc);
  const ex = ease.inCubic(exitT(sc, 0.4));
  // Central product screen.
  const sw = portrait ? w * 0.78 : w * 0.5;
  const sh = sw / (portrait ? 0.9 : 1.6);
  const scx = w / 2;
  const scy = portrait ? h * 0.55 : h * 0.58;
  const k0 = clamp(spring(t - 0.2, 9, 7), 0, 1.05);
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.3) * (1 - ex);
  ctx.translate(scx, scy + (1 - Math.min(1, k0)) * 60 * u);
  ctx.transform(1, 0, -0.06, 1, 0, 0);
  ctx.scale(0.92 + 0.08 * k0, 0.92 + 0.08 * k0);
  glassCard(sc, -sw / 2, -sh / 2, sw, sh, { r: 16 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 16 * u);
  ctx.clip();
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  // No product image: the app's own panel captured from the live page, before any mock UI.
  const panel = media ? null : [...(brand?.parts ?? [])].filter((p) => p.kind === "panel" || p.kind === "media").sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const panelImg = panel ? getImage(panel.src) : null;
  if (media) drawCover(ctx, media, -sw / 2, -sh / 2, sw, sh, 1.02, 0.5, 0.25);
  else if (panelImg?.naturalWidth) drawCover(ctx, panelImg, -sw / 2, -sh / 2, sw, sh, 1, 0.5, 0);
  else mockUi(sc, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
  borderBeam(sc, -sw / 2, -sh / 2, sw, sh, t * 0.35, { r: 16 * u, alpha: 0.8 });
  ctx.restore();

  const times = cardsTiming(sc.beat);
  const items = scene.items ?? [];
  const stat = parseStat(items[1] ?? scene.subtext ?? "");
  // The avatars widget widens (within reason) so its label's longest word fits.
  ctx.font = subFont(17 * u, 700);
  const longest = Math.max(...(items[3] ?? "Your whole team").split(/\s+/).map((wd) => ctx.measureText(wd).width));
  const avW = clamp(150 * u + longest / 0.8 + 6 * u, 250 * u, 340 * u);
  const widgets = [
    { x: scx - sw * 0.72, y: scy - sh * 0.46, w: 300 * u, h: 86 * u, kind: "toast" },
    { x: scx + sw * 0.36, y: scy + sh * 0.12, w: 250 * u, h: 150 * u, kind: "metric" },
    { x: scx - sw * 0.66, y: scy + sh * 0.2, w: 220 * u, h: 130 * u, kind: "chart" },
    { x: scx + sw * 0.32, y: scy - sh * 0.56, w: avW, h: 80 * u, kind: "avatars" },
  ];
  const WS = portrait ? 1.25 : 1.4;
  if (portrait) {
    // Scaled widgets' outer edges sit on the title-safe margins.
    const g = tokens(w, h);
    const grow = (wd: { w: number }) => (wd.w * (WS - 1)) / 2;
    widgets[0].x = g.safe.left + grow(widgets[0]);
    widgets[1].x = g.safe.right - widgets[1].w - grow(widgets[1]);
    widgets[2].x = g.safe.left + grow(widgets[2]);
    widgets[3].x = g.safe.right - widgets[3].w - grow(widgets[3]);
  }
  widgets.forEach((wd, i) => {
    const lt = t - times[i];
    if (lt <= 0) return;
    const s = clamp(spring(lt, 12, 7), 0, 1.1);
    const float = Math.sin(t * 1.3 + i * 1.7) * 7 * u;
    ctx.save();
    ctx.globalAlpha = clamp(lt / 0.2) * (1 - ex);
    ctx.translate(wd.x + wd.w / 2, wd.y + wd.h / 2 + float);
    ctx.scale((0.7 + 0.3 * s) * WS, (0.7 + 0.3 * s) * WS);
    ctx.translate(-wd.w / 2, -wd.h / 2);
    glassCard(sc, 0, 0, wd.w, wd.h, { r: 16 * u });
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const g = ctx.createLinearGradient(0, 0, wd.w, wd.h);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    if (wd.kind === "toast") {
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(16 * u, wd.h / 2 - 22 * u, 44 * u, 44 * u, 12 * u);
      ctx.fill();
      drawIcon(ctx, iconFor(items[0] ?? "", 0, sc), 38 * u, wd.h / 2, 24 * u, "#fff");
      ctx.fillStyle = palette.text;
      ctx.font = subFont(19 * u, 700);
      const title = items[0] ?? "Updated just now";
      // A long title takes two lines; the time line moves down to make room.
      const tfit = fitTextLines(ctx, title, wd.w - 90 * u, { maxLines: 2, minScale: 0.8 });
      const extra = (tfit.lines.length - 1) * tfit.size * 0.55;
      fillTextFit(ctx, title, 74 * u, wd.h / 2 - 11 * u - extra, wd.w - 90 * u, { maxLines: 2, lineHeight: 1.08, minScale: 0.8 });
      ctx.fillStyle = rgba(palette.text, 0.55);
      ctx.font = subFont(15 * u, 500);
      fillTextFit(ctx, brand?.name ? `${brand.name} · now` : "just now", 74 * u, wd.h / 2 + 14 * u + extra, wd.w - 90 * u, { maxLines: 1, minScale: 0.8 });
    } else if (wd.kind === "metric") {
      const count = ease.outExpo(range(lt, 0.1, 1.4));
      const v = stat.value * count;
      const txt = `${stat.prefix}${stat.decimals ? v.toFixed(stat.decimals) : Math.round(v).toLocaleString("en-US")}${stat.suffix}`;
      ctx.fillStyle = g;
      ctx.font = `800 ${Math.round(40 * u)}px Inter, sans-serif`;
      ctx.fillText(txt, 20 * u, 50 * u);
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.font = subFont(16 * u, 500);
      fillTextFit(ctx, stat.label || "growth", 20 * u, 88 * u, wd.w - 40 * u, { maxLines: 1, minScale: 0.75 });
      microVisual(sc, 4, 20 * u, 100 * u, wd.w - 40 * u, wd.h - 112 * u, lt);
    } else if (wd.kind === "chart") {
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.font = subFont(15 * u, 600);
      // The label wraps onto a second line when it needs to; the chart sits below it.
      ctx.textBaseline = "top";
      const n = fillTextFit(ctx, items[2] ?? "This week", 18 * u, 15 * u, wd.w - 36 * u, { maxLines: 2, lineHeight: 1.1, minScale: 0.85 });
      ctx.textBaseline = "middle";
      const dy = (n - 1) * 16 * u;
      microVisual(sc, 0, 18 * u, 42 * u + dy, wd.w - 36 * u, wd.h - 58 * u - dy, lt);
    } else {
      microVisual(sc, 3, 12 * u, 10 * u, 120 * u, wd.h - 20 * u, lt);
      ctx.fillStyle = palette.text;
      ctx.font = subFont(17 * u, 700);
      fillTextFit(ctx, items[3] ?? "Your whole team", 138 * u, wd.h / 2, wd.w - 150 * u, { maxLines: 3, lineHeight: 1.08, minScale: 0.8 });
    }
    ctx.restore();
  });
}

/* ───────────────────────── Pain Points ───────────────────────── */

function painTiming(scene: Scene, beat: number) {
  const n = Math.max(1, (scene.items ?? []).length);
  const step = Math.max(0.45, beat);
  const appear = Array.from({ length: n }, (_, i) => 0.2 + i * step);
  const strike = appear.map((a) => a + step * 0.9);
  const clear = strike[n - 1] + 0.45;
  return { appear, strike, clear, solve: clear + 0.2 };
}

function painStrike(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.6 });
  const items = (scene.items ?? []).slice(0, 4);
  const T = painTiming(scene, sc.beat);
  const clearK = ease.inCubic(range(t, T.clear, T.clear + 0.35));
  if (items.length && clearK < 1) {
    const size = Math.min(70 * u, (w * 0.8) / Math.max(8, Math.max(...items.map((i) => i.length)) * 0.55));
    const lh = size * 1.55;
    const top = h * 0.46 - ((items.length - 1) * lh) / 2;
    chapter(sc, top - lh * 0.4);
    ctx.save();
    ctx.font = saasFont(sc) === "inter" ? `700 ${Math.round(size)}px Inter, sans-serif` : displayFont(saasFont(sc), size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    items.forEach((it, i) => {
      const k = ease.outCubic(range(t, T.appear[i], T.appear[i] + 0.45));
      if (k <= 0) return;
      const sk = ease.inOutCubic(range(t, T.strike[i], T.strike[i] + 0.3));
      const y = top + i * lh - clearK * 30 * u;
      ctx.save();
      ctx.globalAlpha = k * (1 - 0.6 * sk) * (1 - clearK);
      const blur = (1 - k) * 10 * u + clearK * 12 * u;
      if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.fillStyle = palette.text;
      ctx.fillText(it, w / 2, y + (1 - k) * 16 * u);
      const tw = ctx.measureText(it).width;
      // A red ✕ marks each pain as it gets struck out.
      drawIcon(ctx, "CircleX", w / 2 - tw / 2 - size * 0.75, y + (1 - k) * 16 * u, size * 0.7, "#ff4d6d", sk > 0 ? 1 : 0.001);
      if (sk > 0) {
        ctx.globalAlpha = (1 - clearK);
        ctx.fillStyle = "#ff4d6d";
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 12 * u;
        ctx.fillRect(w / 2 - tw / 2 - 10 * u, y - 2 * u, (tw + 20 * u) * sk, 5 * u);
      }
      ctx.restore();
    });
    ctx.restore();
  }
  // The solution line.
  const solveAt = items.length ? T.solve : 0.2;
  if (t >= solveAt - 0.05) {
    const layout = sentence(sc, { text: accented(scene.text), cy: h * 0.46, sizeFrac: 0.11, widthFrac: 0.8, maxLines: 3 });
    const n = blurInLayout(sc, layout, solveAt, stagger(sc), { exitAt: d - 0.45 });
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.62;
    subText(sc, scene.subtext, bottom + 44 * u, range(t, solveAt + 0.3 + n * stagger(sc), solveAt + 0.9 + n * stagger(sc)) * (1 - range(t, d - 0.45, d)));
  }
}

/* ───────────────────────── Integration Orbit ───────────────────────── */

const ORBIT_ICONS: IconKind[] = ["chat", "chart", "cloud", "code", "globe", "shield", "users", "clock", "layers", "bolt", "sparkle", "check"];
const orbitIcons = (sc: SkillContext) => CONCEPT_MAP[sc.concept ?? ""]?.orbit ?? ORBIT_ICONS;

function orbit(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { grid: true, beams: 2 });
  const portrait = h > w;
  const short = Math.min(w, h);
  const cx = w / 2;
  const cy = portrait ? h * 0.44 : h * 0.43;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const rings = [
    { r: short * 0.22, n: 6, speed: 0.18 },
    { r: short * 0.37, n: 9, speed: -0.12 },
  ];
  // Landscape and square tilt the orbit into an ellipse, so the outer tiles clear the headline below.
  const ey = portrait ? 1 : 0.78;
  // Orbit guides.
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp(t / 0.5);
  ctx.strokeStyle = rgba(palette.text, 0.08);
  ctx.lineWidth = 1.2 * u;
  rings.forEach((rg) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rg.r, rg.r * ey, 0, 0, TAU);
    ctx.stroke();
  });
  ctx.restore();
  let idx = 0;
  rings.forEach((rg, ri) => {
    for (let i = 0; i < rg.n; i++) {
      const delay = 0.35 + idx * 0.05;
      const k = clamp(spring(t - delay, 10, 7), 0, 1.1);
      if (t < delay) {
        idx++;
        continue;
      }
      const a = (i / rg.n) * TAU + t * rg.speed + ri * 0.3;
      const rr = rg.r * Math.min(1, k);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * ey;
      // Connector + data pulse (inner ring only).
      if (ri === 0) {
        ctx.save();
        ctx.globalAlpha = 0.5 * (1 - ex);
        const lg = ctx.createLinearGradient(cx, cy, x, y);
        lg.addColorStop(0, rgba(palette.primary, 0.6));
        lg.addColorStop(1, rgba(palette.primary, 0.05));
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
        const p = ((t * 0.8 + i / rg.n) % 1);
        ctx.fillStyle = palette.primary;
        ctx.shadowColor = palette.primary;
        ctx.shadowBlur = 10 * u;
        ctx.beginPath();
        ctx.arc(lerp(x, cx, p), lerp(y, cy, p), 3.5 * u, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      const ts = (ri === 0 ? 96 : 80) * u;
      ctx.save();
      ctx.globalAlpha = clamp(k) * (1 - ex);
      glassCard(sc, x - ts / 2, y - ts / 2, ts, ts, { r: 16 * u });
      const hue = [palette.primary, palette.secondary, palette.accent][idx % 3];
      const icons = orbitIcons(sc);
      drawIcon(ctx, icons[idx % icons.length], x, y, ts * 0.46, hue);
      ctx.restore();
      idx++;
    }
  });
  // Centre: the brand.
  const ck = clamp(spring(t - 0.1, 9, 6), 0, 1.1);
  const cs = short * 0.13 * ck;
  ctx.save();
  ctx.globalAlpha = clamp(ck) * (1 - ex);
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, cs * 2.2);
  halo.addColorStop(0, rgba(palette.primary, 0.45));
  halo.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - cs * 2.5, cy - cs * 2.5, cs * 5, cs * 5);
  glassCard(sc, cx - cs, cy - cs, cs * 2, cs * 2, { r: 28 * u, tint: palette.bg1 });
  borderBeam(sc, cx - cs, cy - cs, cs * 2, cs * 2, t * 0.5, { r: 28 * u });
  if (!drawLogoMark(sc, brand?.logo, cx, cy, cs * 1.1)) {
    ctx.fillStyle = palette.text;
    ctx.font = `800 ${Math.round(cs)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextMid(ctx, (brand?.name ?? scene.text).slice(0, 1).toUpperCase(), cx, cy);
  }
  ctx.restore();
  const layout = sentence(sc, { text: accented(scene.text), cy: portrait ? h * 0.8 : h * 0.86, sizeFrac: 0.07, widthFrac: 0.84, maxLines: 2 });
  chapter(sc, layout.ys[0] - layout.size * 0.6, 0.5);
  blurInLayout(sc, layout, 0.6, 0.06, { exitAt: d - 0.4 });
}

/* ───────────────────────── Testimonial ───────────────────────── */

function testimonial(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1, aurora: 0.7 });
  const portrait = h > w;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const cw = portrait ? w * 0.88 : Math.min(w * 0.72, 1100 * u);
  const quote = `“${scene.text.replace(/^["“]|["”]$/g, "")}”`;
  // Quote layout (sentence case, lighter weight feel via Inter 800 at smaller size).
  const layout = sentence(sc, { text: quote, cy: h * 0.47, sizeFrac: portrait ? 0.062 : 0.055, widthFrac: (cw - 120 * u) / w, maxLines: 5 });
  const qTop = layout.ys[0] - layout.size * 0.6;
  const qBottom = layout.ys[layout.ys.length - 1] + layout.size * 0.6;
  const ch = qBottom - qTop + 280 * u;
  const cx0 = w / 2 - cw / 2;
  const cy0 = qTop - 110 * u;
  const k = clamp(spring(t - 0.1, 10, 7), 0, 1.05);
  chapter(sc, cy0 - 20 * u);
  // Once it has landed the whole card floats: a slow bob and a slight tilt, as if a pane of glass
  // were turning in the light (quote and author ride with it).
  const T = sc.globalT ?? t;
  const live = ease.inOutCubic(range(t, 0.6, 1.6));
  const midY = cy0 + ch / 2;
  ctx.save();
  ctx.translate(w / 2, midY + Math.sin(T * 0.9) * 6 * u * live);
  ctx.transform(1, Math.sin(T * 0.55) * 0.005 * live, Math.cos(T * 0.47) * 0.004 * live, 1, 0, 0);
  ctx.translate(-w / 2, -midY);
  backLight(sc, w / 2, midY, cw * 0.55, ch * 0.6, clamp(t / 0.6) * (1 - ex));
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.25) * (1 - ex);
  ctx.translate(w / 2, cy0 + ch / 2 + (1 - Math.min(1, k)) * 50 * u);
  ctx.scale(0.94 + 0.06 * k, 0.94 + 0.06 * k);
  ctx.translate(-w / 2, -(cy0 + ch / 2));
  glassCard(sc, cx0, cy0, cw, ch, { r: 26 * u });
  borderBeam(sc, cx0, cy0, cw, ch, t * 0.25, { r: 26 * u, alpha: 0.7 });
  // An oversized quotation mark set into the glass, drifting against the card (parallax).
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx0, cy0, cw, ch, 26 * u);
  ctx.clip();
  ctx.font = displayFont(saasFont(sc), 300 * u);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = rgba(palette.primary, palette.light ? 0.1 : 0.14);
  ctx.globalAlpha *= ease.outCubic(range(t, 0.3, 1));
  ctx.fillText("“", cx0 + 28 * u - Math.sin(T * 0.9) * 8 * u, cy0 + 4 * u + (1 - ease.outCubic(range(t, 0.3, 1.2))) * 40 * u);
  ctx.restore();
  // Stars (with a shimmer that ripples through them every few seconds once they're in).
  for (let i = 0; i < 5; i++) {
    const ripple = t > 1.4 ? Math.sin(Math.PI * clamp((((t - 1.6 - i * 0.07) % 2.4) + 2.4) % 2.4 / 0.35)) : 0;
    const sk = ease.outBack(range(t, 0.35 + i * 0.08, 0.65 + i * 0.08), 2.2) * (1 + 0.16 * ripple);
    ctx.save();
    ctx.translate(w / 2 + (i - 2) * 34 * u, cy0 + 56 * u);
    ctx.scale(sk, sk);
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "rgba(251,191,36,0.6)";
    ctx.shadowBlur = 12 * u;
    star(ctx, 0, 0, 13 * u);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  blurInLayout(sc, layout, 0.6, 0.035, { exitAt: d - 0.4 });
  // Author row.
  const ak = ease.outCubic(range(t, 1.2, 1.7)) * (1 - ex);
  if (ak > 0) {
    const [name, ...roleParts] = (scene.subtext ?? "").split(/\s[·—–|-]\s|,\s/);
    const role = roleParts.join(", ");
    const ay = qBottom + 84 * u;
    const ar = 38 * u;
    ctx.save();
    ctx.globalAlpha = ak;
    ctx.font = subFont(28 * u, 700);
    const nw = ctx.measureText(name || "").width;
    ctx.font = subFont(22 * u, 500);
    const rw = ctx.measureText(role).width;
    const blockW = ar * 2 + 16 * u + Math.max(nw, rw);
    const ax = w / 2 - blockW / 2 + ar;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, TAU);
    ctx.clip();
    const av = getMedia(scene.media, t);
    if (av) drawCover(ctx, av, ax - ar, ay - ar, ar * 2, ar * 2);
    else {
      const g = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
      g.addColorStop(0, palette.primary);
      g.addColorStop(1, palette.secondary);
      ctx.fillStyle = g;
      ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
      ctx.fillStyle = "#fff";
      ctx.font = subFont(ar * 0.8, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((name || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(), ax, ay + 1);
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.font = subFont(28 * u, 700);
    ctx.fillText(name || "", ax + ar + 18 * u, role ? ay - 15 * u : ay);
    if (role) {
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.font = subFont(22 * u, 500);
      ctx.fillText(role, ax + ar + 18 * u, ay + 18 * u);
    }
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────────────────── Trusted-by Marquee ───────────────────────── */

function marquee(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const layout = sentence(sc, { text: accented(scene.text), cy: h * 0.33, sizeFrac: 0.08, widthFrac: 0.84, maxLines: 2 });
  chapter(sc, layout.ys[0] - layout.size * 0.6);
  const n = blurInLayout(sc, layout, 0.15, stagger(sc), { exitAt: d - 0.4 });
  const logos = (brand?.clientLogos ?? []).map((s) => getImage(s)).filter((i): i is HTMLImageElement => !!i && i.naturalWidth > 0);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const k = ease.outCubic(range(t, 0.5, 1.1)) * (1 - ex);
  if (logos.length) {
    const lh = 46 * u;
    const gap = 90 * u;
    const rowsY = [h * 0.58, h * 0.74];
    rowsY.forEach((ry, ri) => {
      const row = ri === 0 ? logos : [...logos].reverse();
      const widths = row.map((img) => Math.min(lh * 4, lh * (img.naturalWidth / img.naturalHeight)));
      const total = widths.reduce((a, b) => a + b + gap, 0);
      const dir = ri === 0 ? -1 : 1;
      let off = (((t * 70 * u * dir) % total) + total) % total;
      ctx.save();
      ctx.globalAlpha = k * 0.8;
      for (let rep = -1; rep <= Math.ceil(w / total) + 1; rep++) {
        let x = rep * total - off;
        row.forEach((img, i) => {
          if (x + widths[i] > -50 && x < w + 50) {
            ctx.save();
            drawLogo(ctx, img, !!palette.light, x, ry - (widths[i] / (img.naturalWidth / img.naturalHeight)) / 2, widths[i], widths[i] / (img.naturalWidth / img.naturalHeight));
            ctx.restore();
          }
          x += widths[i] + gap;
        });
      }
      ctx.restore();
      off = 0;
    });
    // Edge fades.
    for (const side of [0, 1]) {
      const g = ctx.createLinearGradient(side ? w : 0, 0, side ? w * 0.75 : w * 0.25, 0);
      g.addColorStop(0, rgba(palette.bg0, 1));
      g.addColorStop(1, rgba(palette.bg0, 0));
      ctx.fillStyle = g;
      ctx.fillRect(side ? w * 0.75 : 0, h * 0.48, w * 0.25, h * 0.36);
    }
  } else {
    // No customer logos: the teams the product serves stream past instead, as two counter-moving
    // rows of glass chips on a slight perspective tilt (no company names are invented).
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.62;
    const hasSub = !!scene.subtext && !/logos? from your website/i.test(scene.subtext);
    if (hasSub) subText(sc, scene.subtext, bottom + 44 * u, range(t, 0.4 + n * stagger(sc), 1 + n * stagger(sc)) * (1 - ex));
    const teams = ["Product", "Engineering", "Design", "Marketing", "Sales", "Support", "Operations", "Finance", "Data", "Leadership"];
    const icons = ["Boxes", "CodeXml", "PenTool", "Megaphone", "Handshake", "LifeBuoy", "Settings", "Wallet", "ChartColumn", "Users"];
    const fs = 30 * u;
    const chipH = fs * 2.3;
    const gap = 22 * u;
    const rowsY = [h * (hasSub ? 0.62 : 0.56), h * (hasSub ? 0.76 : 0.71)];
    ctx.save();
    ctx.font = subFont(fs, 600);
    const widths = teams.map((x) => ctx.measureText(x).width + chipH + fs * 1.2);
    ctx.restore();
    const total = widths.reduce((a, b) => a + b + gap, 0);
    const T = sc.globalT ?? t;
    rowsY.forEach((ry, ri) => {
      const dir = ri === 0 ? -1 : 1;
      // Rows glide in from opposite sides, then keep streaming.
      const enter = (1 - ease.outCubic(range(t, 0.45 + ri * 0.12, 1.5 + ri * 0.12))) * w * 0.5 * -dir;
      const off = ((((T * 55 * u * dir + ri * total * 0.37) % total) + total) % total) - enter;
      ctx.save();
      ctx.globalAlpha = k;
      // A gentle tilt: the far row sits slightly smaller, like a strip on a curved floor.
      const sk = 1 - ri * 0.04;
      ctx.translate(w / 2, ry);
      ctx.transform(sk, 0, (ri ? -0.04 : 0.04), sk, 0, 0);
      ctx.translate(-w / 2, -ry);
      for (let rep = -1; rep <= Math.ceil(w / total) + 1; rep++) {
        let x = rep * total - off;
        teams.forEach((_, j) => {
          const i = ri ? teams.length - 1 - j : j;
          const team = teams[i];
          const cw2 = widths[i];
          if (x + cw2 > -60 * u && x < w + 60 * u) {
            const cyc = ry + Math.sin(T * 1.4 + i * 0.9 + ri) * 3 * u;
            // Chips dissolve towards the frame edges (the rows stream out of nothing).
            const mid = x + cw2 / 2;
            const edge = clamp(Math.min(mid, w - mid) / (w * 0.22));
            ctx.save();
            ctx.globalAlpha *= edge * edge * (3 - 2 * edge);
            glassCard(sc, x, cyc - chipH / 2, cw2, chipH, { r: chipH / 2 });
            const ts = chipH * 0.66;
            const tx = x + chipH / 2 + 2 * u;
            ctx.save();
            ctx.beginPath();
            ctx.arc(tx, cyc, ts / 2, 0, TAU);
            const g = ctx.createLinearGradient(tx - ts / 2, cyc - ts / 2, tx + ts / 2, cyc + ts / 2);
            g.addColorStop(0, palette.primary);
            g.addColorStop(1, palette.secondary);
            ctx.fillStyle = g;
            ctx.fill();
            drawIcon(ctx, icons[i], tx, cyc, ts * 0.56, palette.light ? "#ffffff" : palette.bg0);
            ctx.font = subFont(fs, 600);
            ctx.fillStyle = palette.text;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            fillTextMid(ctx, team, x + chipH + fs * 0.2, cyc);
            ctx.restore();
            ctx.restore();
          }
          x += cw2 + gap;
        });
      }
      ctx.restore();
    });
  }
}

/* ───────────────────────── CTA Lock-up ───────────────────────── */

export function ctaTiming(d: number, beat: number) {
  // The click lands on a beat, with the score's final chord (see arrange.ts).
  const click = ctaClickAt(d, beat);
  const hover = click - 0.4;
  return { button: Math.min(0.75, hover - 0.3), hover, click };
}

function ctaLockup(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 3 });
  const T = ctaTiming(d, sc.beat);
  const S = h > w ? 1.3 : 1; // vertical frames: bigger lock-up
  // The end card holds (its last frame doubles as the thumbnail) with a slow settle push-in.
  const ex = 0;
  const push = 1 + 0.035 * ease.outCubic(range(t, T.click, d));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(push, push);
  ctx.translate(-w / 2, -h / 2);
  const hasLogo = !!brand?.logo;
  if (imageless(sc)) iconConstellation(sc, { count: h > w ? 6 : 8, clear: 1.12, start: 0.2 });
  // Logo mark. A wide wordmark shows as the app icon (or the generated mark) with the name
  // centred beneath it, which reads better than a thin strip of logo.
  const lk = clamp(spring(t - 0.05, 9, 7), 0, 1.05);
  const lm = lockupMark(brand);
  if (hasLogo && lm.stacked) {
    const size = Math.min(w, h) * 0.1 * S;
    const iy = h * 0.18;
    ctx.save();
    ctx.globalAlpha = clamp(lk) * (1 - ex);
    ctx.translate(w / 2, iy);
    ctx.scale(0.85 + 0.15 * lk, 0.85 + 0.15 * lk);
    if (lm.img) {
      ctx.shadowColor = rgba(palette.primary, 0.7);
      ctx.shadowBlur = 36 * u;
      const ar = lm.img.naturalWidth / lm.img.naturalHeight;
      const iw = ar >= 1 ? size : size * ar;
      const ih = iw / ar;
      drawAppIcon(ctx, lm.img, !!palette.light, -iw / 2, -ih / 2, iw, ih);
    } else {
      brandGlyph(sc, 0, 0, size, 1, 0.8);
    }
    ctx.shadowBlur = 0;
    if (brand?.name) {
      const ns = Math.min(w, h) * 0.048 * S;
      ctx.font = `800 ${Math.round(ns)}px Inter, sans-serif`;
      ctx.fillStyle = palette.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(brand.name, 0, size / 2 + ns * 0.95);
    }
    ctx.restore();
  } else if (hasLogo) {
    ctx.save();
    ctx.globalAlpha = clamp(lk) * (1 - ex);
    ctx.translate(w / 2, h * 0.27);
    ctx.scale(0.85 + 0.15 * lk, 0.85 + 0.15 * lk);
    ctx.shadowColor = rgba(palette.primary, 0.8);
    ctx.shadowBlur = 40 * u;
    drawLogoMark(sc, brand?.logo, 0, 0, Math.min(w, h) * 0.11 * S);
    ctx.restore();
  } else if (brand?.name) {
    // No logo image (CSS/SVG logos): a generated wordmark — gradient mark + the name.
    const size = Math.min(w, h) * 0.05 * S;
    ctx.save();
    ctx.globalAlpha = clamp(lk) * (1 - ex);
    ctx.font = `800 ${Math.round(size * 1.05)}px Inter, sans-serif`;
    const tw = ctx.measureText(brand.name).width;
    const gw = size + size * 0.4 + tw;
    ctx.translate(w / 2, h * 0.25);
    ctx.scale(0.85 + 0.15 * lk, 0.85 + 0.15 * lk);
    const mx = -gw / 2;
    // The generated mark: a gradient tile with the product's icon.
    brandGlyph(sc, mx + size / 2, 0, size, 1, 0.8);
    ctx.font = `800 ${Math.round(size * 1.05)}px Inter, sans-serif`;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextMid(ctx, brand.name, mx + size * 1.4, 0);
    ctx.restore();
  }
  const layout = sentence(sc, { text: accented(scene.text), cy: h * (hasLogo ? 0.44 : 0.4), sizeFrac: 0.1, widthFrac: 0.8, maxLines: 2 });
  blurInLayout(sc, layout, 0.2, stagger(sc), { exitAt: d + 1 });
  const by = layout.ys[layout.ys.length - 1] + layout.size * 0.6 + 80 * u;
  const button = ctaButton(sc, w / 2, by, S, T);
  ctx.restore();
  ctaCursor(sc, w / 2 + button.bw * 0.1, by + 4 * u, T);
}

/**
 * The end card's button: springs in, glows on hover, presses on the click beat with a ripple and a
 * shimmer; the domain pill follows beneath. Returns its size.
 */
export function ctaButton(sc: SkillContext, cx: number, by: number, S: number, T: ReturnType<typeof ctaTiming>) {
  const { ctx, t, u, palette, scene, brand } = sc;
  const ex = 0;
  const label = scene.subtext || "Get started";
  const bk = clamp(spring(t - T.button, 11, 7), 0, 1.08);
  const press = Math.max(0, 1 - Math.abs(t - T.click) / 0.12);
  const released = clamp(spring(t - T.click - 0.1, 14, 9));
  const bScale = (0.8 + 0.2 * bk) * (1 - press * 0.05) * (t > T.click ? 0.97 + 0.03 * released : 1);
  const hover = ease.outCubic(range(t, T.hover, T.hover + 0.25));
  ctx.save();
  ctx.font = subFont(32 * u * S, 700);
  const bw = ctx.measureText(`${label}  →`).width + 84 * u * S;
  const bh = 82 * u * S;
  ctx.globalAlpha = clamp(bk * 2) * (1 - ex);
  ctx.translate(cx, by);
  ctx.scale(bScale, bScale);
  // Glow grows on hover, bursts on click.
  const burst = range(t, T.click, T.click + 0.6);
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = (20 + 30 * hover + (burst < 1 ? 60 * (1 - burst) : 0)) * u;
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Shimmer sweep across the button.
  // (A glossy reflection glides across every few seconds, then rests off the button.)
  const phase = (((t - T.button) * 0.5) % 1.4) / 1.1;
  ctx.save();
  ctx.clip();
  lightSweep(ctx, -bw / 2, -bh / 2, bw, bh, phase, { alpha: 0.7, width: 0.16, slant: 0.5 });
  ctx.restore();
  ctx.fillStyle = "#07040f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fillTextMid(ctx, `${label}  →`, 0, 0);
  ctx.restore();
  borderBeam(sc, cx - bw / 2 - 6 * u, by - bh / 2 - 6 * u, bw + 12 * u, bh + 12 * u, t * 0.6, { r: bh / 2 + 6 * u, alpha: clamp(bk) * (1 - ex) });
  clickRipple(sc, cx + bw * 0.1, by, range(t, T.click, T.click + 0.6), "#ffffff");
  // Domain pill.
  const dk = ease.outCubic(range(t, T.click + 0.2, T.click + 0.7));
  if (brand?.domain && dk > 0) {
    ctx.save();
    ctx.globalAlpha = dk;
    pill(sc, brand.domain, cx, by + bh / 2 + 62 * u * S + (1 - dk) * 14 * u, {
      size: 26 * u * S,
      fill: rgba(palette.light ? "#ffffff" : palette.bg0, 0.6),
      border: rgba(palette.text, 0.18),
    });
    ctx.restore();
  }
  // Risk reversal: one reassurance line under the button ("Cancel anytime"), when the site says it.
  const sure = (scene.items ?? []).find((x) => x.trim())?.trim();
  if (sure && dk > 0) {
    ctx.save();
    ctx.globalAlpha = dk * 0.9;
    ctx.font = subFont(22 * u * S, 500);
    ctx.fillStyle = rgba(palette.text, 0.66);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextMid(ctx, `✓  ${sure}`, cx, by + bh / 2 + (brand?.domain ? 118 : 58) * u * S + (1 - dk) * 10 * u);
    ctx.restore();
  }
  return { bw, bh };
}

/** The cursor glides in to the button, clicks on the beat, and leaves. */
export function ctaCursor(sc: SkillContext, tx: number, ty: number, T: ReturnType<typeof ctaTiming>) {
  const { t, w, h } = sc;
  const press = Math.max(0, 1 - Math.abs(t - T.click) / 0.12);
  const start = { x: w * 0.82, y: h * 1.05 };
  const k = ease.inOutCubic(range(t, T.button + 0.1, T.hover + 0.2));
  const away = ease.inCubic(range(t, T.click + 0.6, T.click + 1.3));
  if (t > T.button) {
    const xAt = (tt: number) => {
      const kk = ease.inOutCubic(range(tt, T.button + 0.1, T.hover + 0.2));
      const aw = ease.inCubic(range(tt, T.click + 0.6, T.click + 1.3));
      return { x: lerp(lerp(start.x, tx, kk), w * 1.1, aw), y: 0 };
    };
    drawCursor(sc, lerp(lerp(start.x, tx, k), w * 1.1, away), lerp(lerp(start.y, ty, k), h * 1.1, away), press, 1, cursorLean(xAt, t, w));
  }
}

/* ───────────────────────── Website Scroll ───────────────────────── */

function scrollTiming(d: number) {
  return { first: 0.9, second: Math.max(2.2, d * 0.5) };
}

/** When the page scrolls to each section and lifts it out (seconds into the scene). */
function sectionStops(d: number, n: number) {
  const start = 0.9;
  const each = (d - start - 0.35) / Math.max(1, n);
  return Array.from({ length: n }, (_, k) => {
    const s0 = start + k * each;
    return { scroll: s0, arrive: s0 + Math.min(0.75, each * 0.4), drop: s0 + each - Math.min(0.3, each * 0.18) };
  });
}

/** The page's sections worth stopping at (below the hero, tall enough to read), in page order. */
function stopSections(secs: { y: number; h: number }[], iw: number, d: number) {
  const K = Math.max(1, Math.min(3, Math.floor((d - 1.4) / 1.5)));
  const below = secs.map((x, i) => ({ ...x, i })).filter((x, i) => i > 0 && x.h >= iw * 0.12);
  // Sections that read well lifted out whole come first (a section taller than the page is wide
  // would shrink to a sliver); in page order.
  const good = below.filter((x) => x.h <= iw * 0.95);
  const rest = below.filter((x) => x.h > iw * 0.95).sort((a, b) => a.h - b.h);
  return [...good, ...rest].slice(0, K).sort((a, b) => a.y - b.y);
}

/**
 * The real website in a browser window: it opens on the top of the hero as a visitor sees it,
 * then scrolls the full-page screenshot down, stopping exactly at the top of the page's own
 * sections. At each stop that section is taken out of the screenshot and lifts forward out of the
 * window (bordered, glowing, the page dimmed behind it), then drops back as the scroll moves on.
 * Without known sections (or a still image) it falls back to a plain scroll.
 */
function siteScroll(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  const img = getImage(scene.media?.kind === "image" ? scene.media.src : undefined);
  // The page's own sections (snapped to the screenshot's real dividers), or found in the screenshot.
  const bands = img && img.naturalWidth ? (brand?.page?.src === scene.media?.src ? snapBands(img, brand!.page!.bands) : pageBands(img)) : [];
  const iw = img?.naturalWidth ?? 0;
  const ih = img?.naturalHeight ?? 0;
  const secs = bands.map(([a, b]) => ({ y: a * ih, h: (b - a) * ih })).filter((x) => x.h > 8);
  const stops = img ? stopSections(secs, iw, d) : [];
  if (!img || !stops.length) return browserScroll(sc);
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  topHeadline(sc);
  const ex = ease.inCubic(exitT(sc, 0.4));
  // The browser window.
  const ww = portrait ? w * 0.88 : w * 0.7;
  const top = h * (scene.eyebrow ? 0.28 : 0.25);
  const wh = Math.min(h * 0.7, h - top - 24 * u);
  const x0 = w / 2 - ww / 2;
  const bar = 34 * u;
  const vx = x0;
  const vy = top + bar;
  const vw = ww;
  const vh = wh - bar;
  const k = clamp(spring(t - 0.05, 8, 6), 0, 1.04);
  const tilt = (1 - Math.min(1, k)) * 0.35;
  const s = vw / iw; // image px → screen px
  const viewH = vh / s; // how much of the page the window shows
  const maxY = Math.max(0, ih - viewH);
  // Scroll: from the top of the page to each stop's section top, in turn.
  const T = sectionStops(d, stops.length);
  const stopY = (i: number) => (i < 0 ? 0 : Math.min(maxY, Math.max(0, stops[i].y - 4)));
  let sy = 0;
  T.forEach((st, i) => {
    if (t >= st.scroll) sy = lerp(stopY(i - 1), stopY(i), ease.inOutCubic(range(t, st.scroll, st.arrive)));
  });
  // The lifted section: out after the scroll arrives, back just before the next scroll.
  const cur = T.reduce((a, st, i) => (t >= st.scroll ? i : a), -1);
  const lift = cur >= 0 ? ease.outBack(range(t, T[cur].arrive, T[cur].arrive + 0.4), 1.4) * (1 - ease.inCubic(range(t, T[cur].drop, T[cur].drop + 0.3))) : 0;

  ctx.save();
  ctx.globalAlpha = clamp(t / 0.3) * (1 - ex);
  ctx.translate(w / 2, top + wh / 2 + (1 - Math.min(1, k)) * h * 0.2 + Math.sin(t * 1.1) * 3 * u);
  ctx.transform(1, 0, 0, 1 - tilt * 0.5, 0, 0);
  ctx.scale(0.92 + 0.08 * Math.min(1, k), 0.92 + 0.08 * Math.min(1, k));
  ctx.translate(-w / 2, -(top + wh / 2));
  glassCard(sc, x0 - 1, top - 1, ww + 2, wh + 2, { r: 16 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, top, ww, wh, 16 * u);
  ctx.clip();
  ctx.fillStyle = palette.light ? "#e8e8ef" : "#121019";
  ctx.fillRect(x0, top, ww, bar);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x0 + 20 * u + i * 18 * u, top + bar / 2, 5.5 * u, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(w / 2 - ww * 0.2, top + bar * 0.2, ww * 0.4, bar * 0.6, bar * 0.3);
  ctx.fill();
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  ctx.font = subFont(13 * u, 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brand?.domain ?? "yourproduct.com", w / 2, top + bar / 2);
  // The page, at the current scroll.
  const shown = Math.min(viewH, ih - sy);
  ctx.drawImage(img, 0, sy, iw, shown, vx, vy, vw, shown * s);
  // Scrollbar.
  const thumbH = Math.max(40 * u, (vh * vh) / (ih * s));
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.roundRect(vx + vw - 10 * u, vy + 6 * u + (vh - thumbH - 12 * u) * (maxY ? sy / maxY : 0), 5 * u, thumbH, 3 * u);
  ctx.fill();
  // The page dims while a section is lifted out of it.
  if (lift > 0) {
    ctx.fillStyle = rgba(palette.bg0, 0.55 * clamp(lift));
    ctx.fillRect(vx, vy, vw, vh);
  }
  ctx.restore();
  borderBeam(sc, x0, top, ww, wh, t * 0.3, { r: 16 * u, alpha: 0.7 * (1 - clamp(lift)) });
  // The lifted section: the whole section, top to bottom, as a bordered card (never just the
  // slice that happens to be in the window, which cuts it off mid-content).
  if (cur >= 0 && lift > 0.001) {
    const sec = stops[cur];
    const cropY = sec.y;
    const cropH = Math.max(1, Math.min(sec.h, ih - sec.y));
    const inView = Math.max(1, Math.min(sec.y + sec.h, sy + viewH) - Math.max(sec.y, sy));
    const rx = vx;
    const ry = vy + (Math.max(sec.y, sy) - sy) * s;
    const rw = vw;
    const rh = cropH * s;
    // Lifted forward, but always inside the frame (between the headline and the bottom edge):
    // a tall section is shown whole at a smaller size rather than cropped.
    const room = h - 18 * u - (top - 8 * u);
    const fits = Math.min(1.1, (room * 0.84) / rh, (w * 0.9) / rw);
    // It rises from the part of the window it was in, so the lift reads as coming off the page.
    const from = clamp((inView * s) / rh, 0.15, 1);
    const grow = lerp(from, fits, clamp(lift));
    const cx = rx + rw / 2;
    // From the middle of its visible slice in the window to the middle of the free space.
    let cy = lerp(ry + (inView * s) / 2, (top - 8 * u + h - 18 * u) / 2, clamp(lift)) - 10 * u * lift;
    cy = Math.min(cy, h - 18 * u - (rh * grow) / 2);
    cy = Math.max(cy, top - 8 * u + (rh * grow) / 2);
    const r = 14 * u;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(grow, grow);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 50 * u * clamp(lift);
    ctx.shadowOffsetY = 18 * u * clamp(lift);
    ctx.fillStyle = palette.bg0;
    ctx.beginPath();
    ctx.roundRect(-rw / 2, -rh / 2, rw, rh, r);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.clip();
    ctx.drawImage(img, 0, cropY, iw, cropH, -rw / 2, -rh / 2, rw, rh);
    ctx.restore();
    ctx.strokeStyle = rgba(palette.primary, 0.9 * clamp(lift));
    ctx.lineWidth = 2.5 * u;
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 20 * u * clamp(lift);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Scrolling browser window: the fallback when the page's sections aren't known. */
function browserScroll(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  topHeadline(sc);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const ww = portrait ? w * 0.88 : w * 0.7;
  const top = h * (scene.eyebrow ? 0.28 : 0.25);
  const wh = Math.min(h * 0.7, h - top - 24 * u);
  const x0 = w / 2 - ww / 2;
  const bar = 34 * u;
  // Tilted in from below, settling flat (a faux 3D rotateX).
  const k = clamp(spring(t - 0.05, 8, 6), 0, 1.04);
  const tilt = (1 - Math.min(1, k)) * 0.35;
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.3) * (1 - ex);
  ctx.translate(w / 2, top + wh / 2 + (1 - Math.min(1, k)) * h * 0.2 + Math.sin(t * 1.1) * 4 * u);
  ctx.transform(1, 0, 0, 1 - tilt * 0.5, 0, 0);
  ctx.scale(0.92 + 0.08 * Math.min(1, k), 0.92 + 0.08 * Math.min(1, k));
  ctx.translate(-w / 2, -(top + wh / 2));
  glassCard(sc, x0 - 1, top - 1, ww + 2, wh + 2, { r: 16 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, top, ww, wh, 16 * u);
  ctx.clip();
  ctx.fillStyle = palette.light ? "#e8e8ef" : "#121019";
  ctx.fillRect(x0, top, ww, bar);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x0 + 20 * u + i * 18 * u, top + bar / 2, 5.5 * u, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(w / 2 - ww * 0.2, top + bar * 0.2, ww * 0.4, bar * 0.6, bar * 0.3);
  ctx.fill();
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  ctx.font = subFont(13 * u, 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brand?.domain ?? "yourproduct.com", w / 2, top + bar / 2);
  // Smoothly scroll the real full-page screenshot, with pauses to read.
  const vx = x0;
  const vy = top + bar;
  const vw = ww;
  const vh = wh - bar;
  const img = getMedia(scene.media, t);
  const T = scrollTiming(d);
  const p1 = ease.inOutCubic(range(t, T.first, T.first + 1.1)) * 0.4;
  const p2 = ease.inOutCubic(range(t, T.second, T.second + 1.2)) * 0.45;
  const p = p1 + p2;
  if (img) {
    const iw = "naturalWidth" in img ? img.naturalWidth : img.videoWidth;
    const ih = "naturalHeight" in img ? img.naturalHeight : img.videoHeight;
    const sc2 = vw / iw;
    const maxScroll = Math.max(0, ih * sc2 - vh);
    const sy = (p * maxScroll) / sc2;
    ctx.drawImage(img, 0, sy, iw, Math.min(ih - sy, vh / sc2), vx, vy, vw, Math.min(vh, (ih - sy) * sc2));
    // Scrollbar.
    const thumbH = Math.max(40 * u, (vh * vh) / (ih * sc2));
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(vx + vw - 10 * u, vy + 6 * u + (vh - thumbH - 12 * u) * (maxScroll ? (p * maxScroll) / maxScroll : 0), 5 * u, thumbH, 3 * u);
    ctx.fill();
  } else mockUi(sc, vx, vy, vw, vh);
  // Soft fade at the bottom edge of the viewport.
  const fade = ctx.createLinearGradient(0, vy + vh * 0.8, 0, vy + vh);
  fade.addColorStop(0, rgba(palette.bg0, 0));
  fade.addColorStop(1, rgba(palette.bg0, 0.55));
  ctx.fillStyle = fade;
  ctx.fillRect(vx, vy + vh * 0.8, vw, vh * 0.2);
  ctx.restore();
  borderBeam(sc, x0, top, ww, wh, t * 0.3, { r: 16 * u, alpha: 0.7 });
  ctx.restore();
  // Cursor exploring the page.
  if (t > 0.5) {
    const cx = w / 2 + ww * (0.12 + 0.1 * Math.sin(t * 0.9));
    const cy = top + wh * (0.45 + 0.12 * Math.sin(t * 0.7 + 1));
    ctx.save();
    ctx.globalAlpha = clamp((t - 0.5) / 0.3) * (1 - ex);
    drawCursor(sc, cx, cy);
    ctx.restore();
  }
}

/* ───────────────────────── How It Works ───────────────────────── */

function stepsTiming(scene: Scene, beat: number) {
  const n = Math.max(2, Math.min(4, (scene.items ?? []).length || 3));
  const step = Math.max(0.6, beat * 2);
  return Array.from({ length: n }, (_, i) => 0.6 + i * step);
}

function steps(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 2 });
  // Square and vertical frames stack the steps; tall frames also scale them up.
  const portrait = h > w * 0.85;
  const S = h > w ? 1.35 : 1;
  topHeadline(sc);
  const items = (scene.items ?? []).filter(Boolean).slice(0, 4);
  const labels = items.length >= 2 ? items : ["Connect", "Customize", "Launch"];
  const times = stepsTiming({ ...scene, items: labels }, sc.beat);
  const n = labels.length;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const R = 40 * u * S;
  // Landscape cards sit centred under their nodes; the outer cards stay inside the title-safe area.
  const safe = tokens(w, h).safe;
  const colW = portrait ? w * (h > w ? 0.7 : 0.62) : (w * 0.72) / Math.max(1, n - 1) * 0.9;
  // Vertical cards run from beside their node to the safe area's right edge.
  const cw = portrait ? safe.right - (w * (h > w ? 0.15 : 0.2) + R + 24 * u) : Math.min(colW, 380 * u);
  const x0 = Math.max(w * 0.14, safe.left + cw / 2);
  const x1 = Math.min(w * 0.86, safe.right - cw / 2);
  const pts = labels.map((_, i) =>
    portrait
      ? { x: w * (h > w ? 0.15 : 0.2), y: h * 0.32 + (i * h * (h > w ? 0.55 : 0.52)) / Math.max(1, n - 1) }
      : { x: x0 + (i * (x1 - x0)) / Math.max(1, n - 1), y: h * 0.47 },
  );
  const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[n - 1].x, pts[n - 1].y);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp(t / 0.4);
  // Track + progress fill.
  ctx.lineCap = "round";
  ctx.lineWidth = 4 * u;
  ctx.strokeStyle = rgba(palette.text, 0.12);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
  ctx.stroke();
  let prog = 0;
  for (let i = 1; i < n; i++) prog += ease.inOutCubic(range(t, times[i - 1] + 0.2, times[i]));
  const segF = prog / Math.max(1, n - 1);
  ctx.strokeStyle = g;
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = 16 * u;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(lerp(pts[0].x, pts[n - 1].x, segF), lerp(pts[0].y, pts[n - 1].y, segF));
  ctx.stroke();
  ctx.restore();
  labels.forEach((label, i) => {
    const lt = t - times[i];
    const on = clamp(spring(lt, 12, 7), 0, 1.15);
    const p = pts[i];
    ctx.save();
    ctx.globalAlpha = (1 - ex) * clamp(0.35 + clamp(lt / 0.3) * 0.65);
    // Card with the step title.
    const ch = 130 * u * S;
    const cx = portrait ? p.x + R + 24 * u : p.x - cw / 2;
    const cy = portrait ? p.y - ch / 2 : p.y + R + 26 * u;
    const ck = lt > 0 ? Math.min(1, on) : 0;
    ctx.save();
    ctx.globalAlpha *= 0.5 + 0.5 * ck;
    ctx.translate(0, (1 - ck) * 18 * u);
    glassCard(sc, cx, cy, cw, ch, { r: 18 * u, tint: lt > 0 ? palette.bg1 : undefined });
    if (lt > 0 && lt < 2.2) borderBeam(sc, cx, cy, cw, ch, lt * 0.5, { r: 18 * u, alpha: 1 - clamp((lt - 1.6) / 0.6) });
    ctx.fillStyle = palette.text;
    const fsz = Math.min(30 * u * S, cw / 10);
    ctx.font = `700 ${Math.round(fsz)}px Inter, sans-serif`;
    ctx.textAlign = portrait ? "left" : "center";
    ctx.textBaseline = "middle";
    const words = label.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const wd of words) {
      const next = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(next).width > cw - 48 * u - Math.min(ch * 0.42, 40 * u * S) - 14 * u && line) {
        lines.push(line);
        line = wd;
      } else line = next;
    }
    lines.push(line);
    const lh = fsz * 1.25;
    // Step icon at the card's leading edge; text makes room for it.
    // 24px (3-step) padding; under a centred node the icon + text group centres in the card.
    const is = Math.min(ch * 0.42, 40 * u * S);
    const pad = 24 * u;
    const groupW = is + 14 * u + Math.max(...lines.slice(0, 2).map((l) => ctx.measureText(l).width));
    const gx = portrait ? cx + pad : cx + Math.max(pad, (cw - groupW) / 2);
    const ix = gx + is / 2;
    drawIcon(ctx, iconsFor(labels, sc)[i], ix, cy + ch / 2, is, palette.primary, lt > 0 ? ease.outCubic(range(lt, 0.05, 0.7)) : 0.35);
    const tx0 = gx + is + 14 * u;
    ctx.textAlign = "left";
    lines.slice(0, 2).forEach((l, li, arr) => fillTextMid(ctx, l, tx0, cy + ch / 2 + (li - (arr.length - 1) / 2) * lh));
    ctx.restore();
    // Numbered node.
    ctx.translate(p.x, p.y);
    const sk = lt > 0 ? on : 0.85;
    ctx.scale(sk, sk);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    if (lt > 0) {
      ctx.fillStyle = g;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 30 * u;
    } else ctx.fillStyle = palette.bg1;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(palette.text, lt > 0 ? 0.6 : 0.2);
    ctx.lineWidth = 2 * u;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.round(R * 0.9)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fillTextMid(ctx, String(i + 1), 0, 0);
    ctx.restore();
  });
}

/* ───────── registry ───────── */

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });

export const saasSkills: Skill[] = [
  {
    id: "blur-reveal",
    name: "Blur Reveal",
    tagline: "Apple-style sentence reveal: words rise and un-blur one by one, key word in gradient.",
    bestFor: "Hooks, value propositions and big statements in sentence case (3–9 words). Wrap the key word in *asterisks*.",
    sample: { text: "A new way to *ship* your product.", subtext: "Built for modern teams", items: ["Introducing"] },
    itemsHint: "Eyebrow label, e.g. Introducing",
    render: blurReveal,
    sfx: () => [at(0.15, "shimmer")],
  },
  {
    id: "word-swap",
    name: "Word Swap",
    tagline: "A sentence with a rotating gradient word that springs through alternatives.",
    bestFor: "Positioning lines like 'Your work, planned|built|shared' (use | between the alternatives).",
    sample: { text: "Your work, planned|built|shared", subtext: "One workspace for your team" },
    render: wordSwap,
    sfx: (scene, beat) => swapTiming(scene, beat).swaps.map((s) => at(s, "tick")),
  },
  {
    id: "ui-tour",
    name: "UI Zoom Tour",
    tagline: "The camera dives into your product; a cursor clicks features and callouts pop.",
    bestFor: "Product demos over a real screenshot/video. Headline = what the product does; items = 2 feature callouts.",
    sample: { text: "Your work, *in one place*", items: ["Live pipeline", "Shared reports"] },
    itemsHint: "2 callouts, e.g. Live pipeline, One-click reports",
    render: uiTour,
    sfx: (scene) => {
      const T = tourTiming(scene.duration);
      return [at(T.zoomA, "whoosh"), at(T.clickA, "click"), at(T.clickA + 0.12, "pop"), at(T.zoomB, "whoosh"), at(T.clickB, "click"), at(T.clickB + 0.12, "pop"), at(T.out, "swoosh")];
    },
  },
  {
    id: "bento",
    name: "Bento Grid",
    tagline: "Feature cards spring into a bento grid with icons and live micro-animations.",
    bestFor: 'Feature overviews. Headline = section title; items = 3–6 features as "Title" or "Title — one-line description".',
    sample: { text: "Built for *your team*", items: ["Search", "Real-time analytics", "Team spaces", "Access controls", "AI assistant", "Integrations"] },
    itemsHint: "3–6 features, comma separated",
    render: bento,
    sfx: (scene, beat) => bentoTiming(scene, beat).map((s) => at(s, "pop")),
  },
  {
    id: "icon-features",
    name: "Feature Icons",
    tagline: "Glowing icon tiles draw themselves on, one per feature, with a title and one-line benefit.",
    bestFor: 'Key features at a glance. Headline = section title; items = 2–6 features as "Title" or "Title — one-line benefit". Icons are picked from the wording.',
    sample: { text: "Built for *developers*", items: ["Git deploys — Push to ship", "Access controls — SSO and audit logs", "Real-time logs — Watch requests live", "Usage-based — Pay for what you use"] },
    itemsHint: "2–6 features, comma separated",
    render: iconFeatures,
    sfx: (scene, beat) => iconFeaturesTiming(scene, beat).map((s) => at(s, "pop")),
  },
  {
    id: "ui-cards",
    name: "Floating UI",
    tagline: "Your product floats centre stage as glass widgets (toast, metric, chart, team) pop around it.",
    bestFor: "Showing the product alive. items = [notification text, a neutral label like 'Pipeline overview', chart label, team label].",
    sample: { text: "Your pipeline, *alive*", items: ["Deal updated: Acme Inc", "Pipeline overview", "This week", "Sales team"] },
    itemsHint: "notification, stat, chart label, team label",
    render: uiCards,
    sfx: (_scene, beat) => cardsTiming(beat).map((s) => at(s, "pop")),
  },
  {
    id: "pain-strike",
    name: "Pain → Solution",
    tagline: "The old way's pain points get struck through, then the better way blurs in.",
    bestFor: "Problem/solution hooks. items = 2–4 pains ('Endless spreadsheets'); headline = the turn ('There's *another* way').",
    sample: { text: "There's *another* way.", items: ["Scattered spreadsheets", "Missed follow-ups", "Manual reports"] },
    itemsHint: "2–4 pain points, comma separated",
    render: painStrike,
    sfx: (scene, beat) => {
      const T = painTiming(scene, beat);
      return [...((scene.items ?? []).length ? T.strike.map((s) => at(s, "strike")) : []), at((scene.items ?? []).length ? T.solve : 0.2, "shimmer")];
    },
  },
  {
    id: "integrations",
    name: "Integration Orbit",
    tagline: "App tiles orbit your logo with data pulses flowing into the core.",
    bestFor: "Integrations, ecosystems, 'works with your stack'. Headline like 'Works with *your stack*'.",
    sample: { text: "Works with *your stack*" },
    render: orbit,
    sfx: () => [at(0.1, "pop"), at(0.45, "pop"), at(0.8, "pop")],
  },
  {
    id: "testimonial",
    name: "Testimonial",
    tagline: "A real customer quote on a glass card with star rating, avatar, name and role.",
    bestFor: "Social proof from a REAL quote only. Headline = the quote; subtext = 'Name · Role, Company'.",
    sample: { text: "Our team finally has one place to plan the week.", subtext: "Sample quote · Replace with a real customer" },
    render: testimonial,
    sfx: () => [at(0.1, "pop"), ...[0, 1, 2, 3, 4].map((i) => at(0.4 + i * 0.08, "tick"))],
  },
  {
    id: "logo-marquee",
    name: "Trusted By",
    tagline: "Customer logos stream past in two marquee rows under your social-proof line.",
    bestFor: "Customer-logo moments, only when claims are allowed. Uses the customer logos imported from the website; headline stays neutral ('Teams using *Acme*').",
    sample: { text: "Teams using *Acme*", subtext: "Customer logos from your website" },
    render: marquee,
    sfx: () => [at(0.15, "swoosh")],
  },
  {
    id: "site-scroll",
    name: "Website Scroll",
    tagline: "Your real website opens on its hero, scrolls from section to section and lifts them out of the page.",
    bestFor: "Showing the actual site right after the brand reveal. Uses the full-page screenshot from live capture and the page's own sections.",
    sample: { text: "Meet your new *workspace*" },
    render: siteScroll,
    sfx: (scene) => {
      const n = Math.max(1, Math.min(3, Math.floor((scene.duration - 1.4) / 1.5)));
      return [at(0.05, "swoosh"), ...sectionStops(scene.duration, n).flatMap((st) => [at(st.scroll, "swoosh"), at(st.arrive, "pop")])];
    },
  },
  {
    id: "steps",
    name: "How It Works",
    tagline: "Numbered steps light up in sequence along a glowing progress line.",
    bestFor: "'How it works' / onboarding flows. items = 2–4 short step titles.",
    sample: { text: "Get started in *3 steps*", items: ["Connect your data", "Invite your team", "Share your first report"] },
    itemsHint: "2–4 steps, comma separated",
    render: steps,
    sfx: (scene, beat) => stepsTiming(scene, beat).map((s) => at(s, "pop")),
  },
  {
    id: "cta",
    name: "CTA Lock-up",
    tagline: "Logo, closing line and a glowing button that the cursor clicks — with your URL.",
    bestFor: "The final scene. Headline = closing line; subtext = button label ('Start free trial').",
    sample: { text: "Start building *today*", subtext: "Start free trial" },
    itemsHint: "optional: one reassurance line under the button, in the site's own words ('Cancel anytime')",
    render: ctaLockup,
    sfx: (scene, beat) => {
      const T = ctaTiming(scene.duration, beat);
      return [at(T.button, "pop"), at(T.click, "click"), at(T.click + 0.05, "shimmer")];
    },
  },
];
