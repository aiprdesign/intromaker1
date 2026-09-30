/**
 * Brand bookends: a Liquid Logo sting (the logo pours in as glossy liquid) and a QR End Card
 * (the closing line with a scannable code for the website, for talks, events and big screens).
 */
import { encode } from "uqr";
import { ctaClickAt, revealHit } from "../arrange";
import { exitT, subline } from "../fx";
import { liquidText } from "../gl";
import { clamp, ease, lerp, range, rgba, TAU } from "../math";
import { drawLogo, getImage } from "../media";
import { blurInLayout, borderBeam, brandGlyph, pill, saasBackground, sentence, spring } from "../saasfx";
import { scratch } from "../scratch";
import { autoAccent, subFont } from "../text";
import type { SfxCue, Skill, SkillContext } from "../types";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });
const plain = (s: string) => s.replace(/\*/g, "").trim();

/* ───────────────────────── Liquid Logo ───────────────────────── */

function liquidTiming(d: number, beat: number) {
  const hit = revealHit(d, beat);
  return { hit, pour: Math.max(0.15, hit - 0.2), sheen: hit + 0.9, tag: hit + 0.75 };
}

/**
 * The finished lock-up (mark + name) on a transparent canvas, in frame pixels. Returns the canvas
 * and where it sits in the frame.
 */
function lockup(sc: SkillContext) {
  const { w, h, palette, brand, scene } = sc;
  const img = getImage(brand?.logo);
  const logo = img && img.naturalWidth ? img : null;
  const ar = logo ? logo.naturalWidth / logo.naturalHeight : 1;
  // A wide wordmark already spells the name.
  const wordmark = !!logo && ar >= 1.8;
  const name = plain(scene.text) || brand?.name || "";
  const tall = h > w;
  const short = Math.min(w, h);
  const mark = short * (tall ? 0.21 : 0.19);
  const font = `800 ${Math.round(mark * (tall ? 0.42 : 0.5))}px Inter, sans-serif`;
  const probe = scratch("liquid-logo-probe", 4, 4).ctx;
  probe.font = font;
  const nameW = wordmark || !name ? 0 : probe.measureText(name).width;
  const markW = wordmark ? Math.min(w * 0.62, mark * 1.1 * ar) : logo ? Math.min(mark * 1.6, mark * ar) : mark;
  const markH = wordmark ? markW / ar : logo ? markW / ar : mark;
  const gap = mark * 0.28;
  // Side by side on wide frames; stacked on tall ones or when the name is long.
  const stacked = !wordmark && !!name && (tall || markW + gap + nameW > w * 0.8);
  const pad = mark * 0.5;
  const bw = Math.ceil((stacked ? Math.max(markW, nameW) : markW + (nameW ? gap + nameW : 0)) + pad * 2);
  const nameH = nameW ? mark * 0.62 : 0;
  const bh = Math.ceil((stacked ? markH + gap + nameH : Math.max(markH, nameH)) + pad * 2);
  const off = scratch("liquid-logo", Math.max(2, bw), Math.max(2, bh));
  const c = off.ctx;
  const mx = stacked ? bw / 2 - markW / 2 : pad;
  const my = stacked ? pad : bh / 2 - markH / 2;
  if (logo) drawLogo(c, logo, !!palette.light, mx, my, markW, markH);
  else brandGlyph({ ...sc, ctx: c }, mx + markW / 2, my + markH / 2, markW * 0.86, 1, 0.9);
  if (nameW) {
    c.font = font;
    c.textBaseline = "middle";
    c.textAlign = stacked ? "center" : "left";
    const nx = stacked ? bw / 2 : pad + markW + gap;
    const ny = stacked ? pad + markH + gap + nameH / 2 : bh / 2;
    const g = c.createLinearGradient(nx - (stacked ? nameW / 2 : 0), 0, nx + (stacked ? nameW / 2 : nameW), 0);
    g.addColorStop(0, palette.text);
    g.addColorStop(1, palette.light ? palette.primary : rgba(palette.text, 0.82));
    c.fillStyle = g;
    c.fillText(name, nx, ny);
  }
  const cy = h * (tall ? 0.44 : 0.46);
  return { canvas: off.canvas, x: Math.round(w / 2 - bw / 2), y: Math.round(cy - bh / 2), bw, bh, mark };
}

function liquidLogo(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  saasBackground(sc, { beams: 0, aurora: 0.5 });
  const T = liquidTiming(d, sc.beat);
  const ex = ease.inCubic(exitT(sc, 0.45));
  const L = lockup(sc);
  const cx = w / 2;
  const cy = L.y + L.bh / 2;

  // Droplets fall and merge into the spot where the logo pours in.
  const drops = [
    { x: -0.18, delay: 0, r: 0.05 },
    { x: 0.12, delay: 0.12, r: 0.038 },
    { x: 0.02, delay: 0.24, r: 0.03 },
  ];
  ctx.save();
  for (const dr of drops) {
    const k = range(t, dr.delay, T.pour + 0.05);
    if (k <= 0 || k >= 1) continue;
    const y = lerp(-h * 0.1, cy, ease.inCubic(k));
    const x = cx + dr.x * L.bw * (1 - ease.inCubic(k));
    const r = Math.min(w, h) * dr.r * (1 + 0.5 * ease.inCubic(k));
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
    g.addColorStop(0, rgba("#ffffff", 0.9));
    g.addColorStop(0.35, rgba(palette.primary, 0.95));
    g.addColorStop(1, rgba(palette.secondary, 0.9));
    ctx.fillStyle = g;
    ctx.beginPath();
    // Stretched along the fall.
    ctx.ellipse(x, y, r * 0.86, r * (1 + 0.5 * k), 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Ripples spread from the splash as the logo lands.
  for (let i = 0; i < 3; i++) {
    const k = range(t, T.hit + i * 0.14, T.hit + 1.3 + i * 0.14);
    if (k <= 0 || k >= 1) continue;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.5 * (1 - ex);
    ctx.strokeStyle = i === 1 ? palette.secondary : palette.primary;
    ctx.lineWidth = (3 - i) * u;
    ctx.beginPath();
    ctx.ellipse(cx, cy, L.bw * (0.35 + 0.6 * ease.outCubic(k)), L.bh * (0.3 + 0.55 * ease.outCubic(k)), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // The lock-up pours in on the GPU; without WebGL it springs in.
  const poured = t >= T.pour
    ? liquidText(L.canvas, {
        t: t - T.pour,
        spread: 0.45,
        dur: 0.75,
        exit: ex,
        drop: Math.min(0.6, (L.mark * 0.9) / L.bh),
        goo: L.mark * 0.16,
      })
    : null;
  ctx.save();
  if (poured) {
    ctx.shadowColor = rgba(palette.primary, 0.55 * clamp(range(t, T.hit, T.hit + 0.6)));
    ctx.shadowBlur = 36 * u;
    ctx.drawImage(poured, L.x, L.y, L.bw, L.bh);
  } else if (t >= T.pour) {
    const k = clamp(spring(t - T.pour, 10, 7), 0, 1.06);
    ctx.globalAlpha = clamp(k) * (1 - ex);
    ctx.translate(cx, cy);
    ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    ctx.drawImage(L.canvas, -L.bw / 2, -L.bh / 2);
  }
  ctx.restore();

  // A glossy sheen slides across once the liquid has set.
  const sk = range(t, T.sheen, T.sheen + 0.8);
  if (sk > 0 && sk < 1) {
    const off = scratch("liquid-logo-sheen", L.bw, L.bh);
    off.ctx.drawImage(L.canvas, 0, 0);
    off.ctx.globalCompositeOperation = "source-in";
    const sx = lerp(-L.bw * 0.3, L.bw * 1.3, ease.inOutCubic(sk));
    const g = off.ctx.createLinearGradient(sx - L.bw * 0.15, 0, sx + L.bw * 0.15, L.bh * 0.3);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    off.ctx.fillStyle = g;
    off.ctx.fillRect(0, 0, L.bw, L.bh);
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
    ctx.drawImage(off.canvas, L.x, L.y);
    ctx.restore();
  }

  subline(sc, L.y + L.bh + 40 * u, range(t, T.tag, T.tag + 0.6), { alpha: 0.9 * (1 - ex) });
}

/* ───────────────────────── QR End Card ───────────────────────── */

/** What the code opens: the scene's link if given, else the brand's website. */
export function qrTarget(sc: Pick<SkillContext, "scene" | "brand">): string | null {
  const raw = (sc.scene.items?.[0] ?? "").trim() || sc.brand?.domain || "";
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!/\./.test(u.hostname)) return null;
    const s = u.toString();
    return u.pathname === "/" && !u.search && !u.hash ? s.replace(/\/$/, "") : s;
  } catch {
    return null;
  }
}

const qrCache = new Map<string, ReturnType<typeof encode>>();
function qrFor(text: string) {
  let q = qrCache.get(text);
  if (!q) {
    // High error correction so the small brand mark in the middle never stops it scanning.
    q = encode(text, { ecc: "H", border: 0 });
    qrCache.set(text, q);
  }
  return q;
}

function qrTiming(d: number, beat: number) {
  // The scan lands with the final chord, like the CTA's click (see arrange.ts).
  const scan = ctaClickAt(d, beat);
  return { card: 0.15, modules: 0.45, fill: Math.max(0.6, Math.min(1.1, scan - 0.8)), scan };
}

function qrEnd(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, brand } = sc;
  saasBackground(sc, { beams: 2 });
  const T = qrTiming(d, sc.beat);
  const tall = h > w;
  const square = !tall && w / h < 1.3;
  const target = qrTarget(sc);
  // No website and no link yet: an honest placeholder that asks for one (never a made-up address).
  const url = target ?? "https://example.com";
  const q = qrFor(url);
  const n = q.size;
  const short = Math.min(w, h);
  // Big enough to scan from across a room: about half the short side.
  const codeW = Math.round(tall ? w * 0.5 : square ? short * 0.36 : short * 0.46);
  const quiet = 3; // modules of white margin around the code
  const mod = codeW / n;
  const cardW = codeW + mod * quiet * 2;
  const cardX = tall || square ? w / 2 - cardW / 2 : w * 0.72 - cardW / 2;
  const cardY = tall ? h * 0.4 : square ? h * 0.3 : h / 2 - cardW / 2 - 24 * u;
  const colX = tall || square ? 0 : -w * 0.16; // text column offset from centre

  // Text column: closing line, then the label under it.
  ctx.save();
  ctx.translate(colX, 0);
  const layout = sentence(sc, {
    text: autoAccent(scene.text),
    cy: tall ? h * 0.24 : square ? h * 0.17 : h * 0.43,
    sizeFrac: tall ? 0.11 : square ? 0.1 : 0.125,
    widthFrac: tall || square ? 0.84 : 0.44,
    maxLines: tall ? 3 : 2,
  });
  blurInLayout(sc, layout, 0.1, Math.min(0.11, sc.beat / 2), { exitAt: d + 1 });
  const labelY = layout.ys[layout.ys.length - 1] + layout.size * 0.5 + 56 * u;
  if (!(tall || square)) {
    const lk = ease.outCubic(range(t, T.modules, T.modules + 0.5));
    ctx.save();
    ctx.globalAlpha = lk;
    ctx.font = subFont(38 * u, 600);
    ctx.fillStyle = rgba(palette.text, 0.85);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${(scene.subtext || "Scan to get started").replace(/\s*[→›»>]+\s*$/, "")}  →`, w / 2 + (1 - lk) * 16 * u, labelY);
    ctx.restore();
  }
  ctx.restore();

  // The card springs in.
  const ck = clamp(spring(t - T.card, 9, 7), 0, 1.05);
  ctx.save();
  ctx.globalAlpha = clamp(ck * 1.4);
  ctx.translate(cardX + cardW / 2, cardY + cardW / 2);
  ctx.scale(0.86 + 0.14 * ck, 0.86 + 0.14 * ck);
  ctx.translate(-cardW / 2, -cardW / 2);
  ctx.shadowColor = rgba(palette.primary, 0.55);
  ctx.shadowBlur = 50 * u;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(0, 0, cardW, cardW, mod * 2.2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Modules: the three finder squares pop first, then the data ripples in from the top-left.
  // Dark on white, square modules: what every phone camera reads best.
  const ink = "#0c0a16";
  const ox = mod * quiet;
  const oy = mod * quiet;
  const fill = (k: number) => clamp(k);
  if (!target) {
    ctx.strokeStyle = "rgba(12,10,22,0.35)";
    ctx.setLineDash([mod * 1.4, mod * 1.1]);
    ctx.lineWidth = Math.max(2, mod * 0.35);
    ctx.beginPath();
    ctx.roundRect(ox, oy, codeW, codeW, mod * 1.6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(12,10,22,0.7)";
    ctx.font = subFont(codeW * 0.075, 700);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Add your link", cardW / 2, cardW / 2 - codeW * 0.05);
    ctx.font = subFont(codeW * 0.05, 500);
    ctx.fillText("in this slide's list", cardW / 2, cardW / 2 + codeW * 0.06);
  }
  for (let r = 0; r < n && target; r++) {
    for (let c = 0; c < n; c++) {
      if (!q.data[r][c]) continue;
      const pos = q.types[r][c] === 2; // QrCodeDataType.Position
      if (pos) continue;
      const delay = T.modules + ((r + c) / (2 * n)) * T.fill;
      const k = fill((t - delay) / 0.18);
      if (k <= 0) continue;
      const s = mod * (k >= 1 ? 1 : ease.outBack(k, 1.6)) + (k >= 1 ? 0.35 : 0);
      ctx.fillStyle = ink;
      ctx.fillRect(ox + c * mod + (mod - s) / 2, oy + r * mod + (mod - s) / 2, s, s);
    }
  }
  // Finder patterns (7×7) drawn whole, with rounded corners.
  const finders = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  if (target) finders.forEach(([r0, c0], i) => {
    const k = clamp(spring(t - (T.card + 0.2 + i * 0.1), 12, 7), 0, 1.08);
    if (k <= 0) return;
    const x = ox + c0 * mod + 3.5 * mod;
    const y = oy + r0 * mod + 3.5 * mod;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(-3.5 * mod, -3.5 * mod, 7 * mod, 7 * mod, mod * 1.6);
    ctx.roundRect(-2.5 * mod, -2.5 * mod, 5 * mod, 5 * mod, mod * 1);
    ctx.fill("evenodd");
    const g = ctx.createLinearGradient(-1.5 * mod, -1.5 * mod, 1.5 * mod, 1.5 * mod);
    g.addColorStop(0, "#1a1530");
    g.addColorStop(1, ink);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-1.5 * mod, -1.5 * mod, 3 * mod, 3 * mod, mod * 0.8);
    ctx.fill();
    ctx.restore();
  });
  // The brand mark in the middle (inside what error correction level H recovers).
  const mk = clamp(spring(t - (T.modules + T.fill * 0.6), 11, 7), 0, 1.06);
  if (mk > 0 && target) {
    const ms = codeW * 0.2;
    const mx = cardW / 2;
    const my = cardW / 2;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(mx - (ms * mk) / 2 - mod * 0.6, my - (ms * mk) / 2 - mod * 0.6, ms * mk + mod * 1.2, ms * mk + mod * 1.2, ms * 0.3);
    ctx.fill();
    ctx.restore();
    const img = getImage(brand?.logo);
    if (img && img.naturalWidth && img.naturalWidth / img.naturalHeight < 1.8) {
      const ar = img.naturalWidth / img.naturalHeight;
      const lw = ar >= 1 ? ms * mk : ms * mk * ar;
      const lh = lw / ar;
      drawLogo(ctx, img, true, mx - lw / 2, my - lh / 2, lw, lh);
    } else {
      brandGlyph({ ...sc, ctx }, mx, my, ms, mk, 0);
    }
  }

  // Scan: a beam sweeps down the code on the beat, then the viewfinder corners lock on.
  const sk = range(t, T.scan - 0.35, T.scan + 0.25);
  if (sk > 0 && sk < 1) {
    const y = lerp(0, cardW, ease.inOutCubic(sk));
    const g = ctx.createLinearGradient(0, y - cardW * 0.18, 0, y);
    g.addColorStop(0, rgba(palette.primary, 0));
    g.addColorStop(1, rgba(palette.primary, 0.28));
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.max(0, y - cardW * 0.18), cardW, Math.min(y, cardW * 0.18));
    ctx.fillStyle = palette.primary;
    ctx.shadowColor = palette.primary;
    ctx.shadowBlur = 18 * u;
    ctx.fillRect(mod, y - 1.5 * u, cardW - mod * 2, 3 * u);
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // Viewfinder brackets close in around the card as it "scans".
  const vk = ease.outBack(range(t, T.scan - 0.2, T.scan + 0.35), 1.8);
  if (vk > 0) {
    const inset = lerp(-cardW * 0.14, -cardW * 0.05, vk);
    const L = cardW * 0.14;
    ctx.save();
    ctx.globalAlpha = clamp(vk);
    ctx.strokeStyle = palette.light ? palette.primary : "#ffffff";
    ctx.lineWidth = 5 * u;
    ctx.lineCap = "round";
    const x0 = cardX + inset;
    const y0 = cardY + inset;
    const x1 = cardX + cardW - inset;
    const y1 = cardY + cardW - inset;
    ctx.beginPath();
    for (const [x, y, sx, sy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ]) {
      ctx.moveTo(x, y + sy * L);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * L, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  borderBeam(sc, cardX - 6 * u, cardY - 6 * u, cardW + 12 * u, cardW + 12 * u, t * 0.5, { r: mod * 2.2 + 6 * u, alpha: clamp(ck) * 0.8 });

  // Under the code: the label (tall/square) and the address.
  const below = cardY + cardW + (tall ? 70 : 54) * u;
  const dk = ease.outCubic(range(t, T.modules + 0.2, T.modules + 0.8));
  const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  ctx.save();
  ctx.globalAlpha = target ? dk : 0;
  if (tall || square) {
    ctx.font = subFont(40 * u * (tall ? 1.1 : 1), 600);
    ctx.fillStyle = rgba(palette.text, 0.85);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(scene.subtext || "Scan to get started", w / 2, below);
  }
  pill(sc, domain, tall || square ? w / 2 : cardX + cardW / 2, tall || square ? below + 78 * u : below + 8 * u + (1 - dk) * 12 * u, {
    size: 32 * u * (tall ? 1.1 : 1),
    fill: rgba(palette.light ? "#ffffff" : palette.bg0, 0.6),
    border: rgba(palette.text, 0.18),
  });
  ctx.restore();
}

export const endingSkills: Skill[] = [
  {
    id: "liquid-logo",
    name: "Liquid Logo",
    tagline: "Droplets fall and your logo pours in as glossy liquid, ripples out, then catches a sheen.",
    bestFor: "The brand reveal in fluid, playful-premium films (the Liquid Motion style uses it). Headline = brand name; subtext = a short tagline.",
    sample: { text: "Acme", subtext: "Ideas that flow" },
    render: liquidLogo,
    sfx: (scene, beat) => {
      const T = liquidTiming(scene.duration, beat);
      return [at(0.05, "whoosh"), at(T.hit, "pop"), at(T.sheen, "shimmer")];
    },
  },
  {
    id: "qr-end",
    name: "QR End Card",
    tagline: "The closing line next to a scannable QR code for your site, with a scan beam on the final beat.",
    bestFor:
      "The final scene when the film plays on a big screen, at an event, in a talk or a store: viewers scan to visit. Headline = closing line; subtext = the call to scan ('Scan to try it free'); items = [link] only if it differs from the website.",
    sample: { text: "See it *live*", subtext: "Scan to try it", items: ["example.com"] },
    itemsHint: "Link for the code (leave empty to use your website)",
    render: qrEnd,
    sfx: (scene, beat) => {
      const T = qrTiming(scene.duration, beat);
      return [at(T.card, "pop"), at(T.modules, "swoosh"), at(T.scan, "click"), at(T.scan + 0.05, "shimmer")];
    },
  },
];
