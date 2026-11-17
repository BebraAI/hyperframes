// A Timeline tab's folder in promptwise. Studio's page doesn't call promptwise itself: it asks the tab that holds it,
// which reads and writes the folder through promptwise's studio/files routes. So Studio, and the compositions its
// preview runs, never hold the user's session.

/**
 * A file in the folder: text has no url; a binary file is a link to its copy in promptwise's storage. A listing asked
 * for with its content carries a text file's text too.
 */
export type FolderFile = { path: string; sha1: string; url: string | null; content?: string };

/** One request to the tab, and what it answers. */
export type FolderRequest =
  | { op: "list"; content?: boolean }
  | { op: "read"; path: string }
  | { op: "write"; path: string; content: string; base: string | null }
  | { op: "remove"; path: string; base: string }
  | { op: "upload"; path: string; bytes: ArrayBuffer; contentType: string }
  | { op: "batch"; writes: BatchWrite[] };
/** One change in a batch: text written over `base` (null: a new file), or the file at `base` deleted. */
export type BatchWrite =
  | { path: string; base: string | null; content: string }
  | { path: string; base: string; remove: true };
export type FolderReply = {
  status: number;
  /** A listing's files; a batch's, each with its new sha1 (null: deleted). */
  files?: FolderFile[] | { path: string; sha1: string | null }[];
  /** A listing from a tab that takes batches (`batch` requests) says so. */
  batch?: boolean;
  /** A batch turned down (412): the paths that changed since they were read. */
  stale?: string[];
  content?: string;
  sha1?: string;
  url?: string;
};

export type FolderTransport = (request: FolderRequest) => Promise<FolderReply>;

/** What the user reads when promptwise turns a request down, instead of its status code. */
export function refusal(status: number, op: FolderRequest["op"]): string {
  if (status === 400 && op === "upload") return "this file type isn't supported";
  if (status === 413) return "files can be up to 100 MB";
  if (status === 401 || status === 403) return "you're signed out; reload the page";
  if (status === 404) return "this timeline isn't there any more";
  return op === "upload"
    ? `the upload failed (${status}); try again`
    : `couldn't save (${status}); try again`;
}

/** The folder over a transport. A write or delete over a version that changed meanwhile (412) gets null or false. */
export function folder(send: FolderTransport) {
  const ok = async (request: Exclude<FolderRequest, { op: "batch" }>) => {
    const reply = await send(request);
    if (reply.status === 412) return null;
    if (reply.status >= 400) throw new Error(refusal(reply.status, request.op));
    return reply;
  };
  /** Whether the tab takes a batch of writes in one request: its listing says so; an older tab's doesn't. */
  let batches = false;
  return {
    /** With `content`, the text files come with their text, where the tab gives it (an older one doesn't). */
    list: async (content = false) => {
      const reply = await ok(content ? { op: "list", content } : { op: "list" });
      batches = reply?.batch === true;
      return (reply?.files ?? []) as FolderFile[];
    },
    get batches() {
      return batches;
    },
    /**
     * Writes and deletes all or none, each over the version it names: each path's new sha1 (null: deleted), or the
     * paths that changed meanwhile, when nothing was written.
     */
    batch: async (
      writes: BatchWrite[],
    ): Promise<{ stale: string[] } | { saved: Map<string, string | null> }> => {
      const reply = await send({ op: "batch", writes });
      if (reply.status === 412) return { stale: reply.stale ?? writes.map((w) => w.path) };
      if (reply.status >= 400) throw new Error(refusal(reply.status, "batch"));
      const saved = (reply.files ?? []) as { path: string; sha1: string | null }[];
      return { saved: new Map(saved.map((f) => [f.path, f.sha1])) };
    },
    read: async (path: string) => (await ok({ op: "read", path }))?.content ?? "",
    write: async (path: string, content: string, base: string | null) =>
      (await ok({ op: "write", path, content, base }))?.sha1 ?? null,
    remove: async (path: string, base: string) => (await ok({ op: "remove", path, base })) !== null,
    /** A new binary file: promptwise stores it and answers its link, or null when the path was taken meanwhile. */
    upload: async (path: string, bytes: ArrayBuffer, contentType: string) => {
      const reply = await ok({ op: "upload", path, bytes, contentType });
      return reply?.url ? { sha1: reply.sha1!, url: reply.url } : null;
    },
  };
}
export type Folder = ReturnType<typeof folder>;
