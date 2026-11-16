import type { LintContext, HyperframeLintFinding, OpenTag } from "../context";
import { readAttr, truncateSnippet } from "../utils";

// The shape of the root timeline as the user sees it in Studio: a length past the last clip, a
// hole in the main track, a clip that spans the video and shows nothing. Each renders, so each is
// a warning; each is what an edit looks like when it went wrong (a ripple that left a gap, a
// duration that wasn't brought in after a cut, a transition placed over the whole video).

/** Seconds below which a gap or an overshoot is rounding, not an edit. */
const TOLERANCE_S = 0.1;
/** A clip that covers this much of the video counts as spanning it. */
const SPAN_SHARE = 0.9;
const MEDIA_TAGS = new Set(["video", "img", "audio"]);
const VISUAL_MEDIA_TAGS = new Set(["video", "img"]);

type TimedClip = { tag: OpenTag; id: string | null; start: number; end: number; track: number };

const isClip = (tag: OpenTag) =>
  /(?:^|\s)clip(?:\s|$)/.test(readAttr(tag.raw, "class") ?? "") && tag.name !== "template";

function timedClips(tags: OpenTag[], rootTag: OpenTag): TimedClip[] {
  const clips: TimedClip[] = [];
  for (const tag of tags) {
    if (tag === rootTag || !isClip(tag)) continue;
    const start = Number(readAttr(tag.raw, "data-start"));
    const duration = Number(readAttr(tag.raw, "data-duration"));
    if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) continue;
    const track = Number(readAttr(tag.raw, "data-track-index") ?? 0);
    clips.push({
      tag,
      id: readAttr(tag.raw, "id"),
      start,
      end: start + duration,
      track: Number.isFinite(track) ? track : 0,
    });
  }
  return clips;
}

/** Whether every clip of the root has a known end, so the last end is the video's real end. */
function allClipsTimed(tags: OpenTag[], rootTag: OpenTag, clips: TimedClip[]): boolean {
  const clipTags = tags.filter((tag) => tag !== rootTag && isClip(tag));
  return clipTags.length > 0 && clipTags.length === clips.length;
}

const seconds = (n: number) => `${Math.round(n * 100) / 100}s`;

function rootLengthFindings(ctx: LintContext, clips: TimedClip[]): HyperframeLintFinding[] {
  const { rootTag, tags } = ctx;
  if (!rootTag) return [];
  const length = Number(readAttr(rootTag.raw, "data-duration"));
  if (!Number.isFinite(length) || length <= 0 || !allClipsTimed(tags, rootTag, clips)) return [];
  const lastEnd = Math.max(...clips.map((clip) => clip.end));
  if (length - lastEnd <= TOLERANCE_S) return [];
  return [
    {
      code: "root_duration_past_last_clip",
      severity: "warning",
      message:
        `The composition is ${seconds(length)} long but its last clip ends at ${seconds(lastEnd)}, ` +
        `so the video ends on ${seconds(length - lastEnd)} of nothing and the timeline shows the old length.`,
      fixHint: `Set the root's data-duration to ${seconds(lastEnd).slice(0, -1)}, the end of its last clip.`,
      snippet: truncateSnippet(rootTag.raw),
    },
  ];
}

function mainTrackGapFindings(clips: TimedClip[]): HyperframeLintFinding[] {
  const main = clips
    .filter((clip) => clip.track === 0 && VISUAL_MEDIA_TAGS.has(clip.tag.name))
    .sort((a, b) => a.start - b.start);
  const findings: HyperframeLintFinding[] = [];
  let reach = main[0]?.end ?? 0;
  for (const clip of main.slice(1)) {
    if (clip.start - reach > TOLERANCE_S) {
      findings.push({
        code: "main_track_gap",
        severity: "warning",
        message:
          `The main track has a ${seconds(clip.start - reach)} hole before ${clip.id ? `#${clip.id}` : "a clip"} ` +
          `(from ${seconds(reach)} to ${seconds(clip.start)}): the video goes black there.`,
        elementId: clip.id ?? undefined,
        fixHint:
          "Move the clip back to where the one before it ends, or close the gap with a ripple delete or trim.",
        snippet: truncateSnippet(clip.tag.raw),
      });
    }
    reach = Math.max(reach, clip.end);
  }
  return findings;
}

/** What's between a clip's open and close tags, without markup and whitespace. */
function innerContent(source: string, tag: OpenTag): string {
  if (tag.closeIndex == null) return "";
  return source.slice(tag.index + tag.raw.length, tag.closeIndex);
}

function referencedElsewhere(ctx: LintContext, id: string): boolean {
  const code = [...ctx.scripts, ...ctx.styles].map((block) => block.content).join("\n");
  return code.includes(id);
}

function emptySpanningClipFindings(ctx: LintContext, clips: TimedClip[]): HyperframeLintFinding[] {
  const { rootTag, source } = ctx;
  if (!rootTag) return [];
  const length = Number(readAttr(rootTag.raw, "data-duration"));
  if (!Number.isFinite(length) || length <= 0) return [];
  return clips
    .filter(
      (clip) => !MEDIA_TAGS.has(clip.tag.name) && clip.end - clip.start >= length * SPAN_SHARE,
    )
    .filter((clip) => {
      const inner = innerContent(source, clip.tag);
      const style = readAttr(clip.tag.raw, "style") ?? "";
      const paints = /background|border|box-shadow|outline/i.test(style);
      const hasContent = /<[a-z]/i.test(inner) || inner.replace(/<[^>]*>/g, "").trim() !== "";
      return !hasContent && !paints && !(clip.id && referencedElsewhere(ctx, clip.id));
    })
    .map((clip) => ({
      code: "empty_clip_spans_composition",
      severity: "warning" as const,
      message:
        `${clip.id ? `#${clip.id}` : "A clip"} spans ${seconds(clip.start)} to ${seconds(clip.end)} of the ` +
        `${seconds(length)} video but holds nothing and nothing styles or animates it: it shows as a clip and does nothing.`,
      elementId: clip.id ?? undefined,
      fixHint:
        "Delete it, or give it what it was meant to show (a transition belongs at a cut, not over the whole video).",
      snippet: truncateSnippet(clip.tag.raw),
    }));
}

export const timelineShapeRules: Array<(ctx: LintContext) => HyperframeLintFinding[]> = [
  (ctx) => {
    if (ctx.options.isSubComposition || !ctx.rootTag) return [];
    const clips = timedClips(ctx.tags, ctx.rootTag);
    return [
      ...rootLengthFindings(ctx, clips),
      ...mainTrackGapFindings(clips),
      ...emptySpanningClipFindings(ctx, clips),
    ];
  },
];
