"use client";

import { useEffect, useState } from "react";
import { ensureFonts } from "@/engine/fonts";
import { tokens } from "@/engine/grid";
import { sanitizePlan } from "@/engine/planner";
import { aspectSize, renderScene } from "@/engine/renderer";
import { SKILLS } from "@/engine/skills";
import type { Aspect, Scene, VideoPlan } from "@/engine/types";

type Box = { text: string; x0: number; y0: number; x1: number; y1: number; alpha: number };
type Finding = { skill: string; aspect: Aspect; t: number; kind: "outside safe area" | "clipped by frame" | "text overlaps text"; detail: string; box?: number[] };

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1"];

/** Motion that crosses the grid on purpose: reported separately, not as layout faults. */
const BY_DESIGN: { skill: string; kind: Finding["kind"]; why: string }[] = [
  { skill: "ui-tour", kind: "clipped by frame", why: "the camera dives into the product, so the browser chrome leaves the frame" },
  { skill: "ui-tour", kind: "outside safe area", why: "the camera dives into the product, so the browser chrome leaves the frame" },
  { skill: "live-cursors", kind: "text overlaps text", why: "collaborators' name tags float over the board, on solid tags" },
  { skill: "kanban", kind: "text overlaps text", why: "a dragged card passes over the cards in its path" },
];
const byDesign = (f: Finding) => BY_DESIGN.find((b) => b.skill === f.skill && b.kind === f.kind);
const MOMENTS = [0.45, 0.7, 0.9];

/** Every piece of text a render draws on `canvas`, as device-pixel boxes. */
function recordText(canvas: HTMLCanvasElement, draw: () => void): Box[] {
  const boxes: Box[] = [];
  const proto = CanvasRenderingContext2D.prototype;
  const fill = proto.fillText;
  const stroke = proto.strokeText;
  const hook = (orig: typeof fill) =>
    function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
      if (this.canvas === canvas && String(text).trim() && this.globalAlpha > 0.2) {
        const m = this.measureText(String(text));
        const tr = this.getTransform();
        const pts = [
          [x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent],
          [x + m.actualBoundingBoxRight, y - m.actualBoundingBoxAscent],
          [x - m.actualBoundingBoxLeft, y + m.actualBoundingBoxDescent],
          [x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent],
        ].map(([px, py]) => [tr.a * px + tr.c * py + tr.e, tr.b * px + tr.d * py + tr.f]);
        boxes.push({
          text: String(text),
          x0: Math.min(...pts.map((p) => p[0])),
          y0: Math.min(...pts.map((p) => p[1])),
          x1: Math.max(...pts.map((p) => p[0])),
          y1: Math.max(...pts.map((p) => p[1])),
          alpha: this.globalAlpha,
        });
      }
      return maxWidth === undefined ? orig.call(this, text, x, y) : orig.call(this, text, x, y, maxWidth);
    };
  proto.fillText = hook(fill);
  proto.strokeText = hook(stroke);
  try {
    draw();
  } finally {
    proto.fillText = fill;
    proto.strokeText = stroke;
  }
  return boxes;
}

function check(boxes: Box[], w: number, h: number): Omit<Finding, "skill" | "aspect" | "t">[] {
  const t = tokens(w, h);
  const out: Omit<Finding, "skill" | "aspect" | "t">[] = [];
  const tol = 2;
  for (const b of boxes) {
    const label = b.text.length > 28 ? `${b.text.slice(0, 26)}…` : b.text;
    const box = [b.x0, b.y0, b.x1, b.y1].map(Math.round);
    if (b.x0 < -tol || b.y0 < -tol || b.x1 > w + tol || b.y1 > h + tol) out.push({ kind: "clipped by frame", detail: `"${label}"`, box });
    else if (b.x0 < t.safe.left - tol || b.x1 > t.safe.right + tol || b.y0 < t.safe.top - tol || b.y1 > h - t.safe.bottom + tol)
      out.push({ kind: "outside safe area", detail: `"${label}"`, box });
  }
  // Overlapping text: two different strings whose boxes overlap by over 30% of the smaller one.
  const solid = boxes.filter((b) => b.alpha > 0.5 && b.text.trim().length > 1);
  for (let i = 0; i < solid.length; i++)
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i];
      const b = solid[j];
      if (a.text === b.text) continue;
      const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
      const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
      if (small > 0 && (ix * iy) / small > 0.3) out.push({ kind: "text overlaps text", detail: `"${a.text.slice(0, 20)}" × "${b.text.slice(0, 20)}"` });
    }
  return out;
}

/**
 * Layout audit: renders every skill in 16:9, 9:16 and 1:1 at three moments (camera off, so this is
 * the design-space layout) and reports text outside the title-safe area, text clipped by the
 * frame, and text overlapping other text.
 */
export default function LayoutAudit() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [expected, setExpected] = useState<Finding[]>([]);
  const [progress, setProgress] = useState("Loading fonts…");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFonts();
      const all: Finding[] = [];
      for (const skill of SKILLS) {
        for (const aspect of ASPECTS) {
          if (cancelled) return;
          setProgress(`${skill.name} · ${aspect}`);
          const { w, h } = aspectSize(aspect, 1920);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          const scene: Scene = { skill: skill.id, text: skill.sample.text, subtext: skill.sample.subtext, items: skill.sample.items, duration: 6, transition: "cut", eyebrow: "Features" };
          const plan = sanitizePlan({ title: "Audit", palette: "midnight", font: "inter", aspect, bpm: 120, seed: 7, style: "saas", scenes: [scene] } as VideoPlan);
          for (const m of MOMENTS) {
            const boxes = recordText(canvas, () => renderScene(ctx, plan.scenes[0], plan, 6 * m, w, h, 0, { camera: false }));
            for (const f of check(boxes, w, h)) all.push({ ...f, skill: skill.id, aspect, t: m });
          }
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      // One line per skill, format and problem (the moment it was first seen).
      const seen = new Set<string>();
      const unique = all.filter((f) => {
        const k = `${f.skill}|${f.aspect}|${f.kind}|${f.detail}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (!cancelled) {
        setFindings(unique.filter((f) => !byDesign(f)));
        setExpected(unique.filter((f) => byDesign(f)));
        (window as unknown as { __audit?: Finding[] }).__audit = unique.filter((f) => !byDesign(f));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const bySkill = new Map<string, Finding[]>();
  for (const f of findings ?? []) bySkill.set(f.skill, [...(bySkill.get(f.skill) ?? []), f]);
  return (
    <article className="legal audit">
      <h1>Layout audit</h1>
      <p className="lead">
        The skills in 16:9, 9:16 and 1:1, at three moments, checked against the design system: text inside the title-safe area, no text clipped by the frame,
        no text overlapping other text.
      </p>
      {!findings ? (
        <p>{progress}</p>
      ) : (
        <>
          <p data-audit-done>
            {SKILLS.length} skills × 3 formats: <strong>{findings.length === 0 ? "clear" : `${findings.length} findings in ${bySkill.size} skills`}</strong>
          </p>
          {[...bySkill].map(([skill, fs]) => (
            <details key={skill}>
              <summary>
                {skill} · {fs.length}
              </summary>
              <ul>
                {fs.map((f, i) => (
                  <li key={i}>
                    {f.aspect} at {Math.round(f.t * 100)}%: {f.kind} {f.detail}
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {expected.length > 0 && (
            <>
              <h2>By design</h2>
              <ul>
                {BY_DESIGN.filter((b) => expected.some((f) => f.skill === b.skill && f.kind === b.kind)).map((b) => (
                  <li key={b.skill + b.kind}>
                    <strong>{b.skill}</strong>, {b.kind}: {b.why}.
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </article>
  );
}
