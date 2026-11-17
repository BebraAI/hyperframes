// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../../components/ui/mountHost.testHelpers";
import { NewTrackAdd, TrackAddButton, trackEnd } from "./NewTrackAdd";
import { hearFromHost, resetHostPicker } from "../../promptwise/hostPicker";

vi.mock("../../promptwise/embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../promptwise/embed")>()),
  embeddedInPromptwise: true,
}));

afterEach(() => {
  cleanupMounted();
  resetHostPicker();
});

const items = () => [...document.querySelectorAll('[role="menuitem"]')];

it("adds files from the computer, or opens the project's media, from the empty lane's +", async () => {
  const onFiles = vi.fn();
  const host = mountHost(<NewTrackAdd onAdd={onFiles} />);

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Add media"]')!.click());
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
  expect(onFiles).toHaveBeenCalledWith([clip]);
});

it("opens the same choices from a track's own +, which names its track", async () => {
  const onFiles = vi.fn();
  const host = mountHost(<TrackAddButton onAdd={onFiles} trackName="track 2" />);
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Add media to track 2"]')!.click(),
  );
  expect(items().map((item) => item.querySelector(".text-body-2-medium")?.textContent)).toEqual([
    "From gallery",
    "Upload from computer",
  ]);
});

it("adds after a track's last clip, and from 0 on an empty one", () => {
  expect(
    trackEnd([
      { start: 4, duration: 2 },
      { start: 0, duration: 3 },
    ]),
  ).toBe(6);
  expect(trackEnd([])).toBe(0);
});

it("opens the tab's own Assets window from a track's + where the tab has one, and places its picks there", async () => {
  const onAdd = vi.fn();
  const post = vi.spyOn(window.parent, "postMessage");
  const host = mountHost(<TrackAddButton onAdd={onAdd} trackName="track 2" />);
  await act(async () => hearFromHost({ type: "promptwise:media", items: [], picker: true }));

  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="Add media to track 2"]')!.click(),
  );
  // No menu: the window has Upload too.
  expect(items()).toHaveLength(0);
  const ask = post.mock.calls
    .map(([m]) => m as { type?: string; id?: string; target?: string })
    .find((m) => m.type === "promptwise:pick-media")!;
  expect(ask.target).toBe("track 2");

  await act(async () =>
    hearFromHost({
      type: "promptwise:media-picked",
      id: ask.id,
      media: [
        { url: "https://r2.test/b.png", kind: "image", name: "B" },
        { url: "https://r2.test/a.png", kind: "image", name: "A" },
      ],
    }),
  );
  expect(onAdd).toHaveBeenCalledWith(["https://r2.test/b.png", "https://r2.test/a.png"]);
  post.mockRestore();
});
