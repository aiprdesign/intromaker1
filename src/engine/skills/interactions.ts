/**
 * Signature interaction moments from the best SaaS launch films. Each one shows the product
 * *doing* something rather than listing it:
 *
 * - command-k:    Linear / Raycast. ⌘K keycaps press, the palette opens over a dimmed stage,
 *                 a query types in, results filter live, Enter runs it and a toast confirms.
 * - ai-prompt:    Every AI launch. A prompt types into the composer, is sent, the assistant
 *                 "thinks" with a shimmer, then the answer streams in word by word.
 * - click-flow:   Efficiency signalling (Chrono, Linear, Zapier). A cursor glides to the primary
 *                 button behind a micro-zoom, one click, and every task ticks off in a cascade.
 * - notify-stack: The product alive. App notifications drop into an iOS-style stack.
 * - chart-grow:   A real number counts up beside an area chart that draws itself on.
 *
 * Motion follows the house rules of those films: asymmetric springs, rapid ease-in micro-zooms,
 * focal isolation (the periphery dims when the key UI opens), and time compression (loading
 * states are skipped; work completes in a fast cascade).
 */
import { exitT } from "../fx";
import { clamp, ease, lerp, mixHex, range, rgba, TAU } from "../math";
import { borderBeam, clickRipple, drawCursor, drawIcon, glassCard, iconFor, iconsFor, pill, saasBackground, spring } from "../saasfx";
import { fillTextFit, fillTextMid, fitTextLines, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { topHeadline } from "./saas";
import { parseStat } from "./worlds";

/* ───────── shared helpers ───────── */

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0].trim();
const descOf = (item: string) => item.split(/\s+[—–]\s+/)[1]?.trim() ?? "";
const isPortrait = (sc: SkillContext) => sc.h > sc.w;

export function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.replace(/[\s,.;:]+$/, "")}…`;
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  let line = "";
  for (const wd of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${wd}` : wd;
    if (ctx.measureText(next).width > maxW && line) {
      out.push(line);
      line = wd;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** wrap() limited to n lines; when words are left over, the last line ends in "…" instead of losing them silently. */
export function wrapClamp(ctx: CanvasRenderingContext2D, text: string, maxW: number, n: number) {
  const all = wrap(ctx, text, maxW);
  const out = all.slice(0, n);
  if (all.length > n) out[n - 1] = ellipsize(ctx, `${out[n - 1]} ${all.slice(n).join(" ")}`, maxW);
  return out;
}

/** Focal isolation: dim the periphery around the UI that matters. */
export function focus(sc: SkillContext, cx: number, cy: number, r: number, k: number) {
  if (k <= 0) return;
  const { ctx, w, h, palette } = sc;
  const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, Math.max(w, h) * 0.75);
  g.addColorStop(0, rgba(palette.bg0, 0));
  g.addColorStop(1, rgba(palette.bg0, (palette.light ? 0.45 : 0.62) * k));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** A physical keycap that presses down (press 0..1). */
function keycap(sc: SkillContext, label: string, cx: number, cy: number, size: number, press: number, wide = 1) {
  const { ctx, u, palette } = sc;
  const kw = size * wide;
  const depth = 7 * u * (size / (96 * u));
  const dy = press * depth * 0.8;
  const light = !!palette.light;
  const face0 = light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.2);
  const face1 = light ? "#e9ebf0" : mixHex(palette.bg1, "#ffffff", 0.08);
  const side = light ? "#c9cdd6" : mixHex(palette.bg0, "#000000", 0.35);
  ctx.save();
  ctx.shadowColor = press > 0.3 ? rgba(palette.primary, 0.55 * press) : "rgba(0,0,0,0.35)";
  ctx.shadowBlur = (press > 0.3 ? 34 : 18) * u;
  ctx.shadowOffsetY = 6 * u;
  ctx.beginPath();
  ctx.roundRect(cx - kw / 2, cy - size / 2 + depth, kw, size, size * 0.2);
  ctx.fillStyle = side;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - kw / 2, cy - size / 2 + dy, kw, size, size * 0.2);
  const g = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  g.addColorStop(0, face0);
  g.addColorStop(1, face1);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = press > 0.3 ? rgba(palette.primary, 0.8 * press) : light ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.16)";
  ctx.lineWidth = Math.max(1, 1.5 * u);
  ctx.stroke();
  ctx.fillStyle = palette.text;
  ctx.font = subFont(size * (label.length > 2 ? 0.26 : 0.42), 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + dy + size * 0.02);
  ctx.restore();
}

/** Gradient app-icon tile with a Lucide glyph. */
export function iconTile(sc: SkillContext, icon: string, cx: number, cy: number, s: number, progress = 1) {
  const { ctx, palette } = sc;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.26);
  const g = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  drawIcon(ctx, icon, cx, cy, s * 0.56, palette.light ? "#ffffff" : palette.bg0, progress);
}

/** Round check mark badge (done state). */
export function checkBadge(sc: SkillContext, cx: number, cy: number, r: number, k: number) {
  const { ctx, palette } = sc;
  if (k <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  const s = clamp(spring(k * 0.6, 14, 7), 0, 1.15);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.restore();
  drawIcon(ctx, "Check", cx, cy, r * 1.25, palette.light ? "#ffffff" : palette.bg0, ease.outCubic(clamp(k * 2.2)));
}

/** macOS-style window chrome; returns the top of the content area. */
export function windowChrome(sc: SkillContext, x: number, y: number, ww: number, wh: number, title: string) {
  const { ctx, u, palette } = sc;
  glassCard(sc, x, y, ww, wh, { r: 18 * u });
  const bar = 46 * u;
  ctx.save();
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(x + 26 * u + i * 22 * u, y + bar / 2, 6.5 * u, 0, TAU);
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.9;
    ctx.fill();
  });
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = palette.text;
  ctx.font = subFont(16 * u, 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ellipsize(ctx, title, ww * 0.5), x + ww / 2, y + bar / 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  ctx.fillRect(x, y + bar, ww, Math.max(1, u));
  ctx.restore();
  return y + bar;
}

/** Cursor that glides along a curved path (asymmetric ease: fast out, soft landing). */
export function cursorPath(x0: number, y0: number, x1: number, y1: number, k: number) {
  const e = ease.outQuart(clamp(k));
  const cx = lerp(x0, x1, 0.15) + (y1 - y0) * 0.18;
  const cy = lerp(y0, y1, 0.85);
  const a = (1 - e) * (1 - e);
  const b = 2 * (1 - e) * e;
  const c = e * e;
  return { x: a * x0 + b * cx + c * x1, y: a * y0 + b * cy + c * y1 };
}

/* ───────────────────────── Command palette (⌘K) ───────────────────────── */

function commandItems(scene: Scene) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 5);
  return items.length >= 2 ? items : ["Create new project", "Invite teammates", "Search your workspace", "Open settings"];
}

/** The typed query: the start of the target command's most distinctive word. */
function commandQuery(target: string) {
  const words = target.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((x) => x.length >= 3);
  const word = [...words].sort((a, b) => b.length - a.length)[0] ?? target.toLowerCase().slice(0, 5);
  return word.slice(0, Math.min(word.length, 6));
}

function commandTiming(scene: Scene) {
  const q = commandQuery(commandItems(scene)[0]);
  const keyA = 0.5;
  const keyB = 0.66;
  const open = 0.9;
  const typeStart = 1.2;
  const cps = 0.085;
  const typeEnd = typeStart + q.length * cps;
  const enter = typeEnd + 0.45;
  return { keyA, keyB, open, typeStart, cps, typeEnd, enter, toast: enter + 0.2, q };
}

function commandK(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = isPortrait(sc);
  const S = portrait ? 1.35 : 1.45;
  const items = commandItems(scene);
  const T = commandTiming(scene);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const pw = portrait ? w * 0.9 : Math.min(w * 0.66, 1300 * u);
  const px = (w - pw) / 2;
  const py = h * (portrait ? 0.36 : 0.29);
  const searchH = 86 * u * S;
  const rowH = 66 * u * S;

  // Palette open: periphery dims, palette springs in.
  const openK = clamp(spring(t - T.open, 13, 8), 0, 1.04);
  focus(sc, w / 2, py + 200 * u, pw * 0.7, clamp((t - T.open) / 0.35) * (1 - ex));
  topHeadline(sc);

  // ⌘ K keycaps press before the palette opens.
  const capA = clamp(1 - range(t, T.open - 0.05, T.open + 0.2));
  if (t > 0.25 && capA > 0) {
    const ks = 100 * u * S;
    const appear = clamp(spring(t - 0.25, 12, 7), 0, 1.05);
    ctx.save();
    ctx.globalAlpha = clamp((t - 0.25) / 0.2) * capA;
    const cy = py + 150 * u;
    ctx.translate(w / 2, cy);
    ctx.scale(0.8 + 0.2 * appear, 0.8 + 0.2 * appear);
    ctx.translate(-w / 2, -cy);
    const pressA = clamp(1 - Math.abs(t - T.keyA - 0.06) / 0.12) + (t > T.keyA + 0.06 && t < T.open ? 0.6 : 0);
    const pressB = clamp(1 - Math.abs(t - T.keyB - 0.06) / 0.12);
    keycap(sc, "⌘", w / 2 - ks * 0.62, cy, ks, clamp(pressA));
    keycap(sc, "K", w / 2 + ks * 0.62, cy, ks, pressB);
    ctx.restore();
  }
  if (t < T.open) return;

  // Filtering: rows that stop matching collapse as the query types in.
  const typedN = clamp(Math.floor((t - T.typeStart) / T.cps) + 1, 0, T.q.length);
  const typed = t < T.typeStart ? "" : T.q.slice(0, typedN);
  const vis = items.map((label, i) => {
    if (i === 0) return 1;
    // When does this row stop matching?
    let dropAt = Infinity;
    for (let n = 3; n <= T.q.length; n++) {
      if (!label.toLowerCase().includes(T.q.slice(0, n))) {
        dropAt = T.typeStart + (n - 1) * T.cps;
        break;
      }
    }
    return 1 - ease.inOutCubic(range(t, dropAt, dropAt + 0.3));
  });
  const listH = vis.reduce((a, v) => a + v * rowH, 0);
  const ph = searchH + listH + 16 * u * S;
  const done = range(t, T.enter, T.enter + 0.25);

  // Once the command runs, the palette steps back so the result takes the stage.
  const settle = ease.inOutCubic(range(t, T.enter + 0.1, T.enter + 0.5));
  ctx.save();
  ctx.globalAlpha = clamp((t - T.open) / 0.18) * (1 - ex) * (1 - settle * 0.55);
  ctx.translate(w / 2, py);
  const sOpen = (0.94 + 0.06 * openK) * (1 - 0.03 * ease.outCubic(done)) * (1 - 0.06 * settle);
  ctx.scale(sOpen, sOpen);
  ctx.translate(-w / 2, -py);
  ctx.save();
  ctx.shadowColor = rgba(palette.primary, palette.light ? 0.18 : 0.35);
  ctx.shadowBlur = 60 * u;
  glassCard(sc, px, py, pw, ph, { r: 22 * u });
  ctx.restore();
  borderBeam(sc, px, py, pw, ph, t * 0.4, { r: 22 * u, alpha: 0.7 });

  // Search row with the typed query and a blinking caret.
  const fs = 30 * u * S;
  drawIcon(ctx, "Search", px + 40 * u * S, py + searchH / 2, 30 * u * S, rgba(palette.text, 0.6));
  ctx.font = subFont(fs, 500);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const qx = px + 76 * u * S;
  if (typed) {
    ctx.fillStyle = palette.text;
    ctx.fillText(typed, qx, py + searchH / 2);
  } else {
    ctx.fillStyle = rgba(palette.text, 0.4);
    ctx.fillText(brand?.name ? `Search ${brand.name}…` : "Type a command…", qx, py + searchH / 2);
  }
  const caretX = qx + (typed ? ctx.measureText(typed).width + 3 * u : 0);
  if (Math.floor(t * 2.4) % 2 === 0 || (t > T.typeStart && t < T.typeEnd + 0.2)) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(caretX, py + searchH / 2 - fs * 0.6, 3 * u, fs * 1.2);
  }
  // "esc" hint.
  ctx.font = subFont(15 * u * S, 600);
  ctx.textAlign = "right";
  ctx.fillStyle = rgba(palette.text, 0.35);
  ctx.fillText("esc", px + pw - 30 * u * S, py + searchH / 2);
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)";
  ctx.fillRect(px, py + searchH, pw, Math.max(1, u));

  // Results.
  const icons = iconsFor(items, sc);
  let y = py + searchH + 8 * u * S;
  items.forEach((label, i) => {
    const v = vis[i];
    if (v > 0.01) {
      const rowAppear = clamp((t - T.open - 0.08 - i * 0.05) / 0.2);
      ctx.save();
      ctx.globalAlpha *= v * rowAppear;
      ctx.beginPath();
      ctx.rect(px, y, pw, rowH * v);
      ctx.clip();
      const cy = y + rowH / 2;
      const selected = i === 0;
      if (selected) {
        ctx.beginPath();
        ctx.roundRect(px + 10 * u, y + 5 * u, pw - 20 * u, rowH - 10 * u, 14 * u);
        ctx.fillStyle = rgba(palette.primary, palette.light ? 0.1 : 0.16 + 0.22 * done);
        ctx.fill();
        ctx.fillStyle = palette.primary;
        ctx.fillRect(px + 10 * u, y + 16 * u, 4 * u, rowH - 32 * u);
      }
      iconTile(sc, icons[i], px + 46 * u * S, cy, 38 * u * S);
      ctx.font = subFont(25 * u * S, selected ? 600 : 500);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = selected ? palette.text : rgba(palette.text, 0.78);
      const lx = px + 82 * u * S;
      // Long labels shrink to stay on their row instead of running past it.
      const lfit = fitTextLines(ctx, label, pw - 230 * u * S, { maxLines: 2, minScale: 0.72 });
      ctx.font = lfit.font;
      const txt = lfit.lines[0];
      // Matched part of the label highlighted (a label too long for one line wraps onto two instead).
      const li = typed.length >= 2 && lfit.lines.length === 1 ? label.toLowerCase().indexOf(typed) : -1;
      if (lfit.lines.length > 1) lfit.lines.forEach((l, j) => ctx.fillText(l, lx, cy + (j - 0.5) * lfit.size * 1.05));
      else if (li >= 0) {
        const pre = txt.slice(0, li);
        const mid = txt.slice(li, li + typed.length);
        ctx.fillText(pre, lx, cy);
        const mx = lx + ctx.measureText(pre).width;
        // Matched characters: full-strength text over an accent underline (reads on any row fill).
        const mw = ctx.measureText(mid).width;
        ctx.fillStyle = palette.text;
        ctx.fillText(mid, mx, cy);
        ctx.fillStyle = palette.accent;
        ctx.fillRect(mx, cy + 16 * u * S, mw, 3 * u * S);
        ctx.fillStyle = selected ? palette.text : rgba(palette.text, 0.78);
        ctx.fillText(txt.slice(li + typed.length), mx + ctx.measureText(mid).width, cy);
      } else ctx.fillText(txt, lx, cy);
      // Shortcut hint / return key on the selected row.
      ctx.textAlign = "right";
      ctx.font = subFont(16 * u * S, 600);
      ctx.fillStyle = rgba(palette.text, 0.4);
      if (selected) {
        const press = clamp(1 - Math.abs(t - T.enter) / 0.12);
        pill(sc, "↵", px + pw - 50 * u * S, cy + press * 2 * u, { size: 18 * u * S, fill: press > 0.2 ? rgba(palette.primary, 0.5) : undefined, padX: 14 * u * S });
      } else ctx.fillText(["⌘ 1", "⌘ 2", "⌘ 3", "⌘ 4", "⌘ 5"][i], px + pw - 30 * u * S, cy);
      ctx.restore();
    }
    y += rowH * v;
  });
  ctx.restore();

  // Enter → the result card springs up out of the selected row.
  const lt = t - T.toast;
  if (lt > 0) {
    const k = clamp(spring(lt, 11, 7), 0, 1.06);
    const tw = Math.min(pw * 0.86, 900 * u * S);
    // A long command name takes two lines; the card grows to hold them.
    const ic = 64 * u * S;
    const titleW = tw - (30 * u * S + ic + 24 * u * S) - 110 * u * S;
    ctx.font = subFont(32 * u * S, 700);
    const tfit = fitTextLines(ctx, items[0], titleW, { maxLines: 2, minScale: 0.75 });
    const extra = (tfit.lines.length - 1) * tfit.size * 0.55;
    const th = 118 * u * S + extra * 1.6;
    const tx = w / 2 - tw / 2;
    const rowY = py + searchH + 8 * u * S;
    const ty = lerp(rowY, py + ph + 56 * u * S, Math.min(1, k));
    ctx.save();
    ctx.globalAlpha = clamp(lt / 0.15) * (1 - ex);
    ctx.translate(w / 2, ty + th / 2);
    ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    ctx.translate(-w / 2, -(ty + th / 2));
    ctx.save();
    ctx.shadowColor = rgba(palette.accent, palette.light ? 0.2 : 0.4);
    ctx.shadowBlur = 50 * u;
    glassCard(sc, tx, ty, tw, th, { r: 26 * u * S });
    ctx.restore();
    borderBeam(sc, tx, ty, tw, th, t * 0.5, { r: 26 * u * S, color: palette.accent, alpha: 0.8 });
    iconTile(sc, icons[0], tx + 30 * u * S + ic / 2, ty + th / 2, ic, ease.outCubic(range(lt, 0.1, 0.7)));
    const lx = tx + 30 * u * S + ic + 24 * u * S;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.text;
    ctx.font = subFont(32 * u * S, 700);
    fillTextFit(ctx, items[0], lx, ty + th / 2 - 16 * u * S - extra, titleW, { maxLines: 2, lineHeight: 1.05, minScale: 0.75 });
    ctx.fillStyle = rgba(palette.text, 0.55);
    ctx.font = subFont(20 * u * S, 500);
    ctx.fillText("Done · just now", lx, ty + th / 2 + 22 * u * S + extra * 0.6);
    checkBadge(sc, tx + tw - 58 * u * S, ty + th / 2, 26 * u * S, (lt - 0.1) / 0.5);
    ctx.restore();
  }
}

/* ───────────────────────── AI prompt → streamed answer ───────────────────────── */

function aiContent(scene: Scene, brandName?: string) {
  const items = (scene.items ?? []).filter(Boolean);
  const prompt = items[0] ?? `What can you do, ${brandName ?? "AI"}?`;
  const bullets = items.slice(1, 4).map(titleOf);
  // The answer is the lead line (e.g. the product describing itself) plus up to three points.
  if (scene.subtext) return { prompt, bullets, lead: scene.subtext };
  return { prompt, bullets: bullets.length ? bullets : ["Summarise the thread", "Draft the reply", "Schedule the follow-up"], lead: "Here's how I can help:" };
}

function aiTiming(scene: Scene, d: number) {
  const { prompt, bullets, lead } = aiContent(scene);
  const typeStart = 0.6;
  const typeDur = Math.min(1.3, Math.max(0.6, prompt.length / 32));
  const send = typeStart + typeDur + 0.2;
  const think = send + 0.25;
  const stream = think + 0.55;
  const words = [lead, ...bullets].join(" ").split(/\s+/).length;
  const wps = Math.max(14, words / Math.max(1, d - 0.9 - stream));
  return { typeStart, typeDur, send, think, stream, wps, end: stream + words / wps };
}

function aiPrompt(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  topHeadline(sc);
  const portrait = isPortrait(sc);
  const S = portrait ? 1.4 : 1.35;
  const { prompt, bullets, lead } = aiContent(scene, brand?.name);
  const T = aiTiming(scene, d);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const pw = portrait ? w * 0.9 : Math.min(w * 0.68, 1320 * u);
  // The panel fits its conversation (no dead space under a short answer).
  const estimate = () => {
    const pad0 = 30 * u * S;
    const fs0 = 25 * u * S;
    const lineH = fs0 * 1.42;
    ctx.font = subFont(fs0, 500);
    const tw = pw - pad0 * 2 - 56 * u * S;
    const bubble = Math.min(2, wrap(ctx, prompt, pw * 0.68 - 44 * u * S).length) * fs0 * 1.35 + 30 * u * S;
    const leadLines = Math.min(3, wrap(ctx, lead, tw).length);
    const bulletLines = bullets.reduce((a, b) => a + Math.min(2, wrap(ctx, b, tw - 40 * u * S).length), 0);
    return pad0 + bubble + 22 * u * S + 20 * u * S + (leadLines + bulletLines) * lineH + fs0 * 0.35 + 74 * u * S + pad0 * 1.6;
  };
  const ph = clamp(estimate(), h * 0.34, portrait ? h * 0.56 : h * 0.62);
  const px = (w - pw) / 2;
  const py = portrait ? h * 0.29 : Math.max(h * 0.28, h * 0.6 - ph / 2);
  const k0 = clamp(spring(t - 0.25, 10, 7), 0, 1.05);
  if (t < 0.25) return;
  focus(sc, w / 2, py + ph / 2, pw * 0.6, clamp((t - T.think) / 0.4) * 0.8 * (1 - ex));

  ctx.save();
  ctx.globalAlpha = clamp((t - 0.25) / 0.25) * (1 - ex);
  ctx.translate(w / 2, py + ph / 2 + (1 - Math.min(1, k0)) * 50 * u);
  ctx.scale(0.94 + 0.06 * k0, 0.94 + 0.06 * k0);
  ctx.translate(-w / 2, -(py + ph / 2));
  ctx.save();
  ctx.shadowColor = rgba(palette.primary, palette.light ? 0.15 : 0.3);
  ctx.shadowBlur = 60 * u;
  glassCard(sc, px, py, pw, ph, { r: 24 * u });
  ctx.restore();
  if (t > T.stream) borderBeam(sc, px, py, pw, ph, t * 0.45, { r: 24 * u, alpha: 0.85 });

  const pad = 30 * u * S;
  const fs = 25 * u * S;
  // Composer at the bottom: the prompt types in, then is sent.
  const barH = 74 * u * S;
  const barY = py + ph - barH - pad * 0.7;
  ctx.beginPath();
  ctx.roundRect(px + pad * 0.7, barY, pw - pad * 1.4, barH, barH / 2);
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.strokeStyle = t > T.typeStart && t < T.send ? rgba(palette.primary, 0.7) : palette.light ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = Math.max(1, 1.5 * u);
  ctx.stroke();
  drawIcon(ctx, "Sparkles", px + pad * 0.7 + barH / 2, barY + barH / 2, 26 * u * S, palette.primary);
  const nChars = Math.floor(prompt.length * clamp((t - T.typeStart) / T.typeDur));
  ctx.font = subFont(fs, 500);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const inX = px + pad * 0.7 + barH * 0.95;
  const inW = pw - pad * 1.4 - barH * 2;
  if (t < T.send && nChars > 0) {
    const shown = prompt.slice(0, nChars);
    let txt = shown;
    while (txt.length > 1 && ctx.measureText(txt).width > inW) txt = txt.slice(1);
    ctx.fillStyle = palette.text;
    ctx.fillText(txt, inX, barY + barH / 2);
    ctx.fillStyle = palette.primary;
    ctx.fillRect(inX + ctx.measureText(txt).width + 3 * u, barY + barH / 2 - fs * 0.6, 3 * u, fs * 1.2);
  } else {
    ctx.fillStyle = rgba(palette.text, 0.38);
    ctx.fillText(ellipsize(ctx, brand?.name ? `Ask ${brand.name} anything…` : "Ask anything…", inW), inX, barY + barH / 2);
  }
  // Send button.
  const sbx = px + pw - pad * 0.7 - barH / 2;
  const sby = barY + barH / 2;
  const sendPress = clamp(1 - Math.abs(t - T.send) / 0.12);
  const ready = t > T.typeStart + T.typeDur * 0.5 && t < T.send + 0.1;
  ctx.beginPath();
  ctx.arc(sbx, sby, barH * 0.34 * (1 - sendPress * 0.12), 0, TAU);
  ctx.fillStyle = ready ? palette.primary : rgba(palette.text, 0.18);
  ctx.fill();
  drawIcon(ctx, "ArrowUp", sbx, sby, barH * 0.36, ready ? (palette.light ? "#fff" : palette.bg0) : rgba(palette.text, 0.6));
  clickRipple(sc, sbx, sby, range(t, T.send, T.send + 0.45));

  // Conversation: the user's bubble, then the assistant streaming.
  let y = py + pad;
  if (t > T.send) {
    const k = clamp(spring(t - T.send, 13, 8), 0, 1.05);
    ctx.font = subFont(fs, 500);
    const maxBW = pw * 0.68;
    const lines = wrapClamp(ctx, prompt, maxBW - 44 * u * S, 2);
    const bw = Math.min(maxBW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44 * u * S);
    const bh = lines.length * fs * 1.35 + 30 * u * S;
    const bx = px + pw - pad - bw;
    ctx.save();
    ctx.globalAlpha *= clamp((t - T.send) / 0.15);
    ctx.translate(0, (1 - Math.min(1, k)) * (barY - y) * 0.5);
    ctx.beginPath();
    ctx.roundRect(bx, y, bw, bh, [20 * u * S, 20 * u * S, 6 * u * S, 20 * u * S]);
    const g = ctx.createLinearGradient(bx, y, bx + bw, y + bh);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = palette.light ? "#ffffff" : palette.bg0;
    ctx.textAlign = "left";
    lines.forEach((l, i) => ctx.fillText(l, bx + 22 * u * S, y + 15 * u * S + fs * 0.68 + i * fs * 1.35));
    ctx.restore();
    y += bh + 22 * u * S;
  }
  if (t > T.think) {
    const av = 40 * u * S;
    const ax = px + pad + av / 2;
    const ay = y + av / 2;
    ctx.beginPath();
    ctx.arc(ax, ay, av / 2, 0, TAU);
    const g = ctx.createLinearGradient(ax - av / 2, ay - av / 2, ax + av / 2, ay + av / 2);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.fillStyle = g;
    ctx.fill();
    drawIcon(ctx, "Sparkles", ax, ay, av * 0.55, palette.light ? "#fff" : palette.bg0);
    const tx = px + pad + av + 16 * u * S;
    const tw = pw - (tx - px) - pad;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (t < T.stream) {
      // Shimmering "Thinking…".
      ctx.font = subFont(fs, 600);
      const label = "Thinking…";
      const lw = ctx.measureText(label).width;
      const sx = tx + ((t - T.think) / 0.55) * lw * 1.6 - lw * 0.3;
      const sg = ctx.createLinearGradient(sx - lw * 0.4, 0, sx + lw * 0.4, 0);
      sg.addColorStop(0, rgba(palette.text, 0.35));
      sg.addColorStop(0.5, palette.text);
      sg.addColorStop(1, rgba(palette.text, 0.35));
      ctx.fillStyle = sg;
      ctx.fillText(label, tx, ay);
    } else {
      // Stream the answer word by word with a block caret at the head.
      let budget = Math.floor((t - T.stream) * T.wps);
      const blocks = [lead, ...bullets];
      let cy = ay;
      let headX = tx;
      let headY = ay;
      const lineH = fs * 1.42;
      for (let bi = 0; bi < blocks.length && budget > 0; bi++) {
        const isBullet = bi > 0;
        const bxOff = isBullet ? 40 * u * S : 0;
        ctx.font = subFont(fs, isBullet || !bullets.length ? 500 : 600);
        const lines = wrapClamp(ctx, blocks[bi], tw - bxOff, bi === 0 ? 3 : 2);
        if (isBullet) {
          const k = clamp(budget / 2);
          checkBadge(sc, tx + 13 * u * S, cy, 12 * u * S, k * 0.6);
        }
        for (const line of lines) {
          if (budget <= 0) break;
          const wds = line.split(" ");
          const shown = wds.slice(0, budget).join(" ");
          budget -= wds.length;
          ctx.fillStyle = isBullet ? rgba(palette.text, 0.86) : palette.text;
          ctx.fillText(shown, tx + bxOff, cy);
          headX = tx + bxOff + ctx.measureText(shown).width;
          headY = cy;
          cy += lineH;
        }
        if (bi === 0) cy += fs * 0.35;
        if (cy > barY - lineH * 0.4) break;
      }
      if (t < T.end + 0.3) {
        ctx.fillStyle = palette.primary;
        ctx.globalAlpha *= Math.floor(t * 4) % 2 ? 0.4 : 1;
        ctx.fillRect(headX + 6 * u, headY - fs * 0.5, fs * 0.5, fs);
      }
    }
  }
  ctx.restore();
}

/* ───────────────────────── One-click flow ───────────────────────── */

function flowItems(scene: Scene) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 5);
  return items.length >= 2 ? items : ["Sync your data", "Update your records", "Notify the team", "Generate the report"];
}

function flowTiming(scene: Scene, beat: number) {
  const n = flowItems(scene).length;
  const click = 1.6;
  const start = click + 0.3;
  const st = Math.max(0.17, Math.min(0.28, beat / 2));
  const rows = Array.from({ length: n }, (_, i) => start + i * st);
  const done = rows[n - 1] + 0.15;
  return { arrive: 0.55, click, start, rows, done, badge: done + 0.25 };
}

function clickFlow(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand, beat } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = isPortrait(sc);
  const S = portrait ? 1.35 : 1.4;
  const items = flowItems(scene);
  const T = flowTiming(scene, beat);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const n = items.length;
  const rowH = 70 * u * S;
  const headH = 92 * u * S;
  const ww = portrait ? w * 0.9 : Math.min(w * 0.64, 1240 * u);
  const wh = 46 * u + headH + n * rowH + 26 * u * S;
  const wx = (w - ww) / 2;
  const wy = portrait ? Math.max(h * 0.27, h * 0.56 - wh / 2) : Math.max(h * 0.28, h * 0.58 - wh / 2);
  const label = (scene.subtext ?? "Run").slice(0, 18);

  // Button geometry (needed for the camera and cursor).
  ctx.font = subFont(22 * u * S, 700);
  const bw = ctx.measureText(label).width + 84 * u * S;
  const bh = 52 * u * S;
  const bx = wx + ww - 28 * u * S - bw;
  const by = wy + 46 * u + (headH - bh) / 2;
  const bcx = bx + bw / 2;
  const bcy = by + bh / 2;

  // Micro-zoom toward the button before the click, easing back as work completes.
  const zIn = ease.inOutCubic(range(t, 0.8, T.click));
  const zOut = ease.inOutCubic(range(t, T.start + 0.1, T.done + 0.3));
  const z = 1 + 0.09 * zIn * (1 - zOut);
  focus(sc, bcx, bcy, ww * 0.55, zIn * (1 - zOut) * (1 - ex));
  topHeadline(sc);
  const k0 = clamp(spring(t - 0.15, 10, 7), 0, 1.05);
  ctx.save();
  ctx.globalAlpha = clamp((t - 0.15) / 0.25) * (1 - ex);
  ctx.translate(bcx, bcy);
  ctx.scale(z, z);
  ctx.translate(-bcx, -bcy);
  ctx.translate(0, (1 - Math.min(1, k0)) * 60 * u);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.domain ?? brand?.name ?? "app");

  // Header: title and the primary button.
  ctx.fillStyle = palette.text;
  ctx.font = subFont(28 * u * S, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const allDone = t > T.done;
  const count = T.rows.filter((r) => t > r).length;
  fillTextFit(ctx, brand?.name ?? "Workflow", wx + 30 * u * S, top + headH / 2 - 12 * u * S, bx - wx - 200 * u * S, { maxLines: 1, minScale: 0.6 });
  ctx.font = subFont(17 * u * S, 500);
  ctx.fillStyle = rgba(palette.text, 0.55);
  ctx.fillText(allDone ? `${n} of ${n} complete` : t > T.start ? `Running… ${count} of ${n}` : `${n} tasks ready`, wx + 30 * u * S, top + headH / 2 + 18 * u * S);
  const press = clamp(1 - Math.abs(t - T.click) / 0.1);
  ctx.save();
  ctx.translate(bcx, bcy);
  ctx.scale(1 - press * 0.06, 1 - press * 0.06);
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 12 * u * S);
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.fillStyle = g;
  ctx.shadowColor = rgba(palette.primary, 0.55);
  ctx.shadowBlur = (18 + 24 * press) * u;
  ctx.fill();
  ctx.shadowBlur = 0;
  const fg = palette.light ? "#ffffff" : palette.bg0;
  drawIcon(ctx, allDone ? "Check" : "Play", -bw / 2 + 30 * u * S, 0, 22 * u * S, fg);
  ctx.fillStyle = fg;
  ctx.font = subFont(22 * u * S, 700);
  ctx.textAlign = "left";
  ctx.fillText(label, -bw / 2 + 50 * u * S, 1 * u);
  ctx.restore();

  // Progress bar under the header fills fast (time compression: no loading states).
  const prog = ease.outCubic(range(t, T.start - 0.1, T.done));
  const pby = top + headH - 3 * u;
  ctx.fillStyle = palette.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)";
  ctx.fillRect(wx, pby, ww, 3 * u);
  if (prog > 0) {
    const pg = ctx.createLinearGradient(wx, 0, wx + ww, 0);
    pg.addColorStop(0, palette.primary);
    pg.addColorStop(1, palette.accent);
    ctx.fillStyle = pg;
    ctx.fillRect(wx, pby, ww * prog, 3 * u);
  }

  // Task rows tick off in a cascade.
  const icons = iconsFor(items, sc);
  items.forEach((item, i) => {
    const ry = top + headH + i * rowH;
    const cy = ry + rowH / 2;
    const appear = clamp((t - 0.35 - i * 0.06) / 0.25);
    const doneK = t - T.rows[i];
    ctx.save();
    ctx.globalAlpha *= appear;
    if (i > 0) {
      ctx.fillStyle = palette.light ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(wx + 24 * u, ry, ww - 48 * u, Math.max(1, u));
    }
    if (doneK > 0 && doneK < 0.5) {
      ctx.fillStyle = rgba(palette.accent, 0.12 * (1 - doneK / 0.5));
      ctx.fillRect(wx + 1, ry + 1, ww - 2, rowH - 2);
    }
    const sx = wx + 44 * u * S;
    const r = 14 * u * S;
    if (doneK > 0) checkBadge(sc, sx, cy, r, doneK / 0.45);
    else if (t > T.rows[i] - 0.3 && t > T.start) {
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(sx, cy, r, t * 9, t * 9 + TAU * 0.7);
      ctx.stroke();
    } else {
      ctx.strokeStyle = rgba(palette.text, 0.3);
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(sx, cy, r, 0, TAU);
      ctx.stroke();
    }
    drawIcon(ctx, icons[i], wx + 88 * u * S, cy, 26 * u * S, rgba(palette.text, 0.65));
    ctx.fillStyle = doneK > 0 ? palette.text : rgba(palette.text, 0.82);
    ctx.font = subFont(24 * u * S, 500);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, item, wx + 116 * u * S, cy, ww - 300 * u * S, { maxLines: 2, lineHeight: 1.08, minScale: 0.8 });
    pill(sc, doneK > 0 ? "Done" : "Queued", wx + ww - 76 * u * S, cy, {
      size: 15 * u * S,
      fill: doneK > 0 ? rgba(palette.accent, 0.2) : undefined,
      color: doneK > 0 ? (palette.light ? palette.text : palette.accent) : rgba(palette.text, 0.55),
      border: doneK > 0 ? rgba(palette.accent, 0.5) : undefined,
    });
    ctx.restore();
  });

  // The cursor glides in, clicks, then drifts away.
  if (t > T.arrive - 0.35) {
    const k = range(t, T.arrive - 0.35, T.click - 0.12);
    const p = cursorPath(wx + ww * 0.75, wy + wh + 120 * u, bcx + bw * 0.12, bcy + bh * 0.15, k);
    const away = ease.inOutCubic(range(t, T.click + 0.25, T.click + 1));
    clickRipple(sc, bcx + bw * 0.12, bcy + bh * 0.15, range(t, T.click, T.click + 0.5));
    ctx.save();
    ctx.globalAlpha *= clamp((t - T.arrive + 0.35) / 0.2) * (1 - away);
    drawCursor(sc, p.x + away * 60 * u, p.y + away * 90 * u, press, S);
    ctx.restore();
  }
  ctx.restore();

  // Completion badge.
  const lt = t - T.badge;
  if (lt > 0) {
    const k = clamp(spring(lt, 13, 7), 0, 1.1);
    ctx.save();
    ctx.globalAlpha = clamp(lt / 0.15) * (1 - ex);
    const cx = w / 2;
    const cy = wy + wh + (portrait ? 70 : 48) * u;
    ctx.translate(cx, cy);
    ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
    pill(sc, "✓  Done", 0, 0, {
      size: 22 * u * S,
      weight: 700,
      fill: rgba(palette.accent, palette.light ? 0.16 : 0.22),
      border: rgba(palette.accent, 0.6),
      color: palette.light ? palette.text : "#ffffff",
    });
    ctx.restore();
  }
}

/* ───────────────────────── Notification stack ───────────────────────── */

function notifyItems(scene: Scene) {
  const items = (scene.items ?? []).filter(Boolean).slice(0, 5);
  return items.length >= 2 ? items : ["New signup — Someone just joined your workspace", "Report ready — Your weekly summary is in", "Task complete — Marked done by the team"];
}

function notifyTiming(scene: Scene, beat: number) {
  const n = notifyItems(scene).length;
  const st = Math.max(0.42, Math.min(0.62, beat * 1.1));
  return Array.from({ length: n }, (_, i) => 0.45 + i * st);
}

function notifyStack(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand, beat } = sc;
  saasBackground(sc, { beams: 2 });
  topHeadline(sc);
  const portrait = isPortrait(sc);
  const S = portrait ? 1.4 : 1.3;
  const items = notifyItems(scene);
  const times = notifyTiming(scene, beat);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const nw = portrait ? w * 0.9 : Math.min(w * 0.56, 1000 * u);
  const nh = 104 * u * S;
  const gap = 16 * u * S;
  const x = (w - nw) / 2;
  const y0 = portrait ? h * 0.36 : h * 0.31;
  const icons = items.map((it, i) => iconFor(`${titleOf(it)} ${descOf(it)}`, i, sc));
  // Newest on top: each arrival pushes the stack down; older cards recede.
  const arrived = times.filter((tt) => t > tt).length;
  for (let i = items.length - 1; i >= 0; i--) {
    const lt = t - times[i];
    if (lt <= 0) continue;
    const k = clamp(spring(lt, 12, 7), 0, 1.08);
    // Slots below this card = cards that arrived after it (animated).
    let depth = 0;
    for (let j = i + 1; j < items.length; j++) depth += ease.outCubic(clamp((t - times[j]) / 0.35));
    const maxShown = portrait ? 4 : 3.2;
    const recede = clamp(depth / maxShown);
    const y = y0 + depth * (nh + gap) * (1 - recede * 0.12) + (1 - Math.min(1, k)) * -nh * 0.9;
    const scale = (0.9 + 0.1 * Math.min(1, k)) * (1 - recede * 0.06);
    const alpha = clamp(lt / 0.18) * (1 - clamp((depth - maxShown + 0.6) / 0.8)) * (1 - ex);
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, y + nh / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -(y + nh / 2));
    ctx.save();
    ctx.shadowColor = palette.light ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 30 * u;
    ctx.shadowOffsetY = 10 * u;
    glassCard(sc, x, y, nw, nh, { r: 26 * u * S });
    ctx.restore();
    if (i === arrived - 1) borderBeam(sc, x, y, nw, nh, t * 0.5, { r: 26 * u * S, alpha: 0.6 });
    const ic = 58 * u * S;
    // The icon sits an equal distance from the card's left, top and bottom edges.
    const inset = (nh - ic) / 2;
    iconTile(sc, icons[i], x + inset + ic / 2, y + nh / 2, ic, ease.outCubic(range(lt, 0.1, 0.7)));
    const tx = x + inset + ic + 20 * u * S;
    const maxW = nw - (tx - x) - 90 * u * S;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const title = titleOf(items[i]);
    const desc = descOf(items[i]);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(23 * u * S, 700);
    const titleY = y + nh / 2 - (desc ? 15 * u * S : 0);
    ctx.textBaseline = "alphabetic";
    const titleBase = titleY + ctx.measureText("H").actualBoundingBoxAscent / 2;
    ctx.textBaseline = "middle";
    fillTextFit(ctx, title, tx, titleY, maxW, { maxLines: 1, minScale: 0.75 });
    if (desc) {
      ctx.fillStyle = rgba(palette.text, 0.62);
      ctx.font = subFont(19 * u * S, 500);
      fillTextFit(ctx, desc, tx, y + nh / 2 + 17 * u * S, maxW + 60 * u * S, { maxLines: 1, minScale: 0.75 });
    }
    ctx.textAlign = "right";
    ctx.fillStyle = rgba(palette.text, 0.42);
    ctx.font = subFont(16 * u * S, 500);
    // The time shares the title's baseline, inset from the right like the icon is from the left.
    ctx.textBaseline = "alphabetic";
    ctx.fillText(i === arrived - 1 ? "now" : `${Math.max(1, Math.round((arrived - 1 - i) * 2))}m ago`, x + nw - inset, titleBase);
    ctx.restore();
  }
  // App name tag under the stack.
  if (brand?.name && t > 0.3) {
    ctx.save();
    ctx.globalAlpha = clamp((t - 0.3) / 0.3) * (1 - ex) * 0.8;
    ctx.fillStyle = rgba(palette.text, 0.5);
    ctx.font = subFont(17 * u * S, 600);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Notifications from ${brand.name}`, w / 2, y0 - 26 * u);
    ctx.restore();
  }
}

/* ───────────────────────── Growth chart ───────────────────────── */

function chartStat(scene: Scene) {
  const src = scene.subtext && /\d/.test(scene.subtext) ? scene.subtext : (scene.items ?? []).find((x) => /\d/.test(x)) ?? "10,000+ teams";
  return { src, ...parseStat(src) };
}

function chartTiming() {
  return { count0: 0.45, count1: 2.1, draw0: 0.5, draw1: 2.2, tip: 2.25 };
}

/** Deterministic growth curve, 0..1 over x 0..1, with gentle organic wobble. */
function growth(x: number, seed: number) {
  const base = (Math.exp(2.6 * x) - 1) / (Math.exp(2.6) - 1);
  const wob = Math.sin(x * 17 + seed) * 0.035 + Math.sin(x * 7.3 + seed * 1.7) * 0.03;
  return clamp(base * 0.86 + 0.08 + wob * (1 - x * 0.7), 0.02, 1);
}

function chartGrow(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, seed } = sc;
  saasBackground(sc, { beams: 2 });
  topHeadline(sc);
  const portrait = isPortrait(sc);
  const S = portrait ? 1.3 : 1.15;
  const T = chartTiming();
  const stat = chartStat(scene);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const cw = portrait ? w * 0.9 : Math.min(w * 0.84, 1600 * u);
  const ch = portrait ? h * 0.58 : h * 0.6;
  const cx0 = (w - cw) / 2;
  const cy0 = portrait ? h * 0.3 : h * 0.3;
  if (t < 0.2) return;
  const k0 = clamp(spring(t - 0.2, 10, 7), 0, 1.05);
  ctx.save();
  ctx.globalAlpha = clamp((t - 0.2) / 0.25) * (1 - ex);
  ctx.translate(w / 2, cy0 + ch / 2 + (1 - Math.min(1, k0)) * 50 * u);
  ctx.scale(0.94 + 0.06 * k0, 0.94 + 0.06 * k0);
  ctx.translate(-w / 2, -(cy0 + ch / 2));
  glassCard(sc, cx0, cy0, cw, ch, { r: 26 * u });

  // The number counts up (fast start, soft landing).
  const pad = 44 * u * S;
  const count = ease.outExpo(range(t, T.count0, T.count1));
  const v = stat.value * count;
  const numTxt = `${stat.prefix}${stat.decimals ? v.toFixed(stat.decimals) : Math.round(v).toLocaleString("en-US")}${stat.suffix}`;
  const finalTxt = `${stat.prefix}${stat.decimals ? stat.value.toFixed(stat.decimals) : Math.round(stat.value).toLocaleString("en-US")}${stat.suffix}`;
  const numW = portrait ? cw - pad * 2 : cw * 0.36;
  let fs = 150 * u * S;
  ctx.font = `800 ${Math.round(fs)}px Inter, sans-serif`;
  const fw = ctx.measureText(finalTxt).width;
  if (fw > numW) fs *= numW / fw;
  ctx.font = `800 ${Math.round(fs)}px Inter, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const nx = cx0 + pad;
  const ny = portrait ? cy0 + pad + fs * 0.85 : cy0 + ch * 0.46;
  const g = ctx.createLinearGradient(nx, ny - fs, nx + fw, ny);
  g.addColorStop(0, palette.primary);
  g.addColorStop(1, palette.secondary);
  ctx.fillStyle = g;
  ctx.fillText(numTxt, nx, ny);
  ctx.fillStyle = rgba(palette.text, 0.68);
  ctx.font = subFont(28 * u * S, 600);
  const label = stat.label ? stat.label.charAt(0).toUpperCase() + stat.label.slice(1) : "and counting";
  fillTextFit(ctx, label, nx, ny + 46 * u * S, numW, { maxLines: 1, minScale: 0.72 });
  // Area chart draws on from the left with a glowing head.
  const gx = portrait ? cx0 + pad : cx0 + cw * 0.42;
  const gy = portrait ? ny + 160 * u * S : cy0 + pad * 1.2;
  const gw = portrait ? cw - pad * 2 : cw * 0.58 - pad;
  const gh = portrait ? cy0 + ch - pad - gy : ch - pad * 2.2;
  ctx.strokeStyle = palette.light ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)";
  ctx.lineWidth = Math.max(1, u);
  for (let i = 0; i <= 4; i++) {
    const yy = gy + (gh * i) / 4;
    ctx.beginPath();
    ctx.moveTo(gx, yy);
    ctx.lineTo(gx + gw, yy);
    ctx.stroke();
  }
  const prog = ease.inOutCubic(range(t, T.draw0, T.draw1));
  const N = 90;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N * prog; i++) {
    const x = i / N;
    pts.push([gx + x * gw, gy + gh - growth(x, seed % 97) * gh * 0.92]);
  }
  if (pts.length > 1) {
    const [hx, hy] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], gy + gh);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(hx, gy + gh);
    ctx.closePath();
    const ag = ctx.createLinearGradient(0, gy, 0, gy + gh);
    ag.addColorStop(0, rgba(palette.primary, palette.light ? 0.22 : 0.35));
    ag.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    const lg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
    lg.addColorStop(0, palette.secondary);
    lg.addColorStop(1, palette.primary);
    ctx.strokeStyle = lg;
    ctx.lineWidth = 4.5 * u * S;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = rgba(palette.primary, 0.6);
    ctx.shadowBlur = 16 * u;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const pulse = 1 + Math.sin(t * 6) * 0.15;
    ctx.beginPath();
    ctx.arc(hx, hy, 18 * u * S * pulse, 0, TAU);
    ctx.fillStyle = rgba(palette.primary, 0.22);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, 8 * u * S, 0, TAU);
    ctx.fillStyle = palette.light ? palette.primary : "#ffffff";
    ctx.fill();
    // Tooltip on the final point.
    const lt = t - T.tip;
    if (lt > 0) {
      const k = clamp(spring(lt, 13, 7), 0, 1.1);
      ctx.save();
      ctx.translate(hx - 10 * u, hy - 46 * u * S);
      ctx.scale(k, k);
      ctx.font = subFont(20 * u * S, 700);
      const tw = ctx.measureText(finalTxt).width + 36 * u * S;
      const th = 44 * u * S;
      ctx.beginPath();
      ctx.roundRect(-tw + 20 * u, -th / 2, tw, th, 12 * u);
      ctx.fillStyle = palette.light ? "#111827" : "#ffffff";
      ctx.fill();
      ctx.fillStyle = palette.light ? "#ffffff" : "#0b0d12";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fillTextMid(ctx, finalTxt, -tw / 2 + 20 * u, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

/* ───────── registry ───────── */

export const interactionSkills: Skill[] = [
  {
    id: "command-k",
    name: "Command Palette",
    tagline: "⌘K keycaps press, a command palette opens over a dimmed stage, a query types in, results filter live and Enter runs it.",
    bestFor: "Keyboard-first and power-user products (dev tools, productivity). Headline = the promise ('Your tools, one *keystroke* away'); items = 3–5 commands or features, the first is the one that runs.",
    sample: { text: "Your tools, one *keystroke* away", items: ["Deploy to production", "Create issue", "Invite teammate", "Search docs"] },
    itemsHint: "3–5 commands; the first one runs",
    render: commandK,
    sfx: (scene) => {
      const T = commandTiming(scene);
      return [
        at(T.keyA, "key"),
        at(T.keyB, "key"),
        at(T.open, "swoosh"),
        ...Array.from({ length: T.q.length }, (_, i) => at(T.typeStart + i * T.cps, "key")),
        at(T.enter, "key"),
        at(T.toast, "success"),
      ];
    },
  },
  {
    id: "ai-prompt",
    name: "AI Prompt",
    tagline: "A prompt types into an AI composer and is sent; the assistant thinks with a shimmer, then its answer streams in word by word.",
    bestFor: "AI products and AI features. Headline = the promise; items[0] = the prompt the user types, items[1..3] = answer points (use real features); subtext = the answer's lead line.",
    sample: { text: "Just *ask*.", subtext: "Here's how I can help:", items: ["Summarise this week's customer calls", "Top 3 requests: SSO, exports, dark mode", "Churn risk flagged for 2 accounts", "Follow-ups drafted for your review"] },
    itemsHint: "prompt, then 2–3 answer points",
    render: aiPrompt,
    sfx: (scene, beat) => {
      void beat;
      const T = aiTiming(scene, scene.duration);
      const keys = Math.min(8, Math.round(T.typeDur / 0.14));
      return [
        ...Array.from({ length: keys }, (_, i) => at(T.typeStart + (i * T.typeDur) / keys, "key")),
        at(T.send, "click"),
        at(T.stream, "shimmer"),
        at(Math.min(scene.duration - 0.3, T.end), "success"),
      ];
    },
  },
  {
    id: "click-flow",
    name: "One-Click Flow",
    tagline: "A cursor glides to the primary button behind a micro-zoom; one click and every task ticks off in a fast cascade.",
    bestFor: "Automation and 'it just works' moments. Headline = the outcome; subtext = the button label ('Run', 'Deploy', 'Approve'); items = 3–5 tasks it completes (real features).",
    sample: { text: "Busywork, *handled*", subtext: "Run", items: ["Match receipts", "Categorise expenses", "Sync to accounting", "Notify finance"] },
    itemsHint: "3–5 tasks it completes",
    render: clickFlow,
    sfx: (scene, beat) => {
      const T = flowTiming(scene, beat);
      return [at(0.15, "swoosh"), at(T.click, "click"), ...T.rows.map((r) => at(r, "tick")), at(T.badge, "success")];
    },
  },
  {
    id: "notify-stack",
    name: "Notification Stack",
    tagline: "App notifications drop into an iOS-style stack, newest on top, each with an icon, title and detail.",
    bestFor: "Showing the product alive and working for you (sales, e-commerce, security, messaging). items = 3–5 notifications, each 'Title — detail'.",
    sample: { text: "Your store, *in real time*", items: ["New order — 2 × Linen shirt, shipped today", "Payment received — Invoice #1042 paid", "Low stock — Reorder drafted", "New review — From a customer"] },
    itemsHint: "3–5 notifications, 'Title — detail'",
    render: notifyStack,
    sfx: (scene, beat) => notifyTiming(scene, beat).map((s) => at(s, "pop")),
  },
  {
    id: "chart-grow",
    name: "Growth Chart",
    tagline: "A real number counts up beside an area chart that draws itself on, with a glowing head and a tooltip.",
    bestFor: "One REAL metric from the site, only when claims are allowed ('30,000+ businesses'). Headline = neutral ('Your numbers, *at a glance*'); subtext = the stat.",
    sample: { text: "Your numbers, *at a glance*", subtext: "Monthly active projects" },
    render: chartGrow,
    sfx: () => {
      const T = chartTiming();
      return [...Array.from({ length: 9 }, (_, i) => at(T.count0 + i * 0.13, "tick")), at(T.tip, "shimmer")];
    },
  },
];
