// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../components/ui/mountHost.testHelpers";
import { usePlayerStore } from "../player/store/playerStore";
import {
  GhostLaneText,
  resetPromptwiseUploads,
  uploadProgress,
  usePromptwiseUploadMap,
} from "./uploads";

vi.mock("./embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./embed")>()),
  embeddedInPromptwise: true,
}));

afterEach(() => {
  cleanupMounted();
  resetPromptwiseUploads();
});

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
  const host = mountHost(<GhostLaneText acceptsMediaDrop />);
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

it("leaves out a file whose clip is already on the timeline: the clip shows its own bar", async () => {
  const host = mountHost(<GhostLaneText acceptsMediaDrop />);
  await tell(progress("assets/clip.mp4", 50, 200));
  expect(host.textContent).toBe("Uploading clip.mp4 · 25%");
  await act(async () =>
    usePlayerStore.getState().setElements([
      {
        id: "clip",
        tag: "video",
        start: 0,
        duration: 3,
        track: 0,
        src: "/api/projects/p/preview/assets/clip.mp4",
      },
    ]),
  );
  expect(host.textContent).toBe("Drop media here");
  await act(async () => usePlayerStore.getState().setElements([]));
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

// The worker is this page's own: it tells the page, which posts to itself.
const worker = (path: string, state: string) =>
  act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "promptwise:upload-state", path, state },
        source: window,
      }),
    ),
  );

function Uploads() {
  const map = usePromptwiseUploadMap();
  return (
    <>
      {[...map]
        .map(([path, u]) => `${path}:${u.failed ? "failed" : `${u.sent}/${u.total}`}`)
        .join(",")}
    </>
  );
}

it("keeps a file that failed to go up, whichever word comes first, until the worker has it", async () => {
  const host = mountHost(<Uploads />);
  await worker("clip.mp4", "uploading");
  await tell(progress("clip.mp4", 40, 100));
  expect(host.textContent).toBe("clip.mp4:40/100");
  // The tab is done with it before the worker says it failed.
  await tell(progress("clip.mp4", 100, 100, true));
  await worker("clip.mp4", "failed");
  expect(host.textContent).toBe("clip.mp4:failed");
  await worker("clip.mp4", "uploading");
  await worker("clip.mp4", "done");
  expect(host.textContent).toBe("");
});

it("says the empty lane takes a click too where it adds media", () => {
  const host = mountHost(<GhostLaneText acceptsMediaDrop clickToAdd />);
  expect(host.textContent).toBe("Drop media here, or click to add");
});
