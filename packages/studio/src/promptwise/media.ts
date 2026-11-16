import { useEffect, useState } from "react";
import { embeddedInPromptwise } from "./embed";

/** One of the promptwise project's images, videos and sounds, played from its own address. */
export interface PromptwiseMedia {
  url: string;
  name: string;
  kind: "image" | "video" | "audio";
  /** A picture to show for it: the image itself, or a video's poster. */
  thumb?: string;
}

const KINDS = new Set(["image", "video", "audio"]);

const isHttp = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//.test(value);

/** One item of the message, or null for one Studio can't play from its address. */
function mediaItem(item: unknown): PromptwiseMedia | null {
  const { url, name, kind, thumb } = (item ?? {}) as Record<string, unknown>;
  if (!isHttp(url) || typeof kind !== "string" || !KINDS.has(kind)) return null;
  const media: PromptwiseMedia = {
    url,
    name: typeof name === "string" && name ? name : kind,
    kind: kind as PromptwiseMedia["kind"],
  };
  return isHttp(thumb) ? { ...media, thumb } : media;
}

/** The project's media from promptwise's promptwise:media message; null for any other message. */
export function promptwiseMedia(data: unknown): PromptwiseMedia[] | null {
  if (typeof data !== "object" || data === null) return null;
  const { type, items } = data as { type?: unknown; items?: unknown };
  if (type !== "promptwise:media" || !Array.isArray(items)) return null;
  return items.flatMap((item: unknown) => {
    const media = mediaItem(item);
    return media ? [media] : [];
  });
}

/**
 * The promptwise project's media while Studio is embedded there: asked for once Studio is up, then
 * kept as promptwise sends it again (a new image in the chat). Null outside promptwise.
 */
export function usePromptwiseMedia(): PromptwiseMedia[] | null {
  const [media, setMedia] = useState<PromptwiseMedia[] | null>(embeddedInPromptwise ? [] : null);
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!embeddedInPromptwise) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const items = promptwiseMedia(event.data);
      if (items) setMedia(items);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "promptwise:media-request" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return media;
}
