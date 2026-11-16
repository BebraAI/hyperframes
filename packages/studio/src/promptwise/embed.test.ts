// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { askPromptwise } from "./embed";

afterEach(() => vi.restoreAllMocks());

it("posts the request to promptwise's page, and a bare ask with nothing in it", () => {
  const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
  askPromptwise({
    instruction: "Bigger",
    context: { kind: "animation", animationId: "a1", summary: "fade in" },
  });
  askPromptwise();
  expect(post.mock.calls).toEqual([
    [
      {
        type: "promptwise:ask-agent",
        instruction: "Bigger",
        context: { kind: "animation", animationId: "a1", summary: "fade in" },
      },
      "*",
    ],
    [{ type: "promptwise:ask-agent" }, "*"],
  ]);
});
