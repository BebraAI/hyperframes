// @vitest-environment happy-dom

/** Embedded in promptwise: no header; the Timeline tab's toolbar drives Inspector, Export, undo and redo by message. */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const layout = { rightCollapsed: true, setRightCollapsed: vi.fn(), setRightPanelTab: vi.fn() };
const handleUndo = vi.fn(async () => {});
const handleRedo = vi.fn(async () => {});

vi.mock("../promptwise/embed", () => ({ embeddedInPromptwise: true }));
vi.mock("../contexts/StudioContext", () => ({
  useStudioShellContext: () => ({
    projectId: "773d81ab-4ac0-4f9d-acd7-4cd8838312dd",
    renderQueue: { isRendering: false, ffmpegMissing: false },
    handleUndo,
    handleRedo,
  }),
}));
vi.mock("../contexts/PanelLayoutContext", () => ({ usePanelLayoutContext: () => layout }));
vi.mock("../utils/studioTelemetry", () => ({ trackStudioEvent: vi.fn() }));

const { StudioHeader } = await import("./StudioHeader");

function command(name: string) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "promptwise:command", command: name },
        source: window.parent,
      }),
    );
  });
}

it("draws no header, runs the toolbar's presses and reports their state", () => {
  const posted: unknown[] = [];
  const postMessage = vi.spyOn(window.parent, "postMessage").mockImplementation((message) => {
    posted.push(message);
  });
  const onExport = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <StudioHeader
        captureFrameHref="blob:frame"
        captureFrameFilename="frame.png"
        handleCaptureFrameClick={vi.fn()}
        refreshCaptureFrameTime={vi.fn()}
        inspectorButtonActive={false}
        inspectorPanelActive={false}
        onExport={onExport}
      />,
    ),
  );

  expect(host.innerHTML).toBe("");
  expect(posted).toEqual([{ type: "promptwise:state", inspectorOpen: false, rendering: false }]);

  command("inspector");
  expect(layout.setRightPanelTab).toHaveBeenLastCalledWith("design");
  expect(layout.setRightCollapsed).toHaveBeenLastCalledWith(false);

  command("export");
  expect(layout.setRightPanelTab).toHaveBeenLastCalledWith("renders");
  expect(onExport).toHaveBeenCalledOnce();

  // Cmd+Z pressed in promptwise's page, outside this frame, arrives as a command.
  command("undo");
  expect(handleUndo).toHaveBeenCalledOnce();
  expect(handleRedo).not.toHaveBeenCalled();
  command("redo");
  expect(handleRedo).toHaveBeenCalledOnce();

  // Only the parent page may drive Studio, and only with the commands it knows.
  window.dispatchEvent(
    new MessageEvent("message", { data: { type: "promptwise:command", command: "export" } }),
  );
  command("delete-everything");
  expect(onExport).toHaveBeenCalledOnce();

  act(() => root.unmount());
  host.remove();
  postMessage.mockRestore();
});
