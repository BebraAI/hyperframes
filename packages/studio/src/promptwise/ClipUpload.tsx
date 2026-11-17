import type { MouseEvent, PointerEvent } from "react";
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

const ACTION =
  "pointer-events-auto cursor-pointer rounded-[3px] border border-white/30 bg-black/55 px-1 text-[9px] leading-[14px] text-white hover:bg-black/75";

/**
 * A clip whose file is still going up to promptwise: a bar filling across it as it goes. One that failed says so and
 * offers Retry, or Remove, which deletes the clip (and the file goes with it).
 */
export function ClipUpload({ el }: { el: TimelineElement }) {
  const path = clipUploadPath(el.src);
  const upload = usePromptwiseUploadMap().get(path ?? "");
  const { onDeleteElementOnly } = useTimelineEditContextOptional();
  if (!path || !upload || !el.src) return null;
  const src = el.src;
  if (upload.failed) {
    return (
      <span
        className="pointer-events-none absolute inset-0 z-[32] flex items-center gap-1 bg-red-950/70 px-1.5"
        data-testid="clip-upload"
      >
        <span role="status" className="truncate text-[10px] text-white">
          Upload failed
        </span>
        <span
          role="button"
          tabIndex={-1}
          className={ACTION}
          onPointerDown={stop}
          onClick={(event) => {
            stop(event);
            void studioApiFetch(retryUrl(src, path), { method: "POST" });
          }}
        >
          Retry
        </span>
        {onDeleteElementOnly && (
          <span
            role="button"
            tabIndex={-1}
            className={ACTION}
            onPointerDown={stop}
            onClick={(event) => {
              stop(event);
              void onDeleteElementOnly(el);
            }}
          >
            Remove
          </span>
        )}
      </span>
    );
  }
  const percent = upload.total
    ? Math.round((Math.min(upload.sent, upload.total) / upload.total) * 100)
    : 0;
  return (
    <span
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[32] h-[3px] bg-black/40"
      data-testid="clip-upload"
      role="progressbar"
      aria-label="Uploading"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="absolute inset-y-0 left-0 bg-studio-accent transition-[width] duration-200"
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}
