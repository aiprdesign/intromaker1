/**
 * Real 3D for slides, on WebGL through OGL: modelled objects with thickness and rounded, bevelled
 * edges, a perspective camera that moves through the scene, a sun with soft shadow maps, sky and
 * ground light, a studio environment for reflections on metal and glass, and textures (a website
 * or app screenshot on a screen). Each frame is rendered on the shared offscreen WebGL canvas (see
 * gl.ts) and drawn straight into the slide, so preview, seek and export match.
 *
 * A world is built once per kind of scene and cached; skills only move its parts and the camera.
 * Without WebGL, `world()` returns null and skills fall back to 2D.
 */
import { Camera, Geometry, Mesh, Program, Shadow, Texture, Transform, type OGLRenderingContext, type Renderer } from "ogl";
import { glRenderer } from "./gl";
import { hexToRgb } from "./math";

type Num3 = [number, number, number];

/* ───────────────────────── Geometry ───────────────────────── */

function geo(gl: OGLRenderingContext, pos: number[], nor: number[], uv: number[], idx: number[]) {
  return new Geometry(gl, {
    position: { size: 3, data: new Float32Array(pos) },
    normal: { size: 3, data: new Float32Array(nor) },
    uv: { size: 2, data: new Float32Array(uv) },
    index: { data: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) },
  });
}

/** A rounded rectangle's outline (centred, half sizes a × b, corner radius r), with outward normals. */
function outline(a: number, b: number, r: number, seg = 10) {
  r = Math.min(r, a, b);
  const pts: { x: number; y: number; nx: number; ny: number }[] = [];
  const corners: [number, number, number][] = [
    [a - r, b - r, 0],
    [-a + r, b - r, Math.PI / 2],
    [-a + r, -b + r, Math.PI],
    [a - r, -b + r, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const ang = a0 + (i / seg) * (Math.PI / 2);
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      pts.push({ x: cx + nx * r, y: cy + ny * r, nx, ny });
    }
  }
  return pts;
}

/**
 * A slab: a rounded rectangle `w`×`h`, `d` thick, with rounded (quarter-round) edges of radius `bevel`.
 * Its front faces +z. Returns the front face, the back face and the body (edges and sides) as
 * separate geometries, so each can take its own material (a screen's glass, a lid's metal).
 */
export function slab(gl: OGLRenderingContext, w: number, h: number, d: number, r: number, bevel: number) {
  const a = w / 2;
  const b = h / 2;
  bevel = Math.min(bevel, d / 2, r);
  const O = outline(a, b, r);
  const n = O.length;
  const face = (z: number, sign: number) => {
    const pos = [0, 0, z];
    const nor = [0, 0, sign];
    const uv = [0.5, 0.5];
    for (const p of O) {
      const x = p.x - p.nx * bevel;
      const y = p.y - p.ny * bevel;
      pos.push(x, y, z);
      nor.push(0, 0, sign);
      uv.push(x / w + 0.5, y / h + 0.5);
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = ((i + 1) % n) + 1;
      if (sign > 0) idx.push(0, i + 1, j);
      else idx.push(0, j, i + 1);
    }
    return geo(gl, pos, nor, uv, idx);
  };
  // The body: a quarter-round from the front face to the side, the side, a quarter-round to the back.
  const steps = 5;
  const prof: { off: number; z: number; nz: number; ns: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * (Math.PI / 2);
    prof.push({ off: bevel * (1 - Math.sin(th)), z: d / 2 - bevel * (1 - Math.cos(th)), nz: Math.cos(th), ns: Math.sin(th) });
  }
  for (let i = steps; i >= 0; i--) {
    const th = (i / steps) * (Math.PI / 2);
    prof.push({ off: bevel * (1 - Math.sin(th)), z: -d / 2 + bevel * (1 - Math.cos(th)), nz: -Math.cos(th), ns: Math.sin(th) });
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  prof.forEach((q, k) => {
    for (const p of O) {
      pos.push(p.x - p.nx * q.off, p.y - p.ny * q.off, q.z);
      const l = Math.hypot(p.nx * q.ns, p.ny * q.ns, q.nz) || 1;
      nor.push((p.nx * q.ns) / l, (p.ny * q.ns) / l, q.nz / l);
      uv.push(0, k / (prof.length - 1));
    }
  });
  const idx: number[] = [];
  for (let k = 0; k < prof.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      const p0 = k * n + i;
      const p1 = k * n + i2;
      const q0 = (k + 1) * n + i;
      const q1 = (k + 1) * n + i2;
      idx.push(p0, q0, p1, p1, q0, q1);
    }
  }
  return { front: face(d / 2, 1), back: face(-d / 2, -1), body: geo(gl, pos, nor, uv, idx) };
}

/**
 * A photo studio's seamless backdrop (a cyclorama): a floor that curves up into a back wall, `width`
 * wide, the floor running from z = +depth to the curve, the wall rising to `height`.
 */
export function cove(gl: OGLRenderingContext, width: number, depth: number, radius: number, height: number) {
  const prof: { y: number; z: number; ny: number; nz: number }[] = [];
  prof.push({ y: 0, z: depth, ny: 1, nz: 0 });
  prof.push({ y: 0, z: 0, ny: 1, nz: 0 });
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    prof.push({ y: radius - Math.cos(a) * radius, z: -Math.sin(a) * radius, ny: Math.cos(a), nz: Math.sin(a) });
  }
  prof.push({ y: height, z: -radius, ny: 0, nz: 1 });
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  prof.forEach((q, i) => {
    for (const x of [-width / 2, width / 2]) {
      pos.push(x, q.y, q.z);
      nor.push(0, q.ny, q.nz);
      uv.push(x > 0 ? 1 : 0, i / (prof.length - 1));
    }
  });
  for (let i = 0; i < prof.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return geo(gl, pos, nor, uv, idx);
}

/** A flat rectangle in the XY plane (facing +z), for screens and decals. */
export function quad(gl: OGLRenderingContext, w: number, h: number) {
  const a = w / 2;
  const b = h / 2;
  return geo(gl, [-a, -b, 0, a, -b, 0, a, b, 0, -a, b, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 0, 1, 0, 1, 1, 0, 1], [0, 1, 2, 0, 2, 3]);
}

/** A cylinder along Y (radius, height), capped, smooth sides. */
export function cylinder(gl: OGLRenderingContext, rTop: number, rBot: number, h: number, seg = 32) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const slope = (rBot - rTop) / h;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const l = Math.hypot(1, slope);
    pos.push(c * rTop, h / 2, s * rTop, c * rBot, -h / 2, s * rBot);
    nor.push(c / l, slope / l, s / l, c / l, slope / l, s / l);
    uv.push(i / seg, 1, i / seg, 0);
  }
  for (let i = 0; i < seg; i++) {
    const p = i * 2;
    idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
  }
  for (const [y, r, sign] of [
    [h / 2, rTop, 1],
    [-h / 2, rBot, -1],
  ] as const) {
    const c0 = pos.length / 3;
    pos.push(0, y, 0);
    nor.push(0, sign, 0);
    uv.push(0.5, 0.5);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      nor.push(0, sign, 0);
      uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < seg; i++) {
      if (sign > 0) idx.push(c0, c0 + i + 2, c0 + i + 1);
      else idx.push(c0, c0 + i + 1, c0 + i + 2);
    }
  }
  return geo(gl, pos, nor, uv, idx);
}

/**
 * The front of a sphere (radius `r`) within a half-width `w` of its centre, facing +z, with UVs
 * laid flat over the square: a face, printed on a head (see the people in homes3d.ts).
 */
export function sphereCap(gl: OGLRenderingContext, r: number, w: number, seg = 18) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= seg; j++)
    for (let i = 0; i <= seg; i++) {
      const x = -w + (2 * w * i) / seg;
      const y = -w + (2 * w * j) / seg;
      const z = Math.sqrt(Math.max(0, r * r - x * x - y * y));
      pos.push(x, y, z);
      nor.push(x / r, y / r, z / r);
      uv.push(i / seg, j / seg);
    }
  for (let j = 0; j < seg; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const c = a + seg + 1;
      idx.push(a, a + 1, c + 1, a, c + 1, c);
    }
  return geo(gl, pos, nor, uv, idx);
}

/** A UV sphere (or a squashed one, for bushes and tree crowns). */
export function sphere(gl: OGLRenderingContext, r: number, seg = 24, rings = 16) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings;
    const ph = v * Math.PI;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const th = u * Math.PI * 2;
      const x = Math.cos(th) * Math.sin(ph);
      const y = Math.cos(ph);
      const z = Math.sin(th) * Math.sin(ph);
      pos.push(x * r, y * r, z * r);
      nor.push(x, y, z);
      uv.push(u, 1 - v);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return geo(gl, pos, nor, uv, idx);
}

/** A box with flat faces (w × h × d, centred), UVs per face. */
/** Turns each triangle to face along its vertices' normals (so a built mesh is never culled inside out). */
function faceOut(pos: number[], nor: number[], idx: number[]) {
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m = [0, 1, 2].map((k) => nor[a + k] + nor[b + k] + nor[c + k]);
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
}

/**
 * A turned shape (a mug, a pot, a vase): the profile [radius, height][] spun round the y axis.
 * The profile's surface lies on its right as it's walked (up the outside, down the inside), and
 * corners sharper than ~50° stay crisp while gentle curves shade smoothly.
 */
export function lathe(gl: OGLRenderingContext, profile: [number, number][], seg = 40) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const segN = profile.slice(1).map(([r, y], i) => {
    const dr = r - profile[i][0];
    const dy = y - profile[i][1];
    const l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l] as [number, number];
  });
  // Rows: one per profile point, two where a corner is sharp (one normal for each side).
  const rows: { r: number; y: number; n: [number, number] }[] = [];
  profile.forEach(([r, y], i) => {
    const a = segN[i - 1];
    const b = segN[i];
    if (!a || !b) return rows.push({ r, y, n: (a ?? b)! });
    if (a[0] * b[0] + a[1] * b[1] < 0.64) {
      rows.push({ r, y, n: a }, { r, y, n: b });
    } else {
      const l = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1;
      rows.push({ r, y, n: [(a[0] + b[0]) / l, (a[1] + b[1]) / l] });
    }
  });
  rows.forEach((row, j) => {
    for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * Math.PI * 2;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      pos.push(c * row.r, row.y, sn * row.r);
      nor.push(c * row.n[0], row.n[1], sn * row.n[0]);
      uv.push(i / seg, j / (rows.length - 1));
    }
  });
  const W = seg + 1;
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < seg; i++) {
      const p = j * W + i;
      idx.push(p, p + W, p + 1, p + 1, p + W, p + W + 1);
    }
  faceOut(pos, nor, idx);
  return geo(gl, pos, nor, uv, idx);
}

/**
 * A patch of a (slightly tapered) cylinder's side, radius `rBot` at `y0` to `rTop` at `y1`, from
 * angle `a0` to `a1` (as in lathe: x = cos, z = sin). Its UVs read left to right seen from
 * outside, so a picture wraps on like a label or a print.
 */
export function band(gl: OGLRenderingContext, rBot: number, rTop: number, y0: number, y1: number, a0: number, a1: number, seg = 24) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const l = Math.hypot(y1 - y0, rBot - rTop) || 1;
  const ny = (rBot - rTop) / l;
  const nr = (y1 - y0) / l;
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    for (const [r, y, v] of [[rBot, y0, 0], [rTop, y1, 1]] as const) {
      pos.push(c * r, y, sn * r);
      nor.push(c * nr, ny, sn * nr);
      uv.push(1 - i / seg, v);
    }
  }
  for (let i = 0; i < seg; i++) {
    const p = i * 2;
    idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
  }
  faceOut(pos, nor, idx);
  return geo(gl, pos, nor, uv, idx);
}

/**
 * A torus in the xy plane (ring radius `R`, tube radius `r`), or the part of one swept through
 * `arc` radians from -arc/2 to +arc/2 about +x: a mug's handle.
 */
export function torus(gl: OGLRenderingContext, R: number, r: number, arc = Math.PI * 2, seg = 32, tube = 14) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = -arc / 2 + (i / seg) * arc;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    for (let j = 0; j <= tube; j++) {
      const v = (j / tube) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      pos.push((R + r * cv) * cu, (R + r * cv) * su, r * sv);
      nor.push(cv * cu, cv * su, sv);
      uv.push(i / seg, j / tube);
    }
  }
  const T = tube + 1;
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < tube; j++) {
      const p = i * T + j;
      idx.push(p, p + T, p + 1, p + 1, p + T, p + T + 1);
    }
  faceOut(pos, nor, idx);
  return geo(gl, pos, nor, uv, idx);
}

/**
 * A leaf blade, both sides: `len` long up +y, `width` across at its widest, its tip arching over
 * by `curl` towards -z and folded along the midrib by `fold`, so it catches the light like a leaf.
 */
export function leaf(gl: OGLRenderingContext, len: number, width: number, curl = 0.3, fold = 0.25, segL = 14, segW = 6) {
  const P = (t: number, s: number): Num3 => {
    const half = (width / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.75);
    const x = s * half;
    return [x, t * len * (1 - 0.25 * curl * t), -curl * len * t * t + fold * Math.abs(x)];
  };
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= segL; i++)
      for (let j = 0; j <= segW; j++) {
        const t = i / segL;
        const sw = (j / segW) * 2 - 1;
        const p = P(t, sw);
        const e = 1e-3;
        const dt = P(Math.min(1, t + e), sw).map((v, k) => v - P(Math.max(0, t - e), sw)[k]);
        const ds = P(t, Math.min(1, sw + e)).map((v, k) => v - P(t, Math.max(-1, sw - e))[k]);
        let n: Num3 = [ds[1] * dt[2] - ds[2] * dt[1], ds[2] * dt[0] - ds[0] * dt[2], ds[0] * dt[1] - ds[1] * dt[0]];
        const l = Math.hypot(...n) || 1;
        n = [(n[0] / l) * side, (n[1] / l) * side, (n[2] / l) * side];
        // (The faces sit a hair apart so they never fight.)
        pos.push(p[0] + n[0] * 0.002, p[1] + n[1] * 0.002, p[2] + n[2] * 0.002);
        nor.push(...n);
        uv.push(j / segW, t);
      }
    const W = segW + 1;
    for (let i = 0; i < segL; i++)
      for (let j = 0; j < segW; j++) {
        const p = base + i * W + j;
        idx.push(p, p + W, p + 1, p + 1, p + W, p + W + 1);
      }
  }
  faceOut(pos, nor, idx);
  return geo(gl, pos, nor, uv, idx);
}

export function box(gl: OGLRenderingContext, w: number, h: number, d: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const faces: [Num3, Num3, Num3][] = [
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  ];
  const half: Num3 = [w / 2, h / 2, d / 2];
  for (const [nrm, uA, vA] of faces) {
    const base = pos.length / 3;
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const p = [0, 1, 2].map((k) => (nrm[k] + uA[k] * su + vA[k] * sv) * half[k]);
      pos.push(p[0], p[1], p[2]);
      nor.push(...nrm);
      uv.push((su + 1) / 2, (sv + 1) / 2);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geo(gl, pos, nor, uv, idx);
}

/** A gable roof prism: a triangle (width × rise) extruded along `depth`, with an overhang lip. */
export function gable(gl: OGLRenderingContext, width: number, rise: number, depth: number) {
  const a = width / 2;
  const z = depth / 2;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const slopeL = Math.hypot(a, rise);
  const nl: Num3 = [-rise / slopeL, a / slopeL, 0];
  const nr: Num3 = [rise / slopeL, a / slopeL, 0];
  const quadF = (p: number[][], n: Num3) => {
    const b = pos.length / 3;
    p.forEach((q, i) => {
      pos.push(q[0], q[1], q[2]);
      nor.push(...n);
      uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0);
    });
    // Wind the face so it faces outwards (along its normal), or it's culled as a back face.
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] >= 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  };
  quadF([[-a, 0, z], [-a, 0, -z], [0, rise, -z], [0, rise, z]], nl);
  quadF([[a, 0, -z], [a, 0, z], [0, rise, z], [0, rise, -z]], nr);
  for (const s of [1, -1]) {
    const b = pos.length / 3;
    pos.push(-a, 0, s * z, a, 0, s * z, 0, rise, s * z);
    nor.push(0, 0, s, 0, 0, s, 0, 0, s);
    uv.push(0, 0, 1, 0, 0.5, 1);
    if (s > 0) idx.push(b, b + 1, b + 2);
    else idx.push(b, b + 2, b + 1);
  }
  return geo(gl, pos, nor, uv, idx);
}

/* ───────────────────────── Materials ───────────────────────── */

const VERT = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 uShadowView;
uniform mat4 uShadowProj;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
varying vec4 vS;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = mat3(modelMatrix) * normal;
  vUv = uv;
  vS = uShadowProj * uShadowView * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
varying vec4 vS;
uniform vec3 cameraPosition;
uniform vec3 uColor;
uniform float uMetal;
uniform float uGloss;
uniform float uAlpha;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uSky;
uniform vec3 uGnd;
uniform float uExposure;
uniform vec3 uEmit;
uniform float uClip;
uniform vec4 uFog;
uniform float uFlat;
uniform float uSheen;
uniform vec3 uFill;
uniform float uStudio;
uniform vec3 uRim;
uniform sampler2D tShadow;
uniform float uShadowSoft;
#ifdef MAP
uniform sampler2D tMap;
uniform vec4 uUv;
uniform float uGlow;
uniform vec3 uRound;
#endif
#ifdef FLOOR
uniform vec4 uBlob[6];
uniform float uFloorAlpha;
#endif
#if defined(GRASS) || defined(LEAF)
uniform vec3 uColor2;
#endif
#ifdef DECAL
uniform sampler2D tMap;
#endif
uniform float uAO;
#ifdef BACKDROP
uniform vec3 uGlowA;
uniform vec3 uGlowB;
#endif

float unpackDepth(vec4 c) { return dot(c, 1.0 / vec4(1.0, 255.0, 65025.0, 16581375.0)); }

float shadowAt() {
  vec3 p = vS.xyz / vS.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float s = 0.0;
  float tx = uShadowSoft / 2048.0;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    float d = unpackDepth(texture2D(tShadow, p.xy + vec2(float(i), float(j)) * tx));
    s += p.z - 0.0022 > d ? 0.0 : 1.0;
  }
  return s / 25.0;
}

// A photo studio for reflections: a sky-to-floor gradient, a big softbox overhead-left and a strip light.
vec3 env(vec3 R) {
  vec3 c = mix(uGnd * 0.6, uSky, smoothstep(-0.25, 0.55, R.y));
  c += vec3(1.0) * exp(-pow((R.x + 0.35) * 2.6, 2.0)) * smoothstep(0.15, 0.85, R.y) * 1.3;
  c += vec3(1.0) * exp(-pow((R.x - 0.75) * 7.0, 2.0)) * smoothstep(-0.1, 0.25, R.y) * smoothstep(0.75, 0.25, R.y) * 0.7;
  // Studio sets: a large overhead softbox and a thin strip light behind, for crisp product highlights.
  if (uStudio > 0.0) {
    vec2 box = abs(vec2(R.x, R.z) / max(R.y, 0.05)) - vec2(0.55, 0.35);
    c += vec3(1.0) * (1.0 - smoothstep(0.0, 0.08, max(box.x, box.y))) * step(0.0, R.y) * 0.9 * uStudio;
    c += vec3(1.0) * exp(-pow((R.x + 0.05) * 18.0, 2.0)) * smoothstep(0.0, 0.2, R.y) * smoothstep(0.0, -0.4, R.z) * 0.6 * uStudio;
  }
  return c;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

void main() {
  if (vW.y > uClip) discard;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 base = uColor;
  float gloss = uGloss;
  float metal = uMetal;
#ifdef KEYBOARD
  // A keyboard (dark keys in a grid) and a trackpad on the laptop's deck.
  vec2 k = vUv;
  if (k.y > 0.47 && k.y < 0.93 && k.x > 0.07 && k.x < 0.93) {
    vec2 g = vec2((k.x - 0.07) / 0.86 * 14.0, (k.y - 0.47) / 0.46 * 6.0);
    vec2 f = fract(g);
    float key = step(0.1, f.x) * step(f.x, 0.9) * step(0.12, f.y) * step(f.y, 0.88);
    if (g.y < 1.0 && g.x > 4.0 && g.x < 10.0) key = step(0.12, f.y) * step(f.y, 0.88) * step(4.1, g.x) * step(g.x, 9.9);
    base = mix(base, vec3(0.09, 0.095, 0.11), key);
    gloss = mix(gloss, 0.25, key);
    metal = mix(metal, 0.0, key);
  }
  vec2 tp = abs(k - vec2(0.5, 0.22)) - vec2(0.16, 0.13);
  float pad = 1.0 - smoothstep(-0.004, 0.004, length(max(tp, 0.0)) - 0.02);
  base = mix(base, base * 0.93, pad);
#endif
#ifdef SIDING
  // Lap siding: a fine shadow line under each board.
  base *= 1.0 - 0.12 * smoothstep(0.82, 1.0, fract(vW.y * 4.6));
#endif
#ifdef SHINGLE
  base *= 1.0 - 0.14 * smoothstep(0.75, 1.0, fract(vW.y * 5.5)) - 0.05 * step(0.5, fract(floor(vW.y * 5.5) * 0.5 + vW.z * 1.4));
#endif
#ifdef BACKDROP
  // Soft pools of the brand's colours on the backdrop, like coloured studio lights.
  float ga = exp(-(pow(vW.x + 5.5, 2.0) + pow(vW.y - 3.5, 2.0) * 1.4 + pow(vW.z + 8.0, 2.0) * 0.2) / 26.0);
  float gb = exp(-(pow(vW.x - 6.0, 2.0) + pow(vW.y - 2.0, 2.0) * 1.4 + pow(vW.z + 8.0, 2.0) * 0.2) / 22.0);
  base = mix(base, uGlowA, ga * 0.55);
  base = mix(base, uGlowB, gb * 0.45);
#endif
#ifdef GRASS
  float nz = hash(floor(vW.xz * 6.0)) * 0.5 + hash(floor(vW.xz * 1.3)) * 0.5;
  base = mix(uColor, uColor2, nz);
  // Mowing stripes, light and dark, as on a kept lawn.
  base *= 0.94 + 0.08 * step(0.5, fract(vW.x / 3.2));
#endif
#ifdef STONE
  // Stone blocks in staggered courses with mortar lines and a little variation per block.
  vec2 sp = vec2(vW.x + vW.z, vW.y) * vec2(2.2, 3.6);
  float row = floor(sp.y);
  sp.x += mod(row, 2.0) * 0.5;
  vec2 cell = floor(sp);
  vec2 fr = fract(sp);
  float mortar = step(0.06, fr.x) * step(fr.x, 0.94) * step(0.08, fr.y) * step(fr.y, 0.92);
  base *= mix(0.72, 0.9 + hash(cell) * 0.22, mortar);
#endif
#ifdef LEAF
  // A leaf (u across the blade, v from base to tip): a paler midrib, fine side veins sweeping up
  // to the edge, a lighter tip and a slightly darker rim.
  float side = abs(vUv.x - 0.5) * 2.0;
  base = mix(uColor, uColor2, smoothstep(0.1, 1.0, vUv.y) * 0.7);
  base = mix(base, base * 1.32 + 0.035, 1.0 - smoothstep(0.02, 0.09, side));
  float vein = fract(vUv.y * 9.0 - side * 1.6);
  base *= 1.0 - 0.09 * smoothstep(0.86, 1.0, vein) * smoothstep(0.1, 0.25, side) * (1.0 - smoothstep(0.85, 1.0, side));
  base *= 1.0 - 0.16 * smoothstep(0.8, 1.0, side);
#endif
#ifdef CERAMIC
  // Glazed ceramic: tiny speckles in the glaze, and the glaze thinning towards the foot.
  base *= 1.0 - 0.07 * step(0.988, hash(floor(vW.xz * 140.0 + vW.y * 97.0)));
  base *= mix(0.86, 1.0, smoothstep(0.0, 0.14, vUv.y));
#endif
#ifdef COFFEE
  // A coffee's surface, seen from above: dark in the middle, a ring of crema with a soft swirl.
  vec2 cq = vUv - 0.5;
  float cr = length(cq) * 2.0;
  float swirl = 0.5 + 0.5 * sin(atan(cq.y, cq.x) * 3.0 + cr * 10.0);
  base = mix(vec3(0.2, 0.11, 0.06), vec3(0.72, 0.5, 0.33), clamp(smoothstep(0.45, 0.95, cr) * 0.85 + swirl * 0.3 * smoothstep(0.15, 0.7, cr), 0.0, 1.0));
#endif
#ifdef FELT
  // Felt: a fine fibrous grain and a stitched border just inside the edge.
  base *= 0.93 + 0.07 * hash(floor(vW.xz * 260.0));
  float edgeD = min(min(vUv.x, 1.0 - vUv.x) * 1.5, min(vUv.y, 1.0 - vUv.y));
  float stitch = smoothstep(0.016, 0.02, edgeD) * (1.0 - smoothstep(0.026, 0.03, edgeD)) * step(0.45, fract((vUv.x + vUv.y) * 90.0));
  base = mix(base, base * 1.45 + 0.05, stitch * 0.8);
#endif
  float sh = shadowAt();
  // Soft contact darkening where surfaces meet the ground (a cheap ambient occlusion).
  if (uAO > 0.0) base *= mix(1.0 - uAO * (1.0 - smoothstep(0.5, 0.9, N.y)), 1.0, smoothstep(0.0, 0.9, vW.y));
  float ndl = max(dot(N, uSun), 0.0);
  vec3 H = normalize(uSun + V);
  float spec = pow(max(dot(N, H), 0.0), mix(6.0, 220.0, gloss)) * mix(0.05, 1.2, gloss);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 hemi = mix(uGnd, uSky, N.y * 0.5 + 0.5);
  vec3 diff = base * (hemi * 0.6 + uSunCol * ndl * sh * 0.85);
  // A soft wrap-around fill from the side opposite the key light (studio three-point lighting).
  float fw = max(dot(N, normalize(vec3(-uSun.x, 0.3, uSun.z))) * 0.5 + 0.5, 0.0);
  diff += base * uFill * fw * fw;
  vec3 F0 = mix(vec3(0.04), base, metal);
  vec3 F = F0 + (1.0 - F0) * fres;
  vec3 col = diff * (1.0 - metal * 0.85) + env(R) * F * mix(0.25, 1.0, gloss) + uSunCol * spec * sh * mix(vec3(1.0), base, metal * 0.5);
#ifdef LEAF
  // Light through the leaf: lit from behind, it glows a brighter green.
  col += mix(uColor2, vec3(0.75, 1.0, 0.45), 0.35) * uSunCol * pow(max(dot(-N, uSun), 0.0), 1.5) * 0.45 * sh;
#endif
  // Flat (2D) look: the base colour in two tones, light and shade, no reflections or haze.
  // (Three tones: sunlit, turned away from the sun, and in a cast shadow; tops a touch lighter.)
  // Faces take a tone by where they point (towards the sun, across it, away from it), cast
  // shadows a step darker and tops a touch lighter, so walls, floors and ceilings separate.
  if (uFlat > 0.5) {
    float band = ndl > 0.55 ? 1.0 : ndl > 0.18 ? 0.9 : 0.8;
    float inShade = ndl > 0.18 && sh < 0.5 ? 0.82 : 1.0;
    col = base * band * inShade * (N.y > 0.7 ? 1.05 : N.y < -0.7 ? 0.9 : 1.0) * mix(0.97, 1.03, hemi.b);
  }
  float alpha = uAlpha;
#ifdef MAP
  // A screen: the picture glows (cover-fitted, scrolling), behind glass with a corner radius.
  vec2 sUv = vUv * uUv.xy + uUv.zw;
  // (Textures load flipped, so the image's top is t = 1; the window runs down from its top.)
  vec3 img = texture2D(tMap, vec2(sUv.x, 1.0 - ((1.0 - vUv.y) * uUv.y + uUv.w))).rgb;
  vec2 q = abs(vUv - 0.5) * vec2(uRound.y, 1.0) - (vec2(uRound.y, 1.0) * 0.5 - uRound.x);
  float mask = 1.0 - smoothstep(-0.002, 0.002, length(max(q, 0.0)) - uRound.x);
  vec3 dark = vec3(0.02, 0.022, 0.03);
  col = mix(dark, img, uGlow) + env(R) * (0.015 + 0.5 * fres) * 0.6 + uSunCol * spec * 0.25;
  // A soft light sweep across the glass.
  float band = vUv.x * 0.8 + vUv.y * 0.6 - uSheen;
  col += vec3(1.0) * (exp(-band * band * 260.0) * 0.16 + exp(-band * band * 30.0) * 0.05) * step(-1.0, uSheen);
  // A touch of depth: the glass edge darkens very slightly.
  col *= 1.0 - 0.1 * pow(length((vUv - 0.5) * vec2(1.0, 1.2)) * 1.25, 3.0);
  alpha *= mask;
#endif
#ifdef DECAL
  // A printed decal (key legends, grilles): the picture's colour and alpha, lightly lit.
  vec4 dc = texture2D(tMap, vec2(vUv.x, vUv.y));
  col = dc.rgb * (0.75 + 0.25 * ndl);
  alpha *= dc.a;
#endif
#ifdef FLOOR
  // A shadow catcher: clear, darkened by the sun's shadow and soft contact shadows under objects.
  float ao = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 b = uBlob[i];
    if (b.z <= 0.0) continue;
    vec2 d = abs(vW.xz - b.xy) - b.zw;
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    ao = max(ao, exp(-max(dist, 0.0) * 5.0 / max(b.w, 0.35)) * 0.42);
  }
  float a = max((1.0 - sh) * 0.32, ao) * uFloorAlpha;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uAlpha);
  return;
#endif
  col += uEmit;
#if !defined(MAP) && !defined(FLOOR) && !defined(BACKDROP)
  // A coloured rim light catching the edges.
  col += uRim * pow(1.0 - max(dot(N, V), 0.0), 3.0) * (1.0 - uFlat);
#endif
  // Haze with distance (outdoor scenes), towards the horizon's colour.
  if (uFog.a > 0.0) col = mix(col, uFog.rgb, 1.0 - exp(-length(cameraPosition - vW) * uFog.a));
#ifdef MAP
  // Screens keep their own colours (crisp UI), lifted only a touch with the exposure.
  col *= mix(1.0, uExposure, 0.4);
#else
  col *= uExposure;
  col = col / (1.0 + max(col - 0.85, 0.0) * 1.2);
#endif
  gl_FragColor = vec4(col * alpha, alpha);
}`;

const DEPTH_VERT = /* glsl */ `
attribute vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DEPTH_FRAG = /* glsl */ `
precision highp float;
vec4 packRGBA(float v) { vec4 p = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * v); p -= p.yzww * vec2(1.0 / 255.0, 0.0).xxxy; return p; }
void main() { gl_FragColor = packRGBA(gl_FragCoord.z); }`;

export const rgb = (hex: string): Num3 => {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
};

export interface MatOpts {
  color: string | Num3;
  metal?: number;
  gloss?: number;
  alpha?: number;
  kind?: "lit" | "keyboard" | "screen" | "floor" | "grass" | "siding" | "shingle" | "backdrop" | "decal" | "stone" | "leaf" | "ceramic" | "coffee" | "felt";
  color2?: string;
  /** Light it gives off (a lit window), added to its shading. */
  emit?: string | Num3;
  transparent?: boolean;
  doubleSided?: boolean;
}

/* ───────────────────────── Worlds ───────────────────────── */

export interface World {
  gl: OGLRenderingContext;
  renderer: Renderer;
  scene: Transform;
  camera: Camera;
  light: Camera;
  shadow: Shadow;
  /** Shared lighting uniforms (sun direction and colour, sky and ground light, exposure). */
  env: Record<string, { value: unknown }>;
  /** A material for this world. */
  mat: (o: MatOpts) => Program;
  /** A mesh added to `parent` (the scene by default); it casts shadows unless told not to. */
  mesh: (g: Geometry, p: Program, parent?: Transform, cast?: boolean) => Mesh;
}

const worlds = new Map<string, unknown>();

/**
 * The world for `key`, built once by `build` (geometry, materials and meshes) and cached for the
 * renderer. Null without WebGL.
 */
export function world<T>(key: string, w: number, h: number, build: (W: World) => T): { W: World; parts: T } | null {
  const renderer = glRenderer(w, h);
  if (!renderer) return null;
  const gl = renderer.gl;
  const k = `${key}`;
  const hit = worlds.get(k) as { W: World; parts: T; gl: OGLRenderingContext } | undefined;
  if (hit && hit.gl === gl) return hit;
  const scene = new Transform();
  const camera = new Camera(gl, { fov: 30, near: 0.05, far: 200 });
  const light = new Camera(gl, { left: -6, right: 6, bottom: -6, top: 6, near: 0.1, far: 60 });
  const shadow = new Shadow(gl, { light, width: 2048 });
  const depthProgram = new Program(gl, { vertex: DEPTH_VERT, fragment: DEPTH_FRAG, cullFace: false });
  const env: Record<string, { value: unknown }> = {
    uSun: { value: [0.4, 0.8, 0.45] },
    uSunCol: { value: [1, 0.97, 0.92] },
    uSky: { value: [0.85, 0.88, 0.95] },
    uGnd: { value: [0.45, 0.42, 0.4] },
    uExposure: { value: 1 },
    uShadowView: { value: light.viewMatrix },
    uShadowProj: { value: light.projectionMatrix },
    tShadow: shadow.targetUniform as { value: unknown },
    uShadowSoft: { value: 2.4 },
    uFog: { value: [1, 1, 1, 0] },
    uFlat: { value: 0 },
    uSheen: { value: -9 },
    uFill: { value: [0, 0, 0] },
    uStudio: { value: 0 },
    uRim: { value: [0, 0, 0] },
    uAO: { value: 0 },
  };
  const blank = new Texture(gl, { image: new Uint8Array([0, 0, 0, 255]), width: 1, height: 1 });
  const mat = (o: MatOpts) => {
    const defines = o.kind === "keyboard" ? "#define KEYBOARD\n" : o.kind === "screen" ? "#define MAP\n" : o.kind === "floor" ? "#define FLOOR\n" : o.kind === "grass" ? "#define GRASS\n" : o.kind === "siding" ? "#define SIDING\n" : o.kind === "shingle" ? "#define SHINGLE\n" : o.kind === "backdrop" ? "#define BACKDROP\n" : o.kind === "decal" ? "#define DECAL\n" : o.kind === "stone" ? "#define STONE\n" : o.kind === "leaf" ? "#define LEAF\n" : o.kind === "ceramic" ? "#define CERAMIC\n" : o.kind === "coffee" ? "#define COFFEE\n" : o.kind === "felt" ? "#define FELT\n" : "";
    const uniforms: Record<string, { value: unknown }> = {
      ...env,
      uColor: { value: typeof o.color === "string" ? rgb(o.color) : o.color },
      uMetal: { value: o.metal ?? 0 },
      uGloss: { value: o.gloss ?? 0.4 },
      uAlpha: { value: o.alpha ?? 1 },
      uEmit: { value: o.emit ? (typeof o.emit === "string" ? rgb(o.emit) : o.emit) : [0, 0, 0] },
      uClip: { value: 1e4 },
    };
    if (o.kind === "screen") Object.assign(uniforms, { tMap: { value: blank }, uUv: { value: [1, 1, 0, 0] }, uGlow: { value: 1 }, uRound: { value: [0.04, 1.6, 0] } });
    if (o.kind === "floor") Object.assign(uniforms, { uBlob: { value: new Array(24).fill(0) }, uFloorAlpha: { value: 1 } });
    if (o.kind === "grass" || o.kind === "leaf") uniforms.uColor2 = { value: rgb(o.color2 ?? (o.kind === "leaf" ? "#8cc56a" : "#5a9e48")) };
    if (o.kind === "decal") uniforms.tMap = { value: blank };
    if (o.kind === "backdrop") Object.assign(uniforms, { uGlowA: { value: [1, 1, 1] }, uGlowB: { value: [1, 1, 1] } });
    const transparent = o.transparent ?? (o.kind === "floor" || o.kind === "screen" || o.kind === "decal" || (o.alpha ?? 1) < 1);
    return new Program(gl, { vertex: VERT, fragment: defines + FRAG, uniforms, transparent, depthWrite: o.kind !== "floor", cullFace: o.doubleSided ? false : gl.BACK });
  };
  const mesh = (g: Geometry, p: Program, parent: Transform = scene, cast = true) => {
    const m = new Mesh(gl, { geometry: g, program: p });
    m.setParent(parent);
    if (cast) {
      shadow.add({ mesh: m, receive: false, cast: true });
      (m as unknown as { depthProgram: Program }).depthProgram = depthProgram;
    }
    return m;
  };
  const W: World = { gl, renderer, scene, camera, light, shadow, env, mat, mesh };
  const parts = build(W);
  const out = { W, parts, gl };
  worlds.set(k, out);
  return out;
}

export interface View {
  /** Camera position and the point it looks at. */
  eye: Num3;
  target: Num3;
  fov?: number;
  /** Direction towards the sun (normalised for you), its colour, sky and ground light. */
  sun?: Num3;
  sunCol?: Num3;
  sky?: Num3;
  gnd?: Num3;
  exposure?: number;
  /** Contact darkening near the ground (0: none, ~0.3: soft). */
  ao?: number;
  /** A coloured rim light on edges (rgb, 0 for none). */
  rim?: Num3;
  /** A soft fill light opposite the key (rgb, 0 for none). */
  fill?: Num3;
  /** Studio reflections: an overhead softbox and a strip light in glossy surfaces (0 → 1). */
  studio?: number;
  /** Where a light sweep crosses the screens (0 → 1.4 across; unset: none). */
  sheen?: number;
  /** Draw it flat, as a 2D illustration: a straight-on (orthographic) camera and two-tone colour. */
  flat?: boolean;
  /** Flat colours on the 3D scene: the same perspective camera and models, shaded in a few flat tones (lit, shade, shadow) like a modern 3D illustration, with no reflections. */
  cel?: boolean;
  /** Distance haze: colour and density (0: none). */
  fog?: [number, number, number, number];
  /** Half-size of the shadow camera's view and where it centres. */
  shadowSize?: number;
  shadowAt?: Num3;
}

/**
 * Render the world with this view at `w`×`h` and return the WebGL canvas (draw it into the slide
 * straight away; the canvas is shared).
 */
export function render(W: World, v: View, w: number, h: number): HTMLCanvasElement {
  const { renderer, camera, light, env, scene, shadow } = W;
  // Supersampled (drawn larger, then scaled down into the slide) for clean edges.
  const ss = Math.max(1, Math.min(1.5, 2880 / Math.max(1, w)));
  const cw = Math.max(1, Math.round(w * ss));
  const ch = Math.max(1, Math.round(h * ss));
  if (renderer.gl.canvas.width !== cw || renderer.gl.canvas.height !== ch) renderer.setSize(cw, ch);
  if (v.flat) {
    const dist = Math.hypot(v.eye[0] - v.target[0], v.eye[1] - v.target[1], v.eye[2] - v.target[2]);
    const hh = dist * Math.tan((((v.fov ?? 30) / 2) * Math.PI) / 180);
    const hw = hh * (cw / ch);
    camera.orthographic({ left: -hw, right: hw, bottom: -hh, top: hh, near: 0.05, far: 400 });
  } else camera.perspective({ fov: v.fov ?? 30, aspect: cw / ch });
  camera.position.set(...v.eye);
  camera.lookAt(v.target);
  const s = v.sun ?? [0.45, 0.85, 0.5];
  const l = Math.hypot(...s) || 1;
  const sun: Num3 = [s[0] / l, s[1] / l, s[2] / l];
  env.uSun.value = sun;
  if (v.sunCol) env.uSunCol.value = v.sunCol;
  if (v.sky) env.uSky.value = v.sky;
  if (v.gnd) env.uGnd.value = v.gnd;
  env.uExposure.value = v.exposure ?? 1;
  // (A flat 2D view has no depth to haze; flat colours on a 3D scene keep the distance haze.)
  env.uFog.value = v.fog && !v.flat ? v.fog : [1, 1, 1, 0];
  env.uFlat.value = v.flat || v.cel ? 1 : 0;
  env.uSheen.value = v.sheen ?? -9;
  env.uRim.value = v.rim ?? [0, 0, 0];
  env.uAO.value = v.ao ?? 0;
  env.uFill.value = v.fill ?? [0, 0, 0];
  env.uStudio.value = v.flat || v.cel ? 0 : v.studio ?? 0;
  const size = v.shadowSize ?? 4;
  const c = v.shadowAt ?? v.target;
  light.orthographic({ left: -size, right: size, bottom: -size, top: size, near: 0.1, far: size * 8 });
  light.position.set(c[0] + sun[0] * size * 3, c[1] + sun[1] * size * 3, c[2] + sun[2] * size * 3);
  light.lookAt(c);
  scene.updateMatrixWorld();
  light.updateMatrixWorld();
  // The shadow map starts at the far plane (white), so empty space casts no shadow.
  renderer.gl.clearColor(1, 1, 1, 1);
  shadow.render({ scene });
  renderer.gl.clearColor(0, 0, 0, 0);
  renderer.render({ scene, camera, clear: true });
  return renderer.gl.canvas as HTMLCanvasElement;
}

/** Set a screen material's picture: cover-fit `aspect` (w/h of the screen), scrolled `scroll` (0 → 1) down a tall image. */
export function setScreen(p: Program, tex: Texture, imgW: number, imgH: number, aspect: number, scroll: number, glow: number, radius = 0.04, maxScreens = 2.5) {
  const ia = imgW && imgH ? imgW / imgH : aspect;
  // Width fills the screen; the visible window's height is a fraction of the image's.
  let sx = 1;
  let sy = ia / aspect;
  if (sy > 1) {
    sx = 1 / sy;
    sy = 1;
  }
  // A tall page scrolls down a few screens at most, at a readable pace.
  const oy = Math.min(1 - sy, sy * maxScreens) * Math.min(1, Math.max(0, scroll));
  p.uniforms.tMap.value = tex;
  p.uniforms.uUv.value = [sx, sy, (1 - sx) / 2, oy];
  p.uniforms.uGlow.value = glow;
  p.uniforms.uRound.value = [radius, aspect, 0];
}

/** Where a world point lands on the rendered view (pixels in a `w`×`h` frame), and whether it's in front of the camera. */
export function project(W: World, p: Num3, w: number, h: number) {
  const v = W.camera.viewMatrix as unknown as number[];
  const P = W.camera.projectionMatrix as unknown as number[];
  const mul = (m: number[], x: number, y: number, z: number, wv: number) => [
    m[0] * x + m[4] * y + m[8] * z + m[12] * wv,
    m[1] * x + m[5] * y + m[9] * z + m[13] * wv,
    m[2] * x + m[6] * y + m[10] * z + m[14] * wv,
    m[3] * x + m[7] * y + m[11] * z + m[15] * wv,
  ];
  const e = mul(v, p[0], p[1], p[2], 1);
  const c = mul(P, e[0], e[1], e[2], e[3]);
  return { x: (c[0] / c[3] * 0.5 + 0.5) * w, y: (1 - (c[1] / c[3] * 0.5 + 0.5)) * h, front: c[3] > 0 };
}

/** Show a crop of a picture on a screen material: `rect` is [left, top, width, height] as fractions of the image. */
export function setCrop(p: Program, tex: Texture, rect: [number, number, number, number], aspect: number, glow = 1, radius = 0.05) {
  p.uniforms.tMap.value = tex;
  p.uniforms.uUv.value = [rect[2], rect[3], rect[0], rect[1]];
  p.uniforms.uGlow.value = glow;
  p.uniforms.uRound.value = [radius, aspect, 0];
}
