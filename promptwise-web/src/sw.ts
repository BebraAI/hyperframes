// fallow-ignore-file complexity -- runs only in a browser (a page and its Service Worker); checked with check.mjs and on staging, not in vitest
// Studio's API in a Service Worker. Studio's page for a tab is `<scope><docId>/`; every request it and its preview
// make under `<scope><docId>/api/` is answered here, by Studio's own API over the tab's folder in memory. The folder
// comes from the tab through Studio's page (boot.ts), so nothing here holds the user's session.
//
// Every request here is short: no stream is held open. A worker with a request in flight can't hand over to a new
// version, and Chrome stops one whose request runs past five minutes; a held-open change feed kept deploys from
// reaching open tabs and sent Studio's requests to the host after the stop. Changes go to the page by message.
/// <reference lib="webworker" />
import { openProject, type FileChange, type StudioBackend } from "./backend";
import { folder, type FolderReply, type FolderRequest } from "./folder";

declare const self: ServiceWorkerGlobalScope;
/** When this worker was built, set by build.mjs: which one answers shows in its errors and its pull check. */
declare const STUDIO_BUILD: string;

const scope = new URL(self.registration.scope).pathname;
const API = new RegExp(`^${scope}([0-9a-f-]{36})/api(?:/|$)`);
/** How long the tab has to answer one folder request. */
const ANSWER_MS = 20_000;
/** An upload carries the file up to promptwise's storage first. */
const UPLOAD_MS = 600_000;
const projects = new Map<string, Promise<StudioBackend>>();

/** The docId's Studio pages inside the tab: one opened on its own has nobody to answer. */
async function pagesOf(docId: string) {
  const pages = await self.clients.matchAll({ type: "window" });
  return pages.filter(
    (client) =>
      client.frameType === "nested" && new URL(client.url).pathname === `${scope}${docId}/`,
  );
}

const tell = async (docId: string, message: object) =>
  (await pagesOf(docId)).forEach((page) => page.postMessage({ ...message, build: STUDIO_BUILD }));

/** Asks the tab, through the docId's Studio page, and waits for its answer. */
async function ask(docId: string, request: FolderRequest): Promise<FolderReply> {
  const [page] = await pagesOf(docId);
  if (!page) return { status: 503 };
  const channel = new MessageChannel();
  return new Promise((resolve) => {
    // A page closed or reloaded before it answered never will: give up on it at once, so the next page's requests
    // don't wait out ANSWER_MS behind it.
    const gone = setInterval(
      async () => (await self.clients.get(page.id)) ?? done({ status: 503 }),
      1000,
    );
    const timer = setTimeout(
      () => done({ status: 504 }),
      request.op === "upload" ? UPLOAD_MS : ANSWER_MS,
    );
    function done(reply: FolderReply) {
      clearInterval(gone);
      clearTimeout(timer);
      resolve(reply);
    }
    channel.port1.onmessage = (event) => done(event.data as FolderReply);
    // A file's bytes move to the tab rather than being copied: the worker keeps the file itself.
    const moved = request.op === "upload" ? [request.bytes] : [];
    page.postMessage({ type: "promptwise:folder", request }, [channel.port2, ...moved]);
  });
}

function project(docId: string): Promise<StudioBackend> {
  let opened = projects.get(docId);
  if (!opened) {
    opened = openProject({
      prefix: `${scope}${docId}`,
      projectId: docId,
      folder: folder((r) => ask(docId, r)),
      runtimeUrl: `${scope}runtime.js`,
      catalogUrl: `${scope}catalog.json`,
      onChange: (change: FileChange) =>
        void tell(docId, { type: "promptwise:file-change", change }),
      // Studio only says "failed"; the tab logs why, which is all there is to see of a worker in a cross-site frame.
      onError: (path, message) =>
        void tell(docId, { type: "promptwise:studio-error", path, message }),
      // Where each file Studio added has got, which Studio shows on its clip.
      onUpload: (path, state) => void tell(docId, { type: "promptwise:upload-state", path, state }),
      // Studio's edit gave way to a change made elsewhere: the tab tells the user, who can bring it back with Undo.
      onConflict: (paths) => void tell(docId, { type: "promptwise:conflict", paths }),
    });
    // A folder that failed to open (the tab wasn't there yet) is tried again on the next request.
    opened.catch(() => projects.delete(docId));
    projects.set(docId, opened);
  }
  return opened;
}

/**
 * Studio's page asks every few seconds (boot.ts): look for changes made elsewhere, and say this worker answers. Its
 * first ask, made before Studio's own code has loaded, opens the folder, so Studio finds it read.
 */
async function pull(docId: string): Promise<Response> {
  const opening = !projects.has(docId);
  await project(docId)
    .then((backend) => (opening ? undefined : backend.refresh()))
    .catch(() => {});
  return new Response("ok", {
    headers: { "x-promptwise-worker": STUDIO_BUILD, "cache-control": "no-store" },
  });
}

// Asked by Studio on every open, with nothing behind them here, so each one was a 404 in the console: the tab's
// exports render on promptwise's worker, not with an FFmpeg in the browser, and its media carry no `.media`
// manifest (Studio reads an empty one as none).
const HERE_ANSWERS: [string, () => Response][] = [
  ["/api/environment/ffmpeg", () => Response.json({ ok: true })],
  [
    "/preview/.media/manifest.jsonl",
    () => new Response("", { headers: { "content-type": "text/plain" } }),
  ],
];

self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const docId = url.origin === location.origin ? API.exec(url.pathname)?.[1] : undefined;
  if (!docId) return;
  if (url.pathname.endsWith("/api/__pull")) return event.respondWith(pull(docId));
  const known = HERE_ANSWERS.find(([path]) => url.pathname.endsWith(path));
  if (known) return event.respondWith(known[1]());
  const opened = project(docId);
  event.respondWith(
    opened.then(
      (backend) => backend.fetch(event.request),
      (err: unknown) =>
        new Response(`Studio couldn't open this tab's files: ${String(err)}`, { status: 502 }),
    ),
  );
  // Studio has its answer before a file it added is up: the worker stays up until it is.
  event.waitUntil(opened.then((backend) => backend.settled()).catch(() => {}));
});
