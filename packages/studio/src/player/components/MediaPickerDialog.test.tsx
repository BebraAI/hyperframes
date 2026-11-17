// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../../components/ui/mountHost.testHelpers";
import { MediaPickerDialog, mediaLength, pickable } from "./MediaPickerDialog";

vi.mock("../../promptwise/embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../promptwise/embed")>()),
  embeddedInPromptwise: true,
}));

afterEach(cleanupMounted);

const MEDIA = [
  { url: "https://x/a.mp4", name: "Beach", kind: "video", duration: 65 },
  { url: "https://x/b.png", name: "Logo", kind: "image" },
  { url: "https://x/c.mp3", name: "Theme", kind: "audio", duration: 12, account: true },
];

it("adds the picks in the order picked, and closes", async () => {
  const onPick = vi.fn();
  const onClose = vi.fn();
  mountHost(
    <MediaPickerDialog target="track 2" onPick={onPick} onUpload={vi.fn()} onClose={onClose} />,
  );
  await act(async () =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "promptwise:media", items: MEDIA },
        source: window,
      }),
    ),
  );
  const tile = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("[aria-pressed]")].find((b) =>
      b.textContent?.includes(name),
    )!;
  expect(document.body.textContent).toContain("From your other chats");
  await act(async () => tile("Logo").click());
  await act(async () => tile("Beach").click());
  const add = [...document.querySelectorAll("button")].find((b) => b.textContent === "Add 2")!;
  await act(async () => add.click());
  expect(onPick).toHaveBeenCalledWith(["https://x/b.png", "https://x/a.mp4"]);
  expect(onClose).toHaveBeenCalled();
});

it("filters by kind and name, the project's before the account's", () => {
  expect(pickable(MEDIA as never, "audio", "").account.map((m) => m.name)).toEqual(["Theme"]);
  expect(pickable(MEDIA as never, "all", "lo").project.map((m) => m.name)).toEqual(["Logo"]);
  expect(mediaLength(65)).toBe("1:05");
  expect(mediaLength(undefined)).toBeNull();
});
