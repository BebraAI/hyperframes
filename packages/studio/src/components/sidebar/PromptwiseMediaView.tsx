import { MusicNote, Plus } from "@phosphor-icons/react";
import { PROMPTWISE_ASSET_MIME } from "../../promptwise/embed";
import { mediaLength } from "../../player/components/MediaPickerDialog";
import type { PromptwiseMedia } from "../../promptwise/media";

/**
 * The promptwise project's images, videos and sounds, in Studio's Assets panel: drag one onto the
 * timeline (as from promptwise's chat), or add it at the playhead. It plays from its own address.
 */
export function PromptwiseMediaView({
  media,
  searchQuery,
  onAdd,
  used,
  quietWhenEmpty = false,
}: {
  media: PromptwiseMedia[];
  searchQuery: string;
  onAdd?: (url: string) => void;
  /** What the timeline already plays, by address: those tiles say "In video". */
  used?: ReadonlySet<string>;
  /** Says nothing when empty: the panel has other media to show below. */
  quietWhenEmpty?: boolean;
}) {
  const query = searchQuery.trim().toLowerCase();
  const found = query ? media.filter((m) => m.name.toLowerCase().includes(query)) : media;
  if (found.length === 0) {
    if (quietWhenEmpty) return null;
    return (
      <p className="px-4 py-6 text-center text-caption-1-regular text-panel-text-3">
        {query
          ? "No project media matches."
          : "The project's images, videos and sounds show up here, and those of your other chats."}
      </p>
    );
  }
  const project = found.filter((m) => !m.account);
  const account = found.filter((m) => m.account);
  return (
    <>
      <MediaGrid media={project} onAdd={onAdd} used={used} />
      {account.length > 0 && (
        <>
          <p className="px-4 pb-1 pt-2 text-caption-1-medium text-panel-text-3">
            From your other chats
          </p>
          <MediaGrid media={account} onAdd={onAdd} used={used} />
        </>
      )}
    </>
  );
}

function MediaGrid({
  media,
  onAdd,
  used,
}: {
  media: PromptwiseMedia[];
  onAdd?: (url: string) => void;
  used?: ReadonlySet<string>;
}) {
  if (media.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-1 px-2 pb-1">
      {media.map((m) => (
        <button
          key={m.url}
          type="button"
          draggable
          title={
            onAdd ? `${m.name}: drag onto the timeline, or click to add it at the playhead` : m.name
          }
          onClick={() => onAdd?.(m.url)}
          onDragStart={(e) => {
            e.dataTransfer.setData(PROMPTWISE_ASSET_MIME, JSON.stringify([{ url: m.url }]));
            e.dataTransfer.effectAllowed = "copy";
          }}
          data-promptwise-media={m.kind}
          className="group flex min-w-0 flex-col gap-1 rounded-lg p-1 text-left transition-colors hover:bg-panel-input"
        >
          <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-panel-input">
            {m.kind === "audio" ? (
              <span className="flex h-full items-center justify-center text-panel-text-3">
                <MusicNote size={20} weight="fill" aria-label="Sound" />
              </span>
            ) : m.kind === "video" && !m.thumb ? (
              <video src={m.url} muted preload="metadata" className="h-full w-full object-cover" />
            ) : (
              <img
                src={m.thumb ?? m.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
            {used?.has(m.url) && (
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-caption-2-medium text-white">
                In video
              </span>
            )}
            {mediaLength(m.duration) && (
              <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-caption-2-medium text-white">
                {mediaLength(m.duration)}
              </span>
            )}
            {onAdd && (
              // Says on the tile what a click does: the title alone is found by nobody.
              <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Plus size={11} weight="bold" />
              </span>
            )}
          </span>
          <span className="truncate px-0.5 text-caption-2-regular text-panel-text-2">{m.name}</span>
        </button>
      ))}
    </div>
  );
}
