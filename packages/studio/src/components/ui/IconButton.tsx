/** IconButton — Button's square sibling on BoardUI's icon-only sizes. `aria-label` is required. */

import { forwardRef } from "react";
import type { ReactNode } from "react";
import { buttonStyles } from "../../boardui/components/base/buttons/button";
import { buttonBase, buttonVariants, type ButtonBaseProps, type ButtonSize } from "./Button";
import { cn } from "./cn";

interface IconButtonProps extends ButtonBaseProps {
  icon: ReactNode;
  "aria-label": string;
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: cn(buttonStyles.size.xs, buttonStyles.iconOnlySize.xs, "[&_svg]:size-3.5"),
  md: cn(buttonStyles.size.small, buttonStyles.iconOnlySize.small, "[&_svg]:size-4"),
  lg: cn(buttonStyles.size.medium, "size-9 p-0 [&_svg]:size-5"),
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "md", variant = "ghost", className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className={cn(buttonBase, buttonVariants[variant], iconSizeStyles[size], className)}
        {...props}
      >
        {icon}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
