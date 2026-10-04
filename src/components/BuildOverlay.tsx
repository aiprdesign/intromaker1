"use client";

import { useEffect, useState } from "react";

export type SiteCheck = {
  host: string;
  online: boolean;
  ms?: number;
  https?: boolean;
  title?: string;
  hasText?: boolean;
  hasLogo?: boolean;
  problem?: { code: string; message: string };
};

const IMPORT_STEPS = ["Opening your website", "Capturing screenshots", "Reading copy, features and proof", "Picking your brand colours", "Directing your video", "Building the slides"];
const PROMPT_STEPS = ["Reading your prompt", "Directing your video", "Building the slides"];

/** Which step a status line belongs to. */
function stepOf(stage: string | null, importing: boolean) {
  const s = (stage ?? "").toLowerCase();
  if (!importing) return s.includes("slide") ? 2 : 1;
  if (s.includes("opening")) return 0;
  if (s.includes("captur")) return 1;
  if (s.includes("reading")) return 2;
  if (s.includes("colour")) return 3;
  if (s.includes("direct")) return 4;
  return s ? 5 : 0;
}

/**
 * Over the player while a video is being built: what's happening, step by step, with a progress
 * bar, the time so far and Stop. Imports take 15–60 seconds, so the wait is never a mystery.
 */
export function BuildProgress({ importing, stage, site, onStop }: { importing: boolean; stage: string | null; site?: string; onStop: () => void }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const steps = importing ? IMPORT_STEPS : PROMPT_STEPS;
  const at = stepOf(stage, importing);
  const secs = (now - started) / 1000;
  // Steps set the floor; time eases the bar on within the step, never quite reaching the next.
  const expected = importing ? 35 : 8;
  const timeShare = 1 - Math.exp(-secs / expected);
  const pct = Math.min(96, Math.max(((at + 0.15) / steps.length) * 100, timeShare * 100 * 0.9));
  const host = site?.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return (
    <div className="build-overlay" role="status" aria-live="polite">
      <div className="build-card">
        <span className="build-spinner" aria-hidden />
        <h2>{importing ? `Building your video${host ? ` from ${host}` : ""}` : "Building your video"}</h2>
        <p className="build-now">{stage ?? steps[at]}</p>
        <div className="build-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <ol className="build-steps">
          {steps.map((s, i) => (
            <li key={s} className={i < at ? "done" : i === at ? "now" : ""}>
              <span className="dot" aria-hidden>
                {i < at ? "✓" : ""}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="build-meta">
          {Math.floor(secs)}s{importing ? " · websites usually take 15–60 seconds" : ""}
        </p>
        <button className="btn btn-ghost sm" onClick={onStop}>
          ■ Stop
        </button>
      </div>
    </div>
  );
}

type Failure = { message: string; code?: string; suggestion?: string; url: string; side?: "site" | "ours" | "limit" | "network" };

/**
 * Over the player when an import fails: what went wrong in plain words, whose side it's on, a
 * quick health check of the website, and what to do next.
 */
export function ImportFailure({
  failure,
  check,
  onRetry,
  onSuggestion,
  onPhotos,
  onDescribe,
  onClose,
}: {
  failure: Failure;
  check: SiteCheck | "loading" | "failed" | null;
  onRetry: () => void;
  onSuggestion: () => void;
  onPhotos: () => void;
  onDescribe: () => void;
  onClose: () => void;
}) {
  const host = failure.url.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  const c = check && typeof check === "object" ? check : null;
  // Whose side: the import's own answer first, then what the health check found.
  const side = failure.side ?? "site";
  const verdict =
    side === "ours"
      ? c?.online && !c.problem
        ? `Your website looks fine: the problem was on IntroMaker's side.`
        : "The problem was on IntroMaker's side."
      : side === "network"
        ? "Your browser couldn't reach IntroMaker's server."
        : side === "limit"
          ? "You've reached a limit, not a problem with your website."
          : c && !c.online
            ? `${host} isn't reachable right now.`
            : `${host} answered, but there was a problem reading it.`;
  const rows: { ok: boolean | null; text: string }[] = c
    ? [
        { ok: c.online, text: c.online ? `Website is online${c.ms !== undefined ? ` (answered in ${c.ms < 1000 ? `${c.ms} ms` : `${(c.ms / 1000).toFixed(1)}s`})` : ""}` : `Website didn't answer: ${c.problem?.message ?? "it may be down"}` },
        ...(c.online
          ? [
              { ok: c.problem?.code !== "blocked" && c.problem?.code !== "busy", text: c.problem?.code === "blocked" ? "It blocks automated visitors (so it can't be imported)" : c.problem?.code === "busy" ? "It's limiting visits right now" : "It lets IntroMaker read it" },
              { ok: c.https ?? null, text: c.https ? "Secure (https)" : "Not on https" },
              { ok: !!c.title, text: c.title ? `Has a page title: “${c.title.length > 60 ? `${c.title.slice(0, 57).trimEnd()}…` : c.title}”` : "Has no page title" },
              { ok: !!c.hasText, text: c.hasText ? "Has readable text" : "Shows almost no text without running its scripts" },
              { ok: !!c.hasLogo, text: c.hasLogo ? "Has a logo or icon" : "No logo or icon found in the page" },
            ]
          : []),
      ]
    : [];
  return (
    <div className="build-overlay failed" role="alert">
      <div className="build-card">
        <span className="build-x" aria-hidden>
          !
        </span>
        <h2>We couldn&apos;t import {host}</h2>
        <p className="build-now">{failure.message}</p>
        <p className={`build-verdict ${side}`}>{verdict}</p>
        {check === "loading" && <p className="build-meta">Checking {host}…</p>}
        {rows.length > 0 && (
          <ul className="check-list">
            {rows.map((r) => (
              <li key={r.text} className={r.ok ? "ok" : r.ok === false ? "bad" : ""}>
                <span aria-hidden>{r.ok ? "✓" : r.ok === false ? "✕" : "·"}</span> {r.text}
              </li>
            ))}
          </ul>
        )}
        {check === "failed" && side !== "network" && <p className="build-meta">IntroMaker&apos;s server didn&apos;t answer the website check either: it may be restarting. Try again in a minute.</p>}
        <div className="build-actions">
          {failure.suggestion && (
            <button className="btn btn-primary sm" onClick={onSuggestion}>
              Import {failure.suggestion.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </button>
          )}
          {failure.code === "listing" && (
            <button className="btn btn-primary sm" onClick={onPhotos}>
              Add product photos
            </button>
          )}
          {failure.code !== "blocked" && failure.code !== "dns" && failure.code !== "parked" && (
            <button className={`btn ${failure.suggestion || failure.code === "listing" ? "btn-ghost" : "btn-primary"} sm`} onClick={onRetry}>
              Try again
            </button>
          )}
          <button className="btn btn-ghost sm" onClick={onDescribe}>
            Describe it instead
          </button>
          <button className="btn btn-ghost sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
