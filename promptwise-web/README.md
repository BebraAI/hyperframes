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
- The folder comes from the tab, never from promptwise directly (`folder.ts`): Studio and the compositions its
  preview runs hold no session. Serve it from an origin of its own.
- Studio's writes go back over the version they read (sha1); one that lost to a change made elsewhere takes that
  change. Every 5 seconds Studio's page asks the worker (`__pull`) to look for changes made elsewhere; the worker sends
  them to the page as Studio's own `file-change` events, by message. No request is held open on the worker: one that
  is keeps a new deploy from taking over, and Chrome stops it after five minutes, sending requests past the worker.
  `__pull` also says which build answers; when none does, the page reloads once, then the tab falls back to the
  sandbox. Binary files are links to promptwise's copy; uploads, renders, thumbnails and the ffmpeg
  routes stay with promptwise. The catalog comes from the fork's registry on GitHub, and an install writes into the
  folder (`packages/cli/src/server/studioCatalog.ts`, shared with the CLI).
- `shims/` stand in for Node's built-ins (`node:fs` is memfs).

Hosting: the Vercel project `bebraai-studio` (team triangleint), a static site with no Git link, at https://bebraai-studio.vercel.app/studio/: its own site (`vercel.app` is on the Public Suffix List), apart from promptwise's. `vercel.json` rewrites `/studio/<docId>/` to the page and its files to `/studio/`, keeps `sw.js`, `boot.js` and the page uncached, and lets only promptwise's origins (and localhost) frame it. Deploy with `node deploy.mjs` after a build. Today staging uses that production deployment; give staging its own environment before prod uses it.

Build (after `bun run build` at the root): `npm install && node build.mjs`, then `tar -czf studio-web.tgz -C dist .`
for the release. Test: `npm test`; in a browser: `node check.mjs dist <files.json>` (see the file).
