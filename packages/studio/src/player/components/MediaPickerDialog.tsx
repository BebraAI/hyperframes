import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, MusicNote } from "@phosphor-icons/react";
import { IconUpload } from "../../boardui/components/icons";
import { Button, Skeleton } from "../../components/ui";
import { DialogHeader, dialogClasses } from "../../components/ui/Dialog";
import { cn } from "../../components/ui/cn";
import { SearchInput } from "../../components/ui/SearchInput";
import { useDialogBehavior } from "../../components/ui/useDialogBehavior";
import { usePromptwiseMedia, type PromptwiseMedia } from "../../promptwise/media";

type Kind = PromptwiseMedia["kind"] | "all";
const KINDS: ReadonlyArray<readonly [Kind, string]> = [
  ["all", "All"],
  ["video", "Videos"],
  ["image", "Images"],
  ["audio", "Sounds"],
];

/** "1:05" for a sound's or a video's length; nothing when promptwise didn't say. */
export function mediaLength(seconds: number | undefined): string | null {
  if (!seconds) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** What the picker lists for a kind and a search, the project's before the account's. */
export function pickable(media: readonly PromptwiseMedia[], kind: Kind, query: string) {
  const q = query.trim().toLowerCase();
  const found = media.filter(
    (m) => (kind === "all" || m.kind === kind) && (!q || m.name.toLowerCase().includes(q)),
  );
  return { project: found.filter((m) => !m.account), account: found.filter((m) => m.account) };
}

interface MediaPickerDialogProps {
  /** Where the picks land, said in the title: "track 2", "a new track". */
  target: string;
  onPick: (urls: string[]) => void;
  onUpload: () => void;
  onClose: () => void;
}

/**
 * The gallery, opened from a "+": pick one or several of the project's media (or the account's from
 * other chats) and they land where the "+" was, in the order picked. It replaces sending the user
 * to the Assets panel, which was usually open already, so the click seemed to do nothing, and which
 * added at the playhead rather than on the track the "+" belonged to.
 */
export function MediaPickerDialog({ target, onPick, onUpload, onClose }: MediaPickerDialogProps) {
  const media = usePromptwiseMedia();
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { requestClose } = useDialogBehavior({ open: true, onClose, containerRef });
  const { project, account } = pickable(media ?? [], kind, query);
  const toggle = (url: string) =>
    setPicked((now) => (now.includes(url) ? now.filter((u) => u !== url) : [...now, url]));
  const add = (urls: string[]) => {
    if (urls.length === 0) return;
    onPick(urls);
    onClose();
  };
  const nothing = project.length === 0 && account.length === 0;

  return createPortal(
    <div className={cn(dialogClasses.backdrop, dialogClasses.centered)} onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Add media to ${target}`}
        tabIndex={-1}
        className={cn(dialogClasses.panel, "h-[560px] w-[640px] max-w-full")}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogHeader
          title="Add media"
          description={`Pick one or several. They go on ${target}, one after another.`}
          onClose={onClose}
        />
        <div className="flex items-center gap-2 px-5 pb-3">
          <div className="flex gap-1" role="radiogroup" aria-label="Kind">
            {KINDS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-caption-1-medium transition-colors",
                  kind === value
                    ? "bg-text-primary text-background-primary-default"
                    : "bg-background-secondary-default text-text-secondary hover:text-text-primary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto w-48">
            <SearchInput
              aria-label="Search media"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
            />
          </div>
        </div>
        <div className={cn(dialogClasses.body, "pb-2")}>
          {media === null || (media.length === 0 && !query && kind === "all") ? (
            <PickerEmpty loading={media === null} onUpload={onUpload} />
          ) : nothing ? (
            <p className="py-10 text-center text-body-regular text-text-tertiary">
              Nothing matches.
            </p>
          ) : (
            <>
              <PickerGrid media={project} picked={picked} onToggle={toggle} onAdd={add} />
              {account.length > 0 && (
                <>
                  <p className="pb-2 pt-4 text-caption-1-medium text-text-tertiary">
                    From your other chats
                  </p>
                  <PickerGrid media={account} picked={picked} onToggle={toggle} onAdd={add} />
                </>
              )}
            </>
          )}
        </div>
        <div className={cn(dialogClasses.footer, "border-t border-border-button-default")}>
          <Button variant="ghost" icon={<IconUpload />} onClick={onUpload}>
            Upload from computer
          </Button>
          <Button variant="primary" disabled={picked.length === 0} onClick={() => add(picked)}>
            {picked.length > 1 ? `Add ${picked.length}` : "Add"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PickerEmpty({ loading, onUpload }: { loading: boolean; onUpload: () => void }) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading media" className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, tile) => (
          <Skeleton key={tile} className="aspect-video w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-body-medium text-text-primary">No media in this project yet</p>
      <p className="max-w-xs text-body-regular text-text-tertiary">
        Images, videos and sounds from the chat show up here. You can also upload your own.
      </p>
      <Button icon={<IconUpload />} onClick={onUpload}>
        Upload from computer
      </Button>
    </div>
  );
}

function PickerGrid({
  media,
  picked,
  onToggle,
  onAdd,
}: {
  media: PromptwiseMedia[];
  picked: string[];
  onToggle: (url: string) => void;
  onAdd: (urls: string[]) => void;
}) {
  if (media.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-2">
      {media.map((m) => {
        const order = picked.indexOf(m.url);
        const length = mediaLength(m.duration);
        return (
          <button
            key={m.url}
            type="button"
            aria-pressed={order >= 0}
            title={`${m.name}: click to pick, double-click to add`}
            onClick={() => onToggle(m.url)}
            onDoubleClick={() => onAdd([m.url])}
            className={cn(
              "group flex min-w-0 flex-col gap-1 rounded-xl p-1 text-left outline-none transition-colors",
              "hover:bg-background-secondary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              order >= 0 && "bg-background-secondary-default",
            )}
          >
            <span
              className={cn(
                "relative block aspect-video w-full overflow-hidden rounded-lg bg-background-tertiary-default ring-2 ring-transparent transition-shadow",
                order >= 0 && "ring-[var(--color-accent-500)]",
              )}
            >
              <MediaThumb media={m} />
              {length && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-caption-2-medium text-white">
                  {length}
                </span>
              )}
              <span
                className={cn(
                  "absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border text-caption-2-bold transition-opacity",
                  order >= 0
                    ? "border-transparent bg-[var(--color-accent-500)] text-white"
                    : "border-white/80 bg-black/20 opacity-0 group-hover:opacity-100",
                )}
              >
                {order >= 0 ? order + 1 : <Check size={10} weight="bold" className="opacity-0" />}
              </span>
            </span>
            <span className="truncate px-0.5 text-caption-1-regular text-text-secondary">
              {m.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MediaThumb({ media }: { media: PromptwiseMedia }) {
  if (media.kind === "audio") {
    return (
      <span className="flex h-full items-center justify-center text-foreground-icon-secondary">
        <MusicNote size={22} weight="fill" />
      </span>
    );
  }
  if (media.kind === "video" && !media.thumb) {
    return (
      <video src={media.url} muted preload="metadata" className="h-full w-full object-cover" />
    );
  }
  return (
    <img
      src={media.thumb ?? media.url}
      alt=""
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}
