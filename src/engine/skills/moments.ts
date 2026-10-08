/**
 * Product moments that recur in the best SaaS launch films, each staged in the product's own
 * palette with generic, claim-free UI copy:
 *
 * - code-deploy:  Vercel / Supabase / Railway. Code types into an editor, `git push` runs in the
 *                 terminal below, the pipeline ticks green and the app goes live.
 * - globe:        Stripe / Cloudflare / Vercel. A dotted world spins while arcs fly between
 *                 cities, each landing with a ping and a live event card.
 * - live-cursors: Figma / Miro / Notion. Teammates' named cursors move a card, lasso another and
 *                 leave a comment on a shared board, their avatars live in the title bar.
 * - kanban:       Linear / Trello / Asana. A cursor drags a card across the board, then the rest
 *                 of the work flows into Done by itself.
 * - before-after: The old way next to the product: a comparison slider drags from a cluttered,
 *                 grey "before" (the site's own pains) to the product screenshot.
 * - chat-thread:  Slack / Intercom. Teammates message in a channel with typing indicators and
 *                 reactions, and the product posts its update card into the thread.
 *
 * Every frame is a pure function of time, so preview, seek and export match.
 */
import { exitT } from "../fx";
import { clamp, ease, hashString, lerp, mixHex, noise1, range, rgba, rng, TAU } from "../math";
import { tokens } from "../grid";
import { getImage, getMedia } from "../media";
import { borderBeam, clickRipple, drawCursor, drawIcon, glassCard, iconsFor, pill, pillWidth, saasBackground, spring } from "../saasfx";
import { fillTextFit, fitTextLines, subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { coverDraw, fitted, mockShot } from "./gallery";
import { checkBadge, cursorPath, ellipsize, focus, iconTile, windowChrome, wrap, wrapClamp } from "./interactions";
import { topHeadline, underHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0].trim();
const mono = (size: number, weight = 500) => `${weight} ${Math.round(size)}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
const hair = (p: Palette, a = 0.08) => (p.light ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);

/** Teammates in collaborative scenes: generic first names in the classic multiplayer colours. */
export const PEOPLE = [
  { name: "Maya", color: "#f43f5e" },
  { name: "Leo", color: "#3b82f6" },
  { name: "Priya", color: "#10b981" },
  { name: "Sam", color: "#f59e0b" },
];

/** Window entrance: springs up and fades in; returns the eased 0..1 used for alpha. */
export function enter(sc: SkillContext, start = 0.15, lift = 60) {
  const { ctx, t, u } = sc;
  const k = clamp(spring(t - start, 10, 7), 0, 1.05);
  ctx.translate(0, (1 - Math.min(1, k)) * lift * u);
  return clamp((t - start) / 0.25);
}

/** Completion badge below a window. */
export function doneBadge(sc: SkillContext, label: string, cx: number, cy: number, lt: number, S: number) {
  if (lt <= 0) return;
  const { ctx, u, palette } = sc;
  const k = clamp(spring(lt, 13, 7), 0, 1.1);
  // Keep the badge (a 44pt·S tall pill) above the title-safe bottom.
  const y = Math.min(cy, sc.h - tokens(sc.w, sc.h).safe.bottom - 22 * u * S);
  ctx.save();
  ctx.globalAlpha *= clamp(lt / 0.15);
  ctx.translate(cx, y);
  ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
  pill(sc, label, 0, 0, {
    size: 22 * u * S,
    weight: 700,
    fill: rgba(palette.accent, palette.light ? 0.16 : 0.22),
    border: rgba(palette.accent, 0.6),
    color: palette.light ? palette.text : "#ffffff",
  });
  ctx.restore();
}

/** A small round avatar with an initial. */
export function avatar(sc: SkillContext, name: string, color: string, cx: number, cy: number, r: number, ring?: string) {
  const { ctx, u } = sc;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  if (ring) {
    ctx.lineWidth = Math.max(2, 2.5 * u);
    ctx.strokeStyle = ring;
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = subFont(r * 0.95, 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.slice(0, 1).toUpperCase(), cx, cy + r * 0.05);
  ctx.restore();
}

/** Spinner arc (a step that is running). */
function spinner(sc: SkillContext, cx: number, cy: number, r: number, color: string) {
  const { ctx, t, u } = sc;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, 2.6 * u);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, t * 9, t * 9 + TAU * 0.7);
  ctx.stroke();
  ctx.restore();
}

/** Compress a timeline so it fits a shorter scene (keeps the finish ~0.9s before the end). */
export function fitTimes<T extends Record<string, number | number[]>>(T: T, end: number, d: number): T {
  const f = Math.max(0.6, Math.min(1, (d - 0.9) / end));
  if (f >= 1) return T;
  const out = {} as Record<string, number | number[]>;
  for (const [k, v] of Object.entries(T)) out[k] = Array.isArray(v) ? v.map((x) => x * f) : v * f;
  return out as T;
}

/* ───────────────────────── Code → Deploy ───────────────────────── */

type Tok = ["kw" | "str" | "fn" | "com" | "txt", string];
/** Generic app code (an API route): no claim about the product's own SDK or CLI. */
const CODE: Tok[][] = [
  [["com", "// app/api/projects.ts"]],
  [["kw", "export async function "], ["fn", "GET"], ["txt", "() {"]],
  [["kw", "  const "], ["txt", "projects = "], ["kw", "await "], ["txt", "db."], ["fn", "list"], ["txt", "("], ["str", '"projects"'], ["txt", ");"]],
  [["kw", "  return "], ["txt", "Response."], ["fn", "json"], ["txt", "(projects);"]],
  [["txt", "}"]],
];
const CODE_CHARS = CODE.flat().reduce((a, [, s]) => a + s.length, 0);

function codeSteps(scene: Scene) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 5);
  return items.length >= 2 ? items : ["Build started", "Checks passed", "Preview ready", "Deployed to production"];
}

function codeTiming(scene: Scene, beat: number) {
  const n = codeSteps(scene).length;
  const typeStart = 0.45;
  const typeEnd = typeStart + 1.5;
  const term = typeEnd + 0.2;
  const cmd0 = term + 0.3;
  const cmd1 = cmd0 + 0.45;
  const run = cmd1 + 0.08;
  const st = clamp(beat / 2, 0.24, 0.34);
  const rows = Array.from({ length: n }, (_, i) => run + 0.3 + i * st);
  const live = rows[n - 1] + 0.3;
  return fitTimes({ typeStart, typeEnd, term, cmd0, cmd1, run, rows, live }, live, scene.duration);
}

function codeDeploy(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, beat, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const portrait = h > w;
  const S = portrait ? 1.42 : 1.25;
  const steps = codeSteps(scene);
  const T = codeTiming(scene, beat);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const lineH = 40 * u * S;
  const fs = 20 * u * S;
  const codeH = CODE.length * lineH + 36 * u * S;
  const rowH = 38 * u * S;
  const termH = (steps.length + 1) * rowH + 34 * u * S;
  const ww = portrait ? tokens(w, h).safe.width : Math.min(w * 0.62, 1180 * u);
  const wh = 46 * u + codeH + termH;
  const wx = (w - ww) / 2;
  const wy = portrait ? Math.max(h * 0.27, h * 0.55 - wh / 2) : Math.max(h * 0.27, h * 0.6 - wh / 2);
  const slug = (brand?.name ?? "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";

  // A gentle push toward the terminal while the pipeline runs.
  const zIn = ease.inOutCubic(range(t, T.run - 0.4, T.run + 0.4));
  const zOut = ease.inOutCubic(range(t, T.live, T.live + 0.8));
  const z = 1 + 0.05 * zIn * (1 - zOut);
  const tcy = wy + 46 * u + codeH + termH / 2;
  focus(sc, w / 2, tcy, ww * 0.6, 0.6 * zIn * (1 - zOut) * (1 - ex));
  topHeadline(sc);
  ctx.save();
  ctx.translate(w / 2, tcy);
  ctx.scale(z, z);
  ctx.translate(-w / 2, -tcy);
  ctx.globalAlpha = (1 - ex) * enter(sc);
  const top = windowChrome(sc, wx, wy, ww, wh, `projects.ts — ${slug}`);

  // Editor: gutter, current-line highlight, syntax-coloured code typing in.
  const colors: Record<Tok[0], string> = {
    kw: palette.light ? mixHex(palette.primary, "#000000", 0.2) : mixHex(palette.primary, "#ffffff", 0.25),
    fn: palette.light ? mixHex(palette.secondary, "#000000", 0.25) : mixHex(palette.secondary, "#ffffff", 0.3),
    str: palette.light ? "#15803d" : "#86efac",
    com: rgba(palette.text, 0.4),
    txt: rgba(palette.text, 0.9),
  };
  const shown = Math.floor(range(t, T.typeStart, T.typeEnd) * CODE_CHARS);
  let left = shown;
  let caret = { x: wx + 76 * u * S, y: top + 18 * u * S + lineH / 2 };
  const gx = wx + 24 * u * S;
  const cx0 = wx + 76 * u * S;
  ctx.font = mono(fs);
  ctx.textBaseline = "middle";
  CODE.forEach((line, li) => {
    const y = top + 18 * u * S + li * lineH + lineH / 2;
    const typing = left > 0 || li === 0;
    if (left > 0 && left <= line.reduce((a, [, s]) => a + s.length, 0) && t < T.term) {
      ctx.fillStyle = rgba(palette.primary, 0.08);
      ctx.fillRect(wx + 1, y - lineH / 2, ww - 2, lineH);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = rgba(palette.text, typing ? 0.32 : 0.14);
    ctx.fillText(String(li + 1), gx + 26 * u * S, y);
    ctx.textAlign = "left";
    let x = cx0;
    for (const [kind, text] of line) {
      if (left <= 0) break;
      const part = text.slice(0, left);
      left -= part.length;
      ctx.fillStyle = colors[kind];
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
      caret = { x, y };
    }
  });
  if (t < T.term && (t < T.typeEnd || Math.floor(t * 2.4) % 2 === 0)) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(caret.x + 2 * u, caret.y - fs * 0.62, 2.5 * u, fs * 1.24);
  }

  // Terminal: slides up under the editor; `git push` types in and the pipeline ticks green.
  const tk = clamp(spring(t - T.term, 12, 8), 0, 1.04);
  if (t > T.term) {
    const ty = top + codeH;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(wx, ty, ww, termH, [0, 0, 18 * u, 18 * u]);
    ctx.clip();
    ctx.globalAlpha *= clamp((t - T.term) / 0.2);
    ctx.fillStyle = palette.light ? "#0f172a" : mixHex(palette.bg0, "#000000", 0.45);
    ctx.fillRect(wx, ty + (1 - Math.min(1, tk)) * termH * 0.4, ww, termH);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(wx, ty, ww, Math.max(1, u));
    const ink = "#e2e8f0";
    const green = "#4ade80";
    const tx = wx + 28 * u * S;
    let y = ty + 17 * u * S + rowH / 2 + (1 - Math.min(1, tk)) * 30 * u;
    ctx.font = mono(fs * 0.95);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const prompt = `~/${slug} $ `;
    ctx.fillStyle = "#67e8f9";
    ctx.fillText(prompt, tx, y);
    const cmd = "git push";
    const typed = cmd.slice(0, Math.ceil(range(t, T.cmd0, T.cmd1) * cmd.length));
    const px = tx + ctx.measureText(prompt).width;
    ctx.fillStyle = ink;
    ctx.fillText(typed, px, y);
    if (t < T.run && Math.floor(t * 2.4) % 2 === 0) ctx.fillRect(px + ctx.measureText(typed).width + 3 * u, y - fs * 0.55, fs * 0.55, fs * 1.1);
    steps.forEach((step, i) => {
      y += rowH;
      const start = T.rows[i] - 0.3;
      if (t < start) return;
      const done = t > T.rows[i];
      ctx.save();
      ctx.globalAlpha *= clamp((t - start) / 0.12);
      const r = 9 * u * S;
      if (done) {
        ctx.fillStyle = green;
        ctx.font = mono(fs * 0.95, 700);
        ctx.fillText("✓", tx, y);
      } else spinner(sc, tx + r * 0.7, y, r * 0.8, "#67e8f9");
      ctx.font = mono(fs * 0.95);
      ctx.fillStyle = done ? ink : "rgba(226,232,240,0.6)";
      fillTextFit(ctx, step, tx + 32 * u * S, y, ww - 110 * u * S, { maxLines: 1, minScale: 0.72 });
      ctx.restore();
    });
    ctx.restore();
  }
  if (t > T.live) borderBeam(sc, wx, wy, ww, wh, (t - T.live) * 0.9, { r: 18 * u, color: palette.accent, alpha: 1 - range(t, T.live + 1.2, T.live + 1.8) });
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  doneBadge(sc, "●  Live", w / 2, wy + wh + (portrait ? 70 : 50) * u, t - T.live, S);
  ctx.restore();
}

/* ───────────────────────── Globe ───────────────────────── */

const D2R = Math.PI / 180;
/** Rough continent outlines (lon, lat): enough for a dotted globe to read as the world. */
export const LAND: number[][] = [
  // North America
  [-168, 65, -140, 70, -95, 72, -80, 63, -62, 57, -55, 48, -67, 45, -75, 38, -81, 31, -80, 25, -90, 29, -97, 27, -97, 21, -88, 21, -83, 10, -78, 8, -92, 15, -105, 20, -112, 30, -117, 33, -124, 40, -124, 48, -135, 58, -150, 60, -165, 60],
  // Greenland
  [-55, 60, -44, 60, -20, 70, -20, 80, -60, 82, -72, 77],
  // South America
  [-78, 8, -60, 10, -50, 0, -35, -6, -40, -22, -48, -28, -58, -38, -65, -55, -72, -50, -73, -35, -70, -18, -81, -5, -80, 2],
  // Europe
  [-10, 36, -9, 44, -2, 48, -5, 54, -3, 58, 5, 62, 10, 64, 20, 70, 30, 71, 40, 67, 40, 45, 28, 41, 26, 36, 15, 38, 12, 44, 3, 43],
  // Africa
  [-17, 21, -10, 30, -5, 36, 10, 37, 20, 32, 32, 31, 35, 28, 43, 12, 51, 12, 40, -5, 40, -15, 35, -25, 20, -35, 17, -28, 12, -15, 13, -5, 8, 4, -8, 4, -17, 14],
  // Asia
  [40, 45, 40, 67, 60, 70, 80, 73, 110, 76, 140, 72, 180, 68, 170, 60, 160, 55, 142, 50, 140, 40, 122, 30, 120, 22, 108, 18, 105, 10, 100, 2, 95, 15, 90, 22, 80, 15, 77, 8, 72, 20, 60, 25, 55, 17, 45, 13, 35, 30, 28, 41],
  // Japan, UK & Ireland, Indonesia, Madagascar
  [130, 31, 141, 35, 142, 43, 140, 41, 136, 36],
  [-6, 50, 2, 51, 0, 56, -3, 59, -6, 57, -10, 53],
  [95, 5, 105, -6, 115, -8, 125, -9, 140, -3, 132, 0, 118, 3, 110, 1],
  [44, -13, 50, -16, 47, -25, 43, -22],
  // Australia, New Zealand
  [114, -22, 122, -18, 131, -12, 142, -11, 146, -19, 153, -26, 150, -37, 140, -38, 130, -32, 115, -34],
  [167, -46, 174, -41, 178, -38, 173, -35, 172, -41],
];

export function onLand(lon: number, lat: number) {
  for (const poly of LAND) {
    let inside = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i];
      const yi = poly[i + 1];
      const xj = poly[j];
      const yj = poly[j + 1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

let landDots: Float32Array | null = null;
/** Land dots on an equal-area grid, as [lat, lon] radian pairs. */
function dots() {
  if (landDots) return landDots;
  const out: number[] = [];
  const step = 2.3;
  for (let lat = -56; lat <= 80; lat += step) {
    const n = Math.max(1, Math.round((360 * Math.cos(lat * D2R)) / step));
    for (let k = 0; k < n; k++) {
      const lon = -180 + ((k + 0.5) * 360) / n;
      if (onLand(lon, lat)) out.push(lat * D2R, lon * D2R);
    }
  }
  landDots = new Float32Array(out);
  return landDots;
}

const TILT = 0.38;
/** Unit-sphere point for (lat, lon) seen from a camera facing longitude `lonC`, tilted down. */
function sphere(lat: number, lon: number, lonC: number, r = 1) {
  const x = Math.cos(lat) * Math.sin(lon - lonC) * r;
  const y = Math.sin(lat) * r;
  const z = Math.cos(lat) * Math.cos(lon - lonC) * r;
  return { x, y: y * Math.cos(TILT) - z * Math.sin(TILT), z: y * Math.sin(TILT) + z * Math.cos(TILT) };
}

function globeTiming(scene: Scene) {
  const n = Math.min(4, Math.max(3, scene.items?.length ?? 4));
  const arcs = Array.from({ length: n }, (_, i) => 0.7 + i * 0.6);
  return fitTimes({ arcs, land: 0.85 }, arcs[n - 1] + 2.1, scene.duration);
}

function globeItems(scene: Scene) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 4);
  return items.length >= 2 ? items : ["New signup", "Payment received", "Order shipped", "Message sent"];
}

function globe(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, seed } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const portrait = h > w;
  const S = portrait ? 1.3 : 1.2;
  const ex = ease.inCubic(exitT(sc, 0.45));
  const items = globeItems(scene);
  const T = globeTiming(scene);
  const icons = iconsFor(items, sc);
  const intro = clamp(spring(t - 0.05, 7, 7), 0, 1.03);
  const R0 = portrait ? w * 0.42 : Math.min(h * 0.34, w * 0.26);
  const R = R0 * (0.88 + 0.12 * intro);
  const cx = w / 2;
  const cy = portrait ? h * 0.58 : h * 0.62;
  // The globe turns slowly; the arcs fly over the side that faces the camera mid-scene.
  const views = [-35, 5, -90, 95, -35, 5];
  const lon0 = views[seed % views.length] * D2R;
  const speed = 7 * D2R;
  const lonC = lon0 + (t - d / 2) * speed;
  const r = rng(hashString(`globe${seed}`));
  const all = dots();
  const hubs: [number, number][] = [];
  for (let tries = 0; tries < 400 && hubs.length < items.length + 1; tries++) {
    const k = Math.floor(r() * (all.length / 2)) * 2;
    const lat = all[k];
    const lon = all[k + 1];
    let dl = lon - lon0;
    dl = Math.atan2(Math.sin(dl), Math.cos(dl));
    if (Math.abs(dl) > 55 * D2R || lat < -35 * D2R || lat > 60 * D2R) continue;
    if (hubs.some(([a, b]) => Math.acos(clamp(Math.sin(a) * Math.sin(lat) + Math.cos(a) * Math.cos(lat) * Math.cos(b - lon), -1, 1)) < 22 * D2R)) continue;
    hubs.push([lat, lon]);
  }

  ctx.save();
  ctx.globalAlpha = clamp(t / 0.35) * (1 - ex);
  topHeadline(sc);
  // Atmosphere and body.
  const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.45);
  halo.addColorStop(0, rgba(palette.primary, palette.light ? 0.18 : 0.32));
  halo.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);
  const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  body.addColorStop(0, palette.light ? "#ffffff" : mixHex(palette.bg1, palette.primary, 0.14));
  body.addColorStop(1, palette.light ? mixHex(palette.bg1, palette.primary, 0.08) : mixHex(palette.bg0, "#000000", 0.25));
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = rgba(palette.primary, palette.light ? 0.35 : 0.5);
  ctx.lineWidth = Math.max(1, 1.6 * u);
  ctx.stroke();

  // Land dots: nearer dots brighter and larger.
  const dotColor = palette.light ? mixHex(palette.primary, "#1f2937", 0.45) : mixHex("#ffffff", palette.primary, 0.3);
  ctx.fillStyle = dotColor;
  const ds = Math.max(1.2, (R / 330) * 2.6);
  for (let i = 0; i < all.length; i += 2) {
    const p = sphere(all[i], all[i + 1], lonC);
    if (p.z <= 0.02) continue;
    ctx.globalAlpha = clamp(t / 0.35) * (1 - ex) * (0.2 + 0.8 * Math.sqrt(p.z));
    const s = ds * (0.55 + 0.45 * p.z);
    ctx.fillRect(cx + p.x * R - s / 2, cy - p.y * R - s / 2, s, s);
  }
  ctx.globalAlpha = clamp(t / 0.35) * (1 - ex);

  // Arcs between hubs: great circles lifted off the surface, drawn on with a glowing head.
  const arcColor = palette.light ? palette.primary : mixHex(palette.primary, "#ffffff", 0.2);
  const labels: { x: number; y: number; i: number; k: number }[] = [];
  items.forEach((_, i) => {
    const a = hubs[i];
    const b = hubs[i + 1];
    if (!a || !b) return;
    const t0 = T.arcs[i];
    const head = ease.inOutCubic(range(t, t0, t0 + T.land));
    const tail = ease.inOutCubic(range(t, t0 + 2.0, t0 + 2.6));
    if (head <= 0 || tail >= 1) return;
    const va = [Math.cos(a[0]) * Math.cos(a[1]), Math.cos(a[0]) * Math.sin(a[1]), Math.sin(a[0])];
    const vb = [Math.cos(b[0]) * Math.cos(b[1]), Math.cos(b[0]) * Math.sin(b[1]), Math.sin(b[0])];
    const om = Math.acos(clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1));
    const at3 = (s: number) => {
      const k0 = Math.sin((1 - s) * om) / Math.sin(om);
      const k1 = Math.sin(s * om) / Math.sin(om);
      const x = va[0] * k0 + vb[0] * k1;
      const y = va[1] * k0 + vb[1] * k1;
      const zz = va[2] * k0 + vb[2] * k1;
      const lift = 1 + 0.32 * (om / Math.PI) * Math.sin(Math.PI * s) + 0.015;
      const p = sphere(Math.asin(clamp(zz, -1, 1)), Math.atan2(y, x), lonC, lift);
      return { sx: cx + p.x * R, sy: cy - p.y * R, vis: p.z >= 0 || p.x * p.x + p.y * p.y > 1 };
    };
    const N = 48;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = arcColor;
    ctx.shadowColor = rgba(palette.primary, 0.8);
    ctx.shadowBlur = 10 * u;
    for (let k = 0; k < N; k++) {
      const s0 = k / N;
      const s1 = (k + 1) / N;
      if (s1 > head || s0 < tail) continue;
      const p0 = at3(s0);
      const p1 = at3(s1);
      if (!p0.vis || !p1.vis) continue;
      ctx.globalAlpha = clamp(t / 0.35) * (1 - ex) * (0.35 + 0.65 * (s1 / Math.max(0.01, head)));
      ctx.lineWidth = Math.max(1.5, 2.6 * u * S * (R / R0));
      ctx.beginPath();
      ctx.moveTo(p0.sx, p0.sy);
      ctx.lineTo(p1.sx, p1.sy);
      ctx.stroke();
    }
    ctx.restore();
    const ph = at3(head);
    if (head < 1 && ph.vis) {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 18 * u;
      ctx.beginPath();
      ctx.arc(ph.sx, ph.sy, 4.5 * u * S, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Hubs pulse; the landing sends out a ping.
    for (const [s, when] of [[0, t0], [1, t0 + T.land]] as const) {
      const p = at3(s);
      if (!p.vis || t < when) continue;
      const fade = 1 - tail;
      ctx.save();
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha *= fade;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 5 * u * S, 0, TAU);
      ctx.fill();
      const pk = range(t, when, when + 0.9);
      if (pk > 0 && pk < 1) {
        ctx.strokeStyle = palette.accent;
        ctx.globalAlpha *= 1 - pk;
        ctx.lineWidth = 2.5 * u;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 6 * u + pk * 34 * u * S, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    const pe = at3(1);
    if (pe.vis && t > t0 + T.land) labels.push({ x: pe.sx, y: pe.sy, i, k: t - t0 - T.land });
  });

  // Live event cards where the arcs land.
  for (const l of labels) {
    const life = 1 - range(l.k, 1.25, 1.55);
    if (life <= 0) continue;
    const s = clamp(spring(l.k, 13, 7), 0, 1.08);
    ctx.save();
    ctx.font = subFont(19 * u * S, 600);
    // Long event names wrap onto two lines; the card grows to fit them.
    const fit = fitTextLines(ctx, items[l.i], 320 * u * S, { maxLines: 2, minScale: 0.85 });
    const cw = fit.width + 78 * u * S;
    const ch = Math.max(50 * u * S, fit.lines.length * fit.size * 1.12 + 24 * u * S);
    const bx = clamp(l.x - cw / 2, 16 * u, w - cw - 16 * u);
    const by = l.y - ch - 22 * u * S;
    ctx.globalAlpha *= life * clamp(l.k / 0.12);
    ctx.translate(l.x, by + ch);
    ctx.scale(0.7 + 0.3 * s, 0.7 + 0.3 * s);
    ctx.translate(-l.x, -(by + ch));
    glassCard(sc, bx, by, cw, ch, { r: 14 * u * S });
    iconTile(sc, icons[l.i], bx + 28 * u * S, by + ch / 2, 30 * u * S);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(19 * u * S, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, items[l.i], bx + 54 * u * S, by + ch / 2, fit.width + 2, { maxLines: 2, lineHeight: 1.12, minScale: 0.85 });
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────────────────── Live cursors ───────────────────────── */

function collabCursor(sc: SkillContext, x: number, y: number, color: string, name: string, press = 0, S = 1) {
  const { ctx, u } = sc;
  const s = 1.7 * u * S * (1 - press * 0.12);
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.scale(s, s);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 20);
  ctx.lineTo(5.2, 15.2);
  ctx.lineTo(13.5, 14.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
  ctx.font = subFont(15 * u * S, 600);
  const tw = ctx.measureText(name).width;
  const tagW = tw + 18 * u * S;
  // Near the safe edge the tag slides round to the cursor's left, as in Figma.
  const g = tokens(sc.w, sc.h);
  const flip = clamp((x + 16 * u * S + tagW - (g.safe.right - g.space(4))) / g.space(4));
  const bx = lerp(16 * u * S, -tagW - 6 * u * S, ease.inOutCubic(flip));
  const by = 26 * u * S;
  ctx.beginPath();
  ctx.roundRect(bx, by, tagW, 26 * u * S, 8 * u * S);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, bx + 9 * u * S, by + 13.5 * u * S);
  ctx.restore();
}

/** Piecewise-eased path through [time, x, y] keys, with a little hand wobble. */
function keyPath(keys: number[][], t: number, wobble: number, seed: number) {
  let x = keys[0][1];
  let y = keys[0][2];
  for (let i = 1; i < keys.length; i++) {
    const [t0] = keys[i - 1];
    const [t1, x1, y1] = keys[i];
    if (t <= t0) break;
    const k = ease.inOutCubic(range(t, t0, t1));
    x = lerp(keys[i - 1][1], x1, k);
    y = lerp(keys[i - 1][2], y1, k);
  }
  return { x: x + noise1(t * 0.9, seed) * wobble, y: y + noise1(t * 0.8, seed + 7) * wobble };
}

function cursorsTiming(scene: Scene) {
  return fitTimes({ grab: 1.0, drop: 1.8, lasso0: 1.6, lasso1: 2.3, comment: 2.5, reply: 3.1 }, 3.6, scene.duration);
}

function liveCursors(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const S = portrait ? 1.4 : 1.2;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const T = cursorsTiming(scene);
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 4);
  const cards = items.length >= 3 ? items : ["Launch plan", "Homepage design", "Customer research", "Release notes"];
  const icons = iconsFor(cards, sc);
  const ww = portrait ? tokens(w, h).safe.width : Math.min(w * 0.68, 1280 * u);
  const wh = portrait ? Math.min(h * 0.58, ww * 1.15) : Math.min(h * 0.62, ww * 0.58);
  const wx = (w - ww) / 2;
  const wy = portrait ? h * 0.3 : Math.max(h * 0.28, h * 0.6 - wh / 2);
  topHeadline(sc);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Team board` : "Team board");
  const ch = wy + wh - top;

  // Who's here: avatars in the title bar and a live dot.
  const live = PEOPLE.slice(0, 3);
  live.forEach((p, i) => {
    const k = clamp(spring(t - 0.35 - i * 0.12, 14, 7), 0, 1.1);
    if (k <= 0) return;
    const ax = wx + ww - 32 * u * S - (live.length - 1 - i) * 26 * u * S;
    ctx.save();
    ctx.translate(ax, top - 23 * u);
    ctx.scale(k, k);
    avatar(sc, p.name, p.color, 0, 0, 15 * u * S, palette.light ? "#ffffff" : mixHex(palette.bg1, "#000000", 0.2));
    ctx.restore();
  });
  // Dot grid on the canvas.
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, top, ww, ch);
  ctx.clip();
  ctx.fillStyle = hair(palette, 0.12);
  const gs = 28 * u * S;
  for (let gy = top + gs / 2; gy < top + ch; gy += gs) for (let gx = wx + gs / 2; gx < wx + ww; gx += gs) ctx.fillRect(gx, gy, 2 * u, 2 * u);
  ctx.restore();

  // Cards on the board (normalised to the canvas).
  const n = cards.length;
  const slots = portrait
    ? [[0.07, 0.07], [0.53, 0.12], [0.08, 0.52], [0.54, 0.57]]
    : [[0.06, 0.1], [0.55, 0.07], [0.1, 0.55], [0.57, 0.52]];
  const cw = ww * (portrait ? 0.4 : 0.36);
  const chh = ch * (portrait ? 0.3 : 0.34);
  const colors = [palette.primary, palette.secondary, palette.accent, PEOPLE[3].color];
  const drag = ease.inOutCubic(range(t, T.grab, T.drop));
  const box = (i: number) => {
    let x = wx + slots[i][0] * ww;
    let y = top + slots[i][1] * ch;
    if (i === 0) {
      x += drag * ww * 0.05;
      y += drag * ch * 0.06;
    }
    return { x, y, w: cw, h: chh };
  };
  for (let i = 0; i < n; i++) {
    const b = box(i);
    const k = clamp(spring(t - 0.25 - i * 0.1, 12, 7), 0, 1.06);
    if (k <= 0) continue;
    const held = i === 0 && t > T.grab && t < T.drop + 0.1;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale((0.85 + 0.15 * k) * (held ? 1.03 : 1), (0.85 + 0.15 * k) * (held ? 1.03 : 1));
    ctx.rotate(held ? 0.02 : 0);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    ctx.globalAlpha *= clamp((t - 0.25 - i * 0.1) / 0.2);
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = (held ? 30 : 14) * u;
    ctx.shadowOffsetY = (held ? 14 : 6) * u;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14 * u * S);
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.07);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = rgba(colors[i], 0.9);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, 7 * u * S, [14 * u * S, 14 * u * S, 0, 0]);
    ctx.fill();
    iconTile(sc, icons[i], b.x + 36 * u * S, b.y + 46 * u * S, 36 * u * S);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(19 * u * S, 650);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, cards[i], b.x + 64 * u * S, b.y + 46 * u * S, b.w - 90 * u * S, { maxLines: 2, lineHeight: 1.05, minScale: 0.75 });
    ctx.fillStyle = rgba(palette.text, 0.12);
    const lines = Math.max(1, Math.min(3, Math.floor((b.h - 84 * u * S) / (22 * u * S))));
    for (let l = 0; l < lines; l++) ctx.fillRect(b.x + 20 * u * S, b.y + 84 * u * S + l * 22 * u * S, (b.w - 40 * u * S) * (l === lines - 1 ? 0.55 : 0.9), 9 * u * S);
    ctx.restore();
  }
  // Selections: Maya holds card 1; Leo lassoes card 4.
  const sel = (b: { x: number; y: number; w: number; h: number }, color: string, a: number) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.roundRect(b.x - 5 * u, b.y - 5 * u, b.w + 10 * u, b.h + 10 * u, 17 * u * S);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const [hx, hy] of [[b.x - 5 * u, b.y - 5 * u], [b.x + b.w + 5 * u, b.y - 5 * u], [b.x - 5 * u, b.y + b.h + 5 * u], [b.x + b.w + 5 * u, b.y + b.h + 5 * u]]) {
      ctx.fillRect(hx - 5 * u, hy - 5 * u, 10 * u, 10 * u);
      ctx.strokeRect(hx - 5 * u, hy - 5 * u, 10 * u, 10 * u);
    }
    ctx.restore();
  };
  sel(box(0), PEOPLE[0].color, range(t, T.grab - 0.1, T.grab + 0.05) * (1 - range(t, T.drop + 0.6, T.drop + 0.9)));
  const target = box(Math.min(3, n - 1));
  const l0 = { x: target.x - 30 * u * S, y: target.y - 26 * u * S };
  const l1 = { x: target.x + target.w + 24 * u * S, y: target.y + target.h + 22 * u * S };
  const lk = ease.inOutCubic(range(t, T.lasso0, T.lasso1));
  if (t > T.lasso0 && t < T.lasso1 + 0.25) {
    ctx.save();
    ctx.globalAlpha *= 1 - range(t, T.lasso1, T.lasso1 + 0.25);
    const lx = lerp(l0.x, l1.x, lk);
    const ly = lerp(l0.y, l1.y, lk);
    ctx.fillStyle = rgba(PEOPLE[1].color, 0.1);
    ctx.fillRect(l0.x, l0.y, lx - l0.x, ly - l0.y);
    ctx.strokeStyle = PEOPLE[1].color;
    ctx.lineWidth = 1.5 * u;
    ctx.strokeRect(l0.x, l0.y, lx - l0.x, ly - l0.y);
    ctx.restore();
  }
  sel(target, PEOPLE[1].color, range(t, T.lasso1 - 0.05, T.lasso1 + 0.1));

  // Priya's comment on card 2: a pin, then a bubble that types in.
  const cb = box(Math.min(1, n - 1));
  const pin = { x: cb.x + cb.w - 20 * u * S, y: cb.y + cb.h - 14 * u * S };
  const note = scene.subtext ?? "Looks great, let's ship it";
  if (t > T.comment) {
    const k = clamp(spring(t - T.comment, 14, 7), 0, 1.1);
    ctx.save();
    ctx.translate(pin.x, pin.y);
    ctx.scale(k, k);
    avatar(sc, PEOPLE[2].name, PEOPLE[2].color, 0, 0, 17 * u * S, "#ffffff");
    ctx.restore();
    const bk = clamp(spring(t - T.comment - 0.15, 12, 7), 0, 1.06);
    ctx.save();
    ctx.font = subFont(18 * u * S, 500);
    // Long comments wrap onto a second line; the bubble grows to hold them.
    const nfit = fitTextLines(ctx, note, ww * 0.52 - 40 * u * S, { maxLines: 2, minScale: 0.8 });
    const bw = Math.min(ww * 0.52, nfit.width + 40 * u * S);
    const bh = 64 * u * S + (nfit.lines.length - 1) * nfit.size * 1.15;
    const bx = Math.min(pin.x + 26 * u * S, wx + ww - bw - 12 * u);
    const by = pin.y - 4 * u;
    ctx.globalAlpha *= clamp((t - T.comment - 0.15) / 0.15);
    ctx.translate(bx, by);
    ctx.scale(0.8 + 0.2 * bk, 0.8 + 0.2 * bk);
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 20 * u;
    ctx.shadowOffsetY = 8 * u;
    ctx.beginPath();
    ctx.roundRect(0, 0, bw, bh, [4 * u, 16 * u * S, 16 * u * S, 16 * u * S]);
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.12);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = PEOPLE[2].color;
    ctx.font = subFont(14 * u * S, 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(PEOPLE[2].name, 18 * u * S, 20 * u * S);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(18 * u * S, 500);
    if (t < T.reply) {
      for (let k2 = 0; k2 < 3; k2++) {
        ctx.globalAlpha = clamp((t - T.comment - 0.15) / 0.15) * (0.35 + 0.65 * Math.max(0, Math.sin(t * 9 - k2 * 0.9)));
        ctx.beginPath();
        ctx.arc(24 * u * S + k2 * 14 * u * S, 43 * u * S, 4 * u * S, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.textBaseline = "top";
      fillTextFit(ctx, note, 18 * u * S, 33 * u * S, bw - 36 * u * S, { maxLines: 2, lineHeight: 1.15, minScale: 0.8 });
    }
    ctx.restore();
  }

  // The three cursors.
  const grab0 = { x: box(0).x + cw * 0.42, y: box(0).y + chh * 0.4 };
  const paths: number[][][] = [
    [[0, wx + ww * 0.9, top + ch * 1.05], [0.5, wx + ww * 0.55, top + ch * 0.55], [T.grab - 0.05, grab0.x, grab0.y], [T.grab, grab0.x, grab0.y], [T.drop, grab0.x + ww * 0.05, grab0.y + ch * 0.06], [T.drop + 0.9, wx + ww * 0.44, top + ch * 0.46], [9, wx + ww * 0.44, top + ch * 0.46]],
    [[0, wx + ww * 1.02, top + ch * 0.25], [T.lasso0 - 0.05, l0.x, l0.y], [T.lasso0, l0.x, l0.y], [T.lasso1, l1.x, l1.y], [T.lasso1 + 0.9, wx + ww * 0.82, top + ch * 0.3], [9, wx + ww * 0.82, top + ch * 0.3]],
    [[0, wx - ww * 0.02, top + ch * 0.95], [T.comment - 0.4, pin.x - 40 * u, pin.y + 30 * u], [T.comment - 0.05, pin.x + 6 * u, pin.y + 8 * u], [T.comment + 0.6, pin.x + 6 * u, pin.y + 8 * u], [T.comment + 1.4, pin.x - 60 * u * S, pin.y + 60 * u * S], [9, pin.x - 60 * u * S, pin.y + 60 * u * S]],
  ];
  paths.forEach((keys, i) => {
    const appear = clamp((t - 0.35 - i * 0.2) / 0.3);
    if (appear <= 0) return;
    const busy = (i === 0 && t > T.grab && t < T.drop) || (i === 1 && t > T.lasso0 && t < T.lasso1);
    const p = keyPath(keys, t, busy ? 0 : 5 * u, i * 31 + 3);
    const press = i === 0 ? clamp(1 - Math.abs(t - T.grab) / 0.08) : i === 2 ? clamp(1 - Math.abs(t - T.comment + 0.02) / 0.08) : 0;
    if (i === 2) clickRipple(sc, pin.x, pin.y, range(t, T.comment - 0.02, T.comment + 0.45), PEOPLE[2].color);
    ctx.save();
    ctx.globalAlpha *= appear;
    collabCursor(sc, p.x, p.y, PEOPLE[i].color, PEOPLE[i].name, press, S);
    ctx.restore();
  });
  ctx.restore();
}

/* ───────────────────────── Kanban ───────────────────────── */

function kanbanColumns(scene: Scene) {
  const cols = (scene.subtext ?? "").split(/\s*[/|→>]\s*/).map((s) => s.trim()).filter(Boolean);
  return cols.length === 3 ? cols : ["To do", "In progress", "Done"];
}
function kanbanCards(scene: Scene) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 5);
  return items.length >= 3 ? items : ["Plan the launch", "Design the homepage", "Write release notes", "Review with the team"];
}

type Move = { card: number; to: number; t0: number; t1: number; drag: boolean };
function kanbanTiming(scene: Scene) {
  const n = kanbanCards(scene).length;
  const init = Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : i === n - 2 && n >= 5 ? 2 : 0));
  const moves: Move[] = [
    { card: 0, to: 1, t0: 1.15, t1: 1.9, drag: true },
    { card: 0, to: 2, t0: 2.4, t1: 3.1, drag: true },
  ];
  // Then the rest of the work flows into Done by itself (time compression).
  const rest = init.map((c, i) => ({ c, i })).filter((x) => x.i !== 0 && x.c !== 2).sort((a, b) => b.c - a.c || a.i - b.i);
  rest.forEach((x, k) => moves.push({ card: x.i, to: 2, t0: 3.45 + k * 0.34, t1: 3.45 + k * 0.34 + 0.34, drag: false }));
  const end = moves[moves.length - 1].t1 + 0.3;
  const f = Math.max(0.6, Math.min(1, (scene.duration - 0.9) / end));
  for (const m of moves) {
    m.t0 *= f;
    m.t1 *= f;
  }
  return { init, moves, end: end * f, f };
}

/** Column lists at a moment: a card in flight already holds its place (top) in the target. */
function kanbanState(init: number[], moves: Move[], time: number) {
  const cols: number[][] = [[], [], []];
  init.forEach((c, i) => cols[c].push(i));
  for (const m of moves) {
    if (m.t0 > time) break;
    for (const col of cols) {
      const k = col.indexOf(m.card);
      if (k >= 0) col.splice(k, 1);
    }
    cols[m.to].unshift(m.card);
  }
  return cols;
}

function kanban(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const S = portrait ? 1.4 : 1.2;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const cards = kanbanCards(scene);
  const colNames = kanbanColumns(scene);
  const n = cards.length;
  const icons = iconsFor(cards, sc);
  const { init, moves, end } = kanbanTiming(scene);
  const pad = 20 * u * S;
  const gap = 14 * u * S;
  // Narrow portrait columns: taller cards with the title on two lines, no icon.
  const cardH = (portrait ? 84 : 58) * u * S;
  const cardGap = 11 * u * S;
  const headH = 50 * u * S;
  const ww = portrait ? tokens(w, h).safe.width : Math.min(w * 0.72, 1320 * u);
  const wh = 46 * u + headH + n * (cardH + cardGap) + pad * 1.4;
  const wx = (w - ww) / 2;
  const wy = portrait ? Math.max(h * 0.28, h * 0.56 - wh / 2) : Math.max(h * 0.27, h * 0.6 - wh / 2);
  const colW = (ww - pad * 2 - gap * 2) / 3;
  topHeadline(sc);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc);
  const top = windowChrome(sc, wx, wy, ww, wh, brand?.name ? `${brand.name} — Board` : "Board");
  const colX = (c: number) => wx + pad + c * (colW + gap);
  const slot = (c: number, i: number) => ({ x: colX(c), y: top + headH + i * (cardH + cardGap) });
  const now = kanbanState(init, moves, t);
  const flying = moves.find((m) => t >= m.t0 && t < m.t1);

  // Columns: header with count; Done lights up as it fills.
  for (let c = 0; c < 3; c++) {
    const x = colX(c);
    ctx.fillStyle = hair(palette, c === 2 ? 0.05 + 0.04 * range(t, end - 0.4, end) : 0.035);
    ctx.beginPath();
    ctx.roundRect(x - 6 * u, top + 10 * u * S, colW + 12 * u, wh - (top - wy) - 20 * u * S, 14 * u * S);
    ctx.fill();
    const hy = top + headH / 2 + 4 * u * S;
    const dotC = c === 0 ? rgba(palette.text, 0.4) : c === 1 ? palette.secondary : palette.accent;
    ctx.fillStyle = dotC;
    ctx.beginPath();
    ctx.arc(x + 12 * u * S, hy, 6 * u * S, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.font = subFont(18 * u * S, 650);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const lfit = fitTextLines(ctx, colNames[c], colW - 80 * u * S, { maxLines: 1, minScale: 0.75 });
    ctx.font = lfit.font;
    const label = lfit.lines[0];
    ctx.fillText(label, x + 28 * u * S, hy);
    const lw = ctx.measureText(label).width;
    pill(sc, String(now[c].length), x + 28 * u * S + lw + 22 * u * S, hy, { size: 13 * u * S, padX: 9 * u * S, color: rgba(palette.text, 0.7) });
  }

  // Cards: each eases to its slot whenever the board changes.
  const changes = moves.flatMap((m) => [m.t0]).filter((c) => c <= t);
  const last = changes.length ? changes[changes.length - 1] : -1;
  const before = last >= 0 ? kanbanState(init, moves, last - 1e-4) : now;
  const k = last >= 0 ? ease.outCubic(range(t, last, last + 0.28)) : 1;
  const where = (cols: number[][], card: number) => {
    for (let c = 0; c < 3; c++) {
      const i = cols[c].indexOf(card);
      if (i >= 0) return slot(c, i);
    }
    return null;
  };
  const drawCard = (i: number, x: number, y: number, lift: number, done: boolean) => {
    ctx.save();
    const cx = x + colW / 2;
    const cy = y + cardH / 2;
    ctx.translate(cx, cy);
    ctx.rotate(lift * 0.04);
    ctx.scale(1 + lift * 0.04, 1 + lift * 0.04);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = `rgba(0,0,0,${0.22 + lift * 0.2})`;
    ctx.shadowBlur = (8 + lift * 26) * u;
    ctx.shadowOffsetY = (3 + lift * 14) * u;
    ctx.beginPath();
    ctx.roundRect(x, y, colW, cardH, 12 * u * S);
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.08 + lift * 0.04);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = lift > 0 ? rgba(palette.primary, 0.7 * lift) : hair(palette, 0.1);
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.stroke();
    ctx.fillStyle = [palette.primary, palette.secondary, palette.accent][i % 3];
    ctx.fillRect(x + 12 * u * S, y + 14 * u * S, 4 * u * S, cardH - 28 * u * S);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(17 * u * S, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    if (portrait) {
      // Narrow portrait columns: the card name takes up to three lines rather than losing words.
      fillTextFit(ctx, cards[i], x + 26 * u * S, y + cardH / 2, colW - 72 * u * S, { maxLines: 3, lineHeight: 1.18, minScale: 0.8 });
    } else {
      drawIcon(ctx, icons[i], x + 36 * u * S, y + cardH / 2, 22 * u * S, rgba(palette.text, 0.7));
      fillTextFit(ctx, cards[i], x + 56 * u * S, y + cardH / 2, colW - 104 * u * S, { maxLines: 2, lineHeight: 1.05, minScale: 0.75 });
    }
    ctx.restore();
    if (done) checkBadge(sc, x + colW - 24 * u * S, y + cardH / 2, 12 * u * S, 1);
    else avatar(sc, PEOPLE[i % 4].name, PEOPLE[i % 4].color, x + colW - 24 * u * S, y + cardH / 2, 12 * u * S);
  };
  for (let i = 0; i < n; i++) {
    if (flying?.card === i) continue;
    const a = where(before, i);
    const b = where(now, i);
    if (!b) continue;
    const p = a ? { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) } : b;
    const drop = clamp(spring(t - 0.3 - i * 0.08, 13, 7), 0, 1.06);
    if (drop <= 0) continue;
    const doneAt = moves.filter((m) => m.card === i && m.to === 2).map((m) => m.t1)[0] ?? (init[i] === 2 ? 0 : Infinity);
    ctx.save();
    ctx.globalAlpha *= clamp((t - 0.3 - i * 0.08) / 0.15);
    drawCard(i, p.x, p.y - (1 - Math.min(1, drop)) * 24 * u, 0, t >= doneAt);
    ctx.restore();
  }
  // The drop target shows where the card in flight will land.
  let cursorAt: { x: number; y: number } | null = null;
  if (flying) {
    const from = where(kanbanState(init, moves, flying.t0 - 1e-4), flying.card)!;
    const to = slot(flying.to, 0);
    ctx.save();
    ctx.setLineDash([7 * u, 6 * u]);
    ctx.strokeStyle = rgba(palette.primary, 0.55);
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.roundRect(to.x, to.y, colW, cardH, 12 * u * S);
    ctx.stroke();
    ctx.restore();
    const fk = range(t, flying.t0, flying.t1);
    const e = flying.drag ? ease.inOutCubic(range(fk, 0.18, 0.92)) : ease.inOutCubic(fk);
    const x = lerp(from.x, to.x, e);
    const y = lerp(from.y, to.y, e) - Math.sin(Math.PI * e) * 26 * u * S;
    const lift = Math.min(1, fk / 0.15) * (1 - range(fk, 0.9, 1));
    drawCard(flying.card, x, y, lift, false);
    if (flying.drag) cursorAt = { x: x + colW * 0.34, y: y + cardH * 0.55 };
  }
  // The cursor: to the first card, drag, to it again in the next column, drag, then away.
  const grab = (c: number, i: number) => {
    const s = slot(c, i);
    return { x: s.x + colW * 0.34, y: s.y + cardH * 0.55 };
  };
  const [m1, m2] = moves;
  let cur: { x: number; y: number; lean?: number } | null = cursorAt;
  let press = 0;
  if (!cur) {
    if (t < m1.t0) cur = cursorPath(wx + ww * 0.7, wy + wh + 100 * u, grab(0, 0).x, grab(0, 0).y, range(t, 0.55, m1.t0 - 0.05));
    else if (t < m2.t0) cur = cursorPath(grab(1, 0).x, grab(1, 0).y + 30 * u, grab(1, 0).x, grab(1, 0).y, range(t, m1.t1, m2.t0 - 0.05));
    else {
      const g = grab(2, 0);
      const away = ease.inOutCubic(range(t, m2.t1 + 0.15, m2.t1 + 0.8));
      cur = { x: g.x + away * 70 * u, y: g.y + away * 110 * u };
      ctx.globalAlpha *= 1 - away;
    }
  }
  press = Math.max(clamp(1 - Math.abs(t - m1.t0) / 0.08), clamp(1 - Math.abs(t - m2.t0) / 0.08));
  if (t > 0.5) {
    ctx.save();
    ctx.globalAlpha *= clamp((t - 0.5) / 0.2);
    drawCursor(sc, cur.x, cur.y, press, S, cur.lean ?? 0);
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  doneBadge(sc, "✓  Done", w / 2, wy + wh + (portrait ? 70 : 48) * u, t - end, S);
  ctx.restore();
}

/* ───────────────────────── Before / After ───────────────────────── */

function compareTiming(scene: Scene) {
  return fitTimes({ arrive: 0.95, drag0: 1.0, mid: 1.7, drag1: 2.1, end: 2.9, release: 3.0 }, 3.4, scene.duration);
}

function beforeAfter(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand, seed } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const S = portrait ? 1.3 : 1.2;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const T = compareTiming(scene);
  const pains = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 4);
  const notes = pains.length >= 2 ? pains : ["Scattered spreadsheets", "Endless status meetings", "Copy-pasting between tools", "Lost in email threads"];
  const fw = portrait ? w * 0.9 : Math.min(w * 0.66, h * 0.62 * 1.6);
  const fh0 = portrait ? Math.min(h * 0.56, fw * 1.2) : fw / 1.6;
  const fx = (w - fw) / 2;
  // Under a headline that wraps, the frame starts lower and gets shorter.
  const { y: fy, h: fh } = underHeadline(sc, portrait ? h * 0.3 : Math.max(h * 0.28, h * 0.61 - fh0 / 2), fh0);
  const rr = 22 * u * S;
  // The slider: a peek of "after", dragged to the middle, then all the way across.
  let hk = 0.93;
  hk = lerp(hk, 0.5, ease.inOutCubic(range(t, T.drag0, T.mid)));
  hk = lerp(hk, 0.04, ease.inOutCubic(range(t, T.drag1, T.end)));
  hk = lerp(hk, 0, ease.inOutCubic(range(t, T.release, T.release + 0.5)));
  const hx = fx + fw * hk;
  topHeadline(sc);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc);
  glassCard(sc, fx - 10 * u, fy - 10 * u, fw + 20 * u, fh + 20 * u, { r: rr + 10 * u });
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, rr);
  ctx.clip();

  // After: the product itself (its screenshot, else a UI mock-up in the palette).
  const mediaSrc = scene.media?.src ?? brand?.images?.[0];
  const isPart = !!brand?.parts?.some((p) => p.src === mediaSrc);
  const raw = scene.media ? getMedia(scene.media, t) : mediaSrc ? getImage(mediaSrc) : null;
  const ready = raw && (raw instanceof HTMLVideoElement ? raw.videoWidth : (raw as HTMLImageElement).naturalWidth);
  const shot = ready ? fitted(raw, mediaSrc ?? "after", fw / fh, palette, isPart) : fitted(mockShot(palette, seed, 0), `mock${seed}${palette.primary}${palette.bg1}`, fw / fh, palette, false);
  ctx.fillStyle = palette.bg1;
  ctx.fillRect(fx, fy, fw, fh);
  coverDraw(ctx, shot, fx, fy, fw, fh, 1.02 + 0.04 * range(t, 0, sc.d));

  // Before: grey, cluttered, the site's own pain points on crooked sticky notes.
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, hx - fx, fh);
  ctx.clip();
  const light = !!palette.light;
  ctx.fillStyle = light ? "#e7e7ea" : "#24252b";
  ctx.fillRect(fx, fy, fw, fh);
  const r = rng(hashString(`before${seed}`));
  ctx.strokeStyle = light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)";
  ctx.lineWidth = Math.max(1, u);
  const rowH = 34 * u * S;
  const colW = 130 * u * S;
  for (let y = fy + rowH; y < fy + fh; y += rowH) {
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx + fw, y);
    ctx.stroke();
  }
  for (let x = fx + colW; x < fx + fw; x += colW) {
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x, fy + fh);
    ctx.stroke();
  }
  ctx.fillStyle = light ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  for (let y = fy + rowH; y < fy + fh - rowH; y += rowH) for (let x = fx; x < fx + fw; x += colW) if (r() > 0.45) ctx.fillRect(x + 12 * u, y + rowH * 0.35, (colW - 24 * u) * (0.3 + r() * 0.6), rowH * 0.3);
  // Stray windows piled on top.
  for (let k = 0; k < 3; k++) {
    const x = fx + fw * (0.08 + r() * 0.6);
    const y = fy + fh * (0.12 + r() * 0.55);
    const ww2 = fw * 0.32;
    const wh2 = fh * 0.26;
    ctx.save();
    ctx.translate(x + ww2 / 2, y + wh2 / 2);
    ctx.rotate((r() - 0.5) * 0.12);
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 16 * u;
    ctx.fillStyle = light ? "#f6f6f7" : "#30323a";
    ctx.fillRect(-ww2 / 2, -wh2 / 2, ww2, wh2);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = light ? "#d4d4d8" : "#3d3f48";
    ctx.fillRect(-ww2 / 2, -wh2 / 2, ww2, 16 * u * S);
    ctx.restore();
  }
  const noteW = fw * (portrait ? 0.44 : 0.36);
  const spots = portrait ? [[0.05, 0.08], [0.5, 0.2], [0.07, 0.5], [0.48, 0.66]] : [[0.05, 0.1], [0.55, 0.08], [0.1, 0.55], [0.56, 0.52]];
  notes.forEach((txt, i) => {
    const k = clamp(spring(t - 0.3 - i * 0.12, 13, 7), 0, 1.08);
    if (k <= 0) return;
    const x = fx + fw * spots[i][0];
    const y = fy + fh * spots[i][1];
    ctx.save();
    ctx.font = subFont(19 * u * S, 600);
    const lines = wrapClamp(ctx, txt, noteW - 74 * u * S, 3);
    const nh = 36 * u * S + lines.length * 26 * u * S;
    ctx.translate(x + noteW / 2, y + nh / 2);
    ctx.rotate((i % 2 ? 1 : -1) * (0.04 + 0.02 * i) + Math.sin(t * 1.4 + i) * 0.012);
    ctx.scale(k, k);
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 14 * u;
    ctx.shadowOffsetY = 6 * u;
    ctx.fillStyle = light ? "#f1e7b8" : "#5b5540";
    ctx.fillRect(-noteW / 2, -nh / 2, noteW, nh);
    ctx.shadowColor = "transparent";
    drawIcon(ctx, "TriangleAlert", -noteW / 2 + 32 * u * S, -nh / 2 + 18 * u * S + 13 * u * S, 24 * u * S, "#ef4444");
    ctx.fillStyle = light ? "#3f3a26" : "#f1ead0";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    lines.forEach((ln, j) => ctx.fillText(ln, -noteW / 2 + 58 * u * S, -nh / 2 + 18 * u * S + 13 * u * S + j * 26 * u * S));
    ctx.restore();
  });
  ctx.restore();

  // Labels ride on their own side of the divider.
  const tag = (label: string, x: number, y: number, a: number, good: boolean) => {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    pill(sc, label, x, y, {
      size: 17 * u * S,
      weight: 700,
      fill: good ? rgba(palette.accent, 0.85) : "rgba(20,20,24,0.72)",
      border: "none",
      color: good ? (light ? "#ffffff" : palette.bg0) : "#ffffff",
    });
    ctx.restore();
  };
  const ty = fy + 34 * u * S;
  tag("Before", fx + 70 * u * S, ty, clamp((hx - fx - 150 * u * S) / (40 * u)), false);
  tag("After", fx + fw - 64 * u * S, ty, clamp((fx + fw - hx - 140 * u * S) / (40 * u)) * clamp((t - 0.4) / 0.3), true);
  ctx.restore();

  // Divider and knob.
  const hand = 1 - range(t, T.release + 0.2, T.release + 0.6);
  if (hand > 0) {
    ctx.save();
    ctx.globalAlpha *= hand;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = rgba(palette.primary, 0.8);
    ctx.shadowBlur = 16 * u;
    ctx.fillRect(hx - 1.5 * u, fy, 3 * u, fh);
    const ky = fy + fh / 2;
    const press = clamp(1 - Math.abs(t - T.drag0) / 0.1);
    ctx.beginPath();
    ctx.arc(hx, ky, 28 * u * S * (1 - press * 0.08), 0, TAU);
    ctx.fill();
    ctx.shadowColor = "transparent";
    drawIcon(ctx, "ChevronsLeftRight", hx, ky, 28 * u * S, "#111827");
    ctx.restore();
    // The cursor grabs the knob and drags it.
    const ky2 = ky + 10 * u * S;
    const p = t < T.drag0 ? cursorPath(fx + fw * 0.98, fy + fh + 110 * u, fx + fw * 0.93 + 6 * u, ky2, range(t, 0.45, T.arrive)) : { x: hx + 6 * u, y: ky2 };
    const away = ease.inOutCubic(range(t, T.release, T.release + 0.6));
    ctx.save();
    ctx.globalAlpha *= clamp((t - 0.45) / 0.2) * (1 - away);
    drawCursor(sc, p.x + away * 60 * u, p.y + away * 90 * u, press, S, "lean" in p ? p.lean : 0);
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────────────────── Chat thread ───────────────────────── */

function chatMessages(scene: Scene) {
  const items = (scene.items ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 4);
  return items.length >= 2 ? items : ["Is the launch page ready to go?", "Final copy is in, checking the visuals now", "Looks great, let's ship it"];
}

function chatTiming(scene: Scene) {
  const n = chatMessages(scene).length;
  const msgs = Array.from({ length: n }, (_, i) => 0.55 + i * 0.75);
  const app = msgs[n - 1] + 0.85;
  return fitTimes({ msgs, app, react: msgs[0] + 0.5 }, app + 0.6, scene.duration);
}

function chatThread(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const S = portrait ? 1.55 : 1.15;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const msgs = chatMessages(scene);
  const T = chatTiming(scene);
  const [cardTitle, cardDetail] = (scene.subtext ?? "Update — Tasks complete").split(/\s+[—–]\s+/);
  const name = brand?.name ?? "App";
  const ww = portrait ? tokens(w, h).safe.width : Math.min(w * 0.66, 1240 * u);
  const side = portrait ? 0 : ww * 0.24;
  const mainW = ww - side;
  const lineH = 27 * u * S;
  ctx.font = subFont(19 * u * S, 400);
  // Up to three lines per message, so longer messages are never cut short.
  const bodies = msgs.map((m) => wrapClamp(ctx, m, mainW - 130 * u * S, 3));
  const msgH = bodies.map((b) => 34 * u * S + b.length * lineH + 16 * u * S);
  const cardH = 112 * u * S;
  const headH = 58 * u * S;
  const compH = 74 * u * S;
  const wh = 46 * u + headH + msgH.reduce((a, b) => a + b, 0) + 44 * u * S + cardH + 20 * u * S + compH;
  const wx = (w - ww) / 2;
  const wy = portrait ? Math.max(h * 0.27, h * 0.56 - wh / 2) : Math.max(h * 0.27, h * 0.6 - wh / 2);
  topHeadline(sc);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc);
  const top = windowChrome(sc, wx, wy, ww, wh, `${name} — #team`);
  const mx = wx + side;
  // Sidebar: channels.
  if (side) {
    ctx.fillStyle = hair(palette, 0.04);
    ctx.fillRect(wx, top, side, wy + wh - top);
    ctx.fillStyle = hair(palette, 0.08);
    ctx.fillRect(wx + side, top, Math.max(1, u), wy + wh - top);
    ["general", "team", "launch", "design"].forEach((ch, i) => {
      const y = top + 34 * u * S + i * 40 * u * S;
      if (ch === "team") {
        ctx.fillStyle = rgba(palette.primary, 0.18);
        ctx.beginPath();
        ctx.roundRect(wx + 10 * u, y - 16 * u * S, side - 20 * u, 32 * u * S, 8 * u);
        ctx.fill();
      }
      drawIcon(ctx, "Hash", wx + 30 * u * S, y, 16 * u * S, rgba(palette.text, ch === "team" ? 0.9 : 0.45));
      ctx.fillStyle = rgba(palette.text, ch === "team" ? 0.95 : 0.5);
      ctx.font = subFont(17 * u * S, ch === "team" ? 650 : 500);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, wx + 46 * u * S, y);
    });
  }
  // Channel header.
  drawIcon(ctx, "Hash", mx + 30 * u * S, top + headH / 2, 20 * u * S, palette.text);
  ctx.fillStyle = palette.text;
  ctx.font = subFont(20 * u * S, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("team", mx + 46 * u * S, top + headH / 2);
  PEOPLE.slice(0, 3).forEach((p, i) => avatar(sc, p.name, p.color, mx + mainW - 36 * u * S - (2 - i) * 22 * u * S, top + headH / 2, 13 * u * S, palette.light ? "#ffffff" : mixHex(palette.bg1, "#000000", 0.2)));
  ctx.fillStyle = hair(palette, 0.08);
  ctx.fillRect(mx, top + headH, mainW, Math.max(1, u));

  // Messages, each after a moment of "typing…".
  let y = top + headH + 18 * u * S;
  const ax = mx + 40 * u * S;
  const tx = mx + 72 * u * S;
  let typing: string | null = null;
  msgs.forEach((m, i) => {
    const p = PEOPLE[i % 3];
    const t0 = T.msgs[i];
    if (t > t0 - 0.55 && t < t0) typing = p.name;
    if (t >= t0) {
      const k = ease.outCubic(range(t, t0, t0 + 0.3));
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate(0, (1 - k) * 14 * u);
      avatar(sc, p.name, p.color, ax, y + 20 * u * S, 18 * u * S);
      ctx.fillStyle = palette.text;
      ctx.font = subFont(17 * u * S, 700);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(p.name, tx, y + 12 * u * S);
      ctx.fillStyle = rgba(palette.text, 0.86);
      ctx.font = subFont(19 * u * S, 400);
      bodies[i].forEach((ln, j) => ctx.fillText(ln, tx, y + 12 * u * S + (j + 1) * lineH));
      // A reaction on the first message.
      if (i === 0 && t > T.react) {
        const rk = clamp(spring(t - T.react, 14, 7), 0, 1.12);
        const ry = y + 12 * u * S + (bodies[i].length + 1) * lineH + 2 * u * S;
        ctx.save();
        ctx.translate(tx + 34 * u * S, ry);
        ctx.scale(rk, rk);
        ctx.beginPath();
        ctx.roundRect(-34 * u * S, -14 * u * S, 68 * u * S, 28 * u * S, 14 * u * S);
        ctx.fillStyle = rgba(palette.primary, 0.16);
        ctx.fill();
        ctx.strokeStyle = rgba(palette.primary, 0.5);
        ctx.lineWidth = Math.max(1, 1.2 * u);
        ctx.stroke();
        drawIcon(ctx, "ThumbsUp", -12 * u * S, 0, 16 * u * S, palette.light ? palette.primary : "#ffffff");
        ctx.fillStyle = palette.text;
        ctx.font = subFont(15 * u * S, 700);
        ctx.textAlign = "left";
        ctx.fillText("2", 4 * u * S, 1 * u);
        ctx.restore();
      }
      ctx.restore();
    }
    y += msgH[i] + (i === 0 ? 30 * u * S : 0);
  });
  if (t > T.app - 0.55 && t < T.app) typing = name;

  // The product posts its update card.
  if (t >= T.app) {
    const k = clamp(spring(t - T.app, 12, 7), 0, 1.06);
    ctx.save();
    ctx.globalAlpha *= clamp((t - T.app) / 0.2);
    ctx.translate(0, (1 - Math.min(1, k)) * 20 * u);
    const logo = getImage(brand?.logo);
    if (logo && logo.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(ax - 18 * u * S, y + 2 * u * S, 36 * u * S, 36 * u * S, 9 * u * S);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.clip();
      const s = Math.min((30 * u * S) / logo.naturalWidth, (30 * u * S) / logo.naturalHeight);
      ctx.drawImage(logo, ax - (logo.naturalWidth * s) / 2, y + 20 * u * S - (logo.naturalHeight * s) / 2, logo.naturalWidth * s, logo.naturalHeight * s);
      ctx.restore();
    } else iconTile(sc, "Sparkles", ax, y + 20 * u * S, 36 * u * S);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(17 * u * S, 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, tx, y + 12 * u * S);
    const nw = ctx.measureText(name).width;
    pill(sc, "APP", tx + nw + 30 * u * S, y + 12 * u * S, { size: 11 * u * S, padX: 7 * u * S, color: rgba(palette.text, 0.7) });
    const cy = y + 34 * u * S;
    const cw = Math.min(mainW - 110 * u * S, 560 * u * S);
    ctx.beginPath();
    ctx.roundRect(tx, cy, cw, cardH - 12 * u * S, 12 * u * S);
    ctx.fillStyle = hair(palette, 0.05);
    ctx.fill();
    ctx.strokeStyle = hair(palette, 0.12);
    ctx.lineWidth = Math.max(1, u);
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(tx, cy + 8 * u * S, 4 * u * S, cardH - 28 * u * S);
    checkBadge(sc, tx + 34 * u * S, cy + 30 * u * S, 12 * u * S, (t - T.app - 0.1) / 0.45);
    ctx.fillStyle = palette.text;
    ctx.font = subFont(18 * u * S, 700);
    if (cardDetail) {
      fillTextFit(ctx, cardTitle ?? "Update", tx + 56 * u * S, cy + 30 * u * S, cw - 180 * u * S, { maxLines: 1, minScale: 0.72 });
      ctx.fillStyle = rgba(palette.text, 0.65);
      ctx.font = subFont(16 * u * S, 500);
      fillTextFit(ctx, cardDetail, tx + 22 * u * S, cy + 64 * u * S, cw - 60 * u * S, { maxLines: 2, lineHeight: 1.1, minScale: 0.8 });
    } else {
      // A title with no detail line gets the card's two lines to itself.
      ctx.textBaseline = "top";
      fillTextFit(ctx, cardTitle ?? "Update", tx + 56 * u * S, cy + 20 * u * S, cw - 180 * u * S, { maxLines: 2, lineHeight: 1.15, minScale: 0.8 });
      ctx.textBaseline = "middle";
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= clamp((t - T.app - 0.25) / 0.2);
    const bw = pillWidth(sc, "Open", { size: 15 * u * S });
    pill(sc, "Open", tx + cw - bw / 2 - 16 * u * S, cy + 30 * u * S, { size: 15 * u * S, fill: palette.primary, border: "none", color: palette.light ? "#ffffff" : palette.bg0 });
    ctx.restore();
  }

  // Composer, with the typing indicator above it.
  const cy2 = wy + wh - compH + 12 * u * S;
  ctx.beginPath();
  ctx.roundRect(mx + 20 * u * S, cy2, mainW - 40 * u * S, compH - 28 * u * S, 12 * u * S);
  ctx.strokeStyle = hair(palette, 0.14);
  ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.stroke();
  ctx.fillStyle = rgba(palette.text, 0.38);
  ctx.font = subFont(17 * u * S, 500);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Message #team", mx + 40 * u * S, cy2 + (compH - 28 * u * S) / 2);
  if (typing) {
    const ty = cy2 - 12 * u * S;
    ctx.fillStyle = rgba(palette.text, 0.55);
    for (let k2 = 0; k2 < 3; k2++) {
      ctx.save();
      ctx.globalAlpha *= 0.4 + 0.6 * Math.max(0, Math.sin(t * 9 - k2 * 0.9));
      ctx.beginPath();
      ctx.arc(mx + 30 * u * S + k2 * 10 * u * S, ty, 3.2 * u * S, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.font = subFont(14 * u * S, 500);
    ctx.fillText(`${typing} is typing…`, mx + 66 * u * S, ty);
  }
  ctx.restore();
}

/* ───────────────────────── registry ───────────────────────── */

export const momentSkills: Skill[] = [
  {
    id: "code-deploy",
    name: "Code to Deploy",
    tagline: "Code types into an editor, `git push` runs in the terminal below, the pipeline ticks green and the app goes live.",
    bestFor: "Developer tools, APIs and hosting (Vercel / Supabase style). Headline = the promise ('From commit to *live*'); items = 3–5 pipeline steps (generic: 'Build started', 'Checks passed', 'Deployed').",
    sample: { text: "From commit to *live*", items: ["Build started", "Checks passed", "Preview ready", "Deployed to production"] },
    itemsHint: "3–5 pipeline steps",
    render: codeDeploy,
    sfx: (scene, beat) => {
      const T = codeTiming(scene, beat);
      return [
        ...Array.from({ length: 8 }, (_, i) => at(T.typeStart + (i * (T.typeEnd - T.typeStart)) / 8, "key")),
        ...Array.from({ length: 3 }, (_, i) => at(T.cmd0 + (i * (T.cmd1 - T.cmd0)) / 3, "key")),
        at(T.run, "click"),
        ...T.rows.map((r) => at(r, "tick")),
        at(T.live, "success"),
      ];
    },
  },
  {
    id: "globe",
    name: "Dot Globe",
    tagline: "A dotted world turns while arcs fly between cities, landing with a ping and a live event card (Stripe / Vercel style).",
    bestFor: "Products used across locations: payments, commerce, hosting, messaging, security. Only when the site talks about global / international use. Headline = the site's own words about it, or neutral ('Built for *distributed* teams'; no coverage words or numbers); items = 3–4 generic live events ('Payment received', 'New order').",
    sample: { text: "Your business, *across borders*", items: ["Payment received", "New order", "Invoice paid", "New signup"] },
    itemsHint: "3–4 live events",
    render: globe,
    sfx: (scene) => {
      const T = globeTiming(scene);
      return [at(0.1, "whoosh"), ...T.arcs.flatMap((a) => [at(a, "swoosh"), at(a + T.land, "pop")])];
    },
  },
  {
    id: "live-cursors",
    name: "Live Cursors",
    tagline: "Teammates' named cursors move a card, lasso another and leave a comment on a shared board, their avatars live in the title bar (Figma / Miro style).",
    bestFor: "Collaboration: whiteboards, design, docs, project tools. Headline = working together ('Build it *together*'); items = 3–4 board cards (real features or work items); subtext = the comment.",
    sample: { text: "Build it *together*", subtext: "Looks great, let's ship it", items: ["Launch plan", "Homepage design", "Customer research", "Release notes"] },
    itemsHint: "3–4 cards on the board",
    render: liveCursors,
    sfx: (scene) => {
      const T = cursorsTiming(scene);
      return [at(0.35, "pop"), at(T.grab, "click"), at(T.lasso0, "click"), at(T.comment, "pop"), at(T.reply, "tick")];
    },
  },
  {
    id: "kanban",
    name: "Kanban Board",
    tagline: "A cursor drags a card across the board, then the rest of the work flows into Done by itself (Linear / Trello style).",
    bestFor: "Project, task, hiring and sales-pipeline tools. Headline = the outcome ('Work that *moves*'); items = 3–5 cards (tasks, candidates or deals, generic); subtext = three column names 'To do / In progress / Done'.",
    sample: { text: "Work that *moves*", subtext: "To do / In progress / Done", items: ["Plan the launch", "Design the homepage", "Write release notes", "Review with the team"] },
    itemsHint: "3–5 cards; subtext: 'Col / Col / Col'",
    render: kanban,
    sfx: (scene) => {
      const { moves, end } = kanbanTiming(scene);
      return [at(0.3, "pop"), ...moves.flatMap((m) => (m.drag ? [at(m.t0, "click"), at(m.t1, "tick")] : [at(m.t1, "tick")])), at(end, "success")];
    },
  },
  {
    id: "before-after",
    name: "Before / After",
    tagline: "A comparison slider drags from a grey, cluttered 'before' (the old way's pains on sticky notes) to the product itself.",
    bestFor: "The problem → product moment, when the site names pains. items = 2–4 pain points (the site's own); media = a product screenshot. Headline = neutral ('Leave the old way *behind*').",
    sample: { text: "Leave the old way *behind*", items: ["Scattered spreadsheets", "Endless status meetings", "Copy-pasting between tools", "Lost in email threads"] },
    itemsHint: "2–4 pain points (the old way)",
    render: beforeAfter,
    sfx: (scene) => {
      const T = compareTiming(scene);
      return [at(0.3, "pop"), at(T.drag0, "click"), at(T.drag0 + 0.05, "whoosh"), at(T.drag1, "swoosh"), at(T.end, "success")];
    },
  },
  {
    id: "chat-thread",
    name: "Chat Thread",
    tagline: "Teammates message in a channel with typing indicators and a reaction, then the product posts its update card (Slack / Intercom style).",
    bestFor: "Messaging, support, community and any product that posts updates into chat. items = 2–4 short messages (generic, no names); subtext = the product's card 'Title — detail'.",
    sample: { text: "Your conversations, *one place*", subtext: "Launch checklist — Tasks complete", items: ["Is the launch page ready to go?", "Final copy is in, checking the visuals now", "Looks great, let's ship it"] },
    itemsHint: "2–4 messages; subtext: 'Card title — detail'",
    render: chatThread,
    sfx: (scene) => {
      const T = chatTiming(scene);
      return [...T.msgs.map((m) => at(m, "pop")), at(T.react, "pop"), at(T.app, "success")];
    },
  },
];
