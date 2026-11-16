// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../components/ui/mountHost.testHelpers";
import { UploadStatus, uploadProgress } from "./uploads";

vi.mock("./embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./embed")>()),
  embeddedInPromptwise: true,
}));

afterEach(cleanupMounted);

// promptwise is this page's parent; in the test the page is its own.
const tell = (data: object) =>
  act(async () =>
    window.dispatchEvent(new MessageEvent("message", { data, source: window.parent })),
  );
const progress = (path: string, sent: number, total: number, done = false) => ({
  type: "promptwise:upload-progress",
  path,
  sent,
  total,
  done,
});

it("shows what is uploading and how much is up, then the drop hint again once it's in", async () => {
  const host = mountHost(<UploadStatus idle="Drop media here" />);
  expect(host.textContent).toBe("Drop media here");

  await tell(progress("assets/photo.png", 0, 200));
  expect(host.textContent).toBe("Uploading photo.png · 0%");
  await tell(progress("assets/photo.png", 50, 200));
  await tell(progress("clip.mp4", 150, 200));
  expect(host.textContent).toBe("Uploading 2 files · 50%");
  expect(host.querySelector<HTMLElement>("[aria-hidden]")!.style.width).toBe("50%");

  await tell(progress("assets/photo.png", 200, 200, true));
  expect(host.textContent).toBe("Uploading clip.mp4 · 75%");
  await tell(progress("clip.mp4", 200, 200, true));
  expect(host.textContent).toBe("Drop media here");
});

it("takes only promptwise's upload messages", () => {
  expect(uploadProgress(progress("a.png", 1, 2))).toEqual({
    path: "a.png",
    sent: 1,
    total: 2,
    done: false,
  });
  expect(uploadProgress({ type: "promptwise:upload-progress", path: "a.png" })).toBeNull();
  expect(uploadProgress({ type: "promptwise:media", path: "a.png", sent: 1, total: 2 })).toBeNull();
  expect(uploadProgress(null)).toBeNull();
});
