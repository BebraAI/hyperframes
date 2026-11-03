// @vitest-environment happy-dom

/** In promptwise most changes go through the agent, so its button leads the empty Design panel. */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../promptwise/embed", async (original) => ({
  ...(await original<typeof import("../../promptwise/embed")>()),
  embeddedInPromptwise: true,
}));

const { PropertyPanelEmptyState } = await import("./PropertyPanelEmptyState");

it("puts the agent first, as the panel's one primary button, and asks promptwise to open its chat", () => {
  const posted: unknown[] = [];
  const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation((message) => {
    posted.push(message);
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<PropertyPanelEmptyState flat multiSelectCount={0} />));

  const text = host.textContent ?? "";
  expect(text.indexOf("Ask the agent")).toBeLessThan(text.indexOf("Record a gesture"));
  const agent = host.querySelector("button")!;
  expect(agent.textContent).toContain("Ask the agent");
  act(() => agent.click());
  expect(posted).toEqual([{ type: "promptwise:ask-agent" }]);

  act(() => root.unmount());
  host.remove();
  postMessage.mockRestore();
});
