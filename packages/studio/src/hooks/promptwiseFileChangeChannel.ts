/**
 * Studio on promptwise's browser backend (promptwise-web) gets file changes from its page by message: a stream held
 * open on a Service Worker keeps a new deploy from taking over and is stopped by Chrome after five minutes.
 */
export function promptwiseFileChangeChannel(onDelivery: (delivery: unknown) => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data as { type?: unknown; change?: unknown } | null;
    if (event.origin === globalThis.location?.origin && data?.type === "promptwise:file-change") {
      onDelivery(data.change);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

/** Whether this page runs on promptwise-web's worker: its boot script says so before Studio loads. */
export const onPromptwiseWorker = () =>
  (globalThis as { promptwiseWorkerFeed?: boolean }).promptwiseWorkerFeed === true;
