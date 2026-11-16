// Studio's page in promptwise. Starts the Service Worker that answers Studio's API (sw.ts), passes the folder
// requests it makes to the tab that holds this page, then loads Studio. Served as `<scope><docId>/boot.js`.

/** Studio's entry, set by build.mjs. */
declare const STUDIO_MAIN: string;

const scope = new URL("../", import.meta.url);
const workers = navigator.serviceWorker;
// The request carries no session; the tab answers on the port it brings. The tab's origin isn't known here.
workers.onmessage = (event) => {
  if (event.data?.type === "promptwise:folder")
    window.parent.postMessage(event.data, "*", [...event.ports]);
};
await workers.register(new URL("sw.js", scope), { scope: scope.pathname });
await workers.ready;
if (!workers.controller)
  await new Promise((resolve) =>
    workers.addEventListener("controllerchange", resolve, { once: true }),
  );
await import(new URL(STUDIO_MAIN, import.meta.url).href);
