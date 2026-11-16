// Puts dist/ on Vercel as a static site, at /studio/ of the `bebraai-studio` project (team triangleint): Studio's own
// origin, apart from promptwise's. vercel.json rewrites /studio/<docId>/... to /studio/... and keeps sw.js uncached.
// Build first (`node build.mjs`); needs the Vercel CLI signed in to the team.
//   node deploy.mjs
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const site = here("./.deploy");
if (!existsSync(here("./dist/sw.js"))) throw new Error("no dist/: run node build.mjs first");

rmSync(site, { recursive: true, force: true });
mkdirSync(site);
cpSync(here("./dist"), `${site}/studio`, { recursive: true });
cpSync(here("./vercel.json"), `${site}/vercel.json`);
const vercel = (...args) =>
  execFileSync("vercel", [...args, "--scope", "triangleint", "--yes"], {
    cwd: site,
    stdio: "inherit",
  });
vercel("link", "--project", "bebraai-studio");
vercel("deploy", "--prod");
