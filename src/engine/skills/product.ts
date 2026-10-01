/**
 * Physical products (from a marketplace listing or uploaded product photos): the product photo
 * cut out of its white studio background, standing on the stage with a floor shadow and a soft
 * reflection, a light sweep across it, and its features called out around it one by one.
 * Everything stays level: the product rises and floats straight, it never tilts.
 */
import { exitT } from "../fx";
import { clamp, ease, mixHex, range, rgba } from "../math";
import { getImage } from "../media";
import { blurInLayout, drawIcon, glassCard, iconsFor, saasBackground, sentence, spring } from "../saasfx";
import { scratch } from "../scratch";
import { subFont } from "../text";
import type { Palette, Scene, SfxCue, Skill, SkillContext } from "../types";
import { ctaButton, ctaCursor, ctaTiming, topHeadline } from "./saas";

const at = (t: number, kind: SfxCue["kind"]): SfxCue => ({ t, kind });

type Cut = { canvas: HTMLCanvasElement; cut: boolean };
const cuts = new Map<string, Cut>();

/**
 * The product without its studio background: when the photo's border is (nearly) all white, the
 * white connected to the edges is keyed out with a soft edge and the result trimmed to the
 * product. Lifestyle photos (no white border) are kept whole and shown as a rounded photo.
 */
export function productCutout(img: HTMLImageElement, key: string): Cut | null {
  if (!img.naturalWidth || typeof document === "undefined") return null;
  const hit = cuts.get(key);
  if (hit) return hit;
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const k = Math.min(1, 1000 / long);
  const W = Math.max(1, Math.round(img.naturalWidth * k));
  const H = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, W, H);
  let out: Cut = { canvas: c, cut: false };
  try {
    const data = g.getImageData(0, 0, W, H);
    const px = data.data;
    const white = (i: number, floor: number) => {
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      return px[i + 3] > 200 && Math.min(r, gg, b) >= floor && Math.max(r, gg, b) - Math.min(r, gg, b) < 22;
    };
    // Is the border a white studio background?
    let border = 0;
    let whiteBorder = 0;
    for (let x = 0; x < W; x += 2) for (const y of [0, H - 1]) {
      border++;
      if (white((y * W + x) * 4, 236)) whiteBorder++;
    }
    for (let y = 0; y < H; y += 2) for (const x of [0, W - 1]) {
      border++;
      if (white((y * W + x) * 4, 236)) whiteBorder++;
    }
    if (whiteBorder / border >= 0.8) {
      // Flood the background in from the edges.
      const bg = new Uint8Array(W * H);
      const stack: number[] = [];
      const seed = (x: number, y: number) => {
        const p = y * W + x;
        if (!bg[p] && white(p * 4, 226)) {
          bg[p] = 1;
          stack.push(p);
        }
      };
      for (let x = 0; x < W; x++) {
        seed(x, 0);
        seed(x, H - 1);
      }
      for (let y = 0; y < H; y++) {
        seed(0, y);
        seed(W - 1, y);
      }
      while (stack.length) {
        const p = stack.pop()!;
        const x = p % W;
        const y = (p - x) / W;
        if (x > 0) seed(x - 1, y);
        if (x < W - 1) seed(x + 1, y);
        if (y > 0) seed(x, y - 1);
        if (y < H - 1) seed(x, y + 1);
      }
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (bg[p]) {
            px[p * 4 + 3] = 0;
            continue;
          }
          // Soft edge: light pixels touching the background fade with their lightness.
          const edge = (x > 0 && bg[p - 1]) || (x < W - 1 && bg[p + 1]) || (y > 0 && bg[p - W]) || (y < H - 1 && bg[p + W]);
          if (edge) {
            const m = Math.min(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
            px[p * 4 + 3] = Math.round(px[p * 4 + 3] * clamp((255 - m) / 60 + 0.35));
          }
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 > x0 && y1 > y0) {
        g.putImageData(data, 0, 0);
        const pad = 2;
        const t = document.createElement("canvas");
        t.width = x1 - x0 + 1 + pad * 2;
        t.height = y1 - y0 + 1 + pad * 2;
        t.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, t.width, t.height, 0, 0, t.width, t.height);
        out = { canvas: t, cut: true };
      }
    }
  } catch {
    /* cross-origin pixels can't be read: show the photo as it is */
  }
  cuts.set(key, out);
  return out;
}

const cards = new Map<string, HTMLCanvasElement>();
/**
 * A product photo as a studio card for galleries: the cut-out product on a soft gradient in the
 * film's colours with a floor shadow, instead of a flat white rectangle. Photos that aren't on a
 * white background (lifestyle shots) are returned as they are.
 */
export function studioCard(img: HTMLImageElement, key: string, aspect: number, p: Palette): HTMLCanvasElement | HTMLImageElement {
  const cut = productCutout(img, key);
  if (!cut?.cut) return img;
  const id = `${key}@${aspect.toFixed(2)}${p.bg0}${p.primary}`;
  const hit = cards.get(id);
  if (hit) return hit;
  const ch = 900;
  const cw = Math.round(ch * aspect);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  const top = p.light ? mixHex(p.bg1, p.primary, 0.05) : mixHex(p.bg1, p.primary, 0.14);
  const floor = p.light ? mixHex(p.bg0, p.text, 0.06) : mixHex(p.bg0, "#000000", 0.25);
  const bg = g.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, top);
  bg.addColorStop(0.68, p.light ? p.bg1 : mixHex(p.bg1, p.bg0, 0.4));
  bg.addColorStop(1, floor);
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  const spot = g.createRadialGradient(cw / 2, ch * 0.42, 0, cw / 2, ch * 0.42, Math.max(cw, ch) * 0.55);
  spot.addColorStop(0, rgba(p.light ? "#ffffff" : p.primary, p.light ? 0.8 : 0.22));
  spot.addColorStop(1, rgba(p.light ? "#ffffff" : p.primary, 0));
  g.fillStyle = spot;
  g.fillRect(0, 0, cw, ch);
  const src = cut.canvas;
  const k = Math.min((cw * 0.7) / src.width, (ch * 0.7) / src.height);
  const pw = src.width * k;
  const ph = src.height * k;
  const x = (cw - pw) / 2;
  const y = (ch - ph) / 2 - ch * 0.03;
  g.save();
  g.translate(cw / 2, y + ph + ch * 0.015);
  g.scale(1, 0.12);
  const sh = g.createRadialGradient(0, 0, 0, 0, 0, pw * 0.6);
  sh.addColorStop(0, `rgba(0,0,0,${p.light ? 0.3 : 0.6})`);
  sh.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sh;
  g.beginPath();
  g.arc(0, 0, pw * 0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.imageSmoothingQuality = "high";
  g.drawImage(src, x, y, pw, ph);
  cards.set(id, c);
  return c;
}

/** The scene's product photo: its own media, else the first listing image. */
function productImage(sc: SkillContext): { img: HTMLImageElement; key: string } | null {
  const src = sc.scene.media?.kind === "image" ? sc.scene.media.src : sc.brand?.images?.[0];
  const img = getImage(src);
  return img && src && img.naturalWidth ? { img, key: src } : null;
}

function calloutItems(scene: Scene) {
  return (scene.items ?? []).map((x) => x.split(/\s+[—–]\s+/)[0].trim()).filter(Boolean).slice(0, 4);
}

function heroTiming(scene: Scene, beat: number) {
  const n = calloutItems(scene).length;
  const land = 0.15;
  const first = 0.9;
  const room = Math.max(0.3, (scene.duration - first - 1.4) / Math.max(1, n));
  const step = Math.min(Math.max(0.45, beat * 2), room);
  return { land, calls: Array.from({ length: n }, (_, i) => first + i * step) };
}

/** Draw the product (cut-out or rounded photo) centred in a box, with floor shadow, reflection and sheen. */
function drawProduct(sc: SkillContext, cx: number, cy: number, boxW: number, boxH: number, k: number, alpha: number) {
  const { ctx, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
  const pi = productImage(sc);
  if (!pi) return null;
  const cut = productCutout(pi.img, pi.key);
  if (!cut) return null;
  const src = cut.canvas;
  const s = Math.min(boxW / src.width, boxH / src.height);
  const pw = src.width * s;
  const ph = src.height * s;
  // Rise in on a spring, then float gently; a slow push keeps it alive.
  const rise = (1 - Math.min(1, k)) * boxH * 0.35;
  const bob = Math.sin(T * 1.2) * 5 * u;
  const push = 1 + 0.035 * range(sc.t, 0, sc.d);
  const scale = (0.86 + 0.14 * Math.min(1, k)) * push;
  const floorY = cy + ph / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (cut.cut) {
    // Floor shadow: tightens as the product settles.
    ctx.save();
    ctx.translate(cx, floorY + 6 * u);
    ctx.scale(1, 0.13);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, pw * 0.62);
    sh.addColorStop(0, `rgba(0,0,0,${palette.light ? 0.28 : 0.55})`);
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.globalAlpha = alpha * clamp(k) * (1 - clamp(bob / (40 * u)));
    ctx.beginPath();
    ctx.arc(0, 0, pw * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Soft reflection on the floor.
    ctx.save();
    ctx.translate(cx, floorY + rise + bob);
    ctx.scale(scale, -scale * 0.55);
    ctx.globalAlpha = alpha * (palette.light ? 0.12 : 0.16) * clamp(k);
    ctx.drawImage(src, -pw / 2, -ph * 0.02, pw, ph);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const fade = ctx.createLinearGradient(0, floorY, 0, floorY + ph * 0.5);
    fade.addColorStop(0, rgba(palette.light ? palette.bg1 : palette.bg0, 0));
    fade.addColorStop(1, rgba(palette.light ? palette.bg1 : palette.bg0, 0.9 * alpha));
    ctx.fillStyle = fade;
    ctx.fillRect(cx - pw, floorY, pw * 2, ph * 0.55);
    ctx.restore();
  }
  // The product itself, with a light sweep across it (clipped to its own shape).
  const layer = scratch("product-hero", Math.max(1, Math.ceil(pw)), Math.max(1, Math.ceil(ph)));
  const lc = layer.ctx;
  if (cut.cut) lc.drawImage(src, 0, 0, pw, ph);
  else {
    lc.save();
    lc.beginPath();
    lc.roundRect(0, 0, pw, ph, 22 * u);
    lc.clip();
    lc.drawImage(src, 0, 0, pw, ph);
    lc.restore();
  }
  const sweep = ((sc.t - 0.5) / 2.6) % 1.4;
  if (sweep > 0 && sweep < 1.2) {
    const sx = -pw * 0.4 + sweep * pw * 1.6;
    lc.globalCompositeOperation = "source-atop";
    const gr = lc.createLinearGradient(sx - pw * 0.18, 0, sx + pw * 0.18, ph * 0.25);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.32)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    lc.fillStyle = gr;
    lc.fillRect(0, 0, pw, ph);
    lc.globalCompositeOperation = "source-over";
  }
  ctx.translate(cx, cy + rise + bob);
  ctx.scale(scale, scale);
  if (!cut.cut) {
    ctx.shadowColor = `rgba(0,0,0,${palette.light ? 0.25 : 0.5})`;
    ctx.shadowBlur = 50 * u;
    ctx.shadowOffsetY = 20 * u;
  } else if (!palette.light) {
    // A rim of the brand colour behind the product separates it from a dark stage.
    ctx.shadowColor = rgba(palette.primary, 0.35);
    ctx.shadowBlur = 60 * u;
  }
  ctx.drawImage(layer.canvas, 0, 0, pw, ph, -pw / 2, -ph / 2, pw, ph);
  ctx.restore();
  return { x: cx - (pw * scale) / 2, y: cy + rise + bob - (ph * scale) / 2, w: pw * scale, h: ph * scale };
}

/** A feature chip: icon tile + short title, on glass. */
function callout(sc: SkillContext, text: string, icon: string, cx: number, cy: number, k: number, align: "left" | "right" | "center") {
  const { ctx, u, palette, w, h } = sc;
  const portrait = h > w;
  const fs = (portrait ? 36 : 33) * u;
  ctx.save();
  ctx.font = subFont(fs, 650);
  const tw = Math.min(ctx.measureText(text).width, w * (portrait ? 0.32 : 0.24));
  const ih = fs * 2.1;
  const cw = tw + ih + fs * 1.4;
  const x = align === "left" ? cx - cw : align === "right" ? cx : cx - cw / 2;
  const y = cy - ih / 2;
  const kk = clamp(k, 0, 1.1);
  ctx.globalAlpha *= clamp(k * 2);
  ctx.translate(x + cw / 2, cy);
  ctx.scale(0.85 + 0.15 * kk, 0.85 + 0.15 * kk);
  ctx.translate(-(x + cw / 2), -cy);
  glassCard(sc, x, y, cw, ih, { r: ih / 2 });
  const ts = ih * 0.72;
  const tx = x + ih / 2;
  ctx.beginPath();
  ctx.arc(tx, cy, ts / 2, 0, Math.PI * 2);
  const tile = ctx.createLinearGradient(tx - ts / 2, cy - ts / 2, tx + ts / 2, cy + ts / 2);
  tile.addColorStop(0, palette.primary);
  tile.addColorStop(1, palette.secondary);
  ctx.fillStyle = tile;
  ctx.fill();
  drawIcon(ctx, icon, tx, cy, ts * 0.58, palette.light ? "#ffffff" : palette.bg0, clamp(k * 1.4));
  ctx.fillStyle = palette.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + ih + fs * 0.35, cy + 1, tw);
  ctx.restore();
  return { x, y, w: cw, h: ih };
}

/**
 * Product Hero: the product photo on the stage. Without items it's the reveal: the product rises
 * in with the name beneath. With items, the features are called out around it one by one, each
 * chip joined to the product by a hairline.
 */
function productHero(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  const ex = ease.inCubic(exitT(sc, 0.4));
  const items = calloutItems(scene);
  const T = heroTiming(scene, sc.beat);
  const k = clamp(spring(t - T.land, 7, 6), 0, 1.06);
  const alpha = clamp((t - T.land) / 0.25) * (1 - ex);
  if (!items.length) {
    // The reveal: product centre stage, the name and subtext beneath.
    const box = portrait ? { w: w * 0.78, h: h * 0.42, cy: h * 0.4 } : { w: w * 0.46, h: h * 0.56, cy: h * 0.41 };
    drawProduct(sc, w / 2, box.cy, box.w, box.h, k, alpha);
    const layout = sentence(sc, { cy: h * (portrait ? 0.72 : 0.8), sizeFrac: portrait ? 0.085 : 0.075, widthFrac: 0.84, maxLines: 2 });
    blurInLayout(sc, layout, 0.55, 0.07, { exitAt: d - 0.4 });
    if (scene.subtext) {
      const sk = ease.outCubic(range(t, 0.9, 1.4)) * (1 - ex);
      ctx.save();
      ctx.globalAlpha = sk;
      ctx.font = subFont((portrait ? 34 : 30) * u, 500);
      ctx.fillStyle = rgba(palette.text, 0.7);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const last = layout.ys[layout.ys.length - 1] ?? h * 0.8;
      ctx.fillText(scene.subtext.replace(/\*/g, ""), w / 2, last + layout.size * 0.85 + (1 - sk) * 10 * u, w * 0.8);
      ctx.restore();
    }
    return;
  }
  topHeadline(sc);
  const box = portrait ? { w: w * 0.72, h: h * 0.36, cx: w / 2, cy: h * 0.46 } : { w: w * 0.34, h: h * 0.56, cx: w / 2, cy: h * 0.6 };
  const rect = drawProduct(sc, box.cx, box.cy, box.w, box.h, k, alpha);
  const icons = iconsFor(items, sc);
  items.forEach((text, i) => {
    const lt = t - T.calls[i];
    if (lt <= 0) return;
    const ck = clamp(spring(lt, 10, 6.5), 0, 1.1);
    let cx: number, cy: number, align: "left" | "right" | "center";
    if (portrait) {
      // Two columns of chips under the product.
      align = "center";
      cx = w * (i % 2 ? 0.73 : 0.27);
      cy = h * (0.73 + Math.floor(i / 2) * 0.08);
    } else {
      // Alternating left and right of the product.
      const left = i % 2 === 0;
      align = left ? "left" : "right";
      cx = left ? w * 0.33 : w * 0.67;
      const row = Math.floor(i / 2);
      const rows = Math.ceil(items.length / 2);
      cy = h * (rows === 1 ? 0.58 : 0.47 + row * 0.24);
    }
    ctx.save();
    ctx.globalAlpha = 1 - ex;
    const chip = callout(sc, text, icons[i], cx, cy, ck, align);
    // Hairline from the chip to a point on the product.
    if (rect) {
      const ax = portrait ? rect.x + rect.w * (i % 2 ? 0.7 : 0.3) : rect.x + rect.w * (align === "left" ? 0.28 : 0.72);
      const ay = portrait ? rect.y + rect.h * 0.82 : Math.min(rect.y + rect.h * 0.85, Math.max(rect.y + rect.h * 0.15, cy));
      const sx = portrait ? chip.x + chip.w / 2 : align === "left" ? chip.x + chip.w : chip.x;
      const sy = portrait ? chip.y : cy;
      const lk = ease.outCubic(range(lt, 0.1, 0.5));
      ctx.strokeStyle = rgba(palette.text, 0.45);
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (ax - sx) * lk, sy + (ay - sy) * lk);
      ctx.stroke();
      if (lk > 0.95) {
        ctx.fillStyle = palette.primary;
        ctx.beginPath();
        ctx.arc(ax, ay, 5 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(palette.primary, 0.4 * (1 - range(lt, 0.5, 1.2)));
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.arc(ax, ay, 5 * u + 16 * u * range(lt, 0.5, 1.2), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

/**
 * Product End Card: the product beside the closing line and the button (stacked in vertical
 * films), with the brand above the line. The button presses on the final beat, like the SaaS
 * end card; the product keeps floating so the last frame is a clean thumbnail.
 */
function productEnd(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, brand } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  const T = ctaTiming(d, sc.beat);
  const k = clamp(spring(t - 0.05, 7, 6), 0, 1.06);
  const S = portrait ? 1.3 : 1;
  // The product: left of centre (landscape) or above the text (portrait).
  const box = portrait ? { cx: w / 2, cy: h * 0.33, w: w * 0.74, h: h * 0.34 } : { cx: w * 0.31, cy: h * 0.47, w: w * 0.34, h: h * 0.48 };
  drawProduct(sc, box.cx, box.cy, box.w, box.h, k, clamp(t / 0.25));
  const tx = portrait ? w / 2 : w * 0.68;
  // Brand name above the line.
  const nk = ease.outCubic(range(t, 0.25, 0.7));
  const nameY = portrait ? h * 0.58 : h * 0.3;
  if (brand?.name && nk > 0) {
    ctx.save();
    ctx.globalAlpha = nk;
    ctx.font = subFont(30 * u * S, 700);
    ctx.fillStyle = rgba(palette.text, 0.7);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brand.name.toUpperCase().split("").join("\u200A"), tx, nameY + (1 - nk) * 10 * u);
    ctx.restore();
  }
  const layout = sentence(sc, { cy: portrait ? h * 0.66 : h * 0.44, sizeFrac: portrait ? 0.1 : 0.085, widthFrac: portrait ? 0.86 : 0.5, maxLines: 2 });
  ctx.save();
  ctx.translate(tx - w / 2, 0);
  blurInLayout(sc, layout, 0.3, 0.07, { exitAt: d + 1 });
  ctx.restore();
  const by = layout.ys[layout.ys.length - 1] + layout.size * 0.6 + 70 * u;
  const button = ctaButton(sc, tx, by, S, T);
  ctaCursor(sc, tx + button.bw * 0.1, by + 4 * u, T);
}

export const productSkills: Skill[] = [
  {
    id: "product-hero",
    name: "Product Hero",
    tagline: "Your product photo cut out of its white background, rising onto the stage with a floor shadow and light sweep; features called out around it one by one.",
    bestFor:
      "Physical products (marketplace listings, uploaded product photos). Without items: the product reveal (headline = product name, subtext = a short line). With items: 2-4 short feature callouts around the product (titles of 1-4 words).",
    sample: { text: "Meet *Aero Buds*", items: ["Noise cancelling", "All-day battery", "Water resistant"] },
    itemsHint: "Feature callouts around the product (1-4 words each)",
    render: productHero,
    sfx: (scene, beat) => {
      const T = heroTiming(scene, beat);
      return [at(0.05, "whoosh"), at(T.land + 0.35, "shimmer"), ...T.calls.map((c) => at(c, "pop"))];
    },
  },
  {
    id: "product-end",
    name: "Product End Card",
    tagline: "The product beside the closing line and a button that presses on the final beat.",
    bestFor: "The last scene of a product video. Headline = closing line ('Get yours *today*'); subtext = the button label ('Shop now'); media = the product photo.",
    sample: { text: "Get yours *today*", subtext: "Shop now" },
    render: productEnd,
    sfx: (scene, beat) => {
      const T = ctaTiming(scene.duration, beat);
      return [at(0.05, "whoosh"), at(T.button, "pop"), at(T.click, "click"), at(T.click + 0.05, "success")];
    },
  },
];
