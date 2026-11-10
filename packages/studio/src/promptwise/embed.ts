export const embeddedInPromptwise = typeof window !== "undefined" && window.parent !== window;

export function askPromptwiseAgent() {
  window.parent.postMessage({ type: "promptwise:ask-agent" }, "*");
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
