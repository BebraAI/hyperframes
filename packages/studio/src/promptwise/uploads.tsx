import { useEffect, useState } from "react";
import { embeddedInPromptwise } from "./embed";

/** How far one file Studio adds has got in promptwise: `sent` of `total` bytes in its storage. */
type Progress = { path: string; sent: number; total: number; done: boolean };

/** promptwise's promptwise:upload-progress message, or null for any other. */
export function uploadProgress(data: unknown): Progress | null {
  const { type, path, sent, total, done } = (data ?? {}) as Record<string, unknown>;
  if (type !== "promptwise:upload-progress" || typeof path !== "string") return null;
  if (typeof sent !== "number" || typeof total !== "number") return null;
  return { path, sent, total, done: done === true };
}

/** The files going up now, as one line: "photo.png" or "3 files", and the share of their bytes that is up. */
export function usePromptwiseUploads(): { name: string; part: number } | null {
  const [uploads, setUploads] = useState<Record<string, Progress>>({});
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!embeddedInPromptwise) return;
    const onMessage = (event: MessageEvent) => {
      const progress = event.source === window.parent ? uploadProgress(event.data) : null;
      if (!progress) return;
      setUploads(({ [progress.path]: _, ...rest }) =>
        progress.done ? rest : { ...rest, [progress.path]: progress },
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const going = Object.values(uploads);
  if (!going.length) return null;
  const total = going.reduce((sum, u) => sum + u.total, 0);
  const sent = going.reduce((sum, u) => sum + Math.min(u.sent, u.total), 0);
  const name = going.length === 1 ? going[0]!.path.split("/").pop()! : `${going.length} files`;
  return { name, part: total ? sent / total : 0 };
}

/** The empty lane's words: what is uploading, over a bar that fills as it goes up, or where to drop media. */
export function GhostLaneText({ acceptsMediaDrop }: { acceptsMediaDrop: boolean }) {
  const uploading = usePromptwiseUploads();
  if (!uploading) return acceptsMediaDrop ? <>Drop media here</> : null;
  return <UploadingText uploading={uploading} />;
}

/** "Uploading photo.png · 42%" over a bar that fills as it goes up; the parent is `relative`. */
export function UploadingText({ uploading }: { uploading: { name: string; part: number } }) {
  const percent = Math.round(uploading.part * 100);
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 rounded-lg bg-studio-accent/10 transition-[width] duration-200"
        style={{ width: `${percent}%` }}
      />
      <span role="status" className="relative text-accent-ink">
        Uploading {uploading.name} · {percent}%
      </span>
    </>
  );
}
