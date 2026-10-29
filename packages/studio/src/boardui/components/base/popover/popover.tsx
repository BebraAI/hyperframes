"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Dialog, DialogTrigger, Popover as AriaPopover, Pressable, type PopoverProps } from "react-aria-components";
import { MENU_POPOVER_SURFACE } from "../dropdown/menu-styles";
import { cx } from "../../../utils/cx";

/** A floating panel opened by `trigger` (any focusable element), in BoardUI's dropdown surface. */
export function Popover({
  trigger,
  isOpen,
  onOpenChange,
  placement = "bottom start",
  offset = 6,
  className,
  children,
  "aria-label": label,
}: {
  trigger: ReactElement;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: PopoverProps["placement"];
  /** Gap from the trigger; more when the trigger sits inside a padded bar. */
  offset?: number;
  className?: string;
  children: ReactNode;
  "aria-label": string;
}) {
  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      {/* Any element that takes a ref and DOM props, e.g. a BoardUI Button. */}
      <Pressable>{trigger as PressableChild}</Pressable>
      <AriaPopover placement={placement} offset={offset} className={cx(MENU_POPOVER_SURFACE, "w-72", className)}>
        <Dialog aria-label={label} className="flex flex-col gap-3 outline-none">
          {children}
        </Dialog>
      </AriaPopover>
    </DialogTrigger>
  );
}

type PressableChild = ComponentProps<typeof Pressable>["children"];
