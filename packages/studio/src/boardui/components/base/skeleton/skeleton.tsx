import { cx } from "../../../utils/cx";

/** A pulsing placeholder block while content loads; size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-md bg-background-secondary-default", className)} />;
}
