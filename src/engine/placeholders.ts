import type { Brand, Media, Scene, SkillId, VideoPlan } from "./types";

/**
 * Stand-in pictures for slide previews (the skill gallery, the slide-style picker, template
 * samples) when there's no real media yet: a product on a white studio background (the product
 * slides cut it out like a real listing photo), an app screen, a full website page and a photo.
 * They're drawn in the browser as data URLs, used only in previews, and never saved in a film.
 */

type Kind = "product" | "product2" | "ui" | "page" | "photo";
const cache = new Map<Kind, string>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

const bar = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, r = h / 2) => {
  g.fillStyle = c;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
};

/** A generic product (a smart speaker) on white, softly lit: a second angle is narrower. */
function product(alt: boolean) {
  const [c, g] = canvas(900, 900);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 900, 900);
  const w = alt ? 300 : 380;
  const x = 450 - w / 2;
  const top = 190;
  const h = 560;
  // Body: brushed aluminium-ish gradient.
  const body = g.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, "#9aa1ad");
  body.addColorStop(0.25, "#d9dde4");
  body.addColorStop(0.55, "#eef0f4");
  body.addColorStop(1, "#8d94a1");
  g.fillStyle = body;
  g.beginPath();
  g.roundRect(x, top, w, h, alt ? 70 : 90);
  g.fill();
  // Fabric band with a dot pattern.
  g.save();
  g.beginPath();
  g.roundRect(x, top + h * 0.38, w, h * 0.5, 30);
  g.clip();
  const fab = g.createLinearGradient(x, 0, x + w, 0);
  fab.addColorStop(0, "#3b414c");
  fab.addColorStop(0.5, "#5a616e");
  fab.addColorStop(1, "#343944");
  g.fillStyle = fab;
  g.fillRect(x, top + h * 0.38, w, h * 0.5);
  g.fillStyle = "rgba(255,255,255,0.08)";
  for (let yy = top + h * 0.4; yy < top + h * 0.88; yy += 14) for (let xx = x + 8; xx < x + w; xx += 14) g.fillRect(xx, yy, 4, 4);
  g.restore();
  // Top control ring and a status light.
  g.fillStyle = "#c4c9d2";
  g.beginPath();
  g.ellipse(450, top + 70, w * 0.28, 22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2ec4b6";
  g.beginPath();
  g.arc(450, top + 70, 9, 0, Math.PI * 2);
  g.fill();
  // Specular highlight down one side.
  const hi = g.createLinearGradient(x + w * 0.18, 0, x + w * 0.3, 0);
  hi.addColorStop(0, "rgba(255,255,255,0)");
  hi.addColorStop(0.5, "rgba(255,255,255,0.55)");
  hi.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hi;
  g.fillRect(x + w * 0.18, top + 30, w * 0.12, h * 0.32);
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = "600 22px sans-serif";
  g.textAlign = "center";
  g.fillText("YOUR PRODUCT", 450, top + h * 0.3);
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
  g.fillText("Everything you need", 720, 1360);
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

/** A warm lifestyle photo: soft light, a table and the product on it. */
function photo() {
  const [c, g] = canvas(1600, 1000);
  const sky = g.createLinearGradient(0, 0, 0, 1000);
  sky.addColorStop(0, "#f7c59f");
  sky.addColorStop(0.55, "#e8916b");
  sky.addColorStop(1, "#6d3f3a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 1600, 1000);
  for (let i = 0; i < 14; i++) {
    const x = (i * 263) % 1600;
    const y = 80 + ((i * 137) % 420);
    const r = 40 + (i % 4) * 30;
    const b = g.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, "rgba(255,240,220,0.45)");
    b.addColorStop(1, "rgba(255,240,220,0)");
    g.fillStyle = b;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.fillStyle = "#4a2c28";
  g.fillRect(0, 760, 1600, 240);
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.fillRect(0, 760, 1600, 6);
  bar(g, 700, 470, 200, 300, "#2f343e", 50);
  bar(g, 700, 600, 200, 150, "#454c58", 20);
  g.fillStyle = "#2ec4b6";
  g.beginPath();
  g.arc(800, 510, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "600 30px sans-serif";
  g.textAlign = "center";
  g.fillText("Your photo", 800, 900);
  return c.toDataURL("image/jpeg", 0.85);
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
export function withPlaceholders<P extends Partial<VideoPlan>>(scene: Scene, plan: P): { scene: Scene; plan: P } {
  if (typeof document === "undefined") return { scene, plan };
  const isProduct = PRODUCT.includes(scene.skill);
  const kind = isProduct ? "product" : PICTURE[scene.skill];
  if (!kind || scene.media || plan.brand?.images?.length) return { scene, plan };
  const images = isProduct ? [placeholder("product"), placeholder("product2")] : [placeholder("ui"), placeholder("photo"), placeholder("page")];
  const media: Media = { src: placeholder(kind), kind: "image" };
  const brand: Brand = { name: plan.brand?.name ?? plan.title ?? "Acme", ...(plan.brand ?? {}), images, videos: plan.brand?.videos ?? [] };
  return { scene: { ...scene, media }, plan: { ...plan, brand, product: isProduct || plan.product } };
}
