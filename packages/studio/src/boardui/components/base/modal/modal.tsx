"use client";

import { useState, type ReactNode } from "react";
import { Dialog, Heading, Modal as AriaModal, ModalOverlay } from "react-aria-components";
import { CloseButton } from "../buttons/close-button";
import { cx } from "../../../utils/cx";

const PANEL = {
  center: "w-full max-w-sm rounded-3xl p-5 data-[entering]:scale-95 data-[exiting]:scale-95",
  // Drawers run the full height; the centered card keeps its 1rem margin.
  start: "fixed inset-y-0 start-0 h-dvh max-h-dvh w-3/4 max-w-sm border-e data-[entering]:-translate-x-6 data-[exiting]:-translate-x-6",
  end: "fixed inset-y-0 end-0 h-dvh max-h-dvh w-3/4 max-w-sm border-s data-[entering]:translate-x-6 data-[exiting]:translate-x-6",
};

/**
 * A modal dialog on React Aria (focus trap, Escape, outside click), in the BoardUI card look.
 * `side` turns it into a drawer from that edge. Content scrolls inside the panel.
 * Control it with isOpen/onOpenChange, or give it a `trigger` that opens it on click.
 */
export function Modal({
  trigger,
  isOpen,
  onOpenChange,
  title,
  description,
  hideTitle,
  side = "center",
  className,
  children,
}: {
  /** A button that opens it. It may come from a server component. */
  trigger?: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Keep the title for screen readers only. */
  hideTitle?: boolean;
  side?: keyof typeof PANEL;
  className?: string;
  /** Content, or a function of `close` for Cancel buttons. */
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = isOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };
  const modal = (
    <ModalOverlay
      isOpen={open}
      onOpenChange={setOpen}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 transition duration-150 data-[entering]:opacity-0 data-[exiting]:opacity-0"
    >
      <AriaModal
        className={cx(
          "relative max-h-[calc(100dvh-2rem)] overflow-y-auto border-border-button-default bg-background-primary-default text-text-primary shadow-dropdown transition duration-200 ease-out",
          side === "center" && "border",
          PANEL[side],
          className,
        )}
      >
        <Dialog className="flex h-full flex-col gap-4 outline-none">
          {({ close }) => (
            <>
              <div className={cx("flex flex-col gap-1 pe-8", hideTitle && "sr-only")}>
                <Heading slot="title" className="text-title-3-medium">
                  {title}
                </Heading>
                {description && <p className="text-body-regular text-text-secondary">{description}</p>}
              </div>
              {typeof children === "function" ? children(close) : children}
              <CloseButton aria-label="Close" size="sm" onClick={close} className="absolute end-4 top-4" />
            </>
          )}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
  if (!trigger) return modal;
  // A click wrapper rather than React Aria's Pressable, which can't take a server-rendered element.
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      {modal}
    </>
  );
}
