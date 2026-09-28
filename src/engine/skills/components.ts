/**
 * Component-level product motion: instead of showing a screenshot as one flat picture, the
 * page is taken apart and put back together. The site's real UI components (captured one by
 * one from the live page, or cut out of a screenshot by segmentation) fly in individually on
 * the eighth-note grid, land into skeleton placeholders with a glow, the finished page
 * resolves underneath with a light sweep, and the hero component lifts off the page.
 */
import { exitT } from "../fx";
import { clamp, ease, lerp, range, rgba, TAU } from "../math";
import { getImage, getMedia, segmentShot } from "../media";
import { glassCard, saasBackground, spring } from "../saasfx";
import { subFont } from "../text";
import type { Brand, Scene, SfxCue, Skill, SkillContext, SitePart } from "../types";
import { topHeadline } from "./saas";

interface Piece {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Box in base-image pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  kind: SitePart["kind"];
}

const RANK: Record<SitePart["kind"], number> = { panel: 0, media: 1, card: 2, button: 3 };
const MAX_PIECES = 9;

/**
 * Captured parts that sit inside the base screenshot (hero or full page share page coordinates);
 * a part mostly above the fold is kept and cropped at the fold.
 */
function baseParts(scene: Scene, brand: Brand | undefined, W: number, H: number) {
  if (!/-(hero|full)$/.test(scene.media?.src ?? "")) return [];
  return (brand?.parts ?? []).filter((p) => p.x + p.w <= W + 2 && p.y < H && (H - p.y) / p.h >= 0.55 && p.w * p.h < W * H * 0.8);
}

function readingOrder<T extends { kind: SitePart["kind"]; x: number; y: number }>(list: T[]) {
  return [...list].sort((a, b) => RANK[a.kind] - RANK[b.kind] || Math.round(a.y / 80) - Math.round(b.y / 80) || a.x - b.x);
}

function piecesFor(sc: SkillContext, base: HTMLImageElement): Piece[] {
  const W = base.naturalWidth;
  const H = base.naturalHeight;
  const parts = baseParts(sc.scene, sc.brand, W, H);
  if (parts.length >= 3) {
    const out: Piece[] = [];
    for (const p of readingOrder(parts).slice(0, MAX_PIECES)) {
      const im = getImage(p.src);
      if (!im?.naturalWidth) continue;
      const vis = Math.min(1, (H - p.y) / p.h);
      out.push({ img: im, sx: 0, sy: 0, sw: im.naturalWidth, sh: im.naturalHeight * vis, x: p.x, y: p.y, w: p.w, h: p.h * vis, r: p.r, kind: p.kind });
    }
    return out;
  }
  return readingOrder(segmentShot(base).map((b) => ({ ...b, kind: "card" as const }))).map((b) => ({
    img: base,
    sx: b.x,
    sy: b.y,
    sw: b.w,
    sh: b.h,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    r: Math.min(14, b.h * 0.06),
    kind: b.kind,
  }));
}

/**
 * Frame the part of the page where the components live (the product, not the empty margins),
 * at a screen-friendly aspect; pieces outside the frame are left out.
 */
function framing(pieces: Piece[], W: number, H: number, aspect: number) {
  const core = pieces.filter((p) => p.kind !== "button");
  const src = core.length ? core : pieces;
  if (!src.length) return { x: 0, y: 0, w: W, h: H };
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
  // Never zoom past ~1.9× or outside the screenshot.
  if (w < W / 1.9) {
    const k = W / 1.9 / w;
    x0 -= (w * (k - 1)) / 2;
    y0 -= (h * (k - 1)) / 2;
    w *= k;
    h *= k;
  }
  w = Math.min(w, W);
  h = Math.min(h, H);
  x0 = clamp(x0, 0, W - w);
  y0 = clamp(y0, 0, H - h);
  return { x: x0, y: y0, w, h };
}

/** How many pieces the scene will assemble (for the sound design, before images load). */
function pieceCount(scene: Scene, brand?: Brand) {
  // Hero captures are 1440×900; the same framing maths as the picture decides what's shown.
  const parts = baseParts(scene, brand, 1440, 900);
  if (parts.length < 3) return 6;
  const ps = readingOrder(parts).slice(0, MAX_PIECES) as unknown as Piece[];
  const f = framing(ps, 1440, 900, 1.6);
  return ps.filter((p) => p.x >= f.x - 1 && p.y >= f.y - 1 && p.x + p.w <= f.x + f.w + 1 && p.y + p.h <= f.y + f.h + 1).length;
}

function assembleTiming(n: number, beat: number) {
  // Land on the eighth-note grid, starting on the second beat of the scene.
  const step = clamp(beat / 2, 0.14, 0.3);
  const first = beat * (beat < 0.45 ? 3 : 2);
  const lands = Array.from({ length: n }, (_, i) => first + i * step);
  const resolve = (lands[n - 1] ?? first) + 0.25;
  return { lands, flight: 0.5, resolve, sweep: resolve + 0.15, lift: resolve + 0.45 };
}

const colorCache = new Map<string, string>();
/** Page colour just outside a box (what a skeleton placeholder should sit on). */
function pageColor(base: HTMLImageElement, x: number, y: number) {
  const key = `${base.src}|${Math.round(x)}|${Math.round(y)}`;
  const hit = colorCache.get(key);
  if (hit) return hit;
  let out = "#1a1a24";
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(base, clamp(x, 0, base.naturalWidth - 1), clamp(y, 0, base.naturalHeight - 1), 1, 1, 0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    out = `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch {
    /* keep default */
  }
  colorCache.set(key, out);
  return out;
}

function roundedImage(ctx: CanvasRenderingContext2D, p: Piece, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(p.img, p.sx, p.sy, p.sw, p.sh, x, y, w, h);
  ctx.restore();
}

function uiAssemble(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand, beat } = sc;
  saasBackground(sc, { beams: 1 });
  topHeadline(sc);
  const portrait = h > w;
  const media = getMedia(scene.media, t);
  const base = media instanceof HTMLImageElement && media.naturalWidth ? media : null;
  const ex = ease.inCubic(exitT(sc, 0.4));
  // Browser window below the headline, framed on the region where the components live.
  const IW = base?.naturalWidth ?? 1440;
  const IH = Math.min(base?.naturalHeight ?? 900, IW * 0.75);
  const aspect = portrait ? 1.15 : 1.6;
  const all = base ? piecesFor(sc, base) : [];
  const crop = framing(all, IW, IH, aspect);
  const W = crop.w;
  const H = crop.h;
  const barH = 40 * u * (portrait ? 1.1 : 1);
  const maxW = portrait ? w * 0.92 : w * 0.8;
  const maxH = portrait ? h * 0.6 : h * 0.7;
  const cw = Math.min(maxW, (maxH - barH) * aspect);
  const ch = cw / aspect;
  const wx = (w - cw) / 2;
  const wy = portrait ? h * 0.3 : Math.max(h * 0.25, h * 0.6 - (ch + barH) / 2);
  const s = cw / W;
  const pieces = all.filter((p) => p.x >= crop.x - 1 && p.y >= crop.y - 1 && p.x + p.w <= crop.x + crop.w + 1 && p.y + p.h <= crop.y + crop.h + 1);
  const T = assembleTiming(Math.max(1, pieces.length), beat);

  // Slow push-in on the whole window; it rises into place at the start.
  const k0 = clamp(spring(t - 0.05, 9, 7), 0, 1.04);
  const push = 0.97 + 0.05 * ease.inOutCubic(range(t, 0, sc.d));
  ctx.save();
  ctx.globalAlpha = clamp(t / 0.25) * (1 - ex);
  const pcx = w / 2;
  const pcy = wy + (barH + ch) / 2;
  ctx.translate(pcx, pcy + (1 - Math.min(1, k0)) * 70 * u);
  ctx.scale(push * (0.94 + 0.06 * k0), push * (0.94 + 0.06 * k0));
  ctx.translate(-pcx, -pcy);

  // Window chrome with the product's address.
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

  const cx0 = wx;
  const cy0 = wy + barH;
  const toX = (x: number) => cx0 + (x - crop.x) * s;
  const toY = (y: number) => cy0 + (y - crop.y) * s;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx0, cy0, cw, ch, [0, 0, 16 * u, 16 * u]);
  ctx.clip();
  // Empty page, then the finished page resolves in underneath once every piece has landed.
  ctx.fillStyle = base ? pageColor(base, crop.x + 6, crop.y + H * 0.5) : palette.bg1;
  ctx.fillRect(cx0, cy0, cw, ch);
  const resolveK = ease.inOutCubic(range(t, T.resolve, T.resolve + 0.45));
  if (base && resolveK > 0) {
    ctx.globalAlpha *= resolveK;
    ctx.drawImage(base, crop.x, crop.y, W, H, cx0, cy0, cw, ch);
    ctx.globalAlpha /= resolveK;
  }
  ctx.restore();

  // Skeletons: where a piece will land, a soft placeholder shimmers until it arrives.
  pieces.forEach((p, i) => {
    const land = T.lands[i];
    if (t >= land || resolveK >= 1) return;
    const x = toX(p.x);
    const y = toY(p.y);
    const pw = p.w * s;
    const ph = p.h * s;
    ctx.save();
    ctx.globalAlpha *= clamp((t - 0.15) / 0.3) * (1 - resolveK);
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, Math.max(3 * u, p.r * s));
    ctx.fillStyle = palette.light ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = palette.light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
    ctx.lineWidth = Math.max(1, u);
    ctx.stroke();
    ctx.clip();
    const sx = x + ((((t * 0.9 + i * 0.13) % 1.4) - 0.2) * pw * 1.4);
    const g = ctx.createLinearGradient(sx - pw * 0.25, 0, sx + pw * 0.25, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, palette.light ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.07)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, pw, ph);
    ctx.restore();
  });

  // Pieces fly in from an exploded layout and land on the grid.
  const centreX = crop.x + W / 2;
  const centreY = crop.y + H / 2;
  pieces.forEach((p, i) => {
    const land = T.lands[i];
    const start = land - T.flight;
    if (t < start) return;
    const lt = t - start;
    const e = clamp(spring(lt, 11, 7.5), 0, 1.05);
    const dx = p.x + p.w / 2 - centreX;
    const dy = p.y + p.h / 2 - centreY;
    const len = Math.hypot(dx, dy) || 1;
    const dist = (220 + (i % 3) * 60) * u;
    const ox = (dx / len) * dist;
    const oy = (dy / len) * dist + 40 * u;
    const rot = (i % 2 ? 1 : -1) * 0.07;
    const draw = (ee: number, alpha: number) => {
      const x = toX(p.x);
      const y = toY(p.y);
      const pw = p.w * s;
      const ph = p.h * s;
      const sc0 = 1 + 0.28 * (1 - ee);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(x + pw / 2 + ox * (1 - ee), y + ph / 2 + oy * (1 - ee));
      ctx.rotate(rot * (1 - Math.min(1, ee)));
      ctx.scale(sc0, sc0);
      const r = Math.max(3 * u, p.r * s);
      ctx.save();
      ctx.shadowColor = palette.light ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.55)";
      ctx.shadowBlur = (12 + 40 * (1 - Math.min(1, ee))) * u;
      ctx.shadowOffsetY = (6 + 24 * (1 - Math.min(1, ee))) * u;
      ctx.beginPath();
      ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
      ctx.fillStyle = pageColor(p.img === base ? base : p.img, 2, 2);
      ctx.fill();
      ctx.restore();
      roundedImage(ctx, p, -pw / 2, -ph / 2, pw, ph, r);
      // Components that live inside this one haven't arrived yet: show their skeletons instead.
      for (const [j, c] of pieces.entries()) {
        if (j <= i || t >= T.lands[j] || p.img === base) continue;
        if (c.x < p.x - 1 || c.y < p.y - 1 || c.x + c.w > p.x + p.w + 1 || c.y + c.h > p.y + p.h + 1) continue;
        const hx = (c.x - p.x) * s - pw / 2;
        const hy = (c.y - p.y) * s - ph / 2;
        const hr = Math.max(3 * u, c.r * s);
        ctx.beginPath();
        ctx.roundRect(hx - 2 * u, hy - 2 * u, c.w * s + 4 * u, c.h * s + 4 * u, hr);
        ctx.fillStyle = pageColor(p.img, clamp(c.x - p.x - 6, 1, p.img.naturalWidth - 2), clamp(c.y - p.y + c.h / 2, 1, p.img.naturalHeight - 2));
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(hx, hy, c.w * s, c.h * s, hr);
        ctx.fillStyle = palette.light ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.045)";
        ctx.fill();
      }
      ctx.restore();
    };
    // Motion trail while it's moving fast.
    if (e < 0.85) {
      draw(Math.max(0, e - 0.16), 0.1 * (1 - resolveK));
      draw(Math.max(0, e - 0.08), 0.2 * (1 - resolveK));
    }
    draw(e, clamp(lt / 0.12));
    // Landing glow on the beat.
    const lk = range(t, land, land + 0.4);
    if (lk > 0 && lk < 1) {
      ctx.save();
      ctx.globalAlpha *= (1 - lk) * 0.9;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2.5 * u;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 18 * u;
      const grow = 4 * u * lk;
      ctx.beginPath();
      ctx.roundRect(toX(p.x) - grow, toY(p.y) - grow, p.w * s + grow * 2, p.h * s + grow * 2, Math.max(3 * u, p.r * s) + grow);
      ctx.stroke();
      ctx.restore();
    }
  });

  // A light sweep across the finished page.
  const sk = range(t, T.sweep, T.sweep + 0.8);
  if (sk > 0 && sk < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx0, cy0, cw, ch);
    ctx.clip();
    const sx = lerp(cx0 - cw * 0.3, cx0 + cw * 1.3, ease.inOutCubic(sk));
    const g = ctx.createLinearGradient(sx - cw * 0.12, cy0, sx + cw * 0.12, cy0 + ch * 0.3);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${palette.light ? 0.35 : 0.14})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(cx0, cy0, cw, ch);
    ctx.restore();
  }

  // The hero component lifts off the page (the product, front and centre).
  const hero = pieces[0];
  const lk = ease.inOutCubic(range(t, T.lift, T.lift + 0.6));
  if (hero && lk > 0) {
    const x = toX(hero.x);
    const y = toY(hero.y);
    const pw = hero.w * s;
    const ph = hero.h * s;
    const lift = 1 + 0.045 * lk;
    ctx.save();
    ctx.translate(x + pw / 2, y + ph / 2 - 10 * u * lk);
    ctx.scale(lift, lift);
    ctx.shadowColor = rgba(palette.primary, palette.light ? 0.25 : 0.5);
    ctx.shadowBlur = 50 * u * lk;
    ctx.shadowOffsetY = 18 * u * lk;
    const r = Math.max(4 * u, hero.r * s);
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
    ctx.fillStyle = pageColor(hero.img, 2, 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    roundedImage(ctx, hero, -pw / 2, -ph / 2, pw, ph, r);
    ctx.strokeStyle = rgba(palette.accent, 0.5 * lk);
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, r);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });

export const componentSkills: Skill[] = [
  {
    id: "ui-assemble",
    name: "UI Assemble",
    tagline: "Your product page is taken apart and rebuilt: its real components fly in one by one on the beat, land into skeletons, and the page resolves with a light sweep.",
    bestFor: "Showing the real product without a flat screenshot, right after the brand reveal. Uses the hero screenshot and the UI components captured from the live site.",
    sample: { text: "Meet your new *dashboard*" },
    render: uiAssemble,
    sfx: (scene, beat, brand) => {
      const T = assembleTiming(pieceCount(scene, brand), beat);
      return [at(0.05, "swoosh"), ...T.lands.map((l) => at(l, "tick")), at(T.resolve, "shimmer")];
    },
  },
];
