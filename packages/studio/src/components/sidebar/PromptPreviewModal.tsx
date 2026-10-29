import { useState, useCallback, useEffect, useRef } from "react";
import { Button, cn } from "../ui";
import { DialogHeader, dialogClasses } from "../ui/Dialog";
import { useDialogBehavior } from "../ui/useDialogBehavior";

export function PromptPreviewModal({
  title,
  prompt,
  onClose,
}: {
  title: string;
  prompt: string;
  onClose: () => void;
}) {
  const [value, setValue] = useState(prompt);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [entered, setEntered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Escape / focus trap / focus restore. A dirty draft vetoes Escape and
  // backdrop close so a stray click can't discard edits (the X still closes).
  const { requestClose } = useDialogBehavior({
    open: true,
    onClose,
    containerRef,
    canClose: () => valueRef.current === prompt,
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setEntered(true);
      textareaRef.current?.focus();
    });
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(valueRef.current);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 1500);
  }, []);

  return (
    <div
      className={cn(
        dialogClasses.backdrop,
        dialogClasses.centered,
        "transition-opacity duration-150 ease-out",
        entered ? "opacity-100" : "opacity-0",
      )}
      onClick={requestClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Ask agent: ${title}`}
        tabIndex={-1}
        className={cn(dialogClasses.panel, "w-[560px]")}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader title="Ask agent" description={title} onClose={onClose} />
        <div className={dialogClasses.body}>
          <p className={cn(dialogClasses.hint, "mb-2")}>
            Edit the prompt below, then copy and paste into your AI agent
          </p>
          <textarea
            ref={textareaRef}
            aria-label="Prompt"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleCopy();
            }}
            className={cn(
              dialogClasses.field,
              "min-h-[240px] resize-y font-mono text-caption-1-regular",
            )}
          />
        </div>
        <div className={dialogClasses.footer}>
          <span className={dialogClasses.hint}>
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to copy
          </span>
          <Button variant={copyState === "failed" ? "danger" : "primary"} onClick={handleCopy}>
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy prompt"}
          </Button>
        </div>
      </div>
    </div>
  );
}
