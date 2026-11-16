// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../components/ui/mountHost.testHelpers";
import { TimelineEditProvider } from "../contexts/TimelineEditContext";
import type { TimelineElement } from "../player/store/playerStore";
import { ClipUpload, clipUploadPath, retryUrl } from "./ClipUpload";
import { resetPromptwiseUploads } from "./uploads";

vi.mock("./embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./embed")>()),
  embeddedInPromptwise: true,
}));

afterEach(() => {
  cleanupMounted();
  resetPromptwiseUploads();
  vi.unstubAllGlobals();
});

const SRC = "https://studio.test/d1/api/projects/d1/preview/assets/my%20clip.mp4";
const clip = {
  id: "c1",
  tag: "video",
  start: 0,
  duration: 2,
  track: 0,
  src: SRC,
} as TimelineElement;
const say = (data: object, source: Window) =>
  act(async () => window.dispatchEvent(new MessageEvent("message", { data, source })));

it("finds the clip's file in the project from the preview URL the timeline holds", () => {
  expect(clipUploadPath(SRC)).toBe("assets/my clip.mp4");
  expect(clipUploadPath("https://cdn.test/x.mp4")).toBeNull();
  expect(retryUrl(SRC, "assets/my clip.mp4")).toBe(
    "https://studio.test/d1/api/projects/d1/upload-retry?path=assets%2Fmy%20clip.mp4",
  );
});

it("fills a bar across the clip while its file goes up, and offers Retry and Remove when it fails", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetch);
  const onDeleteElementOnly = vi.fn();
  const host = mountHost(
    <TimelineEditProvider value={{ onDeleteElementOnly }}>
      <ClipUpload el={clip} />
    </TimelineEditProvider>,
  );
  expect(host.textContent).toBe("");

  await say(
    { type: "promptwise:upload-state", path: "assets/my clip.mp4", state: "uploading" },
    window,
  );
  await say(
    {
      type: "promptwise:upload-progress",
      path: "assets/my clip.mp4",
      sent: 30,
      total: 120,
      done: false,
    },
    window.parent,
  );
  expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("25");

  await say(
    { type: "promptwise:upload-state", path: "assets/my clip.mp4", state: "failed" },
    window,
  );
  expect(host.textContent).toBe("Upload failedRetryRemove");
  const [retry, remove] = host.querySelectorAll<HTMLElement>('[role="button"]');
  await act(async () => retry!.click());
  expect(fetch).toHaveBeenCalledWith(
    retryUrl(SRC, "assets/my clip.mp4"),
    expect.objectContaining({ method: "POST" }),
  );
  await act(async () => remove!.click());
  expect(onDeleteElementOnly).toHaveBeenCalledWith(clip);
});
