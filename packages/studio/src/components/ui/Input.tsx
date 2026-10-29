/**
 * Input: a boxed text field. Typing edits a local draft; Enter and blur commit it,
 * Escape abandons it. `onTrack` fires once per commit, never per keystroke.
 */

import { Input as BaseInput } from "@base-ui/react/input";
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";
import type { PreviewState } from "./Button";

/**
 * Shared field look (also used by NumberField and Select). Each interactive state is written
 * twice, real and `data-[preview-state=...]`; `valueControls.test.tsx` asserts the lists match.
 */
export const fieldBase = cn(
  "flex min-w-0 items-center gap-1.5 h-8 px-1.5 rounded-2lg",
  "bg-background-tertiary-default text-body-regular text-text-primary",
  "ring-2 ring-inset ring-transparent transition-[background-color,box-shadow,color] duration-150",
  "hover:ring-border-button-hover data-[preview-state=hover]:ring-border-button-hover",
  "outline-hidden",
  "focus-within:ring-border-button-active data-[preview-state=focus]:ring-border-button-active",
  // `aria-invalid` is not one of Tailwind's built-in aria variants, so the arbitrary form is the one that compiles.
  "aria-[invalid]:bg-background-tertiary-error aria-[invalid]:ring-transparent",
  "has-[:disabled]:bg-input-disabled-background has-[:disabled]:text-input-disabled-text has-[:disabled]:cursor-not-allowed",
);

export const fieldText = cn(
  "min-w-0 w-full bg-transparent text-inherit outline-hidden",
  "placeholder:text-text-tertiary disabled:cursor-not-allowed",
);

export interface InputProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "className"
> {
  /** The committed value. A draft lives inside until Enter or blur. */
  value: string;
  /** Called with the draft on Enter and on blur, only when it really changed. */
  onCommit: (next: string) => void;
  /** Called once per committed change, for design-input telemetry. */
  onTrack?: () => void;
  /** Marks the field invalid: red boundary and `aria-invalid`. */
  invalid?: boolean;
  className?: string;
  "data-preview-state"?: PreviewState;
}

export function Input({
  value,
  onCommit,
  onTrack,
  invalid,
  disabled,
  className,
  "data-preview-state": previewState,
  ...props
}: InputProps) {
  const [draft, setDraft] = useState(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const dirtyRef = useRef(false);

  // An external write (a seek, an undo, another panel) is authoritative, but it
  // must not eat what the user is halfway through typing.
  useEffect(() => {
    if (!dirtyRef.current) setDraft(value);
  }, [value]);

  const commit = (next: string) => {
    dirtyRef.current = false;
    if (next === valueRef.current) return;
    onCommit(next);
    onTrack?.();
  };

  return (
    <div
      className={cn(fieldBase, className)}
      aria-invalid={invalid || undefined}
      data-preview-state={previewState}
    >
      <BaseInput
        value={draft}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={fieldText}
        onValueChange={(next) => {
          dirtyRef.current = true;
          setDraft(next);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
            return;
          }
          if (event.key === "Escape") {
            // Abandon the draft rather than leave it for the blur commit.
            event.preventDefault();
            event.stopPropagation();
            dirtyRef.current = false;
            setDraft(valueRef.current);
            event.currentTarget.blur();
          }
        }}
        {...props}
      />
    </div>
  );
}
