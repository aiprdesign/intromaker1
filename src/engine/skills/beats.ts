/**
 * Story-beat slides: beats that launch and product videos use and the library didn't cover yet.
 * Each is staged in the product's own palette, under the scene's headline (topHeadline), with
 * generic, claim-free copy (no numbers, no promises).
 *
 * - persona-switch: "Who it's for". Audience chips (Designers / Developers / Marketers) light up in
 *                   turn and a card swaps to show what that audience gets, with a little UI of its own.
 * - phone-tour:     The product on a phone: the screen scrolls, fingertips tap, a notification
 *                   drops in and callouts pop out beside the taps. Mobile apps; vertical videos.
 * - drop-zone:      File in, result out: a file is dragged into a drop zone, a progress bar runs
 *                   through its steps, and the results pop out as cards. AI, document and media tools.
 * - arrow-rise:     a big glossy 3D arrow in the brand gradient sweeps up, milestones popping as it passes.
 * - unbox:          "What's in the box": the box opens and its contents rise out of it, one by one,
 *                   each as an icon tile with its name. Physical products.
 *
 * Every frame is a pure function of time, so preview, seek and export match.
 */
import { exitT } from "../fx";
import { tokens } from "../grid";
import { clamp, ease, hashString, lerp, mixHex, range, rgba, TAU } from "../math";
import { findHotspots, getImage, getMedia, mediaSize, type Drawable } from "../media";
import { arrow3d, bezierPts, clickRipple, drawCursor, drawIcon, glassCard, iconsFor, pill, pillWidth, saasBackground, spring } from "../saasfx";
import { fillTextFit, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { mockShot } from "./gallery";
import { checkBadge, cursorPath, iconTile } from "./interactions";
import { drawCover } from "./media";
import { fitTimes } from "./moments";
import { topHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
export const split = (item: string) => {
  const [a, b] = item.split(/\s+[—–]\s+/);
  return { title: (a ?? "").trim(), detail: (b ?? "").trim() };
};
export const exitOf = (sc: SkillContext) => ease.inCubic(exitT(sc, 0.4));
export const hair = (p: Palette, a = 0.1) => (p.light ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);

/** The scene's items, else a stock set (at least `min`). */
export function itemsOr(scene: Scene, fallback: string[], max = 5, min = 2) {
  const items = (scene.items ?? []).map((x) => x.trim()).filter(Boolean).slice(0, max);
  return items.length >= min ? items : fallback.slice(0, max);
}

/** The stage under the headline: scale, frame and the box content may use. */
export function stage(sc: SkillContext) {
  const { w, h, u } = sc;
  const portrait = h > w;
  const square = !portrait && w / h < 1.25;
  const S = portrait ? 1.4 : square ? 1.25 : 1.2;
  const head = topHeadline(sc);
  const safe = tokens(w, h).safe;
  const top = head.ys[head.ys.length - 1] + head.size * 0.75 + 28 * u;
  const bottom = safe.top + safe.height;
  const width = portrait || square ? safe.width : Math.min(w * 0.72, 1320 * u);
  return { portrait, square, narrow: portrait || square, S, top, bottom, width, left: (w - width) / 2, safe, ex: exitOf(sc) };
}

/* ───────────────────────── Who It's For ───────────────────────── */

const PERSONAS = ["Designers — Mockups, reviews and hand-offs in one place", "Developers — Specs and code right where you work", "Marketers — Campaigns from brief to launch"];

function personas(scene: Scene) {
  return itemsOr(scene, PERSONAS, 4).map(split);
}

function personaTiming(scene: Scene) {
  const n = personas(scene).length;
  const start = 0.6;
  const slot = clamp((scene.duration - start - 1) / n, 0.9, 1.6);
  return { n, start, slot };
}

function personaSwitch(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const P = personas(scene);
  const n = P.length;
  const T = personaTiming(scene);
  const icons = iconsFor(P.map((p) => p.title), sc);
  const active = clamp(Math.floor((t - T.start) / T.slot), 0, n - 1);
  const local = t - T.start - active * T.slot;
  const room = st.bottom - st.top;
  // Layout: chips in a column on the left and the card on the right (widescreen), or chips in a
  // row over the card (vertical and square).
  const chipSize = 22 * u * S;
  const chipH = chipSize * 2;
  const chipW = P.map((p) => pillWidth(sc, p.title, { size: chipSize, weight: 650 }));
  let chips: { x: number; y: number; w: number }[];
  let card: { x: number; y: number; w: number; h: number };
  if (narrow) {
    const gap = 12 * u;
    const total = chipW.reduce((a, b) => a + b, 0) + gap * (n - 1);
    const scale = Math.min(1, st.width / total);
    let x = w / 2 - (total * scale) / 2;
    // The chips and the card sit as one block, centred in the room under the headline.
    const ch = Math.min(room - chipH - 36 * u, st.width * (st.portrait ? 1.05 : 0.9));
    const top = st.top + Math.max(0, (room - (chipH + 32 * u + ch)) * 0.42);
    const y = top + chipH / 2;
    chips = chipW.map((cw) => {
      const c = { x: x + (cw * scale) / 2, y, w: cw * scale };
      x += cw * scale + gap * scale;
      return c;
    });
    card = { x: st.left, y: top + chipH + 32 * u, w: st.width, h: ch };
  } else {
    const colW = Math.max(...chipW) + 20 * u;
    const gap = 18 * u;
    const ch = Math.min(room, st.width * 0.42);
    const y0 = st.top + (room - ch) / 2;
    const listH = n * chipH + (n - 1) * gap;
    chips = chipW.map((cw, i) => ({ x: st.left + colW / 2, y: y0 + (ch - listH) / 2 + chipH / 2 + i * (chipH + gap), w: cw }));
    card = { x: st.left + colW + 40 * u, y: y0, w: st.width - colW - 40 * u, h: ch };
  }
  // The highlight glides from chip to chip.
  const glide = (i: number) => chips[i];
  const from = glide(Math.max(0, active - 1));
  const to = glide(active);
  const gk = active === 0 ? 1 : clamp(spring(local, 12, 8), 0, 1.05);
  const hx = lerp(from.x, to.x, gk);
  const hy = lerp(from.y, to.y, gk);
  const hw = lerp(from.w, to.w, Math.min(1, gk));
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp((t - T.start + 0.2) / 0.25);
  ctx.beginPath();
  ctx.roundRect(hx - hw / 2, hy - chipH / 2, hw, chipH, chipH / 2);
  ctx.fillStyle = rgba(palette.primary, palette.light ? 0.16 : 0.24);
  ctx.strokeStyle = rgba(palette.primary, 0.9);
  ctx.lineWidth = 2 * u;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  P.forEach((p, i) => {
    const k = clamp(spring(t - 0.2 - i * 0.1, 12, 7), 0, 1.05);
    if (k <= 0) return;
    const on = i === active && t >= T.start;
    ctx.save();
    ctx.globalAlpha = (1 - ex) * clamp(k) * (on ? 1 : 0.62);
    ctx.translate(0, (1 - Math.min(1, k)) * 16 * u);
    pill(sc, p.title, chips[i].x, chips[i].y, { size: chipSize * (chips[i].w / chipW[i]), weight: 650, fill: "transparent", border: on ? "none" : hair(palette, 0.16), color: palette.text });
    ctx.restore();
  });
  // The card: the persona's icon, who it's for and what they get, over a little UI of their own.
  if (t >= T.start - 0.1) {
    // The outgoing persona leaves before the next one arrives, so their words never overlap.
    const out = active === 0 ? 1 : clamp(local / 0.18);
    const swap = active === 0 ? clamp((t - T.start + 0.1) / 0.35) : clamp((local - 0.12) / 0.33);
    const e = ease.outCubic(swap);
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    glassCard(sc, card.x, card.y, card.w, card.h, { r: 24 * u });
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, 24 * u);
    ctx.clip();
    // Outgoing persona slides up and away as the next rises in.
    const drawPersona = (i: number, off: number, a: number) => {
      if (a <= 0.01) return;
      const p = P[i];
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(0, off);
      const pad = 32 * u * S * 0.85;
      const tile = Math.min(card.h * 0.3, 96 * u * S);
      iconTile(sc, icons[i], card.x + pad + tile / 2, card.y + pad + tile / 2, tile);
      ctx.fillStyle = palette.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = subFont(34 * u * S, 750);
      const tx = card.x + pad * 1.6 + tile;
      fillTextFit(ctx, p.title, tx, card.y + pad + tile * 0.32, card.w - (tx - card.x) - pad, { maxLines: 1, minScale: 0.6 });
      if (p.detail) {
        ctx.fillStyle = rgba(palette.text, 0.68);
        ctx.font = subFont(21 * u * S, 500);
        fillTextFit(ctx, p.detail, tx, card.y + pad + tile * 0.78, card.w - (tx - card.x) - pad, { maxLines: 2, lineHeight: 1.15, minScale: 0.7 });
      }
      // A small UI of their own: rows filling in, a status chip and a progress bar.
      const ux = card.x + pad;
      const uy = card.y + pad * 2 + tile;
      const uw = card.w - pad * 2;
      const uh = card.y + card.h - pad - uy;
      if (uh > 40 * u) {
        const rows = Math.max(2, Math.min(4, Math.floor(uh / (34 * u * S))));
        const rh = uh / rows;
        const seed = hashString(p.title);
        for (let r = 0; r < rows; r++) {
          const k = ease.outCubic(range(t - (i === active ? 0 : 0), (i === active ? T.start + active * T.slot : 0) + 0.15 + r * 0.08, (i === active ? T.start + active * T.slot : 0) + 0.45 + r * 0.08));
          const y = uy + r * rh + rh / 2;
          const len = (0.35 + ((seed >> (r * 3)) % 40) / 100) * uw * 0.62 * (i === active ? k : 1);
          ctx.fillStyle = rgba(palette.text, 0.1);
          ctx.beginPath();
          ctx.roundRect(ux, y - rh * 0.18, uw * 0.62, rh * 0.36, rh * 0.18);
          ctx.fill();
          ctx.fillStyle = rgba(r === 0 ? palette.primary : palette.text, r === 0 ? 0.85 : 0.32);
          ctx.beginPath();
          ctx.roundRect(ux, y - rh * 0.18, Math.max(rh * 0.36, len), rh * 0.36, rh * 0.18);
          ctx.fill();
          ctx.fillStyle = rgba(r % 2 ? palette.secondary : palette.primary, 0.22);
          ctx.beginPath();
          ctx.roundRect(ux + uw * 0.7, y - rh * 0.22, uw * 0.3, rh * 0.44, rh * 0.22);
          ctx.fill();
        }
      }
      ctx.restore();
    };
    if (active > 0 && out < 1) drawPersona(active - 1, -ease.inCubic(out) * 40 * u, 1 - out);
    drawPersona(active, (1 - e) * 40 * u, e);
    ctx.restore();
  }
}

const personaSfx = (scene: Scene): SfxCue[] => {
  const T = personaTiming(scene);
  return [at(0.2, "pop"), ...Array.from({ length: T.n }, (_, i) => at(T.start + i * T.slot, i ? "swoosh" : "whoosh"))];
};

/* ───────────────────────── Phone Tour ───────────────────────── */

const PHONE_CALLOUTS = ["Your day at a glance", "Updates as they happen", "Share in a tap"];

function phoneTiming(scene: Scene) {
  const T = { phone: 0.15, scroll: 0.8, taps: [1.5, 2.7, 3.9], notify: 2.1, out: 0 };
  T.out = T.taps[2] + 0.9;
  return fitTimes(T, T.out, scene.duration);
}

/** The screen's picture: the full-page screenshot (tall, so it scrolls) when there is one. */
function phoneShot(sc: SkillContext): { img: Drawable | HTMLCanvasElement; tall: boolean } {
  const { scene, brand, t, palette, seed } = sc;
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  const page = brand?.page?.src ? getImage(brand.page.src) : null;
  if (page && page.naturalWidth && page.naturalHeight > page.naturalWidth * 1.4 && !scene.media) return { img: page, tall: true };
  if (media) {
    const { w, h } = mediaSize(media as Drawable);
    return { img: media, tall: h > w * 1.4 };
  }
  return { img: mockShot(palette, seed, 1), tall: false };
}

function phoneTour(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const T = phoneTiming(scene);
  const labels = itemsOr(scene, PHONE_CALLOUTS, 3).map((x) => split(x).title);
  const room = st.bottom - st.top;
  const ph = Math.min(room * (narrow ? 0.92 : 0.98), h * 0.78);
  const pw = ph * 0.49;
  const pcx = narrow ? w / 2 : w / 2 - st.width * 0.16;
  const bob = Math.sin(t * 1.1) * 4 * u;
  const enterK = clamp(spring(t - T.phone, 9, 7), 0, 1.04);
  const py = st.top + (room - ph) / 2 + (1 - Math.min(1, enterK)) * 90 * u + bob;
  const px = pcx - pw / 2;
  const bez = pw * 0.045;
  const sx = px + bez;
  const sy = py + bez;
  const sw = pw - bez * 2;
  const sh = ph - bez * 2;
  const r = pw * 0.15;
  const out = ease.inOutCubic(range(t, d - 0.55, d));
  ctx.save();
  ctx.globalAlpha = clamp((t - T.phone) / 0.3) * (1 - out);
  // The body: a dark frame with a lit edge, side buttons and a soft shadow.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 50 * u;
  ctx.shadowOffsetY = 24 * u;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, r);
  ctx.fillStyle = "#0b0b12";
  ctx.fill();
  ctx.restore();
  const edge = ctx.createLinearGradient(px, py, px + pw, py + ph);
  edge.addColorStop(0, "rgba(255,255,255,0.35)");
  edge.addColorStop(0.5, "rgba(255,255,255,0.06)");
  edge.addColorStop(1, "rgba(255,255,255,0.22)");
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, r);
  ctx.stroke();
  ctx.fillStyle = "#16161f";
  ctx.fillRect(px + pw - 1, py + ph * 0.22, 3 * u, ph * 0.1);
  ctx.fillRect(px - 2 * u, py + ph * 0.18, 3 * u, ph * 0.06);
  ctx.fillRect(px - 2 * u, py + ph * 0.27, 3 * u, ph * 0.1);
  // The screen.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, r - bez);
  ctx.clip();
  ctx.fillStyle = palette.light ? "#ffffff" : palette.bg1;
  ctx.fillRect(sx, sy, sw, sh);
  const shot = phoneShot(sc);
  const sk = ease.inOutCubic(range(t, T.scroll, T.taps[2] + 0.4));
  const top = sy + sh * 0.06;
  const vh = sh - (top - sy);
  if (shot.tall) {
    // A tall page scrolls by, pausing a little at each tap.
    const { w: iw, h: ih } = mediaSize(shot.img as Drawable);
    const s = sw / iw;
    const travel = Math.max(0, ih * s - vh);
    ctx.drawImage(shot.img, sx, top - travel * sk * 0.85, sw, ih * s);
  } else drawCover(ctx, shot.img as Drawable, sx, top, sw, vh, 1.04, 0.2 + 0.6 * sk, 0.15);
  // Status bar: the island, signal and battery (no clock, no numbers).
  ctx.fillStyle = palette.light ? "#ffffff" : palette.bg1;
  ctx.fillRect(sx, sy, sw, top - sy);
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(sx + sw / 2 - sw * 0.17, sy + sh * 0.012, sw * 0.34, sh * 0.034, sh * 0.017);
  ctx.fill();
  ctx.fillStyle = rgba(palette.text, 0.8);
  for (let b = 0; b < 4; b++) ctx.fillRect(sx + sw * 0.08 + b * sw * 0.025, sy + sh * 0.036 - b * sh * 0.004, sw * 0.016, sh * 0.008 + b * sh * 0.004);
  ctx.strokeStyle = rgba(palette.text, 0.8);
  ctx.lineWidth = Math.max(1, u);
  ctx.strokeRect(sx + sw * 0.8, sy + sh * 0.022, sw * 0.09, sh * 0.018);
  ctx.fillRect(sx + sw * 0.805, sy + sh * 0.025, sw * 0.06, sh * 0.012);
  // A notification drops in from the top, holds, then slides back up.
  const nk = ease.outCubic(range(t, T.notify, T.notify + 0.35)) * (1 - ease.inCubic(range(t, T.notify + 1.5, T.notify + 1.85)));
  if (nk > 0) {
    const note = split(scene.subtext || "New update — Your summary is ready");
    const nw = sw * 0.92;
    const nh = sh * 0.09;
    const nx = sx + (sw - nw) / 2;
    const ny = sy + sh * 0.05 - (1 - nk) * nh * 1.6;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 16 * u;
    ctx.beginPath();
    ctx.roundRect(nx, ny, nw, nh, nh * 0.3);
    ctx.fillStyle = palette.light ? "rgba(255,255,255,0.96)" : mixHex(palette.bg1, "#ffffff", 0.14);
    ctx.fill();
    ctx.restore();
    iconTile(sc, "bell", nx + nh * 0.55, ny + nh / 2, nh * 0.6);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = subFont(nh * 0.26, 700);
    fillTextFit(ctx, note.title, nx + nh, ny + nh * 0.34, nw - nh * 1.2, { maxLines: 1, minScale: 0.7 });
    if (note.detail) {
      ctx.fillStyle = rgba(palette.text, 0.7);
      ctx.font = subFont(nh * 0.22, 500);
      fillTextFit(ctx, note.detail, nx + nh, ny + nh * 0.68, nw - nh * 1.2, { maxLines: 1, minScale: 0.7 });
    }
  }
  // Taps: a fingertip presses, a ripple spreads.
  const found = shot.img instanceof HTMLCanvasElement ? null : findHotspots(shot.img as Drawable, sw, vh, 0.5, 0.15);
  const spots = [...(found ?? []), { x: 0.3, y: 0.32 }, { x: 0.7, y: 0.55 }, { x: 0.45, y: 0.75 }].slice(0, 3).map((p) => ({ x: sx + clamp(p.x, 0.15, 0.85) * sw, y: top + clamp(p.y, 0.15, 0.85) * vh }));
  T.taps.forEach((tt, i) => {
    const p = spots[i];
    const k = range(t, tt - 0.25, tt + 0.35);
    if (k <= 0 || k >= 1) return;
    const press = 1 - Math.abs(t - tt) / 0.25;
    ctx.save();
    ctx.globalAlpha *= Math.sin(Math.PI * k);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14 * u * S * (1 - 0.2 * clamp(press)), 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = Math.max(1, u);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    clickRipple(sc, p.x, p.y, range(t, tt, tt + 0.5));
  });
  ctx.restore();
  ctx.restore();
  // Callouts pop out beside each tap, with a leader line (on the right in widescreen; alternating
  // sides in tall and square frames, kept inside the frame).
  // Callouts on the same side keep a pill's height apart (taps close together never stack them).
  const sideOf = (i: number) => (narrow ? i % 2 === 0 : true);
  const callY = spots.map((p) => p.y);
  const gapY = 21 * u * S * 2.4;
  for (const side of [true, false]) {
    const idx = spots.map((_, i) => i).filter((i) => sideOf(i) === side).sort((a, b) => callY[a] - callY[b]);
    for (let j = 1; j < idx.length; j++) callY[idx[j]] = Math.max(callY[idx[j]], callY[idx[j - 1]] + gapY);
  }
  T.taps.forEach((tt, i) => {
    const label = labels[i];
    if (!label) return;
    const k = clamp(spring(t - tt - 0.1, 12, 7), 0, 1.05) * (1 - ex) * (1 - out);
    if (k <= 0) return;
    const p = spots[i];
    const size = 21 * u * S;
    const lw = pillWidth(sc, label, { size, weight: 650 });
    const right = sideOf(i);
    let cx = right ? px + pw + 28 * u + lw / 2 : px - 28 * u - lw / 2;
    cx = clamp(cx, st.safe.left + lw / 2, st.safe.left + st.safe.width - lw / 2);
    const cy = callY[i];
    ctx.save();
    ctx.globalAlpha = clamp(k);
    ctx.strokeStyle = rgba(palette.primary, 0.8);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    const ex2 = right ? cx - lw / 2 : cx + lw / 2;
    const kx = Math.min(1, k);
    ctx.lineTo(lerp(p.x, ex2, kx), lerp(p.y, cy, kx));
    ctx.stroke();
    ctx.translate(0, (1 - Math.min(1, k)) * 10 * u);
    pill(sc, label, cx, cy, { size, weight: 650, fill: palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.1), border: palette.primary, color: palette.text });
    ctx.restore();
  });
}

const phoneSfx = (scene: Scene): SfxCue[] => {
  const T = phoneTiming(scene);
  return [at(T.phone, "whoosh"), at(T.notify, "pop"), ...T.taps.map((x) => at(x, "click"))];
};

/* ───────────────────────── Drop Zone ───────────────────────── */

const DROP_RESULTS = ["Summary", "Key points", "Next steps"];

function dropTiming(scene: Scene) {
  const T = { zone: 0.25, drag: 0.6, drop: 1.55, done: 2.75, results: 2.95, step: 0.22 };
  return fitTimes(T, T.results + 3 * T.step + 0.5, scene.duration);
}

function dropZone(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, narrow, ex } = st;
  const T = dropTiming(scene);
  const results = itemsOr(scene, DROP_RESULTS, 4).map((x) => split(x).title);
  const icons = iconsFor(results, sc);
  const file = (scene.subtext || "meeting-notes.pdf").slice(0, 32);
  const room = st.bottom - st.top;
  const resH = (narrow ? 64 : 76) * u * S * 0.8;
  const resRows = narrow ? results.length : 1;
  const resBlock = resRows * resH + (resRows - 1) * 12 * u;
  const zw = narrow ? st.width : Math.min(st.width * 0.7, 980 * u * S);
  const zh = Math.min(room - resBlock - 36 * u, zw * 0.5);
  const zx = (w - zw) / 2;
  const zy = st.top + Math.max(0, (room - zh - resBlock - 36 * u) / 2);
  const zc = { x: zx + zw / 2, y: zy + zh / 2 };
  const dropped = t >= T.drop;
  const over = ease.outCubic(range(t, T.drop - 0.45, T.drop - 0.1)) * (1 - range(t, T.drop + 0.1, T.drop + 0.4));
  // The zone: a dashed outline (the dashes march while a file hovers), an upload icon and a prompt.
  const zk = clamp(spring(t - T.zone, 11, 7), 0, 1.04);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp((t - T.zone) / 0.25);
  ctx.translate(zc.x, zc.y);
  ctx.scale(0.94 + 0.06 * Math.min(1, zk), 0.94 + 0.06 * Math.min(1, zk));
  ctx.translate(-zc.x, -zc.y);
  glassCard(sc, zx, zy, zw, zh, { r: 22 * u });
  ctx.save();
  ctx.setLineDash([12 * u, 9 * u]);
  ctx.lineDashOffset = -t * 40 * u * (0.3 + over);
  ctx.strokeStyle = rgba(palette.primary, 0.45 + 0.5 * over);
  ctx.lineWidth = (2 + over * 1.5) * u;
  ctx.beginPath();
  ctx.roundRect(zx + 14 * u, zy + 14 * u, zw - 28 * u, zh - 28 * u, 16 * u);
  ctx.stroke();
  ctx.restore();
  if (over > 0) {
    ctx.fillStyle = rgba(palette.primary, 0.08 * over);
    ctx.beginPath();
    ctx.roundRect(zx + 14 * u, zy + 14 * u, zw - 28 * u, zh - 28 * u, 16 * u);
    ctx.fill();
  }
  const done = ease.outCubic(range(t, T.done, T.done + 0.3));
  const prog = ease.inOutCubic(range(t, T.drop + 0.1, T.done));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!dropped) {
    drawIcon(ctx, "CloudUpload", zc.x, zc.y - zh * 0.12, Math.min(zh * 0.28, 64 * u * S), rgba(palette.primary, 0.9));
    ctx.fillStyle = rgba(palette.text, 0.75);
    ctx.font = subFont(22 * u * S, 600);
    ctx.fillText("Drop a file here", zc.x, zc.y + zh * 0.16);
  } else {
    // The file sits in the zone while a progress bar runs through its steps; then a tick.
    const fs = Math.min(zh * 0.26, 60 * u * S);
    drawIcon(ctx, done > 0 ? "CircleCheck" : "FileText", zc.x, zc.y - zh * 0.16, fs, rgba(done > 0 ? palette.primary : palette.text, 0.9));
    ctx.fillStyle = palette.text;
    ctx.font = subFont(20 * u * S, 600);
    ctx.fillText(file, zc.x, zc.y + zh * 0.04);
    const bw = zw * 0.56;
    const bh = 10 * u * S * 0.8;
    const by = zc.y + zh * 0.2;
    ctx.fillStyle = hair(palette, 0.12);
    ctx.beginPath();
    ctx.roundRect(zc.x - bw / 2, by - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    const g = ctx.createLinearGradient(zc.x - bw / 2, 0, zc.x + bw / 2, 0);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(zc.x - bw / 2, by - bh / 2, Math.max(bh, bw * prog), bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = rgba(palette.text, 0.65);
    ctx.font = subFont(17 * u * S, 500);
    ctx.fillText(done > 0 ? "Done" : prog < 0.45 ? "Uploading…" : "Working on it…", zc.x, by + 28 * u * S * 0.8);
  }
  ctx.restore();
  // The file card, dragged in by the cursor and dropped into the zone.
  if (t >= T.drag && t < T.drop + 0.25) {
    const k = range(t, T.drag, T.drop - 0.05);
    const startX = w - st.safe.left - 60 * u;
    const startY = st.bottom - 20 * u;
    const p = cursorPath(startX, startY, zc.x, zc.y, k);
    const shrink = 1 - ease.inCubic(range(t, T.drop - 0.05, T.drop + 0.25));
    const fw = 230 * u * S * 0.8;
    const fh = 64 * u * S * 0.8;
    ctx.save();
    ctx.globalAlpha = (1 - ex) * clamp((t - T.drag) / 0.15) * shrink;
    ctx.translate(p.x, p.y);
    ctx.rotate((1 - k) * -0.08);
    ctx.scale(0.6 + 0.4 * shrink, 0.6 + 0.4 * shrink);
    glassCard(sc, -fw / 2, -fh / 2, fw, fh, { r: 12 * u });
    drawIcon(ctx, "FileText", -fw / 2 + fh * 0.5, 0, fh * 0.46, palette.primary);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = subFont(17 * u * S * 0.9, 600);
    fillTextFit(ctx, file, -fw / 2 + fh * 0.95, 0, fw - fh * 1.1, { maxLines: 1, minScale: 0.6 });
    ctx.restore();
    if (shrink > 0.5) drawCursor(sc, p.x + fw * 0.32, p.y + fh * 0.2, t > T.drop - 0.15 ? 1 : 0.6, S, p.lean);
  }
  // The results pop out under the zone, each with a tick.
  const ry = zy + zh + 36 * u;
  const gap = 14 * u;
  const rw = narrow ? zw : (zw - gap * (results.length - 1)) / results.length;
  results.forEach((label, i) => {
    const lt = t - T.results - i * T.step;
    const k = clamp(spring(lt, 12, 7), 0, 1.05);
    if (lt <= 0) return;
    const x = narrow ? zx : zx + i * (rw + gap);
    const y = narrow ? ry + i * (resH + 12 * u) : ry;
    ctx.save();
    ctx.globalAlpha = (1 - ex) * clamp(lt / 0.15);
    ctx.translate(0, (1 - Math.min(1, k)) * 24 * u);
    glassCard(sc, x, y, rw, resH, { r: 14 * u });
    iconTile(sc, icons[i], x + resH * 0.5, y + resH / 2, resH * 0.56);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = subFont(19 * u * S * 0.9, 650);
    fillTextFit(ctx, label, x + resH * 0.95, y + resH / 2, rw - resH * 1.6, { maxLines: 2, lineHeight: 1.1, minScale: 0.7 });
    checkBadge(sc, x + rw - resH * 0.38, y + resH / 2, resH * 0.17, ease.outBack(range(lt, 0.15, 0.4)));
    ctx.restore();
  });
}

const dropSfx = (scene: Scene): SfxCue[] => {
  const T = dropTiming(scene);
  const n = itemsOr(scene, DROP_RESULTS, 4).length;
  return [at(T.zone, "pop"), at(T.drag, "whoosh"), at(T.drop, "click"), at(T.done, "success"), ...Array.from({ length: n }, (_, i) => at(T.results + i * T.step, "pop"))];
};

/* ───────────────────────── What's in the Box ───────────────────────── */

const BOX_ITEMS = ["The product", "Charging cable", "Quick start guide", "Carry pouch"];

function boxTiming(scene: Scene) {
  const n = itemsOr(scene, BOX_ITEMS, 5).length;
  const T = { box: 0.15, open: 0.75, first: 1.15, step: 0.4 };
  return { ...fitTimes(T, T.first + n * T.step + 0.8, scene.duration), n };
}

function unbox(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const items = itemsOr(scene, BOX_ITEMS, 5).map((x) => split(x).title);
  const n = items.length;
  const T = boxTiming(scene);
  const icons = iconsFor(items, sc);
  const room = st.bottom - st.top;
  // The box sits low; its contents rise into a row (two rows in tall frames) above it.
  const bw = Math.min(st.width * (portrait ? 0.6 : 0.34), room * 0.6);
  const bh = bw * 0.52;
  const bx = w / 2 - bw / 2;
  const by = st.bottom - bh - Math.max(8 * u, sc.h * 0.035);
  const cols = portrait && n > 3 ? Math.ceil(n / 2) : n;
  const rows = Math.ceil(n / cols);
  const cellW = Math.min(st.width / cols, 260 * u * S);
  const tile = Math.min(cellW * 0.52, 110 * u * S, (by - st.top - 40 * u) / (rows * 1.9));
  const rowH = tile * 1.9;
  const gridTop = st.top + Math.max(0, (by - st.top - 30 * u - rows * rowH) / 2) + tile / 2;
  const open = ease.inOutCubic(range(t, T.open, T.open + 0.45));
  const enterK = clamp(spring(t - T.box, 10, 7), 0, 1.04);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp((t - T.box) / 0.25);
  ctx.translate(0, (1 - Math.min(1, enterK)) * 60 * u);
  // A glow from inside as it opens.
  if (open > 0) {
    const g = ctx.createRadialGradient(w / 2, by, 0, w / 2, by, bw * 0.8);
    g.addColorStop(0, rgba(palette.light ? palette.primary : mixHex(palette.primary, "#ffffff", 0.5), (palette.light ? 0.18 : 0.35) * open));
    g.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = g;
    ctx.fillRect(w / 2 - bw, by - bw, bw * 2, bw * 1.4);
  }
  const body = mixHex(palette.primary, palette.light ? "#ffffff" : "#000000", 0.25);
  const dark = mixHex(body, "#000000", 0.35);
  // Back flaps (behind the contents) open outward.
  const flapH = bh * 0.42;
  const drawFlap = (x0: number, x1: number, dir: number, col: string) => {
    const lift = Math.cos(open * Math.PI * 0.78);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x0, by);
    ctx.lineTo(x1, by);
    ctx.lineTo(x1 + dir * flapH * 0.5 * open, by - flapH * lift);
    ctx.lineTo(x0 + dir * flapH * 0.5 * open, by - flapH * lift);
    ctx.closePath();
    ctx.fill();
  };
  drawFlap(bx, bx + bw * 0.5, -1, dark);
  drawFlap(bx + bw * 0.5, bx + bw, 1, dark);
  ctx.restore();
  // The contents rise out of the box to their places, one by one.
  items.forEach((label, i) => {
    const lt = t - T.first - i * T.step;
    if (lt <= 0) return;
    const k = clamp(spring(lt, 9, 6.5), 0, 1.06);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const tx = w / 2 + (col - (inRow - 1) / 2) * cellW;
    const ty = gridTop + row * rowH;
    // Up out of the box first, then across to its place (an arc, not a straight line).
    const x = lerp(w / 2, tx, ease.inOutCubic(Math.min(1, k)));
    const y = lerp(by + bh * 0.2, ty, k);
    const s = 0.35 + 0.65 * Math.min(1, k);
    ctx.save();
    ctx.globalAlpha = (1 - ex) * clamp(lt / 0.15);
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate((1 - Math.min(1, k)) * (i % 2 ? 0.3 : -0.3));
    ctx.shadowColor = rgba(palette.primary, 0.4);
    ctx.shadowBlur = 24 * u;
    iconTile(sc, icons[i], 0, 0, tile);
    ctx.restore();
    const lk = ease.outCubic(range(lt, 0.3, 0.6));
    if (lk > 0) {
      ctx.save();
      ctx.globalAlpha = (1 - ex) * lk;
      ctx.fillStyle = palette.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = subFont(Math.min(20 * u * S, cellW * 0.11), 650);
      fillTextFit(ctx, label, tx, ty + tile * 0.62, cellW * 0.92, { maxLines: 2, lineHeight: 1.1, minScale: 0.7 });
      ctx.restore();
    }
  });
  // The box's front, over the contents' starting point.
  ctx.save();
  ctx.globalAlpha = (1 - ex) * clamp((t - T.box) / 0.25);
  ctx.translate(0, (1 - Math.min(1, enterK)) * 60 * u);
  const fg = ctx.createLinearGradient(0, by, 0, by + bh);
  fg.addColorStop(0, body);
  fg.addColorStop(1, dark);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, [4 * u, 4 * u, 14 * u, 14 * u]);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(bx, by, bw, 3 * u);
  // A tape band and the brand's name on the box.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(w / 2 - bw * 0.06, by, bw * 0.12, bh);
  const name = sc.brand?.name;
  if (name) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = subFont(Math.min(bh * 0.2, 30 * u * S), 750);
    fillTextFit(ctx, name, w / 2, by + bh * 0.6, bw * 0.8, { maxLines: 1, minScale: 0.5 });
  }
  ctx.restore();
}

const boxSfx = (scene: Scene): SfxCue[] => {
  const T = boxTiming(scene);
  return [at(T.box, "whoosh"), at(T.open, "swoosh"), ...Array.from({ length: T.n }, (_, i) => at(T.first + i * T.step, "pop"))];
};

/* ───────────────────────── 3D Arrow ───────────────────────── */

const ARROW_STEPS = ["Plan", "Build", "Launch"];

function arrowTiming(scene: Scene) {
  const n = itemsOr(scene, ARROW_STEPS, 4).length;
  const T = { start: 0.35, end: 2.1 };
  const f = fitTimes(T, T.end + 0.9, scene.duration);
  // Milestones sit along the curve; each pops as the arrow passes it.
  const at = Array.from({ length: n }, (_, i) => 0.22 + (0.62 * i) / Math.max(1, n - 1 || 1));
  return { ...f, n, at };
}

/** The curve the arrow sweeps along: low on the left, rising steeply to the upper right. */
function arrowPath(sc: SkillContext, st: ReturnType<typeof stage>) {
  const { w } = sc;
  const room = st.bottom - st.top;
  const y0 = st.bottom - room * 0.04;
  const y1 = st.top + room * (st.portrait ? 0.08 : 0.12);
  const x0 = st.portrait ? w * 0.1 : w * 0.1;
  const x1 = st.portrait ? w * 0.84 : w * 0.8;
  return bezierPts({ x: x0, y: y0 }, { x: lerp(x0, x1, 0.45), y: y0 + room * 0.02 }, { x: lerp(x0, x1, 0.62), y: lerp(y0, y1, 0.55) }, { x: x1, y: y1 }, 64);
}

function arrowRise(sc: SkillContext) {
  const { ctx, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, ex } = st;
  const T = arrowTiming(scene);
  const labels = itemsOr(scene, ARROW_STEPS, 4).map((x) => split(x).title);
  const path = arrowPath(sc, st);
  const short = Math.min(sc.w, sc.h);
  const W = short * (st.portrait ? 0.06 : 0.05);
  const k = ease.inOutCubic(range(t, T.start, T.end));
  const bob = Math.sin(t * 1.3) * 3 * u * range(t, T.end, T.end + 0.5);
  ctx.save();
  ctx.globalAlpha *= 1 - ex;
  ctx.translate(0, bob);
  // A soft glow where the arrow lands.
  const land = range(t, T.end - 0.1, T.end + 0.6);
  const end = path[path.length - 1];
  if (land > 0) {
    const r = W * 4 * (0.6 + 0.4 * ease.outCubic(land));
    const g = ctx.createRadialGradient(end.x, end.y, 0, end.x, end.y, r);
    g.addColorStop(0, rgba(palette.secondary, (palette.light ? 0.22 : 0.35) * Math.min(1, land * 2)));
    g.addColorStop(1, rgba(palette.secondary, 0));
    ctx.fillStyle = g;
    ctx.fillRect(end.x - r, end.y - r, r * 2, r * 2);
  }
  arrow3d(sc, path, { k, width: W, depth: W * 0.75, colors: [palette.primary, palette.accent ?? palette.secondary] });
  ctx.restore();
  // Milestones: a dot on the arrow and a label above it, popping as the arrow passes.
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const total = lens[lens.length - 1];
  T.at.forEach((f, i) => {
    const label = labels[i];
    if (!label) return;
    // When the head passes this point (in the eased draw-on).
    const pass = T.start + (T.end - T.start) * invEase(f);
    const pk = clamp(spring(t - pass, 13, 7), 0, 1.06);
    if (pk <= 0) return;
    let j = lens.findIndex((L) => L >= total * f);
    if (j < 0) j = path.length - 1;
    const p = path[j];
    const size = 21 * u * S;
    const lw = pillWidth(sc, label, { size, weight: 700 });
    const lx = clamp(p.x - W * 0.4, st.safe.left + lw / 2, st.safe.left + st.safe.width - lw / 2);
    const ly = p.y - W * 1.7 - size;
    ctx.save();
    ctx.globalAlpha *= (1 - ex) * clamp(pk);
    ctx.translate(0, bob + (1 - Math.min(1, pk)) * 14 * u);
    // The stem from the arrow up to the label.
    ctx.strokeStyle = rgba(palette.text, 0.35);
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - W * 0.55);
    ctx.lineTo(lx, ly + size);
    ctx.stroke();
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.9);
    ctx.beginPath();
    ctx.arc(p.x, p.y - W * 0.05, W * 0.22 * Math.min(1, pk), 0, TAU);
    ctx.fill();
    pill(sc, label, lx, ly, { size, weight: 700, fill: palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.08), border: rgba(palette.primary, 0.6), color: palette.text });
    ctx.restore();
  });
}

/** The inverse of ease.inOutCubic (when the eased draw-on reaches `y`). */
function invEase(y: number) {
  return y < 0.5 ? Math.cbrt(y / 4) : 1 - Math.cbrt(2 * (1 - y)) / 2;
}

const arrowSfx = (scene: Scene): SfxCue[] => {
  const T = arrowTiming(scene);
  return [at(T.start, "whoosh"), ...T.at.map((f) => at(T.start + (T.end - T.start) * invEase(f), "pop")), at(T.end, "shimmer")];
};

/* ───────────────────────── Registry ───────────────────────── */

export const beatSkills: Skill[] = [
  {
    id: "persona-switch",
    name: "Who It's For",
    tagline: "Audience chips light up in turn (Designers, Developers, Marketers) and a card swaps to show what that audience gets, with a little UI of their own.",
    bestFor: "Who the product is for: 2–4 audiences (items 'Who — what they get'). Products used by several roles or teams.",
    sample: { text: "Built for *your team*", items: PERSONAS },
    itemsHint: "2–4 audiences: 'Who — what they get'",
    render: personaSwitch,
    sfx: personaSfx,
  },
  {
    id: "phone-tour",
    name: "Phone Tour",
    tagline: "The product on a phone: the screen scrolls, fingertips tap, a notification drops in and callouts pop out beside the taps.",
    bestFor: "Mobile apps and on-the-go products, and vertical videos. Items: up to 3 short callouts; subtext: a notification ('Title — detail').",
    sample: { text: "Your work, *in your pocket*", subtext: "New update — Your summary is ready", items: PHONE_CALLOUTS },
    itemsHint: "Up to 3 short callouts",
    render: phoneTour,
    sfx: phoneSfx,
  },
  {
    id: "drop-zone",
    name: "Drop Zone",
    tagline: "A file is dragged into a drop zone, a progress bar runs through its steps, and the results pop out as cards with a tick.",
    bestFor: "File in, result out: AI, document, media and conversion tools. Items: 2–4 results; subtext: the file's name.",
    sample: { text: "Drop it in, *get it back*", subtext: "meeting-notes.pdf", items: DROP_RESULTS },
    itemsHint: "2–4 results the product gives back",
    render: dropZone,
    sfx: dropSfx,
  },
  {
    id: "unbox",
    name: "What's in the Box",
    tagline: "The box opens with a glow and its contents rise out of it one by one as icon tiles with their names.",
    bestFor: "Physical products: what comes in the package (items: 2–5 short names).",
    sample: { text: "What's in the *box*", items: BOX_ITEMS },
    itemsHint: "2–5 things in the box",
    render: unbox,
    sfx: boxSfx,
  },
  {
    id: "arrow-rise",
    name: "3D Arrow",
    tagline: "A big, glossy 3D arrow in the brand gradient sweeps up across the frame, its milestones popping up as it passes, and lands with a glow.",
    bestFor: "Steps or a journey (items: 2–4 short milestones), and launch videos that want a bold, upward move.",
    sample: { text: "Your next *chapter*", items: ARROW_STEPS },
    itemsHint: "2–4 short milestones",
    render: arrowRise,
    sfx: arrowSfx,
  },
];
