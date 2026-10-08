/**
 * Designed product screens for device slides when there's no screenshot: a polished desktop web
 * app (sidebar, search, KPI cards with sparklines, an area chart, a donut, a table with avatars and
 * status pills) and a mobile app (status bar, dynamic island space, greeting, a chart card, a list,
 * a tab bar), in the video's colours and with the brand's name. Drawn once per palette and cached.
 */
import { hashString, mixHex, rgba, rng } from "./math";
import type { Palette } from "./types";

const cache = new Map<string, HTMLCanvasElement>();
type G = CanvasRenderingContext2D;

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const font = (g: G, size: number, weight = 500) => void (g.font = `${weight} ${size}px ${FONT}`);

function rr(g: G, x: number, y: number, w: number, h: number, r: number, fill: string, shadow = false) {
  g.save();
  if (shadow) {
    g.shadowColor = "rgba(20,20,40,0.08)";
    g.shadowBlur = 24;
    g.shadowOffsetY = 6;
  }
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
  g.restore();
}

/** Colours for a screen: a light app on light stages, a dark app on dark ones. */
function theme(p: Palette) {
  const light = !!p.light || true;
  return {
    light,
    bg: "#f6f7fb",
    card: "#ffffff",
    side: "#ffffff",
    line: "#eceef4",
    ink: "#161827",
    sub: "#6b6f82",
    faint: "#a3a7b8",
    a: p.primary,
    b: p.secondary,
    c: p.accent,
  };
}

/** A smooth line through points (Catmull-Rom as Béziers). */
function smooth(g: G, pts: [number, number][]) {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}

function series(seed: number, n: number, lo = 0.25, hi = 0.85) {
  const r = rng(seed);
  let v = 0.45;
  return Array.from({ length: n }, (_, i) => {
    v += (r() - 0.42) * 0.18 + (i / n) * 0.02;
    v = Math.min(hi, Math.max(lo, v));
    return v;
  });
}

function avatar(g: G, x: number, y: number, r: number, col: string, letter: string) {
  g.fillStyle = mixHex(col, "#ffffff", 0.65);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = mixHex(col, "#000000", 0.25);
  font(g, r * 0.95, 700);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(letter, x, y + 1);
}

/** Icon-ish glyphs for nav and cards: simple geometric marks. */
function glyph(g: G, kind: number, x: number, y: number, s: number, col: string) {
  g.save();
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = s * 0.14;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  switch (kind % 6) {
    case 0:
      g.roundRect(x - s / 2, y - s / 2, s * 0.42, s * 0.42, s * 0.1);
      g.roundRect(x + s * 0.08, y - s / 2, s * 0.42, s * 0.42, s * 0.1);
      g.roundRect(x - s / 2, y + s * 0.08, s * 0.42, s * 0.42, s * 0.1);
      g.roundRect(x + s * 0.08, y + s * 0.08, s * 0.42, s * 0.42, s * 0.1);
      g.stroke();
      break;
    case 1:
      g.moveTo(x - s / 2, y + s / 2);
      g.lineTo(x - s / 2, y - s * 0.1);
      g.moveTo(x, y + s / 2);
      g.lineTo(x, y - s / 2);
      g.moveTo(x + s / 2, y + s / 2);
      g.lineTo(x + s / 2, y + s * 0.1);
      g.stroke();
      break;
    case 2:
      g.arc(x, y - s * 0.15, s * 0.22, 0, Math.PI * 2);
      g.moveTo(x - s * 0.42, y + s * 0.48);
      g.quadraticCurveTo(x, y - s * 0.05, x + s * 0.42, y + s * 0.48);
      g.stroke();
      break;
    case 3:
      g.roundRect(x - s / 2, y - s * 0.35, s, s * 0.8, s * 0.12);
      g.moveTo(x - s / 2, y - s * 0.08);
      g.lineTo(x + s / 2, y - s * 0.08);
      g.stroke();
      break;
    case 4:
      g.arc(x, y, s * 0.45, 0, Math.PI * 2);
      g.moveTo(x, y - s * 0.22);
      g.lineTo(x, y);
      g.lineTo(x + s * 0.18, y + s * 0.12);
      g.stroke();
      break;
    default:
      g.moveTo(x - s * 0.45, y + s * 0.1);
      g.lineTo(x - s * 0.1, y + s * 0.42);
      g.lineTo(x + s * 0.45, y - s * 0.38);
      g.stroke();
  }
  g.restore();
}

/** A project board: four columns of cards with tags, progress, avatars and due dates. */
function kanban(g: G, T: ReturnType<typeof theme>, r: () => number) {
  const cols = [
    ["To do", T.faint, ["Research interviews", "Pricing page copy", "Onboarding emails"]],
    ["In progress", T.a, ["New dashboard", "Mobile checkout", "Help centre search"]],
    ["Review", T.c, ["Brand refresh", "Billing settings"]],
    ["Done", T.b, ["Team invites", "Dark mode", "Export to CSV"]],
  ] as const;
  const tags = ["Design", "Web", "Mobile", "Content", "Growth"];
  const x0 = 310;
  const cw = 298;
  cols.forEach(([title, col, cards], ci) => {
    const x = x0 + ci * (cw + 20);
    rr(g, x, 132, cw, 836, 20, mixHex(T.bg, "#e9ebf2", 0.6));
    rr(g, x + 20, 156, 10, 10, 5, col);
    g.fillStyle = T.ink;
    font(g, 18, 720);
    g.fillText(title, x + 40, 162);
    const tw = g.measureText(title).width;
    rr(g, x + 50 + tw, 148, 30, 26, 13, T.card);
    g.fillStyle = T.sub;
    font(g, 14, 650);
    g.textAlign = "center";
    g.fillText(String(cards.length), x + 65 + tw, 162);
    g.textAlign = "left";
    let y = 194;
    cards.forEach((card, k) => {
      const tall = (ci + k) % 2 === 0;
      const ch = tall ? 214 : 168;
      rr(g, x + 14, y, cw - 28, ch, 16, T.card, true);
      const tag = tags[(ci * 3 + k) % tags.length];
      const tc = [T.a, T.b, T.c][(ci + k) % 3];
      font(g, 13, 700);
      const tgw = g.measureText(tag).width + 24;
      rr(g, x + 32, y + 20, tgw, 26, 13, mixHex(tc, "#ffffff", 0.84));
      g.fillStyle = tc;
      g.fillText(tag, x + 44, y + 34);
      g.fillStyle = T.ink;
      font(g, 18, 680);
      g.fillText(card, x + 32, y + 76, cw - 64);
      if (tall) {
        // A cover strip: a soft brand gradient standing in for an attached image.
        const cg = g.createLinearGradient(x + 32, y + 96, x + cw - 46, y + 140);
        cg.addColorStop(0, mixHex(tc, "#ffffff", 0.55));
        cg.addColorStop(1, mixHex(T.a, T.b, 0.5));
        g.fillStyle = cg;
        g.beginPath();
        g.roundRect(x + 32, y + 94, cw - 64, 50, 10);
        g.fill();
      }
      const py = y + ch - 52;
      const pr = ci === 3 ? 1 : ci === 0 ? 0.08 + r() * 0.1 : 0.35 + r() * 0.45;
      rr(g, x + 32, py, cw - 64, 8, 4, T.line);
      rr(g, x + 32, py, (cw - 64) * pr, 8, 4, ci === 3 ? T.b : tc);
      avatar(g, x + 44, py + 30, 12, [T.a, T.b, T.c][k % 3], "ABCDEFGHJK".charAt((ci * 3 + k) % 10));
      avatar(g, x + 64, py + 30, 12, [T.c, T.a, T.b][k % 3], "LMNPRSTUVW".charAt((ci * 5 + k) % 10));
      g.fillStyle = T.faint;
      font(g, 13, 600);
      g.textAlign = "right";
      g.fillText(["Mon", "Tue", "Wed", "Thu", "Fri"][(ci + k * 2) % 5], x + cw - 32, py + 31);
      g.textAlign = "left";
      y += ch + 14;
    });
  });
}

export function desktopUI(p: Palette, name: string, seed = 0): HTMLCanvasElement {
  const key = `d|${p.primary}|${p.secondary}|${p.accent}|${name}|${seed % 3}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // Drawn on a 1600×1000 layout, rendered at 1.25× for crisp text on big screens; the layout is
  // chunky so it still reads when the device is small in the frame.
  const W = 1600;
  const H = 1000;
  const c = document.createElement("canvas");
  c.width = W * 1.25;
  c.height = H * 1.25;
  const g = c.getContext("2d")!;
  g.scale(1.25, 1.25);
  const T = theme(p);
  const r = rng(hashString(key));
  g.fillStyle = T.bg;
  g.fillRect(0, 0, W, H);
  // Sidebar in a deep shade of the brand: the brand, navigation with the current page lit, an invite card.
  const sideBg = mixHex(T.a, "#0b0c14", 0.72);
  g.fillStyle = sideBg;
  g.fillRect(0, 0, 268, H);
  const grad = g.createLinearGradient(32, 34, 72, 74);
  grad.addColorStop(0, T.a);
  grad.addColorStop(1, mixHex(T.a, T.b, 0.6));
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(32, 34, 40, 40, 11);
  g.fill();
  g.fillStyle = "#ffffff";
  font(g, 22, 800);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText((name || "A").trim().charAt(0).toUpperCase(), 52, 55);
  g.textAlign = "left";
  g.fillStyle = "#ffffff";
  font(g, 22, 760);
  g.fillText(name.slice(0, 14) || "Workspace", 86, 55);
  // One seed in three shows a project board instead of the dashboard, for variety across slides.
  const board = seed % 3 === 2;
  const on = board ? 1 : 0;
  const nav = ["Overview", "Projects", "Team", "Calendar", "Reports", "Tasks"];
  nav.forEach((n, i) => {
    const y = 128 + i * 52;
    if (i === on) rr(g, 18, y - 22, 232, 46, 12, T.a);
    glyph(g, i, 46, y + 1, 20, i === on ? "#ffffff" : "rgba(255,255,255,0.55)");
    g.fillStyle = i === on ? "#ffffff" : "rgba(255,255,255,0.7)";
    font(g, 18, i === on ? 700 : 540);
    g.fillText(n, 72, y + 1);
  });
  rr(g, 18, H - 150, 232, 120, 16, "rgba(255,255,255,0.08)");
  g.fillStyle = "#ffffff";
  font(g, 16, 700);
  g.fillText("Invite your team", 38, H - 112);
  g.fillStyle = "rgba(255,255,255,0.6)";
  font(g, 13, 500);
  g.fillText("Work together in one place", 38, H - 88);
  rr(g, 38, H - 70, 92, 28, 8, T.a);
  g.fillStyle = "#ffffff";
  font(g, 13, 650);
  g.fillText("Invite", 62, H - 56);
  // Top bar: a greeting, search and an avatar.
  g.fillStyle = T.ink;
  font(g, 30, 750);
  g.fillText(board ? "Product launch" : "Good morning", 310, 66);
  g.fillStyle = T.sub;
  font(g, 16, 500);
  g.fillText(board ? "Board view · Sprint 14" : "Here's what's happening today", 310, 98);
  rr(g, 980, 40, 380, 50, 14, T.card, true);
  glyph(g, 4, 1008, 65, 16, T.faint);
  g.fillStyle = T.faint;
  font(g, 15, 500);
  g.fillText("Search", 1030, 66);
  rr(g, 1380, 40, 50, 50, 14, T.card, true);
  glyph(g, 3, 1405, 65, 18, T.sub);
  avatar(g, 1478, 65, 25, T.b, "J");
  if (board) {
    kanban(g, T, r);
    cache.set(key, c);
    return c;
  }
  // KPI cards with sparklines.
  const kpis = ["Active projects", "Tasks done", "Team members", "On schedule"];
  const vals = ["24", "186", "12", "9 of 10"];
  kpis.forEach((k, i) => {
    const x = 310 + i * 318;
    const y = 132;
    const col = [T.a, T.b, T.c, T.a][i];
    const hero = i === 0;
    if (hero) {
      const kg = g.createLinearGradient(x, y, x + 298, y + 150);
      kg.addColorStop(0, T.a);
      kg.addColorStop(1, mixHex(T.a, T.b, 0.55));
      g.save();
      g.shadowColor = rgba(T.a, 0.35);
      g.shadowBlur = 28;
      g.shadowOffsetY = 10;
      g.fillStyle = kg;
      g.beginPath();
      g.roundRect(x, y, 298, 150, 20);
      g.fill();
      g.restore();
    } else rr(g, x, y, 298, 150, 20, T.card, true);
    rr(g, x + 24, y + 24, 44, 44, 12, hero ? "rgba(255,255,255,0.22)" : mixHex(col, "#ffffff", 0.82));
    glyph(g, i + 1, x + 46, y + 46, 20, hero ? "#ffffff" : col);
    g.fillStyle = hero ? "rgba(255,255,255,0.85)" : T.sub;
    font(g, 16, 600);
    g.fillText(k, x + 84, y + 47, 196);
    g.fillStyle = hero ? "#ffffff" : T.ink;
    font(g, 40, 800);
    g.fillText(vals[i], x + 24, y + 110);
    const s = series(seed * 7 + i * 13, 12);
    g.beginPath();
    smooth(g, s.map((v, j) => [x + 168 + j * 10, y + 128 - v * 56] as [number, number]));
    g.strokeStyle = hero ? "#ffffff" : col;
    g.lineWidth = 4;
    g.stroke();
  });
  // An area chart with a soft gradient fill, gridlines and a highlighted point.
  rr(g, 310, 306, 840, 400, 18, T.card, true);
  g.fillStyle = T.ink;
  font(g, 20, 720);
  g.fillText("Progress", 338, 348);
  ["Week", "Month", "Year"].forEach((l, i) => {
    const x = 900 + i * 78;
    if (i === 1) rr(g, x - 8, 328, 72, 36, 10, mixHex(T.a, "#ffffff", 0.88));
    g.fillStyle = i === 1 ? T.a : T.sub;
    font(g, 14, 600);
    g.fillText(l, x + 6, 347);
  });
  const cx0 = 350;
  const cx1 = 1120;
  const cy0 = 400;
  const cy1 = 670;
  g.strokeStyle = T.line;
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = cy0 + ((cy1 - cy0) * i) / 4;
    g.beginPath();
    g.moveTo(cx0, y);
    g.lineTo(cx1, y);
    g.stroke();
  }
  const pts = series(seed * 3 + 1, 14, 0.2, 0.9).map((v, i) => [cx0 + ((cx1 - cx0) * i) / 13, cy1 - v * (cy1 - cy0)] as [number, number]);
  const pts2 = series(seed * 5 + 9, 14, 0.1, 0.6).map((v, i) => [cx0 + ((cx1 - cx0) * i) / 13, cy1 - v * (cy1 - cy0)] as [number, number]);
  const fill = g.createLinearGradient(0, cy0, 0, cy1);
  fill.addColorStop(0, rgba(T.a, 0.45));
  fill.addColorStop(1, rgba(T.a, 0));
  g.beginPath();
  smooth(g, pts);
  g.lineTo(cx1, cy1);
  g.lineTo(cx0, cy1);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.beginPath();
  smooth(g, pts2);
  g.strokeStyle = mixHex(T.b, "#ffffff", 0.2);
  g.lineWidth = 3;
  g.setLineDash([8, 8]);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  smooth(g, pts);
  g.strokeStyle = T.a;
  g.lineWidth = 6;
  g.stroke();
  const hp = pts[9];
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(hp[0], hp[1], 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = T.a;
  g.lineWidth = 4;
  g.stroke();
  rr(g, hp[0] - 60, hp[1] - 66, 120, 44, 10, T.ink);
  g.fillStyle = "#ffffff";
  font(g, 15, 650);
  g.textAlign = "center";
  g.fillText("On track", hp[0], hp[1] - 43);
  g.textAlign = "left";
  // A donut of where time goes.
  rr(g, 1174, 306, 376, 400, 18, T.card, true);
  g.fillStyle = T.ink;
  font(g, 20, 720);
  g.fillText("Focus", 1202, 348);
  const parts = [0.42, 0.28, 0.18, 0.12];
  const cols = [T.a, T.b, T.c, "#e3e6ef"];
  let a0 = -Math.PI / 2;
  parts.forEach((v, i) => {
    g.beginPath();
    g.arc(1362, 500, 92, a0 + 0.03, a0 + v * Math.PI * 2 - 0.03);
    g.strokeStyle = cols[i];
    g.lineWidth = 34;
    g.lineCap = "round";
    g.stroke();
    a0 += v * Math.PI * 2;
  });
  g.lineCap = "butt";
  ["Design", "Build", "Review"].forEach((l, i) => {
    const y = 630 + i * 0;
    const x = 1202 + i * 116;
    g.fillStyle = cols[i];
    g.beginPath();
    g.arc(x + 6, y, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = T.sub;
    font(g, 14, 550);
    g.fillText(l, x + 18, y + 1);
  });
  // A table of recent work with avatars and status pills.
  rr(g, 310, 730, 1240, 250, 18, T.card, true);
  g.fillStyle = T.ink;
  font(g, 20, 720);
  g.fillText("Recent work", 338, 772);
  const rows = ["Brand refresh", "Launch plan", "Client onboarding"];
  const status = [
    ["Done", "#1f9d6b"],
    ["In review", T.a],
    ["In progress", "#d98b1c"],
  ];
  rows.forEach((row, i) => {
    const y = 820 + i * 52;
    g.fillStyle = T.line;
    g.fillRect(338, y - 26, 1184, 1);
    avatar(g, 360, y, 16, [T.a, T.b, T.c][i], "ABC".charAt(i));
    g.fillStyle = T.ink;
    font(g, 16, 600);
    g.fillText(row, 390, y + 1);
    g.fillStyle = T.sub;
    font(g, 15, 500);
    g.fillText(["Today", "Yesterday", "This week"][i], 760, y + 1);
    const bw = 380;
    rr(g, 920, y - 7, bw, 14, 7, T.line);
    rr(g, 920, y - 7, bw * (0.95 - i * 0.28 - r() * 0.05), 14, 7, [T.a, T.b, T.c][i]);
    const [txt, col] = status[i];
    font(g, 14, 650);
    const tw = g.measureText(txt).width + 28;
    rr(g, 1500 - tw, y - 15, tw, 30, 15, mixHex(col, "#ffffff", 0.85));
    g.fillStyle = col;
    g.fillText(txt, 1514 - tw, y + 1);
  });
  cache.set(key, c);
  return c;
}

export function mobileUI(p: Palette, name: string, seed = 0): HTMLCanvasElement {
  const key = `m|${p.primary}|${p.secondary}|${p.accent}|${name}|${seed % 3}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 780;
  const H = 1690;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const T = theme(p);
  g.fillStyle = T.bg;
  g.fillRect(0, 0, W, H);
  // A header in the brand's gradient with the status bar and the island's space.
  const head = g.createLinearGradient(0, 0, W, 520);
  head.addColorStop(0, T.a);
  head.addColorStop(1, mixHex(T.a, T.b, 0.65));
  g.fillStyle = head;
  g.beginPath();
  g.roundRect(0, 0, W, 560, [0, 0, 56, 56]);
  g.fill();
  g.fillStyle = "#ffffff";
  font(g, 30, 650);
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText("9:41", 70, 64);
  rr(g, W / 2 - 120, 34, 240, 66, 33, "#000000");
  rr(g, W - 140, 52, 56, 26, 8, "rgba(255,255,255,0.95)");
  for (let i = 0; i < 4; i++) rr(g, W - 230 + i * 14, 72 - i * 6, 9, 10 + i * 6, 2, "#ffffff");
  avatar(g, 100, 190, 44, "#ffffff", (name || "A").charAt(0).toUpperCase());
  g.fillStyle = "rgba(255,255,255,0.8)";
  font(g, 28, 500);
  g.fillText("Welcome back", 168, 172);
  g.fillStyle = "#ffffff";
  font(g, 40, 760);
  g.fillText(name.slice(0, 14) || "Your app", 168, 214);
  rr(g, W - 140, 150, 84, 84, 26, "rgba(255,255,255,0.18)");
  glyph(g, 3, W - 98, 192, 30, "#ffffff");
  // A chart card overlapping the header.
  rr(g, 48, 300, W - 96, 420, 40, T.card, true);
  g.fillStyle = T.sub;
  font(g, 26, 550);
  g.fillText("This week", 92, 360);
  g.fillStyle = T.ink;
  font(g, 56, 780);
  g.fillText("On track", 92, 428);
  const bars = series(seed * 11 + 3, 7, 0.3, 0.95);
  bars.forEach((v, i) => {
    const bw = 58;
    const x = 96 + i * 86;
    const bh = v * 190;
    rr(g, x, 670 - 190, bw, 190, 18, mixHex(T.a, "#ffffff", 0.9));
    rr(g, x, 670 - bh, bw, bh, 18, i === 4 ? T.a : mixHex(T.a, "#ffffff", 0.45));
    g.fillStyle = T.faint;
    font(g, 20, 600);
    g.textAlign = "center";
    g.fillText("MTWTFSS".charAt(i), x + bw / 2, 700);
    g.textAlign = "left";
  });
  // Quick actions.
  ["Plan", "Share", "Track", "More"].forEach((l, i) => {
    const x = 70 + i * 170;
    rr(g, x, 760, 130, 130, 36, T.card, true);
    glyph(g, i, x + 65, 812, 36, [T.a, T.b, T.c, T.sub][i]);
    g.fillStyle = T.sub;
    font(g, 22, 600);
    g.textAlign = "center";
    g.fillText(l, x + 65, 864);
    g.textAlign = "left";
  });
  // A list.
  g.fillStyle = T.ink;
  font(g, 34, 740);
  g.fillText("Up next", 56, 960);
  ["Team sync", "Design review", "Launch prep"].forEach((l, i) => {
    const y = 1000 + i * 150;
    rr(g, 48, y, W - 96, 128, 32, T.card, true);
    rr(g, 76, y + 28, 72, 72, 22, mixHex([T.a, T.b, T.c][i], "#ffffff", 0.85));
    glyph(g, i + 3, 112, y + 64, 30, [T.a, T.b, T.c][i]);
    g.fillStyle = T.ink;
    font(g, 30, 650);
    g.fillText(l, 174, y + 52);
    g.fillStyle = T.sub;
    font(g, 24, 500);
    g.fillText(["Today", "Tomorrow", "Friday"][i], 174, y + 90);
    rr(g, W - 160, y + 44, 70, 40, 20, mixHex([T.a, T.b, T.c][i], "#ffffff", 0.85));
  });
  // The tab bar and home indicator.
  g.fillStyle = "#ffffff";
  g.fillRect(0, H - 170, W, 170);
  g.fillStyle = T.line;
  g.fillRect(0, H - 170, W, 2);
  [0, 1, 2, 3].forEach((i) => glyph(g, i, 110 + i * 186, H - 112, 36, i === 0 ? T.a : T.faint));
  rr(g, W / 2 - 110, H - 34, 220, 10, 5, T.ink);
  cache.set(key, c);
  return c;
}
