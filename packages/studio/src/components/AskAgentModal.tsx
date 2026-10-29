import { useState, useRef, type CSSProperties } from "react";
import { useMountEffect } from "../hooks/useMountEffect";
import { type AgentModalAnchorPoint, clampNumber } from "../utils/studioHelpers";
import { Button, cn } from "./ui";
import { DialogHeader, dialogClasses } from "./ui/Dialog";
import { useDialogBehavior } from "./ui/useDialogBehavior";

function getAgentModalPositionStyle(
  anchorPoint: AgentModalAnchorPoint | null,
): CSSProperties | undefined {
  if (!anchorPoint || typeof window === "undefined") return undefined;

  const modalWidth = 480;
  const estimatedModalHeight = 270;
  const margin = 16;
  const left = clampNumber(
    anchorPoint.x,
    margin + modalWidth / 2,
    window.innerWidth - margin - modalWidth / 2,
  );
  const top = clampNumber(
    anchorPoint.y + 12,
    margin,
    window.innerHeight - margin - estimatedModalHeight,
  );

  return { left, top, transform: "translateX(-50%)" };
}

export interface AskAgentModalProps {
  selectionLabel: string;
  contextPreview?: string;
  anchorPoint?: AgentModalAnchorPoint | null;
  onSubmit: (instruction: string) => void;
  onClose: () => void;
}

export function AskAgentModal({
  selectionLabel,
  contextPreview,
  anchorPoint = null,
  onSubmit,
  onClose,
}: AskAgentModalProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalPositionStyle = getAgentModalPositionStyle(anchorPoint);
  // A dirty draft vetoes Escape/backdrop closes — a stray click must not
  // discard typed instructions. The X button and Copy still close directly.
  const { requestClose } = useDialogBehavior({
    open: true,
    onClose,
    containerRef,
    canClose: () => !value.trim(),
  });

  useMountEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  });

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
  };

  return (
    <div
      className={cn(dialogClasses.backdrop, !anchorPoint && dialogClasses.centered)}
      onClick={requestClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Copy prompt to AI agent"
        tabIndex={-1}
        className={cn(dialogClasses.panel, "w-[480px]", anchorPoint && "fixed")}
        style={modalPositionStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          title="Copy prompt to AI agent"
          description={
            selectionLabel.length > 50 ? `${selectionLabel.slice(0, 49)}…` : selectionLabel
          }
          onClose={onClose}
        />
        <div className={cn(dialogClasses.body, "space-y-3")}>
          <textarea
            ref={inputRef}
            className={cn(dialogClasses.field, "h-24 resize-none")}
            placeholder="Describe what you want to change…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
              // Escape is handled at the document level by useDialogBehavior,
              // guarded against discarding a dirty draft.
            }}
          />
          {contextPreview && (
            <details className="group">
              <summary className="cursor-pointer select-none text-caption-1-medium text-text-secondary hover:text-text-primary">
                Context included in prompt
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word rounded-2lg bg-background-tertiary-default px-3 py-2 text-caption-1-regular text-text-secondary">
                {contextPreview}
              </pre>
            </details>
          )}
        </div>
        <div className={dialogClasses.footer}>
          <span className={dialogClasses.hint}>
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to copy
          </span>
          <Button variant="primary" disabled={!value.trim()} onClick={handleSubmit}>
            Copy prompt
          </Button>
        </div>
      </div>
    </div>
  );
}
