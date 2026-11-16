import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { probeMediaFile } from "./mediaProbe";

const fixture = (name: string) =>
  new File(
    [readFileSync(new URL(`../../../tests/e2e/fixtures/${name}`, import.meta.url))],
    "clip.mp4",
    {
      type: "video/mp4",
    },
  );

describe("probeMediaFile", () => {
  it("reads a dropped clip's length and sound where it is, before it's uploaded", async () => {
    const probe = await probeMediaFile(fixture("aroll-backdrop/assets/aroll.mp4"));
    expect(probe?.duration).toBeCloseTo(2, 1);
    expect([probe?.hasVideo, probe?.hasAudio]).toEqual([true, true]);
  });

  it("gives nothing for a file it can't read, and leaves no failure behind", async () => {
    expect(
      await probeMediaFile(new File(["not a clip"], "clip.mp4", { type: "video/mp4" })),
    ).toBeNull();
  });
});
