/**
 * Toggle: BoardUI's switch on Base UI's behaviour; a switch, not a checkbox (immediate effect). `role="switch"` needed an entry in
 * `typingTarget.ts` so Space is not leaked to the global playback shortcut.
 */

import { Switch } from "@base-ui/react/switch";
import { SwitchTrack } from "../../boardui/components/base/switch/switch";
import { cn } from "./cn";
import type { PreviewState } from "./Button";

export interface ToggleProps {
  /** Accessible name. */
  label: string;
  checked: boolean;
  /** Called on every flip. */
  onCommit: (next: boolean) => void;
  /** Called once per flip, for design-input telemetry. */
  onTrack?: () => void;
  disabled?: boolean;
  className?: string;
  "data-preview-state"?: PreviewState;
}

export function Toggle({
  label,
  checked,
  onCommit,
  onTrack,
  disabled,
  className,
  "data-preview-state": previewState,
}: ToggleProps) {
  return (
    <Switch.Root
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(next) => {
        onCommit(next);
        onTrack?.();
      }}
      data-preview-state={previewState}
      className={cn(
        "inline-flex shrink-0 cursor-pointer rounded-full outline-hidden",
        "focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-2",
        "data-[preview-state=focus]:ring-2 data-[preview-state=focus]:ring-border-focus-ring data-[preview-state=focus]:ring-offset-2",
        "disabled:cursor-not-allowed",
        className,
      )}
    >
      <SwitchTrack
        size="sm"
        state={{ isSelected: checked, isDisabled: !!disabled, isFocusVisible: false }}
      />
    </Switch.Root>
  );
}
