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

const drop = { onDragOver: () => {}, onDragLeave: () => {}, onDrop: () => {} };

it("offers the + on a timeline with no clips yet, and shows a file going up there", async () => {
  const host = mountHost(
    <TimelineEmptyState isDragOver={false} onFileDrop onAddFiles={() => {}} {...drop} />,
  );
  expect(host.querySelector('[aria-label="Add media"]')).not.toBeNull();
  expect(host.textContent).toContain("Drop media here or describe your video to start");

  await act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "promptwise:upload-progress",
          path: "clip.mp4",
          sent: 1,
          total: 4,
          done: false,
        },
        source: window.parent,
      }),
    ),
  );
  expect(host.textContent).toContain("Uploading clip.mp4 · 25%");
});

it("has no + where the timeline takes no files", () => {
  const host = mountHost(<TimelineEmptyState isDragOver={false} {...drop} />);
  expect(host.querySelector('[aria-label="Add media"]')).toBeNull();
  expect(host.textContent).toContain("Describe your video to start creating");
});
