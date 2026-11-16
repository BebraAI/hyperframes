import { describe, expect, it } from "vitest";
import {
  DRAWER_MAX,
  DRAWER_MIN,
  dragOutcome,
  dragWidth,
  opensAt,
  storeWidth,
  storedWidth,
} from "./sideDrawer";

describe("side drawers", () => {
  it("widens a column dragged toward the preview, from either side", () => {
    expect(dragWidth("left", 260, 40)).toBe(300);
    expect(dragWidth("right", 300, 40)).toBe(260);
    expect(dragWidth("right", 0, -250)).toBe(250);
  });

  it("toggles on a click, closes when dragged far in, and keeps a dragged width within bounds", () => {
    expect(dragOutcome(true, false, 300)).toEqual({ open: false });
    expect(dragOutcome(false, false, 0)).toEqual({ open: true });
    expect(dragOutcome(true, true, DRAWER_MIN * 0.6)).toEqual({ open: false });
    expect(dragOutcome(true, true, 330.4)).toEqual({ open: true, width: 330 });
    expect(dragOutcome(true, true, 900)).toEqual({ open: true, width: DRAWER_MAX });
    expect(dragOutcome(false, true, DRAWER_MIN * 0.72)).toEqual({ open: true, width: DRAWER_MIN });
  });

  it("opens a closed column once it is dragged out far enough", () => {
    expect(opensAt(DRAWER_MIN * 0.5)).toBe(false);
    expect(opensAt(DRAWER_MIN * 0.8)).toBe(true);
  });

  it("remembers each side's width, and falls back to its default", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    expect([storedWidth("left", storage), storedWidth("right", storage)]).toEqual([260, 300]);
    storeWidth("left", 333.7, storage);
    storeWidth("right", 9999, storage);
    expect([storedWidth("left", storage), storedWidth("right", storage)]).toEqual([
      334,
      DRAWER_MAX,
    ]);
  });
});
