"use client";

import { useEffect, useRef, useState } from "react";
import { ensureFonts } from "@/engine/fonts";
import { mediaState } from "@/engine/media";
import { aspectSize, renderFrame, renderScene, sceneAt, totalDuration } from "@/engine/renderer";
import { THREE_D_SKILLS } from "@/engine/skills";
import type { Scene, VideoPlan } from "@/engine/types";
import { withPlaceholders } from "@/engine/placeholders";
import { schedulePreview } from "./previewScheduler";
import { useVisible } from "./useVisible";

type Props =
  | { plan: VideoPlan; scene?: undefined; long?: number; fps?: number; className?: string; /** A still poster frame, no animation. */ still?: boolean }
  | {
      scene: Scene;
      plan: Pick<VideoPlan, "palette" | "font" | "seed"> & Partial<Pick<VideoPlan, "style" | "look" | "bpm" | "brand" | "product" | "title" | "trailerStyle" | "shapes" | "shapeSet" | "motifs" | "watermark">>;
      long?: number;
      fps?: number;
      className?: string;
      still?: boolean;
    };

/**
 * Autoplaying, looping render of a plan or a single scene. Pauses offscreen and in hidden tabs, and
 * shares one frame budget with the page's other previews (see previewScheduler). 3D slides (devices
 * and homes) aren't animated in previews: a 3D slide shows one still frame, and a video's preview
 * holds a still of each 3D slide while its other slides play, so the 3D engine never slows the
 * page's other previews.
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
  // Stills of a video's 3D slides, drawn once each (per plan and size).
  const stills = useRef<{ plan?: VideoPlan; frames: Map<number, HTMLCanvasElement> }>({ frames: new Map() });
  const paint = (time: number) => {
    const canvas = ref.current;
    if (!canvas) return;
    const p = propsRef.current;
    const ctx = canvas.getContext("2d")!;
    if (p.scene) {
      // Slides that show your media get stand-in pictures until there are real ones.
      const { scene, plan } = withPlaceholders(p.scene, p.plan);
      // (A 3D slide's one frame is taken once its content has settled.)
      const settled = THREE_D_SKILLS.has(p.scene.skill) ? p.scene.duration * 0.62 : Math.min(2.2, p.scene.duration * 0.5);
      renderScene(ctx, scene, plan, time < 0 ? settled : time % p.scene.duration, canvas.width, canvas.height, 0, { grain: false });
      return;
    }
    const t = time < 0 ? 3 : time % totalDuration(p.plan);
    const at = sceneAt(p.plan, t);
    if (at && THREE_D_SKILLS.has(at.scene.skill)) {
      const S = stills.current;
      if (S.plan !== p.plan) {
        S.plan = p.plan;
        S.frames = new Map();
      }
      let still = S.frames.get(at.index);
      if (!still || still.width !== canvas.width || still.height !== canvas.height) {
        still = document.createElement("canvas");
        still.width = canvas.width;
        still.height = canvas.height;
        renderFrame(still.getContext("2d")!, p.plan, at.start + at.scene.duration * 0.62, still.width, still.height, { grain: false });
        S.frames.set(at.index, still);
      }
      ctx.drawImage(still, 0, 0);
      return;
    }
    renderFrame(ctx, p.plan, t, canvas.width, canvas.height, { grain: false });
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

  // A single 3D slide stays on its poster frame.
  const flat3d = (!!props.scene && THREE_D_SKILLS.has(props.scene.skill)) || !!props.still;
  useEffect(() => {
    if (!visible || !shown || still || flat3d) return;
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
  }, [visible, shown, still, fps, flat3d]);

  const aspect = props.scene ? "16:9" : props.plan.aspect;
  const { w, h } = aspectSize(aspect, long);
  return <canvas ref={ref} width={w} height={h} className={props.className} />;
}
