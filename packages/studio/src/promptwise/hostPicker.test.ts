import { afterEach, expect, it, vi } from "vitest";
import { hearFromHost, pickInHost, resetHostPicker } from "./hostPicker";
import { promptwiseMediaName } from "./media";

afterEach(resetHostPicker);

it("asks the tab for its Assets window and hands the picks back, in order, to the + that asked", async () => {
  const post = vi.fn();
  const picked = pickInHost("track 2", post);
  const ask = post.mock.calls[0]![0] as { type: string; id: string; target: string };
  expect(ask).toMatchObject({ type: "promptwise:pick-media", target: "track 2" });

  hearFromHost({
    type: "promptwise:media-picked",
    id: ask.id,
    media: [
      { url: "https://r2.test/b.mp4", kind: "video", name: "Beach.mp4" },
      { url: "https://r2.test/a.png", kind: "image", name: "Logo" },
      { url: "javascript:alert(1)", kind: "image", name: "bad" },
    ],
  });
  const { media, files } = await picked;
  expect(media.map((m) => m.url)).toEqual(["https://r2.test/b.mp4", "https://r2.test/a.png"]);
  expect(files).toEqual([]);
  expect(promptwiseMediaName("https://r2.test/b.mp4")).toBe("Beach");
});

it("takes files the user uploaded from the window, and nothing when it was closed", async () => {
  const post = vi.fn();
  const first = pickInHost("a new track", post);
  const clip = new File(["x"], "clip.mp4", { type: "video/mp4" });
  hearFromHost({
    type: "promptwise:media-picked",
    id: post.mock.calls[0]![0].id,
    files: [clip, "not a file"],
  });
  expect((await first).files).toEqual([clip]);

  const second = pickInHost("a new track", post);
  hearFromHost({ type: "promptwise:media-picked", id: post.mock.calls[1]![0].id });
  expect(await second).toEqual({ media: [], files: [] });
});
