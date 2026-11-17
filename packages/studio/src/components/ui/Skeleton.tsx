import { Skeleton as BoardSkeleton } from "../../boardui/components/base/skeleton/skeleton";
import { cn } from "./cn";

/**
 * BoardUI's skeleton block, a shade darker so it reads on Studio's white panels, and still for reduced motion.
 * promptwise's Timeline tab draws its own with the same tone, so the two hand over without a jump.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <BoardSkeleton
      className={cn("bg-background-tertiary-default motion-reduce:animate-none", className)}
    />
  );
}
