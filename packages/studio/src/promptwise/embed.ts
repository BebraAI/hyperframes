export const embeddedInPromptwise = typeof window !== "undefined" && window.parent !== window;

export function askPromptwiseAgent() {
  window.parent.postMessage({ type: "promptwise:ask-agent" }, "*");
}

/** Where a film opens in promptwise's tab: a second in, where its first shot has arrived, not its empty first frame. */
export function openingTime(duration: number): number {
  return Math.min(1, duration / 2);
}
