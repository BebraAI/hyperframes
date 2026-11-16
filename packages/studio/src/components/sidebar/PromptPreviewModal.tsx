import { useState, useCallback, useEffect, useRef } from "react";
import { Button, cn } from "../ui";
import { DialogHeader, dialogClasses } from "../ui/Dialog";
import { useDialogBehavior } from "../ui/useDialogBehavior";
import { PROMPTWISE_AGENT, askPromptwise, type PromptwiseAskContext } from "../../promptwise/embed";

const SEND_COPY = {
  title: `Ask ${PROMPTWISE_AGENT}`,
  hint: `Say what you want, and ${PROMPTWISE_AGENT} adds it to your composition`,
  field: "min-h-[96px] resize-y",
  key: "send",
};
const COPY_COPY = {
  title: "Ask agent",
  hint: "Edit the prompt below, then copy and paste into your AI agent",
  field: "min-h-[240px] resize-y font-mono text-caption-1-regular",
  key: "copy",
};
const COPY_LABELS = { idle: "Copy prompt", copied: "Copied!", failed: "Copy failed" } as const;

/**
 * The prompt a catalog card makes, to edit before it goes: with `context` (in promptwise) it is sent to
 * promptwise's agent with the block it's about; without, it is copied for the user's own agent.
 */
export function PromptPreviewModal({
  title,
  prompt,
  context,
  onClose,
}: {
  title: string;
  prompt: string;
  context?: PromptwiseAskContext;
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
    if (context) {
      if (!valueRef.current.trim()) return;
      askPromptwise({ instruction: valueRef.current.trim(), context });
      onClose();
      return;
    }
    try {
      await navigator.clipboard.writeText(valueRef.current);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 1500);
  }, [context, onClose]);

  const copy = context ? SEND_COPY : COPY_COPY;
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
        aria-label={`${copy.title}: ${title}`}
        tabIndex={-1}
        className={cn(dialogClasses.panel, "w-[560px]")}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader title={copy.title} description={title} onClose={onClose} />
        <div className={dialogClasses.body}>
          <p className={cn(dialogClasses.hint, "mb-2")}>{copy.hint}</p>
          <textarea
            ref={textareaRef}
            aria-label="Prompt"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleCopy();
            }}
            className={cn(dialogClasses.field, copy.field)}
          />
        </div>
        <div className={dialogClasses.footer}>
          <span className={dialogClasses.hint}>
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to {copy.key}
          </span>
          <Button variant={copyState === "failed" ? "danger" : "primary"} onClick={handleCopy}>
            {context ? "Send" : COPY_LABELS[copyState]}
          </Button>
        </div>
      </div>
    </div>
  );
}
