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
  change. While Studio listens, the worker asks for changes every 5 seconds and sends them as Studio's own
  `file-change` events. Binary files are links to promptwise's copy; uploads, renders, thumbnails and the ffmpeg
  routes stay with promptwise.
- `shims/` stand in for Node's built-ins (`node:fs` is memfs).

Build (after `bun run build` at the root): `npm install && node build.mjs`, then `tar -czf studio-web.tgz -C dist .`
for the release. Test: `npm test`.
