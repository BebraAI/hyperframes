# Spike: Studio's backend in the browser

Studio's own API (`createStudioApi` from `packages/studio-server`, unchanged) bundled for the browser and run in a
Service Worker over the project's files in memory, so Studio's page needs no Node server and no sandbox.

- `backend.ts` builds the adapter over an in-memory folder; `shims/` stand in for the Node built-ins (`node:fs` is
  memfs, `child_process` refuses, `esbuild` keeps scripts as they are); `build.mjs` bundles it with esbuild.
- `sw.js` answers every `/api/` request of the Studio page; `start.html` registers it and opens the project.
- `probe.html` calls the routes directly and prints what each answers.

Run: `npm install` here, `node build.mjs`, copy `packages/cli/dist/studio` into a folder with `dist/backend.js`
(as `backend.js`), `sw.js`, `start.html`, `files.json` (path to text) and the core runtime (`runtime.js`), serve it,
and open `/start.html`.

What it showed (2026-11-16): projects, files, preview bundling, lint, signature, GSAP routes, selection and file
writes with Studio's own If-Match versions work in the browser; the UI loads, edits commit to the in-memory files.
Missing: thumbnails and renders (headless Chrome), ffmpeg routes, history, and `/api/events`, so the preview
doesn't redraw after an edit yet.
