import { askPromptwise } from "./embed";

/** A catalog card's Ask in promptwise: the chat opens with the block and "Add <title>…" waiting to be sent. */
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
