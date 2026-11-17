import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { Chip } from "../boardui/components/base/badges/chip";
import { buttonStyles } from "../boardui/components/base/buttons/button";
import { IconAlertCircle, IconRefresh, IconTrash, IconUpload } from "../boardui/components/icons";
import { buttonBase, buttonVariants } from "../components/ui/Button";
import { cn } from "../components/ui/cn";
import { Tooltip } from "../components/ui/Tooltip";
import type { TimelineElement } from "../player/store/playerStore";
import { useTimelineEditContextOptional } from "../contexts/TimelineEditContext";
import { studioApiFetch } from "../utils/studioApiFetch";
import { PREVIEW, clipUploadPath, usePromptwiseUploadMap } from "./uploads";

/** Studio's ask to send a file that failed up again: the project's API, beside the preview it's served from. */
export function retryUrl(src: string, path: string): string {
  const at = PREVIEW.exec(src)!;
  const api = src.slice(0, at.index + at[0].length - "preview/".length);
  return `${api}upload-retry?path=${encodeURIComponent(path)}`;
}

const stop = (event: PointerEvent | MouseEvent) => event.stopPropagation();

// The clip is a <button>, so its actions can't be: spans dressed as BoardUI's xs icon button.
const ACTION = cn(
  buttonBase,
  buttonVariants.secondary,
  buttonStyles.size.xs,
  buttonStyles.iconOnlySize.xs,
  "pointer-events-auto cursor-pointer [&_svg]:size-3.5",
);

/** One of a failed clip's actions, named by its tooltip. */
function ClipAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Tooltip label={label}>
      <span
        role="button"
        tabIndex={-1}
        aria-label={label}
        className={ACTION}
        onPointerDown={stop}
        onDoubleClick={stop}
        onClick={(event) => {
          stop(event);
          onPress();
        }}
      >
        {icon}
      </span>
    </Tooltip>
  );
}

/** A clip whose upload failed: a rose outline, its words in a rose chip, then Retry and Remove. */
function FailedUpload({ el, src, path }: { el: TimelineElement; src: string; path: string }) {
  const { onDeleteElementOnly } = useTimelineEditContextOptional();
  return (
    <span
      className="@container pointer-events-none absolute inset-0 z-[32] flex items-center justify-end gap-1 rounded-[inherit] px-1 ring-2 ring-status-rose-text ring-inset"
      data-testid="clip-upload"
    >
      <Chip variant="caption" color="rose" role="status" className="min-w-0 gap-1">
        <IconAlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate @max-[10rem]:sr-only">Upload failed</span>
      </Chip>
      <ClipAction
        label="Retry upload"
        icon={<IconRefresh />}
        onPress={() => void studioApiFetch(retryUrl(src, path), { method: "POST" })}
      />
      {onDeleteElementOnly && (
        <ClipAction
          label="Remove clip"
          icon={<IconTrash />}
          onPress={() => void onDeleteElementOnly(el)}
        />
      )}
    </span>
  );
}

/**
 * A clip whose file is still going up to promptwise: a chip with how much is up, over a bar along the clip's foot, in
 * the shape of promptwise's own progress bars. The clip plays from the computer meanwhile, which the chip's tooltip
 * says. One that failed says so and offers Retry, or Remove, which deletes the clip (and the file goes with it).
 */
export function ClipUpload({ el }: { el: TimelineElement }) {
  const path = clipUploadPath(el.src);
  const upload = usePromptwiseUploadMap().get(path ?? "");
  if (!path || !upload || !el.src) return null;
  if (upload.failed) return <FailedUpload el={el} src={el.src} path={path} />;
  const percent = upload.total
    ? Math.round((Math.min(upload.sent, upload.total) / upload.total) * 100)
    : 0;
  const name = path.split("/").pop()!;
  return (
    <span className="pointer-events-none absolute inset-0 z-[32]" data-testid="clip-upload">
      <Tooltip
        label={`Uploading ${name} · ${percent}%. The clip plays from your computer until it's saved: keep this tab open.`}
        lines={3}
      >
        <Chip
          variant="caption"
          color="soft"
          className="pointer-events-auto absolute right-1 top-1 gap-1 tabular-nums shadow-sm"
        >
          <IconUpload className="size-3.5 shrink-0" aria-hidden="true" />
          {percent}%
        </Chip>
      </Tooltip>
      <span
        className="absolute inset-x-1.5 bottom-1 h-1 overflow-hidden rounded-full bg-black/35"
        role="progressbar"
        aria-label={`Uploading ${name}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="block h-full rounded-full bg-accent-500 transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  );
}
