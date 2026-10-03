"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getImage, onMediaReady } from "@/engine/media";
import { zoomLensSource } from "@/engine/skills/product";
import type { Brand, Scene } from "@/engine/types";

type Zoom = NonNullable<Scene["zoom"]>;
const THUMB = 280;
const DEFAULT_POWER = 2.7;

/**
 * Detail Zoom's lens, adjustable: the product cut-out the lens magnifies, with a numbered circle
 * for each stop (drag to choose what it shows), the lens size and the zoom strength. A circle's
 * size is the area the lens enlarges at that strength (a bigger lens or less zoom shows more).
 */
export default function ZoomLensEditor({ scene, brand, onChange }: { scene: Scene; brand?: Brand; onChange: (zoom: Scene["zoom"]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<{ i: number; pts: [number, number][] } | null>(null);
  const zoom: Zoom = scene.zoom ?? {};
  const size = zoom.size ?? 1;
  const power = zoom.power ?? DEFAULT_POWER;

  // Re-draw once the photo (and its cut-out) is ready.
  useEffect(() => {
    const src = scene.media?.kind === "image" ? scene.media.src : brand?.images?.[0];
    getImage(src);
    return onMediaReady(() => setTick((n) => n + 1));
  }, [scene.media, brand]);

  const source = zoomLensSource(scene, brand);
  const stops = drag?.pts ?? source?.stops ?? [];
  // Where the thumbnail sits, and the magnified area's radius in thumbnail pixels: the lens radius
  // in a 1920×1080 frame over the zoom, mapped back onto the photo as the slide places it.
  const geom = source
    ? (() => {
        const c = source.canvas;
        const k = Math.min(THUMB / c.width, (THUMB * 0.75) / c.height);
        const tw = c.width * k;
        const th = c.height * k;
        const frameScale = Math.min((1920 * 0.44) / c.width, (1080 * 0.6) / c.height);
        const lensPx = 1080 * 0.14 * size;
        return { k, tw, th, r: Math.max(8, (lensPx / power / frameScale) * k) };
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
    g.drawImage(source.canvas, 0, 0, geom.tw, geom.th);
    stops.forEach(([x, y], i) => {
      const cx = x * geom.tw;
      const cy = y * geom.th;
      g.save();
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.strokeStyle = drag?.i === i ? "#7c5cff" : "#ffffff";
      g.lineWidth = 2;
      g.shadowColor = "rgba(0,0,0,0.5)";
      g.shadowBlur = 4;
      g.beginPath();
      g.arc(cx, cy, geom.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = "#7c5cff";
      g.beginPath();
      g.arc(cx, cy, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = "700 11px Inter, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(i + 1), cx, cy + 0.5);
      g.restore();
    });
  }, [source, geom, stops, drag]);
  useEffect(draw, [draw]);

  const at = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as [number, number];
  };
  const onDown = (e: React.PointerEvent) => {
    if (!geom || !stops.length) return;
    const [x, y] = at(e);
    // The nearest stop follows the pointer.
    let best = 0;
    let bd = Infinity;
    stops.forEach(([sx, sy], i) => {
      const d = Math.hypot((sx - x) * geom.tw, (sy - y) * geom.th);
      if (d < bd) (bd = d), (best = i);
    });
    const pts = stops.map((p) => [...p] as [number, number]);
    pts[best] = [x, y];
    setDrag({ i: best, pts });
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const pts = drag.pts.map((p) => [...p] as [number, number]);
    pts[drag.i] = at(e);
    setDrag({ ...drag, pts });
  };
  const onUp = () => {
    if (!drag) return;
    onChange({ ...zoom, points: drag.pts.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) });
    setDrag(null);
  };
  const labels = (scene.items ?? []).map((x) => x.split(/\s+[—–]\s+/)[0]);
  const custom = !!(zoom.points || zoom.size !== undefined || zoom.power !== undefined);

  return (
    <div className="fld zoom-editor">
      <span className="fld-cap">Zoom lens</span>
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
            aria-label="Drag a numbered circle to choose what the lens shows at that stop"
          />
          <p className="zoom-hint">
            Drag a circle to choose what the lens shows.{" "}
            {labels.length > 0 && <>Stops: {stops.map((_, i) => `${i + 1} ${labels[i] ?? "detail"}`).join(" · ")}.</>}
          </p>
        </>
      ) : (
        <p className="zoom-hint">The product photo is loading…</p>
      )}
      <div className="zoom-sliders">
        <label>
          <span>Lens size</span>
          <input type="range" min={0.6} max={1.6} step={0.05} value={size} onChange={(e) => onChange({ ...zoom, size: Number(e.target.value) })} aria-label="Lens size" />
          <output>{Math.round(size * 100)}%</output>
        </label>
        <label>
          <span>Zoom</span>
          <input type="range" min={1.5} max={4.5} step={0.1} value={power} onChange={(e) => onChange({ ...zoom, power: Number(e.target.value) })} aria-label="Zoom strength" />
          <output>{power.toFixed(1)}×</output>
        </label>
      </div>
      {custom && (
        <button type="button" className="link-btn" onClick={() => onChange(undefined)}>
          Reset to automatic
        </button>
      )}
    </div>
  );
}
