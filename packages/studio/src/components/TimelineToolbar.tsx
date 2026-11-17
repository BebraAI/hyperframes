import { memo, useEffect, useRef, type ReactNode } from "react";
import { Image, Magnet, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import {
  useEnableKeyframes,
  isPlayheadWithinTween,
  type EnableKeyframesSession,
} from "../hooks/useEnableKeyframes";
import { computeElementPercentage, playsNear } from "../hooks/gsapShared";
import { useKeyframeKeyboard } from "../hooks/useKeyframeKeyboard";
import {
  timelineZoomPercentToSlider,
  timelineSliderToZoomPercent,
} from "../player/components/timelineZoom";
import { useTimelineZoom } from "../player/components/useTimelineZoom";
import {
  canZoomToSelectedClips,
  useShownTimelineZoomPercent,
  zoomTimelineStep,
  zoomTimelineToSelectedClips,
} from "../player/components/timelineZoomInput";
import { usePlayerStore, type TimelineElement } from "../player";
import { embeddedInPromptwise } from "../promptwise/embed";
import { Tooltip } from "./ui";
import {
  AUTO_RECORD_LABEL,
  AutoRecordIcon,
  BeatIcon,
  keyframeAriaLabel,
  keyframeTooltip,
  MoreToolsMenu,
  THUMBNAILS_OFF_LABEL,
  THUMBNAILS_ON_LABEL,
} from "./TimelineToolbarParts";
import { Scissors } from "../icons/SystemIcons";
import { AudioMetersIcon } from "./icons/AudioMetersIcon";
import { RippleEditIcon } from "./icons/RippleEditIcon";
import { ZoomToSelectionIcon } from "./icons/ZoomToSelectionIcon";
import {
  flatActive,
  flatBtn,
  flatDisabled,
  flatIdle,
  flatTextActive,
  flatTextIdle,
} from "./timelineToolbarStyles";
import { TimelineHistoryButtons, type TimelineHistoryButtonsProps } from "./TimelineHistoryButtons";
import { TimelineToolPicker } from "./TimelineToolPicker";
import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import type { DomEditSelection } from "./editor/domEditingTypes";
import { canSplitElement } from "../utils/timelineElementSplit";
import { useAudioMetersVisible } from "../utils/audioMeterVisibility";
import { LinkedSelectionToggle } from "./LinkedSelectionToggle";
import { useProjectHasAudio } from "../utils/audioMeterMath";
import { canAddBeatAt, addBeatAtCompositionTime } from "../utils/beatEditActions";
import { isTypingTarget } from "../utils/typingTarget";
import {
  SPLIT_SHORTCUT_HINT,
  ZOOM_SELECTION_SHORTCUT_HINT,
} from "../player/components/studioShortcuts";
import type { TimelineProps } from "../player/components/TimelineTypes";

interface DomEditSessionSlice extends EnableKeyframesSession {
  domEditSelection: DomEditSelection | null;
  selectedGsapAnimations: GsapAnimation[];
}

export interface TimelineToolbarProps {
  domEditSession?: DomEditSessionSlice;
  onSplitElement?: (element: TimelineElement, splitTime: number) => void;
  splitShortcut?: TimelineProps["splitShortcut"];
  history?: TimelineHistoryButtonsProps;
  showHistory?: boolean;
  showSelectAroundPlayhead?: boolean;
  showAddBeat?: boolean;
  /** Hides Add keyframe and auto-record, and turns off auto-record and the K shortcut with them. */
  showKeyframes?: boolean;
  rightActions?: ReactNode;
}

interface KeyframeToggleState {
  state: "active" | "inactive" | "none";
  isMotionPath: boolean;
  pathEndpoint: boolean;
  willExtend: boolean;
}

const NO_KEYFRAME_TOGGLE: KeyframeToggleState = {
  state: "none",
  isMotionPath: false,
  pathEndpoint: false,
  willExtend: false,
};

function isMotionPathEndpoint(animation: GsapAnimation | undefined, percentage: number): boolean {
  if (!animation?.keyframes) return false;
  const keyframes = animation.keyframes.keyframes;
  return [keyframes[0], keyframes.at(-1)].some(
    (keyframe) => keyframe && playsNear(animation, keyframe.percentage, percentage),
  );
}

function resolveKeyframeToggleState(
  session: DomEditSessionSlice | undefined,
  currentTime: number,
): KeyframeToggleState {
  if (!session?.domEditSelection) return NO_KEYFRAME_TOGGLE;
  const arcAnimation = session.selectedGsapAnimations.find(
    (animation) => animation.arcPath && animation.keyframes,
  );
  const animation =
    arcAnimation ??
    session.selectedGsapAnimations.find((candidate) => candidate.keyframes && !candidate.arcPath);
  if (!animation?.keyframes) return NO_KEYFRAME_TOGGLE;

  const isMotionPath = Boolean(arcAnimation);
  if (!isPlayheadWithinTween(animation, currentTime)) {
    return {
      state: "inactive",
      isMotionPath,
      pathEndpoint: false,
      willExtend: true,
    };
  }

  const percentage = computeElementPercentage(currentTime, session.domEditSelection, animation);
  const pathEndpoint = isMotionPathEndpoint(arcAnimation, percentage);
  const active = animation.keyframes.keyframes.some((keyframe) =>
    playsNear(animation, keyframe.percentage, percentage),
  );
  return {
    state: pathEndpoint ? "none" : active ? "active" : "inactive",
    isMotionPath,
    pathEndpoint,
    willExtend: false,
  };
}

/**
 * Can this element be keyframed at all?
 *
 * An audio clip cannot. It has no box on the canvas, so there is nothing to move,
 * scale or fade — and "add a keyframe" on one seeds a tween from the position
 * properties, which produced a position lane on a track that has no position. Audio
 * is automated instead: volume and effect parameters, on their own lanes.
 */
function isKeyframeable(element: TimelineElement | undefined): boolean {
  return element?.tag !== "audio";
}

function useKeyframeToggle(session?: DomEditSessionSlice) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const selectedElementId = usePlayerStore((s) => s.selectedElementId);
  const elements = usePlayerStore((s) => s.elements);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const onToggle = useEnableKeyframes(
    sessionRef as React.RefObject<EnableKeyframesSession | undefined>,
  );

  const selected = elements.find((element) => (element.key ?? element.id) === selectedElementId);
  if (!isKeyframeable(selected)) return { ...NO_KEYFRAME_TOGGLE, onToggle: undefined };

  const toggleState = resolveKeyframeToggleState(session, currentTime);

  return {
    ...toggleState,
    onToggle: session?.domEditSelection && !toggleState.pathEndpoint ? onToggle : undefined,
  };
}

// fallow-ignore-next-line complexity
export const TimelineToolbar = memo(function TimelineToolbar({
  domEditSession,
  onSplitElement,
  splitShortcut = SPLIT_SHORTCUT_HINT,
  history,
  showHistory = true,
  showSelectAroundPlayhead = true,
  showAddBeat = true,
  showKeyframes = true,
  rightActions,
}: TimelineToolbarProps) {
  // Embedded in promptwise the row keeps what an edit needs: history, the tool, split, keyframe, snapping, ripple
  // and zoom. Linked selection, auto-record, thumbnails, meters and beats are named in the More menu.
  const inlineSecondary = !embeddedInPromptwise;
  const timelineSnapEnabled = usePlayerStore((s) => s.timelineSnapEnabled);
  const setTimelineSnapEnabled = usePlayerStore((s) => s.setTimelineSnapEnabled);
  const rippleEditEnabled = usePlayerStore((s) => s.rippleEditEnabled);
  const setRippleEditEnabled = usePlayerStore((s) => s.setRippleEditEnabled);
  const autoKeyframeEnabled = usePlayerStore((s) => s.autoKeyframeEnabled);
  const setAutoKeyframeEnabled = usePlayerStore((s) => s.setAutoKeyframeEnabled);
  const thumbnailMode = usePlayerStore((s) => s.thumbnailMode);
  const setThumbnailMode = usePlayerStore((s) => s.setThumbnailMode);
  const thumbnailsVisible = thumbnailMode === "adaptive";
  const setThumbnailsVisible = (on: boolean) => setThumbnailMode(on ? "adaptive" : "hidden");
  const audioMetersVisible = useAudioMetersVisible((s) => s.visible);
  const setAudioMetersVisible = useAudioMetersVisible((s) => s.setVisible);
  const projectHasAudio = useProjectHasAudio();
  // Subscribe so the add-beat button reacts to playhead movement and analysis load.
  const currentTime = usePlayerStore((s) => s.currentTime);
  const beatAnalysisReady = usePlayerStore((s) => s.beatAnalysis !== null);
  // Subscribed, so the split button follows the selection, not only playhead ticks.
  const selectedElementId = usePlayerStore((s) => s.selectedElementId);
  const selectedElementIds = usePlayerStore((s) => s.selectedElementIds);
  const elements = usePlayerStore((s) => s.elements);
  const canZoomSelection = canZoomToSelectedClips({
    elements,
    selectedElementId,
    selectedElementIds,
  });
  const timelineFitPps = usePlayerStore((s) => s.timelineFitPps);
  const { zoomMode, setZoomMode, setManualZoomPercent } = useTimelineZoom();
  const displayedTimelineZoomPercent = useShownTimelineZoomPercent();
  const showsFit = zoomMode === "fit" && displayedTimelineZoomPercent === 100;
  const {
    state: keyframeState,
    isMotionPath: keyframeIsMotionPath,
    pathEndpoint: keyframePathEndpoint,
    willExtend: keyframeWillExtend,
    onToggle: onToggleKeyframe,
  } = useKeyframeToggle(domEditSession);

  // Wire the "Add keyframe (K)" shortcut the toolbar advertises. Active only when
  // there's a keyframeable selection; otherwise K stays JKL-pause in playback.
  useKeyframeKeyboard({
    enabled: showKeyframes && Boolean(onToggleKeyframe),
    onAddKeyframe: onToggleKeyframe,
  });

  useEffect(() => {
    if (!showKeyframes) setAutoKeyframeEnabled(false);
  }, [showKeyframes, setAutoKeyframeEnabled]);

  // "N" toggles timeline snapping (industry convention: Resolve/FCP).
  // Skip when typing in an input/contenteditable.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const store = usePlayerStore.getState();
      store.setTimelineSnapEnabled(!store.timelineSnapEnabled);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Mirrors the S-key gate: selected clip + playhead strictly inside it.
  const splitTarget = selectedElementId
    ? elements.find((e) => (e.key ?? e.id) === selectedElementId)
    : null;
  const splittable = splitTarget != null && canSplitElement(splitTarget);
  const canSplit =
    splittable &&
    currentTime > splitTarget.start &&
    currentTime < splitTarget.start + splitTarget.duration;

  // Beats need music to analyse: with no sound in the project there is nothing to place them on.
  const showBeat = showAddBeat && projectHasAudio;
  const canAddBeat = beatAnalysisReady && canAddBeatAt(currentTime);
  const addBeat = () => {
    if (canAddBeat) addBeatAtCompositionTime(currentTime);
  };

  return (
    <div className="border-b border-border-button-default">
      <div className="flex items-center justify-between px-2 py-0.5">
        <div className="flex items-center gap-0.5">
          {showHistory && <TimelineHistoryButtons {...history} />}
          <TimelineToolPicker showSelectAroundPlayhead={showSelectAroundPlayhead} />
          {/* Divider: tool-mode | editing-actions */}
          <div aria-hidden="true" className="mx-1 h-4 w-px bg-background-tertiary-default" />
          {onSplitElement && (
            // Rendered unconditionally (disabled when unusable): mounting mid-task shifts the neighbours.
            <Tooltip
              label={
                canSplit
                  ? "Split at playhead"
                  : splittable
                    ? "Move the playhead inside the clip to split"
                    : "Select a clip to split"
              }
              shortcut={canSplit ? splitShortcut : undefined}
            >
              <button
                type="button"
                disabled={!canSplit}
                aria-label="Split at playhead"
                onClick={() => {
                  if (canSplit && splitTarget) onSplitElement(splitTarget, currentTime);
                }}
                className={canSplit ? flatIdle : flatDisabled}
              >
                <Scissors size={16} />
              </button>
            </Tooltip>
          )}
          {showKeyframes && (
            // With no keyframeable selection the button fades to disabled instead of
            // unmounting, so the toolbar layout never shifts (CapCut-style).
            <Tooltip
              label={keyframeTooltip(
                keyframePathEndpoint,
                Boolean(onToggleKeyframe),
                keyframeIsMotionPath,
                keyframeWillExtend,
                keyframeState,
              )}
              shortcut={onToggleKeyframe ? "K" : undefined}
            >
              <button
                type="button"
                disabled={!onToggleKeyframe}
                onClick={onToggleKeyframe}
                aria-label={keyframeAriaLabel(
                  keyframePathEndpoint,
                  keyframeIsMotionPath,
                  keyframeWillExtend,
                  keyframeState,
                )}
                className={
                  !onToggleKeyframe
                    ? flatDisabled
                    : `${flatBtn} active:scale-[0.98] hover:bg-hover ${
                        keyframeState === "active"
                          ? "text-accent-ink"
                          : "text-text-2 hover:text-accent-ink"
                      }`
                }
              >
                <svg width="16" height="16" viewBox="0 0 10 10" fill="currentColor">
                  {keyframeState === "active" ? (
                    <path d="M5 0.5L9.5 5L5 9.5L0.5 5Z" />
                  ) : (
                    <path
                      d="M5 1.2L8.8 5L5 8.8L1.2 5Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  )}
                </svg>
              </button>
            </Tooltip>
          )}
          {/* Embedded, auto-record lives in More; while it is on it also shows here, so the mode is never hidden. */}
          {showKeyframes && (inlineSecondary || autoKeyframeEnabled) && (
            <Tooltip
              label={
                autoKeyframeEnabled
                  ? "Recording edits as keyframes (click to stop)"
                  : "Edits move the whole animation (click to record keyframes)"
              }
            >
              <button
                type="button"
                onClick={() => setAutoKeyframeEnabled(!autoKeyframeEnabled)}
                aria-label={AUTO_RECORD_LABEL}
                aria-pressed={autoKeyframeEnabled}
                className={autoKeyframeEnabled ? flatActive : flatIdle}
              >
                <AutoRecordIcon on={autoKeyframeEnabled} />
              </button>
            </Tooltip>
          )}
          <div aria-hidden="true" className="mx-1 h-4 w-px bg-background-tertiary-default" />
          <Tooltip label={timelineSnapEnabled ? "Snapping on" : "Snapping off"} shortcut="N">
            <button
              type="button"
              onClick={() => setTimelineSnapEnabled(!timelineSnapEnabled)}
              aria-label="Toggle timeline snapping"
              aria-pressed={timelineSnapEnabled}
              className={timelineSnapEnabled ? flatActive : flatIdle}
            >
              <Magnet size={16} weight="bold" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip
            label={
              rippleEditEnabled
                ? "Ripple on: deleting a clip closes the gap"
                : "Ripple off: deleting a clip leaves a gap"
            }
          >
            <button
              type="button"
              onClick={() => setRippleEditEnabled(!rippleEditEnabled)}
              aria-label="Toggle ripple edit"
              aria-pressed={rippleEditEnabled}
              className={rippleEditEnabled ? flatActive : flatIdle}
            >
              <RippleEditIcon size={16} />
            </button>
          </Tooltip>
          {inlineSecondary && (
            <>
              <LinkedSelectionToggle />
              {projectHasAudio && (
                <Tooltip label={audioMetersVisible ? "Hide audio meters" : "Show audio meters"}>
                  <button
                    type="button"
                    onClick={() => setAudioMetersVisible(!audioMetersVisible)}
                    aria-label="Toggle audio meters"
                    aria-pressed={audioMetersVisible}
                    className={audioMetersVisible ? flatActive : flatIdle}
                  >
                    <AudioMetersIcon size={16} />
                  </button>
                </Tooltip>
              )}
              {showBeat && (
                <Tooltip
                  label={
                    !beatAnalysisReady
                      ? "Beats appear once the music is analysed"
                      : canAddBeat
                        ? "Add beat at playhead"
                        : "A beat already exists at the playhead"
                  }
                >
                  <button
                    type="button"
                    disabled={!canAddBeat}
                    aria-label="Add beat at playhead"
                    onClick={addBeat}
                    className={canAddBeat ? flatIdle : flatDisabled}
                  >
                    <BeatIcon />
                  </button>
                </Tooltip>
              )}
            </>
          )}
          {embeddedInPromptwise && (
            <MoreToolsMenu
              showKeyframes={showKeyframes}
              autoKeyframeEnabled={autoKeyframeEnabled}
              setAutoKeyframeEnabled={setAutoKeyframeEnabled}
              thumbnailsVisible={thumbnailsVisible}
              setThumbnailsVisible={setThumbnailsVisible}
              projectHasAudio={projectHasAudio}
              audioMetersVisible={audioMetersVisible}
              setAudioMetersVisible={setAudioMetersVisible}
              showBeat={showBeat}
              canAddBeat={canAddBeat}
              onAddBeat={addBeat}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {rightActions}
          {inlineSecondary && (
            <Tooltip label={thumbnailsVisible ? THUMBNAILS_ON_LABEL : THUMBNAILS_OFF_LABEL}>
              <button
                type="button"
                aria-label={thumbnailsVisible ? THUMBNAILS_ON_LABEL : THUMBNAILS_OFF_LABEL}
                aria-pressed={thumbnailsVisible}
                onClick={() => setThumbnailsVisible(!thumbnailsVisible)}
                className={thumbnailsVisible ? flatActive : flatIdle}
              >
                <Image size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          <Tooltip
            label={
              canZoomSelection ? "Zoom to selected clips" : "Select a clip to zoom the timeline"
            }
            shortcut={canZoomSelection ? ZOOM_SELECTION_SHORTCUT_HINT : undefined}
          >
            <button
              type="button"
              disabled={!canZoomSelection}
              aria-label={
                canZoomSelection ? "Zoom to selected clips" : "Select a clip to zoom the timeline"
              }
              onClick={() => zoomTimelineToSelectedClips()}
              className={canZoomSelection ? flatIdle : flatDisabled}
            >
              <ZoomToSelectionIcon size={16} />
            </button>
          </Tooltip>
          <Tooltip label="Zoom out">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomTimelineStep("out")}
              className={flatIdle}
            >
              <MagnifyingGlassMinus size={16} aria-hidden="true" />
            </button>
          </Tooltip>
          <input
            type="range"
            min="0"
            max="100"
            value={timelineZoomPercentToSlider(displayedTimelineZoomPercent, timelineFitPps)}
            title={`${displayedTimelineZoomPercent}%`}
            aria-label="Timeline zoom"
            onChange={(e) =>
              setManualZoomPercent(
                timelineSliderToZoomPercent(Number(e.target.value), timelineFitPps),
              )
            }
            // h-6 on the input is the 24x24 WCAG 2.2 (2.5.8) target: the visible
            // track stays 2px and the thumb 10px, only the pointer box grows.
            className="mx-1 h-6 w-[96px] cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[2px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-neutral-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-0 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_#0a0a0a,0_1px_3px_rgba(0,0,0,0.5)] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb:active]:cursor-grabbing"
          />
          <Tooltip label="Zoom in">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomTimelineStep("in")}
              className={flatIdle}
            >
              <MagnifyingGlassPlus size={16} aria-hidden="true" />
            </button>
          </Tooltip>
          {/* The zoom readout is the Fit control: "Fit" while the timeline fits, N% after a zoom; a click fits it. */}
          <Tooltip label={showsFit ? "Timeline fits the width" : "Fit timeline to width"}>
            <button
              type="button"
              onClick={() => setZoomMode("fit")}
              aria-label="Fit timeline to width"
              aria-pressed={zoomMode === "fit"}
              className={`${zoomMode === "fit" ? flatTextActive : flatTextIdle} ml-0.5 w-[46px] font-mono text-caption-2-regular tabular-nums`}
            >
              <span aria-label="Timeline zoom level">
                {showsFit ? "Fit" : `${displayedTimelineZoomPercent}%`}
              </span>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
