/** True when Studio runs inside promptwise's Timeline tab. */
export const embedded = window.parent !== window;

/** Asks promptwise to focus its chat, so the user can describe a change to the agent. */
export function askAgent() {
  window.parent.postMessage({ type: "promptwise:ask-agent" }, "*");
}
