/**
 * Typographic signature moments from AI-video launch films:
 *
 * - type-mask  (Runway-style "video in text"): a giant headline is a window onto the product's
 *   own footage (or a living brand gradient). It holds with a slow push-in, then the camera dives
 *   through a letter into the footage itself.
 * - node-graph (ComfyUI-style): the steps or features become nodes of a workflow graph; they pop
 *   in one by one, bezier wires draw themselves between their ports, and pulses flow through
 *   to an output node that completes.
 */
import { exitT } from "../fx";
import { clamp, lerp, mixHex, range, rgba, TAU } from "../math";
import { tokens } from "../grid";
import { drawLogo, getImage, getMedia, logoMaxWidth, mediaSize, type Drawable } from "../media";
import { glassCard, saasBackground, sentence, spring } from "../saasfx";
import { scratch } from "../scratch";
import { fillTextFit, fitTextLines, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { topHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0].trim();
const descOf = (item: string) => item.split(/\s+[—–]\s+/)[1]?.trim() ?? "";

/** Draw a picture or video frame to cover a rectangle (like CSS object-fit: cover). */
function cover(ctx: CanvasRenderingContext2D, d: Drawable, x: number, y: number, w: number, h: number, zoom = 1, driftX = 0, driftY = 0) {
  const { w: mw, h: mh } = mediaSize(d);
  if (!mw || !mh) return;
  const s = Math.max(w / mw, h / mh) * zoom;
  const dw = mw * s;
  const dh = mh * s;
  ctx.drawImage(d, x + (w - dw) / 2 + driftX * (dw - w) * 0.5, y + (h - dh) * 0.15 + driftY * (dh - h) * 0.3, dw, dh);
}

/* ───────────────────────── Video in text ───────────────────────── */

function maskTiming(d: number) {
  const zoomAt = Math.max(1.9, d - 1.15);
  return { reveal: 0.15, zoomAt, end: d - 0.08 };
}

/** A point inside the letters to dive into (cached: it only depends on the text and frame size). */
const diveCache = new Map<string, { x: number; y: number }>();
function diveTarget(ctx: CanvasRenderingContext2D, lines: string[], ys: number[], w: number, h: number, font: string) {
  const key = `${font}|${lines.join("\n")}|${w}x${h}`;
  const hit = diveCache.get(key);
  if (hit) return hit;
  // Draw the text small, then look for the solid pixel nearest the middle of the first line.
  const k = 0.25;
  const c = scratch("typemask-probe", Math.ceil(w * k), Math.ceil(h * k));
  const g = c.ctx;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  lines.forEach((l, i) => g.fillText(l, w / 2, ys[i]));
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
  const cx = (w / 2) * k;
  const cy = ys[0] * k;
  let best = { x: w / 2, y: ys[0], d: Infinity };
  for (let y = 0; y < c.canvas.height; y++) {
    for (let x = 0; x < c.canvas.width; x++) {
      if (img[(y * c.canvas.width + x) * 4 + 3] < 250) continue;
      // Prefer thick strokes: all four neighbours solid too.
      const solid = [1, -1, c.canvas.width, -c.canvas.width].every((o) => img[((y * c.canvas.width + x + o) * 4) + 3] >= 250);
      if (!solid) continue;
      const dd = (x - cx) ** 2 + (y - cy) ** 2;
      if (dd < best.d) best = { x: x / k, y: y / k, d: dd };
    }
  }
  const out = { x: best.x, y: best.y };
  diveCache.set(key, out);
  return out;
}

function typeMask(sc: SkillContext) {
  const { ctx, w, h, t, d, u, scene, palette } = sc;
  const portrait = h > w;
  const T = maskTiming(d);
  saasBackground(sc, { beams: 0, aurora: 0.4 });

  // What fills the letters: the product's footage, else a living brand gradient.
  const fill = scratch("typemask-fill", w, h);
  const media = getMedia(scene.media, t);
  const push = 1 + 0.06 * range(t, 0, T.zoomAt);
  if (media) {
    cover(fill.ctx, media, 0, 0, w, h, 1.15 * push, Math.sin(t * 0.3) * 0.4, 0.2 + 0.3 * range(t, 0, d));
  } else {
    const a = t * 0.35;
    const g = fill.ctx.createLinearGradient(w / 2 + Math.cos(a) * w * 0.6, h / 2 + Math.sin(a) * h * 0.6, w / 2 - Math.cos(a) * w * 0.6, h / 2 - Math.sin(a) * h * 0.6);
    g.addColorStop(0, palette.primary);
    g.addColorStop(0.5, palette.secondary);
    g.addColorStop(1, palette.accent);
    fill.ctx.fillStyle = g;
    fill.ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const bx = w * (0.5 + 0.38 * Math.sin(t * (0.4 + i * 0.13) + i * 1.7));
      const by = h * (0.5 + 0.34 * Math.cos(t * (0.33 + i * 0.11) + i));
      const rg = fill.ctx.createRadialGradient(bx, by, 0, bx, by, Math.max(w, h) * 0.35);
      rg.addColorStop(0, rgba(i % 2 ? "#ffffff" : palette.bg0, i % 2 ? 0.35 : 0.45));
      rg.addColorStop(1, rgba(palette.bg0, 0));
      fill.ctx.fillStyle = rg;
      fill.ctx.fillRect(0, 0, w, h);
    }
  }

  // The letters: huge, two lines at most, each rising out of a mask.
  const text = scene.text.replace(/\*/g, "");
  const sizeFrac = portrait ? 0.24 : 0.36;
  const fit = tokens(w, h).safe.width / 1.07;
  let layout = sentence(sc, { text, cy: h * (portrait ? 0.44 : 0.46), sizeFrac, widthFrac: fit / w, maxLines: 2 });
  // Giant type must still fit: shrink a long word until every line, after the slow 6% push-in, stays
  // inside the title-safe width. (Measured as drawn: glyph bounds, without the layout's tracking.)
  const widestLine = () =>
    Math.max(
      ...layout.lines.map((l) => {
        const m = ctx.measureText(l.replace(/\*/g, ""));
        return Math.max(m.width, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
      }),
    );
  let frac = sizeFrac;
  for (let i = 0, widest = widestLine(); i < 4 && widest > fit; i++, widest = widestLine()) {
    frac *= (fit / widest) * 0.99;
    layout = sentence(sc, { text, cy: h * (portrait ? 0.44 : 0.46), sizeFrac: frac, widthFrac: fit / w, maxLines: 2 });
  }
  const font = ctx.font;
  const m = scratch("typemask", w, h);
  const mc = m.ctx;
  mc.font = font;
  mc.textAlign = "center";
  mc.textBaseline = "middle";
  mc.fillStyle = "#ffffff";
  layout.lines.forEach((line, i) => {
    const k = 1 - Math.pow(1 - clamp(range(t, T.reveal + i * 0.12, T.reveal + i * 0.12 + 0.75)), 4);
    mc.save();
    mc.beginPath();
    mc.rect(0, layout.ys[i] - layout.size * 0.62, w, layout.size * 1.24);
    mc.clip();
    mc.fillText(line.replace(/\*/g, ""), w / 2, layout.ys[i] + (1 - k) * layout.size * 1.1);
    mc.restore();
  });
  mc.globalCompositeOperation = "source-in";
  mc.drawImage(fill.canvas, 0, 0);
  mc.globalCompositeOperation = "source-over";

  // The dive: accelerate into a solid stroke until the footage fills the frame.
  const z = range(t, T.zoomAt, T.end);
  const ez = z * z * z;
  const target = diveTarget(ctx, layout.lines.map((l) => l.replace(/\*/g, "")), layout.ys, w, h, font);
  const scale = push * (1 + ez * 60);
  // The slow push-in grows from the centre; the dive then drives into the chosen stroke, drifting
  // it to the frame's centre as the footage fills the screen.
  const tx = lerp(target.x, w / 2, ez);
  const ty = lerp(target.y, h / 2, ez);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(push, push);
  ctx.translate(-w / 2, -h / 2);
  ctx.translate(tx, ty);
  ctx.scale(1 + ez * 60, 1 + ez * 60);
  ctx.translate(-target.x, -target.y);
  ctx.drawImage(m.canvas, 0, 0);
  // A fine light edge keeps dark footage readable as letters.
  ctx.globalAlpha = 0.22 * (1 - z);
  ctx.strokeStyle = palette.light ? palette.text : "#ffffff";
  ctx.lineWidth = 1.4 * u / scale;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (t > T.reveal + 0.8) layout.lines.forEach((line, i) => ctx.strokeText(line.replace(/\*/g, ""), w / 2, layout.ys[i]));
  ctx.restore();
  // Through the letter: the footage takes the whole frame.
  const through = range(z, 0.5, 0.95);
  if (through > 0) {
    ctx.save();
    ctx.globalAlpha = through;
    ctx.drawImage(fill.canvas, 0, 0);
    ctx.restore();
  }

  // The real logo sits above the letters while they hold, so the brand is revealed too.
  const logo = sc.brand?.logo ? getImage(sc.brand.logo) : null;
  if (logo?.naturalWidth) {
    const lk = range(t, T.reveal + 0.35, T.reveal + 0.8) * (1 - range(t, T.zoomAt - 0.25, T.zoomAt + 0.15));
    if (lk > 0) {
      const ar = logo.naturalWidth / logo.naturalHeight;
      const lh = Math.min(h * 0.075, (w * 0.22) / ar);
      const lw = Math.min(lh * ar, logoMaxWidth(ctx, logo));
      const top = layout.ys[0] - layout.size * 0.62 - lh - 30 * u;
      ctx.save();
      ctx.globalAlpha = lk;
      drawLogo(ctx, logo, !!palette.light, w / 2 - lw / 2, top + (1 - lk) * 10 * u, lw, lw / ar);
      ctx.restore();
    }
  }
  // Supporting line under the letters while they hold.
  if (scene.subtext) {
    const sk = range(t, T.reveal + 0.7, T.reveal + 1.2) * (1 - range(t, T.zoomAt - 0.2, T.zoomAt + 0.2));
    if (sk > 0) {
      ctx.save();
      ctx.globalAlpha = sk;
      ctx.font = subFont((portrait ? 34 : 30) * u, 500);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = mixHex(palette.text, palette.bg1, 0.2);
      const last = layout.ys[layout.ys.length - 1] + layout.size * 0.62;
      ctx.fillText(scene.subtext, w / 2, last + 46 * u + (1 - sk) * 12 * u);
      ctx.restore();
    }
  }
}

/* ───────────────────────── Node graph ───────────────────────── */

function nodeItems(scene: Scene) {
  const items = (scene.items ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  return items.length >= 2 ? items : ["Load your data", "Describe the result", "Generate", "Review and share"];
}

function nodeTiming(scene: Scene, d: number) {
  const n = nodeItems(scene).length;
  const first = 0.55;
  const step = Math.min(0.62, Math.max(0.38, (d - 2.2) / n));
  return { n, first, step, appear: (i: number) => first + i * step, done: first + (n - 1) * step + 0.9 };
}

function bezier(p0: { x: number; y: number }, p1: { x: number; y: number }, k: number) {
  const dx = Math.max(60, Math.abs(p1.x - p0.x) * 0.5);
  const c0 = { x: p0.x + dx, y: p0.y };
  const c1 = { x: p1.x - dx, y: p1.y };
  const m = 1 - k;
  return {
    x: m * m * m * p0.x + 3 * m * m * k * c0.x + 3 * m * k * k * c1.x + k * k * k * p1.x,
    y: m * m * m * p0.y + 3 * m * m * k * c0.y + 3 * m * k * k * c1.y + k * k * k * p1.y,
  };
}

function nodeGraph(sc: SkillContext) {
  const { ctx, w, h, t, d, u, scene, palette } = sc;
  const portrait = h > w;
  saasBackground(sc, { beams: 0 });
  // A faint dot grid: the canvas of a node editor.
  ctx.save();
  ctx.fillStyle = rgba(palette.text, palette.light ? 0.1 : 0.07);
  const gap = 34 * u;
  for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) ctx.fillRect(x, y, 2 * u, 2 * u);
  ctx.restore();
  topHeadline(sc);

  const items = nodeItems(scene);
  const T = nodeTiming(scene, d);
  const ex = exitT(sc, 0.4);
  const nw = portrait ? w * 0.6 : Math.min(w * 0.205, 400 * u);
  const nh = portrait ? 140 * u : 184 * u;
  const top = h * (portrait ? 0.3 : 0.33);
  const bottom = h * 0.9;
  const colors = [palette.primary, palette.secondary, palette.accent, mixHex(palette.primary, palette.secondary, 0.5), palette.accent];
  const nodes = items.map((_, i) => {
    const f = T.n > 1 ? i / (T.n - 1) : 0.5;
    if (portrait) {
      const x = i % 2 ? w * 0.9 - nw : w * 0.1;
      return { x, y: lerp(top, bottom - nh, f) };
    }
    const x = lerp(w * 0.06, w * 0.94 - nw, f);
    const mid = (top + bottom) / 2 - nh / 2;
    return { x, y: mid + (i % 2 ? 1 : -1) * (bottom - top) * 0.16 };
  });
  const outPort = (i: number) => (portrait ? { x: nodes[i].x + nw / 2, y: nodes[i].y + nh } : { x: nodes[i].x + nw, y: nodes[i].y + nh / 2 });
  const inPort = (i: number) => (portrait ? { x: nodes[i].x + nw / 2, y: nodes[i].y } : { x: nodes[i].x, y: nodes[i].y + nh / 2 });

  ctx.save();
  ctx.globalAlpha = 1 - ex;
  // Wires first, under the nodes.
  for (let i = 0; i < T.n - 1; i++) {
    const t0 = T.appear(i + 1) - 0.1;
    const k = 1 - Math.pow(1 - clamp(range(t, t0, t0 + 0.4)), 3);
    if (k <= 0) continue;
    const a = outPort(i);
    const b = inPort(i + 1);
    const pt = (s: number) => (portrait ? (() => { const p = bezier({ x: a.y, y: a.x }, { x: b.y, y: b.x }, s); return { x: p.y, y: p.x }; })() : bezier(a, b, s));
    ctx.beginPath();
    for (let s = 0; s <= 40; s++) {
      const p = pt((s / 40) * k);
      if (s === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = rgba(colors[i % colors.length], 0.85);
    ctx.lineWidth = 3.2 * u;
    ctx.lineCap = "round";
    ctx.stroke();
    // Data pulses travel the wire once it's connected.
    if (k >= 1) {
      for (let j = 0; j < 2; j++) {
        const s = ((t - t0 - 0.4) * 0.8 + j * 0.5) % 1;
        const p = pt(s);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * u, 0, TAU);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11 * u, 0, TAU);
        ctx.fillStyle = rgba(colors[i % colors.length], 0.3);
        ctx.fill();
      }
    }
  }
  // Nodes.
  items.forEach((item, i) => {
    const t0 = T.appear(i);
    if (t < t0) return;
    const sp = Math.min(1.06, Math.max(0, spring(t - t0, 13, 8)));
    const { x, y } = nodes[i];
    const color = colors[i % colors.length];
    ctx.save();
    ctx.globalAlpha *= clamp((t - t0) / 0.15);
    ctx.translate(x + nw / 2, y + nh / 2);
    ctx.scale(0.86 + 0.14 * sp, 0.86 + 0.14 * sp);
    ctx.translate(-(x + nw / 2), -(y + nh / 2));
    glassCard(sc, x, y, nw, nh, { r: 14 * u });
    // Header strip with the node's title.
    // Long titles wrap onto a second line and the header strip grows to hold them.
    ctx.font = subFont(24 * u, 700);
    const tfit = fitTextLines(ctx, titleOf(item), nw - 30 * u, { maxLines: 2, minScale: 0.75 });
    const hh = 46 * u + (tfit.lines.length - 1) * tfit.size * 1.08;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, nw, hh, [14 * u, 14 * u, 0, 0]);
    ctx.fillStyle = rgba(color, 0.85);
    ctx.fill();
    ctx.restore();
    ctx.font = subFont(24 * u, 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    fillTextFit(ctx, titleOf(item), x + 14 * u, y + hh / 2, nw - 30 * u, { maxLines: 2, lineHeight: 1.08, minScale: 0.75 });
    // Body: the description, or parameter sliders settling into place.
    const desc = descOf(item);
    const bodyY = y + hh + 14 * u;
    ctx.font = subFont(18 * u, 500);
    ctx.fillStyle = mixHex(palette.text, palette.bg1, 0.3);
    let descH = 0;
    if (desc && !portrait) {
      // The description wraps onto two lines; the sliders below make room for it.
      ctx.textBaseline = "top";
      const n = fillTextFit(ctx, desc, x + 14 * u, bodyY - 2 * u, nw - 28 * u, { maxLines: 2, lineHeight: 1.15, minScale: 0.85 });
      ctx.textBaseline = "middle";
      descH = n * 18 * u * 1.15 + 12 * u;
    }
    const rows = portrait ? 2 : desc ? 2 : 3;
    for (let r = 0; r < rows; r++) {
      const ry = bodyY + (descH || 8 * u) + r * 26 * u;
      if (ry > y + nh - 12 * u) break;
      const barW = nw - 28 * u;
      ctx.fillStyle = rgba(palette.text, 0.1);
      ctx.beginPath();
      ctx.roundRect(x + 14 * u, ry, barW, 10 * u, 5 * u);
      ctx.fill();
      const target = 0.3 + 0.55 * ((i * 3 + r * 7) % 10) / 10;
      const kv = 1 - Math.pow(1 - clamp(range(t, t0 + 0.15 + r * 0.08, t0 + 0.7 + r * 0.08)), 3);
      ctx.fillStyle = rgba(color, 0.9);
      ctx.beginPath();
      ctx.roundRect(x + 14 * u, ry, Math.max(10 * u, barW * target * kv), 10 * u, 5 * u);
      ctx.fill();
    }
    // Ports.
    const port = (p: { x: number; y: number }, on: boolean) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9 * u, 0, TAU);
      ctx.fillStyle = on ? color : palette.bg1;
      ctx.fill();
      ctx.lineWidth = 2 * u;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    if (i > 0) port(inPort(i), t > T.appear(i) + 0.3);
    if (i < T.n - 1) port(outPort(i), t > T.appear(i + 1));
    // The output node completes: a progress bar fills, then a check.
    if (i === T.n - 1) {
      const pk = clamp(range(t, T.done - 0.5, T.done + 0.3));
      if (pk > 0) {
        const bx = x + 14 * u;
        const by = y + nh - 20 * u;
        ctx.fillStyle = rgba(palette.text, 0.12);
        ctx.fillRect(bx, by, nw - 28 * u, 6 * u);
        ctx.fillStyle = palette.primary;
        ctx.fillRect(bx, by, (nw - 28 * u) * pk, 6 * u);
        if (pk >= 1) {
          const ck = clamp(range(t, T.done + 0.3, T.done + 0.6));
          ctx.beginPath();
          ctx.arc(x + nw - 18 * u, y + hh / 2, 11 * u * ck, 0, TAU);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 3 * u;
          ctx.beginPath();
          ctx.moveTo(x + nw - 23 * u, y + hh / 2);
          ctx.lineTo(x + nw - 19 * u, y + hh / 2 + 4 * u);
          ctx.lineTo(x + nw - 12 * u, y + hh / 2 - 4 * u);
          if (ck >= 1) ctx.stroke();
        }
      }
    }
    ctx.restore();
  });
  ctx.restore();
}

export const typeFxSkills: Skill[] = [
  {
    id: "type-mask",
    name: "Video in Text",
    tagline: "Giant type becomes a window onto your product footage, then the camera dives through a letter into it.",
    bestFor: "A bold brand or promise moment with real product media. Headline = 1–3 short words (the product name or a key word); media = a product video or screenshot; subtext = one short line.",
    sample: { text: "Create", subtext: "Start from an idea" },
    render: typeMask,
    sfx: (scene) => {
      const T = maskTiming(scene.duration);
      return [at(T.reveal, "swoosh"), at(T.zoomAt + 0.2, "whoosh")];
    },
  },
  {
    id: "node-graph",
    name: "Node Graph",
    tagline: "Your steps become a node workflow: nodes pop in, wires draw between ports, data pulses through to a finished output.",
    bestFor: "AI, automation and workflow products (ComfyUI-style). Headline = what the workflow does; items = 3–5 steps ('Title — detail'), the last is the output.",
    sample: { text: "From prompt to *finished shot*", items: ["Load image — Your reference", "Prompt — Describe the scene", "Generate — Render the shot", "Upscale — 4K output"] },
    itemsHint: "Title — detail (3–5 steps)",
    render: nodeGraph,
    sfx: (scene) => {
      const T = nodeTiming(scene, scene.duration);
      return [...Array.from({ length: T.n }, (_, i) => at(T.appear(i), "pop")), at(T.done + 0.3, "success")];
    },
  },
];
