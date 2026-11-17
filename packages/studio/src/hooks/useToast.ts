import { useState, useCallback, useRef } from "react";
import { useMountEffect } from "./useMountEffect";
import type { AppToast } from "../utils/studioHelpers";

interface ToastItem extends AppToast {
  id: number;
  /** True while the exit animation plays, just before removal. */
  leaving?: boolean;
}

const AUTO_DISMISS_MS = 4000;
/** Long enough to read the name and reach for Undo, as Gmail's and Material's snackbars allow. */
const UNDO_DISMISS_MS = 6000;
const EXIT_MS = 160;
const MAX_TOASTS = 3;

let nextToastId = 1;

/**
 * Stacked toasts (max 3). Info toasts auto-dismiss after 4s, undo toasts after 6s, and neither
 * while the pointer is on it; error toasts persist until explicitly dismissed so failures can't
 * silently vanish.
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  const clearTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const removeToast = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer],
  );

  const dismissToast = useCallback(
    (id: number) => {
      clearTimer(id);
      // Mark leaving so the exit animation plays, then remove.
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      const timer = setTimeout(() => removeToast(id), EXIT_MS);
      timersRef.current.set(id, timer);
    },
    [clearTimer, removeToast],
  );

  const schedule = useCallback(
    (id: number, tone: AppToast["tone"]) => {
      clearTimer(id);
      const wait = tone === "undo" ? UNDO_DISMISS_MS : AUTO_DISMISS_MS;
      timersRef.current.set(
        id,
        setTimeout(() => dismissToast(id), wait),
      );
    },
    [clearTimer, dismissToast],
  );

  const showToast = useCallback(
    (message: string, tone: AppToast["tone"] = "error"): number => {
      const id = nextToastId++;
      setToasts((prev) => {
        const next = [...prev, { id, message, tone }];
        // Cap the stack; drop the oldest (and its pending timer).
        while (next.length > MAX_TOASTS) {
          const dropped = next.shift();
          if (dropped) clearTimer(dropped.id);
        }
        return next;
      });
      if (tone !== "error") schedule(id, tone);
      return id;
    },
    [clearTimer, schedule],
  );

  /** Holds a toast while the pointer is on it; letting go gives it its full time again. */
  const holdToast = useCallback(
    (id: number, held: boolean) => {
      const toast = toastsRef.current.find((t) => t.id === id);
      if (!toast || toast.tone === "error" || toast.leaving) return;
      if (held) clearTimer(id);
      else schedule(id, toast.tone);
    },
    [clearTimer, schedule],
  );

  useMountEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
  });

  return { toasts, showToast, dismissToast, holdToast };
}
