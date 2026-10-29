import { useRef, useState } from "react";
import {
  RiArrowRightSLine,
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiErrorWarningLine,
} from "@remixicon/react";
import { copyTextToClipboard } from "../utils/clipboard";
import { Button, cn } from "./ui";
import { DialogHeader, dialogClasses } from "./ui/Dialog";
import { useDialogBehavior } from "./ui/useDialogBehavior";

export interface LintFinding {
  severity: "error" | "warning";
  message: string;
  file?: string;
  fixHint?: string;
}

export function LintModal({
  findings,
  projectId,
  projectDir,
  title = "HyperFrame Lint Results",
  promptIntro = "Fix these HyperFrames lint issues",
  onClose,
}: {
  findings: LintFinding[];
  projectId: string;
  /** Real on-disk project directory for the agent prompt (not the browser URL). */
  projectDir?: string | null;
  /** Header subtitle — parameterize so console errors don't masquerade as lint results. */
  title?: string;
  /** First line of the copied agent prompt. */
  promptIntro?: string;
  onClose: () => void;
}) {
  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  const hasIssues = findings.length > 0;
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { requestClose } = useDialogBehavior({ open: true, onClose, containerRef });

  const handleCopyToAgent = async () => {
    const lines = findings.map((f) => {
      let line = `[${f.severity}] ${f.message}`;
      if (f.file) line += `\n  File: ${f.file}`;
      if (f.fixHint) line += `\n  Fix: ${f.fixHint}`;
      return line;
    });
    const pathLine = projectDir ? `Project path: ${projectDir}\n\n` : "";
    const text = `${promptIntro} for project "${projectId}":\n\n${pathLine}${lines.join("\n\n")}`;
    const copiedText = await copyTextToClipboard(text);
    if (copiedText) {
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  const summary = hasIssues
    ? `${errors.length} error${errors.length !== 1 ? "s" : ""}, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`
    : "All checks passed";

  return (
    <div className={cn(dialogClasses.backdrop, dialogClasses.centered)} onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(dialogClasses.panel, "w-full max-w-xl")}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader
          title={summary}
          description={title}
          onClose={onClose}
          leading={
            hasIssues ? (
              <RiErrorWarningFill className="mt-0.5 size-6 shrink-0 text-foreground-icon-error" />
            ) : (
              <RiCheckboxCircleFill className="mt-0.5 size-6 shrink-0 text-accent-500" />
            )
          }
        />
        {hasIssues && (
          <div className="flex justify-end px-5 pb-2">
            <Button
              variant={copyFailed ? "danger" : "primary"}
              size="sm"
              onClick={handleCopyToAgent}
            >
              {copied ? "Copied!" : copyFailed ? "Copy failed. Check permissions" : "Copy to Agent"}
            </Button>
          </div>
        )}
        <div className={cn(dialogClasses.body, "pb-5")}>
          {!hasIssues && (
            <div className="py-8 text-center text-body-regular text-text-secondary">
              No errors or warnings found. Your composition looks good!
            </div>
          )}
          {errors.map((f, i) => (
            <LintFindingRow key={`e-${i}`} finding={f} tone="error" />
          ))}
          {warnings.map((f, i) => (
            <LintFindingRow key={`w-${i}`} finding={f} tone="warning" />
          ))}
        </div>
      </div>
    </div>
  );
}

function LintFindingRow({ finding, tone }: { finding: LintFinding; tone: "error" | "warning" }) {
  const Icon = tone === "error" ? RiErrorWarningFill : RiErrorWarningLine;
  return (
    <div className="border-b border-border-button-default py-3 last:border-0">
      <div className="flex items-start gap-2">
        <Icon
          className={`mt-0.5 size-4 shrink-0 ${tone === "error" ? "text-foreground-icon-error" : "text-warning-ink"}`}
        />
        <div className="min-w-0">
          <p
            className={`text-body-regular ${tone === "error" ? "text-text-primary" : "text-text-secondary"}`}
          >
            {finding.message}
          </p>
          {finding.file && (
            <p className="mt-0.5 font-mono text-caption-1-regular text-text-tertiary">
              {finding.file}
            </p>
          )}
          {finding.fixHint && (
            <div className="mt-1.5 flex items-start gap-1">
              <RiArrowRightSLine className="mt-0.5 size-3.5 shrink-0 text-accent-500" />
              <p className="text-caption-1-regular text-text-secondary">{finding.fixHint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
