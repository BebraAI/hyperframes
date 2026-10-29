import { CloseButton } from "../boardui/components/base/buttons/close-button";

interface StudioToastProps {
  message: string;
  tone?: "error" | "info";
  /** Plays the exit animation when true (owner removes the node after ~160ms). */
  leaving?: boolean;
  onDismiss?: () => void;
}

export function StudioToast({ message, tone, leaving, onDismiss }: StudioToastProps) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`motion-reduce:animate-none ${leaving ? "hf-toast-exit" : "hf-toast-enter"}`}
    >
      <div
        className={`relative flex max-w-[min(420px,calc(100vw-48px))] items-center gap-3 overflow-hidden rounded-xl py-2 ps-4 pe-2 text-body-regular ${toastSurface(isError)}`}
      >
        <span
          className={`min-w-0 wrap-break-word ${isError ? "text-text-destructive" : "text-text-primary"}`}
        >
          {message}
        </span>
        {onDismiss && <CloseButton aria-label="Dismiss" size="sm" onClick={onDismiss} />}
      </div>
    </div>
  );
}

/** BoardUI's toast card; an error keeps the card and tints its edge. */
export function toastSurface(isError: boolean): string {
  return `border bg-background-primary-default shadow-dropdown ${isError ? "border-border-error-default" : "border-border-button-default"}`;
}
