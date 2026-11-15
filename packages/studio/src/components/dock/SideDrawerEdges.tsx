import { useRef, type PointerEvent } from "react";
import { cn } from "../ui";
import { useDockLayoutStore } from "./dockLayoutStore";
import {
  DRAWER_MIN,
  clampWidth,
  dragOutcome,
  dragWidth,
  opensAt,
  storeWidth,
  storedWidth,
  type DrawerSide,
} from "./sideDrawer";

const SLIDE_MS = 180;

/** Slides a column's width from `from` to `to`, then calls `done`; at once when motion is reduced. */
function slide(resize: (width: number) => void, from: number, to: number, done?: () => void) {
  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || from === to) {
    resize(to);
    done?.();
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / SLIDE_MS);
    resize(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

/** Moves the edge's grip to the pointer's height, kept whole inside the edge. */
function followPointer(e: PointerEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = Math.min(Math.max(e.clientY - rect.top, 12.5), rect.height - 12.5);
  e.currentTarget.style.setProperty("--grip-y", `${y}px`);
}

interface Column {
  open: boolean;
  width: number;
}

/** Pointer handlers for one side's edge: drag to resize, drag far in to close, drag a closed column out, click to toggle. */
function useDrawerDrag(side: DrawerSide, { open, width }: Column, resize: (width: number) => void) {
  const setZoneVisible = useDockLayoutStore((state) => state.setZoneVisible);
  const drag = useRef<{ x: number; width: number; open: boolean; moved: boolean } | null>(null);
  const reached = (d: { x: number; width: number }, e: PointerEvent) =>
    dragWidth(side, d.width, e.clientX - d.x);

  const click = (wasOpen: boolean) => {
    if (wasOpen) return slide(resize, width, DRAWER_MIN, () => setZoneVisible(side, false));
    setZoneVisible(side, true);
    slide(resize, DRAWER_MIN, storedWidth(side));
  };

  return {
    onPointerDown(e: PointerEvent<HTMLButtonElement>) {
      // A drag over the page would otherwise select its text.
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, width: open ? width : 0, open, moved: false };
    },
    onPointerMove(e: PointerEvent<HTMLButtonElement>) {
      followPointer(e);
      const d = drag.current;
      if (!d || (!d.moved && Math.abs(e.clientX - d.x) < 4)) return;
      d.moved = true;
      const next = reached(d, e);
      if (!open && opensAt(next)) setZoneVisible(side, true);
      if (open || opensAt(next)) resize(clampWidth(next));
    },
    onPointerUp(e: PointerEvent<HTMLButtonElement>) {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const outcome = dragOutcome(d.open, d.moved, reached(d, e));
      if (!d.moved) return click(d.open);
      if (!outcome.open || outcome.width === undefined) return setZoneVisible(side, false);
      storeWidth(side, outcome.width);
      resize(outcome.width);
    },
    onPointerCancel() {
      drag.current = null;
    },
  };
}

/** The draggable edges of both side columns (sideDrawer.ts), over the dock. */
export function SideDrawerEdges() {
  return (
    <>
      <Edge side="left" />
      <Edge side="right" />
    </>
  );
}

const LOOK = {
  open: {
    verb: "Resize",
    title: "Drag to resize, click to close",
    className: "w-4 cursor-col-resize",
    Mark: Grip,
  },
  closed: {
    verb: "Show",
    title: "Drag or click to open",
    className: "flex w-6 cursor-grab items-center justify-center active:cursor-grabbing",
    Mark: Pill,
  },
};
const CLOSED: Column = { open: false, width: 0 };

function Edge({ side }: { side: DrawerSide }) {
  const found = useDockLayoutStore((state) => state.sides?.[side]);
  const resizeSide = useDockLayoutStore((state) => state.controller?.resizeSide);
  const column = found ?? CLOSED;
  const handlers = useDrawerDrag(side, column, (width) => resizeSide?.(side, width));
  if (!found || !resizeSide) return null;
  const look = column.open ? LOOK.open : LOOK.closed;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${look.verb} the ${side === "left" ? "media" : "inspector"}`}
      title={look.title}
      data-drawer-edge={side}
      style={{ [side]: Math.max(0, column.width - 8) * Number(column.open) }}
      {...handlers}
      className={cn("group/edge absolute inset-y-0 z-[100] outline-none", look.className)}
    >
      <look.Mark />
    </button>
  );
}

/** The resize grip: a small pill with three lines at the pointer's height, shown while the edge is hovered or dragged. */
function Grip() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[var(--grip-y,50%)] flex h-[25px] w-[15px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-sm border border-border-button-default bg-background-primary-default opacity-0 shadow-xs transition-opacity duration-150 group-hover/edge:opacity-100 group-active/edge:opacity-100"
    >
      <span className="h-[13px] w-px bg-foreground-icon-quaternary" />
      <span className="h-[13px] w-px bg-foreground-icon-quaternary" />
      <span className="h-[13px] w-px bg-foreground-icon-quaternary" />
    </span>
  );
}

/** What a closed column leaves on the dock's edge. */
function Pill() {
  return (
    <span className="h-16 w-1.5 rounded-full bg-foreground-icon-quaternary transition-colors group-hover/edge:bg-foreground-icon-tertiary" />
  );
}
