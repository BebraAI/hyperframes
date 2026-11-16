import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Node's fs is the in-memory one here too, as in the browser build.
const shim = (file: string) => fileURLToPath(new URL(`./shims/${file}`, import.meta.url));
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  resolve: {
    alias: {
      "node:fs/promises": shim("fs-promises.js"),
      "fs/promises": shim("fs-promises.js"),
      "node:fs": shim("fs.js"),
      fs: shim("fs.js"),
    },
  },
});
