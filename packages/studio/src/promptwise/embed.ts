export const embeddedInPromptwise = typeof window !== "undefined" && window.parent !== window;

/** What the user pointed at when they asked promptwise's agent from Studio. */
export type PromptwiseAskContext =
  | {
      kind: "element";
      handle: string;
      file: string;
      label: string;
      tag: string;
      time: number;
      markup?: string;
    }
  | {
      kind: "block";
      name: string;
      title: string;
      description: string;
      category: string;
      webgl: boolean;
      time: number;
    }
  | { kind: "range"; start: number; end: number; clips: { id: string; label: string }[] }
  | {
      kind: "lint";
      findings: { code?: string; severity: string; message: string; file?: string }[];
    }
  /** An animation of the element selected in Studio. */
  | { kind: "animation"; animationId: string; summary: string };

/** promptwise's agent is its chat's: the request goes to its page, which sends it with what it's about. */
export const PROMPTWISE_AGENT = "Wisey";

/**
 * Asks promptwise's agent instead of copying a prompt for an outside one: with `instruction` the page
 * sends it at once; without, it opens its chat with the context waiting for the user's words, and
 * `draft` in its prompt for the user to send or change.
 */
export function askPromptwise(
  ask: { instruction?: string; draft?: string; context?: PromptwiseAskContext } = {},
) {
  window.parent.postMessage({ type: "promptwise:ask-agent", ...ask }, "*");
}

export function askPromptwiseAgent() {
  askPromptwise();
}

/** Where a film opens in promptwise's tab: a second in, where its first shot has arrived, not its empty first frame. */
export function openingTime(duration: number): number {
  return Math.min(1, duration / 2);
}

/** What promptwise puts on an image, video or sound dragged out of its chat: a JSON list of `{ url }`. */
export const PROMPTWISE_ASSET_MIME = "application/x-bebra-asset";

/** The http(s) URLs of the files a promptwise drag carries, in order; none for anything else. */
export function promptwiseAssetUrls(payload: string): string[] {
  try {
    const assets: unknown = JSON.parse(payload);
    if (!Array.isArray(assets)) return [];
    return assets.flatMap((asset: unknown) => {
      const url =
        typeof asset === "object" && asset !== null ? (asset as { url?: unknown }).url : null;
      return typeof url === "string" && /^https?:\/\//.test(url) ? [url] : [];
    });
  } catch {
    return [];
  }
}
