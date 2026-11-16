// Studio's API in a Service Worker. Studio's page for a tab is `<scope><docId>/`; every request it and its preview
// make under `<scope><docId>/api/` is answered here, by Studio's own API over the tab's folder in memory. The folder
// comes from the tab through Studio's page (boot.ts), so nothing here holds the user's session.
/// <reference lib="webworker" />
import { openProject, type StudioBackend } from "./backend";
import { folder, type FolderReply, type FolderRequest } from "./folder";

declare const self: ServiceWorkerGlobalScope;

const scope = new URL(self.registration.scope).pathname;
const API = new RegExp(`^${scope}([0-9a-f-]{36})/api(?:/|$)`);
/** How long the tab has to answer one folder request. */
const ANSWER_MS = 20_000;
const projects = new Map<string, Promise<StudioBackend>>();

/** Asks the tab, through the docId's Studio page, and waits for its answer. */
async function ask(docId: string, request: FolderRequest): Promise<FolderReply> {
  const pages = await self.clients.matchAll({ type: "window" });
  // Only a page inside the tab can ask it; one opened on its own has nobody to answer.
  const page = pages.find(
    (client) =>
      client.frameType === "nested" && new URL(client.url).pathname === `${scope}${docId}/`,
  );
  if (!page) return { status: 503 };
  const channel = new MessageChannel();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: 504 }), ANSWER_MS);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data as FolderReply);
    };
    page.postMessage({ type: "promptwise:folder", request }, [channel.port2]);
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
    });
    // A folder that failed to open (the tab wasn't there yet) is tried again on the next request.
    opened.catch(() => projects.delete(docId));
    projects.set(docId, opened);
  }
  return opened;
}

self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const docId = url.origin === location.origin ? API.exec(url.pathname)?.[1] : undefined;
  if (!docId) return;
  event.respondWith(
    project(docId).then(
      (backend) => backend.fetch(event.request),
      (err: unknown) =>
        new Response(`Studio couldn't open this tab's files: ${String(err)}`, { status: 502 }),
    ),
  );
});
