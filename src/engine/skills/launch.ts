/**
 * Launch-video slides: scenes that recur in well-known SaaS launch films and weren't covered yet.
 * Each is staged in the product's own palette, with generic, claim-free UI copy (no numbers, no
 * promises), under the scene's headline (topHeadline).
 *
 * - keycaps:       Linear / Raycast / Superhuman. Shortcuts pressed on big keycaps, the action
 *                  each one runs appearing under it.
 * - spotlight:     Stripe / Linear. The product screenshot dims, a spotlight isolates one part and
 *                  a leader line draws out to its label, part after part.
 * - toggle-list:   Settings switched on one by one by a cursor, then saved.
 * - device-trio:   Notion / Arc. The product on a laptop, a tablet and a phone, sliding in together.
 * - exploded-ui:   Apple / Framer. The screenshot tilts and separates into floating layers, labelled,
 *                  then collapses back into the flat page.
 * - changelog:     Linear. "What's new": release entries roll in with New / Improved tags.
 * - calendar-drop: Notion Calendar. Events drop into a week grid and one stretches to fit.
 * - inbox-sweep:   Superhuman. Messages swipe away one by one to a calm, empty inbox.
 * - comment-pins:  Figma. Comment pins pop onto a design, threads open, one is resolved.
 * - table-fill:    Airtable. A table fills row by row, then sorts by status.
 *
 * Every frame is a pure function of time, so preview, seek and export match.
 */
import { exitT } from "../fx";
import { tokens } from "../grid";
import { clamp, ease, hashString, lerp, mixHex, range, rgba, TAU } from "../math";
import { findHotspots, getMedia, type Drawable } from "../media";
import { clickRipple, drawCursor, drawIcon, glassCard, iconsFor, pill, pillWidth, saasBackground, spring } from "../saasfx";
import { fillTextFit, fitTextLines, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { mockShot } from "./gallery";
import { checkBadge, cursorPath, ellipsize, iconTile, keycap, windowChrome } from "./interactions";
import { drawCover } from "./media";
import { avatar, doneBadge, enter, fitTimes, PEOPLE } from "./moments";
import { topHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0].trim();
const hair = (p: Palette, a = 0.08) => (p.light ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
const surface = (p: Palette, lift = 0) => (p.light ? mixHex("#ffffff", "#000000", lift * 0.04) : mixHex(p.bg1, "#ffffff", 0.07 + lift * 0.04));
const exitOf = (sc: SkillContext) => ease.inCubic(exitT(sc, 0.4));
/**
 * Big screenshot windows fade in and out gently (half a second, eased at both ends), so a dark
 * screen arriving on a light stage, or leaving it, never jumps the frame's brightness.
 */
const softIn = (t: number, start: number, len = 0.5) => ease.inOutCubic(clamp((t - start) / len));
const softOut = (sc: SkillContext) => ease.inOutCubic(exitT(sc, 0.55));

/** The scene's item titles, else a stock set (at least `min`). */
function itemsOr(scene: Scene, fallback: string[], max = 5, min = 2) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, max);
  return items.length >= min ? items : fallback.slice(0, max);
}

/** The stage under the headline: scale, frame and the box content may use. */
function stage(sc: SkillContext) {
  const { w, h, u } = sc;
  const portrait = h > w;
  const S = portrait ? 1.4 : 1.2;
  const head = topHeadline(sc);
  const safe = tokens(w, h).safe;
  const top = head.ys[head.ys.length - 1] + head.size * 0.75 + 28 * u;
  const bottom = safe.top + safe.height;
  const width = portrait ? safe.width : Math.min(w * 0.72, 1320 * u);
  return { portrait, S, top, bottom, width, left: (w - width) / 2, ex: exitOf(sc), safe };
}

/** The product's screenshot (the scene's media, else the brand's first image), or a mock-up. */
function shotOf(sc: SkillContext): Drawable | HTMLCanvasElement {
  const { scene, brand, t } = sc;
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  return media ?? mockShot(sc.palette, sc.seed, 0);
}

/* ───────────────────────── Keycaps ───────────────────────── */

const KEY_SETS = [["⌘", "K"], ["C"], ["⌘", "↵"], ["⇧", "A"], ["G", "I"]];
const KEY_WORDS: Record<string, string> = { cmd: "⌘", command: "⌘", shift: "⇧", enter: "↵", return: "↵", option: "⌥", alt: "⌥", ctrl: "⌃", control: "⌃", tab: "⇥" };

/** "⌘ K — Open the command menu" → keys and action; a bare action gets a stock shortcut. */
function shortcuts(scene: Scene) {
  const raw = (scene.items ?? []).filter(Boolean).slice(0, 4);
  const list = (raw.length >= 2 ? raw : ["⌘ K — Open the command menu", "C — Create a task", "⌘ ↵ — Send it"]).map((item, i) => {
    const parts = item.split(/\s+[—–]\s+/);
    const keyPart = parts.length > 1 ? parts[0] : "";
    const keys = keyPart
      .split(/[\s+]+/)
      .filter(Boolean)
      .map((k) => KEY_WORDS[k.toLowerCase()] ?? (k.length <= 2 ? k.toUpperCase() : ""))
      .filter(Boolean)
      .slice(0, 3);
    return { keys: keys.length ? keys : KEY_SETS[i % KEY_SETS.length], action: (parts.length > 1 ? parts.slice(1).join(" — ") : item).trim() };
  });
  return list;
}

function keyTiming(scene: Scene) {
  const n = shortcuts(scene).length;
  const start = 0.55;
  const slot = Math.max(0.9, (scene.duration - start - 1.1) / n);
  return { n, start, slot };
}

function keycaps(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const list = shortcuts(scene);
  const T = keyTiming(scene);
  const icons = iconsFor(list.map((x) => x.action), sc);
  const mid = lerp(st.top, st.bottom, portrait ? 0.4 : 0.42);
  // Hero-sized keys, kept inside the stage with the result card under them.
  const keySize = Math.min((portrait ? 150 : 140) * u * S, (st.bottom - st.top) * 0.3);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  for (let i = 0; i < list.length; i++) {
    const t0 = T.start + i * T.slot;
    const t1 = t0 + T.slot;
    const last = i === list.length - 1;
    if (t < t0 - 0.3 || (!last && t > t1 + 0.3)) continue;
    // In from the right, out to the left, like flipping through a cheat sheet.
    const inK = ease.outCubic(range(t, t0 - 0.3, t0));
    const outK = last ? 0 : ease.inCubic(range(t, t1 - 0.05, t1 + 0.25));
    const dx = (1 - inK) * w * 0.35 - outK * w * 0.35;
    const alpha = Math.min(inK, 1 - outK);
    if (alpha <= 0) continue;
    const { keys, action } = list[i];
    const widths = keys.map((k) => (k.length > 1 && !/^[⌘⇧⌥⌃↵⇥]$/.test(k) ? 1.6 : 1));
    const gap = 22 * u * S;
    const total = widths.reduce((a, b) => a + b * keySize, 0) + gap * (keys.length - 1);
    let x = w / 2 + dx - total / 2;
    ctx.save();
    ctx.globalAlpha *= alpha;
    keys.forEach((k, j) => {
      const kw = widths[j] * keySize;
      // Pressed in order, held together, released as the action lands.
      const down = t0 + 0.12 + j * 0.12;
      const up = t0 + 0.12 + keys.length * 0.12 + 0.25;
      const press = clamp((t - down) / 0.06) * (1 - clamp((t - up) / 0.1));
      keycap(sc, k, x + kw / 2, mid, keySize, press, widths[j]);
      if (j < keys.length - 1) {
        ctx.save();
        ctx.fillStyle = rgba(palette.text, 0.45);
        ctx.font = subFont(30 * u * S, 600);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", x + kw + gap / 2, mid);
        ctx.restore();
      }
      x += kw + gap;
    });
    // The action it runs: a result card that springs up under the keys.
    const fire = t0 + 0.12 + keys.length * 0.12 + 0.05;
    const k = clamp(spring(t - fire, 13, 7), 0, 1.06);
    if (t > fire) {
      const cardW = Math.min(st.width * (portrait ? 1 : 0.62), 720 * u * S);
      const cardH = 74 * u * S;
      const cy = mid + keySize * 0.95 + cardH / 2;
      ctx.save();
      ctx.globalAlpha *= clamp((t - fire) / 0.15);
      ctx.translate(w / 2 + dx, cy + (1 - Math.min(1, k)) * 26 * u);
      glassCard(sc, -cardW / 2, -cardH / 2, cardW, cardH, { r: 16 * u * S });
      iconTile(sc, icons[i], -cardW / 2 + 44 * u * S, 0, 42 * u * S);
      ctx.fillStyle = palette.text;
      ctx.font = subFont(24 * u * S, 600);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, action, -cardW / 2 + 80 * u * S, 0, cardW - 150 * u * S, { maxLines: 2, lineHeight: 1.1, minScale: 0.7 });
      checkBadge(sc, cardW / 2 - 34 * u * S, 0, 14 * u * S, clamp((t - fire - 0.2) / 0.3));
      ctx.restore();
    }
    ctx.restore();
  }
  // A cheat-sheet row at the foot: one chip per shortcut, the current one lit.
  const cur = clamp(Math.floor((t - T.start) / T.slot), 0, list.length - 1);
  const chipY = Math.min(st.bottom - 30 * u * S, mid + keySize * 0.95 + 74 * u * S + 80 * u * S);
  const labels = list.map((x) => x.keys.join(" "));
  const size = 17 * u * S;
  const widths = labels.map((l) => pillWidth(sc, l, { size }));
  const gap = 12 * u * S;
  const all = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
  let cx = w / 2 - all / 2;
  ctx.save();
  ctx.globalAlpha *= clamp((t - 0.3) / 0.3);
  labels.forEach((l, i) => {
    const lit = i === cur && t >= T.start;
    pill(sc, l, cx + widths[i] / 2, chipY, { size, fill: lit ? rgba(palette.primary, 0.22) : undefined, border: lit ? palette.primary : undefined });
    cx += widths[i] + gap;
  });
  ctx.restore();
  ctx.restore();
}

const keycapSfx = (scene: Scene): SfxCue[] => {
  const T = keyTiming(scene);
  return shortcuts(scene).flatMap(({ keys }, i) => {
    const t0 = T.start + i * T.slot;
    return [...keys.map((_, j) => at(t0 + 0.12 + j * 0.12, "key")), at(t0 + 0.12 + keys.length * 0.12 + 0.05, "pop")];
  });
};

/* ───────────────────────── Spotlight Callout ───────────────────────── */

function spotTiming(scene: Scene) {
  const n = itemsOr(scene, ["Plan the week", "Share with the team", "Track the work"], 3).length;
  const start = 0.9;
  // The last spotlight lifts well before the scene leaves, so the two fades don't stack up.
  const slot = Math.max(1.0, (scene.duration - start - 1.5) / n);
  return { n, start, slot };
}

function spotlight(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const labels = itemsOr(scene, ["Plan the week", "Share with the team", "Track the work"], 3);
  const T = spotTiming(scene);
  const shot = shotOf(sc);
  // The screenshot in a window, as large as the stage allows (16:10 inside the chrome).
  const ww = portrait ? st.width : Math.min(st.width, ((st.bottom - st.top) / 0.68) * 1.0);
  // A tall frame shows more of the page (a 4:5 crop) and leaves room for the label under it.
  const sh = Math.min(portrait ? ww * 1.1 : (ww * 10) / 16, st.bottom - st.top - (portrait ? 170 : 60) * u);
  const wh = sh + 46 * u;
  const wx = (w - ww) / 2;
  const wy = st.top + (st.bottom - st.top - wh) / 2 - (portrait ? 50 * u : 0);
  const cur = Math.floor((t - T.start) / T.slot);
  const local = t - T.start - cur * T.slot;
  // Focus points: the screenshot's busiest regions, else spread over it.
  const found = shot instanceof HTMLCanvasElement ? null : findHotspots(shot as Drawable, ww, sh, 0.5, 0.15);
  const spots = [...(found ?? []), { x: 0.28, y: 0.32 }, { x: 0.7, y: 0.62 }, { x: 0.36, y: 0.7 }].slice(0, 3);
  const out = softOut(sc);
  ctx.save();
  enter(sc, 0.12);
  ctx.globalAlpha = (1 - out) * softIn(t, 0.08);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name}` : "Your product");
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(wx, top, ww, sh, [0, 0, 18 * u, 18 * u]);
  ctx.clip();
  drawCover(ctx, shot as Drawable, wx, top, ww, sh, 1, 0.5, 0.15);
  // The spotlight: the page dims around a soft rounded hole over the part in focus.
  if (t >= T.start - 0.2 && cur < T.n + 1) {
    const i = clamp(cur, 0, T.n - 1);
    const p = spots[i % spots.length];
    const prev = spots[Math.max(0, i - 1) % spots.length];
    const move = i > 0 ? ease.inOutCubic(clamp(local / 0.3)) : 1;
    const fx = lerp(prev.x, p.x, move);
    const fy = lerp(prev.y, p.y, move);
    const dim = clamp((t - T.start + 0.2) / 0.35) * (1 - range(t, T.start + T.n * T.slot - 0.1, T.start + T.n * T.slot + 0.3));
    const hw = ww * 0.24;
    const hh = sh * 0.24;
    const hx = wx + fx * ww - hw / 2;
    const hy = top + fy * sh - hh / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx, top, ww, sh);
    ctx.roundRect(hx, hy, hw, hh, 14 * u);
    ctx.fillStyle = rgba(palette.light ? "#1a1d29" : palette.bg0, (palette.light ? 0.42 : 0.62) * dim);
    ctx.fill("evenodd");
    ctx.strokeStyle = rgba(palette.primary, 0.95 * dim);
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.roundRect(hx, hy, hw, hh, 14 * u);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
  // The callout: a leader line from the spotlight out to its label beside the window.
  if (t >= T.start && cur < T.n) {
    const i = cur;
    const p = spots[i % spots.length];
    const sx = wx + p.x * ww;
    const sy = top + p.y * sh;
    const right = p.x < 0.5;
    const draw = ease.outCubic(clamp((local - 0.25) / 0.3));
    const lx = portrait ? w / 2 : right ? Math.min(w - st.safe.left - 10 * u, sx + ww * 0.34) : Math.max(st.safe.left + 10 * u, sx - ww * 0.34);
    const ly = portrait ? (p.y < 0.5 ? top + sh + 70 * u : wy - 40 * u) : sy - sh * 0.18;
    const ox = right ? sx + ww * 0.12 : sx - ww * 0.12;
    const oy = sy - sh * 0.12;
    const tx = lerp(ox, lx, draw);
    const ty = lerp(oy, ly, draw);
    const outK = ease.inCubic(range(local, T.slot - 0.25, T.slot));
    ctx.save();
    ctx.globalAlpha = (1 - ex) * (1 - outK);
    ctx.strokeStyle = palette.primary;
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(ox, oy, 6 * u, 0, TAU);
    ctx.fill();
    if (draw >= 1) {
      const k = clamp(spring(local - 0.55, 14, 7), 0, 1.06);
      const size = 22 * u * S;
      ctx.font = subFont(size, 650);
      const label = ellipsize(ctx, labels[i], portrait ? st.width * 0.9 : w * 0.24);
      const pw = pillWidth(sc, label, { size, weight: 650 });
      const pcx = portrait ? w / 2 : right ? Math.min(lx + pw / 2, w - st.safe.left - pw / 2) : Math.max(lx - pw / 2, st.safe.left + pw / 2);
      ctx.translate(pcx, ly);
      ctx.scale(Math.min(1, k), Math.min(1, k));
      pill(sc, label, 0, 0, { size, weight: 650, fill: palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.1), border: palette.primary, color: palette.text });
    }
    ctx.restore();
  }
}

const spotSfx = (scene: Scene): SfxCue[] => {
  const T = spotTiming(scene);
  return Array.from({ length: T.n }, (_, i) => [at(T.start + i * T.slot, "swoosh"), at(T.start + i * T.slot + 0.55, "pop")]).flat();
};

/* ───────────────────────── Toggle List ───────────────────────── */

function toggleTiming(scene: Scene) {
  const n = itemsOr(scene, ["Smart reminders", "Shared workspaces", "Weekly summaries", "Dark mode"], 5).length;
  const T = { rows: 0.3, first: 1.0, step: 0.55, saved: 0 };
  T.saved = T.first + n * T.step + 0.25;
  return fitTimes(T, T.saved, scene.duration);
}

function toggleList(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const labels = itemsOr(scene, ["Smart reminders", "Shared workspaces", "Weekly summaries", "Dark mode"], 5);
  const n = labels.length;
  const T = toggleTiming(scene);
  const icons = iconsFor(labels, sc);
  const rowH = (portrait ? 92 : 76) * u * S * 0.86;
  const ww = portrait ? st.width : Math.min(st.width * 0.7, 900 * u * S);
  const wh = 46 * u + n * rowH + 24 * u * S;
  const wx = (w - ww) / 2;
  const wy = Math.max(st.top, st.top + (st.bottom - st.top - wh) / 2 - 20 * u);
  const onAt = (i: number) => T.first + i * T.step;
  const trackW = 64 * u * S;
  const trackH = 36 * u * S;
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc, 0.12);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Settings` : "Settings");
  const knob = (i: number) => ({ x: wx + ww - 34 * u * S - trackW / 2, y: top + 12 * u * S + i * rowH + rowH / 2 });
  for (let i = 0; i < n; i++) {
    const y = top + 12 * u * S + i * rowH;
    const appear = clamp((t - T.rows - i * 0.07) / 0.2);
    if (appear <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= appear;
    ctx.translate(0, (1 - appear) * 12 * u);
    if (i > 0) {
      ctx.fillStyle = hair(palette, 0.07);
      ctx.fillRect(wx + 24 * u * S, y, ww - 48 * u * S, Math.max(1, u));
    }
    drawIcon(ctx, icons[i], wx + 44 * u * S, y + rowH / 2, 26 * u * S, rgba(palette.text, 0.75));
    ctx.fillStyle = palette.text;
    ctx.font = subFont(22 * u * S, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, labels[i], wx + 76 * u * S, y + rowH / 2, ww - 76 * u * S - trackW - 70 * u * S, { maxLines: 2, lineHeight: 1.1, minScale: 0.72 });
    // The switch: the knob slides over and the track fills with the brand colour.
    const on = ease.outCubic(clamp((t - onAt(i)) / 0.18));
    const k = knob(i);
    ctx.beginPath();
    ctx.roundRect(k.x - trackW / 2, k.y - trackH / 2, trackW, trackH, trackH / 2);
    ctx.fillStyle = on > 0 ? mixHex(palette.light ? "#d7dbe4" : mixHex(palette.bg1, "#ffffff", 0.18), palette.primary, on) : palette.light ? "#d7dbe4" : mixHex(palette.bg1, "#ffffff", 0.18);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(k.x - trackW / 2 + trackH / 2 + on * (trackW - trackH), k.y, trackH / 2 - 4 * u * S, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 6 * u;
    ctx.fill();
    ctx.shadowColor = "transparent";
    clickRipple(sc, k.x, k.y, range(t, onAt(i), onAt(i) + 0.4));
    ctx.restore();
  }
  // The cursor visits each switch in turn.
  if (t > 0.6) {
    let cur = cursorPath(wx + ww * 0.55, wy + wh + 80 * u, knob(0).x, knob(0).y, range(t, 0.6, onAt(0) - 0.05));
    for (let i = 1; i < n; i++) if (t > onAt(i - 1)) cur = cursorPath(knob(i - 1).x, knob(i - 1).y, knob(i).x, knob(i).y, range(t, onAt(i - 1) + 0.08, onAt(i) - 0.04));
    const away = ease.inOutCubic(range(t, T.saved, T.saved + 0.5));
    const press = Math.max(...labels.map((_, i) => clamp(1 - Math.abs(t - onAt(i)) / 0.07)));
    ctx.save();
    ctx.globalAlpha *= clamp((t - 0.6) / 0.2) * (1 - away);
    drawCursor(sc, cur.x + away * 60 * u, cur.y + away * 90 * u, press, S);
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  doneBadge(sc, "✓  Settings saved", w / 2, wy + wh + (portrait ? 64 : 46) * u, t - T.saved, S);
  ctx.restore();
}

const toggleSfx = (scene: Scene): SfxCue[] => {
  const T = toggleTiming(scene);
  const n = itemsOr(scene, ["a", "b", "c", "d"], 5).length;
  return [...Array.from({ length: n }, (_, i) => at(T.first + i * T.step, "click")), at(T.saved, "success")];
};

/* ───────────────────────── Device Trio ───────────────────────── */

/** A device's bezel with the screenshot inside; returns nothing (drawn at the current transform). */
function device(sc: SkillContext, kind: "laptop" | "tablet" | "phone", shot: Drawable | HTMLCanvasElement, cx: number, cy: number, sw: number, scroll: number) {
  const { ctx, u, palette } = sc;
  const bezel = palette.light ? "#1d2130" : "#0b0d14";
  const rim = palette.light ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.16)";
  const ratio = kind === "laptop" ? 10 / 16 : kind === "tablet" ? 4 / 3 : 2.05;
  const sh = sw * ratio;
  const pad = kind === "laptop" ? sw * 0.025 : kind === "tablet" ? sw * 0.045 : sw * 0.06;
  const r = kind === "laptop" ? sw * 0.025 : kind === "tablet" ? sw * 0.06 : sw * 0.16;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 20 * u;
  ctx.beginPath();
  ctx.roundRect(cx - sw / 2 - pad, cy - sh / 2 - pad, sw + pad * 2, sh + pad * 2, r + pad);
  ctx.fillStyle = bezel;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1, 1.5 * u);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - sw / 2, cy - sh / 2, sw, sh, r * 0.7);
  ctx.clip();
  ctx.fillStyle = palette.light ? "#ffffff" : palette.bg1;
  ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
  // A tall screen shows the page's left column, scrolling slowly, as a phone would.
  drawCover(ctx, shot as Drawable, cx - sw / 2, cy - sh / 2, sw, sh, kind === "phone" ? 1.05 : 1, kind === "phone" ? 0.18 : 0.5, clamp(0.1 + scroll * 0.4));
  ctx.restore();
  if (kind === "phone") {
    ctx.fillStyle = bezel;
    ctx.beginPath();
    ctx.roundRect(cx - sw * 0.17, cy - sh / 2 + sw * 0.04, sw * 0.34, sw * 0.09, sw * 0.045);
    ctx.fill();
  }
  if (kind === "laptop") {
    // The base: a thin wedge wider than the screen.
    const by = cy + sh / 2 + pad;
    ctx.beginPath();
    ctx.moveTo(cx - sw / 2 - pad * 3, by);
    ctx.lineTo(cx + sw / 2 + pad * 3, by);
    ctx.lineTo(cx + sw / 2 + pad * 5, by + sw * 0.035);
    ctx.lineTo(cx - sw / 2 - pad * 5, by + sw * 0.035);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, by, 0, by + sw * 0.035);
    g.addColorStop(0, palette.light ? "#c9cdd6" : "#3a3f50");
    g.addColorStop(1, palette.light ? "#9aa0ad" : "#1c2030");
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

function deviceTrio(sc: SkillContext) {
  const { ctx, w, t, d, u } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { portrait, ex } = st;
  const shot = shotOf(sc);
  const room = st.bottom - st.top;
  const lapW = portrait ? st.width * 0.82 : Math.min(st.width * 0.62, (room * 0.78) / (10 / 16));
  const lapH = (lapW * 10) / 16;
  const cy = st.top + room * (portrait ? 0.42 : 0.47);
  const tabW = lapW * 0.42;
  const phoneW = lapW * 0.2;
  const scroll = range(t, 1.2, d - 0.4);
  const drift = Math.sin(t * 0.8) * 4 * u;
  const pieces = portrait
    ? [
        { kind: "laptop" as const, x: w / 2, y: cy - lapH * 0.35, sw: lapW, at: 0.2, from: 0 },
        { kind: "tablet" as const, x: w / 2 - lapW * 0.2, y: cy + lapH * 0.75, sw: tabW * 1.1, at: 0.45, from: -1 },
        { kind: "phone" as const, x: w / 2 + lapW * 0.3, y: cy + lapH * 0.85, sw: phoneW * 1.2, at: 0.65, from: 1 },
      ]
    : [
    { kind: "tablet" as const, x: w / 2 - lapW * 0.5 - tabW * (portrait ? 0.05 : 0.32), y: cy + lapH * 0.18, sw: tabW, at: 0.45, from: -1 },
    { kind: "laptop" as const, x: w / 2, y: cy, sw: lapW, at: 0.2, from: 0 },
    { kind: "phone" as const, x: w / 2 + lapW * 0.5 + phoneW * 0.1, y: cy + lapH * 0.28, sw: phoneW, at: 0.65, from: 1 },
      ];
  ctx.save();
  ctx.globalAlpha = 1 - softOut(sc);
  for (const p of pieces) {
    const k = clamp(spring(t - p.at, 10, 7), 0, 1.05);
    if (t < p.at) continue;
    ctx.save();
    ctx.globalAlpha *= softIn(t, p.at, 0.45);
    const dx = p.from * (1 - Math.min(1, k)) * w * 0.3;
    const dy = (p.from === 0 ? 1 - Math.min(1, k) : 0) * 80 * u + (p.from ? drift * p.from : -drift * 0.5);
    device(sc, p.kind, shot, p.x + dx, p.y + dy, p.sw, scroll * (p.kind === "phone" ? 1.4 : 1));
    ctx.restore();
  }
  ctx.restore();
}

const deviceSfx = (): SfxCue[] => [at(0.2, "whoosh"), at(0.5, "pop"), at(0.7, "pop")];

/* ───────────────────────── Exploded UI ───────────────────────── */

function explodeTiming(scene: Scene) {
  const d = scene.duration;
  // (The layers lift a full second after the screen fades in, so the two never read as a flicker.)
  return { tilt: 0.05, apart: 1.3, label: 1.9, close: Math.max(2.9, d - 1.3), flat: Math.max(3.4, d - 0.75) };
}

function explodedUi(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const shot = shotOf(sc);
  const labels = itemsOr(scene, ["Navigation", "Your workspace", "Live updates"], 3);
  const T = explodeTiming(scene);
  const room = st.bottom - st.top;
  const pw = portrait ? st.width * 0.86 : Math.min(st.width * 0.7, room * 1.25);
  const ph = (pw * 10) / 16;
  const cx = portrait ? w / 2 : w / 2 - st.width * 0.08;
  const cy = st.top + room * 0.5;
  // How far into the 3D view (tilt) and how far apart the layers float (apart), 0..1.
  // It tilts as it fades in (one change of brightness, not two), and flattens before it leaves.
  const tilt = ease.outCubic(range(t, 0.05, 0.6)) * (1 - ease.inOutCubic(range(t, T.close + 0.15, T.flat)));
  const apart = ease.inOutCubic(range(t, T.apart, T.apart + 0.7)) * (1 - ease.inOutCubic(range(t, T.close, T.close + 0.6)));
  const layers = 4;
  const gap = ph * 0.22 * apart;
  // The plane: rotated and squashed into an isometric view as `tilt` rises.
  const rot = -0.5 * tilt;
  const squash = 1 - 0.45 * tilt;
  const scale = 1 - 0.18 * tilt;
  ctx.save();
  ctx.globalAlpha = (1 - softOut(sc)) * softIn(t, 0.05);
  const anchors: { x: number; y: number }[] = [];
  for (let L = 0; L < layers; L++) {
    // Layer 0 is the page's surface; the others each carry one band of the page, floating above it.
    const z = L === 0 ? 0 : L;
    ctx.save();
    ctx.translate(cx, cy + (layers / 2 - 0.5) * gap * 0.5 - z * gap);
    ctx.scale(1, squash);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.shadowColor = `rgba(0,0,0,${0.18 + 0.2 * apart})`;
    ctx.shadowBlur = (12 + 30 * apart) * u;
    ctx.shadowOffsetY = 12 * u * apart;
    const band = L === 0 ? [0, 1] : [(L - 1) / (layers - 1), L / (layers - 1)];
    const by = -ph / 2 + band[0] * ph;
    const bh = (band[1] - band[0]) * ph;
    ctx.beginPath();
    if (L === 0) ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 16 * u);
    else ctx.roundRect(-pw / 2, by, pw, bh, 10 * u);
    ctx.fillStyle = palette.light ? "#ffffff" : palette.bg1;
    if (L === 0 || apart > 0.02) {
      ctx.save();
      if (L > 0) ctx.globalAlpha *= clamp(apart * 3);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.clip();
    // The surface shows the full page while flat; as layers lift off, the bands go with them.
    if (L === 0) {
      // (Dimmed only a little as the layers lift, so the frame's brightness hardly changes.)
      ctx.globalAlpha *= 1 - 0.25 * apart;
      drawCover(ctx, shot as Drawable, -pw / 2, -ph / 2, pw, ph, 1, 0.5, 0.15);
    } else if (apart > 0.02) {
      ctx.globalAlpha *= clamp(apart * 3);
      drawCover(ctx, shot as Drawable, -pw / 2, -ph / 2, pw, ph, 1, 0.5, 0.15);
    }
    ctx.restore();
    if (L > 0 && apart > 0.02) {
      ctx.strokeStyle = rgba(palette.primary, 0.6 * apart);
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.roundRect(-pw / 2, by, pw, bh, 10 * u);
      ctx.stroke();
    }
    // Where this layer's label line starts (its right edge, mid-band), in frame coordinates.
    const m = ctx.getTransform();
    const px = pw / 2;
    const py = by + bh / 2;
    anchors[L] = { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
    ctx.restore();
  }
  ctx.restore();
  // Labels for the floating layers (top first), each on a leader line.
  if (apart > 0.5 && !portrait) {
    const lx = Math.min(w - st.safe.left - 10 * u, cx + pw * 0.62);
    labels.forEach((label, i) => {
      const L = layers - 1 - i;
      const a = anchors[L];
      if (!a) return;
      const k = clamp(spring(t - T.label - i * 0.18, 14, 7), 0, 1.05) * clamp((apart - 0.5) * 2);
      if (k <= 0) return;
      ctx.save();
      ctx.globalAlpha = (1 - ex) * clamp(k);
      ctx.strokeStyle = rgba(palette.text, 0.5);
      ctx.lineWidth = 1.5 * u;
      ctx.setLineDash([5 * u, 5 * u]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(lerp(a.x, lx, Math.min(1, k)), a.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = palette.primary;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 5 * u, 0, TAU);
      ctx.fill();
      // A long label shrinks to fit the margin before it would be cut.
      const room = w - lx - st.safe.left - 40 * u;
      ctx.font = subFont(20 * u * S, 650);
      const size = 20 * u * S * clamp(room / Math.max(1, ctx.measureText(label).width), 0.62, 1);
      ctx.font = subFont(size, 650);
      const text = ellipsize(ctx, label, room);
      const pwid = pillWidth(sc, text, { size, weight: 650 });
      pill(sc, text, lx + pwid / 2, a.y, { size, weight: 650, fill: palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.1), border: palette.primary, color: palette.text });
      ctx.restore();
    });
  }
  // In portrait the labels stack under the layers.
  if (apart > 0.5 && portrait) {
    labels.forEach((label, i) => {
      const k = clamp(spring(t - T.label - i * 0.18, 14, 7), 0, 1.05) * clamp((apart - 0.5) * 2);
      if (k <= 0) return;
      ctx.save();
      ctx.globalAlpha = (1 - ex) * clamp(k);
      pill(sc, label, w / 2, Math.min(st.bottom - 30 * u, cy + ph * 0.55 + 40 * u) + i * 64 * u * S, { size: 20 * u * S, weight: 650, border: palette.primary, color: palette.text });
      ctx.restore();
    });
  }
}

const explodeSfx = (scene: Scene): SfxCue[] => {
  const T = explodeTiming(scene);
  return [at(T.tilt, "whoosh"), at(T.apart, "swoosh"), at(T.label, "pop"), at(T.label + 0.18, "pop"), at(T.label + 0.36, "pop"), at(T.close, "swoosh"), at(T.flat, "click")];
};

/* ───────────────────────── Changelog ───────────────────────── */

const TAGS = ["New", "Improved", "New", "New", "Improved"];

function changeTiming(scene: Scene) {
  const n = itemsOr(scene, ["Shared views", "Calendar sync", "A new search", "Dark mode"], 5).length;
  const start = 0.7;
  const step = Math.min(0.6, Math.max(0.35, (scene.duration - start - 1.4) / n));
  return { n, start, step, end: start + n * step };
}

function changelog(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const items = itemsOr(scene, ["Shared views", "Calendar sync", "A new search", "Dark mode"], 5);
  const details = (scene.items ?? []).map((x) => x.split(/\s+[—–]\s+/)[1]?.trim() ?? "").slice(0, 5);
  const T = changeTiming(scene);
  const icons = iconsFor(items, sc);
  const rowH = (portrait ? 104 : 88) * u * S * 0.8;
  const ww = portrait ? st.width : Math.min(st.width * 0.72, 960 * u * S);
  const visible = Math.min(items.length, Math.max(3, Math.floor((st.bottom - st.top - 140 * u) / (rowH + 12 * u))));
  const wh = 46 * u + 64 * u * S + visible * (rowH + 12 * u * S) + 12 * u * S;
  const wx = (w - ww) / 2;
  const wy = st.top + Math.max(0, (st.bottom - st.top - wh) / 2 - 16 * u);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc, 0.12);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Changelog` : "Changelog");
  // Header: "What's new" with a Latest chip.
  ctx.fillStyle = palette.text;
  ctx.font = subFont(26 * u * S, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const hy = top + 34 * u * S;
  ctx.fillText("What's new", wx + 28 * u * S, hy);
  const hw = ctx.measureText("What's new").width;
  pill(sc, "Latest", wx + 28 * u * S + hw + 52 * u * S, hy, { size: 15 * u * S, fill: rgba(palette.primary, 0.18), border: palette.primary, color: palette.text });
  const listTop = top + 64 * u * S;
  // Newest first: each entry lands at the top and pushes the rest down (the oldest scroll away).
  const landed = clamp(Math.floor((t - T.start) / T.step) + 1, 0, items.length);
  const since = t - T.start - (landed - 1) * T.step;
  const push = landed > 0 ? ease.outCubic(clamp(since / 0.28)) : 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, listTop, ww, wh - (listTop - wy) - 8 * u);
  ctx.clip();
  for (let k = 0; k < landed; k++) {
    const i = landed - 1 - k;
    const slotY = listTop + (k - (k > 0 ? 1 - push : 0)) * (rowH + 12 * u * S);
    const y = k === 0 ? listTop - (1 - push) * (rowH * 0.6) : slotY;
    const a = k === 0 ? push : 1;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    ctx.roundRect(wx + 18 * u * S, y + 6 * u * S, ww - 36 * u * S, rowH, 14 * u * S);
    ctx.fillStyle = k === 0 ? rgba(palette.primary, palette.light ? 0.08 : 0.12) : hair(palette, 0.035);
    ctx.fill();
    if (k === 0) {
      ctx.strokeStyle = rgba(palette.primary, 0.6);
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
    }
    const cyR = y + 6 * u * S + rowH / 2;
    iconTile(sc, icons[i], wx + 58 * u * S, cyR, 44 * u * S);
    const tag = TAGS[i % TAGS.length];
    const tagSize = 14 * u * S;
    const tagW = pillWidth(sc, tag, { size: tagSize, weight: 700 });
    pill(sc, tag, wx + 100 * u * S + tagW / 2, cyR - (details[i] ? 16 * u * S : 0), { size: tagSize, weight: 700, fill: tag === "New" ? rgba(palette.accent, 0.22) : rgba(palette.secondary, 0.22), border: "none", color: palette.text });
    ctx.fillStyle = palette.text;
    ctx.font = subFont(22 * u * S, 650);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const tx = wx + 100 * u * S + tagW + 14 * u * S;
    fillTextFit(ctx, items[i], tx, cyR - (details[i] ? 16 * u * S : 0), wx + ww - tx - 40 * u * S, { maxLines: 1, minScale: 0.7 });
    if (details[i]) {
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.font = subFont(17 * u * S, 500);
      fillTextFit(ctx, details[i], wx + 100 * u * S, cyR + 20 * u * S, ww - 140 * u * S, { maxLines: 1, minScale: 0.75 });
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

const changeSfx = (scene: Scene): SfxCue[] => {
  const T = changeTiming(scene);
  return [...Array.from({ length: T.n }, (_, i) => at(T.start + i * T.step, "tick")), at(T.end, "shimmer")];
};

/* ───────────────────────── Calendar Drop ───────────────────────── */

/** Where each event goes: [day, start row, length in rows]; the last one stretches a row (free below). */
const SLOTS = [[0, 0, 1], [1, 2, 2], [3, 1, 2], [2, 4, 1], [4, 3, 2]];
const SLOTS_3 = [[0, 0, 1], [1, 1, 2], [2, 0, 2], [0, 3, 2], [2, 3, 1]];

function calTiming(scene: Scene) {
  const n = itemsOr(scene, ["Team standup", "Design review", "Launch planning", "Customer call", "Focus time"], 5).length;
  const T = { grid: 0.3, first: 0.8, step: 0.42, stretch: 0, end: 0 };
  T.stretch = T.first + n * T.step + 0.2;
  T.end = T.stretch + 0.6;
  return fitTimes(T, T.end, scene.duration);
}

function calendarDrop(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const events = itemsOr(scene, ["Team standup", "Design review", "Launch planning", "Customer call", "Focus time"], 5);
  const T = calTiming(scene);
  const days = portrait ? ["Mon", "Tue", "Wed"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const rows = 6;
  const ww = portrait ? st.width : Math.min(st.width, 1200 * u * S * 0.85);
  const wh = Math.min(st.bottom - st.top - 20 * u, (portrait ? 980 : 600) * u * S * 0.82);
  const wx = (w - ww) / 2;
  const wy = st.top + (st.bottom - st.top - wh) / 2;
  const colors = [palette.primary, palette.secondary, palette.accent];
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc, 0.12);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Calendar` : "Calendar");
  const gutter = 64 * u * S;
  const headH = 44 * u * S;
  const gx = wx + gutter;
  const gw = ww - gutter - 18 * u * S;
  const gy = top + headH;
  const gh = wh - (gy - wy) - 14 * u * S;
  const colW = gw / days.length;
  const rowH = gh / rows;
  // The week grid: day names, hour lines (no times: just the rhythm of a day).
  ctx.save();
  ctx.globalAlpha *= clamp((t - T.grid) / 0.3);
  ctx.fillStyle = rgba(palette.text, 0.7);
  ctx.font = subFont(17 * u * S, 650);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  days.forEach((dname, i) => ctx.fillText(dname, gx + colW * (i + 0.5), top + headH / 2));
  ctx.strokeStyle = hair(palette, 0.08);
  ctx.lineWidth = Math.max(1, u);
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(gx, gy + r * rowH);
    ctx.lineTo(gx + gw, gy + r * rowH);
    ctx.stroke();
    if (r < rows) {
      ctx.fillStyle = hair(palette, 0.35);
      ctx.beginPath();
      ctx.arc(wx + gutter * 0.5, gy + r * rowH, 2.5 * u, 0, TAU);
      ctx.fill();
    }
  }
  for (let c = 1; c < days.length; c++) {
    ctx.beginPath();
    ctx.moveTo(gx + c * colW, gy);
    ctx.lineTo(gx + c * colW, gy + gh);
    ctx.stroke();
  }
  // The "now" line.
  const nowY = gy + gh * (0.18 + 0.12 * range(t, 0, sc.d));
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(gx, nowY);
  ctx.lineTo(gx + gw, nowY);
  ctx.stroke();
  ctx.fillStyle = palette.secondary;
  ctx.beginPath();
  ctx.arc(gx, nowY, 5 * u, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Events drop into their slots; the last one stretches to fit.
  const slots = days.length === 3 ? SLOTS_3 : SLOTS;
  events.forEach((title, i) => {
    const [day0, row, len] = slots[i % slots.length];
    const day = day0 % days.length;
    const t0 = T.first + i * T.step;
    if (t < t0) return;
    const k = spring(t - t0, 12, 6.5);
    const stretched = i === events.length - 1 ? ease.outBack(clamp((t - T.stretch) / 0.35)) : 0;
    const x = gx + day * colW + 5 * u * S;
    const y = gy + row * rowH + 4 * u * S - (1 - Math.min(1, k)) * rowH * 2.2;
    const ew = colW - 10 * u * S;
    const eh = (len + stretched) * rowH - 8 * u * S;
    const c = colors[i % colors.length];
    ctx.save();
    ctx.globalAlpha *= clamp((t - t0) / 0.1);
    ctx.beginPath();
    ctx.roundRect(x, y, ew, eh, 10 * u * S);
    ctx.fillStyle = rgba(c, palette.light ? 0.2 : 0.28);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.fillRect(x, y + 6 * u * S, 4 * u * S, eh - 12 * u * S);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(16 * u * S, 650);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = fitTextLines(ctx, title, ew - 26 * u * S, { maxLines: eh > rowH * 1.4 ? 3 : 2, minScale: 0.6 });
    ctx.font = lines.font;
    lines.lines.forEach((ln, j) => ctx.fillText(ln, x + 14 * u * S, y + 10 * u * S + j * lines.size * 1.15));
    if (eh > rowH * 1.3) avatar(sc, PEOPLE[i % 4].name, PEOPLE[i % 4].color, x + 26 * u * S, y + eh - 22 * u * S, 11 * u * S);
    if (stretched > 0) {
      ctx.fillStyle = rgba(palette.text, 0.6);
      ctx.fillRect(x + ew / 2 - 14 * u, y + eh - 7 * u, 28 * u, 3 * u);
    }
    ctx.restore();
  });
  // The cursor drags the last event's bottom edge down.
  const last = events.length - 1;
  const [ld0, lrow, llen] = slots[last % slots.length];
  const ex0 = gx + (ld0 % days.length) * colW + colW / 2;
  const ey0 = gy + (lrow + llen) * rowH - 8 * u;
  if (t > T.stretch - 0.5 && t < T.end + 0.4) {
    const p = t < T.stretch ? cursorPath(ex0 + 90 * u, ey0 + 120 * u, ex0, ey0, range(t, T.stretch - 0.5, T.stretch - 0.05)) : { x: ex0, y: ey0 + ease.outBack(clamp((t - T.stretch) / 0.35)) * rowH };
    ctx.save();
    ctx.globalAlpha *= clamp((t - T.stretch + 0.5) / 0.2) * (1 - range(t, T.end, T.end + 0.4));
    drawCursor(sc, p.x, p.y, clamp(1 - Math.abs(t - T.stretch) / 0.1), S);
    ctx.restore();
  }
  ctx.restore();
}

const calSfx = (scene: Scene): SfxCue[] => {
  const T = calTiming(scene);
  const n = itemsOr(scene, ["a", "b", "c", "d", "e"], 5).length;
  return [...Array.from({ length: n }, (_, i) => at(T.first + i * T.step + 0.12, "pop")), at(T.stretch, "click")];
};

/* ───────────────────────── Inbox Sweep ───────────────────────── */

function inboxTiming(scene: Scene) {
  const n = itemsOr(scene, ["Weekly summary is ready", "Notes from the design review", "Your invite to the launch", "Feedback on the new homepage"], 5).length;
  const T = { rows: 0.35, first: 1.0, step: 0.5, empty: 0 };
  // The calm state arrives as the last message leaves.
  T.empty = T.first + (n - 1) * T.step + 0.3;
  return fitTimes(T, T.empty + 0.5, scene.duration);
}

function inboxSweep(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const subjects = itemsOr(scene, ["Weekly summary is ready", "Notes from the design review", "Your invite to the launch", "Feedback on the new homepage"], 5);
  const n = subjects.length;
  const T = inboxTiming(scene);
  const rowH = (portrait ? 104 : 84) * u * S * 0.82;
  const ww = portrait ? st.width : Math.min(st.width * 0.74, 1000 * u * S);
  const wh = 46 * u + n * rowH + 16 * u * S;
  const wx = (w - ww) / 2;
  const wy = st.top + Math.max(0, (st.bottom - st.top - wh) / 2 - 20 * u);
  const senders = ["Maya", "Leo", "Priya", "Sam", "Maya"];
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc, 0.12);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Inbox` : "Inbox");
  const listTop = top + 8 * u * S;
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, listTop, ww, wh - (listTop - wy));
  ctx.clip();
  for (let i = 0; i < n; i++) {
    const sweep = clamp((t - T.first - i * T.step) / 0.28);
    // Rows below a swept one slide up into its place.
    const gone = subjects.slice(0, i).reduce((a, _, j) => a + ease.inOutCubic(clamp((t - T.first - j * T.step - 0.22) / 0.25)), 0);
    const y = listTop + (i - gone) * rowH;
    const appear = clamp((t - T.rows - i * 0.07) / 0.2);
    if (appear <= 0 || sweep >= 1) continue;
    const dx = ease.inCubic(sweep) * ww * 1.05;
    ctx.save();
    ctx.globalAlpha *= appear;
    // Behind the row, revealed as it slides: the done colour with a check.
    if (sweep > 0) {
      ctx.fillStyle = rgba(palette.accent, 0.85);
      ctx.fillRect(wx, y, Math.min(ww, dx + 10 * u), rowH - 2 * u);
      drawIcon(ctx, "Check", wx + Math.min(dx, 90 * u * S) / 2 + 20 * u, y + rowH / 2, 28 * u * S, palette.light ? "#ffffff" : palette.bg0, 1);
    }
    ctx.translate(dx, 0);
    ctx.fillStyle = surface(palette);
    ctx.fillRect(wx, y, ww, rowH - 2 * u);
    ctx.fillStyle = hair(palette, 0.07);
    ctx.fillRect(wx + 20 * u * S, y + rowH - 2 * u, ww - 40 * u * S, Math.max(1, u));
    const sender = senders[i % senders.length];
    avatar(sc, sender, PEOPLE[i % 4].color, wx + 44 * u * S, y + rowH / 2, 18 * u * S);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = subFont(17 * u * S, 700);
    ctx.fillText(sender, wx + 78 * u * S, y + rowH * 0.34);
    ctx.font = subFont(19 * u * S, 550);
    fillTextFit(ctx, subjects[i], wx + 78 * u * S, y + rowH * 0.66, ww - 78 * u * S - (portrait ? 40 : 170) * u * S, { maxLines: 1, minScale: 0.72 });
    if (!portrait) {
      // A preview line, as soft bars.
      ctx.fillStyle = hair(palette, 0.12);
      ctx.beginPath();
      ctx.roundRect(wx + ww - 150 * u * S, y + rowH / 2 - 5 * u, 110 * u * S, 10 * u, 5 * u);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  // The empty, calm inbox.
  const calm = ease.outCubic(clamp((t - T.empty) / 0.4));
  if (calm > 0) {
    const cy = listTop + (wh - (listTop - wy)) / 2 - 10 * u;
    ctx.save();
    ctx.globalAlpha *= calm;
    checkBadge(sc, w / 2, cy - 20 * u * S, 30 * u * S, calm);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(26 * u * S, 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("You're all caught up", w / 2, cy + 38 * u * S);
    ctx.restore();
  }
  ctx.restore();
}

const inboxSfx = (scene: Scene): SfxCue[] => {
  const T = inboxTiming(scene);
  const n = itemsOr(scene, ["a", "b", "c", "d"], 5).length;
  return [...Array.from({ length: n }, (_, i) => at(T.first + i * T.step, "swoosh")), at(T.empty, "success")];
};

/* ───────────────────────── Comment Pins ───────────────────────── */

function pinTiming(scene: Scene) {
  const n = itemsOr(scene, ["Love this direction", "@Leo can we try a lighter header?", "The new copy reads well"], 3).length;
  const T = { first: 0.85, step: 0.85, resolve: 0 };
  T.resolve = T.first + n * T.step + 0.1;
  return fitTimes(T, T.resolve + 0.6, scene.duration);
}

/** A comment pin: a round avatar bubble with a pointed corner at the spot it marks. */
function commentPin(sc: SkillContext, x: number, y: number, r: number, color: string, name: string) {
  const { ctx } = sc;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x + r, y - r, r, Math.PI * 0.5, Math.PI * 2.0, false);
  ctx.arc(x + r, y - r, r, 0, Math.PI * 0.5, false);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = r * 0.8;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.restore();
  avatar(sc, name, color, x + r, y - r, r * 0.8);
}

function commentPins(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const comments = itemsOr(scene, ["Love this direction", "@Leo can we try a lighter header?", "The new copy reads well"], 3);
  const T = pinTiming(scene);
  const shot = shotOf(sc);
  const ww = portrait ? st.width : Math.min(st.width * 0.86, (st.bottom - st.top) * 1.55);
  const sh = Math.min(portrait ? ww * 1.15 : (ww * 10) / 16, st.bottom - st.top - 60 * u);
  const wh = sh + 46 * u;
  const wx = (w - ww) / 2;
  const wy = st.top + (st.bottom - st.top - wh) / 2;
  const spots = [{ x: 0.22, y: 0.3 }, { x: 0.62, y: 0.22 }, { x: 0.42, y: 0.66 }];
  const out = softOut(sc);
  ctx.save();
  enter(sc, 0.12);
  ctx.globalAlpha = (1 - out) * softIn(t, 0.08);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Design` : "Design");
  // Avatars of who's here, in the title bar.
  PEOPLE.slice(0, 3).forEach((p, i) => avatar(sc, p.name, p.color, wx + ww - 40 * u - i * 26 * u, wy + 23 * u, 12 * u, palette.light ? "#ffffff" : palette.bg1));
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(wx, top, ww, sh, [0, 0, 18 * u, 18 * u]);
  ctx.clip();
  drawCover(ctx, shot as Drawable, wx, top, ww, sh, 1, 0.5, 0.15);
  ctx.restore();
  const r = 18 * u * S;
  comments.forEach((text, i) => {
    const t0 = T.first + i * T.step;
    if (t < t0) return;
    const p = spots[i % spots.length];
    const x = wx + p.x * ww;
    const y = top + p.y * sh;
    const person = PEOPLE[i % 4];
    const pop = clamp(spring(t - t0, 15, 7), 0, 1.1);
    const resolved = i === 0 ? clamp((t - T.resolve) / 0.3) : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.translate(-x, -y);
    commentPin(sc, x, y, r, person.color, person.name);
    ctx.restore();
    // The thread bubble opens beside the pin, then (for the latest) stays open.
    // Earlier threads fold away as the next pin lands; the latest stays open.
    const fold = i === comments.length - 1 ? 0 : clamp((t - t0 - T.step) / 0.18);
    const open = clamp((t - t0 - 0.15) / 0.2) * (1 - fold) * (1 - resolved);
    const showResolved = i === 0 && resolved > 0;
    if (open > 0 || showResolved) {
      const size = 18 * u * S;
      ctx.save();
      ctx.font = subFont(size, 550);
      const maxW = Math.min(ww * 0.42, 420 * u * S);
      const lines = fitTextLines(ctx, text, maxW - 30 * u * S, { maxLines: 3, minScale: 0.85 });
      const bw = Math.min(maxW, Math.max(...lines.lines.map((l) => ctx.measureText(l).width)) * (lines.size / size) + 30 * u * S);
      const bh = 44 * u * S + lines.lines.length * lines.size * 1.25;
      const right = p.x < 0.55;
      const bx = right ? x + r * 2 + 12 * u : x - bw - 12 * u;
      const by = Math.max(top + 8 * u, y - r * 2 - bh * 0.3);
      ctx.globalAlpha *= showResolved ? 1 - resolved * 0.4 : open;
      glassCard(sc, bx, by, bw, bh, { r: 14 * u * S });
      ctx.fillStyle = palette.text;
      ctx.font = subFont(15 * u * S, 700);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(person.name, bx + 15 * u * S, by + 22 * u * S);
      ctx.font = lines.font;
      lines.lines.forEach((ln, j) => {
        const y2 = by + 44 * u * S + j * lines.size * 1.25 + lines.size * 0.45;
        // An @mention is highlighted in the brand colour.
        const m = /@\w+/.exec(ln);
        if (m) {
          const before = ln.slice(0, m.index);
          const bwid = ctx.measureText(before).width;
          ctx.fillStyle = palette.text;
          ctx.fillText(before, bx + 15 * u * S, y2);
          ctx.fillStyle = palette.primary;
          ctx.fillText(m[0], bx + 15 * u * S + bwid, y2);
          ctx.fillStyle = palette.text;
          ctx.fillText(ln.slice(m.index + m[0].length), bx + 15 * u * S + bwid + ctx.measureText(m[0]).width, y2);
        } else ctx.fillText(ln, bx + 15 * u * S, y2);
      });
      if (showResolved) checkBadge(sc, bx + bw - 22 * u * S, by + 22 * u * S, 11 * u * S, resolved);
      ctx.restore();
    }
  });
  ctx.restore();
}

const pinSfx = (scene: Scene): SfxCue[] => {
  const T = pinTiming(scene);
  const n = itemsOr(scene, ["a", "b", "c"], 3).length;
  return [...Array.from({ length: n }, (_, i) => at(T.first + i * T.step, "pop")), at(T.resolve, "success")];
};

/* ───────────────────────── Table Fill ───────────────────────── */

const STATUS = ["Done", "In progress", "To do"];
const TAGS2 = ["Design", "Product", "Marketing", "Research", "Content"];

function tableTiming(scene: Scene) {
  const n = itemsOr(scene, ["Launch plan", "Homepage refresh", "Customer research", "Release notes", "Onboarding emails"], 6, 3).length;
  const T = { head: 0.35, first: 0.7, step: 0.32, sort: 0 };
  T.sort = T.first + n * T.step + 0.45;
  return fitTimes(T, T.sort + 0.7, scene.duration);
}

function tableFill(sc: SkillContext) {
  const { ctx, w, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const st = stage(sc);
  const { S, portrait, ex } = st;
  const names = itemsOr(scene, ["Launch plan", "Homepage refresh", "Customer research", "Release notes", "Onboarding emails"], 6, 3);
  const n = names.length;
  const T = tableTiming(scene);
  // A spread of statuses, so the sort has something to do.
  const status = names.map((_, i) => STATUS[[1, 2, 0, 1, 2, 0][(i + (hashString(`${sc.seed}`) % 2)) % 6]]);
  // Sorted by status: Done first, then In progress, then To do (stable).
  const order = names.map((_, i) => i).sort((a, b) => STATUS.indexOf(status[a]) - STATUS.indexOf(status[b]) || a - b);
  const rowH = (portrait ? 74 : 62) * u * S * 0.85;
  const ww = portrait ? st.width : Math.min(st.width, 1200 * u * S * 0.85);
  const wh = 46 * u + rowH * (n + 1) + 16 * u * S;
  const wx = (w - ww) / 2;
  const wy = st.top + Math.max(0, (st.bottom - st.top - wh) / 2 - 16 * u);
  const cols = portrait ? [0.5, 0.3, 0.2] : [0.38, 0.22, 0.14, 0.26];
  const heads = portrait ? ["Name", "Status", "Owner"] : ["Name", "Status", "Owner", "Tag"];
  const colX = (c: number) => wx + 20 * u * S + cols.slice(0, c).reduce((a, b) => a + b, 0) * (ww - 40 * u * S);
  const sortK = ease.inOutCubic(clamp((t - T.sort) / 0.55));
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc, 0.12);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Table` : "Table");
  // Header row (Status shows a sort arrow once sorted).
  ctx.save();
  ctx.globalAlpha *= clamp((t - T.head) / 0.25);
  ctx.fillStyle = hair(palette, 0.05);
  ctx.fillRect(wx, top, ww, rowH);
  ctx.fillStyle = rgba(palette.text, 0.65);
  ctx.font = subFont(15 * u * S, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  heads.forEach((hd, c) => ctx.fillText(hd.toUpperCase(), colX(c), top + rowH / 2));
  if (sortK > 0) {
    ctx.globalAlpha *= sortK;
    ctx.fillStyle = palette.primary;
    ctx.font = subFont(15 * u * S, 700);
    ctx.fillText("↓", colX(1) + ctx.measureText("STATUS").width + 8 * u * S, top + rowH / 2);
  }
  ctx.restore();
  const statusColor = (s: string) => (s === "Done" ? palette.accent : s === "In progress" ? palette.secondary : rgba(palette.text, 0.35));
  for (let i = 0; i < n; i++) {
    const fill = clamp((t - T.first - i * T.step) / T.step);
    if (fill <= 0) continue;
    const pos = lerp(i, order.indexOf(i), sortK);
    const y = top + rowH * (1 + pos);
    // Cells fill left to right as the row is entered.
    const cell = (c: number) => clamp(fill * (heads.length + 0.5) - c);
    ctx.save();
    if (i % 2) {
      ctx.fillStyle = hair(palette, 0.025);
      ctx.fillRect(wx, y, ww, rowH);
    }
    ctx.fillStyle = hair(palette, 0.06);
    ctx.fillRect(wx + 12 * u, y + rowH - Math.max(1, u), ww - 24 * u, Math.max(1, u));
    const cyR = y + rowH / 2;
    ctx.globalAlpha *= cell(0);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(18 * u * S, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, names[i], colX(0), cyR, cols[0] * (ww - 40 * u * S) - 16 * u * S, { maxLines: 1, minScale: 0.7 });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= cell(1);
    const s = status[i];
    const size = 14 * u * S;
    const pw = pillWidth(sc, s, { size, weight: 650 });
    pill(sc, s, colX(1) + pw / 2, cyR, { size, weight: 650, fill: rgba(statusColor(s), 0.22), border: "none", color: palette.text });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= cell(2);
    avatar(sc, PEOPLE[i % 4].name, PEOPLE[i % 4].color, colX(2) + 16 * u * S, cyR, 14 * u * S);
    ctx.restore();
    if (!portrait) {
      ctx.save();
      ctx.globalAlpha *= cell(3);
      const tag = TAGS2[i % TAGS2.length];
      const tw2 = pillWidth(sc, tag, { size: 14 * u * S });
      pill(sc, tag, colX(3) + tw2 / 2, cyR, { size: 14 * u * S, color: rgba(palette.text, 0.8) });
      ctx.restore();
    }
  }
  ctx.restore();
}

const tableSfx = (scene: Scene): SfxCue[] => {
  const T = tableTiming(scene);
  const n = itemsOr(scene, ["a", "b", "c", "d", "e"], 6, 3).length;
  return [...Array.from({ length: n }, (_, i) => at(T.first + i * T.step, "tick")), at(T.sort, "whoosh")];
};

/* ───────────────────────── Registry ───────────────────────── */

export const launchSkills: Skill[] = [
  {
    id: "keycaps",
    name: "Keycaps",
    tagline: "Shortcuts pressed on big keycaps, one after another, with the action each one runs springing up underneath and a cheat-sheet row of the shortcuts below.",
    bestFor: "Keyboard-first and power-user products: 2–4 shortcuts as items ('⌘ K — Open the command menu', or just the action).",
    sample: { text: "Do it from the *keyboard*", items: ["⌘ K — Open the command menu", "C — Create a task", "⌘ ↵ — Send it"] },
    itemsHint: "2–4 shortcuts: '⌘ K — Action' or just the action",
    render: keycaps,
    sfx: keycapSfx,
  },
  {
    id: "spotlight",
    name: "Spotlight Callout",
    tagline: "The product screenshot dims around a spotlight on one part, a leader line draws out to its label, then the spotlight moves to the next part.",
    bestFor: "Pointing out 2–3 parts of the product's own screen (items) in a clean, guided way. Uses the screenshot.",
    sample: { text: "See what *matters*", items: ["Plan the week", "Share with the team", "Track the work"] },
    itemsHint: "2–3 short feature names",
    render: spotlight,
    sfx: spotSfx,
  },
  {
    id: "toggle-list",
    name: "Toggle List",
    tagline: "A settings panel whose switches a cursor turns on one by one, each track filling with the brand colour, then 'Settings saved'.",
    bestFor: "Options, controls and preferences: 3–5 short features (items) switched on. Configurable products.",
    sample: { text: "Make it *yours*", items: ["Smart reminders", "Shared workspaces", "Weekly summaries", "Dark mode"] },
    itemsHint: "3–5 short features or settings",
    render: toggleList,
    sfx: toggleSfx,
  },
  {
    id: "device-trio",
    name: "Device Trio",
    tagline: "The product's screenshot on a laptop, a tablet and a phone, sliding in together and scrolling gently.",
    bestFor: "Showing the product across screens. Uses the screenshot; no items needed.",
    sample: { text: "Wherever you *work*" },
    render: deviceTrio,
    sfx: deviceSfx,
  },
  {
    id: "exploded-ui",
    name: "Exploded UI",
    tagline: "The screenshot tilts into 3D and separates into floating layers, each labelled, then collapses back into the flat page.",
    bestFor: "A product-film 'how it's built' moment: 2–3 labels for the layers (items). Uses the screenshot.",
    sample: { text: "Layer by layer, *considered*", items: ["Navigation", "Your workspace", "Live updates"] },
    itemsHint: "2–3 short layer labels",
    render: explodedUi,
    sfx: explodeSfx,
  },
  {
    id: "changelog",
    name: "Changelog",
    tagline: "A 'What's new' feed: entries roll in at the top with New and Improved tags, pushing the earlier ones down.",
    bestFor: "Launches and updates: 3–5 new features (items, optionally 'Title — one-line detail').",
    sample: { text: "What's *new*", items: ["Shared views", "Calendar sync", "A new search", "Dark mode"] },
    itemsHint: "3–5 new features",
    render: changelog,
    sfx: changeSfx,
  },
  {
    id: "calendar-drop",
    name: "Calendar Drop",
    tagline: "Events drop into a week grid one by one with a little bounce, then a cursor stretches the last one to fit.",
    bestFor: "Scheduling, booking and planning products: 3–5 event names (items).",
    sample: { text: "Your week, *planned*", items: ["Team standup", "Design review", "Launch planning", "Customer call", "Focus time"] },
    itemsHint: "3–5 event names",
    render: calendarDrop,
    sfx: calSfx,
  },
  {
    id: "inbox-sweep",
    name: "Inbox Sweep",
    tagline: "Messages swipe away one by one over a done colour, the rest sliding up, until the inbox is calm and empty.",
    bestFor: "Email, triage and to-do products: 3–5 message subjects (items).",
    sample: { text: "Clear your *inbox*", items: ["Weekly summary is ready", "Notes from the design review", "Your invite to the launch", "Feedback on the new homepage"] },
    itemsHint: "3–5 message subjects",
    render: inboxSweep,
    sfx: inboxSfx,
  },
  {
    id: "comment-pins",
    name: "Comment Pins",
    tagline: "Comment pins pop onto the product's screen and their threads open (an @mention in the brand colour), then the first is resolved.",
    bestFor: "Feedback, review and design collaboration: 2–3 short comments (items). Uses the screenshot.",
    sample: { text: "Feedback, *in context*", items: ["Love this direction", "@Leo can we try a lighter header?", "The new copy reads well"] },
    itemsHint: "2–3 short comments",
    render: commentPins,
    sfx: pinSfx,
  },
  {
    id: "table-fill",
    name: "Table Fill",
    tagline: "A table fills row by row, cell by cell (names, status pills, owners, tags), then sorts itself by status.",
    bestFor: "Databases, spreadsheets, trackers and CRMs: 3–6 record names (items). No numbers shown.",
    sample: { text: "Your data, *organised*", items: ["Launch plan", "Homepage refresh", "Customer research", "Release notes", "Onboarding emails"] },
    itemsHint: "3–6 record names",
    render: tableFill,
    sfx: tableSfx,
  },
];
