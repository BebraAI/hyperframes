import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { CloseButton } from "../boardui/components/base/buttons/close-button";
import { Button } from "./ui";
import { historyShortcut } from "../utils/studioHelpers";

interface StudioToastProps {
  message: string;
  tone?: "error" | "info" | "undo";
  /** Plays the exit animation when true (owner removes the node after ~160ms). */
  leaving?: boolean;
  onDismiss?: () => void;
  /** An undo toast's button: takes the edit back. */
  onUndo?: () => void;
  /** The pointer is on the toast (true) or has left it (false), to hold its timer. */
  onHold?: (held: boolean) => void;
}

/**
 * A short line on what just happened. An undo toast also says how to take it back, with the
 * button and its shortcut right there, as Gmail's and Google Docs' snackbars do.
 */
export function StudioToast({
  message,
  tone,
  leaving,
  onDismiss,
  onUndo,
  onHold,
}: StudioToastProps) {
  const isError = tone === "error";
  const undo = tone === "undo" && onUndo;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`motion-reduce:animate-none ${leaving ? "hf-toast-exit" : "hf-toast-enter"}`}
      onPointerEnter={onHold && (() => onHold(true))}
      onPointerLeave={onHold && (() => onHold(false))}
    >
      <div
        className={`relative flex max-w-[min(420px,calc(100vw-48px))] items-center gap-3 overflow-hidden rounded-xl py-2 ps-4 pe-2 text-body-regular ${toastSurface(isError)}`}
      >
        <span
          className={`min-w-0 wrap-break-word ${isError ? "text-text-destructive" : "text-text-primary"} ${undo ? "truncate" : ""}`}
        >
          {message}
        </span>
        {undo && (
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowCounterClockwise weight="bold" />}
            title={`Undo (${historyShortcut("undo")})`}
            onClick={onUndo}
            className="shrink-0"
          >
            Undo
            <kbd className="ms-1 font-sans text-caption-2-medium text-text-tertiary">
              {historyShortcut("undo", true)}
            </kbd>
          </Button>
        )}
        {onDismiss && <CloseButton aria-label="Dismiss" size="sm" onClick={onDismiss} />}
      </div>
    </div>
  );
}

/** BoardUI's toast card; an error keeps the card and tints its edge. */
export function toastSurface(isError: boolean): string {
  return `border bg-background-primary-default shadow-dropdown ${isError ? "border-border-error-default" : "border-border-button-default"}`;
}
