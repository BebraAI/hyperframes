import type { DragEventHandler } from "react";
import { UploadingText, usePromptwiseUploads } from "../../promptwise/uploads";
import { IconLibraryPhoto, IconUpload } from "../../boardui/components/icons";
import { Button, Skeleton } from "../../components/ui";
import { MediaSourcesScope, useMediaSources, type AddedMedia } from "./NewTrackAdd";
import { GUTTER, LANE_H, RULER_H } from "./timelineLayout";

interface TimelineEmptyStateProps {
  isDragOver: boolean;
  onFileDrop?: boolean;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  /** Media added from the gallery or the computer; the empty timeline then offers both as buttons. */
  onAddFiles?: (media: AddedMedia) => void;
  /** The composition is still loading: show its tracks' skeleton, not "empty". */
  loading?: boolean;
}

/**
 * The empty timeline's start: what it is, and the two ways to fill it as buttons, as CapCut's and
 * Clipchamp's empty timelines offer import right there. The lane around it still takes a drop.
 */
function EmptyTimelineStart({ onAdd }: { onAdd: (media: AddedMedia) => void }) {
  const { openGallery, pickFiles, sources } = useMediaSources(onAdd);
  return (
    <MediaSourcesScope>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col gap-0.5">
          <p className="text-body-medium text-text-primary">Your timeline is empty</p>
          <p className="text-caption-1-regular text-text-tertiary">
            Drop media here, add it, or describe your video in the chat
          </p>
        </div>
        <div className="flex gap-2">
          {openGallery && (
            <Button size="md" icon={<IconLibraryPhoto />} onClick={openGallery}>
              From gallery
            </Button>
          )}
          <Button size="md" icon={<IconUpload />} onClick={pickFiles}>
            Upload
          </Button>
        </div>
      </div>
      {sources}
    </MediaSourcesScope>
  );
}

const ZONE =
  "relative overflow-hidden flex items-center gap-3 px-6 py-3 border border-dashed rounded-lg transition-colors duration-150";

export function TimelineEmptyState({
  isDragOver,
  onFileDrop,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddFiles,
  loading,
}: TimelineEmptyStateProps) {
  const uploading = usePromptwiseUploads();
  return (
    <div
      className={`h-full border-t bg-[var(--timeline-shell-bg)] flex flex-col select-none transition-colors duration-150 ${
        isDragOver ? "border-studio-accent/50 bg-studio-accent/3" : "border-border-button-default"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Ruler */}
      <div
        className="shrink-0 border-b border-border-button-default flex items-end relative"
        style={{ height: RULER_H, paddingLeft: GUTTER }}
      >
        {[0, 10, 20, 30, 40, 50].map((s) => (
          <div
            key={s}
            className="flex flex-col items-center"
            style={{ position: "absolute", left: GUTTER + s * 14 }}
          >
            <span className="text-[9px] text-text-tertiary font-mono tabular-nums leading-none mb-0.5">
              {`${Math.floor(s / 60)
                .toString()
                .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`}
            </span>
            <div className="w-px h-[5px] bg-background-tertiary-default" />
          </div>
        ))}
      </div>
      {/* Empty drop zone */}
      <div className="flex-1 flex items-center justify-center">
        <EmptyLane
          loading={loading}
          isDragOver={isDragOver}
          uploading={uploading}
          onAddFiles={onAddFiles}
          onFileDrop={onFileDrop}
        />
      </div>
    </div>
  );
}

/** What the empty lane shows: loading, a drop over it, an upload, or how to start. */
function EmptyLane({
  loading,
  isDragOver,
  uploading,
  onAddFiles,
  onFileDrop,
}: Pick<TimelineEmptyStateProps, "loading" | "isDragOver" | "onAddFiles" | "onFileDrop"> & {
  uploading: ReturnType<typeof usePromptwiseUploads>;
}) {
  if (loading) return <TracksSkeleton />;
  if (isDragOver) {
    return (
      <div className={`${ZONE} border-studio-accent/60 bg-studio-accent/6`}>
        <UploadIcon className="text-accent-ink" />
        <span className="text-[13px] text-accent-ink">Drop media files to import</span>
      </div>
    );
  }
  if (uploading) {
    return (
      <div className={`${ZONE} border-studio-accent/60`}>
        <UploadingText uploading={uploading} />
      </div>
    );
  }
  if (onAddFiles) return <EmptyTimelineStart onAdd={onAddFiles} />;
  return (
    <div className={`${ZONE} border-border-button-default`}>
      <TimelineIcon />
      <span className="text-[13px] text-text-tertiary">
        {onFileDrop
          ? "Drop media here or describe your video to start"
          : "Describe your video to start creating"}
      </span>
    </div>
  );
}

/** Three tracks of clip-shaped bars while the composition loads, as the Studio skeleton draws them. */
function TracksSkeleton() {
  const rows = [
    [0, 38, 42, 30],
    [12, 24],
    [4, 56],
  ];
  return (
    <div
      role="status"
      aria-label="Loading timeline"
      className="flex w-full flex-col gap-2 self-start pt-2"
      style={{ paddingLeft: GUTTER, paddingRight: GUTTER }}
    >
      {rows.map((row, track) => (
        <div key={track} className="flex gap-1" style={{ height: LANE_H }}>
          {row.map((width, clip) =>
            clip === 0 ? (
              <span key={clip} style={{ width: `${width}%` }} />
            ) : (
              <span key={clip} className="h-full" style={{ width: `${width}%` }}>
                <Skeleton className="h-full w-full rounded-md" />
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function UploadIcon({ className }: { className: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${className} shrink-0`}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-text-tertiary shrink-0"
    >
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M7 2v20" />
      <path d="M17 2v20" />
      <path d="M2 7h20" />
      <path d="M2 17h20" />
    </svg>
  );
}
