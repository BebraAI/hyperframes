import { useEffect, useState } from "react";
import { embeddedInPromptwise } from "./embed";

/** One of the promptwise project's images, videos and sounds, played from its own address. */
export interface PromptwiseMedia {
  url: string;
  name: string;
  kind: "image" | "video" | "audio";
  /** A picture to show for it: the image itself, or a video's poster. */
  thumb?: string;
  /** How long it plays, in seconds, when promptwise knows: a clip placed from it then lands at once, unprobed. */
  duration?: number;
  /** One of the account's from another chat, which the Assets panel lists apart from the project's. */
  account?: boolean;
}

const KINDS = new Set(["image", "video", "audio"]);

const isHttp = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//.test(value);

const isLength = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** What an item may say besides what it is: its poster, its length, and that it's the account's. */
function extras(thumb: unknown, duration: unknown, account: unknown): Partial<PromptwiseMedia> {
  return {
    ...(isHttp(thumb) ? { thumb } : {}),
    ...(isLength(duration) ? { duration } : {}),
    ...(account === true ? { account } : {}),
  };
}

/** One item of the message, or null for one Studio can't play from its address. */
function mediaItem(item: unknown): PromptwiseMedia | null {
  const { url, name, kind, thumb, duration, account } = (item ?? {}) as Record<string, unknown>;
  if (!isHttp(url) || typeof kind !== "string" || !KINDS.has(kind)) return null;
  return {
    url,
    name: typeof name === "string" && name ? name : kind,
    kind: kind as PromptwiseMedia["kind"],
    ...extras(thumb, duration, account),
  };
}

/** The names promptwise gave its media, by address: a clip placed from one is named after it, not its file. */
const names = new Map<string, string>();
/** How long promptwise says its media plays, in seconds, by address. */
const durations = new Map<string, number>();

/** How long the media at `url` plays by promptwise's word, in seconds; undefined when it didn't say. */
export function promptwiseMediaDuration(url: string): number | undefined {
  return durations.get(url);
}

/** The name promptwise gave the media at `url`, without a file extension; undefined for one it didn't send. */
export function promptwiseMediaName(url: string): string | undefined {
  return names
    .get(url)
    ?.replace(/\.(mp4|mov|webm|m4v|mp3|wav|m4a|ogg|aac|png|jpe?g|webp|gif|avif)$/i, "");
}

/** The project's media from promptwise's promptwise:media message; null for any other message. */
export function promptwiseMedia(data: unknown): PromptwiseMedia[] | null {
  if (typeof data !== "object" || data === null) return null;
  const { type, items } = data as { type?: unknown; items?: unknown };
  if (type !== "promptwise:media" || !Array.isArray(items)) return null;
  const media = items.flatMap((item: unknown) => {
    const one = mediaItem(item);
    return one ? [one] : [];
  });
  for (const m of media) {
    if (m.name !== m.kind) names.set(m.url, m.name);
    if (m.duration) durations.set(m.url, m.duration);
  }
  return media;
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
