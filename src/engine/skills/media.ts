import { background, bevel, drawLayout, dust, exitT, extrude, flash, glow, headline, headlineGradient, noGlow, subline } from "../fx";
import { saasBackground, saasFont } from "../saasfx";
import { clamp, ease, lerp, range, rgba, rng, TAU } from "../math";
import { getImage, getMedia, isDarkLogo, mediaSize, type Drawable } from "../media";
import { scratch } from "../scratch";
import { subFont } from "../text";
import type { Skill, SkillContext } from "../types";

/** Draw `d` scaled to cover the box (like CSS object-fit: cover), with zoom and focal pan. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  d: Drawable,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1,
  fx = 0.5,
  fy = 0.5,
) {
  const { w: iw, h: ih } = mediaSize(d);
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(d, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Placeholder "app UI" when a scene has no media yet. */
export function mockUi(sc: SkillContext, x: number, y: number, w: number, h: number) {
  const { ctx, palette, u } = sc;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, rgba(palette.primary, 0.25));
  g.addColorStop(1, rgba(palette.secondary, 0.2));
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(palette.text, 0.08);
  ctx.fillRect(x, y, w * 0.2, h);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = rgba(palette.text, 0.1 + (i === 0 ? 0.15 : 0));
    ctx.fillRect(x + w * 0.26, y + h * (0.12 + i * 0.16), w * (0.6 - i * 0.07), 14 * u);
  }
}

/* ───────────────────────── Logo Reveal ───────────────────────── */

function logoReveal(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u, brand } = sc;
  const saas = sc.style === "saas";
  if (saas) saasBackground(sc, { beams: 2 });
  else {
    background(sc, { hot: palette.primary, hotAlpha: 0.22 });
    dust(sc, 70, palette.secondary, 0.15);
  }
  const logo = getImage(brand?.logo);
  // A wide wordmark already spells the name; don't repeat it underneath.
  const wordmark = !!logo && logo.naturalWidth / Math.max(1, logo.naturalHeight) >= 1.8;
  const cx = w / 2;
  const short = Math.min(w, h);
  const cy = logo ? h * 0.4 : h * 0.47;
  const hit = Math.min(d * 0.3, sc.beat);
  const k = ease.outBack(range(t, hit - 0.25, hit + 0.45), 1.6);
  const ex = ease.inCubic(exitT(sc, 0.45));

  // Charging core: light gathers from the first frame until the hit.
  const charge = range(t, 0, hit);
  if (t < hit + 0.3) {
    const cr = short * (0.05 + 0.25 * ease.inCubic(charge));
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 2.5);
    cg.addColorStop(0, rgba("#ffffff", 0.4 * charge * (1 - range(t, hit, hit + 0.3))));
    cg.addColorStop(0.3, rgba(palette.primary, 0.5 * charge));
    cg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, w, h);
  }
  // Rotating light burst behind the mark.
  const burst = saas ? 0 : clamp(range(t, hit - 0.3, hit + 0.2)) * (1 - ex);
  // SaaS: an anamorphic light streak blooms horizontally through the mark on the hit.
  if (saas) {
    const sk = range(t, hit - 0.15, hit + 1.4);
    if (sk > 0 && sk < 1) {
      const sw = w * ease.outExpo(sk) * 0.55;
      const sa = Math.sin(Math.PI * Math.min(1, sk * 1.6)) * (1 - ex) * (palette.light ? 0.45 : 0.8);
      ctx.save();
      ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
      for (const [th, al] of [[2.2, 1], [14, 0.35], [60, 0.12]] as const) {
        const g = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0);
        g.addColorStop(0, rgba(palette.primary, 0));
        g.addColorStop(0.5, rgba(palette.light ? palette.primary : "#ffffff", sa * al));
        g.addColorStop(1, rgba(palette.primary, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, sw, th * u, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  if (burst > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.15);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const g = ctx.createLinearGradient(0, 0, Math.cos(a) * short, Math.sin(a) * short);
      g.addColorStop(0, rgba(i % 2 ? palette.primary : palette.secondary, 0.22 * burst));
      g.addColorStop(1, rgba(palette.primary, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, short, a - 0.06, a + 0.06);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // Shockwave ring on the hit.
  const ring = range(t, hit, hit + 0.9);
  if (ring > 0 && ring < 1 && !saas) {
    ctx.save();
    ctx.strokeStyle = palette.primary;
    ctx.globalAlpha = (1 - ring) * 0.9;
    ctx.lineWidth = (1 - ring) * 24 * u + 1;
    ctx.beginPath();
    ctx.arc(cx, cy, ease.outExpo(ring) * short * 0.7, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  let nameY = h * 0.47;
  const logoY = wordmark ? h * 0.46 : cy;
  if (logo && logo.naturalWidth) {
    const box = short * (h > w ? 0.34 : 0.3) * (wordmark ? 1.25 : 1);
    const ar = logo.naturalWidth / logo.naturalHeight;
    const lw = ar >= 1 ? Math.min(box * 1.9, box * ar) : box * ar;
    const lh = lw / ar;
    // Render the mark (inverted to white if it's dark ink) with a glint sweeping across it.
    const pad = 4;
    const buf = scratch("logo", Math.ceil(lw) + pad * 2, Math.ceil(lh) + pad * 2);
    if (!palette.light && isDarkLogo(logo)) buf.ctx.filter = "brightness(0) invert(1)";
    buf.ctx.drawImage(logo, pad, pad, lw, lh);
    buf.ctx.filter = "none";
    const gx = lerp(-lw * 0.6, lw * 1.6, range(t, hit + 0.3, hit + 1.2));
    const glint = buf.ctx.createLinearGradient(gx - lw * 0.25, 0, gx + lw * 0.25, lh);
    glint.addColorStop(0, "rgba(255,255,255,0)");
    glint.addColorStop(0.5, "rgba(255,255,255,0.85)");
    glint.addColorStop(1, "rgba(255,255,255,0)");
    buf.ctx.globalCompositeOperation = "source-atop";
    buf.ctx.fillStyle = glint;
    buf.ctx.fillRect(0, 0, buf.canvas.width, buf.canvas.height);
    buf.ctx.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.globalAlpha = clamp(k * 1.5) * (1 - ex);
    ctx.translate(cx, logoY);
    const s = Math.max(0, k) * (1 + ex * 0.4);
    ctx.scale(s, s);
    const blur = (1 - clamp(k)) * 16 * u;
    if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    glow(ctx, rgba(palette.primary, 0.9), 40 * u);
    ctx.drawImage(buf.canvas, -lw / 2 - pad, -lh / 2 - pad);
    ctx.restore();
    nameY = (wordmark ? logoY : cy) + lh / 2 + short * 0.12;
  }

  if (wordmark) {
    subline(sc, nameY - short * 0.04, range(t, hit + 0.8, hit + 1.4), { alpha: 1 - ex });
    flash(sc, t >= hit ? (1 - range(t, hit, hit + 0.25)) * 0.15 : 0, palette.text);
    return;
  }
  // Brand name + tagline.
  const layout = headline(sc, { cy: nameY, sizeFrac: logo ? 0.13 : 0.26, maxLines: 1, natural: saas, font: saas ? saasFont(sc) : undefined });
  const nk = ease.outExpo(range(t, hit + (logo ? 0.35 : 0), hit + (logo ? 1.1 : 0.7)));
  ctx.save();
  ctx.globalAlpha = nk * (1 - ex);
  ctx.translate(0, (1 - nk) * 30 * u);
  if (!logo) extrude(sc, layout);
  ctx.fillStyle = headlineGradient(sc, layout, palette.text, logo ? palette.text : palette.primary);
  glow(ctx, rgba(palette.primary, 0.6), 20 * u);
  drawLayout(sc, layout);
  noGlow(ctx);
  ctx.restore();
  const bottom = layout.ys[0] + layout.size * 0.5;
  subline(sc, bottom + 40 * u, range(t, hit + 0.8, hit + 1.4), { alpha: 1 - ex });
  flash(sc, t >= hit ? (1 - range(t, hit, hit + 0.25)) * (sc.scene.transition === "flash" ? 0.15 : 0.3) : 0, palette.text);
}

/* ───────────────────────── Product Showcase ───────────────────────── */

function productShowcase(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u, brand, scene } = sc;
  background(sc, { hot: palette.secondary, hotAlpha: 0.2 });
  const portrait = h > w;
  const ex = ease.inCubic(exitT(sc, 0.45));

  // Headline above the device.
  const layout = headline(sc, { cy: h * (portrait ? 0.16 : 0.13), sizeFrac: portrait ? 0.1 : 0.085, widthFrac: 0.86, maxLines: 2 });
  const hk = ease.outExpo(range(t, 0.1, 0.7));
  ctx.save();
  ctx.globalAlpha = hk * (1 - ex);
  ctx.translate(0, (1 - hk) * -30 * u);
  ctx.fillStyle = headlineGradient(sc, layout, palette.text, palette.primary);
  drawLayout(sc, layout);
  ctx.restore();

  // Browser window with the site's media, swinging in from a steep 3D angle.
  const ww = portrait ? w * 0.86 : w * 0.58;
  const wh = ww * (portrait ? 1.25 : 0.6);
  const top = portrait ? h * 0.3 : h * 0.25;
  const cx = w / 2;
  const cyW = top + wh / 2;
  const k = ease.outExpo(range(t, 0.15, 1.4));
  const tilt = lerp(0.55, 0.12, k) + Math.sin(t * 0.8) * 0.02 - ex * 0.3;
  const bob = Math.sin(t * 1.3) * 6 * u;
  ctx.save();
  ctx.globalAlpha = clamp(k * 2) * (1 - ex);
  ctx.translate(cx, cyW + bob + (1 - k) * h * 0.25);
  // Fake perspective: squash horizontally and shear vertically (a Y-axis turn).
  ctx.transform(1 - tilt * 0.35, -tilt * 0.22, 0, 1, 0, 0);
  const s = lerp(0.8, 1, k) * (1 + ex * 0.2);
  ctx.scale(s, s);
  const x0 = -ww / 2;
  const y0 = -wh / 2;
  const r = 18 * u;
  const bar = 34 * u;
  // Glow + shadow.
  ctx.save();
  glow(ctx, rgba(palette.primary, 0.55), 80 * u);
  ctx.fillStyle = palette.bg0;
  roundRect(ctx, x0, y0, ww, wh, r);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x0, y0, ww, wh, r);
  ctx.clip();
  ctx.fillStyle = "#15131f";
  ctx.fillRect(x0, y0, ww, bar);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x0 + 22 * u + i * 20 * u, y0 + bar / 2, 6 * u, 0, TAU);
    ctx.fill();
  });
  const pillW = ww * 0.42;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, -pillW / 2, y0 + bar * 0.2, pillW, bar * 0.6, bar * 0.3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = subFont(13 * u, 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brand?.domain ?? "yourbrand.com", 0, y0 + bar / 2);
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  // Slow scroll through tall screenshots.
  if (media) drawCover(ctx, media, x0, y0 + bar, ww, wh - bar, 1.02 + t * 0.01, 0.5, clamp(t / d) * 0.3);
  else mockUi(sc, x0, y0 + bar, ww, wh - bar);
  // Glare sweep.
  const gx = lerp(x0 - ww * 0.5, x0 + ww * 1.5, range(t, 0.9, 2.2));
  const glare = ctx.createLinearGradient(gx - ww * 0.15, y0, gx + ww * 0.15, y0 + wh);
  glare.addColorStop(0, "rgba(255,255,255,0)");
  glare.addColorStop(0.5, "rgba(255,255,255,0.16)");
  glare.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glare;
  ctx.fillRect(x0, y0, ww, wh);
  ctx.restore();
  ctx.strokeStyle = rgba(palette.text, 0.18);
  ctx.lineWidth = 1.5 * u;
  roundRect(ctx, x0, y0, ww, wh, r);
  ctx.stroke();
  ctx.restore();

  const sub = portrait ? top + wh + 70 * u : Math.min(h - 50 * u, top + wh + 56 * u);
  subline(sc, sub, range(t, 0.9, 1.5), { alpha: 1 - ex });
}

/* ───────────────────────── Photo Montage ───────────────────────── */

function photoMontage(sc: SkillContext) {
  const { ctx, w, h, t, d, palette, u, scene, brand, seed } = sc;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  const media = getMedia(scene.media ?? (brand?.images[0] ? { src: brand.images[0], kind: "image" } : undefined), t);
  const p = t / d;
  const ex = exitT(sc, 0.45);
  if (media) {
    // Ken Burns: slow push with a drifting focal point.
    const fx = 0.3 + r() * 0.4;
    const fy = 0.3 + r() * 0.4;
    ctx.save();
    ctx.globalAlpha = clamp(t / 0.3);
    drawCover(ctx, media, 0, 0, w, h, 1.08 + p * 0.14, lerp(fx, 1 - fx, p), lerp(fy, 0.5, p));
    ctx.restore();
    // Brand-colour grade: tint, then darken for legibility.
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = 0.35;
    const tint = ctx.createLinearGradient(0, 0, w, h);
    tint.addColorStop(0, palette.primary);
    tint.addColorStop(1, palette.secondary);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else {
    background(sc, { hot: palette.primary, hotAlpha: 0.25 });
  }
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, rgba(palette.bg0, 0.25));
  shade.addColorStop(0.55, rgba(palette.bg0, 0.55));
  shade.addColorStop(1, rgba(palette.bg0, 0.9));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  // Title rises through a mask in the lower third.
  const layout = headline(sc, { cy: h * 0.66, sizeFrac: 0.17, widthFrac: 0.84, maxLines: 2 });
  layout.lines.forEach((line, i) => {
    const y = layout.ys[i];
    const k = ease.outExpo(range(t, 0.25 + i * 0.12, 1.0 + i * 0.12));
    const out = ease.inExpo(range(t, d - 0.45, d - 0.05));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y - layout.size * 0.6, w, layout.size * 1.2);
    ctx.clip();
    ctx.translate(0, (1 - k) * layout.size * 1.1 - out * layout.size * 1.1);
    extrude(sc, { ...layout, lines: [line], ys: [y] }, { depth: 8 });
    ctx.fillStyle = palette.text;
    drawLayout(sc, { ...layout, lines: [line], ys: [y] });
    bevel(sc, { ...layout, lines: [line], ys: [y] });
    ctx.restore();
  });
  // Accent rule.
  const rw = w * 0.18 * ease.outExpo(range(t, 0.6, 1.2)) * (1 - ex);
  ctx.fillStyle = palette.primary;
  ctx.fillRect(w / 2 - rw / 2, layout.ys[0] - layout.size * 0.75, rw, 5 * u);
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 40 * u, range(t, 0.9, 1.5), { alpha: 1 - ex });
  flash(sc, 1 - range(t, 0, 0.18), palette.text);
}

/* ───────────────────────── Screen Wall ───────────────────────── */

function screenWall(sc: SkillContext) {
  const { ctx, w, h, t, palette, u, brand } = sc;
  ctx.fillStyle = palette.bg0;
  ctx.fillRect(0, 0, w, h);
  const imgs = (brand?.images ?? []).map((s) => getImage(s));
  const ex = ease.inCubic(exitT(sc, 0.45));
  const k = ease.outExpo(range(t, 0, 1.2));

  ctx.save();
  ctx.globalAlpha = k * (1 - ex);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.28);
  ctx.transform(1, 0, -0.35, 1, 0, 0);
  const s = lerp(1.5, 1.15, k) + ex * 0.2;
  ctx.scale(s, s);
  const cols = 5;
  const tw = Math.max(w, h) * 0.3;
  const th = tw * 0.62;
  const gap = 18 * u;
  let n = 0;
  for (let c = 0; c < cols; c++) {
    const dir = c % 2 ? 1 : -1;
    const speed = 40 * u * (1 + (c % 3) * 0.3);
    const offset = (((t * speed * dir) % (th + gap)) + (th + gap)) % (th + gap);
    const x = (c - (cols - 1) / 2) * (tw + gap) - tw / 2;
    for (let rI = -4; rI <= 4; rI++) {
      const y = rI * (th + gap) + offset - th / 2;
      const img = imgs.length ? imgs[(n + c * 3 + rI + 40) % imgs.length] : null;
      n++;
      ctx.save();
      roundRect(ctx, x, y, tw, th, 14 * u);
      ctx.clip();
      if (img) drawCover(ctx, img, x, y, tw, th);
      else mockUi(sc, x, y, tw, th);
      ctx.restore();
      ctx.strokeStyle = rgba(palette.text, 0.12);
      ctx.lineWidth = 1.5 * u;
      roundRect(ctx, x, y, tw, th, 14 * u);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Centre vignette plate so the headline pops.
  const v = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.55);
  v.addColorStop(0, rgba(palette.bg0, 0.88));
  v.addColorStop(0.6, rgba(palette.bg0, 0.55));
  v.addColorStop(1, rgba(palette.bg0, 0.2));
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  const layout = headline(sc, { sizeFrac: 0.22 });
  const hk = ease.outBack(range(t, 0.4, 1.1), 1.4);
  ctx.save();
  ctx.globalAlpha = clamp(hk * 1.5) * (1 - ex);
  ctx.translate(w / 2, h / 2);
  ctx.scale(hk, hk);
  ctx.translate(-w / 2, -h / 2);
  extrude(sc, layout);
  ctx.fillStyle = headlineGradient(sc, layout, palette.text, palette.primary);
  glow(ctx, palette.primary, 24 * u);
  drawLayout(sc, layout);
  noGlow(ctx);
  bevel(sc, layout);
  ctx.restore();
  const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.5;
  subline(sc, bottom + 50 * u, range(t, 0.9, 1.5), { alpha: 1 - ex });
}

export const mediaSkills: Skill[] = [
  {
    id: "logo-reveal",
    name: "Logo Reveal",
    tagline: "Your logo bursts in with light rays, a shockwave and a glint, then the name.",
    bestFor: "The brand reveal and outro when a logo was imported. Headline = brand name.",
    sample: { text: "ACME", subtext: "Build something great" },
    render: logoReveal,
  },
  {
    id: "product-showcase",
    name: "Product Showcase",
    tagline: "Your site's screenshot or video in a floating 3D browser window.",
    bestFor: "Showing the actual product/website. Headline = a value proposition (2–6 words).",
    sample: { text: "YOUR PRODUCT, IN MOTION", subtext: "See it live" },
    render: productShowcase,
  },
  {
    id: "photo-montage",
    name: "Photo Montage",
    tagline: "Full-bleed imagery with Ken Burns motion, a brand-colour grade and masked type.",
    bestFor: "Feature beats over real photos or screenshots. Headline = 1–4 words.",
    sample: { text: "MADE FOR TEAMS", subtext: "Collaborate anywhere" },
    render: photoMontage,
  },
  {
    id: "screen-wall",
    name: "Screen Wall",
    tagline: "An endless 3D wall of your site's images scrolls behind a bold headline.",
    bestFor: "Breadth moments: integrations, templates, 'everything in one place'. Needs several images.",
    sample: { text: "ALL IN ONE PLACE", subtext: "Everything you need" },
    render: screenWall,
  },
];
