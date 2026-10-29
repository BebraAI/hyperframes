"use client";

import { IconChevronRight, IconCheck } from "../../icons";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import {
  Header,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  MenuTrigger,
  Popover,
  Pressable,
  Separator,
  SubmenuTrigger,
  type MenuItemProps as AriaMenuItemProps,
  type MenuSectionProps as AriaMenuSectionProps,
  type PopoverProps,
} from "react-aria-components";
import { MENU_ITEM, MENU_POPOVER_SURFACE, MENU_POPOVER_WIDTH } from "../dropdown/menu-styles";
import { cx } from "../../../utils/cx";

/**
 * An action menu: React Aria's Menu (arrow keys, type-ahead, radio sections, submenus)
 * dressed in BoardUI's dropdown recipe. `trigger` is any focusable element, e.g. a Button.
 *
 *   <Menu trigger={<Button>Sort</Button>} aria-label="Sort">
 *     <MenuSection label="Sort by" selectionMode="single" selectedKeys={[sort]} onSelectionChange={…}>
 *       <MenuItem id="recent">Recent</MenuItem>
 *     </MenuSection>
 *     <MenuSeparator />
 *     <MenuItem onAction={…}>Delete</MenuItem>
 *   </Menu>
 */
type PressableChild = ComponentProps<typeof Pressable>["children"];

export function Menu({
  trigger,
  isOpen,
  onOpenChange,
  placement = "bottom start",
  offset,
  crossOffset,
  className,
  children,
  "aria-label": label,
}: {
  trigger: ReactElement;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: PopoverProps["placement"];
  /** Gap from the trigger (default 4px); more when the trigger sits inside a padded card. */
  offset?: number;
  /** Shift along the trigger, e.g. to line the panel up with that card's edge. */
  crossOffset?: number;
  /** Classes on the panel, e.g. a width (default w-[266px]). */
  className?: string;
  children: ReactNode;
  "aria-label": string;
}) {
  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      {/* Any element that takes a ref and DOM props, e.g. a BoardUI Button. */}
      <Pressable>{trigger as PressableChild}</Pressable>
      <MenuPanel placement={placement} offset={offset} crossOffset={crossOffset} className={className} label={label}>
        {children}
      </MenuPanel>
    </MenuTrigger>
  );
}

function MenuPanel({
  placement,
  offset = 4,
  crossOffset,
  className,
  label,
  children,
}: {
  placement?: PopoverProps["placement"];
  offset?: number;
  crossOffset?: number;
  className?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover placement={placement} offset={offset} crossOffset={crossOffset} className={cx(MENU_POPOVER_WIDTH, MENU_POPOVER_SURFACE, "max-h-[min(70vh,var(--visual-viewport-height))]", className)}>
      <AriaMenu aria-label={label} className="flex flex-col gap-1 outline-none">
        {children}
      </AriaMenu>
    </Popover>
  );
}

/** A row. Inside a section with a selectionMode it shows a check when selected. */
export function MenuItem({ className, children, ...props }: Omit<AriaMenuItemProps, "children"> & { children: ReactNode }) {
  return (
    <AriaMenuItem
      textValue={typeof children === "string" ? children : undefined}
      {...props}
      className={cx(
        MENU_ITEM,
        "text-body-medium data-[focused]:bg-dropdown-item-hover-background data-[disabled]:cursor-default data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-foreground-icon-secondary",
        className as string,
      )}
    >
      {({ isSelected, selectionMode, hasSubmenu }) => (
        <>
          {children}
          {selectionMode !== "none" && <IconCheck className={cx("ms-auto", !isSelected && "invisible")} />}
          {hasSubmenu && <IconChevronRight className="ms-auto" />}
        </>
      )}
    </AriaMenuItem>
  );
}

/** A group of rows with an optional muted heading; give it a selectionMode for radio rows. */
export function MenuSection<T extends object>({
  label,
  className,
  children,
  ...props
}: Omit<AriaMenuSectionProps<T>, "children"> & { label?: ReactNode; children: ReactNode }) {
  return (
    <AriaMenuSection {...props} className={cx("flex flex-col gap-1", className)}>
      {label && <Header className="px-2 pt-1 text-caption-1-medium text-text-secondary">{label}</Header>}
      {children}
    </AriaMenuSection>
  );
}

export function MenuSeparator() {
  return <Separator className="-mx-2.5 my-1 h-px shrink-0 bg-border-button-default" />;
}

/** A row that opens a nested menu to its side. */
export function Submenu({ item, label, children }: { item: ReactNode; label: string; children: ReactNode }) {
  return (
    <SubmenuTrigger>
      <MenuItem textValue={label}>{item}</MenuItem>
      {/* Measured from the row, so it clears the parent's padding and border (11px) plus a 4px gap, and its
          first row lines up with this one. */}
      <MenuPanel placement="end top" offset={15} crossOffset={-11} label={label}>
        {children}
      </MenuPanel>
    </SubmenuTrigger>
  );
}
