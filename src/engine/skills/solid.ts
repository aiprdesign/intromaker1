/**
 * Fading a character as one solid piece. A character is many overlapping shapes (head over neck,
 * arms over the body, outlines over fills); drawn see-through one by one, every overlap and edge
 * would show while it fades in or out. So while the canvas is partly transparent, the character
 * is drawn at full strength on its own layer, which is then laid down with the fade: it fades
 * like a flat cut-out.
 */
let layer: HTMLCanvasElement | OffscreenCanvas | null = null;

function scratch(w: number, h: number) {
  if (!layer) layer = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  if (layer.width !== w || layer.height !== h) {
    layer.width = w;
    layer.height = h;
  }
  return layer;
}

export function solid<T>(ctx: CanvasRenderingContext2D, draw: (c: CanvasRenderingContext2D) => T): T {
  const a = ctx.globalAlpha;
  if (a >= 0.995 || a <= 0.001) return draw(ctx);
  const { width, height } = ctx.canvas;
  const cv = scratch(width, height);
  const lc = cv.getContext("2d") as CanvasRenderingContext2D;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, width, height);
  lc.setTransform(ctx.getTransform());
  lc.globalAlpha = 1;
  lc.globalCompositeOperation = "source-over";
  lc.filter = "none";
  const out = draw(lc);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a;
  ctx.drawImage(cv, 0, 0);
  ctx.restore();
  return out;
}
