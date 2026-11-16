// Studio's page in promptwise. Starts the Service Worker that answers Studio's API (sw.ts), passes the folder
// requests it makes to the tab that holds this page, then loads Studio. Served as `<scope><docId>/boot.js`.
// Where the worker can't start (Brave's Shields, Firefox blocking every cross-site cookie, a private window), the
// page tells the tab, which opens Studio the old way, in the sandbox.

/** Studio's entry, set by build.mjs. */
declare const STUDIO_MAIN: string;

/** How long the worker has to take the page before Studio gives up on it. */
const START_MS = 15_000;

const scope = new URL("../", import.meta.url);

async function startWorker(workers: ServiceWorkerContainer | undefined): Promise<void> {
  if (!workers) throw new Error("no Service Workers here");
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
}

const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error("the Service Worker didn't start")), START_MS),
);
try {
  await Promise.race([startWorker(navigator.serviceWorker), timeout]);
} catch (err) {
  window.parent.postMessage({ type: "promptwise:studio-unavailable", reason: String(err) }, "*");
  document.body.textContent = "Studio can't start in this browser.";
  throw err;
}
await import(new URL(STUDIO_MAIN, import.meta.url).href);
