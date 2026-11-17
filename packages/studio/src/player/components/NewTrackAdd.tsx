import {
  forwardRef,
  useCallback,
  type ComponentPropsWithoutRef,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { MediaPickerDialog } from "./MediaPickerDialog";
import { pickInHost, useHostPicker } from "../../promptwise/hostPicker";
import { Plus } from "@phosphor-icons/react";
import { IconLibraryPhoto, IconUpload } from "../../boardui/components/icons";
import { Menu, MenuItem } from "../../components/ui";
import { embeddedInPromptwise } from "../../promptwise/embed";
import { usePlayerStore } from "../store/playerStore";
import { getDefaultDroppedTrack } from "./timelineLayout";
import type { TimelineDropCallbacks } from "./timelineCallbacks";

/** Files from the computer, or the addresses of media picked from promptwise's gallery. */
export type AddedMedia = File[] | string[];
type Placement = { track: number; start: number };

const isFiles = (media: AddedMedia): media is File[] => media[0] instanceof File;

const AUDIO_URL = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac)(?:[?#]|$)/i;

/**
 * Gallery picks land one after another from `at`, in the order picked, as a drop of several does. Sounds picked
 * with pictures go under them: from the same start, on the track `soundTrack`, one after another there.
 */
export async function placeUrls(
  urls: readonly string[],
  at: Placement,
  onAssetDrop: NonNullable<TimelineDropCallbacks["onAssetDrop"]>,
  soundTrack: number,
) {
  const sounds = urls.filter((url) => AUDIO_URL.test(url));
  const pictures = urls.filter((url) => !AUDIO_URL.test(url));
  const chain = async (list: readonly string[], from: Placement) => {
    let next = from;
    for (const url of list) {
      const clip = await onAssetDrop(url, next);
      if (clip) next = { start: clip.start + clip.duration, track: clip.track };
    }
  };
  await chain(pictures, at);
  await chain(sounds, pictures.length ? { start: at.start, track: soundTrack } : at);
}

/**
 * Media onto the timeline: a new track at the playhead, or `at` a given track and time. None where
 * the timeline takes no files.
 */
export function useAddMedia(
  onFileDrop: TimelineDropCallbacks["onFileDrop"],
  onAssetDrop: TimelineDropCallbacks["onAssetDrop"],
  trackOrderRef: RefObject<number[]>,
  readOnly: boolean,
) {
  const add = useCallback(
    (media: AddedMedia, at?: Placement) => {
      const order = trackOrderRef.current;
      const { currentTime, elements } = usePlayerStore.getState();
      // Into an empty timeline the first clip starts it; later ones go where the playhead is.
      const start = elements.length ? currentTime : 0;
      const where = at ?? { start, track: getDefaultDroppedTrack(order, order.length) };
      if (isFiles(media)) void onFileDrop?.(media, where);
      // Sounds picked with pictures take a track of their own, past every track there is.
      else if (onAssetDrop)
        void placeUrls(media, where, onAssetDrop, Math.max(where.track, ...order) + 1);
    },
    [onFileDrop, onAssetDrop, trackOrderRef],
  );
  return onFileDrop && !readOnly ? add : undefined;
}

/** A row of the add menu: an icon in its tile, the choice, and a line on where the media comes from. */
const ROW = "justify-start rounded-xl px-2 py-2";

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
    <span className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary-default">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-2-medium text-text-primary">{title}</span>
        <span className="truncate text-caption-1-regular text-text-tertiary">{detail}</span>
      </span>
    </span>
  );
}

interface AddMediaMenuProps {
  onAdd: (media: AddedMedia) => void;
  /** Where what it adds lands, as the gallery's title says it: "track 2", "a new track". */
  target?: string;
  /**
   * The control that opens it. Inside promptwise it opens "From gallery / Upload from computer";
   * elsewhere there is no gallery, so it gets `onClick` and opens the file picker straight away.
   */
  trigger: (onClick?: () => void) => ReactElement;
}

/**
 * The two sources of media, for a control that offers them: `openGallery` opens promptwise's gallery
 * in a dialog (inside promptwise only), `pickFiles` the computer's file picker. Render `sources`
 * once beside the control: the dialog and the hidden file input.
 */
export function useMediaSources(onAdd: (media: AddedMedia) => void, target = "a new track") {
  const input = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState(false);
  const pickFiles = () => input.current?.click();
  // The tab's own Assets window where it has one; Studio's gallery where it doesn't.
  const host = useHostPicker();
  const openHost = () =>
    void pickInHost(target).then(({ media, files }) => {
      if (files.length) onAdd(files);
      else if (media.length) onAdd(media.map((m) => m.url));
    });
  const sources = (
    <>
      {gallery && (
        <MediaPickerDialog
          target={target}
          onPick={onAdd}
          onUpload={() => {
            setGallery(false);
            pickFiles();
          }}
          onClose={() => setGallery(false)}
        />
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
          if (files.length) onAdd(files);
        }}
      />
    </>
  );
  return {
    openGallery: embeddedInPromptwise ? (host ? openHost : () => setGallery(true)) : undefined,
    pickFiles,
    /** The tab's Assets window has Upload too, so a "+" opens it straight away instead of a menu. */
    host,
    sources,
  };
}

/**
 * Stops a press inside from reaching the timeline. The menu and the gallery are portals, but React
 * still bubbles their events through here: a track header's or a lane's pointer handlers would take
 * an item's press as a seek or a select.
 */
export function MediaSourcesScope({ children }: { children: ReactNode }) {
  return (
    <span
      className="contents"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </span>
  );
}

/** Media from promptwise's gallery, picked in a dialog where the "+" was, or files from the computer. */
function AddMediaMenu({ onAdd, target = "a new track", trigger }: AddMediaMenuProps) {
  const { openGallery, pickFiles, sources, host } = useMediaSources(onAdd, target);
  return (
    <MediaSourcesScope>
      {host && openGallery ? (
        trigger(openGallery)
      ) : openGallery ? (
        <Menu aria-label="Add media" className="w-72 gap-1 p-2" sideOffset={8} trigger={trigger()}>
          <MenuItem className={ROW} onClick={openGallery}>
            <AddMediaChoice
              icon={<IconLibraryPhoto />}
              title="From gallery"
              detail="Project media and chats"
            />
          </MenuItem>
          <MenuItem className={ROW} onClick={pickFiles}>
            <AddMediaChoice
              icon={<IconUpload />}
              title="Upload from computer"
              detail="Video, image or sound"
            />
          </MenuItem>
        </Menu>
      ) : (
        trigger(pickFiles)
      )}
      {sources}
    </MediaSourcesScope>
  );
}

/**
 * A track's "+", where its lane begins: a dashed square that takes the accent on hover, as the
 * old promptwise timeline had it. What it adds lands on that track, after its last clip.
 */
export function TrackAddButton({
  onAdd,
  trackName,
}: {
  onAdd: (media: AddedMedia) => void;
  trackName: string;
}) {
  const label = `Add media to ${trackName}`;
  return (
    <AddMediaMenu
      onAdd={onAdd}
      target={trackName}
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

/**
 * The empty lane's "+": the whole lane is the button, so a click anywhere on it opens the add menu,
 * not only on the "+" at its start. A drag still goes through it to the timeline.
 */
export function NewTrackAdd({ onAdd }: { onAdd: (media: AddedMedia) => void }) {
  return (
    // The lane lets pointers through to the timeline; the button takes its own, so a click doesn't seek or select.
    <div
      className="pointer-events-auto absolute inset-0"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <AddMediaMenu onAdd={onAdd} trigger={(onClick) => <NewLaneButton onClick={onClick} />} />
    </div>
  );
}

/** Base UI's menu trigger passes its props and ref through here. */
const NewLaneButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(
  function NewLaneButton({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Add media"
        title="Add media"
        className={`group/lane flex h-full w-full cursor-pointer items-center rounded-lg ps-1.5 text-text-tertiary transition-colors hover:bg-studio-accent/6 focus-visible:outline-2 focus-visible:outline-studio-accent data-popup-open:bg-studio-accent/6 ${className ?? ""}`}
        {...props}
      >
        <span className="flex size-6 items-center justify-center rounded-md transition-colors group-hover/lane:bg-background-secondary-default group-hover/lane:text-text-primary">
          <Plus size={14} />
        </span>
      </button>
    );
  },
);
