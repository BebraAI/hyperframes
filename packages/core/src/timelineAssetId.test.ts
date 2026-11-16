import { describe, expect, it } from "vitest";
import {
  buildTimelineAssetId,
  replacementTimelineAssetId,
  timelineIdFromName,
} from "./timelineAssetId";

describe("timeline asset ids", () => {
  it("trims a long underscore prefix and suffix", () => {
    const padding = "_".repeat(20000);
    expect(buildTimelineAssetId(`assets/${padding}harbor${padding}.mp4`, [])).toBe("harbor");
  });

  it("mints the fallback when normalization leaves no name", () => {
    expect(buildTimelineAssetId("assets/____.mp4", ["video", "video_2"])).toBe("video_3");
    expect(buildTimelineAssetId("assets/____.bin", ["asset"])).toBe("asset_2");
  });

  it("never starts an id with a digit, which a #id selector can't take", () => {
    expect(buildTimelineAssetId("assets/2024 beach.mp4", [])).toBe("clip_2024_beach");
    expect(() =>
      document.querySelector(`#${buildTimelineAssetId("assets/9.mp4", [])}`),
    ).not.toThrow();
  });

  it("names a clip by its kind when its file is named by a UUID or a hash", () => {
    expect(
      buildTimelineAssetId("https://media.test/t/02d44e15-7a1b-4c3d-9e8f-0123456789ab.mp4", []),
    ).toBe("video");
    expect(buildTimelineAssetId(`assets/${"a3".repeat(20)}.wav`, ["audio"])).toBe("audio_2");
  });

  it("makes an id from a title the user reads", () => {
    expect(timelineIdFromName("Beach shot v1.2", [])).toBe("beach_shot_v1_2");
    expect(timelineIdFromName("3 seconds", [])).toBe("clip_3_seconds");
  });

  it("renames a dropped clip whose src is URL-encoded, from the decoded names", () => {
    const document = new DOMParser().parseFromString(
      '<video id="my_clip" src="assets/my%20clip.mp4"></video>',
      "text/html",
    );
    const video = document.querySelector("video")!;
    expect(replacementTimelineAssetId(document, video, "assets/new%20take.mp4")).toBe("new_take");
  });
});
