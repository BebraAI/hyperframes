/**
 * Select: Base UI select in Input's box. The trigger keeps `role="combobox"`, which both hotkey selector
 * lists match. Options are data, not children, so typeahead and the value display can read labels.
 */

import { Select as BaseSelect } from "@base-ui/react/select";
import { IconCheck } from "../../boardui/components/icons";
import { cn } from "./cn";
import { fieldBase } from "./Input";
import { floatingMotion, POPUP_LAYER } from "./Menu";
import type { PreviewState } from "./Button";

export interface SelectOption {
  label: string;
  value: string;
  /** Offered but not choosable; the label stays visible so the reason stays visible too. */
  disabled?: boolean;
}

export interface SelectProps {
  /** Accessible name for the trigger. */
  label: string;
  value: string;
  options: SelectOption[];
  /** Called when a different option is chosen. */
  onCommit: (next: string) => void;
  /** Called once per committed change, for design-input telemetry. */
  onTrack?: () => void;
  disabled?: boolean;
  className?: string;
  "data-preview-state"?: PreviewState;
}

export function Select({
  label,
  value,
  options,
  onCommit,
  onTrack,
  disabled,
  className,
  "data-preview-state": previewState,
}: SelectProps) {
  return (
    <BaseSelect.Root
      value={value}
      disabled={disabled}
      items={options}
      onValueChange={(next) => {
        const chosen = String(next);
        if (chosen === value) return;
        onCommit(chosen);
        onTrack?.();
      }}
    >
      <BaseSelect.Trigger
        aria-label={label}
        className={cn(
          fieldBase,
          "w-full cursor-pointer justify-between text-left",
          "data-[popup-open]:ring-border-button-active",
          className,
        )}
        data-preview-state={previewState}
      >
        <BaseSelect.Value className="truncate" />
        <BaseSelect.Icon className="shrink-0 text-foreground-icon-tertiary" aria-hidden="true">
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
            <path
              d="M1 1L4 4L7 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4} alignItemWithTrigger={false} className={POPUP_LAYER}>
          <BaseSelect.Popup
            className={cn(
              "min-w-[var(--anchor-width)] rounded-2xl border border-border-button-default bg-background-primary-default p-2.5 shadow-dropdown",
              floatingMotion("duration-open"),
            )}
          >
            <BaseSelect.List className="flex flex-col gap-1">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2 rounded-2lg p-2",
                    "text-body-medium text-text-primary outline-hidden",
                    "data-[highlighted]:bg-dropdown-item-hover-background",
                    "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                  )}
                >
                  <BaseSelect.ItemText className="truncate">{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="ms-auto flex shrink-0">
                    <IconCheck className="size-4" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
