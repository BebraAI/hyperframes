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
  | { op: "upload"; path: string; bytes: ArrayBuffer; contentType: string };
export type FolderReply = {
  status: number;
  files?: FolderFile[];
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
  const ok = async (request: FolderRequest) => {
    const reply = await send(request);
    if (reply.status === 412) return null;
    if (reply.status >= 400) throw new Error(refusal(reply.status, request.op));
    return reply;
  };
  return {
    /** With `content`, the text files come with their text, where the tab gives it (an older one doesn't). */
    list: async (content = false) =>
      (await ok(content ? { op: "list", content } : { op: "list" }))?.files ?? [],
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
