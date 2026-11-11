import { useEffect, useRef } from "react";
import { embeddedInPromptwise } from "./embed";

export type PromptwiseCommand = "sidebar" | "inspector" | "export";

export interface PromptwiseToolbarState {
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  rendering: boolean;
}

function isCommand(value: unknown): value is PromptwiseCommand {
  return value === "sidebar" || value === "inspector" || value === "export";
}

/**
 * Embedded in promptwise, Studio draws no header: the Timeline tab's toolbar carries the left
 * column's and the Inspector's switches and Export. It sends their presses as promptwise:command
 * messages, and Studio sends back their state.
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

  const { sidebarOpen, inspectorOpen, rendering } = state;
  useEffect(() => {
    if (!embeddedInPromptwise) return;
    window.parent.postMessage(
      { type: "promptwise:state", sidebarOpen, inspectorOpen, rendering },
      "*",
    );
  }, [sidebarOpen, inspectorOpen, rendering]);
}
