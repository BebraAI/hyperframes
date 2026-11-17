// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockCard } from "./BlocksTab";

vi.mock("../../contexts/StudioContext", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useStudioShellContext: () => ({ activeCompPath: null, compositionDimensions: null }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  document.body.innerHTML = "";
});

function mount(node: React.ReactElement): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(node);
  });
  return host;
}

const card = (media: { posterUrl?: string; videoUrl?: string }) => (
  <BlockCard
    name="confetti"
    title="Confetti"
    description="Confetti burst"
    blockType="hyperframes:component"
    category="vfx"
    {...media}
  />
);

// 64 of the catalog's posters answered 404 on staging, and their cards showed a broken image.
describe("BlockCard thumbnail", () => {
  it("shows the video when the poster won't load", () => {
    const host = mount(
      card({ posterUrl: "https://x.test/p.png", videoUrl: "https://x.test/v.mp4" }),
    );
    act(() => host.querySelector("img")?.dispatchEvent(new Event("error")));
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector("video")?.getAttribute("src")).toBe("https://x.test/v.mp4");
  });

  it("shows the category placeholder when neither loads", () => {
    const host = mount(
      card({ posterUrl: "https://x.test/p.png", videoUrl: "https://x.test/v.mp4" }),
    );
    act(() => host.querySelector("img")?.dispatchEvent(new Event("error")));
    act(() => host.querySelector("video")?.dispatchEvent(new Event("error")));
    expect(host.querySelector("img, video")).toBeNull();
    expect(host.textContent).toContain("VFX");
  });
});
