/**
 * Button — BoardUI's button (src/boardui, synced from promptwise), under Studio's props.
 * Studio's sm / md / lg are BoardUI's xs / small / medium, 24 / 32 / 36 px.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { buttonStyles } from "../../boardui/components/base/buttons/button";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

/** Forces one interactive look for a gallery shot on Input and Popover. */
export type PreviewState = "hover" | "active" | "focus";

export interface ButtonBaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

interface ButtonProps extends ButtonBaseProps {
  loading?: boolean;
  icon?: ReactNode;
}

export const boardSize = { sm: "xs", md: "small", lg: "medium" } as const;

export const buttonBase = buttonStyles.base;
export const buttonVariants: Record<ButtonVariant, string> = buttonStyles.variant;
export const buttonSizes: Record<ButtonSize, string> = {
  sm: cn(buttonStyles.size.xs, "gap-1 [&_svg]:size-3.5"),
  md: cn(buttonStyles.size.small, "gap-1.5 [&_svg]:size-4"),
  lg: cn(buttonStyles.size.medium, "gap-2 [&_svg]:size-5"),
};

function Spinner() {
  return (
    <svg className="animate-spin size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "md", loading, icon, children, className, disabled, ...props },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    let leading: ReactNode = null;
    if (loading) leading = <Spinner />;
    else if (icon) leading = <span className="inline-flex shrink-0">{icon}</span>;
    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
        {...props}
      >
        {leading}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
