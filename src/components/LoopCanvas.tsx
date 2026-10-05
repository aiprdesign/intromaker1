"use client";

import { useEffect, useRef, useState } from "react";
import { ensureFonts } from "@/engine/fonts";
import { mediaState } from "@/engine/media";
import { aspectSize, renderFrame, renderScene, totalDuration } from "@/engine/renderer";
import type { Scene, VideoPlan } from "@/engine/types";
import { withPlaceholders } from "@/engine/placeholders";
import { useVisible } from "./useVisible";

type Props =
  | { plan: VideoPlan; scene?: undefined; long?: number; fps?: number; className?: string }
  | {
      scene: Scene;
      plan: Pick<VideoPlan, "palette" | "font" | "seed"> & Partial<Pick<VideoPlan, "style" | "look" | "bpm" | "brand" | "product" | "title" | "trailerStyle" | "shapes" | "shapeSet" | "watermark">>;
      long?: number;
      fps?: number;
      className?: string;
    };

/** Autoplaying, looping render of a plan or a single scene. Pauses offscreen and in hidden tabs. */
export default function LoopCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const visible = useVisible(ref);
  const long = props.long ?? 640;
  const fps = props.fps ?? 30;
  const propsRef = useRef(props);
  propsRef.current = props;

  // Poster frame so offscreen cards are never blank.
  useEffect(() => {
    const canvas = ref.current!;
    ensureFonts().then(() => {
      const p = propsRef.current;
      const ctx = canvas.getContext("2d")!;
      if (p.scene) {
        // Slides that show your media get stand-in pictures until there are real ones.
        const { scene, plan } = withPlaceholders(p.scene, p.plan);
        renderScene(ctx, scene, plan, Math.min(2.2, p.scene.duration * 0.5), canvas.width, canvas.height, 0, { grain: false });
      }
      else renderFrame(ctx, p.plan, 3, canvas.width, canvas.height, { grain: false });
    });
  }, []);

  // Only animate on screen, in a visible tab, and when the viewer hasn't asked for reduced motion
  // (then the poster frame stays): offscreen previews cost no CPU or GPU.
  const [shown, setShown] = useState(true);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const onVis = () => setShown(!document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setStill(mq.matches);
    onMotion();
    mq.addEventListener("change", onMotion);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMotion);
    };
  }, []);

  useEffect(() => {
    if (!visible || !shown || still) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = 0;
    let t0 = performance.now();
    let alive = true;
    ensureFonts().then(() => {
      if (!alive) return;
      t0 = performance.now();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        // Previews pause while a video exports so every GPU/CPU cycle goes to the export.
        if (mediaState.exporting || now - last < 1000 / fps - 2) return;
        last = now;
        const p = propsRef.current;
        const time = (now - t0) / 1000;
        if (p.scene) {
          const { w, h } = { w: canvas.width, h: canvas.height };
          const { scene, plan } = withPlaceholders(p.scene, p.plan);
          renderScene(ctx, scene, plan, time % p.scene.duration, w, h, 0, { grain: false });
        } else {
          const d = totalDuration(p.plan);
          renderFrame(ctx, p.plan, time % d, canvas.width, canvas.height, { grain: false });
        }
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [visible, shown, still, fps]);

  const aspect = props.scene ? "16:9" : props.plan.aspect;
  const { w, h } = aspectSize(aspect, long);
  return <canvas ref={ref} width={w} height={h} className={props.className} />;
}
