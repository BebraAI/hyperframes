// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptwiseMediaView } from "../components/sidebar/PromptwiseMediaView";
import { cleanupMounted, mountHost } from "../components/ui/mountHost.testHelpers";
import { promptwiseMedia, promptwiseMediaName, usePromptwiseMedia } from "./media";

vi.mock("./embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./embed")>()),
  embeddedInPromptwise: true,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanupMounted();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const items = [
  { url: "https://media.test/a.png", name: "Bottle", kind: "image" },
  {
    url: "https://media.test/b.mp4",
    name: "Shot",
    kind: "video",
    thumb: "https://media.test/b.jpg",
  },
  { url: "https://media.test/c.mp3", name: "Music", kind: "audio" },
];

describe("promptwise media", () => {
  it("takes the project's media from promptwise's message, and nothing else", () => {
    expect(
      promptwiseMedia({
        type: "promptwise:media",
        items: [
          ...items,
          { url: "javascript:alert(1)", kind: "image" },
          { url: "https://x.test/f.pdf", kind: "file" },
          { url: "https://x.test/n.png", kind: "image", thumb: "data:x" },
        ],
      }),
    ).toEqual([...items, { url: "https://x.test/n.png", name: "image", kind: "image" }]);
    expect(promptwiseMedia({ type: "promptwise:state" })).toBeNull();
  });

  it("asks promptwise for them once Studio is up, and keeps what it sends", () => {
    const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    let seen: unknown = undefined;
    function Harness() {
      seen = usePromptwiseMedia();
      return null;
    }
    const host = document.body.appendChild(document.createElement("div"));
    act(() => createRoot(host).render(<Harness />));
    expect(post).toHaveBeenCalledWith({ type: "promptwise:media-request" }, "*");
    expect(seen).toEqual([]);
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "promptwise:media", items },
          source: window.parent,
        }),
      ),
    );
    expect(seen).toEqual(items);
  });

  it("drags a file onto the timeline as promptwise's chat does, or adds it at the playhead", () => {
    const added: string[] = [];
    const host = mountHost(
      <PromptwiseMediaView
        media={promptwiseMedia({ type: "promptwise:media", items })!}
        searchQuery=""
        onAdd={(url) => added.push(url)}
      />,
    );
    const cards = [...host.querySelectorAll<HTMLButtonElement>("[data-promptwise-media]")];
    expect(cards.map((c) => c.dataset.promptwiseMedia)).toEqual(["image", "video", "audio"]);
    expect(host.querySelector("img[src='https://media.test/b.jpg']")).not.toBeNull();

    const data = new Map<string, string>();
    const drag = new Event("dragstart", { bubbles: true }) as DragEvent;
    Object.defineProperty(drag, "dataTransfer", {
      value: { setData: (k: string, v: string) => data.set(k, v), effectAllowed: "" },
    });
    act(() => cards[1]!.dispatchEvent(drag));
    expect(JSON.parse(data.get("application/x-bebra-asset")!)).toEqual([
      { url: "https://media.test/b.mp4" },
    ]);

    act(() => cards[0]!.click());
    expect(added).toEqual(["https://media.test/a.png"]);
  });

  it("filters by name", () => {
    const host = mountHost(
      <PromptwiseMediaView
        media={promptwiseMedia({ type: "promptwise:media", items })!}
        searchQuery="mus"
      />,
    );
    expect([...host.querySelectorAll("[data-promptwise-media]")].map((c) => c.textContent)).toEqual(
      ["SoundMusic"],
    );
  });
});

describe("promptwise media names", () => {
  it("names a clip placed from promptwise's media after its title, not its UUID file", () => {
    promptwiseMedia({
      type: "promptwise:media",
      items: [
        { url: "https://media.test/02d44e15.mp4", name: "Beach take.mov", kind: "video" },
        { url: "https://media.test/untitled.mp3", kind: "audio" },
      ],
    });
    expect(promptwiseMediaName("https://media.test/02d44e15.mp4")).toBe("Beach take");
    expect(promptwiseMediaName("https://media.test/untitled.mp3")).toBeUndefined();
  });
});
