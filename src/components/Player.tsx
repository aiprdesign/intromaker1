"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Soundtrack } from "@/engine/audio";
import { canExport, EXPORT_PRESETS, exportThumbnail, exportVideo, planForPreset } from "@/engine/export";
import { ensureFonts } from "@/engine/fonts";
import { drawGridOverlay } from "@/engine/grid";
import { onMediaReady, preloadPlanMedia } from "@/engine/media";
import { PALETTES } from "@/engine/palettes";
import { aspectSize, renderFrame, totalDuration } from "@/engine/renderer";
import { SKILL_MAP } from "@/engine/skills";
import type { VideoPlan } from "@/engine/types";

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export default function Player({
  plan,
  autoPlay = true,
  resetKey = 0,
  seek: seekTo,
  onScene,
}: {
  plan: VideoPlan;
  autoPlay?: boolean;
  /** Changing this rewinds to 0 and starts playing (e.g. after a new generation). */
  resetKey?: number;
  /** Jump to `t` (paused) whenever `key` changes: the studio's slide timeline uses it. */
  seek?: { t: number; key: number };
  /** Called when the slide under the playhead changes. */
  onScene?: (index: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [exporting, setExporting] = useState<number | null>(null);
  const [presetId, setPresetId] = useState<string>("current");
  // Designer's grid overlay: preview only, never part of an export.
  const [grid, setGrid] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("intromaker.preset");
      if (saved && EXPORT_PRESETS.some((p) => p.id === saved)) setPresetId(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId) ?? EXPORT_PRESETS[0];
  const choosePreset = (id: string) => {
    setPresetId(id);
    try {
      localStorage.setItem("intromaker.preset", id);
    } catch {
      /* ignore */
    }
  };
  const fileBase = (p: VideoPlan) => `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "intro"}-${p.aspect.replace(":", "x")}`;
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const [error, setError] = useState<string | null>(null);
  const [canRecord, setCanRecord] = useState(true);
  useEffect(() => setCanRecord(canExport()), []);
  const timeRef = useRef(0);
  const soundRef = useRef<Soundtrack | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const duration = totalDuration(plan);
  const { w, h } = aspectSize(plan.aspect, 1280);

  const draw = useCallback(
    (t: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      // Grid view shows the layout itself: the lens (push-in, drift, beat punches) holds still.
      renderFrame(ctx, plan, t, c.width, c.height, grid ? { camera: false } : {});
      if (grid) drawGridOverlay(ctx, c.width, c.height);
    },
    [plan, grid],
  );

  // Jump to a slide picked in the studio, paused on it.
  useEffect(() => {
    if (!seekTo) return;
    const t = Math.max(0, Math.min(duration - 0.001, seekTo.t));
    timeRef.current = t;
    setTime(t);
    setPlaying(false);
    ensureFonts().then(() => draw(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo?.key]);

  // Report the slide under the playhead.
  const sceneAt = (() => {
    let acc = 0;
    for (let i = 0; i < plan.scenes.length; i++) {
      acc += plan.scenes[i].duration;
      if (time < acc) return i;
    }
    return plan.scenes.length - 1;
  })();
  useEffect(() => onScene?.(sceneAt), [sceneAt, onScene]);

  // Rewind and play when a fresh plan is generated.
  useEffect(() => {
    timeRef.current = 0;
    setTime(0);
    if (resetKey > 0) setPlaying(true);
  }, [resetKey]);

  // Edits keep the playhead where it is; redraw the still frame.
  useEffect(() => {
    timeRef.current = Math.min(timeRef.current, duration);
    ensureFonts().then(() => draw(timeRef.current));
    // Redraw once imported website media has arrived.
    preloadPlanMedia(plan).then(() => draw(timeRef.current));
  }, [draw, duration, plan]);

  // Playback loop.
  useEffect(() => {
    if (!playing) {
      soundRef.current?.stop();
      draw(timeRef.current);
      return;
    }
    let raf = 0;
    let alive = true;
    ensureFonts().then(() => {
      if (!alive) return;
      if (timeRef.current >= duration - 0.05) timeRef.current = 0;
      const startAt = timeRef.current;
      const t0 = performance.now();
      // Browsers only allow audio after the user has interacted with the page.
      if (!soundRef.current && navigator.userActivation?.hasBeenActive) soundRef.current = new Soundtrack();
      if (soundRef.current) {
        soundRef.current.ctx.resume();
        soundRef.current.setMuted(muted);
        soundRef.current.play(plan, startAt);
      }
      const tick = (now: number) => {
        let t = startAt + (now - t0) / 1000;
        if (t >= duration) {
          t = duration;
          timeRef.current = t;
          draw(t - 0.001);
          setTime(t);
          setPlaying(false);
          return;
        }
        timeRef.current = t;
        draw(t);
        setTime(t);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      soundRef.current?.stop();
    };
    // `muted` is applied live below; excluding it avoids restarting playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, plan, draw, duration]);

  useEffect(() => soundRef.current?.setMuted(muted), [muted]);
  // While paused, repaint when a website image/video frame becomes available.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => onMediaReady(() => !playingRef.current && draw(timeRef.current)), [draw]);
  useEffect(() => () => void soundRef.current?.close(), []);

  const toggle = () => {
    // Audio contexts must be created from a user gesture.
    soundRef.current ??= new Soundtrack();
    setPlaying((p) => !p);
  };

  const restart = () => {
    setPlaying(false);
    requestAnimationFrame(() => setPlaying(true));
  };

  const toggleMute = () => {
    if (!soundRef.current) {
      // First audio interaction while already playing: create the synth and reschedule.
      soundRef.current = new Soundtrack();
      setMuted(false);
      if (playing) restart();
      return;
    }
    setMuted((m) => !m);
  };

  const seek = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
    timeRef.current = t;
    setTime(t);
    if (playing) restart();
    else draw(t);
  };

  const onExport = async () => {
    setError(null);
    setPlaying(false);
    const ac = new AbortController();
    abortRef.current = ac;
    setExporting(0);
    try {
      const out = planForPreset(plan, preset);
      const { blob, ext } = await exportVideo(out, {
        long: preset.long,
        fps: preset.fps,
        audio: !muted,
        onProgress: setExporting,
        signal: ac.signal,
      });
      download(blob, `${fileBase(out)}.${ext}`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setExporting(null);
      abortRef.current = null;
    }
  };

  const palette = PALETTES[plan.palette];
  let acc = 0;

  return (
    <div className="player">
      <div className={`stage stage-${plan.aspect.replace(":", "x")}`}>
        <canvas ref={canvasRef} width={w} height={h} onClick={toggle} />
        {!playing && exporting === null && (
          <button className="stage-play" onClick={toggle} aria-label="Play">
            <svg viewBox="0 0 24 24" width="34" height="34"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          </button>
        )}
        {exporting !== null && (
          <div className="stage-export">
            <div className="spinner" />
            <div>Rendering {Math.round(exporting * 100)}%</div>
            <small>Rendering every frame at full quality.</small>
            <button className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>Cancel</button>
          </div>
        )}
      </div>

      <div className="controls">
        <button className="icon-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          )}
        </button>
        <span className="time">{fmt(time)} / {fmt(duration)}</span>
        <div
          className="timeline"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            seek(e.clientX, e.currentTarget);
          }}
          onPointerMove={(e) => e.buttons === 1 && seek(e.clientX, e.currentTarget)}
        >
          {plan.scenes.map((s, i) => {
            const left = (acc / duration) * 100;
            acc += s.duration;
            return (
              <div
                key={i}
                className="seg"
                style={{
                  left: `${left}%`,
                  width: `${(s.duration / duration) * 100}%`,
                  background: i % 2 ? palette.secondary : palette.primary,
                }}
                title={`${SKILL_MAP[s.skill].name}: ${s.text}`}
              >
                <span>{SKILL_MAP[s.skill].name}</span>
              </div>
            );
          })}
          <div className="playhead" style={{ left: `${(time / duration) * 100}%` }} />
        </div>
        <button className="icon-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} title="Generated soundtrack">
          {muted ? (
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3l2.5-2.5-1-1L15.5 11 13 8.5l-1 1 2.5 2.5-2.5 2.5 1 1 2.5-2.5 2.5 2.5 1-1z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3A4.5 4.5 0 0 0 13 8v8a4.5 4.5 0 0 0 2.5-4zM13 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor" /></svg>
          )}
        </button>
        <button
          className={`icon-btn grid-toggle${grid ? " active" : ""}`}
          onClick={() => setGrid((g) => !g)}
          aria-pressed={grid}
          aria-label="Design grid"
          title="Design grid: title-safe area, layout columns and the 8pt rhythm, with the camera held still (preview only)"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M9.5 3.5v17M14.5 3.5v17M3.5 9.5h17M3.5 14.5h17" /></svg>
        </button>
        <select value={presetId} onChange={(e) => choosePreset(e.target.value)} className="select sm" disabled={exporting !== null} title="Export preset: the film re-frames itself for each platform">
          {EXPORT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            try {
              const out = planForPreset(plan, preset);
              download(await exportThumbnail(out, preset.long), `${fileBase(out)}-thumbnail.png`);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          disabled={exporting !== null}
          title="Download a PNG thumbnail / poster (the end card)"
        >
          PNG
        </button>
        <button className="btn btn-primary" onClick={onExport} disabled={exporting !== null || !canRecord} title={canRecord ? "" : "Recording not supported in this browser"}>
          Export video
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
