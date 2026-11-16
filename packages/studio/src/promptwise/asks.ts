import { askPromptwise } from "./embed";

// Studio's "ask the agent" places in promptwise: each opens promptwise's chat with what it's about as a chip, and
// words in its prompt where there are obvious ones. Nothing is sent until the user sends it there.

/** A catalog card: "Add <title> to my composition." waits to be sent. */
export function askAboutBlock(block: {
  name: string;
  title: string;
  description: string;
  category: string;
  webgl: boolean;
  time: number;
}) {
  askPromptwise({
    draft: `Add "${block.title}" to my composition.`,
    context: { kind: "block", ...block },
  });
}

/** A range of the timeline and the clips in it: the user says what to change. */
export function askAboutRange(start: number, end: number, clips: { id: string; label?: string }[]) {
  askPromptwise({
    context: {
      kind: "range",
      start,
      end,
      clips: clips.map((clip) => ({ id: clip.id, label: clip.label ?? clip.id })),
    },
  });
}

/** Lint findings: "Fix these …" waits to be sent. */
export function askToFixLint(
  intro: string,
  findings: { severity: string; message: string; file?: string }[],
) {
  askPromptwise({
    draft: `${intro}.`,
    context: {
      kind: "lint",
      findings: findings.slice(0, 50).map(({ severity, message, file }) => ({
        severity,
        message,
        ...(file ? { file } : {}),
      })),
    },
  });
}
