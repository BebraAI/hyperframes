# promptwise-web

HyperFrames Studio for promptwise's Timeline tab, running whole in the browser: Studio's page, and Studio's own API
(`createStudioApi`, unchanged) in a Service Worker over the tab's folder in memory. No Node server, no sandbox.

```
promptwise tab ──postMessage──▶ Studio page (boot.ts) ──postMessage──▶ Service Worker (sw.ts)
   │  reads and writes the folder                                        │  Studio's API over memfs (backend.ts)
   ▼  through promptwise's studio/files                                  ▼  answers <scope><docId>/api/*
```

- The page is served at `<scope><docId>/` (the host rewrites `<scope><docId>/*` to `<scope>*`); the build has a
  relative base, so Studio finds its API at `<scope><docId>/api` (`STUDIO_API` in `packages/studio`).
  Its code loads from `<scope>assets/`, one URL for every tab, which the host caches for good: loaded beside the page,
  each new tab downloaded Studio's 4 MB again.
- The folder comes from the tab, never from promptwise directly (`folder.ts`): Studio and the compositions its
  preview runs hold no session. Serve it from an origin of its own.
- Studio's writes go back over the version they read (sha1), all of one save in one batch where the tab takes batches
  (its listing says `batch`), saved all or none. One that lost to a change made elsewhere takes that change; the
  history keeps the user's edit for Undo, and the page tells the tab (`promptwise:conflict`), which tells the user. The page asks the worker to open the folder as soon as the worker runs, while Studio's code (preloaded by
  `index.html`) downloads: one listing that carries the text files' text (`list` with `content`; a tab that leaves the
  text out gets a read per file). Until Studio renders, `#root` shows a loader. Every 5 seconds Studio's page asks the worker (`__pull`) to look for changes made elsewhere; the worker sends
  them to the page as Studio's own `file-change` events, by message. No request is held open on the worker: one that
  is keeps a new deploy from taking over, and Chrome stops it after five minutes, sending requests past the worker.
  `__pull` also says which build answers; when none does, the page reloads once, then the tab falls back to the
  sandbox. Binary files are links to promptwise's copy; renders and the ffmpeg routes stay with promptwise.
- Thumbnails aren't rendered here (no browser to render with): Studio asks for none on this backend
  (`serverRendersThumbnails`), so tiles keep their label and the preview shows without a poster.
- Studio's undo history (`openProjectHistory`) runs over the same memfs, under `/history/<docId>`: it lasts as long
  as the worker, and a change from elsewhere is recorded as an outside change. The catalog comes from the fork's registry on GitHub, and an install writes into the
  folder (`packages/cli/src/server/studioCatalog.ts`, shared with the CLI).
- `shims/` stand in for Node's built-ins (`node:fs` is memfs).

Hosting: the Vercel project `bebraai-studio` (team triangleint), a static site with no Git link, at https://bebraai-studio.vercel.app/studio/: its own site (`vercel.app` is on the Public Suffix List), apart from promptwise's. `vercel.json` rewrites `/studio/<docId>/` to the page and its files to `/studio/`, keeps `sw.js`, `boot.js` and the page uncached, and lets only promptwise's origins (and localhost) frame it. Deploy with `node deploy.mjs` after a build. Today staging uses that production deployment; give staging its own environment before prod uses it.

Build (after `bun run build` at the root): `npm install && node build.mjs`. A `promptwise-v*` release builds it in CI
with `PROMPTWISE_RELEASE` set and attaches `studio-web.tgz`; the page says that release to the tab
(`promptwise:studio-ready`), which checks it against `NEXT_PUBLIC_STUDIO_RELEASE`. The release then starts promptwise's
Bump sandbox pins workflow, which opens the PR that pins it in the sandbox image (`BEBRAAI_DISPATCH_TOKEN`). CI runs the tests and the build on
every PR. Test: `npm test`; in a browser: `node check.mjs dist <files.json>` (see the file).
