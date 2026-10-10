/**
 * Logo tracing: a raster logo (PNG, JPG, GIF, or an SVG drawn to pixels) turned into flat-colour
 * vector shapes, so it can be drawn at any size with clean edges and revealed stroke by stroke.
 *
 * 1. The logo is cleaned (white box keyed out, ink adapted to the stage, see media.ts) and drawn
 *    at a working size of about 480px on its long side.
 * 2. Its opaque pixels are grouped into up to five flat colours (k-means, close colours merged,
 *    slivers from anti-aliased edges folded into their nearest neighbour).
 * 3. Colours are stacked largest first, each layer's shape including the layers above it, so no
 *    hairline gaps open between neighbouring colours.
 * 4. Each layer's outline is followed along the pixel edges, simplified (Ramer–Douglas–Peucker),
 *    and drawn as smooth curves, with sharp corners kept where two long straight runs meet.
 *
 * Results are cached per logo and stage.
 */
import { getImage, logoAt } from "./media";

/** A flat colour: its filled shape and each of its outlines (with its length, for drawing on). */
export type TracedLayer = { color: string; path: Path2D; loops: { path: Path2D; len: number }[] };
export type TracedLogo = { w: number; h: number; layers: TracedLayer[] };

const WORK = 480;
const cache = new Map<string, TracedLogo | null>();

/** The logo at `src` as vector layers, or null while it loads (or if it can't be read). */
export function tracedLogo(src: string | undefined, lightStage: boolean): TracedLogo | null {
  if (!src || typeof document === "undefined" || typeof Path2D === "undefined") return null;
  const img = getImage(src);
  if (!img?.naturalWidth) return null;
  const key = `${img.src}|${lightStage ? "l" : "d"}`;
  if (cache.has(key)) return cache.get(key)!;
  let out: TracedLogo | null = null;
  try {
    out = trace(logoAt(img, lightStage, WORK * 2));
  } catch {
    out = null;
  }
  cache.set(key, out);
  return out;
}

function trace(src: HTMLCanvasElement | HTMLImageElement): TracedLogo | null {
  const sw = "naturalWidth" in src ? src.naturalWidth : src.width;
  const sh = "naturalHeight" in src ? src.naturalHeight : src.height;
  if (!sw || !sh) return null;
  const k = WORK / Math.max(sw, sh);
  const iw = Math.max(1, Math.round(sw * k));
  const ih = Math.max(1, Math.round(sh * k));
  // (A clear pixel of margin round the logo, so its outlines close at the edges.)
  const W = iw + 2;
  const H = ih + 2;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 1, 1, iw, ih);
  const px = g.getImageData(0, 0, W, H).data;
  const n = W * H;

  // The opaque pixels and their colours.
  const solid = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] >= 128) (solid[i] = 1), count++;
  if (count < 16) return null;

  const centres = clusters(px, solid, count);
  // Each opaque pixel goes to its nearest colour.
  const label = new Int8Array(n).fill(-1);
  const area = new Array(centres.length).fill(0);
  for (let i = 0; i < n; i++) {
    if (!solid[i]) continue;
    const j = nearest(centres, px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    label[i] = j;
    area[j]++;
  }
  // Largest first; each layer's shape is its own pixels and those of the layers drawn over it.
  const order = centres.map((_, j) => j).sort((a, b) => area[b] - area[a]);
  const rank = new Int8Array(centres.length);
  order.forEach((j, r) => (rank[j] = r));
  const layers: TracedLayer[] = [];
  const mask = new Uint8Array(n);
  for (let r = 0; r < order.length; r++) {
    for (let i = 0; i < n; i++) mask[i] = label[i] >= 0 && rank[label[i]] >= r ? 1 : 0;
    const loops = outlines(mask, W, H);
    if (!loops.length) continue;
    const path = new Path2D();
    const parts: TracedLayer["loops"] = [];
    for (const loop of loops) {
      const one = new Path2D();
      const len = addLoop(one, simplify(loop, 0.75));
      if (!len) continue;
      path.addPath(one);
      parts.push({ path: one, len });
    }
    const [cr, cg, cb] = centres[order[r]];
    if (parts.length) layers.push({ color: `rgb(${cr | 0},${cg | 0},${cb | 0})`, path, loops: parts });
  }
  return layers.length ? { w: W, h: H, layers } : null;
}

type RGB = [number, number, number];
const dist2 = (a: RGB, r: number, g: number, b: number) => (a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2;
function nearest(cs: RGB[], r: number, g: number, b: number) {
  let best = 0;
  let bd = Infinity;
  cs.forEach((c, j) => {
    const d = dist2(c, r, g, b);
    if (d < bd) (bd = d), (best = j);
  });
  return best;
}

/** Up to five flat colours for the logo: k-means from far-apart seeds, then tidied. */
function clusters(px: Uint8ClampedArray, solid: Uint8Array, count: number): RGB[] {
  // A sample of the opaque pixels (enough for stable colours, quick to iterate).
  const step = Math.max(1, Math.floor(count / 6000));
  const sample: RGB[] = [];
  for (let i = 0, seen = 0; i < solid.length; i++) {
    if (!solid[i]) continue;
    if (seen++ % step === 0) sample.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
  }
  const K = 5;
  const cs: RGB[] = [sample[0].slice() as RGB];
  while (cs.length < K) {
    let far = sample[0];
    let fd = -1;
    for (const s of sample) {
      const d = Math.min(...cs.map((c) => dist2(c, s[0], s[1], s[2])));
      if (d > fd) (fd = d), (far = s);
    }
    if (fd < 30 * 30) break;
    cs.push(far.slice() as RGB);
  }
  const sizes = new Array(cs.length).fill(0);
  for (let it = 0; it < 10; it++) {
    const sum = cs.map(() => [0, 0, 0]);
    sizes.fill(0);
    for (const s of sample) {
      const j = nearest(cs, s[0], s[1], s[2]);
      sum[j][0] += s[0];
      sum[j][1] += s[1];
      sum[j][2] += s[2];
      sizes[j]++;
    }
    cs.forEach((c, j) => {
      if (sizes[j]) (c[0] = sum[j][0] / sizes[j]), (c[1] = sum[j][1] / sizes[j]), (c[2] = sum[j][2] / sizes[j]);
    });
  }
  // Close colours become one; slivers (under 1.5% of the logo, the blends along anti-aliased
  // edges) are dropped, their pixels going to the nearest colour that stays.
  const keep: { c: RGB; n: number }[] = [];
  cs.map((c, j) => ({ c, n: sizes[j] }))
    .sort((a, b) => b.n - a.n)
    .forEach((x) => {
      const near = keep.find((k) => dist2(k.c, x.c[0], x.c[1], x.c[2]) < 34 * 34);
      if (near) near.n += x.n;
      else if (x.n >= sample.length * 0.015 || !keep.length) keep.push(x);
    });
  return keep.map((k) => k.c);
}

/**
 * The outlines of a mask, followed along pixel edges: one closed loop per boundary (holes come
 * out wound the other way, so an even-odd fill punches them out).
 */
function outlines(mask: Uint8Array, W: number, H: number): number[][] {
  const V = W + 1;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  // Directed edges with the shape on their right; a vertex has at most two leaving it.
  const ex: number[] = [];
  const ey: number[] = [];
  const dx: number[] = [];
  const dy: number[] = [];
  const out1 = new Int32Array(V * (H + 1)).fill(-1);
  const out2 = new Int32Array(V * (H + 1)).fill(-1);
  const add = (x: number, y: number, ddx: number, ddy: number) => {
    const id = ex.length;
    ex.push(x);
    ey.push(y);
    dx.push(ddx);
    dy.push(ddy);
    const v = y * V + x;
    if (out1[v] < 0) out1[v] = id;
    else out2[v] = id;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) add(x, y, 1, 0);
      if (!at(x + 1, y)) add(x + 1, y, 0, 1);
      if (!at(x, y + 1)) add(x + 1, y + 1, -1, 0);
      if (!at(x - 1, y)) add(x, y + 1, 0, -1);
    }
  const used = new Uint8Array(ex.length);
  const loops: number[][] = [];
  for (let s = 0; s < ex.length; s++) {
    if (used[s]) continue;
    const loop: number[] = [];
    let e = s;
    while (e >= 0 && !used[e]) {
      used[e] = 1;
      loop.push(ex[e], ey[e]);
      const v = (ey[e] + dy[e]) * V + (ex[e] + dx[e]);
      const a = out1[v];
      const b = out2[v];
      // Where two shapes touch at a corner, turn right: the shapes stay separate.
      if (a >= 0 && b >= 0 && !used[a] && !used[b]) e = dx[e] * dy[a] - dy[e] * dx[a] > 0 ? a : b;
      else e = a >= 0 && !used[a] ? a : b >= 0 && !used[b] ? b : -1;
    }
    if (loop.length >= 8) loops.push(loop);
  }
  return loops;
}

/** A closed loop with its straight runs collapsed and its stair-steps smoothed (RDP). */
function simplify(loop: number[], eps: number): number[] {
  const m = loop.length / 2;
  // Edge midpoints: a staircase becomes a diagonal before simplifying.
  const pts: number[] = [];
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    pts.push((loop[i * 2] + loop[j * 2]) / 2, (loop[i * 2 + 1] + loop[j * 2 + 1]) / 2);
  }
  // Split at the point farthest from the first so the loop simplifies as two open runs.
  const q = pts.length / 2;
  let far = 0;
  let fd = -1;
  for (let i = 0; i < q; i++) {
    const d = (pts[i * 2] - pts[0]) ** 2 + (pts[i * 2 + 1] - pts[1]) ** 2;
    if (d > fd) (fd = d), (far = i);
  }
  const run = (a: number, b: number): number[] => {
    const keep = new Uint8Array(q + 1);
    keep[0] = keep[b - a] = 1;
    const idx = (i: number) => (a + i) % q;
    const stack: [number, number][] = [[0, b - a]];
    while (stack.length) {
      const [i0, i1] = stack.pop()!;
      const x0 = pts[idx(i0) * 2], y0 = pts[idx(i0) * 2 + 1];
      const x1 = pts[idx(i1) * 2], y1 = pts[idx(i1) * 2 + 1];
      const L = Math.hypot(x1 - x0, y1 - y0) || 1;
      let md = -1;
      let mi = -1;
      for (let i = i0 + 1; i < i1; i++) {
        const x = pts[idx(i) * 2], y = pts[idx(i) * 2 + 1];
        const d = Math.abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / L;
        if (d > md) (md = d), (mi = i);
      }
      if (md > eps) {
        keep[mi] = 1;
        stack.push([i0, mi], [mi, i1]);
      }
    }
    const res: number[] = [];
    for (let i = 0; i < b - a; i++) if (keep[i]) res.push(pts[idx(i) * 2], pts[idx(i) * 2 + 1]);
    return res;
  };
  return [...run(0, far), ...run(far, q)];
}

/**
 * Add a simplified loop to the path as smooth curves through its edge midpoints; where two long
 * straight runs meet at a real angle the corner stays sharp. Returns the loop's length.
 */
function addLoop(path: Path2D, p: number[]): number {
  const m = p.length / 2;
  if (m < 3) return 0;
  const X = (i: number) => p[((i + m) % m) * 2];
  const Y = (i: number) => p[((i + m) % m) * 2 + 1];
  const mid = (i: number): [number, number] => [(X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2];
  const [sx, sy] = mid(0);
  path.moveTo(sx, sy);
  let len = 0;
  for (let i = 1; i <= m; i++) {
    const ax = X(i) - X(i - 1), ay = Y(i) - Y(i - 1);
    const bx = X(i + 1) - X(i), by = Y(i + 1) - Y(i);
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    len += la;
    const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb || 1))));
    const [nx, ny] = mid(i);
    if (la > 5 && lb > 5 && turn > 0.75) {
      path.lineTo(X(i), Y(i));
      path.lineTo(nx, ny);
    } else path.quadraticCurveTo(X(i), Y(i), nx, ny);
  }
  path.closePath();
  return len;
}

/**
 * Draw a traced logo fitted into a box, revealed in two moves: its outlines draw on (`line`,
 * 0→1), then its colours fill in (`fill`, 0→1).
 */
export function drawTraced(ctx: CanvasRenderingContext2D, tr: TracedLogo, x: number, y: number, w: number, h: number, line = 1, fill = 1) {
  const s = Math.min(w / tr.w, h / tr.h);
  ctx.save();
  ctx.translate(x + (w - tr.w * s) / 2, y + (h - tr.h * s) / 2);
  ctx.scale(s, s);
  if (fill > 0) {
    ctx.globalAlpha *= fill;
    for (const l of tr.layers) {
      ctx.fillStyle = l.color;
      ctx.fill(l.path, "evenodd");
    }
    ctx.globalAlpha /= fill;
  }
  if (line > 0 && fill < 1) {
    ctx.globalAlpha *= 1 - fill;
    // (About 2.4 pixels on screen, whatever the size.)
    ctx.lineWidth = 2.4 / s;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const l of tr.layers) {
      ctx.strokeStyle = l.color;
      for (const o of l.loops) {
        ctx.setLineDash([o.len * line, o.len + 1]);
        ctx.stroke(o.path);
      }
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}
