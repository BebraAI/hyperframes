import { Button } from "./ui";
import { Banner } from "./ui/Dialog";

interface SaveQueuePausedBannerProps {
  message: string;
  /** Resets the save-queue circuit breaker so persistence resumes. */
  onRetry: () => void;
}

/** Alert shown when the DOM-edit save queue circuit breaker pauses persistence. */
export function SaveQueuePausedBanner({ message, onRetry }: SaveQueuePausedBannerProps) {
  return (
    <Banner tone="error">
      <span>{message}</span>
      <Button size="sm" onClick={onRetry}>
        Retry saving
      </Button>
    </Banner>
  );
}
