// @vitest-environment happy-dom

/** Embedded in promptwise the toolbar starts as its own Timeline's does; the rest opens with More. */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../promptwise/embed", async (original) => ({
  ...(await original<typeof import("../promptwise/embed")>()),
  embeddedInPromptwise: true,
}));
vi.mock("../contexts/StudioContext", () => ({
  useStudioShellContextOptional: () => ({
    previewIframeRef: { current: null },
    editHistory: { canUndo: false, canRedo: false },
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
  }),
}));

const { TimelineToolbar } = await import("./TimelineToolbar");

it("shows history, the tool, split and zoom, and the other tools once More is pressed", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<TimelineToolbar onSplitElement={() => {}} />));
  const labels = () =>
    [...host.querySelectorAll("button, input")].map((el) => el.getAttribute("aria-label") ?? "");
  const rare = ["Toggle timeline snapping", "Toggle ripple edit", "Add beat at playhead"];

  expect(labels()).toEqual(
    expect.arrayContaining(["Split at playhead", "Fit timeline to width", "Zoom out", "Zoom in"]),
  );
  for (const label of rare) expect(labels()).not.toContain(label);

  act(() => host.querySelector<HTMLButtonElement>('[aria-label="More tools"]')!.click());
  expect(labels()).toEqual(expect.arrayContaining([...rare, "Fewer tools"]));

  act(() => root.unmount());
  host.remove();
});
