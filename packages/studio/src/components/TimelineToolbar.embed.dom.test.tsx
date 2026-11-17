// @vitest-environment happy-dom

/** Embedded in promptwise the row keeps what an edit needs; the rarely used toggles are named in More. */
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
const { usePlayerStore } = await import("../player");

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<TimelineToolbar onSplitElement={() => {}} />));
  const labels = () =>
    [...host.querySelectorAll("button, input")].map((el) => el.getAttribute("aria-label") ?? "");
  const unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, labels, unmount };
}

it("keeps editing tools in the row and names the rare toggles in More", async () => {
  const { host, labels, unmount } = mount();
  expect(labels()).toEqual(
    expect.arrayContaining([
      "Split at playhead",
      "Toggle timeline snapping",
      "Toggle ripple edit",
      "Fit timeline to width",
      "Zoom out",
      "Zoom in",
      "More tools",
    ]),
  );
  for (const rare of ["Linked Selection", "Add beat at playhead", "Toggle audio meters"]) {
    expect(labels()).not.toContain(rare);
  }

  act(() => host.querySelector<HTMLButtonElement>('[aria-label="More tools"]')!.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const items = [...document.querySelectorAll('[role="menuitemcheckbox"]')].map(
    (item) => item.textContent,
  );
  expect(items).toEqual([
    "Select video and its sound together",
    "Record edits as keyframes",
    "Thumbnails on clips",
  ]);
  unmount();
});

it("starts with auto-record off, and shows its button only while it is on", () => {
  expect(usePlayerStore.getState().autoKeyframeEnabled).toBe(false);
  const { labels, unmount } = mount();
  const autoRecord = "Auto-record manual edits as keyframes";
  expect(labels()).not.toContain(autoRecord);
  act(() => usePlayerStore.getState().setAutoKeyframeEnabled(true));
  expect(labels()).toContain(autoRecord);
  act(() => usePlayerStore.getState().setAutoKeyframeEnabled(false));
  unmount();
});
