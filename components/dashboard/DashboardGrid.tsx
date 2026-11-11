"use client";

import { useRef, useState } from "react";
import {
  GRID_COLUMNS, ROW_HEIGHT, moveWidget, removeWidget, resizeWidget,
  type WidgetId, type WidgetPlacement,
} from "@/lib/widgets";
import { FrameContext } from "./Frame";
import { WIDGET_COMPONENTS } from "./Widgets";

const GAP = 16;

// A 12-column grid. Each widget spans w columns and h rows; the browser packs
// them in order. In edit mode widgets can be dragged to a new place (by the
// ⠿ handle), resized from the bottom-right corner, moved with ← →, or removed.
// On phones every widget takes the full width.
export default function DashboardGrid({
  layout,
  editing,
  onChange,
}: {
  layout: WidgetPlacement[];
  editing: boolean;
  onChange: (next: WidgetPlacement[]) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [resizing, setResizing] = useState<WidgetId | null>(null);

  const colStep = () => {
    const width = grid.current?.clientWidth || 1200;
    return (width - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS + GAP;
  };

  const startResize = (id: WidgetId, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = layout.find((w) => w.id === id)!;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const step = colStep();
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId); // keep getting moves when the pointer leaves the handle
    } catch {
      // no live pointer (e.g. a synthetic event): moves still arrive while over the handle
    }
    setResizing(id);
    let current = layout;
    const move = (ev: PointerEvent) => {
      const w = start.w + Math.round((ev.clientX - x0) / step);
      const h = start.h + Math.round((ev.clientY - y0) / (ROW_HEIGHT + GAP));
      current = resizeWidget(layout, id, w, h);
      onChange(current);
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      setResizing(null);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const resizeKey = (id: WidgetId, e: React.KeyboardEvent) => {
    const p = layout.find((w) => w.id === id)!;
    const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange(resizeWidget(layout, id, p.w + d[0], p.h + d[1]));
  };

  // Where a dragged widget would land: before or after the one under the pointer.
  const overIndex = (i: number, e: React.DragEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY > r.bottom - r.height / 3 || (e.clientX > r.left + r.width / 2 && e.clientY > r.top + r.height / 3);
    return after ? i + 1 : i;
  };

  return (
    <div
      ref={grid}
      className="dash-grid"
      style={{ gap: GAP, gridAutoRows: ROW_HEIGHT, userSelect: resizing ? "none" : undefined }}
      onDragOver={(e) => editing && dragging && e.preventDefault()}
      onDrop={(e) => {
        if (!editing || !dragging) return;
        e.preventDefault();
        const from = layout.findIndex((w) => w.id === dragging);
        const to = dropAt ?? layout.length;
        onChange(moveWidget(layout, dragging, to > from ? to - 1 : to));
        setDragging(null);
        setDropAt(null);
      }}
    >
      {layout.map((p, i) => {
        const Widget = WIDGET_COMPONENTS[p.id];
        const marker = dragging && dragging !== p.id && dropAt === i;
        return (
          <div
            key={p.id}
            data-widget={p.id}
            className="dash-item relative"
            style={{ "--w": p.w, "--h": p.h, opacity: dragging === p.id ? 0.4 : 1 } as React.CSSProperties}
            draggable={editing}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", p.id);
              setDragging(p.id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setDropAt(null);
            }}
            onDragOver={(e) => {
              if (!editing || !dragging) return;
              e.preventDefault();
              setDropAt(overIndex(i, e));
            }}
          >
            {marker && <div className="absolute -left-2 top-0 bottom-0 w-1 rounded-full" style={{ background: "var(--accent)" }} />}
            <FrameContext.Provider
              value={{
                id: p.id,
                editing,
                index: i,
                count: layout.length,
                size: { w: p.w, h: p.h },
                onRemove: () => onChange(removeWidget(layout, p.id)),
                onMove: (delta) => onChange(moveWidget(layout, p.id, i + delta)),
                onResizeStart: (e) => startResize(p.id, e),
                onResizeKey: (e) => resizeKey(p.id, e),
              }}
            >
              <Widget />
            </FrameContext.Provider>
          </div>
        );
      })}
    </div>
  );
}
