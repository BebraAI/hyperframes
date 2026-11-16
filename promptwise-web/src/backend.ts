// fallow-ignore-file complexity -- covered by backend.test.ts through openProject, which the CRAP estimate doesn't follow
// Studio's own API (createStudioApi) over a Timeline tab's folder held in memory: no Node server, no sandbox. Each
// write Studio makes goes back to promptwise over the version it read; changes made elsewhere (the agent's sandbox)
// come in on a refresh, which Studio's page asks for, and go out as Studio's own file-change events.
import "../shims/globals.js";
import { vol } from "../shims/fs.js";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import {
  createStudioApi,
  fileContentVersion,
  historyCache,
  openProjectHistory,
  PREVIEW_BUNDLE_OPTIONS,
} from "../../packages/studio-server/src/index.ts";
import { bundleToSingleHtml } from "../../packages/core/src/compiler/index.ts";
import { lintHyperframeHtml, lintProject } from "../../packages/core/src/lint/index.ts";
import {
  installStudioBlock,
  listStudioCatalog,
} from "../../packages/cli/src/server/studioCatalog.ts";
import type { Folder } from "./folder";

/** Studio's own notes beside the project (backups, history) stay in the page. */
const LOCAL = /^\.hyperframes\//;

/** Studio's edit history (its Undo), in memory beside the folder: it lasts as long as the worker. */
const HISTORY_ROOT = "/history";

const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");

/** One file changed elsewhere, as the CLI's file watcher tells Studio. */
export type FileChange = {
  path: string;
  version: string | null;
  projectId: string;
  affectsPreview: true;
  affectedCompositions: null;
};

type Options = {
  /** Studio's page folder: the API is under `<prefix>/api`. */
  prefix: string;
  projectId: string;
  folder: Folder;
  /** Where the runtime the preview loads is. */
  runtimeUrl: string;
  /** Hears about each of Studio's requests that failed on this side (a 5xx), for the tab to log. */
  onError?: (path: string, message: string) => void;
  /** Hears about each file a refresh found changed elsewhere, to tell Studio. */
  onChange?: (change: FileChange) => void;
};

export async function openProject({
  prefix,
  projectId,
  folder,
  runtimeUrl,
  onError,
  onChange,
}: Options) {
  const dir = `/projects/${projectId}`;
  const apiBase = `${prefix}/api`;
  /** The text promptwise has, by its sha1: what each write says it replaces. */
  const known = new Map<string, string>();
  /** Binary files: a link to promptwise's copy, and an empty file here so Studio sees them. */
  const media = new Map<string, string>();

  const local = (path: string) => `${dir}/${path}`;
  const place = (path: string, text: string) => {
    vol.mkdirSync(dirname(local(path)), { recursive: true });
    vol.writeFileSync(local(path), text);
  };
  // The first look fills the folder: nothing has changed for Studio yet.
  let opened = false;
  const changed = (path: string) => {
    if (!opened) return;
    const text =
      media.has(path) || !vol.existsSync(local(path))
        ? null
        : String(vol.readFileSync(local(path), "utf8"));
    const version = text === null ? null : fileContentVersion(text);
    onChange?.({ path, version, projectId, affectsPreview: true, affectedCompositions: null });
    // The history records a change made elsewhere (the agent's) as an outside change, as the CLI's watcher tells it.
    void histories.peek(dir)?.then((history) => history?.noteChange(path));
  };

  /** Takes in what changed in promptwise since the last look; the first look asks for the text with the listing. */
  async function pull() {
    const files = await folder.list(!opened);
    const there = new Set(files.map((f) => f.path));
    // A clip or picture added elsewhere (the agent's sandbox) shows in Studio's assets without a reload.
    for (const file of files.filter((f) => f.url && media.get(f.path) !== f.url)) {
      if (!media.has(file.path)) place(file.path, "");
      media.set(file.path, file.url!);
      changed(file.path);
    }
    // Text the listing didn't carry is read at once: each read is a trip through the tab, and a folder has a dozen
    // files or more.
    const stale = files.filter((f) => !f.url && known.get(f.path) !== f.sha1);
    const texts = await Promise.all(stale.map((f) => f.content ?? folder.read(f.path)));
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

  const histories = historyCache((projectDir) =>
    openProjectHistory({
      projectDir,
      historyRoot: `${HISTORY_ROOT}/${projectId}`,
      // One worker holds the folder: there is no other process to wait for.
      ownerWaitMs: 0,
      onError: (error) => onError?.("/history", String(error)),
    }).catch((error: unknown) => {
      onError?.("/history", `Studio's undo is off: ${String(error)}`);
      histories.forget(projectDir);
      return null;
    }),
  );

  vol.rmSync(dir, { recursive: true, force: true });
  vol.rmSync(`${HISTORY_ROOT}/${projectId}`, { recursive: true, force: true });
  vol.mkdirSync(dir, { recursive: true });
  await pull();
  opened = true;

  const project = { id: projectId, dir };
  const adapter = {
    history: () => histories.get(dir),
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
    // The catalog from the fork's registry on GitHub; an install writes into the folder, which goes back as any write.
    listRegistryCatalog: () => listStudioCatalog(dir),
    installRegistryBlock: (opts: { project: { dir: string }; blockName: string }) =>
      installStudioBlock(opts.project.dir, opts.blockName),
    rendersDir: () => "/renders",
    startRender: () => {
      throw new Error("Export from promptwise's Timeline tab");
    },
  };
  const api = createStudioApi(adapter as never);

  /** A path no file has: name, then "name (2)", as Studio's server names a second upload of one file. */
  function free(path: string) {
    const [, base, ext] = /^(.*?)(\.[^./]*)?$/.exec(path)!;
    let next = path;
    for (let n = 2; vol.existsSync(local(next)); n++) next = `${base} (${n})${ext ?? ""}`;
    return next;
  }

  /** Studio's upload (a drop, Upload from computer): each file goes up through the tab, and comes back as a link. */
  async function upload(request: Request): Promise<Response> {
    const dir = new URL(request.url).searchParams.get("dir")?.replace(/^\/+|\/+$/g, "");
    const files: string[] = [];
    const invalid: { name: string; reason: string }[] = [];
    for (const value of (await request.formData()).values()) {
      if (typeof value === "string") continue;
      const name = value.name.split(/[\\/]/).pop() ?? "";
      if (!name || name.includes("..") || dir?.includes("..")) continue;
      const path = free(dir ? `${dir}/${name}` : name);
      try {
        const saved = await folder.upload(path, await value.arrayBuffer(), value.type);
        if (!saved) throw new Error("another file took its name");
        // After any look in flight, which wouldn't have seen it yet.
        await serial(async () => {
          place(path, "");
          media.set(path, saved.url);
        });
        files.push(path);
      } catch (error) {
        invalid.push({ name, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return Response.json({ ok: true, files, skipped: [], invalid, unchecked: [] }, { status: 201 });
  }

  /** What the worker answers itself rather than Studio's API. */
  function own(request: Request, path: string): Response | Promise<Response> | undefined {
    if (path === "/runtime.js") return fetch(runtimeUrl);
    const link = media.get(
      decodeURIComponent(/^\/projects\/[^/]+\/preview\/(.+)$/.exec(path)?.[1] ?? ""),
    );
    if (link) return Response.redirect(link, 302);
    if (request.method === "POST" && /^\/projects\/[^/]+\/upload$/.test(path))
      return upload(request);
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
    // 501 is what isn't in the browser yet (thumbnails, renders, ffmpeg), which the tab needn't hear about each time.
    if (response.status >= 500 && response.status !== 501)
      onError?.(path, (await response.clone().text()).slice(0, 500));
    return response;
  }

  return {
    /** Answers one of Studio's API requests. */
    fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname.slice(apiBase.length);
      return Promise.resolve(own(request, path) ?? answer(request, path));
    },
    /** Looks for changes made elsewhere: Studio's page asks every few seconds while it's open. */
    refresh: () => serial(pull),
    /** Stops the history's timers and lets the folder go. */
    close: () => histories.closeAll(),
  };
}
export type StudioBackend = Awaited<ReturnType<typeof openProject>>;
