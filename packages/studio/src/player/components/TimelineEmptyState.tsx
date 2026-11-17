import { forwardRef, type ComponentPropsWithoutRef, type DragEventHandler } from "react";
import { UploadingText, usePromptwiseUploads } from "../../promptwise/uploads";
import { AddMediaMenu, type AddedMedia } from "./NewTrackAdd";
import { GUTTER, RULER_H } from "./timelineLayout";

interface TimelineEmptyStateProps {
  isDragOver: boolean;
  onFileDrop?: boolean;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  /** Files picked from the computer; the drop zone is then also a button that opens the picker. */
  onAddFiles?: (media: AddedMedia) => void;
}

const ZONE =
  "relative overflow-hidden flex items-center gap-3 px-6 py-3 border border-dashed rounded-lg transition-colors duration-150";

/** The drop zone as a button: Base UI's menu trigger passes its props and ref through here. */
const ZoneButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(
  function ZoneButton({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={`${ZONE} border-border-button-default cursor-pointer hover:border-studio-accent/60 hover:bg-studio-accent/6 focus-visible:outline-2 focus-visible:outline-studio-accent ${className ?? ""}`}
        {...props}
      />
    );
  },
);

export function TimelineEmptyState({
  isDragOver,
  onFileDrop,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddFiles,
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
        {isDragOver ? (
          <div className={`${ZONE} border-studio-accent/60 bg-studio-accent/6`}>
            <UploadIcon className="text-accent-ink" />
            <span className="text-[13px] text-accent-ink">Drop media files to import</span>
          </div>
        ) : uploading ? (
          <div className={`${ZONE} border-studio-accent/60`}>
            <UploadingText uploading={uploading} />
          </div>
        ) : onAddFiles ? (
          <AddMediaMenu
            onAdd={onAddFiles}
            trigger={(onClick) => (
              <ZoneButton onClick={onClick}>
                <UploadIcon className="text-text-tertiary" />
                <span className="text-[13px] text-text-tertiary">
                  Drop or upload media, or describe your video to start
                </span>
              </ZoneButton>
            )}
          />
        ) : (
          <div className={`${ZONE} border-border-button-default`}>
            <TimelineIcon />
            <span className="text-[13px] text-text-tertiary">
              {onFileDrop
                ? "Drop media here or describe your video to start"
                : "Describe your video to start creating"}
            </span>
          </div>
        )}
      </div>
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
