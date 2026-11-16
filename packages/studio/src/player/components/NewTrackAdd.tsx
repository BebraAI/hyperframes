import { useCallback, useRef, type RefObject } from "react";
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
      const start = usePlayerStore.getState().currentTime;
      void onFileDrop?.(files, { start, track: getDefaultDroppedTrack(order, order.length) });
    },
    [onFileDrop, trackOrderRef],
  );
  return onFileDrop && !readOnly ? add : undefined;
}

/** The empty lane's "+": media from promptwise's project (the Assets panel) or files from the computer. */
export function NewTrackAdd({
  onFiles,
  className = "absolute left-1.5",
}: {
  onFiles: (files: File[]) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const activatePanel = useDockLayoutStore((state) => state.activatePanel);
  return (
    // The lane lets pointers through to the timeline; the button takes its own, so a click doesn't seek or select.
    <div
      className={`pointer-events-auto ${className}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Menu
        aria-label="Add media"
        trigger={<IconButton size="sm" aria-label="Add media" icon={<Plus size={14} />} />}
      >
        {embeddedInPromptwise && (
          <MenuItem onClick={() => activatePanel("assets")}>From gallery</MenuItem>
        )}
        <MenuItem onClick={() => input.current?.click()}>Upload from computer</MenuItem>
      </Menu>
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
    </div>
  );
}
