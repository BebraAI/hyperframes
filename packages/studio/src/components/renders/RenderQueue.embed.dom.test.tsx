// @vitest-environment happy-dom

/** In promptwise the tab's own Export renders on the server: Renders has no second Export, and says where it is. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../promptwise/embed", () => ({ embeddedInPromptwise: true }));

const { RenderQueue, PROMPTWISE_RENDERS_NOTE } = await import("./RenderQueue");

it("shows no Export of its own, only where the tab's Export is", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <RenderQueue
        jobs={[]}
        projectId="demo"
        onDelete={vi.fn()}
        onClearCompleted={vi.fn()}
        onStartRender={vi.fn()}
        isRendering={false}
        compositionDimensions={{ width: 1920, height: 1080 }}
        ffmpeg={{ ok: true }}
        ffmpegChecking={false}
        onRecheckFfmpeg={vi.fn()}
      />,
    ),
  );
  expect([...host.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("Export");
  expect(host.textContent).toContain(PROMPTWISE_RENDERS_NOTE);
  act(() => root.unmount());
});
