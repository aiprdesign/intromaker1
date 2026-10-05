"use client";

import { useEffect, useRef, useState } from "react";
import { ensureFonts } from "@/engine/fonts";
import { mediaState } from "@/engine/media";
import { aspectSize, renderFrame, renderScene, totalDuration } from "@/engine/renderer";
import type { Scene, VideoPlan } from "@/engine/types";
import { withPlaceholders } from "@/engine/placeholders";
import { schedulePreview } from "./previewScheduler";
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

/**
 * Autoplaying, looping render of a plan or a single scene. Pauses offscreen and in hidden tabs, and
 * shares one frame budget with the page's other previews (see previewScheduler).
 */
export default function LoopCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const visible = useVisible(ref);
  const long = props.long ?? 640;
  const fps = props.fps ?? 30;
  const propsRef = useRef(props);
  propsRef.current = props;

  // Poster frame, drawn once the card comes near the screen (through the shared preview loop,
  // so a page of cards never draws them all in one go).
  const posted = useRef(false);
  const paint = (time: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const p = propsRef.current;
    const ctx = canvas.getContext("2d")!;
    if (p.scene) {
      // Slides that show your media get stand-in pictures until there are real ones.
      const { scene, plan } = withPlaceholders(p.scene, p.plan);
      renderScene(ctx, scene, plan, time < 0 ? Math.min(2.2, p.scene.duration * 0.5) : time % p.scene.duration, canvas.width, canvas.height, 0, { grain: false });
    } else renderFrame(ctx, p.plan, time < 0 ? 3 : time % totalDuration(p.plan), canvas.width, canvas.height, { grain: false });
  };
  const paintRef = useRef(paint);
  paintRef.current = paint;
  useEffect(() => {
    if (!visible || posted.current) return;
    let stop = () => {};
    let alive = true;
    ensureFonts().then(() => {
      if (!alive) return;
      stop = schedulePreview(() => {
        posted.current = true;
        paintRef.current(-1);
      }, { once: true });
    });
    return () => {
      alive = false;
      stop();
    };
  }, [visible]);

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
    let stop = () => {};
    let alive = true;
    ensureFonts().then(() => {
      if (!alive) return;
      const t0 = performance.now();
      stop = schedulePreview(
        (now) => {
          // Previews pause while a video exports so every GPU/CPU cycle goes to the export.
          if (mediaState.exporting) return;
          posted.current = true;
          paintRef.current((now - t0) / 1000);
        },
        { interval: 1000 / fps },
      );
    });
    return () => {
      alive = false;
      stop();
    };
  }, [visible, shown, still, fps]);

  const aspect = props.scene ? "16:9" : props.plan.aspect;
  const { w, h } = aspectSize(aspect, long);
  return <canvas ref={ref} width={w} height={h} className={props.className} />;
}
