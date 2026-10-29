import { useRef, useState } from "react";
import type {
  ExternalFileChangeBlockedState,
  ExternalFileChangeCoordinatorHandle,
} from "../hooks/useExternalFileChangeCoordinator";
import { Button, cn } from "./ui";
import { Banner, DialogHeader, dialogClasses } from "./ui/Dialog";
import { useDialogBehavior } from "./ui/useDialogBehavior";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function downloadText(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ConflictReview({
  conflict,
  onClose,
}: {
  conflict: Extract<ExternalFileChangeBlockedState, { status: "conflict" }>;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open: true, onClose, containerRef });
  const external = conflict.error.currentContent ?? "(The server did not return file contents.)";
  const studio = conflict.error.attemptedContent;

  return (
    <div className={cn(dialogClasses.backdrop, dialogClasses.centered, "z-110")} onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-conflict-title"
        tabIndex={-1}
        className={cn(dialogClasses.panel, "max-h-[88vh] w-full max-w-5xl overflow-auto")}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader
          titleId="external-conflict-title"
          title={<>Review both versions of {conflict.error.filePath}</>}
          description="Reviewing or exporting does not change either version."
          onClose={onClose}
        />
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
          {[
            { title: "File on disk", content: external, suffix: "external" },
            { title: "Unsaved Studio version", content: studio, suffix: "studio" },
          ].map((side) => (
            <section key={side.suffix} aria-label={side.title}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-body-medium">{side.title}</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void navigator.clipboard.writeText(side.content)}
                  >
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      downloadText(`${conflict.error.filePath}.${side.suffix}.html`, side.content)
                    }
                  >
                    Download
                  </Button>
                </div>
              </div>
              <textarea
                readOnly
                value={side.content}
                className={cn(
                  dialogClasses.field,
                  "h-80 resize-y font-mono text-caption-1-regular",
                )}
              />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function FailedDraftReview({
  path,
  content,
  onClose,
}: {
  path: string;
  content: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open: true, onClose, containerRef });
  return (
    <div className={cn(dialogClasses.backdrop, dialogClasses.centered, "z-110")} onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="failed-draft-title"
        tabIndex={-1}
        className={cn(dialogClasses.panel, "max-h-[88vh] w-full max-w-3xl overflow-auto")}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader
          titleId="failed-draft-title"
          title={<>Recover unsaved Studio draft for {path}</>}
          description="Copy or download this draft before choosing to discard it."
          onClose={onClose}
        />
        <div className="flex justify-end gap-2 px-5">
          <Button size="sm" onClick={() => void navigator.clipboard.writeText(content)}>
            Copy
          </Button>
          <Button size="sm" onClick={() => downloadText(`${path}.studio.html`, content)}>
            Download
          </Button>
        </div>
        <textarea
          readOnly
          value={content}
          className={cn(
            dialogClasses.field,
            "mx-5 mt-2 mb-5 h-80 w-auto resize-y font-mono text-caption-1-regular",
          )}
        />
      </div>
    </div>
  );
}

export function ExternalFileConflictBanner({
  coordinator,
}: {
  coordinator: ExternalFileChangeCoordinatorHandle;
}) {
  const [reviewing, setReviewing] = useState(false);
  const blocked = coordinator.blocked;
  if (!blocked) return null;

  const conflict = blocked.status === "conflict" ? blocked : null;
  const failure = blocked.status === "failed" ? blocked : null;
  return (
    <>
      <Banner tone="warning" className="z-94 flex-wrap">
        <span>
          {conflict
            ? `${conflict.error.filePath} changed outside Studio. Preview is paused so neither version is lost.`
            : `Studio could not safely finish local saves: ${errorMessage(blocked.error)}. Preview is paused.`}
        </span>
        {conflict && (
          <Button size="sm" variant="ghost" onClick={() => setReviewing(true)}>
            Review or export both
          </Button>
        )}
        {failure?.studioContent != null && (
          <Button size="sm" variant="ghost" onClick={() => setReviewing(true)}>
            Review or export Studio draft
          </Button>
        )}
        {failure && !failure.recovered && failure.studioContent != null && (
          <Button size="sm" variant="ghost" onClick={() => void coordinator.retry()}>
            Retry save
          </Button>
        )}
        <Button size="sm" onClick={() => void coordinator.useExternalFile()}>
          Discard Studio edits and reload file
        </Button>
        {conflict && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (
                window.confirm(
                  "Overwrite the externally changed file with the Studio version? The server will preserve its normal backup before writing.",
                )
              ) {
                void coordinator.keepStudioFile();
              }
            }}
          >
            Overwrite file with Studio version
          </Button>
        )}
        {failure?.recovered && failure.studioContent != null && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (
                window.confirm(
                  "Overwrite the file with the recovered Studio draft? The current file will be preserved by the server's normal backup before writing.",
                )
              ) {
                void coordinator.keepStudioFile();
              }
            }}
          >
            Overwrite file with recovered Studio draft
          </Button>
        )}
      </Banner>
      {reviewing && conflict && (
        <ConflictReview conflict={conflict} onClose={() => setReviewing(false)} />
      )}
      {reviewing && failure?.studioContent != null && (
        <FailedDraftReview
          path={failure.path}
          content={failure.studioContent}
          onClose={() => setReviewing(false)}
        />
      )}
    </>
  );
}
