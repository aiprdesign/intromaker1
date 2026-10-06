"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onMediaReady } from "@/engine/media";
import { aspectSize } from "@/engine/renderer";
import { tourAreas } from "@/engine/skills/saas";
import type { Scene, VideoPlan } from "@/engine/types";

type Area = [number, number, number, number];
const THUMB = 280;
const HANDLE = 12;
const MIN = 0.03;

/**
 * UI Zoom Tour's highlight areas, adjustable: the screenshot with a numbered box for each stop.
 * Drag a box to move it, drag its corner to resize it; the camera zooms to each box in turn and
 * the ring and dimming hug it. The part of the screenshot outside this video's frame is shaded.
 */
export default function TourAreaEditor({ scene, index, plan, onChange }: { scene: Scene; index: number; plan: VideoPlan; onChange: (tour: Scene["tour"]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<{ i: number; mode: "move" | "size"; from: [number, number]; start: Area[]; areas: Area[] } | null>(null);

  // Re-draw once the screenshot is ready.
  useEffect(() => onMediaReady(() => setTick((n) => n + 1)), []);

  const { w, h } = aspectSize(plan.aspect, 1920);
  const source = tourAreas(scene, plan.brand, w, h, (plan.seed + index * 7919) >>> 0);
  const areas = drag?.areas ?? source?.areas ?? [];
  const geom = source
    ? (() => {
        const iw = source.image.naturalWidth || source.image.width;
        const ih = source.image.naturalHeight || source.image.height;
        const k = Math.min(THUMB / iw, (THUMB * 0.8) / ih);
        return { tw: iw * k, th: ih * k };
      })()
    : null;

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !source || !geom) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(geom.tw * dpr);
    cv.height = Math.round(geom.th * dpr);
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, geom.tw, geom.th);
    g.drawImage(source.image, 0, 0, geom.tw, geom.th);
    // Shade what this video's frame doesn't show.
    const [vx, vy, vw, vh] = source.visible;
    g.save();
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.beginPath();
    g.rect(0, 0, geom.tw, geom.th);
    g.rect(vx * geom.tw, vy * geom.th, vw * geom.tw, vh * geom.th);
    g.fill("evenodd");
    g.restore();
    areas.forEach(([x, y, aw, ah], i) => {
      const bx = x * geom.tw;
      const by = y * geom.th;
      const bw = aw * geom.tw;
      const bh = ah * geom.th;
      const on = drag?.i === i;
      g.save();
      g.fillStyle = "rgba(124,92,255,0.14)";
      g.strokeStyle = on ? "#7c5cff" : "#ffffff";
      g.lineWidth = 2;
      g.shadowColor = "rgba(0,0,0,0.5)";
      g.shadowBlur = 4;
      g.beginPath();
      g.roundRect(bx, by, bw, bh, 4);
      g.fill();
      g.stroke();
      g.shadowBlur = 0;
      // The stop's number, and the resize handle, inside the box's corners (so neither is cut at the edge).
      g.fillStyle = "#7c5cff";
      g.beginPath();
      g.arc(bx + 11, by + 11, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = "700 11px Inter, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(i + 1), bx + 11, by + 11.5);
      g.fillStyle = "#ffffff";
      g.strokeStyle = "#7c5cff";
      g.lineWidth = 2;
      g.beginPath();
      g.rect(bx + bw - 12, by + bh - 12, 9, 9);
      g.fill();
      g.stroke();
      g.restore();
    });
  }, [source, geom, areas, drag]);
  useEffect(draw, [draw]);

  const at = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as [number, number];
  };
  const onDown = (e: React.PointerEvent) => {
    if (!geom || !areas.length) return;
    const [x, y] = at(e);
    const px = x * geom.tw;
    const py = y * geom.th;
    const start = areas.map((a) => [...a] as Area);
    // A corner handle resizes; inside a box (the smallest, if they overlap) moves it; elsewhere
    // the nearest box jumps there.
    const corner = start.findIndex(([ax, ay, aw, ah]) => Math.hypot((ax + aw) * geom.tw - 7 - px, (ay + ah) * geom.th - 7 - py) <= HANDLE);
    let i = corner;
    let mode: "move" | "size" = "size";
    if (i < 0) {
      mode = "move";
      const inside = start
        .map((a, k) => ({ k, a }))
        .filter(({ a }) => x >= a[0] && x <= a[0] + a[2] && y >= a[1] && y <= a[1] + a[3])
        .sort((p, q) => p.a[2] * p.a[3] - q.a[2] * q.a[3]);
      if (inside.length) i = inside[0].k;
      else {
        let bd = Infinity;
        start.forEach(([ax, ay, aw, ah], k) => {
          const d = Math.hypot((ax + aw / 2 - x) * geom.tw, (ay + ah / 2 - y) * geom.th);
          if (d < bd) (bd = d), (i = k);
        });
        const [, , aw, ah] = start[i];
        start[i] = [Math.min(1 - aw, Math.max(0, x - aw / 2)), Math.min(1 - ah, Math.max(0, y - ah / 2)), aw, ah];
      }
    }
    setDrag({ i, mode, from: [x, y], start, areas: start });
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const [x, y] = at(e);
    const [ax, ay, aw, ah] = drag.start[drag.i];
    const dx = x - drag.from[0];
    const dy = y - drag.from[1];
    const next = drag.start.map((a) => [...a] as Area);
    next[drag.i] =
      drag.mode === "move"
        ? [Math.min(1 - aw, Math.max(0, ax + dx)), Math.min(1 - ah, Math.max(0, ay + dy)), aw, ah]
        : [ax, ay, Math.min(1 - ax, Math.max(MIN, aw + dx)), Math.min(1 - ay, Math.max(MIN, ah + dy))];
    setDrag({ ...drag, areas: next });
  };
  const onUp = () => {
    if (!drag) return;
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    onChange({ areas: drag.areas.map((a) => a.map(r3) as Area), src: source?.key });
    setDrag(null);
  };
  const labels = [scene.items?.[0] ?? scene.subtext, scene.items?.[1]];
  const custom = !!scene.tour?.areas?.length;

  return (
    <div className="fld zoom-editor">
      <span className="fld-cap">Highlight areas</span>
      {source && geom ? (
        <>
          <canvas
            ref={canvasRef}
            className="zoom-canvas"
            style={{ width: geom.tw, height: geom.th }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="img"
            aria-label="Drag a numbered box to choose what the tour zooms to and highlights at that stop; drag its corner to resize it"
          />
          <p className="zoom-hint">
            Drag a box to move it, or its corner to resize it. Stops: {areas.map((_, i) => `${i + 1} ${labels[i] ?? "highlight"}`).join(" · ")}.
          </p>
        </>
      ) : (
        <p className="zoom-hint">{scene.media?.kind === "video" ? "Highlight areas can be set on a screenshot." : "The screenshot is loading…"}</p>
      )}
      {custom && (
        <button type="button" className="link-btn" onClick={() => onChange(undefined)}>
          Reset to automatic
        </button>
      )}
    </div>
  );
}
