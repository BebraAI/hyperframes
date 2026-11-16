// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../../components/ui/mountHost.testHelpers";
import { useDockLayoutStore } from "../../components/dock/dockLayoutStore";
import { NewTrackAdd } from "./NewTrackAdd";

vi.mock("../../promptwise/embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../promptwise/embed")>()),
  embeddedInPromptwise: true,
}));

afterEach(cleanupMounted);

const items = () => [...document.querySelectorAll('[role="menuitem"]')];

it("adds files from the computer, or opens the project's media, from the empty lane's +", async () => {
  const onFiles = vi.fn();
  const activatePanel = vi.fn();
  useDockLayoutStore.setState({ activatePanel });
  const host = mountHost(<NewTrackAdd onFiles={onFiles} />);

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Add media"]')!.click());
  expect(items().map((item) => item.textContent)).toEqual(["From gallery", "Upload from computer"]);
  await act(async () => (items()[0] as HTMLElement).click());
  expect(activatePanel).toHaveBeenCalledWith("assets");

  const input = host.querySelector<HTMLInputElement>('[data-testid="new-track-files"]')!;
  const clip = new File(["x"], "clip.mp4", { type: "video/mp4" });
  Object.defineProperty(input, "files", { value: [clip], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(onFiles).toHaveBeenCalledWith([clip]);
});
