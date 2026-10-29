/**
 * Tooltip: BoardUI's tooltip surface and caret on Base UI's behaviour. The trigger is a box-less
 * `display: contents` wrapper so a disabled control still gets hover.
 */

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import {
  cloneElement,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { TOOLTIP_CARETS } from "../../boardui/components/base/tooltip/tooltip";
import { cn } from "./cn";
import { floatingMotion, POPUP_LAYER } from "./Menu";

interface TooltipProps {
  label: string;
  /** A single element, wrapped in a box-less span so a disabled one still gets hover. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  /** Hover delay in ms. */
  delay?: number;
  disabled?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  /** Wraps a long label at a reading width and cuts it at this many lines with an ellipsis. Unset, one line. */
  lines?: number;
}

/** Matches the old bubble's gap from its trigger, and its viewport margin. */
const SIDE_OFFSET = 10;
const VIEWPORT_MARGIN = 8;

/** Sets the caret on the popup's edge facing the trigger, over its border. */
const ARROW_PLACEMENT = {
  top: "top-full -mt-px",
  bottom: "bottom-full -mb-px",
  left: "left-full -ml-px",
  right: "right-full -mr-px",
};

export function Tooltip({
  label,
  children,
  delay = 400,
  side = "top",
  disabled = false,
  lines,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  return (
    <BaseTooltip.Root open={open} onOpenChange={setOpen} disabled={disabled}>
      <BaseTooltip.Trigger delay={delay} render={<span ref={boxRef} className="contents" />}>
        {cloneElement(children, {
          "aria-describedby": open && !disabled ? tooltipId : children.props["aria-describedby"],
        })}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          anchor={() => boxRef.current?.firstElementChild ?? null}
          side={side}
          sideOffset={SIDE_OFFSET}
          collisionPadding={VIEWPORT_MARGIN}
          className={POPUP_LAYER}
        >
          <BaseTooltip.Popup
            id={tooltipId}
            role="tooltip"
            className={cn(
              "pointer-events-none select-none rounded-lg border border-border-button-default bg-background-primary-default px-2.5 py-1.5 text-caption-1-medium text-text-primary shadow-dropdown",
              lines ? "max-w-[300px] whitespace-normal break-words" : "whitespace-nowrap",
              floatingMotion("duration-tooltip"),
            )}
          >
            <BaseTooltip.Arrow
              render={({ className: _className, ...arrowProps }, { side: placed }) => {
                const caret =
                  TOOLTIP_CARETS[placed as keyof typeof TOOLTIP_CARETS] ?? TOOLTIP_CARETS.top;
                return (
                  <svg
                    {...arrowProps}
                    width={caret.width}
                    height={caret.height}
                    viewBox={`0 0 ${caret.width} ${caret.height}`}
                    className={cn(
                      "block overflow-visible fill-background-primary-default stroke-border-button-default",
                      ARROW_PLACEMENT[placed as keyof typeof ARROW_PLACEMENT],
                    )}
                    style={{
                      ...arrowProps.style,
                      filter: `drop-shadow(${caret.shadow} rgb(0 0 0 / 0.05))`,
                    }}
                  >
                    <path d={caret.path} />
                  </svg>
                );
              }}
            />
            {lines ? (
              <span
                className="line-clamp-(--tooltip-lines)"
                style={{ "--tooltip-lines": lines } as CSSProperties}
              >
                {label}
              </span>
            ) : (
              label
            )}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
