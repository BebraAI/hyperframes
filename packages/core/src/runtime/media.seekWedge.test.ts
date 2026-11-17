import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEEK_WEDGE_MS, watchForWedgedSeeks } from "./media";

function wedgedVideo(state: { seeking: boolean; networkState: number; readyState: number }) {
  const el = document.createElement("video");
  document.body.appendChild(el);
  for (const key of ["seeking", "networkState", "readyState"] as const)
    Object.defineProperty(el, key, { get: () => state[key], configurable: true });
  let time = 4.1;
  const sent: number[] = [];
  Object.defineProperty(el, "currentTime", {
    get: () => time,
    set: (value: number) => {
      time = value;
      sent.push(value);
    },
    configurable: true,
  });
  watchForWedgedSeeks(el);
  return { el, sent };
}

describe("watchForWedgedSeeks", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("sends a seek that sits pending with nothing loading again, to the time it waits for", () => {
    const state = { seeking: true, networkState: 1, readyState: 1 };
    const { el, sent } = wedgedVideo(state);
    el.dispatchEvent(new Event("seeking"));
    vi.advanceTimersByTime(SEEK_WEDGE_MS - 1);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toBeCloseTo(4.1, 9);
  });

  it("leaves a seek that lands, or one still loading its data", () => {
    const state = { seeking: true, networkState: 2, readyState: 1 };
    const { el, sent } = wedgedVideo(state);
    el.dispatchEvent(new Event("seeking"));
    vi.advanceTimersByTime(SEEK_WEDGE_MS);
    expect(sent).toEqual([]);
    state.seeking = false;
    el.dispatchEvent(new Event("seeked"));
    vi.advanceTimersByTime(10 * SEEK_WEDGE_MS);
    expect(sent).toEqual([]);
  });

  it("waits twice as long before each retry, and stops once the seek lands", () => {
    const state = { seeking: true, networkState: 1, readyState: 1 };
    const { el, sent } = wedgedVideo(state);
    el.dispatchEvent(new Event("seeking"));
    vi.advanceTimersByTime(SEEK_WEDGE_MS);
    // Its own re-sent seek starts a `seeking`, which doesn't reset the pace.
    el.dispatchEvent(new Event("seeking"));
    vi.advanceTimersByTime(2 * SEEK_WEDGE_MS - 1);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sent).toHaveLength(2);
    state.seeking = false;
    el.dispatchEvent(new Event("seeked"));
    vi.advanceTimersByTime(20 * SEEK_WEDGE_MS);
    expect(sent).toHaveLength(2);
  });
});
