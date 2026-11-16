// Builds Studio for promptwise into dist/: Studio's page with a relative base (served at `<scope><docId>/`), its API
// as a Service Worker (sw.js) and the page's loader (boot.js), and the runtime the preview loads. Needs the fork
// built first (`bun run build`), for Studio's Vite build and the core runtime.
//   node build.mjs   then   tar -czf studio-web.tgz -C dist .
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const shim = (f) => fileURLToPath(new URL(`./shims/${f}`, import.meta.url));
const mod = (m) => fileURLToPath(new URL(`./node_modules/${m}`, import.meta.url));
const alias = {
  fs: shim("fs.js"),
  "node:fs": shim("fs.js"),
  "fs/promises": shim("fs-promises.js"),
  "node:fs/promises": shim("fs-promises.js"),
  path: mod("path-browserify"),
  "node:path": mod("path-browserify"),
  os: shim("os.js"),
  "node:os": shim("os.js"),
  crypto: shim("crypto.js"),
  "node:crypto": shim("crypto.js"),
  child_process: shim("child_process.js"),
  "node:child_process": shim("child_process.js"),
  url: shim("url.js"),
  "node:url": shim("url.js"),
  module: shim("module.js"),
  "node:module": shim("module.js"),
  async_hooks: shim("async_hooks.js"),
  "node:async_hooks": shim("async_hooks.js"),
  buffer: mod("buffer"),
  "node:buffer": mod("buffer"),
  events: mod("events"),
  "node:events": mod("events"),
  stream: mod("readable-stream"),
  "node:stream": mod("readable-stream"),
  "stream/promises": shim("stream-promises.js"),
  "node:stream/promises": shim("stream-promises.js"),
  util: mod("util"),
  "node:util": mod("util"),
  process: mod("process/browser.js"),
  "node:process": mod("process/browser.js"),
  esbuild: shim("esbuild.js"),
  assert: shim("assert.js"),
  "node:assert": shim("assert.js"),
  tty: shim("os.js"),
  dns: shim("dns.js"),
  "node:dns": shim("dns.js"),
  "node:tty": shim("os.js"),
};
const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const dist = here("./dist");

execFileSync("npx", ["vite", "build", "--base", "./", "--outDir", dist, "--emptyOutDir"], {
  cwd: here("../packages/studio"),
  stdio: "inherit",
});
copyFileSync(here("../packages/core/dist/hyperframe.runtime.iife.js"), `${dist}/runtime.js`);

// The catalog Studio lists, as one file: the worker fetched each of ~240 item manifests from GitHub, 30-40 s before
// the panel showed anything. Built from this checkout's registry/, the one deploys come from.
const registry = JSON.parse(readFileSync(here("../registry/registry.json"), "utf8"));
const catalogDirs = { "hyperframes:block": "blocks", "hyperframes:component": "components" };
const catalog = registry.items
  .filter((entry) => entry.type in catalogDirs)
  .map((entry) =>
    JSON.parse(
      readFileSync(
        here(`../registry/${catalogDirs[entry.type]}/${entry.name}/registry-item.json`),
        "utf8",
      ),
    ),
  );
writeFileSync(`${dist}/catalog.json`, JSON.stringify(catalog));

// Studio's own entry is loaded by boot.js once the worker answers its API.
const page = readFileSync(`${dist}/index.html`, "utf8");
const entry = /<script type="module" crossorigin src="(\.\/assets\/[^"]+\.js)"><\/script>/.exec(
  page,
);
if (!entry) throw new Error("no module entry in Studio's index.html");
// The entry is preloaded, so it downloads while boot.js starts the worker rather than after. Until Studio renders
// over it, #root shows that it's loading instead of an empty panel.
const LOADER = `<div style="display:flex;height:100vh;align-items:center;justify-content:center;gap:10px;font:13px Inter,system-ui,sans-serif;color:#8a8a8a"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.8s" repeatCount="indefinite"/></path></svg>Loading Studio…</div>`;
const root = '<div data-hf-id="hf-aph5" id="root"></div>';
if (!page.includes(root)) throw new Error("no #root in Studio's index.html");
writeFileSync(
  `${dist}/index.html`,
  page
    .replace(
      entry[0],
      `<link rel="modulepreload" href="${entry[1]}" />\n    <script type="module" src="./boot.js"></script>`,
    )
    .replace(root, root.replace("></div>", `>${LOADER}</div>`)),
);

// `add` reports to the CLI's telemetry and colors its terminal output, which pull in the render engine: neither
// means anything in the browser.
const noTelemetry = {
  name: "no-telemetry",
  setup: (b) => {
    b.onResolve({ filter: /telemetry\/events\.js$/ }, () => ({
      path: shim("telemetry-events.js"),
    }));
    b.onResolve({ filter: /ui\/colors\.js$/ }, () => ({ path: shim("colors.js") }));
  },
};
const common = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  alias,
  logLevel: "error",
  color: false,
  metafile: true,
  conditions: ["import"],
  mainFields: ["browser", "module", "main"],
  plugins: [noTelemetry],
};
const worker = await build({
  ...common,
  entryPoints: [here("./src/sw.ts")],
  format: "iife",
  minify: true,
  outfile: `${dist}/sw.js`,
  define: {
    "process.env.NODE_ENV": '"production"',
    STUDIO_BUILD: JSON.stringify(new Date().toISOString()),
  },
});
await build({
  ...common,
  entryPoints: [here("./src/boot.ts")],
  format: "esm",
  outfile: `${dist}/boot.js`,
  define: { STUDIO_MAIN: JSON.stringify(entry[1]) },
});

const bytes = Object.values(worker.metafile.outputs)[0].bytes;
console.log(
  `built ${dist}: ${readdirSync(dist).length} entries, sw.js ${(bytes / 1e6).toFixed(2)} MB`,
);
