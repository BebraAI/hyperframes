// A Timeline tab's folder in promptwise. Studio's page doesn't call promptwise itself: it asks the tab that holds it,
// which reads and writes the folder through promptwise's studio/files routes. So Studio, and the compositions its
// preview runs, never hold the user's session.

/** A file in the folder: text has no url; a binary file is a link to its copy in promptwise's storage. */
export type FolderFile = { path: string; sha1: string; url: string | null };

/** One request to the tab, and what it answers. */
export type FolderRequest =
  | { op: "list" }
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

/** The folder over a transport. A write or delete over a version that changed meanwhile (412) gets null or false. */
export function folder(send: FolderTransport) {
  const ok = async (request: FolderRequest) => {
    const reply = await send(request);
    if (reply.status === 412) return null;
    if (reply.status >= 400)
      throw new Error(`promptwise answered ${reply.status} to ${request.op}`);
    return reply;
  };
  return {
    list: async () => (await ok({ op: "list" }))?.files ?? [],
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
