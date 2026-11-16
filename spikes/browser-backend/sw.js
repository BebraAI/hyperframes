// Studio's API in a Service Worker: every /api/ request the Studio page makes is answered here, by the fork's own
// createStudioApi over the project's files in memory. Nothing else runs: no Node server, no sandbox.
import { createBackend } from "./backend.js";

let backend;
const ready = (async () => {
  const files = await (await fetch("/files.json")).json();
  backend = createBackend("demo", files);
})();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return;
  if (url.pathname === "/api/runtime.js") return event.respondWith(fetch("/runtime.js"));
  event.respondWith(ready.then(() => backend.api.fetch(event.request)));
});
