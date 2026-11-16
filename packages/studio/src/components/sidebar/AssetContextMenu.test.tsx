// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ContextMenu } from "./AssetContextMenu";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
});

it("opens on the page's body, above the sidebar's resize edge, and adds the asset at the playhead", () => {
  const sidebar = document.createElement("div");
  sidebar.style.position = "relative";
  sidebar.style.zIndex = "1";
  document.body.append(sidebar);
  const onAdd = vi.fn();
  const root = createRoot(sidebar);
  act(() =>
    root.render(
      <ContextMenu
        x={10}
        y={10}
        asset="assets/beach.mov"
        onClose={() => {}}
        onCopy={() => {}}
        onAddAtPlayhead={onAdd}
      />,
    ),
  );
  const menu = document.querySelector('[role="menu"]');
  expect(menu).not.toBeNull();
  expect(sidebar.contains(menu)).toBe(false);
  act(() => (document.querySelector('[role="menuitem"]') as HTMLButtonElement).click());
  expect(onAdd).toHaveBeenCalledWith("assets/beach.mov");
  act(() => root.unmount());
});
