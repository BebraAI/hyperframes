import { DotsThree } from "@phosphor-icons/react";
import { useLinkedClipPreferences } from "../utils/linkedClipPreferences";
import { Menu, MenuCheckboxItem, MenuItem, MenuSeparator, Tooltip } from "./ui";
import { flatIdle } from "./timelineToolbarStyles";

/** Where the playhead sits against the selection's keyframes. */
export type KeyframeState = "active" | "inactive" | "none";

export function keyframeTooltip(
  pathEndpoint: boolean,
  canToggle: boolean,
  isMotionPath: boolean,
  willExtend: boolean,
  state: KeyframeState,
): string {
  if (pathEndpoint) return "Motion path endpoints cannot be removed";
  if (!canToggle) return "Select an animated element to add keyframes";
  if (isMotionPath) {
    if (willExtend) return "Extend motion path to playhead";
    return state === "active" ? "Remove waypoint from motion path" : "Add waypoint to motion path";
  }
  if (state === "active") return "Remove keyframe at playhead";
  if (state === "inactive") {
    return willExtend ? "Add keyframe at playhead, extends animation" : "Add keyframe at playhead";
  }
  return "Add keyframe";
}

export function keyframeAriaLabel(
  pathEndpoint: boolean,
  isMotionPath: boolean,
  willExtend: boolean,
  state: KeyframeState,
): string {
  if (pathEndpoint) return "Motion path endpoint";
  if (isMotionPath) {
    if (state === "active") return "Remove motion path waypoint";
    return willExtend ? "Extend motion path to playhead" : "Add motion path waypoint";
  }
  return state === "active" ? "Remove keyframe at playhead" : "Add keyframe at playhead";
}

export const AUTO_RECORD_LABEL = "Auto-record manual edits as keyframes";

/** Filled dot inside the keyframe diamond: edits are being recorded. */
export function AutoRecordIcon({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 0.7L9.3 5L5 9.3L0.7 5Z" stroke="currentColor" strokeWidth="1" />
      <circle
        cx="5"
        cy="5"
        r="1.8"
        className={on ? "fill-danger-ink stroke-danger-ink" : undefined}
        fill={on ? undefined : "none"}
        stroke={on ? undefined : "currentColor"}
        strokeWidth="1"
      />
    </svg>
  );
}

/** Beat glyph: a drum. */
export function BeatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 10C21 12.2091 16.9706 14 12 14M21 10C21 7.79086 16.9706 6 12 6C7.02944 6 3 7.79086 3 10M21 10V16C21 18.2091 16.9706 20 12 20M12 14C7.02944 14 3 12.2091 3 10M12 14V20M3 10V16C3 18.2091 7.02944 20 12 20M7 19.3264V13.3264M17 19.3264V13.3264M12 10L20 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const THUMBNAILS_ON_LABEL = "Hide thumbnails: labels only";
export const THUMBNAILS_OFF_LABEL =
  "Show thumbnails: posters stay visible; richer previews appear on interaction";

interface MoreToolsMenuProps {
  showKeyframes: boolean;
  autoKeyframeEnabled: boolean;
  setAutoKeyframeEnabled: (on: boolean) => void;
  thumbnailsVisible: boolean;
  setThumbnailsVisible: (on: boolean) => void;
  projectHasAudio: boolean;
  audioMetersVisible: boolean;
  setAudioMetersVisible: (on: boolean) => void;
  showBeat: boolean;
  canAddBeat: boolean;
  onAddBeat: () => void;
}

/** promptwise: the rarely used toggles, named and ticked in one menu instead of a row of bare icons. */
export function MoreToolsMenu(props: MoreToolsMenuProps) {
  const linkedSelection = useLinkedClipPreferences((s) => s.linkedSelection);
  const setLinkedSelection = useLinkedClipPreferences((s) => s.setLinkedSelection);
  return (
    <Tooltip label="More tools">
      <span className="inline-flex">
        <Menu
          aria-label="More timeline tools"
          trigger={
            <button type="button" aria-label="More tools" className={flatIdle}>
              <DotsThree size={16} weight="bold" aria-hidden="true" />
            </button>
          }
        >
          <MenuCheckboxItem checked={linkedSelection} onCheckedChange={setLinkedSelection}>
            Select video and its sound together
          </MenuCheckboxItem>
          {props.showKeyframes && (
            <MenuCheckboxItem
              checked={props.autoKeyframeEnabled}
              onCheckedChange={props.setAutoKeyframeEnabled}
            >
              Record edits as keyframes
            </MenuCheckboxItem>
          )}
          <MenuCheckboxItem
            checked={props.thumbnailsVisible}
            onCheckedChange={props.setThumbnailsVisible}
          >
            Thumbnails on clips
          </MenuCheckboxItem>
          {props.projectHasAudio && (
            <MenuCheckboxItem
              checked={props.audioMetersVisible}
              onCheckedChange={props.setAudioMetersVisible}
            >
              Audio meters
            </MenuCheckboxItem>
          )}
          {props.showBeat && (
            <>
              <MenuSeparator />
              <MenuItem disabled={!props.canAddBeat} onClick={props.onAddBeat}>
                Add beat at playhead
              </MenuItem>
            </>
          )}
        </Menu>
      </span>
    </Tooltip>
  );
}
