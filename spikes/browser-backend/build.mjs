import { build } from "esbuild";
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
  "node:tty": shim("os.js"),
};
const result = await build({
  entryPoints: [fileURLToPath(new URL("./backend.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: fileURLToPath(new URL("./dist/backend.js", import.meta.url)),
  alias,
  logLevel: "error",
  metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
  conditions: ["import"],
  mainFields: ["browser", "module", "main"],
});
const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(
  `built ${(bytes / 1e6).toFixed(2)} MB, ${Object.keys(result.metafile.inputs).length} modules`,
);
