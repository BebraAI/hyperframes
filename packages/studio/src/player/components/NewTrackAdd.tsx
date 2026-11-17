import { useCallback, useRef, type ReactElement, type ReactNode, type RefObject } from "react";
import { Plus } from "@phosphor-icons/react";
import { IconLibraryPhoto, IconUpload } from "../../boardui/components/icons";
import { IconButton, Menu, MenuItem } from "../../components/ui";
import { useDockLayoutStore } from "../../components/dock/dockLayoutStore";
import { embeddedInPromptwise } from "../../promptwise/embed";
import { usePlayerStore } from "../store/playerStore";
import { getDefaultDroppedTrack } from "./timelineLayout";
import type { TimelineDropCallbacks } from "./timelineCallbacks";

/**
 * Files from the computer onto the timeline: a new track at the playhead, or `at` a given track and
 * time. None where the timeline takes no files.
 */
export function useAddFilesToNewTrack(
  onFileDrop: TimelineDropCallbacks["onFileDrop"],
  trackOrderRef: RefObject<number[]>,
  readOnly: boolean,
) {
  const add = useCallback(
    (files: File[], at?: { track: number; start: number }) => {
      const order = trackOrderRef.current;
      const { currentTime, elements } = usePlayerStore.getState();
      // Into an empty timeline the first clip starts it; later ones go where the playhead is.
      const start = elements.length ? currentTime : 0;
      void onFileDrop?.(files, at ?? { start, track: getDefaultDroppedTrack(order, order.length) });
    },
    [onFileDrop, trackOrderRef],
  );
  return onFileDrop && !readOnly ? add : undefined;
}

/** A row of the add menu: an icon in its tile, the choice, and a line on where the media comes from. */
const ROW = "justify-start p-1.5";

function AddMediaChoice({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body-2-medium text-text-primary">{title}</span>
        <span className="truncate text-caption-1-regular text-text-tertiary">{detail}</span>
      </span>
    </span>
  );
}

interface AddMediaMenuProps {
  onFiles: (files: File[]) => void;
  /**
   * The control that opens it. Inside promptwise it opens "From gallery / Upload from computer";
   * elsewhere there is no gallery, so it gets `onClick` and opens the file picker straight away.
   */
  trigger: (onClick?: () => void) => ReactElement;
}

/** Media from promptwise's project (the Assets panel) or files from the computer. */
export function AddMediaMenu({ onFiles, trigger }: AddMediaMenuProps) {
  const input = useRef<HTMLInputElement>(null);
  const activatePanel = useDockLayoutStore((state) => state.activatePanel);
  const pick = () => input.current?.click();
  return (
    <>
      {embeddedInPromptwise ? (
        <Menu aria-label="Add media" className="w-64 gap-0.5 p-1.5" trigger={trigger()}>
          <MenuItem className={ROW} onClick={() => activatePanel("assets")}>
            <AddMediaChoice
              icon={<IconLibraryPhoto />}
              title="From gallery"
              detail="Project media and chats"
            />
          </MenuItem>
          <MenuItem className={ROW} onClick={pick}>
            <AddMediaChoice
              icon={<IconUpload />}
              title="Upload from computer"
              detail="Video, image or sound"
            />
          </MenuItem>
        </Menu>
      ) : (
        trigger(pick)
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        hidden
        data-testid="new-track-files"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

/**
 * A track's "+", where its lane begins: a dashed square that takes the accent on hover, as the
 * old promptwise timeline had it. What it adds lands on that track, after its last clip.
 */
export function TrackAddButton({
  onFiles,
  trackName,
}: {
  onFiles: (files: File[]) => void;
  trackName: string;
}) {
  const label = `Add media to ${trackName}`;
  return (
    <AddMediaMenu
      onFiles={onFiles}
      trigger={(onClick) => (
        <button
          type="button"
          aria-label={label}
          title={label}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--timeline-text-faint)] bg-transparent p-0 text-[var(--timeline-text-faint)] transition-colors hover:border-[var(--timeline-accent)] hover:text-[var(--timeline-accent)] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-[var(--timeline-accent)]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
        >
          <Plus size={12} weight="bold" />
        </button>
      )}
    />
  );
}

/** A track's "+" adds after its last clip, so nothing it brings lands on a clip already there. */
export function trackEnd(elements: readonly { start: number; duration: number }[]): number {
  return Math.max(0, ...elements.map((element) => element.start + element.duration));
}

/** The empty lane's "+". */
export function NewTrackAdd({ onFiles }: { onFiles: (files: File[]) => void }) {
  return (
    // The lane lets pointers through to the timeline; the button takes its own, so a click doesn't seek or select.
    <div
      className="pointer-events-auto absolute left-1.5"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <AddMediaMenu
        onFiles={onFiles}
        trigger={(onClick) => (
          <IconButton
            size="sm"
            aria-label="Add media"
            icon={<Plus size={14} />}
            onClick={onClick}
          />
        )}
      />
    </div>
  );
}
