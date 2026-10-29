import type { ReactNode } from "react";
import { RiAlertFill, RiErrorWarningFill } from "@remixicon/react";
import { cn } from "./cn";
import { CloseButton } from "../../boardui/components/base/buttons/close-button";

/** BoardUI's modal card, for Studio's dialogs that keep their own focus handling (useDialogBehavior). */
export const dialogClasses = {
  backdrop: "hf-backdrop-in fixed inset-0 z-100 bg-black/20",
  centered: "flex items-center justify-center p-4",
  panel:
    "flex max-h-[80vh] flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default text-text-primary shadow-dropdown outline-hidden",
  body: "flex-1 overflow-y-auto px-5",
  footer: "flex items-center justify-between gap-3 px-5 pt-3 pb-5",
  hint: "text-caption-1-regular text-text-tertiary",
  field:
    "w-full rounded-2lg bg-background-tertiary-default px-3 py-2 text-body-regular text-text-primary outline-none ring-2 ring-inset ring-transparent placeholder:text-text-tertiary hover:ring-border-button-hover focus:ring-border-button-active",
};

export function DialogHeader({
  title,
  titleId,
  description,
  leading,
  onClose,
}: {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  leading?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-5 pt-5 pb-3">
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id={titleId} className="text-title-3-medium">
          {title}
        </h2>
        {description && <p className="text-body-regular text-text-secondary">{description}</p>}
      </div>
      <CloseButton aria-label="Close" size="sm" onClick={onClose} />
    </div>
  );
}

/** A notice floating over the canvas, on BoardUI's toast card with a tone icon. */
export function Banner({
  tone,
  role = "alert",
  className,
  children,
}: {
  tone: "warning" | "error";
  role?: "alert" | "status";
  className?: string;
  children: ReactNode;
}) {
  const Icon = tone === "error" ? RiErrorWarningFill : RiAlertFill;
  return (
    <div
      role={role}
      className={cn(
        "hf-backdrop-in absolute left-1/2 top-14 z-92 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-xl border bg-background-primary-default px-4 py-2 text-body-regular text-text-primary shadow-dropdown",
        tone === "error" ? "border-border-error-default" : "border-border-button-default",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          tone === "error" ? "text-foreground-icon-error" : "text-warning-ink",
        )}
      />
      {children}
    </div>
  );
}
