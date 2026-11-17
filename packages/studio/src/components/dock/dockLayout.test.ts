// @vitest-environment happy-dom

import type { DockviewApi } from "dockview-react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applySideMinimums,
  buildEditLayout,
  defaultSideWidths,
  previewMinimumWidth,
} from "./dockLayout";
import { mountBareDockview } from "./dockTestHarness";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

describe("previewMinimumWidth", () => {
  it.each([
    [1200, 2, 360],
    [760, 2, 360],
    [560, 1, 360],
    [480, 1, 280],
    [300, 1, 160],
    [300, 0, 300],
  ])("on a %ipx dock with %i side columns is %ipx", (dock, sides, expected) => {
    expect(previewMinimumWidth(dock, sides)).toBe(expected);
  });
});

describe("defaultSideWidths", () => {
  it.each([
    [1680, 384, 424],
    [1280, 329, 364],
    [860, 221, 244],
    [560, 200, 200],
  ])("at %ipx gives %i / %i", (viewport, left, right) => {
    expect(defaultSideWidths(viewport)).toEqual({ left, right });
  });

  it.each([1680, 1280, 1000, 860, 760])(
    "leaves the preview its 360px floor at %ipx",
    (viewport) => {
      const { left, right } = defaultSideWidths(viewport);
      expect(left + right + 360).toBeLessThanOrEqual(viewport);
    },
  );
});

describe("applySideMinimums", () => {
  let api: DockviewApi;
  beforeEach(() => {
    ({ api } = mountBareDockview());
  });
  afterEach(() => {
    api.dispose();
    document.body.innerHTML = "";
  });

  const shown = (id: string) => api.getPanel(id)!.group.api.isVisible;

  it("keeps both columns at 200px or wider while they fit beside the preview", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    applySideMinimums(api, 760);
    expect([shown("compositions"), shown("design")]).toEqual([true, true]);
    expect(api.getPanel("compositions")?.group.minimumWidth).toBe(200);
    expect(api.getPanel("design")?.group.minimumWidth).toBe(200);
    expect(api.getPanel("preview")?.group.minimumWidth).toBe(360);
  });

  it("closes the right column, then the left, instead of squeezing them or the preview", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    applySideMinimums(api, 600);
    expect([shown("compositions"), shown("design")]).toEqual([true, false]);
    applySideMinimums(api, 480);
    expect([shown("compositions"), shown("design")]).toEqual([false, false]);
    expect(api.getPanel("preview")?.group.minimumWidth).toBe(360);
  });

  it("keeps a column just pulled out and closes the other, the preview yielding what it needs", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    applySideMinimums(api, 480, api.getPanel("design")!.group);
    expect([shown("compositions"), shown("design")]).toEqual([false, true]);
    expect(api.getPanel("preview")?.group.minimumWidth).toBe(280);
  });

  it("brings the columns it closed back once the dock is wide again", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    applySideMinimums(api, 480);
    applySideMinimums(api, 900);
    expect([shown("compositions"), shown("design")]).toEqual([false, false]);
    applySideMinimums(api, 1200);
    expect([shown("compositions"), shown("design")]).toEqual([true, true]);
  });

  it("leaves a column the user closed closed", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    api.getPanel("design")!.group.api.setVisible(false);
    applySideMinimums(api, 1200);
    expect(shown("design")).toBe(false);
  });

  it("leaves a wide window's user-chosen widths alone", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    api.getPanel("compositions")?.group.api.setSize({ width: 300 });
    applySideMinimums(api, 1200);
    expect(api.getPanel("compositions")?.group.width).toBe(300);
  });

  it("keeps the preview's floor when a side panel is tabbed into the preview group", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    const preview = api.getPanel("preview");
    const design = api.getPanel("design");
    if (!preview || !design) throw new Error("default layout is missing panels");
    design.api.moveTo({ group: preview.group, position: "center", index: 0 });
    preview.api.setActive();
    applySideMinimums(api, 760);
    expect(preview.group.minimumWidth).toBe(360);
  });

  it("pins the preview floor when a side panel that was showing gets the preview dragged in", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    const preview = api.getPanel("preview");
    const design = api.getPanel("design");
    if (!preview || !design) throw new Error("default layout is missing panels");
    preview.api.moveTo({ group: design.group });
    applySideMinimums(api, 760);
    expect(preview.group.minimumWidth).toBe(360);
  });

  it("rewrites the minimum of a group that is neither the preview nor side-only", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    const timeline = api.getPanel("timeline");
    const compositions = api.getPanel("compositions");
    if (!timeline || !compositions) throw new Error("default layout is missing panels");
    timeline.api.moveTo({ group: compositions.group });
    applySideMinimums(api, 760);
    expect(compositions.group.minimumWidth).toBe(200);
  });

  it("drops the preview floor from a group the preview has left", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    const preview = api.getPanel("preview");
    const timeline = api.getPanel("timeline");
    if (!preview || !timeline) throw new Error("default layout is missing panels");
    preview.api.moveTo({ group: timeline.group });
    applySideMinimums(api, 760);
    preview.api.moveTo({ position: "right", group: api.getPanel("design")?.group });
    applySideMinimums(api, 760);
    expect(timeline.group.minimumWidth).toBe(200);
  });
});

describe("buildEditLayout on a narrow dock", () => {
  let api: DockviewApi;
  beforeEach(() => {
    ({ api } = mountBareDockview());
  });
  afterEach(() => {
    api.dispose();
    document.body.innerHTML = "";
  });

  it("puts the preview over the timeline with both side groups closed, as drawers in promptwise's tab", () => {
    api.layout(640, 820);
    buildEditLayout(api, 640);
    const right = api.getPanel("design")!.group;
    const left = api.getPanel("assets")!.group;
    expect(right.panels.map((panel) => panel.id)).toEqual(["design", "layers", "renders"]);
    expect(left.panels.map((panel) => panel.id)).toEqual(["assets", "catalog"]);
    expect([left.api.isVisible, right.api.isVisible]).toEqual([false, false]);
    expect(api.getPanel("preview")!.group.api.isVisible).toBe(true);
    expect(api.getPanel("preview")!.group.width).toBe(640);
    expect(api.getPanel("timeline")!.group.width).toBe(640);
    expect(api.getPanel("timeline")!.group.height).toBe(260);
    expect(api.getPanel("code")).toBeUndefined();
    expect(api.getPanel("compositions")).toBeUndefined();
  });

  it("opens both side groups once the dock widens to the full layout", () => {
    api.layout(640, 820);
    buildEditLayout(api, 640);
    applySideMinimums(api, 1200);
    expect(api.getPanel("assets")!.group.api.isVisible).toBe(true);
    expect(api.getPanel("design")!.group.api.isVisible).toBe(true);
  });

  it("keeps the three columns on a wide one", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200);
    expect(api.getPanel("compositions")!.group).not.toBe(api.getPanel("design")!.group);
    expect(api.getPanel("design")!.group.api.isVisible).toBe(true);
  });

  it("opens only the lean panels in promptwise's tab, however wide", () => {
    api.layout(1200, 700);
    buildEditLayout(api, 1200, undefined, true);
    expect(api.getPanel("assets")!.group.panels.map((panel) => panel.id)).toEqual([
      "assets",
      "catalog",
    ]);
    expect(api.getPanel("design")!.group.panels.map((panel) => panel.id)).toEqual([
      "design",
      "layers",
      "renders",
    ]);
    expect(api.getPanel("design")!.group.api.isVisible).toBe(true);
  });
});
