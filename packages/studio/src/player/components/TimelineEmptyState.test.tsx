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
const items = () => [...document.querySelectorAll('[role="menuitem"]')];

it("uploads from the computer or opens the gallery from the empty timeline's drop zone", async () => {
  const onAddFiles = vi.fn();
  const host = mountHost(<TimelineEmptyState {...drop} onFileDrop onAddFiles={onAddFiles} />);

  const zone = host.querySelector<HTMLButtonElement>("button")!;
  expect(zone.textContent).toBe("Drop or upload media, or describe your video to start");
  await act(async () => zone.click());
  expect(items().map((item) => item.querySelector(".text-body-2-medium")?.textContent)).toEqual([
    "From gallery",
    "Upload from computer",
  ]);
  await act(async () => (items()[0] as HTMLElement).click());
  // The gallery opens where the "+" was, not in the Assets panel.
  expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
    "Add media to a new track",
  );
  await act(async () =>
    document.querySelector<HTMLButtonElement>('[role="dialog"] [aria-label="Close"]')!.click(),
  );

  const input = host.querySelector<HTMLInputElement>('[data-testid="new-track-files"]')!;
  const clip = new File(["x"], "clip.mp4", { type: "video/mp4" });
  Object.defineProperty(input, "files", { value: [clip], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(onAddFiles).toHaveBeenCalledWith([clip]);
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
  expect(host.querySelector("button")?.textContent).toContain("Drop or upload media");
});

it("is only a hint where the timeline can't take files", () => {
  const host = mountHost(<TimelineEmptyState {...drop} />);
  expect(host.querySelector("button")).toBeNull();
  expect(host.textContent).toContain("Describe your video to start creating");
});
