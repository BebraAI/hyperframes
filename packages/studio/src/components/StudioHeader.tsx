import { memo, useContext, type MouseEvent } from "react";
import { RiCameraLine, RiLayoutRightLine, RiLoader4Line } from "@remixicon/react";
import { useStudioShellContext } from "../contexts/StudioContext";
import { usePanelLayoutContext } from "../contexts/PanelLayoutContext";
import { trackStudioEvent } from "../utils/studioTelemetry";
import { Button, cn, Tooltip } from "./ui";
import { ButtonGroup, ButtonGroupItem } from "../boardui/components/base/buttons/button-group";
import { Dock } from "./dock/Dock";
import { PromptwiseMark } from "../promptwise/PromptwiseMark";
import { ShowThemeToggle, ThemeToggle } from "./ThemeToggle";

interface StudioHeaderProps {
  captureFrameHref: string;
  captureFrameFilename: string;
  handleCaptureFrameClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  refreshCaptureFrameTime: () => void;
  capturing?: boolean;
  inspectorButtonActive: boolean;
  inspectorPanelActive: boolean;
  onExport?: () => void;
}

/**
 * Does the header's Inspector button open the panel, or close it?
 *
 * The dock has no separate "railed by window width" state (it shrinks panels,
 * never auto-hides the group), so `rightCollapsed` here is already the state
 * that decides whether the panel is actually showing.
 */
export function shouldOpenInspector(
  rightCollapsed: boolean,
  inspectorPanelActive: boolean,
): boolean {
  return rightCollapsed || !inspectorPanelActive;
}

/** BoardUI's small button-group item, for the one item that has to be a link. */
const groupLink =
  "inline-flex h-[30px] items-center justify-center gap-1 whitespace-nowrap px-2 text-body-medium text-text-primary bg-background-primary-default select-none transition-[background-color,color] duration-150 outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring";

// fallow-ignore-next-line complexity
export const StudioHeader = memo(function StudioHeader({
  captureFrameHref,
  captureFrameFilename,
  handleCaptureFrameClick,
  refreshCaptureFrameTime,
  capturing,
  inspectorButtonActive,
  inspectorPanelActive,
  onExport,
}: StudioHeaderProps) {
  const showThemeToggle = useContext(ShowThemeToggle);
  const { projectId, renderQueue } = useStudioShellContext();
  const { rightCollapsed, setRightCollapsed, setRightPanelTab } = usePanelLayoutContext();
  const isRendering = renderQueue.isRendering;
  const ffmpegMissing = renderQueue.ffmpegMissing;

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-button-default bg-background-primary-default px-3">
      <div className="flex items-center gap-3">
        <PromptwiseMark />
        <span className="h-4 w-px bg-border-button-default" aria-hidden="true" />
        <span className="text-body-medium text-text-primary">{projectId}</span>
      </div>
      <div className="flex items-center gap-2">
        <ButtonGroup size="small">
          <Tooltip label={capturing ? "Capturing frame…" : "Capture current frame"} side="bottom">
            {/* A real download link, so it wears the group item's look rather than being one:
              `download` on an <a> is what saves the frame, and no <button> can do that. */}
            <a
              href={captureFrameHref}
              download={captureFrameFilename}
              onClick={(e) => {
                if (capturing) {
                  e.preventDefault();
                  return;
                }
                trackStudioEvent("toolbar_action", { action: "capture_frame" });
                handleCaptureFrameClick(e);
              }}
              onFocus={refreshCaptureFrameTime}
              onPointerDown={refreshCaptureFrameTime}
              aria-disabled={capturing || undefined}
              className={cn(
                groupLink,
                capturing
                  ? "cursor-default text-text-tertiary"
                  : "hover:bg-background-primary-hover active:bg-background-primary-active",
              )}
              aria-label={capturing ? "Capturing frame" : "Capture current frame"}
            >
              {capturing ? (
                <RiLoader4Line className="size-[18px] animate-spin motion-reduce:animate-none" />
              ) : (
                <RiCameraLine className="size-[18px]" />
              )}
              <span className="max-[1000px]:hidden">{capturing ? "Capturing…" : "Capture"}</span>
            </a>
          </Tooltip>
          <Tooltip label="Inspector" side="bottom">
            <ButtonGroupItem
              size="small"
              aria-label="Inspector"
              aria-pressed={inspectorButtonActive}
              selected={inspectorButtonActive}
              leadingIcon={RiLayoutRightLine}
              onClick={() => {
                if (shouldOpenInspector(rightCollapsed, inspectorPanelActive)) {
                  trackStudioEvent("panel_toggle", { panel: "inspector", collapsed: false });
                  setRightPanelTab("design");
                  setRightCollapsed(false);
                  return;
                }
                trackStudioEvent("panel_toggle", { panel: "inspector", collapsed: true });
                // Keep the current selection when collapsing the Inspector — closing
                // the panel shouldn't deselect the element.
                setRightCollapsed(true);
              }}
            >
              Inspector
            </ButtonGroupItem>
          </Tooltip>
        </ButtonGroup>
        {showThemeToggle && <ThemeToggle />}
        <Dock.WindowMenu />
        <Tooltip
          label={
            ffmpegMissing
              ? "FFmpeg is not installed. Opens the Renders panel with the install command."
              : isRendering
                ? "A render is already in progress"
                : "Render and export this composition"
          }
          side="bottom"
        >
          <Button
            variant="primary"
            data-testid="header-export"
            disabled={isRendering}
            onClick={() => {
              if (isRendering) return;
              setRightPanelTab("renders");
              setRightCollapsed(false);
              // Without an encoder this render cannot finish, so the click
              // delivers the user to the prompt that fixes it instead of
              // queueing a job that exists only to fail. Disabling the button
              // would leave them staring at a dead control with no route to
              // the explanation.
              if (ffmpegMissing) return;
              onExport?.();
            }}
          >
            {isRendering ? "Rendering…" : "Export"}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
});
