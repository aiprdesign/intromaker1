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
      // The studio background's own colour (the border's median): only pixels within a hair of it
      // are background, so a white or light product (and its highlights) is never eaten.
      const samples: number[][] = [];
      for (let x = 0; x < W; x += 3) for (const y of [0, H - 1]) samples.push([px[(y * W + x) * 4], px[(y * W + x) * 4 + 1], px[(y * W + x) * 4 + 2]]);
      for (let y = 0; y < H; y += 3) for (const x of [0, W - 1]) samples.push([px[(y * W + x) * 4], px[(y * W + x) * 4 + 1], px[(y * W + x) * 4 + 2]]);
      const med = [0, 1, 2].map((ch) => samples.map((v) => v[ch]).sort((a, b) => a - b)[samples.length >> 1]);
      const near = (i: number, tol: number) => px[i + 3] > 200 && Math.abs(px[i] - med[0]) <= tol && Math.abs(px[i + 1] - med[1]) <= tol && Math.abs(px[i + 2] - med[2]) <= tol;
      // Flood the background in from the edges.
      const bg = new Uint8Array(W * H);
      const stack: number[] = [];
      const seed = (x: number, y: number) => {
        const p = y * W + x;
        if (!bg[p] && near(p * 4, 6)) {
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
          // Soft edge: only anti-aliased pixels that are nearly the background colour fade (by how
          // close they are), so the product's own light edges keep full strength.
          const edge = (x > 0 && bg[p - 1]) || (x < W - 1 && bg[p + 1]) || (y > 0 && bg[p - W]) || (y < H - 1 && bg[p + W]);
          if (edge && near(p * 4, 24)) {
            const i = p * 4;
            const diff = Math.max(Math.abs(px[i] - med[0]), Math.abs(px[i + 1] - med[1]), Math.abs(px[i + 2] - med[2]));
            px[i + 3] = Math.round(px[i + 3] * clamp(0.4 + (diff / 24) * 0.6));
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
  if (!img || !src || !img.naturalWidth) return null;
  // The reveal, the close-ups and the end card stand the product on the stage: when this photo is a lifestyle
  // shot, the first photo that cuts out cleanly takes its place.
  if ((sc.scene.role === "reveal" || sc.scene.role === "cta" || sc.scene.skill === "product-zoom") && !productCutout(img, src)?.cut) {
    for (const alt of sc.brand?.images ?? []) {
      const a = getImage(alt);
      if (a?.naturalWidth && productCutout(a, alt)?.cut) return { img: a, key: alt };
    }
  }
  return { img, key: src };
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
function drawProduct(sc: SkillContext, cx: number, cy: number, boxW: number, boxH: number, k: number, alpha: number, pi = productImage(sc)) {
  const { ctx, u, palette } = sc;
  const T = sc.globalT ?? sc.t;
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
  return { x: cx - (pw * scale) / 2, y: cy + rise + bob - (ph * scale) / 2, w: pw * scale, h: ph * scale, src, cut: cut.cut };
}

/** A feature chip: icon tile + short title, on glass. */
function callout(sc: SkillContext, text: string, icon: string, cx: number, cy: number, k: number, align: "left" | "right" | "center") {
  const { ctx, u, palette, w, h } = sc;
  const portrait = h >= w * 0.95;
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
  // Square frames stack the callouts under the product too (side columns would run off the edge).
  const portrait = h >= w * 0.95;
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

/* ───────────────────────── Every Angle ───────────────────────── */

/** The product's photos (up to 6), each with its cache key. */
function productPhotos(sc: SkillContext) {
  const srcs = [...new Set([...(sc.scene.media?.kind === "image" ? [sc.scene.media.src] : []), ...(sc.brand?.images ?? [])])].slice(0, 6);
  return srcs.map((key) => ({ key, img: getImage(key) })).filter((p): p is { key: string; img: HTMLImageElement } => !!p.img && !!p.img.naturalWidth);
}

function spinTiming(d: number, n: number) {
  const start = 0.35;
  const seg = (d - start - 0.3) / Math.max(1, n);
  return { start, seg, swap: Math.min(0.5, seg * 0.35) };
}

/**
 * Every Angle: the product's photos take turns on the same spot of the stage, each sliding off
 * level to one side as the next glides in from the other, over one floor shadow, with a row of
 * dots counting the angles. A turntable feel without ever tilting the product.
 */
function productSpin(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h > w;
  topHeadline(sc);
  const photos = productPhotos(sc);
  if (!photos.length) return;
  const n = photos.length;
  const T = spinTiming(d, n);
  const box = portrait ? { cx: w / 2, cy: h * 0.52, w: w * 0.78, h: h * 0.4 } : { cx: w / 2, cy: h * 0.56, w: w * 0.42, h: h * 0.5 };
  const ex = ease.inCubic(exitT(sc, 0.4));
  const i = clamp(Math.floor((t - T.start) / T.seg), 0, n - 1);
  const into = t - T.start - i * T.seg;
  const k = clamp(spring(t - 0.1, 7, 6), 0, 1.06);
  // The swap: the previous angle slides off as this one arrives.
  const sw = i > 0 ? ease.inOutCubic(clamp(into / T.swap)) : 1;
  const slide = box.w * 0.55;
  if (i > 0 && sw < 1) {
    ctx.save();
    ctx.translate(-slide * sw, 0);
    drawProduct(sc, box.cx, box.cy, box.w, box.h, 1, (1 - sw) * (1 - ex), photos[i - 1]);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(slide * (1 - sw), 0);
  drawProduct(sc, box.cx, box.cy, box.w, box.h, i === 0 ? k : 1, clamp(t / 0.25) * sw * (1 - ex), photos[i]);
  ctx.restore();
  // Angle dots.
  const dy = portrait ? h * 0.86 : h * 0.92;
  const gap = 22 * u;
  for (let j = 0; j < n; j++) {
    const on = j === i ? sw : j === i - 1 ? 1 - sw : 0;
    ctx.save();
    ctx.globalAlpha = (0.35 + 0.65 * on) * (1 - ex) * clamp(t / 0.4);
    ctx.fillStyle = on > 0.5 ? palette.primary : palette.text;
    const x = w / 2 + (j - (n - 1) / 2) * gap;
    ctx.beginPath();
    ctx.roundRect(x - (5 + 8 * on) * u, dy - 5 * u, (10 + 16 * on) * u, 10 * u, 5 * u);
    ctx.fill();
    ctx.restore();
  }
}

/* ───────────────────────── Detail Zoom ───────────────────────── */

const detailCache = new Map<string, [number, number][]>();
/**
 * Where the product has the most detail: cells of the cut-out with the most opaque, busy pixels
 * (edges, buttons, textures), picked well apart. Fractions of the cut-out's width and height.
 */
function detailPoints(src: HTMLCanvasElement, key: string, want = 3): [number, number][] {
  const hit = detailCache.get(key);
  if (hit) return hit;
  const N = 12;
  const pts: { x: number; y: number; s: number }[] = [];
  try {
    const W = 144;
    const H = Math.max(1, Math.round((W * src.height) / src.width));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(src, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const at = (x: number, y: number) => (y * W + x) * 4;
    const lum = (i: number) => 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    // Per cell: how much of it is product, and how busy (edges + colour) it is inside.
    const cover: number[] = [];
    const busy: number[] = [];
    for (let cy = 0; cy < N; cy++)
      for (let cx = 0; cx < N; cx++) {
        let opaque = 0;
        let cells = 0;
        let edge = 0;
        let chroma = 0;
        for (let y = Math.floor((cy * H) / N); y < Math.floor(((cy + 1) * H) / N) - 1; y++)
          for (let x = Math.floor((cx * W) / N); x < Math.floor(((cx + 1) * W) / N) - 1; x++) {
            cells++;
            const i = at(x, y);
            if (px[i + 3] < 200) continue;
            opaque++;
            const r = at(x + 1, y);
            const d = at(x, y + 1);
            if (px[r + 3] >= 200) edge += Math.abs(lum(i) - lum(r));
            if (px[d + 3] >= 200) edge += Math.abs(lum(i) - lum(d));
            chroma += Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
          }
        cover.push(cells ? opaque / cells : 0);
        busy.push(cells ? (edge + chroma * 1.5) / cells : 0);
      }
    // Only cells well inside the product (they and their neighbours are all product), so the lens
    // never magnifies empty background at the outline.
    for (let cy = 1; cy < N - 1; cy++)
      for (let cx = 1; cx < N - 1; cx++) {
        const i = cy * N + cx;
        const inside = [i, i - 1, i + 1, i - N, i + N].every((j) => cover[j] > 0.92);
        if (inside) pts.push({ x: (cx + 0.5) / N, y: (cy + 0.5) / N, s: busy[i] });
      }
  } catch {
    /* unreadable: fall back below */
  }
  pts.sort((a, b) => b.s - a.s);
  const out: [number, number][] = [];
  for (const p of pts) {
    if (out.every(([x, y]) => Math.hypot(x - p.x, y - p.y) > 0.28)) out.push([p.x, p.y]);
    if (out.length >= want) break;
  }
  const fallback: [number, number][] = [[0.5, 0.45], [0.38, 0.6], [0.62, 0.6]];
  while (out.length < want) out.push(fallback[out.length]);
  // Visit them in reading order, so the lens travels smoothly.
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  detailCache.set(key, out);
  return out;
}

function zoomTiming(d: number, n: number) {
  const first = 0.9;
  const each = (d - first - 0.5) / Math.max(1, n);
  return { first, each, move: Math.min(0.55, each * 0.4) };
}

/**
 * Detail Zoom: the product centre stage while a magnifying lens glides to its most detailed
 * parts in turn, enlarging each, with the feature it shows called out beside the lens.
 */
function productZoom(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  saasBackground(sc, { beams: 0, grid: false });
  const portrait = h >= w * 0.95;
  topHeadline(sc);
  const ex = ease.inCubic(exitT(sc, 0.4));
  const k = clamp(spring(t - 0.1, 7, 6), 0, 1.06);
  const box = portrait ? { cx: w / 2, cy: h * 0.55, w: w * 0.78, h: h * 0.46 } : { cx: w / 2, cy: h * 0.58, w: w * 0.44, h: h * 0.6 };
  const rect = drawProduct(sc, box.cx, box.cy, box.w, box.h, k, clamp(t / 0.25) * (1 - ex));
  if (!rect) return;
  const pi = productImage(sc);
  const pts = detailPoints(rect.src, pi?.key ?? "product", 3);
  const labels = calloutItems(scene);
  const T = zoomTiming(d, pts.length);
  if (t < T.first - T.move) return;
  // Which stop, and how far between the previous and this one.
  const idx = clamp(Math.floor((t - T.first) / T.each), 0, pts.length - 1);
  const local = t - T.first - idx * T.each;
  const mv = idx === 0 ? ease.outCubic(clamp((t - (T.first - T.move)) / T.move)) : ease.inOutCubic(clamp(local / T.move));
  const from = idx === 0 ? [0.5, 1.1] : pts[idx - 1];
  const to = pts[idx];
  const fx = from[0] + (to[0] - from[0]) * mv;
  const fy = from[1] + (to[1] - from[1]) * mv;
  const lx = rect.x + fx * rect.w;
  const ly = rect.y + fy * rect.h;
  const R = Math.min(w, h) * (portrait ? 0.17 : 0.14);
  const zoom = 2.7;
  const appear = idx === 0 ? mv : 1;
  ctx.save();
  ctx.globalAlpha = appear * (1 - ex);
  // Lens shadow and glass.
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40 * u;
  ctx.shadowOffsetY = 14 * u;
  ctx.fillStyle = palette.light ? mixHex(palette.bg0, palette.text, 0.05) : palette.bg1;
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // The magnified product inside the lens.
  ctx.save();
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.clip();
  const sx = fx * rect.src.width;
  const sy = fy * rect.src.height;
  const scale = (rect.w / rect.src.width) * zoom;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(rect.src, lx - sx * scale, ly - sy * scale, rect.src.width * scale, rect.src.height * scale);
  // Glass highlight.
  const gl = ctx.createLinearGradient(lx - R, ly - R, lx + R * 0.2, ly + R * 0.2);
  gl.addColorStop(0, "rgba(255,255,255,0.35)");
  gl.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  const inner = ctx.createRadialGradient(lx, ly, R * 0.72, lx, ly, R);
  inner.addColorStop(0, "rgba(0,0,0,0)");
  inner.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = inner;
  ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
  ctx.restore();
  // Rim.
  ctx.lineWidth = 6 * u;
  ctx.strokeStyle = palette.light ? "#ffffff" : rgba(palette.text, 0.9);
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2 * u;
  ctx.strokeStyle = palette.primary;
  ctx.beginPath();
  ctx.arc(lx, ly, R + 5 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // The feature this stop shows, beside the lens on the open side.
  const label = labels[idx];
  if (label) {
    const lk = clamp(spring(local - T.move, 10, 6.5), 0, 1.1);
    if (lk > 0) {
      const right = lx < w / 2;
      const cx = portrait ? w / 2 : right ? lx + R + 30 * u : lx - R - 30 * u;
      const cy = portrait ? Math.min(h * 0.9, ly + R + 60 * u) : ly;
      ctx.save();
      ctx.globalAlpha = 1 - ex;
      callout(sc, label, iconsFor(labels, sc)[idx], cx, cy, lk, portrait ? "center" : right ? "right" : "left");
      ctx.restore();
    }
  }
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
  {
    id: "product-spin",
    name: "Every Angle",
    tagline: "The product's photos take turns on the stage, each sliding off level as the next glides in, with dots counting the angles.",
    bestFor: "Physical products with 2+ photos from different angles. Headline = a short line ('From every *angle*'); the photos come from the product images.",
    sample: { text: "From every *angle*" },
    render: productSpin,
    sfx: (scene) => {
      const n = 4;
      const T = spinTiming(scene.duration, n);
      return [at(0.05, "whoosh"), ...Array.from({ length: n - 1 }, (_, i) => at(T.start + (i + 1) * T.seg, "swoosh"))];
    },
  },
  {
    id: "product-zoom",
    name: "Detail Zoom",
    tagline: "A magnifying lens glides over the product to its most detailed parts, enlarging each, with the feature it shows called out beside it.",
    bestFor: "Physical products: the close-up moment. Headline = a short line ('Every *detail*'); items = up to 3 short feature titles, one per stop (optional).",
    sample: { text: "Every *detail*", items: ["Soft-touch finish", "Magnetic case", "Charging light"] },
    itemsHint: "One short feature per close-up (optional)",
    render: productZoom,
    sfx: (scene) => {
      const T = zoomTiming(scene.duration, 3);
      return [at(T.first - 0.3, "whoosh"), ...[0, 1, 2].map((i) => at(T.first + i * T.each + T.move, "pop"))];
    },
  },
];
