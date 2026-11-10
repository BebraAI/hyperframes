import { useRef, useEffect, memo } from "react";
import { RiPauseFill, RiPlayFill } from "@remixicon/react";
import { formatFrameTime, formatTime } from "../lib/time";
import { liveTime, usePlayerStore } from "../store/playerStore";
import { trackStudioEvent } from "../../utils/studioTelemetry";
import { Tooltip } from "../../components/ui";
import { useMountEffect } from "../../hooks/useMountEffect";
import { useLinkedClipPreferences } from "../../utils/linkedClipPreferences";
import { ShortcutsButton } from "./ShortcutsPanel";
import type { ShortcutSection } from "./studioShortcuts";
import { SpeedMenu } from "./SpeedMenu";
import { VolumeControl } from "./VolumeControl";
import { PreviewSeekBar } from "./PreviewSeekBar";

/* ── Icon sub-components ─────────────────────────────────────────── */

// promptwise's own Timeline's play and pause (Remix's filled glyphs), in the button's ink.
function PlayPauseIcon({ playing }: { playing: boolean }) {
  const Icon = playing ? RiPauseFill : RiPlayFill;
  return <Icon size={18} aria-hidden="true" />;
}

/* ── Button sub-components ───────────────────────────────────────── */

const LoopButton = memo(function LoopButton({
  loopEnabled,
  disabled,
  setLoopEnabled,
}: {
  loopEnabled: boolean;
  disabled: boolean;
  setLoopEnabled: (v: boolean) => void;
}) {
  return (
    <Tooltip label="Loop playback">
      <button
        type="button"
        onClick={() => {
          trackStudioEvent("playback", { action: "loop_toggle", enabled: !loopEnabled });
          setLoopEnabled(!loopEnabled);
        }}
        disabled={disabled}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
          loopEnabled ? "text-accent-ink" : "text-text-tertiary hover:text-text-primary"
        }`}
        aria-label={loopEnabled ? "Disable loop playback" : "Enable loop playback"}
        aria-pressed={loopEnabled}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </button>
    </Tooltip>
  );
});

const FullscreenButton = memo(function FullscreenButton({
  isFullscreen,
  onToggleFullscreen,
}: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <Tooltip label={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}>
      <button
        type="button"
        onClick={() => {
          trackStudioEvent("playback", { action: "fullscreen_toggle", active: !isFullscreen });
          onToggleFullscreen();
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
          isFullscreen ? "text-accent-ink" : "text-text-tertiary hover:text-text-primary"
        }`}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {isFullscreen ? (
            <>
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </>
          ) : (
            <>
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </>
          )}
        </svg>
      </button>
    </Tooltip>
  );
});

/* ── Main component ──────────────────────────────────────────────── */

interface PlayerControlsProps {
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  disabled?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Replaces the shortcuts panel's list, e.g. DEFAULT_SHORTCUT_SECTIONS with entries dropped or relabelled. */
  shortcutSections?: readonly ShortcutSection[];
}

const compositionFps = () => useLinkedClipPreferences.getState().compositionFps;

export const PlayerControls = memo(function PlayerControls({
  onTogglePlay,
  onSeek,
  disabled = false,
  isFullscreen = false,
  onToggleFullscreen,
  shortcutSections,
}: PlayerControlsProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const duration = usePlayerStore((s) => s.duration);
  const timelineReady = usePlayerStore((s) => s.timelineReady);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const audioMuted = usePlayerStore((s) => s.audioMuted);
  const audioVolume = usePlayerStore((s) => s.audioVolume);
  const loopEnabled = usePlayerStore((s) => s.loopEnabled);
  const setPlaybackRate = usePlayerStore.getState().setPlaybackRate;
  const setAudioMuted = usePlayerStore.getState().setAudioMuted;
  const setAudioVolume = usePlayerStore.getState().setAudioVolume;
  const setLoopEnabled = usePlayerStore.getState().setLoopEnabled;
  const timeDisplayMode = usePlayerStore((s) => s.timeDisplayMode);
  const setTimeDisplayMode = usePlayerStore.getState().setTimeDisplayMode;

  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const currentTimeRef = useRef(0);
  const timeDisplayModeRef = useRef(timeDisplayMode);
  timeDisplayModeRef.current = timeDisplayMode;

  const durationRef = useRef(duration);
  durationRef.current = duration;
  const controlsDisabled = disabled || !timelineReady;

  useEffect(() => {
    if (!timeDisplayRef.current) return;
    const t = currentTimeRef.current;
    timeDisplayRef.current.textContent =
      timeDisplayMode === "frame" ? formatFrameTime(t, duration, compositionFps()) : formatTime(t);
  }, [duration, timeDisplayMode]);

  useMountEffect(() => {
    const updateTime = (time: number) => {
      currentTimeRef.current = time;
      if (!timeDisplayRef.current) return;
      const currentDuration = durationRef.current;
      const text =
        timeDisplayModeRef.current === "frame"
          ? formatFrameTime(time, currentDuration, compositionFps())
          : formatTime(time);
      if (timeDisplayRef.current.textContent !== text) timeDisplayRef.current.textContent = text;
    };
    const unsubscribe = liveTime.subscribe(updateTime);
    updateTime(usePlayerStore.getState().currentTime);
    return unsubscribe;
  });

  return (
    <div className="relative z-20">
      <PreviewSeekBar duration={duration} disabled={controlsDisabled} onSeek={onSeek} />
      <div
        className="grid h-7 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3"
        aria-disabled={disabled || undefined}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <Tooltip
          label={timeDisplayMode === "time" ? "Switch to frame display" : "Switch to time display"}
        >
          <button
            type="button"
            onClick={() => setTimeDisplayMode(timeDisplayMode === "time" ? "frame" : "time")}
            disabled={disabled}
            className="min-w-0 justify-self-start whitespace-nowrap font-mono text-caption-2-regular tabular-nums text-text-secondary transition-colors hover:text-text-primary disabled:pointer-events-none"
          >
            <span ref={timeDisplayRef}>{formatTime(0)}</span>
            {timeDisplayMode === "time" ? (
              <>
                <span className="mx-0.5 text-text-off">/</span>
                <span className="text-text-tertiary">{formatTime(duration)}</span>
              </>
            ) : null}
          </button>
        </Tooltip>

        <Tooltip label={isPlaying ? "Pause" : "Play"}>
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => {
              trackStudioEvent("playback", { action: isPlaying ? "pause" : "play" });
              onTogglePlay();
            }}
            disabled={controlsDisabled}
            className="flex h-7 w-8 items-center justify-center justify-self-center rounded-md text-text-primary transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-30"
          >
            <PlayPauseIcon playing={isPlaying} />
          </button>
        </Tooltip>

        <div className="flex min-w-0 items-center justify-self-end">
          <VolumeControl
            audioMuted={audioMuted}
            audioVolume={audioVolume}
            disabled={controlsDisabled}
            setAudioMuted={setAudioMuted}
            setAudioVolume={setAudioVolume}
          />
          <SpeedMenu
            playbackRate={playbackRate}
            setPlaybackRate={setPlaybackRate}
            disabled={disabled}
          />
          <LoopButton
            loopEnabled={loopEnabled}
            disabled={disabled}
            setLoopEnabled={setLoopEnabled}
          />
          {onToggleFullscreen && (
            <FullscreenButton isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} />
          )}
          <ShortcutsButton disabled={disabled} onSeek={onSeek} sections={shortcutSections} />
        </div>
      </div>
    </div>
  );
});
