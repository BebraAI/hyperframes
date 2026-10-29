export const embeddedInPromptwise = typeof window !== "undefined" && window.parent !== window;

export function askPromptwiseAgent() {
  window.parent.postMessage({ type: "promptwise:ask-agent" }, "*");
}
