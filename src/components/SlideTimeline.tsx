"use client";

import { useEffect, useState } from "react";
import { onMediaReady } from "@/engine/media";
import type { SkillId, VideoPlan } from "@/engine/types";
import { sceneThumb, thumbsReady } from "@/lib/thumbs";
import { beatOf } from "./ArcStrip";
import Icon from "./Icon";
import SkillPicker from "./SkillPicker";
import { useReorder } from "./useReorder";

/**
 * The film as editable slides: a thumbnail per slide, sized by its length. Click to select and
 * jump to it, drag to reorder, and duplicate or remove from the slide itself (or with Delete).
 * The + at the end adds a slide after the selected one.
 */
export default function SlideTimeline({
  plan,
  selected,
  active,
  onSelect,
  onRemove,
  onDuplicate,
  onMove,
  onAdd,
}: {
  plan: VideoPlan;
  selected: number | null;
  /** The slide under the playhead. */
  active: number;
  onSelect: (i: number) => void;
  onRemove: (i: number) => void;
  onDuplicate: (i: number) => void;
  onMove: (from: number, to: number) => void;
  onAdd: (skill: SkillId) => void;
}) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const reorder = useReorder("timeline", onMove);
  const [mediaTick, setMediaTick] = useState(0);
  useEffect(() => onMediaReady(() => setMediaTick((n) => n + 1)), []);
  // Re-render the thumbnails shortly after edits settle (typing stays smooth).
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(
      () =>
        thumbsReady().then(() => {
          if (alive) setThumbs(plan.scenes.map((s) => sceneThumb(s, plan)));
        }),
      thumbs.length ? 250 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, mediaTick]);

  const one = plan.scenes.length <= 1;
  const tall = plan.aspect === "9:16";
  return (
    <div className="slide-timeline" aria-label="Slides">
      <div className={`slide-track${reorder.dragging ? " reordering" : ""}`} role="listbox" aria-label="Slides in the film">
        {plan.scenes.map((s, i) => {
          const { name, icon } = beatOf(s);
          return (
            <div
              key={i}
              role="option"
              aria-selected={selected === i}
              tabIndex={0}
              {...reorder.item(i)}
              className={`slide-chip${selected === i ? " selected" : ""}${active === i ? " playing" : ""}${reorder.classOf(i)}`}
              title={`${name}: ${s.text.replace(/\*/g, "")}${s.why ? `\n${s.why}` : ""}\nClick to edit · drag to reorder`}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(i);
                } else if ((e.key === "Delete" || e.key === "Backspace") && !one) {
                  e.preventDefault();
                  onRemove(i);
                } else if (e.key === "ArrowLeft" && e.altKey && i > 0) onMove(i, i - 1);
                else if (e.key === "ArrowRight" && e.altKey && i < plan.scenes.length - 1) onMove(i, i + 1);
              }}
            >
              <span className={`slide-thumb${tall ? " tall" : ""}`}>{thumbs[i] && <img src={thumbs[i]} alt="" draggable={false} />}</span>
              <span className="slide-meta">
                <span className="slide-name">
                  <Icon name={icon} size={12} />
                  <span>{name}</span>
                </span>
                <small>
                  {String(i + 1).padStart(2, "0")} · {s.duration.toFixed(1)}s
                </small>
              </span>
              <span className="slide-actions">
                <button
                  type="button"
                  className="slide-act"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(i);
                  }}
                  aria-label={`Duplicate slide ${i + 1}`}
                  title="Duplicate"
                >
                  <Icon name="Copy" size={12} />
                </button>
                <button
                  type="button"
                  className="slide-act danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  disabled={one}
                  aria-label={`Remove slide ${i + 1}`}
                  title={one ? "A film needs at least one slide" : "Remove from the film"}
                >
                  <Icon name="X" size={12} />
                </button>
              </span>
            </div>
          );
        })}
        <SkillPicker plan={plan} onPick={onAdd} variant="add" label="+" />
      </div>
    </div>
  );
}
