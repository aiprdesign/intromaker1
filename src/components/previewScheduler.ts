"use client";

/**
 * One render loop for every live preview on the page (slide cards, style tiles, transition strips).
 *
 * Each preview used to run its own requestAnimationFrame loop, so a page of twenty cards spent the
 * whole frame drawing them and clicks, typing and route changes waited behind it. Here the previews
 * share a budget: each frame draws the previews that are most overdue until a few milliseconds are
 * spent, then hands the frame back to the browser. Many previews on screen play at a lower frame
 * rate instead of freezing the page. Input always comes first: rendering pauses briefly on every
 * pointer or key press, so a click on a link or tab is handled at once.
 */

type Job = { draw: (now: number) => void; interval: number; last: number; once: boolean; cost: number };

const jobs = new Set<Job>();
/** Milliseconds of preview drawing per frame. */
const BUDGET_MS = 6;
let raf = 0;
let quietUntil = 0;
let listening = false;

function loop(now: number) {
  raf = 0;
  if (!jobs.size) return;
  if (now >= quietUntil && !document.hidden) {
    let spent = 0;
    // The most overdue first, so every preview gets its turn.
    // (An expensive preview waits longer between frames: about six times what it costs to draw, so
    // no single preview takes more than a sixth of the main thread.)
    const due = [...jobs].filter((j) => now - j.last >= Math.max(j.interval, j.cost * 6)).sort((a, b) => a.last - b.last);
    for (const j of due) {
      // A preview that costs more than the frame has left waits for a later frame (each one still
      // updates at least once a second); the first one of a frame always runs.
      if (spent > 0 && spent + j.cost > BUDGET_MS && now - j.last < 1000) continue;
      const t0 = performance.now();
      j.last = now;
      try {
        j.draw(now);
      } catch {
        /* a preview that fails to draw is skipped */
      }
      const took = performance.now() - t0;
      j.cost = j.cost ? j.cost * 0.7 + took * 0.3 : took;
      spent += took;
      if (j.once) jobs.delete(j);
      if (spent > BUDGET_MS) break;
    }
  }
  if (jobs.size) raf = requestAnimationFrame(loop);
}

function hush(e: Event) {
  // A link, tab or button opens something new: hold off until it has had time to render.
  const el = e.target instanceof Element ? e.target.closest("a[href], [role=tab], button, summary") : null;
  quietUntil = performance.now() + (el ? 700 : 250);
}

/** True just after a click or key press, while previews hold off so the input is handled first. */
export function previewsQuiet() {
  if (!listening && typeof window !== "undefined") listen();
  return performance.now() < quietUntil;
}

function listen() {
  listening = true;
  window.addEventListener("pointerdown", hush, { capture: true, passive: true });
  window.addEventListener("keydown", hush, { capture: true, passive: true });
}

/**
 * Add a preview to the shared loop: `draw` is called about every `interval` ms (or once, as soon as
 * there's room, with `once`). Returns a function that removes it.
 */
export function schedulePreview(draw: (now: number) => void, opts: { interval?: number; once?: boolean } = {}) {
  if (!listening && typeof window !== "undefined") listen();
  const job: Job = { draw, interval: opts.interval ?? 1000 / 30, last: -Infinity, once: !!opts.once, cost: 0 };
  jobs.add(job);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    jobs.delete(job);
  };
}
