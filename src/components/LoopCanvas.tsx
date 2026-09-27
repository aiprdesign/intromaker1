"use client";

import { useEffect, useRef } from "react";
import { ensureFonts } from "@/engine/fonts";
import { aspectSize, renderFrame, renderScene, totalDuration } from "@/engine/renderer";
import type { Scene, VideoPlan } from "@/engine/types";
import { useVisible } from "./useVisible";

type Props =
  | { plan: VideoPlan; scene?: undefined; long?: number; fps?: number; className?: string }
  | {
      scene: Scene;
      plan: Pick<VideoPlan, "palette" | "font" | "seed">;
      long?: number;
      fps?: number;
      className?: string;
    };

/** Autoplaying, looping render of a plan or a single scene. Pauses offscreen. */
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
      if (p.scene) renderScene(ctx, p.scene, p.plan, Math.min(2.2, p.scene.duration * 0.5), canvas.width, canvas.height, 0, { grain: false });
      else renderFrame(ctx, p.plan, 3, canvas.width, canvas.height, { grain: false });
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
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
        if (now - last < 1000 / fps - 2) return;
        last = now;
        const p = propsRef.current;
        const time = (now - t0) / 1000;
        if (p.scene) {
          const { w, h } = { w: canvas.width, h: canvas.height };
          renderScene(ctx, p.scene, p.plan, time % p.scene.duration, w, h, 0, { grain: false });
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
  }, [visible, fps]);

  const aspect = props.scene ? "16:9" : props.plan.aspect;
  const { w, h } = aspectSize(aspect, long);
  return <canvas ref={ref} width={w} height={h} className={props.className} />;
}
