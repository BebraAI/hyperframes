import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWaveform } from "./AudioWaveform";

afterEach(() => vi.unstubAllGlobals());

describe("a clip's waveform", () => {
  it("is decoded in the page when the server can't draw it (no ffmpeg in the browser)", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(String(url));
      return String(url).includes("/waveform/")
        ? Response.json({ error: "failed to decode audio" }, { status: 500 })
        : new Response(new ArrayBuffer(8));
    });
    const samples = Float32Array.from({ length: 8000 }, (_, i) => (i === 10 ? -1 : 0.25));
    vi.stubGlobal(
      "AudioContext",
      class {
        decodeAudioData = async () => ({ getChannelData: () => samples });
        close = async () => {};
      },
    );
    const peaks = await loadWaveform(
      "/api/projects/p/preview/assets/music.mp3",
      "/api/projects/p/waveform/assets/music.mp3",
      new AbortController().signal,
    );
    expect(asked).toEqual([
      "/api/projects/p/waveform/assets/music.mp3",
      "/api/projects/p/preview/assets/music.mp3",
    ]);
    expect(peaks).toHaveLength(4000);
    expect(Math.max(...peaks)).toBe(1);
  });
});
