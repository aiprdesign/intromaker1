import { background, drawLayout, dust, flash, headline, headlineGradient } from "../fx";
import { clamp, ease, lerp, mixHex, range, rgba, rng } from "../math";
import { displayFont, subFont } from "../text";
import type { Skill, SkillContext } from "../types";

/**
 * Movie-trailer grammar: the studio ident that opens a trailer, the title cards that carry its
 * story between shots ("THIS WINTER…"), and the billing block that closes it (the title, the
 * credits block in tall condensed type, the release line). They take the genre's look: horror
 * cards flicker, action cards slam in, comedy cards pop on colour, romance and drama fade warm.
 */

const cards = (sc: SkillContext) => sc.genre ?? "";

/** Near-black stage with the faintest tint of the palette and drifting dust in the projector beam. */
function blackStage(sc: SkillContext, tint = 0.06) {
  const { ctx, w, h, palette } = sc;
  ctx.fillStyle = mixHex(palette.bg0, "#000000", 0.7);
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.6);
  g.addColorStop(0, rgba(palette.primary, tint));
  g.addColorStop(1, rgba(palette.primary, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/* ───────────────────────── Studio Ident ───────────────────────── */

/**
 * The studio card: a beam of light sweeps across black and leaves the studio's name in
 * brushed-metal capitals, "PRESENTS" fading in beneath, the whole card pushing in slowly.
 */
function studioIdent(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene } = sc;
  blackStage(sc, 0.05);
  dust(sc, 40, palette.text, 0.1);
  const push = 1 + 0.05 * ease.inOutCubic(range(t, 0, d));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(push, push);
  ctx.translate(-w / 2, -h / 2);
  const layout = headline(sc, { sizeFrac: 0.085, widthFrac: 0.72, maxLines: 2, text: scene.text.toUpperCase() });
  layout.tracking += layout.size * 0.22;
  const sweep = ease.inOutCubic(range(t, 0.25, 1.6));
  const bx = lerp(-w * 0.2, w * 1.2, sweep);
  const ex = range(t, d - 0.55, d);
  // The name, revealed behind the beam (left of it is lit).
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, bx, h);
  ctx.clip();
  ctx.fillStyle = headlineGradient(sc, layout, mixHex(palette.text, "#ffffff", 0.4), mixHex(palette.secondary, palette.text, 0.4));
  ctx.globalAlpha = 1 - ex;
  drawLayout(sc, layout);
  ctx.restore();
  // The beam itself: a soft vertical band of light with a bright core.
  if (sweep > 0 && sweep < 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const band = ctx.createLinearGradient(bx - 140 * u, 0, bx + 40 * u, 0);
    band.addColorStop(0, rgba(palette.primary, 0));
    band.addColorStop(0.75, rgba(palette.primary, 0.35));
    band.addColorStop(0.95, "rgba(255,255,255,0.9)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(bx - 140 * u, layout.ys[0] - layout.size * 1.4, 180 * u, (layout.ys[layout.ys.length - 1] - layout.ys[0]) + layout.size * 2.8);
    ctx.restore();
  }
  // "PRESENTS" (or the ident's own subtitle).
  const sub = (scene.subtext ?? "presents").toUpperCase();
  const sk = ease.outCubic(range(t, 1.5, 2.3)) * (1 - ex);
  if (sk > 0) {
    ctx.save();
    ctx.globalAlpha = sk * 0.8;
    ctx.font = subFont(Math.min(w, h) * 0.022, 500);
    ctx.fillStyle = palette.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const bottom = layout.ys[layout.ys.length - 1] + layout.size * 0.95;
    ctx.fillText(sub.split("").join("  "), w / 2, bottom + (1 - sk) * 8 * u);
    ctx.restore();
  }
  ctx.restore();
  flash(sc, 1 - ease.outCubic(range(t, 0, 0.35)), "#000000");
}

/* ───────────────────────── Title Card ───────────────────────── */

/**
 * The trailer's title card: a line of story set alone in tracked capitals, faded up from black,
 * held over a slow push and faded back down. Each genre plays it its own way.
 */
function intertitle(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, seed } = sc;
  const g = cards(sc);
  const loud = g === "comedy" || g === "family";
  if (loud) {
    // Bright genres: the card is colour, not black.
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, w, h);
    const v = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    v.addColorStop(0, rgba("#ffffff", 0.12));
    v.addColorStop(1, rgba(palette.bg0, 0.35));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  } else blackStage(sc, g === "horror" ? 0.08 : 0.05);
  if (g === "romance" || g === "drama" || g === "fantasy") dust(sc, 30, palette.secondary, 0.08);

  const fadeIn = g === "action" ? range(t, 0.05, 0.22) : range(t, 0.1, g === "drama" || g === "romance" ? 1.1 : 0.75);
  const fadeOut = 1 - range(t, d - (g === "action" ? 0.2 : 0.55), d);
  let a = ease.inOutCubic(fadeIn) * fadeOut;
  // Horror: the card can't hold still; the light stutters.
  const r = rng(seed + Math.floor(t * 18));
  let jx = 0;
  if (g === "horror") {
    if (r() < 0.12) a *= 0.25 + r() * 0.4;
    if (r() < 0.05) jx = (r() - 0.5) * 14 * u;
  }
  const layout = headline(sc, { sizeFrac: loud ? 0.1 : 0.078, widthFrac: 0.74, maxLines: 3, text: scene.text.toUpperCase() });
  layout.tracking += layout.size * (loud ? 0.02 : g === "action" ? 0.06 : 0.16);
  const push = g === "action" ? 1.25 - 0.25 * ease.outExpo(range(t, 0.05, 0.4)) : 1 + 0.06 * ease.inOutCubic(range(t, 0, d));
  const pop = loud ? 0.6 + 0.4 * Math.min(1.08, Math.max(0, 1 - Math.exp(-7 * Math.max(0, t - 0.08)) * Math.cos(12 * Math.max(0, t - 0.08)))) : 1;
  const cy = (layout.ys[0] + layout.ys[layout.ys.length - 1]) / 2;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  ctx.translate(w / 2 + jx, cy);
  ctx.scale(push * pop, push * pop);
  ctx.translate(-w / 2, -cy);
  if (g === "thriller") {
    // A thin cold line of light through the card, like a slit of a door.
    const lk = ease.outCubic(range(t, 0.2, 1.1));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lg = ctx.createLinearGradient(w / 2 - (w * 0.4 * lk), 0, w / 2 + w * 0.4 * lk, 0);
    lg.addColorStop(0, rgba(palette.primary, 0));
    lg.addColorStop(0.5, rgba(palette.primary, 0.55));
    lg.addColorStop(1, rgba(palette.primary, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(0, layout.ys[layout.ys.length - 1] + layout.size * 0.85, w, 1.5 * u);
    ctx.restore();
  }
  ctx.fillStyle = loud ? "#ffffff" : g === "horror" ? mixHex(palette.text, "#c8c0b8", 0.5) : palette.text;
  if (g === "horror" || g === "fantasy" || g === "scifi") {
    ctx.shadowColor = rgba(palette.primary, g === "horror" ? 0.55 : 0.45);
    ctx.shadowBlur = 22 * u;
  }
  if (loud) {
    ctx.shadowColor = rgba(palette.bg0, 0.45);
    ctx.shadowOffsetY = 6 * u;
  }
  drawLayout(sc, layout);
  ctx.restore();
  if (scene.subtext) {
    const sk = ease.outCubic(range(t, 0.7, 1.4)) * fadeOut;
    ctx.save();
    ctx.globalAlpha = sk * 0.75;
    ctx.font = subFont(Math.min(w, h) * 0.024, 500);
    ctx.fillStyle = loud ? "#ffffff" : palette.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(scene.subtext.toUpperCase().split("").join(" "), w / 2, layout.ys[layout.ys.length - 1] + layout.size * 1.3);
    ctx.restore();
  }
  // Action cards land on a white flash.
  if (g === "action") flash(sc, 0.55 * (1 - range(t, 0.05, 0.3)) * (t > 0.05 ? 1 : 0));
}

/* ───────────────────────── Billing Block ───────────────────────── */

/**
 * The trailer's last card: the title in the film's type, the billing block beneath it (the
 * credits in tall, tightly condensed capitals) and the release line, as on a film poster.
 */
function billingBlock(sc: SkillContext) {
  const { ctx, w, h, t, d, u, palette, scene, font } = sc;
  const portrait = h > w;
  background(sc, { hot: palette.primary, hotAlpha: 0.1 });
  dust(sc, 50, palette.secondary, 0.1);
  const push = 1 + 0.035 * ease.inOutCubic(range(t, 0, d));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(push, push);
  ctx.translate(-w / 2, -h / 2);
  // Title.
  const layout = headline(sc, { sizeFrac: portrait ? 0.16 : 0.15, widthFrac: 0.8, maxLines: 2, cy: h * (portrait ? 0.4 : 0.38), text: scene.text.toUpperCase() });
  const tk = ease.outCubic(range(t, 0.15, 1.3));
  layout.tracking += layout.size * 0.12 * (1 - tk) + (font === "cinzel" ? layout.size * 0.04 : 0);
  ctx.save();
  ctx.globalAlpha = tk;
  const blur = (1 - tk) * 14 * u;
  if (blur > 0.5) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.fillStyle = headlineGradient(sc, layout, mixHex(palette.text, "#ffffff", 0.3), mixHex(palette.secondary, palette.text, 0.35));
  ctx.shadowColor = rgba(palette.primary, 0.4);
  ctx.shadowBlur = 30 * u;
  drawLayout(sc, layout);
  ctx.restore();
  // The billing block: credits in tall condensed capitals, two or three tight lines.
  const lines = (scene.items ?? []).map((x) => x.toUpperCase()).filter(Boolean).slice(0, 4);
  const below = layout.ys[layout.ys.length - 1] + layout.size * 0.75;
  let y = below + 18 * u;
  const bk = ease.outCubic(range(t, 1.1, 1.9));
  if (lines.length && bk > 0) {
    const size = Math.min(w, h) * (portrait ? 0.03 : 0.028);
    ctx.save();
    ctx.globalAlpha = bk * 0.82;
    ctx.fillStyle = palette.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 ${Math.round(size)}px "Bebas Neue", "${font === "bebas" ? "Bebas Neue" : "Inter"}", sans-serif`;
    for (const line of lines) {
      // Condensed like a poster's billing block: squeezed horizontally, set tight.
      ctx.save();
      ctx.translate(w / 2, y);
      ctx.scale(0.72, 1.18);
      ctx.fillText(line, 0, 0, (w * 0.84) / 0.72);
      ctx.restore();
      y += size * 1.15;
    }
    ctx.restore();
  }
  // The release line.
  const rel = (scene.subtext ?? "Coming soon").toUpperCase();
  const rk = ease.outCubic(range(t, 1.7, 2.5));
  if (rk > 0) {
    const size = Math.min(w, h) * 0.034;
    ctx.save();
    ctx.globalAlpha = rk;
    ctx.font = displayFont(font, size);
    ctx.fillStyle = mixHex(palette.secondary, palette.text, 0.3);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rel.split("").join(" "), w / 2, y + size * 1.2 + (1 - rk) * 10 * u);
    ctx.restore();
  }
  ctx.restore();
  flash(sc, 1 - ease.outCubic(range(t, 0, 0.3)), "#000000");
}

export const movieSkills: Skill[] = [
  {
    id: "studio-ident",
    name: "Studio Ident",
    tagline: "A beam of light sweeps across black and leaves the studio's name in brushed metal, 'PRESENTS' beneath.",
    bestFor: "The opening card of a movie trailer. Text = the studio or production company (or the filmmaker); subtext = 'presents' or 'a film by'.",
    sample: { text: "IntroMaker Pictures", subtext: "presents" },
    render: studioIdent,
    sfx: () => [
      { t: 0.25, kind: "whoosh" },
      { t: 1.5, kind: "shimmer" },
    ],
  },
  {
    id: "intertitle",
    name: "Title Card",
    tagline: "A line of the story alone in tracked capitals, faded up from black and held over a slow push: the trailer's voice between shots.",
    bestFor: "Movie trailers: the story beats between shots ('THIS WINTER', 'ONE LAST JOB', 'SECRETS SURFACE'). 2–6 words.",
    sample: { text: "This winter", subtext: "" },
    render: intertitle,
    sfx: () => [{ t: 0.1, kind: "whoosh" }],
  },
  {
    id: "billing-block",
    name: "Billing Block",
    tagline: "The trailer's end card: the title, the credits in tall condensed capitals, and the release line.",
    bestFor: "The last card of a movie trailer. Text = the film's title; items = credit lines ('DIRECTED BY …', 'STARRING …'); subtext = the release line ('Coming soon', 'In cinemas December 12').",
    sample: { text: "The Lantern Deep", subtext: "Coming soon", items: ["IntroMaker Pictures presents", "A film by IntroMaker Pictures"] },
    itemsHint: "Credit lines, e.g. Directed by …, Starring …",
    render: billingBlock,
    sfx: () => [
      { t: 0.15, kind: "whoosh" },
      { t: 1.7, kind: "shimmer" },
    ],
  },
];
