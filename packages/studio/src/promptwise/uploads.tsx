import { useSyncExternalStore } from "react";
import { usePlayerStore } from "../player/store/playerStore";
import { embeddedInPromptwise } from "./embed";

export const PREVIEW = /\/api\/projects\/[^/]+\/preview\//;

/** The project path of the file a clip plays, from the preview URL the timeline holds, or null for none of the project's. */
export function clipUploadPath(src: string | undefined): string | null {
  const at = src ? PREVIEW.exec(src) : null;
  if (!src || !at) return null;
  const rest = src.slice(at.index + at[0].length).split(/[?#]/)[0]!;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

/** How far one file Studio adds has got in promptwise: `sent` of `total` bytes in its storage. */
type Progress = { path: string; sent: number; total: number; done: boolean };

/** promptwise's promptwise:upload-progress message, or null for any other. */
export function uploadProgress(data: unknown): Progress | null {
  const { type, path, sent, total, done } = (data ?? {}) as Record<string, unknown>;
  if (type !== "promptwise:upload-progress" || typeof path !== "string") return null;
  if (typeof sent !== "number" || typeof total !== "number") return null;
  return { path, sent, total, done: done === true };
}

/** Where one file Studio added is: going up (with how much is), or failed, which its clip offers to retry. */
export type UploadEntry = { sent: number; total: number; failed: boolean };

/** The worker's word on a file Studio added (promptwise:upload-state), or null for any other message. */
function uploadState(data: unknown): { path: string; state: string } | null {
  const { type, path, state } = (data ?? {}) as Record<string, unknown>;
  if (type !== "promptwise:upload-state" || typeof path !== "string" || typeof state !== "string")
    return null;
  return { path, state };
}

// One listener for the page: every clip asks this store rather than listening itself.
let uploads: ReadonlyMap<string, UploadEntry> = new Map();
const listeners = new Set<() => void>();
let listening = false;

function update(path: string, entry: UploadEntry | null) {
  const next = new Map(uploads);
  if (entry) next.set(path, entry);
  else next.delete(path);
  uploads = next;
  listeners.forEach((listener) => listener());
}

/** The tab says how many bytes of a file are up, and when it's done with it. */
function onProgress(progress: Progress) {
  if (uploads.get(progress.path)?.failed) return;
  // Done on the tab's side: the worker's word may still come, and a failure brings it back.
  const entry = { sent: progress.sent, total: progress.total, failed: false };
  update(progress.path, progress.done ? null : entry);
}

/** The worker says when a file is in promptwise's storage, or failed to get there. */
function onState({ path, state }: { path: string; state: string }) {
  const was = { sent: 0, total: 0, ...uploads.get(path) };
  if (state === "done") update(path, null);
  else if (state === "uploading" || state === "failed")
    update(path, { ...was, failed: state === "failed" });
}

function onMessage(event: MessageEvent) {
  const progress = event.source === window.parent ? uploadProgress(event.data) : null;
  if (progress) return onProgress(progress);
  const state = event.source === window ? uploadState(event.data) : null;
  if (state) onState(state);
}

function subscribe(listener: () => void) {
  if (!listening && embeddedInPromptwise) {
    window.addEventListener("message", onMessage);
    listening = true;
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => uploads;

/** Every file Studio added that isn't in promptwise's storage yet, by its path in the project. */
export function usePromptwiseUploadMap(): ReadonlyMap<string, UploadEntry> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The files going up now that no clip shows yet, as one line: "photo.png" or "3 files", and the share of their bytes that is up. */
export function usePromptwiseUploads(): { name: string; part: number } | null {
  const uploads = usePromptwiseUploadMap();
  const onClips = usePlayerStore((s) => s.elements.map((el) => clipUploadPath(el.src)).join("\n"));
  // A file a clip already plays shows its bar on that clip: the lane would say it twice.
  const shown = new Set(onClips.split("\n"));
  const going = [...uploads].filter(([path, upload]) => !upload.failed && !shown.has(path));
  if (!going.length) return null;
  const total = going.reduce((sum, [, u]) => sum + u.total, 0);
  const sent = going.reduce((sum, [, u]) => sum + Math.min(u.sent, u.total), 0);
  const name = going.length === 1 ? going[0]![0].split("/").pop()! : `${going.length} files`;
  return { name, part: total ? sent / total : 0 };
}

/** Forgets every upload: for tests. */
export function resetPromptwiseUploads() {
  uploads = new Map();
  listeners.forEach((listener) => listener());
}

/** The empty lane's words: what is uploading, over a bar that fills as it goes up, or where to drop media. */
export function GhostLaneText({
  acceptsMediaDrop,
  clickToAdd,
}: {
  acceptsMediaDrop: boolean;
  /** The lane is also a button that adds media. */
  clickToAdd?: boolean;
}) {
  const uploading = usePromptwiseUploads();
  if (!uploading) {
    if (!acceptsMediaDrop) return null;
    return <>{clickToAdd ? "Drop media here, or click to add" : "Drop media here"}</>;
  }
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
