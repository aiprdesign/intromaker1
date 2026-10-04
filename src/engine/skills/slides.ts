/**
 * Classic SaaS launch-film slides, staged in the product's own palette with generic, claim-free
 * copy:
 *
 * - support:          a help centre (a question types into search, articles appear) and the
 *                     support chat widget that answers it.
 * - world-map:        a flat dotted world map: pins pulse, arcs fly between them and land with
 *                     live event cards.
 * - feature-slides:   one full slide per feature (number, icon, title, benefit and the product's
 *                     own UI), with story-style progress bars.
 * - problem-solution: each problem from the site is struck through and answered by the feature
 *                     that solves it.
 */
import { exitT } from "../fx";
import { clamp, ease, hashString, lerp, mixHex, range, rgba, rng, TAU } from "../math";
import { tokens } from "../grid";
import { drawIcon, glassCard, iconsFor, pill, saasBackground, spring } from "../saasfx";
import { fillTextFit, fillTextMid, fitTextLines, subFont } from "../text";
import type { Scene, SfxCue, Skill, SkillContext } from "../types";
import { coverDraw, gallery } from "./gallery";
import { checkBadge, ellipsize, iconTile, windowChrome, wrap, wrapClamp } from "./interactions";
import { avatar, enter, fitTimes, onLand, PEOPLE } from "./moments";
import { topHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const titleOf = (item: string) => item.split(/\s+[—–]\s+/)[0].trim();
const descOf = (item: string) => item.split(/\s+[—–]\s+/)[1]?.trim() ?? "";
const hair = (light: boolean | undefined, a = 0.08) => (light ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
const mono = (size: number, weight = 500) => `${weight} ${Math.round(size)}px "JetBrains Mono", ui-monospace, Menlo, monospace`;

function typingDots(sc: SkillContext, x: number, y: number, r: number, color: string) {
  const { ctx, t } = sc;
  ctx.save();
  ctx.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 9 - k * 0.9));
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    ctx.arc(x + k * r * 3.2, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** A chat bubble; returns its height. */
function bubble(sc: SkillContext, text: string, x: number, y: number, maxW: number, S: number, mine: boolean) {
  const { ctx, u, palette } = sc;
  ctx.save();
  ctx.font = subFont(17 * u * S, 500);
  const lines = wrapClamp(ctx, text, maxW - 32 * u * S, 3);
  const bw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 32 * u * S);
  const bh = lines.length * 24 * u * S + 22 * u * S;
  const bx = mine ? x - bw : x;
  ctx.beginPath();
  ctx.roundRect(bx, y, bw, bh, mine ? [16 * u * S, 16 * u * S, 4 * u, 16 * u * S] : [16 * u * S, 16 * u * S, 16 * u * S, 4 * u]);
  ctx.fillStyle = mine ? palette.primary : hair(palette.light, 0.08);
  ctx.fill();
  ctx.fillStyle = mine ? (palette.light ? "#ffffff" : palette.bg0) : palette.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, bx + 16 * u * S, y + 11 * u * S + 12 * u * S + i * 24 * u * S));
  ctx.restore();
  return bh;
}

/* ───────────────────────── Support ───────────────────────── */

function supportArticles(scene: Scene) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 4);
  return items.length >= 2 ? items : ["Getting started", "Invite your team", "Connect your tools", "Manage your account"];
}
const supportQuery = (scene: Scene) => (scene.subtext ?? "How do I invite my team?").slice(0, 60);

function supportTiming(scene: Scene) {
  const q = supportQuery(scene);
  const n = supportArticles(scene).length;
  const type0 = 0.75;
  const type1 = type0 + Math.min(1.1, q.length * 0.035);
  const results = Array.from({ length: n }, (_, i) => type1 + 0.15 + i * 0.14);
  const chat = results[n - 1] + 0.35;
  const user = chat + 0.35;
  const typing = user + 0.35;
  const reply = typing + 0.65;
  return fitTimes({ type0, type1, results, chat, user, typing, reply }, reply + 0.3, scene.duration);
}

function support(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const S = portrait ? 1.45 : 1.4;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const T = supportTiming(scene);
  const articles = supportArticles(scene);
  const query = supportQuery(scene);
  const name = brand?.name;
  // Vertical: the help window spans the title-safe width, and the chat widget plus its launcher
  // end at the safe area's bottom edge.
  const safe = tokens(w, h).safe;
  const hx = portrait ? safe.left : w * 0.09;
  const hw = portrait ? safe.width : w * 0.5;
  const hy = portrait ? h * 0.27 : h * 0.28;
  const rowH = 58 * u * S;
  const hh = 46 * u + 176 * u * S + articles.length * rowH + 20 * u * S;
  const cw = portrait ? safe.width * 0.84 : w * 0.3;
  const cx = portrait ? safe.right - cw : hx + hw + w * 0.03;
  const cy = portrait ? hy + hh + 24 * u : hy + 30 * u;
  const chH = portrait ? Math.min(safe.top + safe.height - 74 * u * S - cy, 470 * u * S) : Math.min(h * 0.86 - cy, hh);
  topHeadline(sc);
  ctx.save();
  ctx.globalAlpha = (1 - ex) * enter(sc);

  // Help centre.
  const top = windowChrome(sc, hx, hy, hw, hh, name ? `Help center — ${name}` : "Help center");
  const pad = 30 * u * S;
  ctx.fillStyle = palette.text;
  ctx.font = subFont(28 * u * S, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("How can we help?", hx + pad, top + 44 * u * S);
  const sy = top + 78 * u * S;
  const sh = 54 * u * S;
  const focused = t > T.type0 - 0.2;
  ctx.beginPath();
  ctx.roundRect(hx + pad, sy, hw - pad * 2, sh, 12 * u * S);
  ctx.fillStyle = hair(palette.light, 0.05);
  ctx.fill();
  ctx.strokeStyle = focused ? rgba(palette.primary, 0.8) : hair(palette.light, 0.14);
  ctx.lineWidth = Math.max(1, (focused ? 2 : 1.2) * u);
  ctx.stroke();
  drawIcon(ctx, "Search", hx + pad + 26 * u * S, sy + sh / 2, 20 * u * S, rgba(palette.text, 0.6));
  const typed = query.slice(0, Math.ceil(range(t, T.type0, T.type1) * query.length));
  ctx.font = subFont(18 * u * S, 500);
  ctx.fillStyle = typed ? palette.text : rgba(palette.text, 0.4);
  const qx = hx + pad + 50 * u * S;
  ctx.fillText(ellipsize(ctx, typed || "Search articles", hw - pad * 2 - 70 * u * S), qx, sy + sh / 2);
  if (focused && t < T.chat && Math.floor(t * 2.4) % 2 === 0) {
    ctx.fillStyle = palette.primary;
    ctx.fillRect(qx + ctx.measureText(typed).width + 2 * u, sy + sh / 2 - 11 * u * S, 2 * u, 22 * u * S);
  }
  const ry0 = sy + sh + 20 * u * S;
  articles.forEach((a, i) => {
    const k = ease.outCubic(range(t, T.results[i], T.results[i] + 0.3));
    if (k <= 0) return;
    const y = ry0 + i * rowH;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(0, (1 - k) * 14 * u);
    if (i === 0 && t > T.results[0] + 0.35) {
      ctx.fillStyle = rgba(palette.primary, 0.12 * range(t, T.results[0] + 0.35, T.results[0] + 0.6));
      ctx.beginPath();
      ctx.roundRect(hx + pad - 10 * u, y, hw - pad * 2 + 20 * u, rowH - 6 * u, 10 * u * S);
      ctx.fill();
    }
    drawIcon(ctx, "BookOpen", hx + pad + 14 * u * S, y + rowH / 2 - 3 * u, 20 * u * S, i === 0 ? palette.primary : rgba(palette.text, 0.6));
    ctx.fillStyle = palette.text;
    ctx.font = subFont(18 * u * S, 600);
    fillTextFit(ctx, a, hx + pad + 42 * u * S, y + rowH / 2 - 3 * u, hw - pad * 2 - 90 * u * S, { maxLines: 1, minScale: 0.72 });
    drawIcon(ctx, "ChevronRight", hx + hw - pad - 10 * u * S, y + rowH / 2 - 3 * u, 18 * u * S, rgba(palette.text, 0.4));
    ctx.restore();
  });

  // Support chat widget, opening from its launcher.
  const lk = clamp(spring(t - T.chat, 11, 7), 0, 1.06);
  const launch = { x: cx + cw - 30 * u * S, y: Math.min(h - 40 * u * S, cy + chH + 10 * u * S) };
  if (lk > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp((t - T.chat) / 0.15);
    ctx.translate(launch.x, launch.y);
    ctx.scale(0.4 + 0.6 * lk, 0.4 + 0.6 * lk);
    ctx.translate(-launch.x, -launch.y);
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 40 * u;
    ctx.shadowOffsetY = 16 * u;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, chH, 22 * u * S);
    ctx.fillStyle = palette.light ? "#ffffff" : mixHex(palette.bg1, "#ffffff", 0.06);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.clip();
    const headH = 104 * u * S;
    const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + headH);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, palette.secondary);
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy, cw, headH);
    PEOPLE.slice(0, 3).forEach((p, i) => avatar(sc, p.name, p.color, cx + 36 * u * S + i * 26 * u * S, cy + 36 * u * S, 16 * u * S, "#ffffff"));
    ctx.fillStyle = "#ffffff";
    ctx.font = subFont(19 * u * S, 700);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name ? `${name} support` : "Support", cx + 22 * u * S, cy + 70 * u * S);
    ctx.globalAlpha *= 0.85;
    ctx.font = subFont(14 * u * S, 500);
    ctx.fillText("We're here to help", cx + 22 * u * S, cy + 90 * u * S);
    ctx.restore();
    // The conversation.
    let y = cy + headH + 18 * u * S;
    const maxW = cw * 0.82;
    if (t > T.user) {
      const k = ease.outCubic(range(t, T.user, T.user + 0.25));
      ctx.save();
      ctx.globalAlpha *= k;
      y += bubble(sc, query, cx + cw - 16 * u * S, y + (1 - k) * 10 * u, maxW, S, true) + 12 * u * S;
      ctx.restore();
    }
    if (t > T.typing && t < T.reply) typingDots(sc, cx + 30 * u * S, y + 16 * u * S, 4 * u * S, rgba(palette.text, 0.6));
    if (t > T.reply) {
      const k = ease.outCubic(range(t, T.reply, T.reply + 0.25));
      ctx.save();
      ctx.globalAlpha *= k;
      const bh = bubble(sc, "Happy to help! This guide walks you through it:", cx + 16 * u * S, y + (1 - k) * 10 * u, maxW, S, false);
      const ay = y + bh + 8 * u * S;
      const ak = clamp(spring(t - T.reply - 0.2, 13, 7), 0, 1.06);
      if (ak > 0 && ay + 50 * u * S < cy + chH) {
        ctx.translate(cx + 16 * u * S, ay);
        ctx.scale(ak, ak);
        ctx.beginPath();
        ctx.roundRect(0, 0, maxW, 46 * u * S, 12 * u * S);
        ctx.strokeStyle = rgba(palette.primary, 0.6);
        ctx.lineWidth = Math.max(1, 1.4 * u);
        ctx.stroke();
        drawIcon(ctx, "BookOpen", 24 * u * S, 23 * u * S, 18 * u * S, palette.primary);
        ctx.fillStyle = palette.text;
        ctx.font = subFont(16 * u * S, 600);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        fillTextFit(ctx, articles[0], 44 * u * S, 23 * u * S, maxW - 60 * u * S, { maxLines: 1, minScale: 0.72 });
      }
      ctx.restore();
    }
    ctx.restore();
  }
  // Launcher button.
  ctx.save();
  const lb = clamp(spring(t - 0.4, 14, 7), 0, 1.1);
  ctx.translate(launch.x, launch.y + 36 * u * S);
  ctx.scale(lb * 0.9, lb * 0.9);
  ctx.beginPath();
  ctx.arc(0, 0, 28 * u * S, 0, TAU);
  ctx.fillStyle = palette.primary;
  ctx.shadowColor = rgba(palette.primary, 0.6);
  ctx.shadowBlur = 20 * u;
  ctx.fill();
  ctx.shadowBlur = 0;
  drawIcon(ctx, t > T.chat ? "X" : "MessageCircle", 0, 0, 26 * u * S, palette.light ? "#ffffff" : palette.bg0);
  ctx.restore();
  ctx.restore();
}

/* ───────────────────────── World map ───────────────────────── */

/** Well-known cities, used only as pin positions (never labelled, so no presence is implied). */
const CITIES: [number, number][] = [
  [-122.4, 37.8], [-74, 40.7], [-46.6, -23.5], [-99.1, 19.4], [-0.1, 51.5], [13.4, 52.5],
  [3.4, 6.5], [55.3, 25.2], [72.8, 19.1], [103.8, 1.35], [139.7, 35.7], [151.2, -33.9],
];
const LAT0 = 78;
const LAT1 = -56;
let flat: Float32Array | null = null;
function flatDots() {
  if (flat) return flat;
  const out: number[] = [];
  const step = 2;
  for (let lat = LAT0 - 1; lat >= LAT1; lat -= step) for (let lon = -179; lon < 180; lon += step) if (onLand(lon, lat)) out.push(lon, lat);
  flat = new Float32Array(out);
  return flat;
}

function mapTiming(scene: Scene) {
  const n = Math.min(4, Math.max(3, scene.items?.length ?? 4));
  const arcs = Array.from({ length: n }, (_, i) => 0.75 + i * 0.6);
  return fitTimes({ arcs, fly: 0.8 }, arcs[n - 1] + 2.0, scene.duration);
}
function mapItems(scene: Scene) {
  const items = (scene.items ?? []).map(titleOf).filter(Boolean).slice(0, 4);
  return items.length >= 2 ? items : ["New signup", "Payment received", "Order shipped", "Message sent"];
}

function worldMap(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, seed } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.4 });
  const portrait = h > w;
  const S = portrait ? 1.35 : 1.15;
  const ex = ease.inCubic(exitT(sc, 0.45));
  const items = mapItems(scene);
  const icons = iconsFor(items, sc);
  const T = mapTiming(scene);
  const aspect = 360 / (LAT0 - LAT1);
  const availTop = h * (portrait ? 0.3 : 0.27);
  const availH = h * (portrait ? 0.62 : 0.68);
  const mw = portrait ? availH * 0.8 * aspect : Math.min(w * 0.88, availH * aspect);
  const mh = mw / aspect;
  const my = availTop + (availH - mh) / 2;
  // Pins: a spread of cities; arcs join them in turn.
  const r = rng(hashString(`map${seed}`));
  const pool = [...CITIES];
  const pins: [number, number][] = [];
  while (pins.length < items.length + 1 && pool.length) {
    const k = Math.floor(r() * pool.length);
    const c = pool.splice(k, 1)[0];
    if (pins.every((p) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) > 30)) pins.push(c);
  }
  // Portrait shows part of the map, centred on the pins and panning slowly.
  const cLon = pins.reduce((a, p) => a + p[0], 0) / Math.max(1, pins.length);
  const mx = portrait ? w / 2 - ((cLon + 180) / 360) * mw - (t - d / 2) * 18 * u : (w - mw) / 2;
  const X = (lon: number) => mx + ((lon + 180) / 360) * mw;
  const Y = (lat: number) => my + ((LAT0 - lat) / (LAT0 - LAT1)) * mh;

  ctx.save();
  ctx.globalAlpha = clamp(t / 0.3) * (1 - ex);
  topHeadline(sc);
  // Dots, revealed from the centre, with a slow light sweep.
  const all = flatDots();
  const sp = (2 / 360) * mw;
  const ds = Math.max(1.1, sp * 0.3);
  const reveal = ease.outCubic(range(t, 0.05, 0.9));
  const sweep = mx + mw * (((t * 0.22) % 1.3) - 0.15);
  const dotC = palette.light ? mixHex(palette.primary, "#1f2937", 0.5) : mixHex("#ffffff", palette.primary, 0.35);
  ctx.fillStyle = dotC;
  const cxm = w / 2;
  const cym = my + mh / 2;
  const maxR = Math.hypot(mw, mh) / 2;
  const base = clamp(t / 0.3) * (1 - ex);
  for (let i = 0; i < all.length; i += 2) {
    const x = X(all[i]);
    if (x < -ds || x > w + ds) continue;
    const y = Y(all[i + 1]);
    const dist = Math.hypot(x - cxm, y - cym) / maxR;
    if (dist > reveal * 1.1) continue;
    const glow = Math.max(0, 1 - Math.abs(x - sweep) / (mw * 0.08));
    ctx.globalAlpha = base * (0.28 + 0.35 * glow + 0.12 * ((i * 7919) % 5) / 5);
    ctx.beginPath();
    ctx.arc(x, y, ds * (1 + glow * 0.25), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = base;

  // Arcs between pins, each landing with a ping and an event card.
  const arcC = palette.light ? palette.primary : mixHex(palette.primary, "#ffffff", 0.2);
  const cards: { x: number; y: number; i: number; k: number }[] = [];
  items.forEach((_, i) => {
    const a = pins[i];
    const b = pins[i + 1];
    if (!a || !b) return;
    const ax = X(a[0]);
    const ay = Y(a[1]);
    const bx = X(b[0]);
    const by = Y(b[1]);
    const lift = Math.hypot(bx - ax, by - ay) * 0.32;
    const qx = (ax + bx) / 2;
    const qy = Math.min(ay, by) - lift;
    const pt = (s: number) => ({ x: (1 - s) * (1 - s) * ax + 2 * (1 - s) * s * qx + s * s * bx, y: (1 - s) * (1 - s) * ay + 2 * (1 - s) * s * qy + s * s * by });
    const t0 = T.arcs[i];
    const head = ease.inOutCubic(range(t, t0, t0 + T.fly));
    const tail = ease.inOutCubic(range(t, t0 + 1.9, t0 + 2.5));
    // Pins pulse from the start.
    for (const [px, py, when] of [[ax, ay, t0 - 0.2], [bx, by, t0 + T.fly]] as const) {
      if (t < when) continue;
      ctx.save();
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(px, py, 5.5 * u * S, 0, TAU);
      ctx.fill();
      const pk = ((t - when) % 1.4) / 1.4;
      ctx.strokeStyle = palette.accent;
      ctx.globalAlpha *= (1 - pk) * 0.8;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(px, py, 6 * u + pk * 30 * u * S, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (head <= 0 || tail >= 1) return;
    ctx.save();
    ctx.strokeStyle = arcC;
    ctx.lineWidth = Math.max(1.5, 2.6 * u * S);
    ctx.lineCap = "round";
    ctx.shadowColor = rgba(palette.primary, 0.8);
    ctx.shadowBlur = 10 * u;
    ctx.beginPath();
    const N = 40;
    for (let k = 0; k <= N; k++) {
      const s = lerp(tail, head, k / N);
      const p = pt(s);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    if (head < 1) {
      const p = pt(head);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 18 * u;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5 * u * S, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (t > t0 + T.fly) cards.push({ x: bx, y: by, i, k: t - t0 - T.fly });
  });
  for (const c of cards) {
    const life = 1 - range(c.k, 1.25, 1.55);
    if (life <= 0 || c.x < 0 || c.x > w) continue;
    const s = clamp(spring(c.k, 13, 7), 0, 1.08);
    ctx.save();
    ctx.font = subFont(19 * u * S, 600);
    // Long event names wrap onto two lines; the card grows to fit them.
    const fit = fitTextLines(ctx, items[c.i], 320 * u * S, { maxLines: 2, minScale: 0.85 });
    const cw = fit.width + 78 * u * S;
    const ch = Math.max(50 * u * S, fit.lines.length * fit.size * 1.12 + 24 * u * S);
    const safe = tokens(w, h).safe;
    const bx = clamp(c.x - cw / 2, safe.left, safe.right - cw);
    const by = Math.max(my - 20 * u, c.y - ch - 20 * u * S);
    ctx.globalAlpha *= life * clamp(c.k / 0.12);
    ctx.translate(c.x, by + ch);
    ctx.scale(0.7 + 0.3 * s, 0.7 + 0.3 * s);
    ctx.translate(-c.x, -(by + ch));
    glassCard(sc, bx, by, cw, ch, { r: 14 * u * S });
    iconTile(sc, icons[c.i], bx + 28 * u * S, by + ch / 2, 30 * u * S);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fillTextFit(ctx, items[c.i], bx + 54 * u * S, by + ch / 2, fit.width + 2, { maxLines: 2, lineHeight: 1.12, minScale: 0.85 });
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────────────────── Feature slides ───────────────────────── */

function slideItems(scene: Scene) {
  const items = (scene.items ?? []).filter((x) => titleOf(x)).slice(0, 4);
  return items.length >= 2
    ? items
    : ["Real-time dashboards — See signups, events and conversions as they happen", "Automations — Hand off the busywork and keep things moving", "Team spaces — Plan, share and ship together in one place"];
}
function slidesTiming(scene: Scene) {
  const n = slideItems(scene).length;
  const intro = 0.25;
  const slot = (scene.duration - intro - 0.35) / n;
  return { n, intro, slot, starts: Array.from({ length: n }, (_, i) => intro + i * slot) };
}

function featureSlides(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const S = portrait ? 1.35 : 1.3;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const items = slideItems(scene);
  const { n, slot, starts } = slidesTiming(scene);
  const icons = iconsFor(items, sc);
  const va = portrait ? 1.35 : 1.5;
  const imgs = gallery(sc, n, va);
  ctx.save();
  ctx.globalAlpha = 1 - ex;

  // Header: chapter + story-style progress bars.
  const bx0 = w * (portrait ? 0.07 : 0.08);
  const bw = w - bx0 * 2;
  const by = h * (portrait ? 0.1 : 0.14);
  const label = (scene.text || "").replace(/\*/g, "").replace(/\|.*$/, "");
  ctx.fillStyle = rgba(palette.text, 0.75);
  ctx.font = subFont(20 * u * S, 600);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = (1 - ex) * clamp(t / 0.3);
  fillTextFit(ctx, label, bx0, by - 18 * u * S, bw * 0.7, { maxLines: 1, minScale: 0.72 });
  const gap = 10 * u;
  const segW = (bw - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = bx0 + i * (segW + gap);
    ctx.fillStyle = hair(palette.light, 0.14);
    ctx.beginPath();
    ctx.roundRect(x, by, segW, 5 * u, 3 * u);
    ctx.fill();
    const k = clamp((t - starts[i]) / slot);
    if (k > 0) {
      const g = ctx.createLinearGradient(x, 0, x + segW, 0);
      g.addColorStop(0, palette.primary);
      g.addColorStop(1, palette.accent);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, by, Math.max(5 * u, segW * k), 5 * u, 3 * u);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1 - ex;

  // The slides: text on one side, the product on the other.
  const tx = portrait ? w * 0.07 : w * 0.08;
  const tw = portrait ? w * 0.86 : w * 0.36;
  const vw = portrait ? w * 0.86 : w * 0.44;
  const vh = vw / va;
  const vx = portrait ? w * 0.07 : w * 0.49;
  const vy = portrait ? h * 0.5 : h * 0.57 - vh / 2;
  const ty = portrait ? h * 0.17 : h * 0.57;
  for (let i = 0; i < n; i++) {
    const lt = t - starts[i];
    if (lt < -0.05 || lt > slot + 0.05) continue;
    const last = i === n - 1;
    const inK = ease.outCubic(clamp(lt / 0.45));
    const outK = last ? 0 : ease.inCubic(range(lt, slot - 0.3, slot));
    const title = titleOf(items[i]);
    const desc = descOf(items[i]);
    // Product visual.
    ctx.save();
    ctx.globalAlpha *= clamp(lt / 0.3) * (1 - outK);
    const vxo = vx + (1 - inK) * 70 * u - outK * 40 * u;
    const sc0 = 0.95 + 0.05 * inK;
    ctx.translate(vxo + vw / 2, vy + vh / 2);
    ctx.scale(sc0, sc0);
    ctx.translate(-(vxo + vw / 2), -(vy + vh / 2));
    const halo = ctx.createRadialGradient(vxo + vw / 2, vy + vh / 2, vw * 0.1, vxo + vw / 2, vy + vh / 2, vw * 0.75);
    halo.addColorStop(0, rgba(palette.primary, palette.light ? 0.15 : 0.3));
    halo.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(vxo - vw * 0.3, vy - vh * 0.4, vw * 1.6, vh * 1.8);
    glassCard(sc, vxo - 10 * u, vy - 10 * u, vw + 20 * u, vh + 20 * u, { r: 22 * u });
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(vxo, vy, vw, vh, 16 * u);
    ctx.clip();
    const img = imgs[i % imgs.length];
    if (img) coverDraw(ctx, img, vxo, vy, vw, vh, 1.02 + 0.03 * clamp(lt / slot));
    ctx.restore();
    // Callout on the visual.
    const ck = clamp(spring(lt - 0.35, 13, 7), 0, 1.08);
    if (ck > 0) {
      ctx.font = subFont(18 * u * S, 650);
      const cwid = Math.min(vw * 0.8, ctx.measureText(title).width + 76 * u * S);
      const cxp = vxo + 24 * u;
      const cyp = vy + vh - 24 * u - 50 * u * S;
      ctx.save();
      ctx.translate(cxp, cyp + 50 * u * S);
      ctx.scale(ck, ck);
      ctx.translate(-cxp, -(cyp + 50 * u * S));
      glassCard(sc, cxp, cyp, cwid, 50 * u * S, { r: 14 * u * S });
      iconTile(sc, icons[i], cxp + 27 * u * S, cyp + 25 * u * S, 30 * u * S);
      ctx.fillStyle = palette.text;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      fillTextFit(ctx, title, cxp + 52 * u * S, cyp + 26 * u * S, cwid - 66 * u * S, { maxLines: 1, minScale: 0.72 });
      ctx.restore();
    }
    ctx.restore();
    // Text block: number, icon, title, benefit, staggered in.
    const part = (delay: number) => {
      const k = ease.outCubic(clamp((lt - delay) / 0.4));
      return { a: k * (1 - outK), dy: (1 - k) * 34 * u - outK * 26 * u };
    };
    ctx.save();
    ctx.font = subFont(50 * u * S, 800);
    const tl = wrapClamp(ctx, title, tw, 2);
    ctx.font = subFont(24 * u * S, 450);
    const dl = desc ? wrapClamp(ctx, desc, tw, 3) : [];
    const blockH = 64 * u * S + 24 * u * S + tl.length * 58 * u * S + 16 * u * S + dl.length * 34 * u * S;
    let y = portrait ? ty : ty - blockH / 2;
    let p = part(0);
    ctx.globalAlpha = (1 - ex) * p.a;
    iconTile(sc, icons[i], tx + 32 * u * S, y + 32 * u * S + p.dy, 64 * u * S);
    ctx.fillStyle = palette.accent;
    ctx.font = mono(20 * u * S, 600);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`, tx + 84 * u * S, y + 32 * u * S + p.dy);
    y += 64 * u * S + 24 * u * S;
    p = part(0.06);
    ctx.globalAlpha = (1 - ex) * p.a;
    ctx.fillStyle = palette.text;
    ctx.font = subFont(50 * u * S, 800);
    ctx.textBaseline = "top";
    tl.forEach((l, j) => ctx.fillText(l, tx, y + j * 58 * u * S + p.dy));
    y += tl.length * 58 * u * S + 16 * u * S;
    p = part(0.12);
    ctx.globalAlpha = (1 - ex) * p.a;
    ctx.fillStyle = rgba(palette.text, 0.72);
    ctx.font = subFont(24 * u * S, 450);
    dl.forEach((l, j) => ctx.fillText(l, tx, y + j * 34 * u * S + p.dy));
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────────────────── Problem → solution ───────────────────────── */

export function parsePairs(scene: Scene): [string, string][] {
  const pairs = (scene.items ?? [])
    .map((x) => x.split(/\s*(?:→|->|=>)\s*/).map((s) => s.trim()))
    .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1]);
  return pairs.length >= 2
    ? pairs
    : [["Scattered spreadsheets", "One shared workspace"], ["Endless status meetings", "Live progress for your team"], ["Copy-pasting between tools", "Your tools, connected"]];
}

function solveTiming(scene: Scene) {
  const n = parsePairs(scene).length;
  const step = clamp((scene.duration - 1.6) / n, 0.7, 1.0);
  const rows = Array.from({ length: n }, (_, i) => 0.5 + i * step);
  return { rows, end: rows[n - 1] + 0.9 };
}

function problemSolution(sc: SkillContext) {
  const { ctx, w, h, t, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 1 });
  const portrait = h > w;
  const S = portrait ? 1.35 : 1.4;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const pairs = parsePairs(scene).slice(0, portrait ? 3 : 4);
  const n = pairs.length;
  const T = solveTiming({ ...scene, items: pairs.map((p) => p.join(" → ")) });
  const red = "#ef4444";
  const name = brand?.name ?? "the new way";
  topHeadline(sc);
  ctx.save();
  ctx.globalAlpha = 1 - ex;
  const card = (x: number, y: number, cw: number, chh: number, text: string, good: boolean, k: number, strike: number) => {
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp(k * 1.5);
    const s = good ? 0.85 + 0.15 * Math.min(1, k) : 1;
    ctx.translate(x + cw / 2 + (good ? 0 : (1 - Math.min(1, k)) * -50 * u), y + chh / 2);
    ctx.scale(s, s);
    ctx.translate(-(x + cw / 2), -(y + chh / 2));
    if (good) {
      glassCard(sc, x, y, cw, chh, { r: 16 * u * S });
      ctx.strokeStyle = rgba(palette.accent, 0.55);
      ctx.lineWidth = Math.max(1, 1.6 * u);
      ctx.beginPath();
      ctx.roundRect(x, y, cw, chh, 16 * u * S);
      ctx.stroke();
      checkBadge(sc, x + 34 * u * S, y + chh / 2, 14 * u * S, k);
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y, cw, chh, 16 * u * S);
      ctx.fillStyle = hair(palette.light, 0.04);
      ctx.fill();
      ctx.strokeStyle = rgba(red, 0.25 + 0.2 * (1 - strike));
      ctx.lineWidth = Math.max(1, 1.2 * u);
      ctx.stroke();
      drawIcon(ctx, "CircleX", x + 34 * u * S, y + chh / 2, 26 * u * S, rgba(red, 0.9 - 0.4 * strike));
    }
    ctx.font = subFont(21 * u * S, good ? 700 : 500);
    const lines = wrapClamp(ctx, text, cw - 90 * u * S, 2);
    ctx.fillStyle = good ? palette.text : rgba(palette.text, 0.85 - 0.35 * strike);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const lx = x + 64 * u * S;
    lines.forEach((l, j) => {
      const ly = y + chh / 2 + (j - (lines.length - 1) / 2) * 28 * u * S;
      fillTextMid(ctx, l, lx, ly);
      if (!good && strike > 0) {
        const lw = ctx.measureText(l).width;
        const sk = clamp(strike * lines.length - j);
        ctx.strokeStyle = red;
        ctx.lineWidth = 2.5 * u * S;
        ctx.beginPath();
        ctx.moveTo(lx - 4 * u, ly);
        ctx.lineTo(lx - 4 * u + (lw + 8 * u) * sk, ly);
        ctx.stroke();
      }
    });
    ctx.restore();
  };
  const arrow = (x0: number, y0: number, x1: number, y1: number, k: number) => {
    if (k <= 0) return;
    const x = lerp(x0, x1, k);
    const y = lerp(y0, y1, k);
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.fillStyle = palette.accent;
    ctx.lineWidth = 2.5 * u * S;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x, y);
    ctx.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const hs = 10 * u * S;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * 2, y + Math.sin(ang) * 2);
    ctx.lineTo(x - Math.cos(ang - 0.5) * hs, y - Math.sin(ang - 0.5) * hs);
    ctx.lineTo(x - Math.cos(ang + 0.5) * hs, y - Math.sin(ang + 0.5) * hs);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  const rowK = (i: number) => {
    const t0 = T.rows[i];
    return {
      pk: ease.outCubic(range(t, t0, t0 + 0.3)),
      strike: ease.inOutCubic(range(t, t0 + 0.3, t0 + 0.55)),
      ak: ease.inOutCubic(range(t, t0 + 0.45, t0 + 0.65)),
      sk: clamp(spring(t - t0 - 0.6, 12, 7), 0, 1.06),
    };
  };
  if (portrait) {
    const y0 = h * 0.29;
    const blockH = (h * 0.66) / n;
    const cw = w * 0.86;
    const x = w * 0.07;
    // Each pair reads as one unit: problem, a short arrow, its solution; then a clear gap.
    const chh = Math.min(96 * u * S, blockH * 0.32);
    const gapA = 54 * u;
    pairs.forEach(([p, s], i) => {
      const k = rowK(i);
      const y = y0 + i * blockH;
      card(x, y, cw, chh, p, false, k.pk, k.strike);
      arrow(w / 2, y + chh + 8 * u, w / 2, y + chh + gapA - 8 * u, k.ak);
      card(x, y + chh + gapA, cw, chh, s, true, k.sk, 0);
    });
  } else {
    const colW = w * 0.36;
    const lx = w * 0.08;
    const rx = w - w * 0.08 - colW;
    const y0 = h * 0.37;
    const rowH = Math.min(118 * u * S, (h * 0.58) / n);
    const chh = rowH - 18 * u;
    const hk = clamp(t / 0.4);
    ctx.save();
    ctx.globalAlpha *= hk;
    pill(sc, "The old way", lx + colW / 2, y0 - 30 * u * S, { size: 15 * u * S, color: rgba(palette.text, 0.75) });
    pill(sc, `With ${name}`, rx + colW / 2, y0 - 30 * u * S, { size: 15 * u * S, weight: 700, fill: rgba(palette.accent, 0.18), border: rgba(palette.accent, 0.5) });
    ctx.restore();
    pairs.forEach(([p, s], i) => {
      const k = rowK(i);
      const y = y0 + i * rowH;
      card(lx, y, colW, chh, p, false, k.pk, k.strike);
      arrow(lx + colW + 20 * u, y + chh / 2, rx - 20 * u, y + chh / 2, k.ak);
      card(rx, y, colW, chh, s, true, k.sk, 0);
    });
  }
  ctx.restore();
}

/* ───────────────────────── registry ───────────────────────── */

export const slideSkills: Skill[] = [
  {
    id: "support",
    name: "Support",
    tagline: "A help centre where a question types into search and articles appear, then the support chat widget opens and answers.",
    bestFor: "When the site talks about support, docs, onboarding or a help centre. Headline = neutral ('Support, *built in*'; no response-time or 24/7 claims unless the site makes them); subtext = the question typed; items = 3–4 help-article titles.",
    sample: { text: "Support, *built in*", subtext: "How do I invite my team?", items: ["Getting started", "Invite your team", "Connect your tools", "Manage your account"] },
    itemsHint: "3–4 help articles; subtext: the question",
    render: support,
    sfx: (scene) => {
      const T = supportTiming(scene);
      return [
        ...Array.from({ length: 6 }, (_, i) => at(T.type0 + (i * (T.type1 - T.type0)) / 6, "key")),
        ...T.results.map((r) => at(r, "tick")),
        at(T.chat, "pop"),
        at(T.user, "pop"),
        at(T.reply, "success"),
      ];
    },
  },
  {
    id: "world-map",
    name: "World Map",
    tagline: "A flat dotted world map: pins pulse, arcs fly between them and land with live event cards.",
    bestFor: "Products used across countries, regions, currencies or languages, ONLY when the site says so. Headline = the site's words or neutral; items = 3–4 generic live events ('Payment received', 'New order'). No coverage numbers.",
    sample: { text: "Your business, *across borders*", items: ["Payment received", "New order", "Invoice paid", "New signup"] },
    itemsHint: "3–4 live events",
    render: worldMap,
    sfx: (scene) => {
      const T = mapTiming(scene);
      return [at(0.1, "whoosh"), ...T.arcs.flatMap((a) => [at(a, "swoosh"), at(a + T.fly, "pop")])];
    },
  },
  {
    id: "feature-slides",
    name: "Feature Slides",
    tagline: "One full slide per feature (number, icon, title, benefit and the product's own UI) with story-style progress bars.",
    bestFor: "Long videos with 2–4 real features that have one-line benefits, and product screenshots or captured UI to show. Headline = a short chapter label ('Inside *Orbit*'); items = 'Title — one-line benefit'.",
    sample: { text: "Inside *the product*", items: ["Real-time dashboards — See signups, events and conversions as they happen", "Automations — Hand off the busywork and keep things moving", "Team spaces — Plan, share and ship together in one place"] },
    itemsHint: "2–4 'Title — benefit'",
    render: featureSlides,
    sfx: (scene) => slidesTiming(scene).starts.map((s) => at(s, "whoosh")),
  },
  {
    id: "problem-solution",
    name: "Problem → Solution",
    tagline: "The site's problems are struck through one by one, and an arrow draws to the feature that answers them.",
    bestFor: "When the site names 2–4 pains and features that answer them. items = 'Problem → Solution' pairs (the site's own pains and feature titles); headline neutral ('From problem to *solution*'; not comparative claims like 'a better way').",
    sample: { text: "From problem to *solution*", items: ["Scattered spreadsheets → One shared workspace", "Endless status meetings → Live progress for your team", "Copy-pasting between tools → Your tools, connected"] },
    itemsHint: "2–4 'Problem → Solution'",
    render: problemSolution,
    sfx: (scene) => {
      const T = solveTiming(scene);
      return [...T.rows.flatMap((r) => [at(r + 0.3, "strike"), at(r + 0.6, "pop")]), at(T.end, "success")];
    },
  },
];
