const pool = new Map<string, HTMLCanvasElement>();

/** Reusable offscreen canvas keyed by purpose; resized on demand and cleared. */
export function scratch(name: string, w: number, h: number, clear = true) {
  let c = pool.get(name);
  if (!c) {
    c = document.createElement("canvas");
    pool.set(name, c);
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  } else if (clear) {
    c.getContext("2d")!.clearRect(0, 0, w, h);
  }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return { canvas: c, ctx };
}
