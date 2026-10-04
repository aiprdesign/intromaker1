import { imageFailed, imageFailures } from "./media";
import type { Brand, Media, Scene, SkillId, VideoPlan } from "./types";

/**
 * Placeholder pictures for slides that show your media when there's none yet (no image on the
 * slide, none from the site): a "Product image" tile on a white studio background (the product
 * slides cut it out like a real listing photo), an app screen, a full website page and an "Image"
 * frame. They're drawn in the browser as data URLs and are never saved in a film: add a real
 * picture in the slide editor and it takes their place.
 */

type Kind = "product" | "product2" | "ui" | "page" | "photo";
const cache = new Map<Kind, string>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d", { willReadFrequently: true })!] as const;
}

const bar = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, r = h / 2) => {
  g.fillStyle = c;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
};

/** The picture icon: a frame with a sun and two hills. */
function pictureIcon(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const w = size;
  const h = size * 0.78;
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = size * 0.07;
  g.lineJoin = "round";
  g.beginPath();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, size * 0.12);
  g.stroke();
  g.beginPath();
  g.arc(cx + w * 0.2, cy - h * 0.16, size * 0.09, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx - w * 0.38, cy + h * 0.34);
  g.lineTo(cx - w * 0.1, cy - h * 0.04);
  g.lineTo(cx + w * 0.08, cy + h * 0.16);
  g.lineTo(cx + w * 0.2, cy + h * 0.04);
  g.lineTo(cx + w * 0.38, cy + h * 0.34);
  g.closePath();
  g.fill();
  g.restore();
}

/**
 * The product placeholder graphic: a soft tile with a dashed outline, a picture icon and
 * "Product image", on a white studio background (so product slides cut it out like a real photo).
 * The second one is a portrait tile, for "another angle".
 */
function product(alt: boolean) {
  const [c, g] = canvas(900, 900);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 900, 900);
  const w = alt ? 440 : 560;
  const h = alt ? 620 : 560;
  const x = 450 - w / 2;
  const y = 450 - h / 2;
  const fill = g.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, "#f1f3f8");
  fill.addColorStop(1, "#d9dee8");
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, 56);
  g.fill();
  g.setLineDash([22, 14]);
  g.lineWidth = 6;
  g.strokeStyle = "#a3abbb";
  g.beginPath();
  g.roundRect(x + 14, y + 14, w - 28, h - 28, 44);
  g.stroke();
  g.setLineDash([]);
  pictureIcon(g, 450, 450 - 40, 150, "#8b94a8");
  g.fillStyle = "#6f788c";
  g.font = "700 34px sans-serif";
  g.textAlign = "center";
  g.fillText("PRODUCT IMAGE", 450, 450 + 90);
  g.font = "500 22px sans-serif";
  g.fillStyle = "#8b94a8";
  g.fillText(alt ? "another angle" : "add yours to this slide", 450, 450 + 130);
  return c.toDataURL("image/png");
}

/** An app screen: sidebar, header, stat cards, a chart and table rows. */
function ui() {
  const [c, g] = canvas(1600, 1000);
  g.fillStyle = "#0f1220";
  g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = "#151a2c";
  g.fillRect(0, 0, 280, 1000);
  bar(g, 40, 44, 140, 22, "#7c8cff");
  for (let i = 0; i < 7; i++) bar(g, 40, 130 + i * 58, 150 + (i % 3) * 30, 16, i === 1 ? "#cfd6ff" : "#3a4263");
  bar(g, 330, 44, 360, 26, "#e8ebff");
  bar(g, 1380, 36, 180, 44, "#7c8cff", 12);
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.font = "600 20px sans-serif";
  g.fillText("Your app", 1420, 66);
  const cards = ["#7c8cff", "#2ec4b6", "#ff8a65"];
  cards.forEach((col, i) => {
    const x = 330 + i * 410;
    bar(g, x, 120, 380, 170, "#181e33", 18);
    bar(g, x + 30, 150, 140, 14, "#4a5378");
    bar(g, x + 30, 190, 200, 40, col, 10);
    bar(g, x + 30, 252, 260, 10, "#2c3452");
  });
  bar(g, 330, 320, 790, 400, "#181e33", 18);
  g.strokeStyle = "#7c8cff";
  g.lineWidth = 6;
  g.beginPath();
  [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach((k) => {
    const px = 370 + k * 88;
    const py = 660 - (Math.sin(k * 0.9) * 0.3 + k / 8) * 230;
    if (k) g.lineTo(px, py);
    else g.moveTo(px, py);
  });
  g.stroke();
  bar(g, 1150, 320, 410, 400, "#181e33", 18);
  for (let i = 0; i < 6; i++) {
    bar(g, 1180, 360 + i * 56, 40, 40, ["#7c8cff", "#2ec4b6", "#ff8a65"][i % 3], 20);
    bar(g, 1240, 368 + i * 56, 220 - (i % 2) * 60, 12, "#4a5378");
    bar(g, 1240, 390 + i * 56, 140, 10, "#2c3452");
  }
  for (let i = 0; i < 4; i++) {
    bar(g, 330, 750 + i * 60, 1230, 48, i % 2 ? "#141a2d" : "#181e33", 10);
    bar(g, 360, 766 + i * 60, 260, 14, "#4a5378");
    bar(g, 900, 766 + i * 60, 160, 14, "#2c3452");
    bar(g, 1400, 762 + i * 60, 120, 22, i % 2 ? "#2ec4b6" : "#7c8cff", 11);
  }
  return c.toDataURL("image/png");
}

/** A full website page: nav, hero, logos, features, a split section, testimonial and footer. */
function page() {
  const [c, g] = canvas(1440, 4200);
  const sec = (y: number, h: number, bg: string) => {
    g.fillStyle = bg;
    g.fillRect(0, y, 1440, h);
  };
  sec(0, 900, "#0d1020");
  bar(g, 120, 34, 120, 24, "#ffffff");
  for (let i = 0; i < 4; i++) bar(g, 520 + i * 130, 40, 90, 12, "#6b7398");
  bar(g, 1180, 26, 140, 42, "#7c8cff", 12);
  g.fillStyle = "#ffffff";
  g.font = "700 76px sans-serif";
  g.textAlign = "center";
  g.fillText("Your website", 720, 300);
  bar(g, 420, 350, 600, 18, "#8a92b8");
  bar(g, 500, 384, 440, 18, "#8a92b8");
  bar(g, 600, 450, 240, 56, "#7c8cff", 14);
  bar(g, 220, 560, 1000, 340, "#1a2038", 20);
  bar(g, 260, 600, 300, 20, "#3a4263");
  bar(g, 260, 640, 920, 220, "#141a2d", 14);
  sec(900, 300, "#ffffff");
  for (let i = 0; i < 6; i++) bar(g, 160 + i * 200, 1030, 130, 34, "#c8ccd8", 8);
  sec(1200, 1000, "#f4f5fb");
  g.fillStyle = "#14182b";
  g.font = "700 54px sans-serif";
  g.fillText("Tools you need", 720, 1360);
  for (let i = 0; i < 3; i++) {
    const x = 160 + i * 400;
    bar(g, x, 1460, 360, 420, "#ffffff", 20);
    bar(g, x + 36, 1500, 64, 64, ["#7c8cff", "#2ec4b6", "#ff8a65"][i], 16);
    bar(g, x + 36, 1600, 220, 22, "#14182b");
    bar(g, x + 36, 1650, 280, 12, "#9aa0b4");
    bar(g, x + 36, 1676, 240, 12, "#9aa0b4");
  }
  sec(2200, 900, "#ffffff");
  bar(g, 160, 2380, 480, 40, "#14182b", 10);
  for (let i = 0; i < 4; i++) bar(g, 160, 2460 + i * 34, 520 - i * 40, 14, "#9aa0b4");
  bar(g, 160, 2640, 200, 52, "#7c8cff", 14);
  bar(g, 780, 2340, 500, 600, "#eef0f8", 24);
  bar(g, 820, 2380, 420, 300, "#d9ddf0", 16);
  sec(3100, 600, "#0d1020");
  bar(g, 420, 3290, 600, 22, "#cfd3ea");
  bar(g, 480, 3330, 480, 22, "#cfd3ea");
  bar(g, 660, 3420, 120, 120, "#3a4263", 60);
  sec(3700, 500, "#090b16");
  for (let col = 0; col < 4; col++) for (let r = 0; r < 4; r++) bar(g, 160 + col * 300, 3800 + r * 44, 160 - r * 20, 12, "#3a4263");
  return c.toDataURL("image/jpeg", 0.85);
}

/** The image placeholder graphic: a dashed frame with a picture icon and "Image". */
function photo() {
  const [c, g] = canvas(1600, 1000);
  const bg = g.createLinearGradient(0, 0, 1600, 1000);
  bg.addColorStop(0, "#e9ecf3");
  bg.addColorStop(1, "#cfd5e1");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1600, 1000);
  g.setLineDash([26, 16]);
  g.lineWidth = 8;
  g.strokeStyle = "#a3abbb";
  g.beginPath();
  g.roundRect(40, 40, 1520, 920, 40);
  g.stroke();
  g.setLineDash([]);
  pictureIcon(g, 800, 440, 230, "#8b94a8");
  g.fillStyle = "#6f788c";
  g.font = "700 52px sans-serif";
  g.textAlign = "center";
  g.fillText("IMAGE", 800, 640);
  g.font = "500 30px sans-serif";
  g.fillStyle = "#8b94a8";
  g.fillText("add yours to this slide", 800, 690);
  return c.toDataURL("image/jpeg", 0.88);
}

/** The data URL for a placeholder (drawn once). */
export function placeholder(kind: Kind): string {
  let src = cache.get(kind);
  if (!src) {
    src = kind === "product" ? product(false) : kind === "product2" ? product(true) : kind === "ui" ? ui() : kind === "page" ? page() : photo();
    cache.set(kind, src);
  }
  return src;
}

const PRODUCT: SkillId[] = ["product-hero", "product-end", "product-spin", "product-zoom", "product-teaser"];
const PICTURE: Partial<Record<SkillId, Kind>> = {
  "site-scroll": "page",
  "ui-tour": "ui",
  "ui-cards": "ui",
  "ui-assemble": "ui",
  spotlight: "ui",
  "device-trio": "ui",
  "exploded-ui": "ui",
  "comment-pins": "ui",
  "before-after": "ui",
  "product-showcase": "ui",
  "type-mask": "photo",
  "photo-montage": "photo",
  "gallery-flow": "ui",
  "carousel-3d": "ui",
  "tilt-wall": "ui",
  "screen-wall": "ui",
};

/** The placeholder images to preload before painting still previews. */
export function placeholderSources() {
  return (["product", "product2", "ui", "page", "photo"] as Kind[]).map(placeholder);
}

/**
 * A preview's scene and plan with stand-in pictures, when the slide shows media and there's none
 * of its own (no media on the slide, no images in the brand). Anything real is left alone.
 */
const memo = new WeakMap<Scene, { plan: object; out: { scene: Scene; plan: object }; v: number }>();
export function withPlaceholders<P extends Partial<VideoPlan>>(scene: Scene, plan: P): { scene: Scene; plan: P } {
  if (typeof document === "undefined") return { scene, plan };
  const hit = memo.get(scene);
  const v = imageFailures();
  if (hit && hit.plan === plan && hit.v === v) return hit.out as { scene: Scene; plan: P };
  const out = placeholdersFor(scene, plan);
  memo.set(scene, { plan, out, v });
  return out;
}

/** Does this slide show a placeholder (it needs a picture and has none of its own)? */
export function needsPicture(scene: Scene, plan: Partial<VideoPlan>) {
  return withPlaceholders(scene, plan).scene !== scene;
}

function placeholdersFor<P extends Partial<VideoPlan>>(scene: Scene, plan: P): { scene: Scene; plan: P } {
  const isProduct = PRODUCT.includes(scene.skill);
  const kind = isProduct ? "product" : PICTURE[scene.skill];
  if (!kind) return { scene, plan };
  // Pictures that failed to load count as none: a slide whose own picture broke borrows one of
  // the film's pictures that works, and placeholders stand in only when none do.
  const ownBroken = !!scene.media && imageFailed(scene.media.src);
  if (scene.media && !ownBroken) return { scene, plan };
  const all = plan.brand?.images ?? [];
  const good = all.filter((x) => !imageFailed(x));
  if (good.length) {
    if (!ownBroken && good.length === all.length) return { scene, plan };
    const brand = { ...plan.brand!, images: good };
    return { scene: ownBroken ? { ...scene, media: { src: good[0], kind: "image" } } : scene, plan: { ...plan, brand } };
  }
  const images = isProduct ? [placeholder("product"), placeholder("product2")] : [placeholder("ui"), placeholder("photo"), placeholder("page")];
  const media: Media = { src: placeholder(kind), kind: "image" };
  const brand: Brand = { name: plan.brand?.name ?? plan.title ?? "Acme", ...(plan.brand ?? {}), images, videos: plan.brand?.videos ?? [] };
  return { scene: { ...scene, media }, plan: { ...plan, brand, product: isProduct || plan.product } };
}
