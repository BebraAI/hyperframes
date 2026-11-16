// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DomEditSelection } from "../components/editor/domEditing";
import { LintModal } from "../components/LintModal";
import { cleanupMounted, mountHost } from "../components/ui/mountHost.testHelpers";
import { useAskAgentModal } from "../hooks/useAskAgentModal";
import { askAboutBlock } from "./asks";
import { AskAboutRange } from "../player/components/EditModal";

// Studio embedded in promptwise: every "ask agent" opens promptwise's chat with what it's about (and words to send,
// where there are obvious ones), none copies to the clipboard, and none sends by itself.
const asked = vi.hoisted(() => [] as unknown[]);
const copied = vi.hoisted(() => [] as string[]);
vi.mock("./embed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./embed")>()),
  embeddedInPromptwise: true,
  askPromptwise: (ask: unknown) => asked.push(ask),
}));
vi.mock("../utils/clipboard", () => ({
  copyTextToClipboard: async (text: string) => copied.push(text) > 0,
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanupMounted();
  document.body.innerHTML = "";
  asked.length = 0;
  copied.length = 0;
  vi.unstubAllGlobals();
});

const button = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) ?? null;
const click = (text: string) => act(() => button(text)!.click());

describe("asking promptwise's agent from Studio", () => {
  it("opens the chat with a catalog block and its words waiting, without sending them", () => {
    const block = {
      name: "exploded-stack",
      title: "Exploded Stack",
      description: "Plates",
      category: "vfx",
      webgl: true,
      time: 5,
    };
    askAboutBlock(block);
    expect(asked).toEqual([
      { draft: 'Add "Exploded Stack" to my composition.', context: { kind: "block", ...block } },
    ]);
    expect(copied).toEqual([]);
  });

  it("opens the chat with a time range and its clips, and no popover to type in", () => {
    let done = false;
    const host = document.body.appendChild(document.createElement("div"));
    act(() =>
      createRoot(host).render(
        <AskAboutRange rangeStart={2} rangeEnd={1} onDone={() => (done = true)} />,
      ),
    );
    expect(asked).toEqual([{ context: { kind: "range", start: 1, end: 2, clips: [] } }]);
    expect([done, document.querySelector("textarea"), copied]).toEqual([true, null, []]);
  });

  it("opens the chat with lint findings and the words to fix them", () => {
    let closed = false;
    const findings = [
      {
        severity: "error" as const,
        message: "No duration",
        file: "index.html",
        fixHint: "Add data-duration",
      },
    ];
    mountHost(<LintModal findings={findings} projectId="demo" onClose={() => (closed = true)} />);
    click("Ask Wisey to fix");
    expect(asked).toEqual([
      {
        draft: "Fix these HyperFrames lint issues.",
        context: {
          kind: "lint",
          findings: [{ severity: "error", message: "No duration", file: "index.html" }],
        },
      },
    ]);
    expect([closed, copied]).toEqual([true, []]);
  });

  it("opens the chat with the selected element, by the handle the agent's studio tool takes, with no modal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const element = document.createElement("h1");
    element.textContent = "Made to move";
    const selection = {
      element,
      label: "Title Text",
      tagName: "H1",
      sourceFile: "compositions/title.html",
      compositionPath: "index.html",
      isCompositionHost: false,
      isInsideLockedComposition: false,
      hfId: "hf-2vh1",
      selector: "h1",
      selectorIndex: 0,
      boundingBox: { x: 0, y: 0, width: 10, height: 10 },
      textContent: "Made to move",
      dataAttributes: {},
      inlineStyles: {},
      computedStyles: {},
      textFields: [],
      capabilities: {
        canSelect: true,
        canEditStyles: true,
        canCrop: false,
        canMove: true,
        canResize: true,
        canApplyManualOffset: false,
        canApplyManualSize: false,
        canApplyManualRotation: false,
      },
    } as DomEditSelection;
    let hook: ReturnType<typeof useAskAgentModal> | null = null;
    function Harness() {
      hook = useAskAgentModal({
        projectId: "demo",
        activeCompPath: "index.html",
        projectDir: "/demo",
        projectIdRef: { current: "demo" },
        showToast: () => {},
        domEditSelectionRef: { current: selection },
        domEditSelection: selection,
      });
      return null;
    }
    const host = document.body.appendChild(document.createElement("div"));
    await act(async () => createRoot(host).render(<Harness />));
    await act(async () => hook!.handleAskAgent());

    expect(copied).toEqual([]);
    expect(asked).toEqual([
      {
        context: {
          kind: "element",
          handle: expect.stringMatching(/^hf:v\d+:demo:index\.html:.*hf-2vh1$/),
          file: "compositions/title.html",
          label: "Title Text",
          tag: "h1",
          time: 0,
          markup: expect.stringContaining("Made to move"),
        },
      },
    ]);
    expect(hook!.agentModalOpen).toBe(false);
  });
});
