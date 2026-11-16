// Studio's own API (the fork's createStudioApi), run in the browser over an in-memory folder: no Node server, no sandbox.
import "./shims/globals.js";
import { vol } from "./shims/fs.js";
import { Hono } from "hono";
import { createStudioApi, PREVIEW_BUNDLE_OPTIONS } from "../../packages/studio-server/src/index.ts";
import { bundleToSingleHtml } from "../../packages/core/src/compiler/index.ts";
import { lintHyperframeHtml, lintProject } from "../../packages/core/src/lint/index.ts";

export const PROJECT_DIR = "/projects/main";

/** Fills the folder with the project's files (path to text) and returns Studio's API over it. */
export function createBackend(projectId: string, files: Record<string, string>) {
  vol.fromJSON(files, PROJECT_DIR);
  const project = { id: projectId, dir: PROJECT_DIR };
  const adapter = {
    listProjects: () => [project],
    resolveProject: (id: string) => (id === projectId ? project : null),
    async bundle(dir: string, options: object) {
      const html = await bundleToSingleHtml(dir, { ...PREVIEW_BUNDLE_OPTIONS, ...options });
      return html.replace(
        'data-hyperframes-preview-runtime="1" src=""',
        'data-hyperframes-preview-runtime="1" src="/api/runtime.js"',
      );
    },
    lint: (html: string, opts?: object) => lintHyperframeHtml(html, { ...opts, host: "studio" }),
    lintProject: (dir: string) => lintProject(dir, undefined, { host: "studio" }),
    runtimeUrl: "/api/runtime.js",
    rendersDir: () => "/renders",
    startRender: () => {
      throw new Error("render runs on the server");
    },
  };
  // Mounted under /api, as the CLI and the dev server mount it.
  const api = new Hono().route("/api", createStudioApi(adapter as never));
  // The spike shows what broke instead of a bare 500.
  api.onError((err, c) => c.text(String((err as Error).stack ?? err), 500));
  return { api, vol };
}
