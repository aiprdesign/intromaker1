"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drag to reorder with any pointer: mouse (starts after a small move), touch and pen (starts after
 * a short press, so the list still scrolls with a swipe). Items carry `data-reorder="<group>"` and
 * `data-index`; the item under the pointer is the drop target. A click that ends a drag is swallowed.
 */
export function useReorder(group: string, onMove: (from: number, to: number) => void) {
  const [drag, setDragState] = useState<{ from: number; over: number } | null>(null);
  const dragRef = useRef(drag);
  const setDrag = (next: { from: number; over: number } | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const state = useRef<{ from: number; x: number; y: number; active: boolean; timer: number; id: number; type: string } | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const overAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(`[data-reorder="${group}"]`);
    return el ? Number(el.dataset.index) : null;
  };

  const end = useCallback((commit: boolean) => {
    // (setDrag only touches a ref and a state setter, so it's stable enough to omit.)
    const s = state.current;
    if (!s) return;
    clearTimeout(s.timer);
    state.current = null;
    const d = dragRef.current;
    setDrag(null);
    if (commit && d && s.active && d.over !== d.from) onMoveRef.current(d.from, d.over);
    if (s.active) {
      // The click that ends a drag isn't a click on the item.
      const swallow = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 50);
    }
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const s = state.current;
      if (!s || e.pointerId !== s.id) return;
      if (!s.active) {
        const far = Math.hypot(e.clientX - s.x, e.clientY - s.y) > 6;
        if (s.type === "mouse" && far) s.active = true;
        else if (far) {
          // A touch that moves before the press completes is a scroll, not a drag.
          end(false);
          return;
        } else return;
        setDrag({ from: s.from, over: s.from });
      }
      const over = overAt(e.clientX, e.clientY);
      const d = dragRef.current;
      if (over !== null && d && d.over !== over) setDrag({ ...d, over });
    };
    const up = (e: PointerEvent) => state.current && e.pointerId === state.current.id && end(true);
    const cancel = () => end(false);
    // While dragging by touch, the page mustn't scroll.
    const touchMove = (e: TouchEvent) => state.current?.active && e.preventDefault();
    const key = (e: KeyboardEvent) => e.key === "Escape" && end(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, group]);

  /** Start listening on an item (or its handle). Form fields and buttons inside keep their own pointer. */
  const start = (index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, button:not([data-drag-handle]), a, [contenteditable=true]")) return;
    const s = { from: index, x: e.clientX, y: e.clientY, active: false, timer: 0, id: e.pointerId, type: e.pointerType };
    state.current = s;
    if (e.pointerType === "mouse") e.preventDefault();
    else
      s.timer = window.setTimeout(() => {
        if (state.current !== s) return;
        s.active = true;
        navigator.vibrate?.(10);
        setDrag({ from: index, over: index });
      }, 280);
  };

  /** Props for item `index`, and the class describing its drag state. */
  const item = (index: number) => ({
    "data-reorder": group,
    "data-index": index,
    onPointerDown: start(index),
  });
  const classOf = (index: number) =>
    !drag ? "" : index === drag.from ? " dragging" : index === drag.over ? (drag.from < index ? " drop-after" : " drop-before") : "";

  return { item, start, classOf, dragging: !!drag };
}
