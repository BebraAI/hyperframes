// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDockLayoutStore, type DockController } from "./dockLayoutStore";
import { SideDrawerEdges } from "./SideDrawerEdges";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const widths: number[] = [];
const shown: boolean[] = [];

function setSide(open: boolean, width: number) {
  act(() => useDockLayoutStore.setState({ sides: { left: { open, width } } }));
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  widths.length = 0;
  shown.length = 0;
  localStorage.clear();
  const controller = {
    setGroupVisible: (_id: string, visible: boolean) => {
      shown.push(visible);
      setSide(visible, useDockLayoutStore.getState().sides?.left?.width ?? 0);
    },
    resizeSide: (_side: string, width: number) => {
      widths.push(width);
      setSide(useDockLayoutStore.getState().sides?.left?.open ?? false, width);
    },
  } as unknown as DockController;
  act(() =>
    useDockLayoutStore.setState({ controller, openPanels: new Set(["assets"]), sides: {} }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<SideDrawerEdges />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const edge = () => host.querySelector<HTMLButtonElement>('[data-drawer-edge="left"]');
function gesture(fromX: number, toX: number) {
  const el = edge()!;
  el.setPointerCapture = () => {};
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: fromX, pointerId: 1 }),
    );
    if (toX !== fromX)
      el.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX: toX, pointerId: 1 }),
      );
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: toX, pointerId: 1 }));
  });
}

describe("SideDrawerEdges", () => {
  it("shows nothing for a side the layout doesn't have", () => {
    expect(edge()).toBeNull();
  });

  it("opens a closed column on a click at its remembered width, and closes it on another", () => {
    setSide(false, 0);
    expect(edge()!.getAttribute("aria-label")).toBe("Show the media");
    gesture(5, 5);
    expect(shown).toEqual([true]);
    expect(widths.at(-1)).toBe(260);
    expect(edge()!.getAttribute("aria-label")).toBe("Resize the media");
    gesture(255, 255);
    expect(shown).toEqual([true, false]);
  });

  it("resizes on a drag and remembers the width, and closes when dragged far in", () => {
    setSide(true, 260);
    gesture(255, 335);
    expect(widths.at(-1)).toBe(340);
    expect(localStorage.getItem("hf-studio-drawer-left")).toBe("340");
    gesture(335, 40);
    expect(shown).toEqual([false]);
    expect(localStorage.getItem("hf-studio-drawer-left")).toBe("340");
  });

  it("opens a closed column dragged out from the edge, at the width it was dragged to", () => {
    setSide(false, 0);
    gesture(2, 302);
    expect(shown[0]).toBe(true);
    expect(widths.at(-1)).toBe(300);
  });
});
