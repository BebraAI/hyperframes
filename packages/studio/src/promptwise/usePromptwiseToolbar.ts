import { useEffect, useRef } from "react";
import { embeddedInPromptwise } from "./embed";

export type PromptwiseCommand = "inspector" | "export" | "undo" | "redo";

export interface PromptwiseToolbarState {
  inspectorOpen: boolean;
  rendering: boolean;
}

function isCommand(value: unknown): value is PromptwiseCommand {
  return value === "inspector" || value === "export" || value === "undo" || value === "redo";
}

/**
 * Embedded in promptwise, Studio draws no header: the Timeline tab's toolbar carries Inspector and
 * Export. It sends their presses as promptwise:command messages, and Studio sends back their state.
 * Undo and redo come the same way: Cmd+Z pressed while the keyboard is in promptwise's own page, not
 * in this frame, would otherwise never reach Studio.
 */
export function usePromptwiseToolbar(
  state: PromptwiseToolbarState,
  commands: Record<PromptwiseCommand, () => void>,
) {
  const latest = useRef(commands);
  latest.current = commands;

  useEffect(() => {
    if (!embeddedInPromptwise) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const { type, command } = data as { type?: unknown; command?: unknown };
      if (type === "promptwise:command" && isCommand(command)) latest.current[command]();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const { inspectorOpen, rendering } = state;
  useEffect(() => {
    if (!embeddedInPromptwise) return;
    window.parent.postMessage({ type: "promptwise:state", inspectorOpen, rendering }, "*");
  }, [inspectorOpen, rendering]);
}
