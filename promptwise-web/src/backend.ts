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
import { loadProjectConfig } from "../../packages/cli/src/utils/projectConfig.ts";
import { DEFAULT_REGISTRY_URL } from "../../packages/cli/src/registry/remote.ts";
import { validRegistryItem } from "../../packages/cli/src/registry/validation.ts";
import type { RegistryItem } from "@hyperframes/core";
import type { Folder } from "./folder";
import { AGENT_EDIT_LABEL } from "../../packages/studio/src/promptwise/agentEdit.ts";

/** Studio's own notes beside the project (backups, history) stay in the page. */
const LOCAL = /^\.hyperframes\//;

/** Studio's edit history (its Undo), in memory beside the folder: it lasts as long as the worker. */
const HISTORY_ROOT = "/history";

const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");

/** The files promptwise's storage takes (its studio/upload route), up to its 100 MB: the rest are turned down here, at once. */
const STORED =
  /^(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|mp4|ogg|webm)|font\/(woff2?|ttf|otf))$/;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Whether a file's first bytes are only text: a real picture, clip, sound or font has binary bytes in its header, so a
 * text file renamed to .mp4 is turned down here instead of becoming a clip that never plays.
 */
export async function looksLikeText(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (!head.length) return true;
  // Tab, newline, carriage return and the printable range; bytes from 0x80 up are UTF-8 text when they decode as it.
  if (head.some((b) => b < 0x20 && b !== 9 && b !== 10 && b !== 13)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(
      head.length === 512 ? head.slice(0, 508) : head,
    );
    return true;
  } catch {
    return false;
  }
}

/** Where one file Studio added has got: going up to promptwise's storage, there, or failed (Studio offers a retry). */
type UploadState = "uploading" | "done" | "failed";

/** A file from this page, answered from memory, with the ranges a clip or sound is read in. */
function serveBlob(request: Request, blob: Blob): Response {
  const headers = {
    "content-type": blob.type,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  const body = request.method === "HEAD" ? null : blob;
  if (!range || (!range[1] && !range[2]))
    return new Response(body, { headers: { ...headers, "content-length": String(blob.size) } });
  const size = blob.size;
  // "bytes=-500" is the last 500 bytes; "bytes=100-" runs to the end.
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start >= size || start > end)
    return new Response(null, {
      status: 416,
      headers: { ...headers, "content-range": `bytes */${size}` },
    });
  const part = blob.slice(start, end + 1, blob.type);
  return new Response(request.method === "HEAD" ? null : part, {
    status: 206,
    headers: {
      ...headers,
      "content-length": String(part.size),
      "content-range": `bytes ${start}-${end}/${size}`,
    },
  });
}

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
  /** The registry's catalog as one file, built with this Studio (build.mjs); without it, each item is fetched. */
  catalogUrl?: string;
  /** Hears about each of Studio's requests that failed on this side (a 5xx), for the tab to log. */
  onError?: (path: string, message: string) => void;
  /** Hears about each file a refresh found changed elsewhere, to tell Studio. */
  onChange?: (change: FileChange) => void;
  /** Hears where each file Studio added has got, for Studio to show on its clip. */
  onUpload?: (path: string, state: UploadState) => void;
  /** Hears the files whose edit in Studio gave way to a change made elsewhere meanwhile, for the tab to tell the user. */
  onConflict?: (paths: string[]) => void;
};

export async function openProject({
  prefix,
  projectId,
  folder,
  runtimeUrl,
  catalogUrl,
  onError,
  onChange,
  onUpload,
  onConflict,
}: Options) {
  const dir = `/projects/${projectId}`;
  const apiBase = `${prefix}/api`;
  /** The text promptwise has, by its sha1: what each write says it replaces. */
  const known = new Map<string, string>();
  /** Binary files: a link to promptwise's copy, and an empty file here so Studio sees them. */
  const media = new Map<string, string>();
  /** Files uploaded from this page: shown from here, not fetched back from the storage they just went to. */
  const fresh = new Map<string, Blob>();
  /**
   * Files Studio added that aren't in promptwise's storage yet: going up (`done` settles when they're in the folder),
   * or failed. Studio has them at once; promptwise gets the compositions that use them only once they're there.
   */
  const uploading = new Map<string, { done: Promise<void>; failed: boolean }>();

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
    // A file of this page's still going up is taken in by its upload, which holds the copy here.
    for (const file of files.filter(
      (f) => f.url && media.get(f.path) !== f.url && !uploading.has(f.path),
    )) {
      if (!media.has(file.path)) place(file.path, "");
      media.set(file.path, file.url!);
      fresh.delete(file.path);
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
      fresh.delete(path);
      changed(path);
    }
  }

  /** Text files Studio changed: not its own notes, not the links to binary files. */
  const edited = (files: Record<string, string | null>) =>
    Object.entries(files).flatMap(([abs, text]) => {
      const path = abs.slice(dir.length + 1);
      const skip =
        text === null ||
        LOCAL.test(path) ||
        media.has(path) ||
        uploading.has(path) ||
        known.get(path) === sha1(text);
      return skip ? [] : [{ path, text: text! }];
    });

  /**
   * Sends Studio's writes and deletes; returns the ones that lost to a change made meanwhile. A tab that takes batches
   * gets them all in one request, saved all or none, so one edit that touches two files never lands half way.
   */
  async function send(files: Record<string, string | null>): Promise<string[]> {
    const writes = edited(files);
    const removed = [...known].filter(([path]) => !(local(path) in files));
    if (!writes.length && !removed.length) return [];
    if (folder.batches) {
      const result = await folder.batch([
        ...writes.map(({ path, text }) => ({ path, base: known.get(path) ?? null, content: text })),
        ...removed.map(([path, base]) => ({ path, base, remove: true as const })),
      ]);
      if ("stale" in result) return result.stale;
      for (const [path, sha] of result.saved) {
        if (sha) known.set(path, sha);
        else known.delete(path);
      }
      return [];
    }
    const lost: string[] = [];
    for (const { path, text } of writes) {
      const saved = await folder.write(path, text, known.get(path) ?? null);
      if (saved) known.set(path, saved);
      else lost.push(path);
    }
    for (const [path, base] of removed) {
      if (await folder.remove(path, base)) known.delete(path);
      else lost.push(path);
    }
    return lost;
  }

  /**
   * Sends Studio's changes. One that lost takes promptwise's copy: forgetting its version makes pull read it. A batch
   * saved nothing of the edit, so every file it touched takes promptwise's copy. The history records the change as the
   * agent's, so Undo brings the user's edit back over it, and the tab tells the user so.
   */
  async function push() {
    const files = vol.toJSON(dir) as Record<string, string | null>;
    const touched = [
      ...edited(files).map((w) => w.path),
      ...[...known.keys()].filter((path) => !(local(path) in files)),
    ];
    const lost = await send(files);
    if (!lost.length) return;
    // The history takes in the user's edit before promptwise's copy replaces it, so Undo has it to bring back.
    await (await histories.peek(dir))?.checkpoint().catch(() => undefined);
    for (const path of folder.batches ? touched : lost) known.delete(path);
    onError?.(lost.join(", "), "changed in promptwise meanwhile, so Studio's edit gave way to it");
    onConflict?.(lost);
    await pull();
    // A file the lost batch would have made isn't in promptwise: it goes too, so a later save can't send it on its own.
    if (!folder.batches) return;
    for (const path of touched.filter((p) => !known.has(p) && !media.has(p) && !uploading.has(p))) {
      vol.rmSync(local(path), { force: true });
      changed(path);
    }
  }

  // One look or send at a time, in order.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = (fn: () => Promise<void>) => (queue = queue.then(fn, fn));

  /** Whether any composition here still names the file (a clip Studio deleted doesn't). */
  const named = (path: string) => {
    const name = path.split("/").pop()!;
    const names = [name, encodeURI(name), encodeURIComponent(name)];
    return Object.entries(vol.toJSON(dir)).some(
      ([abs, text]) => abs.endsWith(".html") && names.some((n) => text?.includes(n)),
    );
  };

  /**
   * What holds Studio's edits back from promptwise: a file still going up, or one that failed and a composition still
   * names. promptwise (and the agent) never get a composition naming a file its storage doesn't have. A failed file no
   * composition names any more (its clip was deleted) is let go.
   */
  function held(): Promise<void>[] | null {
    const going: Promise<void>[] = [];
    for (const [path, upload] of uploading) {
      if (!upload.failed) going.push(upload.done);
      else if (named(path)) return null;
      else forget(path);
    }
    return going;
  }

  function forget(path: string) {
    uploading.delete(path);
    fresh.delete(path);
    vol.rmSync(local(path), { force: true });
  }

  /** Sends Studio's changes once nothing holds them back; a send that waits is reported as it goes, not awaited. */
  let waiting = false;
  function save(path: string): Promise<void> {
    const going = held();
    const report = (error: unknown) =>
      onError?.(path, `not saved to promptwise: ${error instanceof Error ? error.message : error}`);
    if (going && !going.length) return serial(push);
    // One send waits for the uploads; it sends everything Studio changed meanwhile.
    if (going && !waiting) {
      waiting = true;
      void Promise.all(going).then(() => {
        waiting = false;
        return save(path).catch(report);
      });
    }
    return Promise.resolve();
  }

  const histories = historyCache((projectDir) =>
    openProjectHistory({
      projectDir,
      historyRoot: `${HISTORY_ROOT}/${projectId}`,
      // One worker holds the folder: there is no other process to wait for.
      ownerWaitMs: 0,
      // What changes the folder outside Studio here is promptwise's agent, so Undo names it.
      outsideLabel: AGENT_EDIT_LABEL,
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
    // The catalog built with this Studio, for a project on the default registry: fetching ~240 manifests one by one
    // from GitHub took 30-40 s. Otherwise, or if that file is missing, the catalog from the project's registry. An
    // install still fetches from the registry and writes into the folder, which goes back as any write.
    listRegistryCatalog: async () =>
      (catalogUrl && loadProjectConfig(dir).registry === DEFAULT_REGISTRY_URL
        ? await bundledCatalog(catalogUrl)
        : undefined) ?? listStudioCatalog(dir),
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

  /** Takes one file up to promptwise's storage, then into the folder; a failed one waits for Studio's retry. */
  function sendUp(path: string, file: Blob) {
    onUpload?.(path, "uploading");
    const done = (async () => {
      try {
        const saved = await folder.upload(path, await file.arrayBuffer(), file.type);
        if (!saved) throw new Error("another file took its name");
        // After any look in flight, which wouldn't have seen it yet.
        await serial(async () => {
          media.set(path, saved.url);
          uploading.delete(path);
        });
        onUpload?.(path, "done");
      } catch (error) {
        const upload = uploading.get(path);
        if (upload) upload.failed = true;
        onError?.(path, `upload failed: ${error instanceof Error ? error.message : error}`);
        onUpload?.(path, "failed");
      }
    })();
    uploading.set(path, { done, failed: false });
    return done;
  }

  /**
   * Studio's upload (a drop, Upload from computer): each file is in the folder at once, shown from this page, and goes
   * up to promptwise's storage through the tab meanwhile. Studio places its clip without waiting for that.
   */
  async function upload(request: Request): Promise<Response> {
    const dir = new URL(request.url).searchParams.get("dir")?.replace(/^\/+|\/+$/g, "");
    const files: string[] = [];
    const invalid: { name: string; reason: string }[] = [];
    for (const value of (await request.formData()).values()) {
      if (typeof value === "string") continue;
      const name = value.name.split(/[\\/]/).pop() ?? "";
      if (!name || name.includes("..") || dir?.includes("..")) continue;
      if (!STORED.test(value.type)) {
        invalid.push({ name, reason: "only pictures, clips, sounds and fonts are uploaded" });
        continue;
      }
      if (value.size <= 0 || value.size > MAX_UPLOAD_BYTES) {
        invalid.push({ name, reason: "files can be up to 100 MB" });
        continue;
      }
      if (!value.type.startsWith("font/") && (await looksLikeText(value))) {
        invalid.push({
          name,
          reason: "the file is damaged or isn't really a picture, clip or sound",
        });
        continue;
      }
      const path = free(dir ? `${dir}/${name}` : name);
      place(path, "");
      fresh.set(path, value);
      void sendUp(path, value);
      files.push(path);
    }
    return Response.json({ ok: true, files, skipped: [], invalid, unchecked: [] }, { status: 201 });
  }

  /** Studio's retry of a file that failed to go up. */
  function retry(request: Request): Response {
    const path = new URL(request.url).searchParams.get("path") ?? "";
    const file = fresh.get(path);
    const upload = uploading.get(path);
    if (!file || !upload?.failed)
      return Response.json({ error: "nothing to retry" }, { status: 404 });
    // The edits it held back go once it's up.
    void sendUp(path, file).then(() => (uploading.has(path) ? undefined : save(path)));
    return Response.json({ ok: true }, { status: 202 });
  }

  /** What the worker answers itself rather than Studio's API. */
  function own(request: Request, path: string): Response | Promise<Response> | undefined {
    if (path === "/runtime.js") return fetch(runtimeUrl);
    const file = decodeURIComponent(/^\/projects\/[^/]+\/preview\/(.+)$/.exec(path)?.[1] ?? "");
    const blob = fresh.get(file);
    if (blob) return serveBlob(request, blob);
    const link = media.get(file);
    if (link) return Response.redirect(link, 302);
    if (request.method === "POST" && /^\/projects\/[^/]+\/upload$/.test(path))
      return upload(request);
    if (request.method === "POST" && /^\/projects\/[^/]+\/upload-retry$/.test(path))
      return retry(request);
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
    if (!reads)
      await save(path).catch((error: unknown) => {
        onError?.(
          path,
          `not saved to promptwise: ${error instanceof Error ? error.message : error}`,
        );
        throw error;
      });
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
    /** Settles once no file is going up: the worker stays up for it. */
    settled: () =>
      Promise.all([...uploading.values()].map((upload) => upload.done)).then(() => undefined),
    /** Stops the history's timers and lets the folder go. */
    close: () => histories.closeAll(),
  };
}
export type StudioBackend = Awaited<ReturnType<typeof openProject>>;

const bundled = new Map<string, Promise<RegistryItem[] | undefined>>();

/** A block or component as the registry lists it, checked as `add` checks a fetched one. */
function catalogItem(value: unknown): value is RegistryItem {
  if (typeof value !== "object" || value === null) return false;
  const name = "name" in value ? value.name : undefined;
  const type = "type" in value ? value.type : undefined;
  return (
    typeof name === "string" &&
    (type === "hyperframes:block" || type === "hyperframes:component") &&
    validRegistryItem(value, name, type)
  );
}

/** The catalog file build.mjs wrote, fetched once per worker; undefined when it is missing or not a catalog. */
function bundledCatalog(url: string): Promise<RegistryItem[] | undefined> {
  let loading = bundled.get(url);
  if (!loading) {
    loading = fetch(url)
      .then(async (res) => {
        if (!res.ok) return undefined;
        const items: unknown = await res.json();
        if (!Array.isArray(items) || items.length === 0) return undefined;
        const valid = items.filter(catalogItem);
        return valid.length === items.length ? valid : undefined;
      })
      .catch(() => undefined);
    // A failed fetch isn't kept: the next catalog request tries the file again.
    loading.then((items) => items ?? bundled.delete(url));
    bundled.set(url, loading);
  }
  return loading;
}
