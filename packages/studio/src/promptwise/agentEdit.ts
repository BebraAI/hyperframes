/**
 * What Undo calls a change promptwise's agent made to the folder: in promptwise everything written outside Studio is
 * the agent's, and its history files it under this label (promptwise-web's backend), so one Cmd+Z too many reads as
 * the agent's edit going, not as "Changed outside the app".
 */
export const AGENT_EDIT_LABEL = "Agent's edit";

/** The toast after a step: an undone agent's edit says how to bring it back, since it can be a whole montage. */
export function historyStepToast(direction: "undo" | "redo", label: string): string {
  if (direction === "undo" && label.includes(AGENT_EDIT_LABEL))
    return `${label}. Redo (⌘⇧Z) brings it back.`;
  return label;
}
