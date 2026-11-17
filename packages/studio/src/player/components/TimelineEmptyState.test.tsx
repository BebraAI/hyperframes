// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../../components/ui/mountHost.testHelpers";
import { TimelineEmptyState } from "./TimelineEmptyState";

vi.mock("../../promptwise/embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../promptwise/embed")>()),
  embeddedInPromptwise: true,
}));

afterEach(cleanupMounted);

const noop = () => {};
const drop = { isDragOver: false, onDragOver: noop, onDragLeave: noop, onDrop: noop };
const button = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === name)!;

it("offers the gallery and an upload as buttons on the empty timeline", async () => {
  const onAddFiles = vi.fn();
  const host = mountHost(<TimelineEmptyState {...drop} onFileDrop onAddFiles={onAddFiles} />);

  expect(host.textContent).toContain("Your timeline is empty");
  await act(async () => button(host, "From gallery").click());
  // The gallery opens where the button was, not in the Assets panel.
  expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
    "Add media to a new track",
  );
  await act(async () =>
    document.querySelector<HTMLButtonElement>('[role="dialog"] [aria-label="Close"]')!.click(),
  );

  const input = host.querySelector<HTMLInputElement>('[data-testid="new-track-files"]')!;
  const pick = vi.spyOn(input, "click");
  await act(async () => button(host, "Upload").click());
  expect(pick).toHaveBeenCalledOnce();
  const clip = new File(["x"], "clip.mp4", { type: "video/mp4" });
  Object.defineProperty(input, "files", { value: [clip], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(onAddFiles).toHaveBeenCalledWith([clip]);
});

it("draws the tracks' skeleton while the composition loads, not the empty state", () => {
  const host = mountHost(<TimelineEmptyState {...drop} onFileDrop onAddFiles={noop} loading />);
  expect(host.querySelector('[aria-label="Loading timeline"]')).not.toBeNull();
  expect(host.textContent).not.toContain("empty");
});

it("shows the upload's progress in the drop zone until the file is in", async () => {
  const host = mountHost(<TimelineEmptyState {...drop} onFileDrop onAddFiles={noop} />);
  const tell = (data: object) =>
    act(async () =>
      window.dispatchEvent(new MessageEvent("message", { data, source: window.parent })),
    );
  const message = { type: "promptwise:upload-progress", path: "assets/photo.png", total: 200 };

  await tell({ ...message, sent: 50 });
  expect(host.textContent).toContain("Uploading photo.png · 25%");
  expect(host.querySelector("button")).toBeNull();
  await tell({ ...message, sent: 200, done: true });
  expect(host.textContent).toContain("Your timeline is empty");
});

it("is only a hint where the timeline can't take files", () => {
  const host = mountHost(<TimelineEmptyState {...drop} />);
  expect(host.querySelector("button")).toBeNull();
  expect(host.textContent).toContain("Describe your video to start creating");
});
