"use client";

import type { ReactNode } from "react";
import {
  Label as AriaLabel,
  Slider as AriaSlider,
  SliderThumb as AriaSliderThumb,
  SliderTrack as AriaSliderTrack,
} from "react-aria-components";
import type { SliderProps as AriaSliderProps } from "react-aria-components";
import { cx } from "../../../utils/cx";

type SliderValue = number | number[];

type SliderBaseProps<T extends SliderValue> = Omit<
  AriaSliderProps<T>,
  "children" | "className" | "orientation"
> & {
  /** Optional visible label associated with every thumb. */
  label?: ReactNode;
  /** Show the exact value in a persistent bubble above each thumb. Default `true`. */
  showTooltip?: boolean;
  /** Custom visual formatter for the value bubbles. */
  formatValue?: (value: number, index: number) => ReactNode;
  /** Replace the line track with a media timeline; range thumbs become trim handles. */
  trackContent?: ReactNode;
  /** Image inside the single media thumb, used for selecting a cover frame. */
  thumbContent?: ReactNode;
  className?: string;
};

export type SliderProps = SliderBaseProps<number> & {
  /** Accessible name for the single thumb. */
  thumbLabel?: string;
};

export type RangeSliderProps = SliderBaseProps<number[]> & {
  /** Accessible names for the lower and upper thumbs. */
  thumbLabels?: [string, string];
};

type SliderBaseInternalProps<T extends SliderValue> = SliderBaseProps<T> & {
  thumbLabels: string[];
};

/**
 * Shared single and multi-thumb slider presentation.
 *
 * React Aria owns the value model, drag behavior, hidden range inputs,
 * keyboard controls, RTL handling, and collision rules. BoardUI owns the
 * visual track, selected range, thumbs, and exact-value bubbles.
 */
function SliderBase<T extends SliderValue>({
  className,
  label,
  showTooltip = true,
  formatValue,
  trackContent,
  thumbContent,
  thumbLabels,
  ...props
}: SliderBaseInternalProps<T>) {
  return (
    <AriaSlider
      {...props}
      orientation="horizontal"
      className={({ isDisabled }) =>
        cx(
          "group flex w-full min-w-0 flex-col gap-2",
          trackContent && (Array.isArray(props.value ?? props.defaultValue) ? "px-2" : "px-10"),
          isDisabled && "cursor-not-allowed opacity-50",
          className,
        )
      }
    >
      {({ state }) => {
        const isRange = state.values.length > 1;
        const startPercent = isRange ? state.getThumbPercent(0) : 0;
        const endPercent = state.getThumbPercent(state.values.length - 1);

        return (
          <>
            {label != null && (
              <AriaLabel className="text-body-medium text-text-primary">
                {label}
              </AriaLabel>
            )}

            <AriaSliderTrack
              className={cx(
                "relative w-full touch-none",
                trackContent ? isRange ? "h-20" : "h-28" : "h-8",
                showTooltip && !trackContent && "mt-8",
              )}
            >
              {({ isHovered }) => {
                if (trackContent) return <>
                  <div className={cx("pointer-events-none absolute inset-y-0 overflow-hidden rounded-xl bg-background-tertiary-default", isRange ? "inset-x-0" : "-inset-x-10")}>{trackContent}</div>
                  {isRange && <>
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 start-0 rounded-s-xl bg-background-full/60" style={{ width: `${startPercent * 100}%` }} />
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 end-0 rounded-e-xl bg-background-full/60" style={{ width: `${(1 - endPercent) * 100}%` }} />
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 rounded-lg border-y-4 border-accent-500" style={{ insetInlineStart: `${startPercent * 100}%`, insetInlineEnd: `${(1 - endPercent) * 100}%` }} />
                  </>}
                  {state.values.map((_, index) => <AriaSliderThumb key={index} index={index} aria-label={thumbLabels[index] ?? "Cover position"}
                    className={({ isDragging, isFocusVisible, isDisabled }) => cx(
                      "top-1/2 z-20 flex cursor-ew-resize items-center justify-center outline-none",
                      isRange ? "h-full w-4 rounded-lg bg-accent-500" : "h-[calc(100%+0.5rem)] w-20 overflow-hidden rounded-xl border-2 border-accent-500 bg-background-primary-default shadow-card",
                      isDragging && "z-30",
                      isFocusVisible && "z-30 ring-2 ring-border-focus-ring ring-offset-2 ring-offset-background-primary-default",
                      isDisabled && "cursor-not-allowed",
                    )}>
                    {isRange ? <span aria-hidden className="pointer-events-none h-6 w-1 rounded-full bg-text-white" /> : <span className="pointer-events-none absolute inset-1 overflow-hidden rounded-lg">{thumbContent}</span>}
                  </AriaSliderThumb>)}
                </>;
                return (
                <>
                  <span
                    aria-hidden
                    className={cx(
                      "absolute top-1/2 end-0 start-0 h-1.5 -translate-y-1/2 rounded-full",
                      "bg-background-tertiary-default shadow-[inset_0_1px_1px_rgb(0_0_0/0.06)]",
                      "transition-colors duration-150 ease",
                      isHovered && "bg-background-tertiary-hover",
                    )}
                  />
                  <span
                    aria-hidden
                    className={cx(
                      "absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full",
                      "bg-linear-to-r from-accent-500 to-accent-600",
                      "shadow-[inset_0_1px_0_rgb(255_255_255/0.24),0_1px_2px_rgb(4_80_226/0.16)]",
                    )}
                    style={{
                      insetInlineStart: `${startPercent * 100}%`,
                      insetInlineEnd: `${(1 - endPercent) * 100}%`,
                    }}
                  />

                  {state.values.map((value, index) => {
                    const valueLabel =
                      formatValue?.(value, index) ??
                      state.getThumbValueLabel(index);

                    return (
                      <AriaSliderThumb
                        key={index}
                        index={index}
                        aria-label={
                          thumbLabels[index] ??
                          (isRange ? `Value ${index + 1}` : "Value")
                        }
                        className={({
                          isDragging,
                          isHovered: isThumbHovered,
                          isFocusVisible,
                          isDisabled,
                        }) =>
                          cx(
                            "top-1/2 size-5 rounded-full border border-border-button-default outline-none",
                            "flex items-center justify-center bg-control-indicator-background",
                            "shadow-[0_2px_4px_rgb(0_0_0/0.10),inset_0_1px_0_rgb(255_255_255/0.8)]",
                            "transition-[scale,box-shadow,border-color] duration-150 ease",
                            isThumbHovered && !isDragging && "scale-105 border-border-button-hover",
                            isDragging && "z-20 scale-110 border-accent-500 shadow-[0_3px_8px_color-mix(in_srgb,var(--color-accent-600)_22%,transparent)]",
                            isFocusVisible && "ring-2 ring-border-focus-ring ring-offset-2",
                            isDisabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
                          )
                        }
                      >
                        {({ isDragging, isFocused }) => (
                          <>
                            {showTooltip && (
                              <span
                                aria-hidden
                                className={cx(
                                  "pointer-events-none absolute bottom-[calc(100%+9px)] left-1/2 -translate-x-1/2",
                                  "flex h-7 min-w-8 items-center justify-center rounded-lg border border-border-button-default",
                                  "bg-background-primary-default px-2 text-caption-1-medium whitespace-nowrap text-text-primary shadow-xs",
                                  "transition-[translate,box-shadow] duration-150 ease",
                                  (isDragging || isFocused) && "-translate-y-0.5 shadow-dropdown",
                                )}
                              >
                                {valueLabel}
                                <span
                                  aria-hidden
                                  className="absolute -bottom-[4.5px] left-1/2 size-2 -translate-x-1/2 rotate-45 border-r border-b border-border-button-default bg-background-primary-default"
                                />
                              </span>
                            )}
                            <span
                              aria-hidden
                              className={cx(
                                "size-2 rounded-full bg-linear-to-b from-accent-500 to-accent-600",
                                "shadow-[inset_0_1px_0_rgb(255_255_255/0.24)] transition-[filter] duration-150 ease",
                                (isDragging || isFocused) && "brightness-110",
                              )}
                            />
                          </>
                        )}
                      </AriaSliderThumb>
                    );
                  })}
                </>
                );
              }}
            </AriaSliderTrack>
          </>
        );
      }}
    </AriaSlider>
  );
}

/** A single-value slider with an exact-value bubble above the thumb. */
export function Slider({ thumbLabel = "Value", ...props }: SliderProps) {
  return <SliderBase {...props} thumbLabels={[thumbLabel]} />;
}

/** A two-thumb slider for selecting a minimum and maximum value. */
export function RangeSlider({
  thumbLabels = ["Minimum", "Maximum"],
  ...props
}: RangeSliderProps) {
  return <SliderBase {...props} thumbLabels={thumbLabels} />;
}
