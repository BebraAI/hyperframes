import type { Direction, DockviewApi } from "dockview-react";
import { DOCK_PANEL_COMPONENT } from "./dockLayoutSchema";
import { PANEL_DEFINITIONS, PANEL_IDS, isPanelId, type PanelId } from "./panelRegistry";
import { embeddedInPromptwise } from "../../promptwise/embed";

type DockGroup = DockviewApi["groups"][number];

const MIN_PREVIEW_W = 360;
const MIN_PREVIEW_H = 200;
const MIN_TIMELINE_H = 100;
/** A side column narrower than this is no use (assets cut to two letters): it closes instead. */
const MIN_SIDE_W = 200;
/** How far the preview yields beside a drawer pulled out on a dock too narrow for it. */
const MIN_PREVIEW_W_FLOOR = 160;
const DEFAULT_TIMELINE_H = 360;
const DEFAULT_LEFT = ["compositions", "assets", "code", "catalog"] as const;
const DEFAULT_RIGHT = ["design", "layers", "renders", "variables", "motionBlur"] as const;
/** Below this dock width (promptwise's Timeline tab beside its chat) two side columns would crush the preview. */
const COMPACT_DOCK_W = 1000;
/** What promptwise's users work with; Compositions, Code, Variables and Blur wait in the Window menu. */
const LEAN_LEFT = ["assets", "catalog"] as const;
const LEAN_RIGHT = ["design", "layers", "renders"] as const;
/** Room for three tracks under the toolbar and ruler; the preview gets the rest. */
const COMPACT_TIMELINE_H = 260;

/** Whether the dock is too narrow for the full three-column layout (promptwise's tab beside its chat). */
export const isCompactDock = (dockWidth: number) => dockWidth < COMPACT_DOCK_W;

/** Preferred side widths; when they overflow the preview's floor the right yields first, then the left. */
export function defaultSideWidths(viewportWidth: number) {
  const left = Math.max(MIN_SIDE_W, Math.min(384, Math.round(viewportWidth * 0.257)));
  const right = Math.max(MIN_SIDE_W, Math.min(424, Math.round(viewportWidth * 0.284)));
  const excess = left + right - Math.max(0, viewportWidth - MIN_PREVIEW_W);
  if (excess <= 0) return { left, right };
  const shrunkRight = Math.max(MIN_SIDE_W, right - excess);
  return {
    left: Math.max(MIN_SIDE_W, left - (excess - (right - shrunkRight))),
    right: shrunkRight,
  };
}

/**
 * The preview's floor. Beside one side column on a dock too narrow for both at their floors (a drawer
 * pulled out in a split-screen tab) the preview yields what the column needs, down to MIN_PREVIEW_W_FLOOR.
 */
export function previewMinimumWidth(dockWidth: number, sidesShown: number): number {
  if (sidesShown === 0) return Math.min(MIN_PREVIEW_W, Math.max(0, dockWidth));
  const room = dockWidth - sidesShown * MIN_SIDE_W;
  return Math.max(MIN_PREVIEW_W_FLOOR, Math.min(MIN_PREVIEW_W, room));
}

function holdsPreview(group: DockGroup) {
  return group.panels.some((panel) => panel.id === "preview");
}

/** The zone of a group whose every tab is a side panel, else null. */
export function sideZone(group: DockGroup): "left" | "right" | null {
  const zones = group.panels.map((panel) =>
    isPanelId(panel.id) ? PANEL_DEFINITIONS[panel.id].zone : "center",
  );
  const first = zones[0];
  const allSide = zones.every((zone) => zone !== "center");
  return allSide && first && first !== "center" ? first : null;
}

/** Side columns this file closed for want of room, to bring back once the dock is wide again. */
const closedForRoom = new WeakSet<DockGroup>();

const fits = (sides: number, dockWidth: number) => sides * MIN_SIDE_W + MIN_PREVIEW_W <= dockWidth;

/** Who closes first for want of room: anything but `keep`, the right column before the left. */
const closeOrder = (keep: DockGroup | undefined) => (a: DockGroup, b: DockGroup) =>
  Number(b !== keep) - Number(a !== keep) ||
  Number(sideZone(b) === "right") - Number(sideZone(a) === "right");

/** Closes shown columns until the rest fit beside the preview, never `keep`; returns how many still show. */
function closeForRoom(shown: DockGroup[], dockWidth: number, keep: DockGroup | undefined) {
  let count = shown.length;
  for (const group of [...shown].sort(closeOrder(keep))) {
    if (fits(count, dockWidth) || group === keep) break;
    group.api.setVisible(false);
    closedForRoom.add(group);
    count--;
  }
  return count;
}

/** Brings back columns closed for room, at their default widths, while they fit. */
function reopenForRoom(sides: DockGroup[], count: number, dockWidth: number) {
  const widths = defaultSideWidths(dockWidth);
  const waiting = sides.filter((group) => !group.api.isVisible && closedForRoom.has(group));
  for (const group of waiting) {
    if (!fits(count + 1, dockWidth)) return;
    closedForRoom.delete(group);
    group.api.setVisible(true);
    group.api.setSize({ width: sideZone(group) === "right" ? widths.right : widths.left });
    count++;
  }
}

/**
 * Closes side columns the dock has no room for, rather than squeezing them to slivers or pushing the
 * preview off the dock's edge: the right first, then the left, never `keep` (a drawer just pulled out).
 * A column closed here, or by the narrow layout, comes back once the dock is wide enough for the full
 * layout again.
 */
function fitSides(api: DockviewApi, dockWidth: number, keep?: DockGroup) {
  const sides = api.groups.filter((group) => sideZone(group) !== null);
  for (const group of sides) if (group.api.isVisible) closedForRoom.delete(group);
  const count = closeForRoom(
    sides.filter((group) => group.api.isVisible),
    dockWidth,
    keep,
  );
  if (!isCompactDock(dockWidth)) reopenForRoom(sides, count, dockWidth);
}

/** Idempotent; rewrites every group's minimum, since dockview keeps a constraint once set. */
export function applySideMinimums(
  api: DockviewApi,
  dockWidth = window.innerWidth,
  keep?: DockGroup,
) {
  fitSides(api, dockWidth, keep);
  const shown = api.groups.filter((group) => group.api.isVisible && sideZone(group) !== null);
  const previewMinimum = previewMinimumWidth(dockWidth, shown.length);
  const cap = defaultSideWidths(dockWidth);
  const overflows = shown.reduce((sum, group) => sum + group.width, 0) + previewMinimum > dockWidth;
  for (const group of api.groups) {
    if (holdsPreview(group)) {
      group.api.setConstraints({ minimumWidth: previewMinimum });
      continue;
    }
    group.api.setConstraints({ minimumWidth: MIN_SIDE_W });
    const zone = sideZone(group);
    const limit = zone === "right" ? cap.right : cap.left;
    if (zone && overflows && group.width > limit) group.api.setSize({ width: limit });
  }
}

function minimumSize(id: PanelId) {
  if (id === "preview") return { minimumWidth: MIN_PREVIEW_W, minimumHeight: MIN_PREVIEW_H };
  if (id === "timeline") return { minimumHeight: MIN_TIMELINE_H };
  return { minimumWidth: MIN_SIDE_W };
}

export function addRegisteredPanel(
  api: DockviewApi,
  id: PanelId,
  position?: { referencePanel: PanelId; direction: Direction },
) {
  return api.addPanel({
    id,
    component: DOCK_PANEL_COMPONENT,
    title: PANEL_DEFINITIONS[id].title,
    renderer: "always",
    ...minimumSize(id),
    ...(position ? { position } : {}),
  });
}

function addSideColumn(
  api: DockviewApi,
  ids: readonly PanelId[],
  panels: readonly PanelId[],
  direction: "left" | "right",
) {
  const [first, ...rest] = ids.filter((id) => panels.includes(id));
  if (!first) return undefined;
  addRegisteredPanel(api, first, { referencePanel: "preview", direction });
  for (const id of rest)
    addRegisteredPanel(api, id, { referencePanel: first, direction: "within" });
  api.getPanel(first)?.api.setActive();
  return first;
}

/**
 * The default Edit layout: [library | preview | inspector] over a full-width timeline, or on a narrow
 * dock the preview over the timeline with both side groups closed, shown when asked for (Inspector,
 * a selection, a drag on the dock's edge) since they would leave the preview too little room.
 */
export function buildEditLayout(
  api: DockviewApi,
  viewportWidth: number,
  panels: readonly PanelId[] = PANEL_IDS,
  embedded = embeddedInPromptwise,
) {
  if (isCompactDock(viewportWidth)) {
    buildCompactLayout(api, viewportWidth, panels);
    return;
  }
  api.clear();
  const widths = defaultSideWidths(viewportWidth);
  addRegisteredPanel(api, "preview");
  addRegisteredPanel(api, "timeline", { referencePanel: "preview", direction: "below" });
  const left = addSideColumn(api, embedded ? LEAN_LEFT : DEFAULT_LEFT, panels, "left");
  const right = addSideColumn(api, embedded ? LEAN_RIGHT : DEFAULT_RIGHT, panels, "right");
  applySideMinimums(api, viewportWidth);
  if (left) api.getPanel(left)?.group.api.setSize({ width: widths.left });
  if (right) api.getPanel(right)?.group.api.setSize({ width: widths.right });
  api.getPanel("timeline")?.group.api.setSize({ height: DEFAULT_TIMELINE_H });
}

function buildCompactLayout(api: DockviewApi, viewportWidth: number, panels: readonly PanelId[]) {
  api.clear();
  addRegisteredPanel(api, "preview");
  addRegisteredPanel(api, "timeline", { referencePanel: "preview", direction: "below" });
  const left = addSideColumn(api, LEAN_LEFT, panels, "left");
  const right = addSideColumn(api, LEAN_RIGHT, panels, "right");
  applySideMinimums(api, viewportWidth);
  api.getPanel("timeline")?.group.api.setSize({ height: COMPACT_TIMELINE_H });
  // Both sides start closed, as drawers the user pulls out from the dock's edges (sideDrawer.ts).
  for (const side of [left, right]) {
    const group = side ? api.getPanel(side)?.group : undefined;
    group?.api.setSize({ width: Math.max(MIN_SIDE_W, defaultSideWidths(viewportWidth).right) });
    group?.api.setVisible(false);
    if (group) closedForRoom.add(group);
  }
}
