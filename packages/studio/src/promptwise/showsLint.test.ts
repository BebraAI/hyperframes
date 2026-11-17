import { expect, it } from "vitest";
import { showsLintFor } from "./embed";

// Studio's Lint button showed in promptwise's production too: only the tab that asks with ?lint=1 (staging) gets it.
it("shows Lint on its own, and in promptwise only with ?lint=1", () => {
  expect(showsLintFor(false, "")).toBe(true);
  expect(showsLintFor(true, "?theme=dark")).toBe(false);
  expect(showsLintFor(true, "?theme=dark&lint=1")).toBe(true);
});
