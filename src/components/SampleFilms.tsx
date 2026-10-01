"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Soundtrack } from "@/engine/audio";
import { ensureFonts } from "@/engine/fonts";
import { mediaState, onMediaReady, preloadPlanMedia } from "@/engine/media";
import { renderFrame, totalDuration } from "@/engine/renderer";
import { SAMPLE_FILMS } from "@/engine/samples";
import { SKILL_MAP } from "@/engine/skills";
import { useVisible } from "./useVisible";

/** Where each slide starts in a film. */
function chapters(plan: (typeof SAMPLE_FILMS)[number]["plan"]) {
  let at = 0;
  return plan.scenes.map((s) => {
    const c = { at, len: s.duration, name: SKILL_MAP[s.skill]?.name ?? s.skill };
    at += s.duration;
    return c;
  });
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/**
 * The homepage's sample films: a SaaS launch, a product video and a trailer for imaginary brands,
 * rendered live by the engine. They play muted while on screen (sound on request), loop, and can
 * be jumped slide by slide.
 */
export default function SampleFilms() {
  const [tab, setTab] = useState(0);
  const film = SAMPLE_FILMS[tab];
  const plan = film.plan;
  const duration = totalDuration(plan);
  const marks = chapters(plan);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visible = useVisible(canvasRef, "0px");
  const [shown, setShown] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);
  const soundRef = useRef<Soundtrack | null>(null);
  // Restarts playback from `timeRef` (after a seek, a new film or sound switched on).
  const [run, setRun] = useState(0);

  const draw = useCallback(
    (t: number) => {
      const c = canvasRef.current;
      if (c) renderFrame(c.getContext("2d")!, plan, t, c.width, c.height);
    },
    [plan],
  );

  // Hidden tab or reduced motion: hold still (a frame stays up; the viewer can press play).
  useEffect(() => {
    const onVis = () => setShown(!document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // A new film starts from the top, and its photos load in.
  useEffect(() => {
    timeRef.current = 0;
    setTime(0);
    ensureFonts().then(() => draw(1.2));
    preloadPlanMedia(plan).then(() => draw(timeRef.current || 1.2));
  }, [plan, draw]);
  useEffect(() => onMediaReady(() => draw(timeRef.current || 1.2)), [draw]);

  const live = playing && visible && shown;
  useEffect(() => {
    if (!live) {
      soundRef.current?.stop();
      return;
    }
    let raf = 0;
    let alive = true;
    ensureFonts().then(() => {
      if (!alive) return;
      let startAt = timeRef.current >= duration - 0.05 ? 0 : timeRef.current;
      let t0 = performance.now();
      const startSound = () => {
        const s = soundRef.current;
        if (!s || muted) return;
        s.ctx.resume();
        s.setMuted(false);
        s.play(plan, startAt);
      };
      startSound();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        // Pause while a video exports elsewhere in the app, so the export gets the machine.
        if (mediaState.exporting) return;
        let t = startAt + (now - t0) / 1000;
        if (t >= duration) {
          // Loop: back to the first slide (the score restarts with it).
          startAt = 0;
          t0 = now;
          t = 0;
          soundRef.current?.stop();
          startSound();
        }
        timeRef.current = t;
        draw(t);
        setTime(t);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      soundRef.current?.stop();
    };
  }, [live, plan, draw, duration, muted, run]);

  useEffect(() => () => void soundRef.current?.close(), []);

  const seek = (t: number) => {
    timeRef.current = Math.max(0, Math.min(duration - 0.01, t));
    setTime(timeRef.current);
    draw(timeRef.current);
    setRun((n) => n + 1);
  };
  const pick = (i: number) => {
    if (i === tab) return;
    soundRef.current?.stop();
    setTab(i);
    setPlaying(true);
    setRun((n) => n + 1);
  };
  const toggleSound = () => {
    // Audio may only start from a click.
    soundRef.current ??= new Soundtrack();
    setMuted((m) => !m);
    setPlaying(true);
  };
  const current = marks.reduce((at, m, i) => (time >= m.at ? i : at), 0);

  return (
    <div className="samples">
      <div className="samples-tabs" role="tablist" aria-label="Sample films">
        {SAMPLE_FILMS.map((f, i) => (
          <button key={f.id} role="tab" aria-selected={i === tab} className={`samples-tab${i === tab ? " on" : ""}`} onClick={() => pick(i)}>
            {f.label}
            <span>{fmt(totalDuration(f.plan))}</span>
          </button>
        ))}
      </div>

      <div className="samples-stage">
        <canvas ref={canvasRef} width={1280} height={720} className="samples-canvas" aria-label={`${film.label} sample film`} onClick={() => setPlaying((p) => !p)} />
        <div className="samples-controls">
          <button className="samples-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            )}
          </button>
          <div className="samples-bar" role="group" aria-label="Slides">
            {marks.map((m, i) => (
              <button
                key={i}
                className={`samples-seg${i === current ? " on" : ""}`}
                style={{ flexGrow: m.len }}
                onClick={() => seek(m.at + 0.01)}
                title={`${i + 1}. ${m.name}`}
                aria-label={`Slide ${i + 1}: ${m.name}`}
              >
                <i style={{ width: `${Math.max(0, Math.min(1, (time - m.at) / m.len)) * 100}%` }} />
              </button>
            ))}
          </div>
          <span className="samples-time">
            {fmt(time)} / {fmt(duration)}
          </span>
          <button className="samples-btn" onClick={toggleSound} aria-label={muted ? "Sound on" : "Sound off"} title={muted ? "Sound on" : "Sound off"}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
              {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
            </svg>
          </button>
        </div>
      </div>

      <ol className="samples-chapters">
        {marks.map((m, i) => (
          <li key={i}>
            <button className={i === current ? "on" : ""} onClick={() => seek(m.at + 0.01)}>
              <span>{i + 1}</span>
              {m.name}
            </button>
          </li>
        ))}
      </ol>

      <div className="samples-foot">
        <p>{film.blurb}</p>
        <Link href={`/studio?prompt=${encodeURIComponent(film.prompt)}`} className="btn btn-primary">
          Make one like this →
        </Link>
      </div>
    </div>
  );
}
