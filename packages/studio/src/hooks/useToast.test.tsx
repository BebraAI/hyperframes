// @vitest-environment happy-dom

import React, { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanupMounted, mountHost } from "../components/ui/mountHost.testHelpers";
import { useToast } from "./useToast";

let api: ReturnType<typeof useToast>;
function Probe() {
  api = useToast();
  return <>{api.toasts.map((t) => t.message).join("|")}</>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanupMounted();
  vi.useRealTimers();
});

it("keeps an undo toast 6s, and not at all while the pointer is on it", async () => {
  const host = mountHost(<Probe />);
  let id = 0;
  await act(async () => void (id = api.showToast("Deleted Final 2", "undo")));
  await act(async () => void vi.advanceTimersByTime(5000));
  expect(host.textContent).toBe("Deleted Final 2");

  await act(async () => api.holdToast(id, true));
  await act(async () => void vi.advanceTimersByTime(20000));
  expect(host.textContent).toBe("Deleted Final 2");

  await act(async () => api.holdToast(id, false));
  await act(async () => void vi.advanceTimersByTime(6200));
  expect(host.textContent).toBe("");
});
