import { useSyncExternalStore } from "react";
import { embeddedInPromptwise } from "./embed";
import { promptwiseMedia, type PromptwiseMedia } from "./media";

/**
 * promptwise's own Assets window, opened by the tab for Studio's "Add media": the same shelves the chat's "+" has
 * (This chat, Uploads, Generations, Projects, All assets), rather than Studio's copy of them. The tab says it can in
 * its promptwise:media message (`picker: true`); an older tab doesn't, and Studio keeps its own gallery there.
 */

/** What the window handed back: the picks in the order picked, or files from the computer; neither when closed. */
interface HostPick {
  media: PromptwiseMedia[];
  files: File[];
}

let canPick = false;
const listeners = new Set<() => void>();
const waiting = new Map<string, (pick: HostPick) => void>();
let nextId = 1;

/** Takes in one message from the tab: its say-so for the window, or the window's answer to a "+". */
export function hearFromHost(data: unknown) {
  const d = (data ?? {}) as {
    type?: unknown;
    picker?: unknown;
    id?: unknown;
    media?: unknown;
    files?: unknown;
  };
  if (d.type === "promptwise:media" && d.picker === true && !canPick) {
    canPick = true;
    listeners.forEach((listener) => listener());
  }
  if (d.type !== "promptwise:media-picked" || typeof d.id !== "string") return;
  const done = waiting.get(d.id);
  waiting.delete(d.id);
  done?.({
    // Parsed as the media message is, so a clip placed from a pick is named as promptwise names it.
    media: promptwiseMedia({ type: "promptwise:media", items: d.media }) ?? [],
    files: Array.isArray(d.files) ? d.files.filter((f): f is File => f instanceof File) : [],
  });
}

if (embeddedInPromptwise && typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source === window.parent) hearFromHost(event.data);
  });
  // The tab answers with its media message, which carries the say-so, even before the Assets panel asks.
  window.parent.postMessage({ type: "promptwise:media-request" }, "*");
}

/** Whether the tab opens its own Assets window for "Add media". */
export function useHostPicker(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => canPick,
    () => false,
  );
}

/** Asks the tab to open its Assets window for `target` ("track 2"); resolves with what the user picked there. */
export function pickInHost(
  target: string,
  post = (message: object) => window.parent.postMessage(message, "*"),
) {
  const id = `pick-${nextId++}`;
  return new Promise<HostPick>((resolve) => {
    waiting.set(id, resolve);
    post({ type: "promptwise:pick-media", id, target });
  });
}

/** Forgets the tab's say-so: for tests. */
export function resetHostPicker() {
  canPick = false;
  waiting.clear();
  listeners.forEach((listener) => listener());
}
