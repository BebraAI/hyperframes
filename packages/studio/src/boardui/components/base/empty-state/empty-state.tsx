import type { ComponentType, ReactNode } from "react";
import { cx } from "../../../utils/cx";

/** A centered "nothing here yet" block: icon, title, description and optional actions. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-balance", className)}>
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-xl bg-background-secondary-default text-foreground-icon-primary">
          <Icon className="size-5" />
        </span>
      )}
      <div className="flex max-w-sm flex-col items-center gap-1">
        <p className="text-body-medium text-text-primary">{title}</p>
        {description && <p className="text-body-regular text-text-secondary">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center justify-center gap-2.5">{children}</div>}
    </div>
  );
}
