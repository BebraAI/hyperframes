import { useCallback, useRef, type ReactElement, type RefObject } from "react";
import { Plus } from "@phosphor-icons/react";
import { IconButton, Menu, MenuItem } from "../../components/ui";
import { useDockLayoutStore } from "../../components/dock/dockLayoutStore";
import { embeddedInPromptwise } from "../../promptwise/embed";
import { usePlayerStore } from "../store/playerStore";
import { getDefaultDroppedTrack } from "./timelineLayout";
import type { TimelineDropCallbacks } from "./timelineCallbacks";

/** Files from the computer onto a new track at the playhead; none where the timeline takes no files. */
export function useAddFilesToNewTrack(
  onFileDrop: TimelineDropCallbacks["onFileDrop"],
  trackOrderRef: RefObject<number[]>,
  readOnly: boolean,
) {
  const add = useCallback(
    (files: File[]) => {
      const order = trackOrderRef.current;
      const { currentTime, elements } = usePlayerStore.getState();
      // Into an empty timeline the first clip starts it; later ones go where the playhead is.
      const start = elements.length ? currentTime : 0;
      void onFileDrop?.(files, { start, track: getDefaultDroppedTrack(order, order.length) });
    },
    [onFileDrop, trackOrderRef],
  );
  return onFileDrop && !readOnly ? add : undefined;
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
        <Menu aria-label="Add media" trigger={trigger()}>
          <MenuItem onClick={() => activatePanel("assets")}>From gallery</MenuItem>
          <MenuItem onClick={pick}>Upload from computer</MenuItem>
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
