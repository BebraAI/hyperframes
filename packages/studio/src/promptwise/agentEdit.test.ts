import { describe, expect, it } from "vitest";
import { AGENT_EDIT_LABEL, historyStepToast } from "./agentEdit";

describe("the toast after Undo", () => {
  it("says how to bring back an undone agent's edit", () => {
    expect(historyStepToast("undo", AGENT_EDIT_LABEL)).toBe(
      "Agent's edit. Redo (⌘⇧Z) brings it back.",
    );
  });

  it("is the step's label for the user's own edits and for redo", () => {
    expect(historyStepToast("undo", "Move clip")).toBe("Move clip");
    expect(historyStepToast("redo", AGENT_EDIT_LABEL)).toBe(AGENT_EDIT_LABEL);
  });
});
