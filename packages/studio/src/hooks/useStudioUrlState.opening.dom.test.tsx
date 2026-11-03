// @vitest-environment happy-dom

/** In promptwise's tab a film opens a second in, not on its empty first frame; a time in the link still wins. */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { usePlayerStore } from "../player";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../promptwise/embed", async (original) => ({
  ...(await original<typeof import("../promptwise/embed")>()),
  embeddedInPromptwise: true,
}));

const { useStudioUrlState } = await import("./useStudioUrlState");

function Probe({ duration, currentTime }: { duration: number; currentTime: number | null }) {
  useStudioUrlState({
    projectId: "promo",
    activeCompPath: "index.html",
    duration,
    isPlaying: false,
    compositionLoading: false,
    refreshKey: 0,
    previewIframeRef: { current: null },
    rightPanelTab: "design",
    rightCollapsed: true,
    activeCompPathHydrated: true,
    domEditSelection: null,
    domEditGroupSelections: [],
    applyMarqueeSelection: vi.fn(),
    buildDomSelectionFromTarget: vi.fn(async () => null),
    applyDomSelection: vi.fn(),
    setRightPanelTab: vi.fn(),
    initialState: { currentTime, selection: null } as never,
  });
  return null;
}

function openAt(duration: number, currentTime: number | null) {
  usePlayerStore.getState().clearSeekRequest();
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe duration={duration} currentTime={currentTime} />));
  const seek = usePlayerStore.getState().requestedSeekTime;
  act(() => root.unmount());
  return seek;
}

it("opens a film a second in, a short one halfway, and a link's own time as it is", () => {
  expect(openAt(11.5, null)).toBe(1);
  expect(openAt(1.2, null)).toBe(0.6);
  expect(openAt(11.5, 4.2)).toBe(4.2);
  // The composition's length isn't known yet: wait for it rather than seek to 0.
  expect(openAt(0, null)).toBeNull();
});
