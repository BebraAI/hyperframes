// fallow-ignore-file complexity -- covered by backend.test.ts through openProject, which the CRAP estimate doesn't follow
// Studio's own API (createStudioApi) over a Timeline tab's folder held in memory: no Node server, no sandbox. Each
// write Studio makes goes back to promptwise over the version it read; changes made elsewhere (the agent's sandbox)
// come in as Studio's own file-change events.
import "../shims/globals.js";
import { vol } from "../shims/fs.js";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import {
  createStudioApi,
  fileContentVersion,
  PREVIEW_BUNDLE_OPTIONS,
} from "../../packages/studio-server/src/index.ts";
import { bundleToSingleHtml } from "../../packages/core/src/compiler/index.ts";
import { lintHyperframeHtml, lintProject } from "../../packages/core/src/lint/index.ts";
import type { Folder } from "./folder";

/** How often a project with Studio open looks for changes made elsewhere. */
export const PULL_MS = 5000;
/** Studio's own notes beside the project (backups, history) stay in the page. */
const LOCAL = /^\.hyperframes\//;

const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");
const encoder = new TextEncoder();

type Options = {
  /** Studio's page folder: the API is under `<prefix>/api`. */
  prefix: string;
  projectId: string;
  folder: Folder;
  /** Where the runtime the preview loads is. */
  runtimeUrl: string;
};

export async function openProject({ prefix, projectId, folder, runtimeUrl }: Options) {
  const dir = `/projects/${projectId}`;
  const apiBase = `${prefix}/api`;
  /** The text promptwise has, by its sha1: what each write says it replaces. */
  const known = new Map<string, string>();
  /** Binary files: a link to promptwise's copy, and an empty file here so Studio sees them. */
  const media = new Map<string, string>();
  const listeners = new Set<(path: string) => void>();

  const local = (path: string) => `${dir}/${path}`;
  const place = (path: string, text: string) => {
    vol.mkdirSync(dirname(local(path)), { recursive: true });
    vol.writeFileSync(local(path), text);
  };
  const changed = (path: string) => listeners.forEach((send) => send(path));

  /** Takes in what changed in promptwise since the last look. */
  async function pull() {
    const files = await folder.list();
    const there = new Set(files.map((f) => f.path));
    for (const file of files.filter((f) => f.url)) {
      if (!media.has(file.path)) place(file.path, "");
      media.set(file.path, file.url!);
    }
    // Read at once: each read is a trip through the tab, and a folder has a dozen files or more.
    const stale = files.filter((f) => !f.url && known.get(f.path) !== f.sha1);
    const texts = await Promise.all(stale.map((f) => folder.read(f.path)));
    stale.forEach((file, i) => {
      place(file.path, texts[i]!);
      known.set(file.path, file.sha1);
      changed(file.path);
    });
    for (const path of [...known.keys(), ...media.keys()].filter((p) => !there.has(p))) {
      vol.rmSync(local(path), { force: true });
      known.delete(path);
      media.delete(path);
      changed(path);
    }
  }

  /** Text files Studio changed: not its own notes, not the links to binary files. */
  const edited = (files: Record<string, string | null>) =>
    Object.entries(files).flatMap(([abs, text]) => {
      const path = abs.slice(dir.length + 1);
      const skip =
        text === null || LOCAL.test(path) || media.has(path) || known.get(path) === sha1(text);
      return skip ? [] : [{ path, text: text! }];
    });

  /** Sends Studio's writes and deletes; returns the ones that lost to a change made meanwhile. */
  async function send(files: Record<string, string | null>): Promise<string[]> {
    const lost: string[] = [];
    for (const { path, text } of edited(files)) {
      const saved = await folder.write(path, text, known.get(path) ?? null);
      if (saved) known.set(path, saved);
      else lost.push(path);
    }
    for (const [path, base] of [...known].filter(([path]) => !(local(path) in files))) {
      if (await folder.remove(path, base)) known.delete(path);
      else lost.push(path);
    }
    return lost;
  }

  /** Sends Studio's changes. One that lost takes promptwise's copy: forgetting its version makes pull read it. */
  async function push() {
    const lost = await send(vol.toJSON(dir) as Record<string, string | null>);
    lost.forEach((path) => known.delete(path));
    if (lost.length) await pull();
  }

  // One look or send at a time, in order.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = (fn: () => Promise<void>) => (queue = queue.then(fn, fn));

  vol.rmSync(dir, { recursive: true, force: true });
  vol.mkdirSync(dir, { recursive: true });
  await pull();

  const project = { id: projectId, dir };
  const adapter = {
    listProjects: () => [project],
    resolveProject: (id: string) => (id === projectId ? project : null),
    async bundle(projectDir: string, options: object) {
      const html = await bundleToSingleHtml(projectDir, { ...PREVIEW_BUNDLE_OPTIONS, ...options });
      return html.replace(
        'data-hyperframes-preview-runtime="1" src=""',
        `data-hyperframes-preview-runtime="1" src="${apiBase}/runtime.js"`,
      );
    },
    lint: (html: string, opts?: object) => lintHyperframeHtml(html, { ...opts, host: "studio" }),
    lintProject: (projectDir: string) => lintProject(projectDir, undefined, { host: "studio" }),
    runtimeUrl: `${apiBase}/runtime.js`,
    apiBase,
    rendersDir: () => "/renders",
    startRender: () => {
      throw new Error("Export from promptwise's Timeline tab");
    },
  };
  const api = createStudioApi(adapter as never);

  // While Studio listens for changes, look for them every PULL_MS: one look for all its streams.
  let timer: ReturnType<typeof setInterval> | undefined;
  const listen = (send: (path: string) => void) => {
    listeners.add(send);
    timer ??= setInterval(() => void serial(pull).catch(() => {}), PULL_MS);
  };
  const unlisten = (send: (path: string) => void) => {
    listeners.delete(send);
    if (!listeners.size) timer = void clearInterval(timer);
  };

  /** Studio's change feed: what changed elsewhere, as the CLI's file watcher tells it. */
  function events(): Response {
    let send: (path: string) => void;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        send = (path) => {
          const text = media.has(path)
            ? null
            : vol.existsSync(local(path))
              ? String(vol.readFileSync(local(path), "utf8"))
              : null;
          const data = {
            path,
            version: text === null ? null : fileContentVersion(text),
            projectId,
            affectsPreview: true,
            affectedCompositions: null,
          };
          controller.enqueue(
            encoder.encode(`event: file-change\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        listen(send);
        controller.enqueue(encoder.encode(": open\n\n"));
      },
      cancel: () => unlisten(send),
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    });
  }

  /** What the worker answers itself rather than Studio's API. */
  function own(path: string): Response | Promise<Response> | undefined {
    if (path === "/events") return events();
    if (path === "/runtime.js") return fetch(runtimeUrl);
    const link = media.get(
      decodeURIComponent(/^\/projects\/[^/]+\/preview\/(.+)$/.exec(path)?.[1] ?? ""),
    );
    if (link) return Response.redirect(link, 302);
    if (/^\/projects\/[^/]+\/upload/.test(path))
      return new Response("Add media from promptwise's chat or Project media", { status: 501 });
  }

  /** Studio's API, at its root as the CLI mounts it; a request that changes something is sent on before it's answered. */
  async function answer(request: Request, path: string): Promise<Response> {
    const reads = request.method === "GET" || request.method === "HEAD";
    const url = new URL(request.url);
    url.pathname = path;
    const body = reads ? undefined : await request.arrayBuffer();
    const response = await api.fetch(
      new Request(url, { method: request.method, headers: request.headers, body }),
    );
    if (!reads) await serial(push);
    return response;
  }

  return {
    /** Answers one of Studio's API requests. */
    fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname.slice(apiBase.length);
      return Promise.resolve(own(path) ?? answer(request, path));
    },
    /** Looks for changes made elsewhere now, as when the tab says the agent saved some. */
    refresh: () => serial(pull),
  };
}
export type StudioBackend = Awaited<ReturnType<typeof openProject>>;
