// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "./ui/mountHost.testHelpers";
import { StudioToast } from "./StudioToast";

afterEach(cleanupMounted);

it("puts Undo and its shortcut on an undo toast, and holds it while pointed at", async () => {
  const onUndo = vi.fn();
  const onHold = vi.fn();
  const host = mountHost(
    <StudioToast
      message="Deleted Final 2"
      tone="undo"
      onUndo={onUndo}
      onHold={onHold}
      onDismiss={() => {}}
    />,
  );
  const undo = [...host.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Undo"))!;
  expect(host.textContent).toContain("Deleted Final 2");
  expect(undo.querySelector("kbd")?.textContent).toMatch(/Z$/);
  await act(async () => undo.click());
  expect(onUndo).toHaveBeenCalledOnce();

  const toast = host.querySelector('[role="status"]')!;
  await act(async () => toast.dispatchEvent(new MouseEvent("pointerover", { bubbles: true })));
  await act(async () =>
    toast.dispatchEvent(
      new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }),
    ),
  );
  expect(onHold.mock.calls).toEqual([[true], [false]]);
});

it("has no Undo on a plain info toast", () => {
  const host = mountHost(<StudioToast message="Copied" tone="info" onUndo={() => {}} />);
  expect(host.querySelectorAll("button")).toHaveLength(0);
});
