import { exitT } from "../fx";
import { fillTextFit } from "../text";
import { tokens } from "../grid";
import { clamp, ease, lerp, mixHex, range, rgba, rng } from "../math";
import { pill, saasBackground, spring } from "../saasfx";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { coverDraw, gallery } from "./gallery";
import { topHeadline } from "./saas";

/**
 * Photo-card slides: the product's images as portrait cards with rounded corners and soft
 * shadows, the way image-led brands show a collection.
 *
 * - photo-fan    cards on an arc that turns one step per beat: the centre card upright and
 *                largest, the others tilting away, smaller and dimmer, as they go round.
 * - card-spread  a stack of cards fans open like a hand, then each card lifts out in turn.
 * - photo-drop   prints with a white border drop onto the stage one after another, each at its
 *                own slight angle, captions written on the border.
 *
 * They use the scene's media, the brand's images and captured UI (product photos sit on their
 * studio cards), falling back to generated images, like the other gallery slides.
 */

type Card = ReturnType<typeof gallery>[number];
const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0].trim();
const CARD_ASPECT = 0.8;

/** One photo card: soft drop shadow, rounded clip, the image cover-fitted, a hairline rim. `dim` 0..1 shades it back. */
function photoCard(sc: SkillContext, img: Card, x: number, y: number, cw: number, ch: number, opts: { dim?: number; r?: number; lift?: number; zoom?: number } = {}) {
  const { ctx, u, palette } = sc;
  const r = opts.r ?? cw * 0.07;
  const lift = opts.lift ?? 0;
  ctx.save();
  ctx.shadowColor = palette.light ? `rgba(20,30,60,${0.18 + lift * 0.12})` : `rgba(0,0,0,${0.45 + lift * 0.2})`;
  ctx.shadowBlur = (28 + lift * 30) * u;
  ctx.shadowOffsetY = (14 + lift * 16) * u;
  ctx.beginPath();
  ctx.roundRect(x, y, cw, ch, r);
  ctx.fillStyle = palette.bg1;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, cw, ch, r);
  ctx.clip();
  coverDraw(ctx, img, x, y, cw, ch, opts.zoom ?? 1);
  const dim = opts.dim ?? 0;
  if (dim > 0) {
    ctx.fillStyle = palette.light ? `rgba(255,255,255,${0.45 * dim})` : `rgba(0,0,0,${0.5 * dim})`;
    ctx.fillRect(x, y, cw, ch);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, cw - 1, ch - 1, r);
  ctx.strokeStyle = palette.light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = Math.max(1, u);
  ctx.stroke();
  ctx.restore();
}

/** The caption pill under a card. */
function caption(sc: SkillContext, text: string, y: number, k: number) {
  if (!text || k <= 0) return;
  const { ctx, w, u, palette } = sc;
  ctx.save();
  ctx.globalAlpha *= clamp(k);
  pill(sc, text, w / 2, y + (1 - ease.outCubic(clamp(k))) * 10 * u, { size: 26 * u, fill: rgba(palette.primary, 0.14), border: rgba(palette.primary, 0.45), color: palette.text });
  ctx.restore();
}

/** Seconds per step of the fan, fitted to the scene. */
function fanPeriod(scene: Scene, beat: number) {
  return Math.max(0.85, Math.min(beat * 2, (scene.duration - 1.6) / 4));
}

/* ───────────────────────── Photo Fan ───────────────────────── */

/**
 * Portrait photo cards on an arc. The centre card stands upright and largest; the others tilt
 * away along the curve, smaller and dimmer the further they are. On each beat the arc turns one
 * card on, so a new photo arrives in the centre; the arc opens out of a stack at the start and
 * closes back into it at the end.
 */
function photoFan(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  const head = scene.text ? topHeadline(sc) : null;
  const imgs = gallery(sc, 7, CARD_ASPECT);
  const n = imgs.length;
  const g = tokens(w, h);
  const items = (scene.items ?? []).filter(Boolean).map(titleOf);
  const capRoom = items.length ? 80 * u : 0;
  const top = head ? head.ys[head.ys.length - 1] + head.size * 0.9 : g.safe.top;
  const avail = h - g.safe.bottom - capRoom - top;
  // The cards at rest that must sit wholly inside the frame (vertical shows one each side).
  const visible = portrait ? 1 : 2;
  const margin = g.safe.left * 0.6;
  // The arc: a circle whose centre sits well below the cards; its size scales with the card.
  const geom = (ch: number) => {
    const cw = ch * CARD_ASPECT;
    const R = ch * (portrait ? 1.9 : 1.75);
    const stepA = (cw * (portrait ? 0.74 : 0.8)) / R;
    return { cw, R, stepA };
  };
  // How far the outermost resting card reaches from the centre line (its rotated half-width included).
  const reachOf = (ch: number) => {
    const { cw, R, stepA } = geom(ch);
    const th = visible * stepA * (1 - 0.06 * visible);
    const s = 1 - 0.2 * visible;
    return R * Math.sin(th) + s * ((cw / 2) * Math.cos(th) + (ch / 2) * Math.sin(th));
  };
  // Largest card for which the arc fits between the frame's edges.
  let ch = Math.min(avail * 0.86, portrait ? (w * 0.56) / CARD_ASPECT : h * 0.58);
  for (let i = 0; i < 30 && reachOf(ch) > w / 2 - margin; i++) ch *= 0.96;
  const { cw, R, stepA } = geom(ch);
  const cy = top + avail * 0.5;
  const pivotY = cy + R;
  // Motion: a step every period, eased; continuous, so the arc always has cards on both sides.
  const P = fanPeriod(scene, sc.beat);
  const t0 = 1.1;
  const k = t < t0 ? 0 : Math.floor((t - t0) / P);
  const frac = t < t0 ? 0 : ease.inOutCubic(range((t - t0 - k * P) / P, 0.55, 1));
  const pos = k + frac;
  const open = ease.outExpo(range(t, 0.1, 1.1));
  const ex = ease.inCubic(exitT(sc, 0.55));
  const spread = open * (1 - ex);
  // A soft pool of light behind the centre card.
  ctx.save();
  const glow = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, ch * 0.9);
  glow.addColorStop(0, rgba(palette.primary, palette.light ? 0.1 : 0.16));
  glow.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = glow;
  ctx.globalAlpha = open * (1 - ex);
  ctx.fillRect(0, cy - ch, w, ch * 2);
  ctx.restore();
  const reach = visible + 1;
  const slots: { rel: number; idx: number }[] = [];
  for (let j = -reach; j <= reach + 1; j++) {
    const idx = j + k;
    const rel = idx - pos;
    if (Math.abs(rel) > reach + 0.6) continue;
    slots.push({ rel, idx });
  }
  slots.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
  for (const { rel, idx } of slots) {
    const ar = Math.abs(rel);
    const theta = rel * stepA * (1 - 0.06 * Math.min(ar, 3)) * spread;
    const s = 1 - 0.2 * Math.min(ar, 2.6);
    const x = w / 2 + R * Math.sin(theta);
    const y = pivotY - R * Math.cos(theta) + (1 - open) * h * 0.25 + ex * h * 0.2;
    // Cards beyond the resting set fade as they leave, so none shows cut off at the frame's edge.
    const a = (1 - range(ar, visible + 0.02, visible + 0.7)) * clamp(open * 1.4) * (1 - ex);
    if (a <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(theta);
    ctx.scale(s, s);
    const img = imgs[((idx % n) + n) % n];
    // The card in the centre breathes in a little while it holds.
    const zoom = 1.04 - 0.04 * clamp(ar);
    photoCard(sc, img, -cw / 2, -ch / 2, cw, ch, { dim: Math.min(1, ar * 0.5), lift: 1 - clamp(ar), zoom });
    ctx.restore();
  }
  if (items.length) {
    const focus = ((Math.round(pos) % items.length) + items.length) % items.length;
    const near = 1 - clamp(Math.abs(pos - Math.round(pos)) * 3);
    caption(sc, items[focus], cy + ch / 2 + capRoom * 0.55, near * range(t, 0.9, 1.3) * (1 - ex));
  }
}

/* ───────────────────────── Card Spread ───────────────────────── */

/**
 * A stack of photo cards fans open like a hand of cards, pivoting from below; then each card in
 * turn lifts out of the hand, straightens and grows, with its caption, and settles back as the
 * next one rises. At the end the hand gathers back into a stack.
 */
function cardSpread(sc: SkillContext) {
  const { ctx, w, h, t, d, u, scene, seed } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  const head = scene.text ? topHeadline(sc) : null;
  const imgs = gallery(sc, portrait ? 5 : 6, CARD_ASPECT);
  const n = Math.min(imgs.length, portrait ? 5 : 6);
  const g = tokens(w, h);
  const items = (scene.items ?? []).filter(Boolean).map(titleOf);
  const capRoom = items.length ? 80 * u : 0;
  const top = head ? head.ys[head.ys.length - 1] + head.size * 0.9 : g.safe.top;
  const avail = h - g.safe.bottom - capRoom - top;
  const ch = Math.min(avail * 0.64, portrait ? (w * 0.34) / CARD_ASPECT : h * 0.44);
  const cw = ch * CARD_ASPECT;
  const pivotX = w / 2;
  const pivotY = top + avail * 0.56 + ch * 1.4;
  const A = portrait ? 0.3 : 0.62;
  const fan = ease.outBack(range(t, 0.55, 1.45), 1.1) * (1 - ease.inOutCubic(range(t, d - 0.9, d - 0.35)));
  const rise = ease.outExpo(range(t, 0.05, 0.7));
  const ex = ease.inCubic(exitT(sc, 0.35));
  // Lifting: one card at a time, between the fan opening and the hand closing.
  const liftStart = 1.6;
  const liftEnd = d - 1.0;
  const per = Math.max(0.6, (liftEnd - liftStart) / n);
  const r = rng(seed + 11);
  const jitter = Array.from({ length: n }, () => (r() - 0.5) * 0.08);
  const lifts = Array.from({ length: n }, (_, i) => {
    const s0 = liftStart + i * per;
    const up = ease.outCubic(range(t, s0, s0 + per * 0.35));
    const down = ease.inOutCubic(range(t, s0 + per * 0.75, s0 + per * 1.05));
    return t < liftEnd + per ? up * (1 - down) : 0;
  });
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => lifts[a] - lifts[b] || a - b);
  for (const i of order) {
    const base = n > 1 ? lerp(-A, A, i / (n - 1)) : 0;
    const lift = lifts[i];
    const theta = (base * fan + jitter[i] * (1 - fan)) * (1 - 0.65 * lift);
    // Each card hangs from the pivot; lifting slides it up along its own axis.
    const dist = pivotY - (top + avail * 0.56) + lift * Math.min(ch * 0.24, avail * 0.5 - ch * 0.62);
    const cx = pivotX + Math.sin(theta) * dist;
    const cyc = pivotY - Math.cos(theta) * dist + (1 - rise) * h * 0.4 + ex * h * 0.3;
    const s = 1 + 0.1 * lift;
    ctx.save();
    ctx.globalAlpha = clamp(rise * 1.3) * (1 - ex);
    ctx.translate(cx, cyc);
    ctx.rotate(theta);
    ctx.scale(s, s);
    const anyLift = Math.max(...lifts);
    photoCard(sc, imgs[i % imgs.length], -cw / 2, -ch / 2, cw, ch, { dim: anyLift > 0.05 ? (1 - lift) * 0.35 * anyLift : 0, lift, zoom: 1 + 0.05 * lift });
    ctx.restore();
  }
  if (items.length) {
    const li = lifts.findIndex((v) => v > 0.2);
    if (li >= 0) caption(sc, items[li % items.length], h - g.safe.bottom - capRoom * 0.45, lifts[li] * (1 - ex));
  }
}

/* ───────────────────────── Photo Drop ───────────────────────── */

/**
 * Prints dropping onto the stage: each photo, framed in a white border with its caption written
 * on it, falls in from above at its own slight angle, lands with a small bounce and a settling
 * shadow, and the next lands over it. The table drifts gently; at the end the prints slide away.
 */
function photoDrop(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, seed } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  const head = scene.text ? topHeadline(sc) : null;
  const imgs = gallery(sc, 5, 1);
  const n = Math.min(imgs.length, portrait ? 4 : 5);
  const g = tokens(w, h);
  const items = (scene.items ?? []).filter(Boolean).map(titleOf);
  const top = head ? head.ys[head.ys.length - 1] + head.size * 0.8 : g.safe.top;
  const avail = h - g.safe.bottom - top;
  const pw = Math.min(portrait ? w * 0.48 : w * 0.24, avail * 0.6 * 0.82);
  const border = pw * 0.06;
  const photo = pw - border * 2;
  const capH = items.length ? pw * 0.2 : border * 2;
  const ph = border + photo + capH;
  const r = rng(seed + 23);
  const stagger = Math.max(0.35, Math.min(0.7, (d - 1.8) / n));
  const drift = 1 + 0.03 * ease.inOutCubic(range(t, 0.5, d));
  const ex = ease.inCubic(exitT(sc, 0.5));
  const cyMid = top + avail / 2;
  ctx.save();
  ctx.translate(w / 2, cyMid);
  ctx.scale(drift, drift);
  ctx.translate(-w / 2, -cyMid);
  for (let i = 0; i < n; i++) {
    const land = 0.35 + i * stagger;
    const lt = t - land;
    if (lt < -0.25) break;
    // Laid out across the table, alternating up and down, each at its own angle.
    const spanX = Math.max(0, (portrait ? w * 0.78 : w * 0.84) - pw * 1.25);
    const fx = n > 1 ? lerp(-spanX / 2, spanX / 2, i / (n - 1)) : 0;
    const fy = (i % 2 ? 1 : -1) * avail * (portrait ? 0.16 : 0.08) + (r() - 0.5) * avail * 0.06;
    const rot = (r() - 0.5) * 0.32;
    const cx = w / 2 + fx;
    const cy = cyMid + fy;
    // The fall: from above and larger, with a bounce on landing.
    const fall = clamp((lt + 0.25) / 0.25);
    const settle = lt > 0 ? spring(lt, 16, 9) : 0;
    const sc0 = lt < 0 ? lerp(portrait ? 1.2 : 1.4, 1.05, ease.inCubic(fall)) : 1.05 - 0.05 * clamp(settle, 0, 1.1);
    const lift = lt < 0 ? 1 - ease.inCubic(fall) * 0.6 : Math.max(0, 0.4 - lt * 1.4);
    const slide = ex * (i % 2 ? 1 : -1) * w * 0.3;
    ctx.save();
    ctx.globalAlpha = clamp(fall * 1.5) * (1 - ex);
    ctx.translate(cx + slide, cy - (lt < 0 ? (1 - fall) * 60 * u : 0) + ex * h * 0.1);
    ctx.rotate(rot * (lt < 0 ? 1.4 - 0.4 * fall : 1));
    ctx.scale(sc0, sc0);
    // The print: shadow, white border, the photo, the caption.
    const x = -pw / 2;
    const y = -ph / 2;
    ctx.shadowColor = palette.light ? `rgba(20,30,60,${0.2 + lift * 0.15})` : `rgba(0,0,0,${0.5 + lift * 0.2})`;
    ctx.shadowBlur = (18 + lift * 40) * u;
    ctx.shadowOffsetY = (8 + lift * 26) * u;
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex("#ffffff", palette.bg1, 0.06);
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 6 * u);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + border, y + border, photo, photo);
    ctx.clip();
    coverDraw(ctx, imgs[i % imgs.length], x + border, y + border, photo, photo, 1.02);
    ctx.restore();
    if (items[i]) {
      ctx.font = `italic 400 ${Math.round(capH * 0.42)}px "Instrument Serif", Georgia, serif`;
      ctx.fillStyle = "#2a2a33";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha *= ease.outCubic(range(lt, 0.15, 0.6));
      fillTextFit(ctx, items[i], 0, y + border + photo + capH / 2, photo, { lineHeight: 1.0, minScale: 0.75 });
    }
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────────────────── Registry ───────────────────────── */

const SAMPLE_ITEMS = ["Lakeshore", "Island bay", "Hidden cove", "Mountain view", "Sunset point"];

export const cardSkills: Skill[] = [
  {
    id: "photo-fan",
    name: "Photo Fan",
    tagline: "Portrait photo cards on an arc that turns one card per beat: the centre card upright and largest, the others tilting away, smaller and dimmer.",
    bestFor: "Image-led products (stores, travel, food, fashion, creative work, physical products) with 3+ photos. Headline optional; items = one short caption per photo.",
    sample: { text: "", items: SAMPLE_ITEMS },
    itemsHint: "One caption per photo",
    render: photoFan,
    sfx: (scene, beat) => {
      const P = fanPeriod(scene, beat);
      const steps = Math.max(1, Math.floor((scene.duration - 1.1 - 0.55) / P));
      return [at(0.1, "whoosh"), ...Array.from({ length: steps }, (_, i) => at(1.1 + i * P + P * 0.6, "swoosh"))];
    },
  },
  {
    id: "card-spread",
    name: "Card Spread",
    tagline: "A stack of photo cards fans open like a hand of cards, then each card lifts out in turn with its caption.",
    bestFor: "A collection or range (products, templates, destinations) with 3–6 images. Headline = the range; items = one caption per card.",
    sample: { text: "The *collection*", items: SAMPLE_ITEMS },
    itemsHint: "One caption per card",
    render: cardSpread,
    sfx: (scene) => {
      const per = Math.max(0.6, (scene.duration - 2.6) / 6);
      return [at(0.05, "whoosh"), at(0.6, "swoosh"), ...Array.from({ length: 5 }, (_, i) => at(1.6 + i * per, "pop"))];
    },
  },
  {
    id: "photo-drop",
    name: "Photo Drop",
    tagline: "White-bordered prints drop onto the stage one after another, each at its own angle, captions written on the border.",
    bestFor: "Moments, places or products told as photos (travel, events, food, hospitality, physical products). Items = one handwritten-style caption per print.",
    sample: { text: "Moments worth *keeping*", items: SAMPLE_ITEMS },
    itemsHint: "One caption per print",
    render: photoDrop,
    sfx: (scene) => {
      const stagger = Math.max(0.35, Math.min(0.7, (scene.duration - 1.8) / 5));
      return Array.from({ length: 5 }, (_, i) => at(0.35 + i * stagger, "tick"));
    },
  },
];
