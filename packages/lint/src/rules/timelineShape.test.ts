import { describe, expect, it } from "vitest";
import { lintHyperframeHtml } from "../hyperframeLinter.js";

function composition(body: string, duration = 10, script = ""): string {
  return `
<html><body>
  <div id="root" data-composition-id="c1" data-width="1920" data-height="1080" data-duration="${duration}">
    ${body}
  </div>
  <script>window.__timelines = {};${script}</script>
</body></html>`;
}

const video = (id: string, start: number, duration: number, track = 0) =>
  `<video id="${id}" class="clip" src="${id}.mp4" muted data-start="${start}" data-duration="${duration}" data-track-index="${track}"></video>`;

async function shape(html: string) {
  const result = await lintHyperframeHtml(html);
  return result.findings.filter((f) =>
    ["root_duration_past_last_clip", "main_track_gap", "empty_clip_spans_composition"].includes(
      f.code,
    ),
  );
}

describe("timeline shape rules", () => {
  it("a back-to-back edit as long as its clips is clean", async () => {
    expect(await shape(composition(video("a", 0, 4) + video("b", 4, 6)))).toEqual([]);
  });

  it("warns when the video runs on past its last clip", async () => {
    const [finding] = await shape(composition(video("a", 0, 4) + video("b", 4, 3.6), 67));
    expect(finding).toMatchObject({ code: "root_duration_past_last_clip", severity: "warning" });
    expect(finding!.message).toContain("last clip ends at 7.6s");
    expect(finding!.fixHint).toContain("to 7.6");
  });

  it("warns about a hole in the main track, and not about one on another track", async () => {
    const findings = await shape(
      composition(
        video("a", 0, 3) + video("b", 5, 5) + video("over", 0, 1, 2) + video("x", 6, 1, 2),
      ),
    );
    expect(findings.map((f) => [f.code, f.elementId])).toEqual([["main_track_gap", "b"]]);
    expect(findings[0]!.message).toContain("2s hole");
  });

  it("warns about an empty clip over the whole video, unless something styles or animates it", async () => {
    const dip =
      '<div id="cut-dip" class="clip" data-start="0" data-duration="10" data-track-index="3"></div>';
    expect((await shape(composition(video("a", 0, 10) + dip))).map((f) => f.code)).toEqual([
      "empty_clip_spans_composition",
    ]);
    const animated = composition(
      video("a", 0, 10) + dip,
      10,
      'gsap.to("#cut-dip", { opacity: 1 });',
    );
    expect(await shape(animated)).toEqual([]);
    const titled = dip.replace("></div>", ">QA TEST</div>");
    expect(await shape(composition(video("a", 0, 10) + titled))).toEqual([]);
  });
});
