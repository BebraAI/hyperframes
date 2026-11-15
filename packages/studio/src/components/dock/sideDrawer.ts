/**
 * The side columns as drawers, after promptwise's own Timeline editor: a column's inner edge drags to
 * resize, drags far in to close and toggles on a click; a closed column leaves a pill on the dock's
 * edge to drag or click it back out. Widths are remembered per side.
 */

export type DrawerSide = "left" | "right";

export const DRAWER_MIN = 200;
export const DRAWER_MAX = 480;
const DEFAULT_WIDTH: Record<DrawerSide, number> = { left: 260, right: 300 };
const KEY = (side: DrawerSide) => `hf-studio-drawer-${side}`;

export const clampWidth = (width: number) =>
  Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, Math.round(width)));

/** The width last left by a drag, or the side's default. */
export function storedWidth(
  side: DrawerSide,
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
): number {
  try {
    const value = Number(storage?.getItem(KEY(side)));
    return value > 0 ? clampWidth(value) : DEFAULT_WIDTH[side];
  } catch {
    return DEFAULT_WIDTH[side];
  }
}

export function storeWidth(
  side: DrawerSide,
  width: number,
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage,
) {
  try {
    storage?.setItem(KEY(side), String(clampWidth(width)));
  } catch {
    /* private mode: the width just isn't remembered */
  }
}

/** The width a drag reaches: dragging toward the preview widens a column. A closed column starts at 0. */
export const dragWidth = (side: DrawerSide, startWidth: number, dx: number) =>
  startWidth + (side === "left" ? dx : -dx);

/** What a drag that ends at `width` does to the column: a short drag is a click, which toggles it. */
export function dragOutcome(
  open: boolean,
  moved: boolean,
  width: number,
): { open: false } | { open: true; width?: number } {
  if (!moved) return open ? { open: false } : { open: true };
  if (width < DRAWER_MIN * 0.7) return { open: false };
  return { open: true, width: clampWidth(width) };
}

/** Whether a drag of a closed column has gone far enough to open it. */
export const opensAt = (width: number) => width > DRAWER_MIN * 0.75;
