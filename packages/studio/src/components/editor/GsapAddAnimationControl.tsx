import { ADD_METHODS, ADD_METHOD_LABELS, METHOD_TOOLTIPS } from "./gsapAnimationConstants";

const STYLES = {
  classic: {
    method:
      "rounded-lg border border-border-button-default bg-background-tertiary-default px-2.5 py-1.5 text-caption-2-medium text-text-primary transition-colors hover:border-border-button-hover hover:text-text-0",
    cancel: "px-1.5 text-caption-2-regular text-text-tertiary hover:text-text-primary",
    trigger: "text-caption-2-medium text-text-secondary transition-colors hover:text-text-primary",
  },
  flat: {
    method:
      "rounded-lg border border-panel-border-input bg-panel-input px-2.5 py-1.5 text-caption-2-medium text-panel-text-2 transition-colors hover:border-panel-text-4 hover:text-panel-text-0",
    cancel: "px-1.5 text-caption-2-regular text-panel-text-3 hover:text-panel-text-1",
    trigger: "text-caption-2-medium text-panel-text-3 transition-colors hover:text-panel-text-1",
  },
};

export function GsapAddAnimationControl({
  open,
  setOpen,
  onAddAnimation,
  track,
  variant,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onAddAnimation: (method: "to" | "from" | "set" | "fromTo") => void;
  track: (control: string, name: string) => void;
  variant: keyof typeof STYLES;
}) {
  const styles = STYLES[variant];

  return (
    <div className="relative pt-1">
      {open ? (
        <div className="flex gap-1.5">
          {ADD_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              title={METHOD_TOOLTIPS[method]}
              onClick={() => {
                track("button", `Add ${method} animation`);
                onAddAnimation(method);
                setOpen(false);
              }}
              className={styles.method}
            >
              {ADD_METHOD_LABELS[method] ?? method}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)} className={styles.cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={styles.trigger}
          title="Add a new animation effect to this element"
        >
          + Add effect
        </button>
      )}
    </div>
  );
}
