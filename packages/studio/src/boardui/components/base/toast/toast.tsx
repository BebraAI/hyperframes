"use client";

import {
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import { CloseButton } from "../buttons/close-button";

type Toast = { title: string; action?: { label: string; onAction: () => void } };

const queue = new ToastQueue<Toast>({ maxVisibleToasts: 3 });

/** Shows a short notice at the bottom of the screen, with an optional action such as Undo. It closes on its own. */
export function toast(title: string, action?: Toast["action"]) {
  return queue.add({ title, action }, { timeout: action ? 6000 : 4000 });
}

/** Where toasts appear; render once per page tree. React Aria announces them and moves focus with F6. */
export function Toaster() {
  return (
    <ToastRegion
      queue={queue}
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-col items-center gap-2 outline-none"
    >
      {({ toast }) => (
        <AriaToast
          toast={toast}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-border-button-default bg-background-primary-default py-2 ps-4 pe-2 text-text-primary shadow-dropdown outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <ToastContent className="min-w-0 truncate text-body-regular">{toast.content.title}</ToastContent>
          {toast.content.action && (
            <button
              type="button"
              onClick={() => {
                toast.content.action?.onAction();
                queue.close(toast.key);
              }}
              className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-body-medium text-text-primary outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              {toast.content.action.label}
            </button>
          )}
          <CloseButton aria-label="Dismiss" size="sm" onClick={() => queue.close(toast.key)} />
        </AriaToast>
      )}
    </ToastRegion>
  );
}
