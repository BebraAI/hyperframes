// fallow-ignore-file complexity -- runs only in a browser (a page and its Service Worker); checked with check.mjs and on staging, not in vitest
// Studio's page in promptwise. Starts the Service Worker that answers Studio's API (sw.ts), passes the folder
// requests it makes to the tab that holds this page, then loads Studio. Served as `<scope><docId>/boot.js`.
// Where the worker can't start (Brave's Shields, Firefox blocking every cross-site cookie, a private window), the
// page tells the tab, which opens Studio the old way, in the sandbox.

/** Studio's entry, set by build.mjs. */
declare const STUDIO_MAIN: string;
/** The release this Studio is (promptwise-vN), set by build.mjs: the tab checks it against the one it expects. */
declare const STUDIO_RELEASE: string;

/** How long the worker has to take the page before Studio gives up on it. */
const START_MS = 15_000;
/** How often the page asks the worker to look for changes made elsewhere (the agent's sandbox). */
const PULL_MS = 5000;

const scope = new URL("../", import.meta.url);
const workers = navigator.serviceWorker;

async function startWorker(): Promise<void> {
  if (!workers) throw new Error("no Service Workers here");
  workers.onmessage = (event) => {
    const type = event.data?.type;
    // The request carries no session; the tab answers on the port it brings. The tab's origin isn't known here.
    if (type === "promptwise:folder") {
      // An upload's bytes move on to the tab, as they came from the worker: no copy here.
      const bytes = event.data.request?.bytes;
      const moved = bytes instanceof ArrayBuffer ? [bytes] : [];
      window.parent.postMessage(event.data, "*", [...event.ports, ...moved]);
    }
    // Studio's edit gave way to the agent's change meanwhile: the tab tells the user, who can bring it back with Undo.
    if (type === "promptwise:conflict") window.parent.postMessage(event.data, "*");
    if (type === "promptwise:studio-error") {
      console.warn(`[promptwise] ${event.data.path}: ${event.data.message}`);
      window.parent.postMessage(event.data, "*");
    }
    // Studio's own file-change events, which it takes from this page rather than a stream held open on the worker.
    if (type === "promptwise:file-change") window.postMessage(event.data, location.origin);
    // Where each file Studio added has got: Studio shows it on the clip.
    if (type === "promptwise:upload-state") window.postMessage(event.data, location.origin);
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
  await Promise.race([startWorker(), timeout]);
} catch (err) {
  window.parent.postMessage({ type: "promptwise:studio-unavailable", reason: String(err) }, "*");
  document.body.textContent = "Studio can't start in this browser.";
  throw err;
}
// The worker opens the tab's folder now, while Studio's code loads (index.html preloads it), not on Studio's first
// request once it has.
const pullUrl = new URL("./api/__pull", import.meta.url);
void fetch(pullUrl, { cache: "no-store" }).catch(() => {});
// Studio listens for changes by message here, not on /api/events.
(globalThis as { promptwiseWorkerFeed?: boolean }).promptwiseWorkerFeed = true;
await import(new URL(STUDIO_MAIN, import.meta.url).href);

// A newer deploy takes over between requests; look for one now rather than on the next navigation.
void workers
  .getRegistration(scope.pathname)
  .then((registration) => registration?.update())
  .catch(() => {});

// Ask the worker to look for changes every few seconds; its answer also says it still serves this page. When it
// doesn't (requests going past it to the host were seen on Chrome), a reload brings it back; when a reload a minute
// ago didn't, the tab opens Studio in the sandbox instead.
const RELOADED = "promptwise:reloaded";
let reported = false;
// The tab says when the agent has just saved the folder, so its edit shows now rather than on the next look.
window.addEventListener("message", (event) => {
  if (event.source !== window.parent || event.data?.type !== "promptwise:pull-now") return;
  void fetch(pullUrl, { cache: "no-store" }).catch(() => {});
});
// A hidden tab doesn't look every few seconds; it looks once when it's shown again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void fetch(pullUrl, { cache: "no-store" }).catch(() => {});
});
setInterval(async () => {
  if (document.hidden) return;
  const reply = await fetch(pullUrl, { cache: "no-store" }).catch(() => null);
  const build = reply?.headers.get("x-promptwise-worker");
  if (build) {
    if (!reported)
      window.parent.postMessage(
        { type: "promptwise:studio-ready", build, release: STUDIO_RELEASE },
        "*",
      );
    reported = true;
    return;
  }
  const last = Number(sessionStorage.getItem(RELOADED) ?? 0);
  if (Date.now() - last < 60_000) {
    const registration = await workers.getRegistration(scope.pathname);
    const state = (w: ServiceWorker | null | undefined) => w?.state ?? "none";
    const workersNow = `active ${state(registration?.active)}, waiting ${state(registration?.waiting)}, installing ${state(registration?.installing)}, controller ${workers.controller ? "yes" : "no"}`;
    const reason = `the worker stopped answering (pull ${reply?.status ?? "failed"}; ${workersNow})`;
    window.parent.postMessage({ type: "promptwise:studio-unavailable", reason }, "*");
    return;
  }
  sessionStorage.setItem(RELOADED, String(Date.now()));
  location.reload();
}, PULL_MS);
