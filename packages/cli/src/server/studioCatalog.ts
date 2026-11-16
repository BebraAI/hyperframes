// Studio's catalog: what it lists and how it installs an item into a project. Shared by the CLI's Studio server and
// the browser one (promptwise-web), which run it over the same project folder (on disk, or in memory).
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { realpath } from "@hyperframes/core";
import { replaceFileAtomically } from "@hyperframes/core/atomic-file";

/** The blocks and components of the registry `add` installs from. */
export async function listStudioCatalog(projectDir: string) {
  const { listRegistryItems, loadAllItems } = await import("../registry/resolver.js");
  const { loadProjectConfig } = await import("../utils/projectConfig.js");
  // The same registry `add` installs from, so the panel lists what can be installed.
  const registry = { baseUrl: loadProjectConfig(projectDir).registry };
  const entries = await listRegistryItems(undefined, registry);
  const blockAndComponentEntries = entries.filter(
    (e) => e.type === "hyperframes:block" || e.type === "hyperframes:component",
  );
  return loadAllItems(blockAndComponentEntries, registry);
}

/** Installs one item as `add` does, sized to the project's composition; its own file comes first. */
export async function installStudioBlock(projectDir: string, blockName: string) {
  const { addToProject, primaryInstalledTarget } = await import("../commands/add.js");
  const { recordRewrittenInstall } = await import("../registry/installer.js");
  const { registryTargetPath } = await import("../registry/publication.js");
  const { result, item } = await addToProject({
    name: blockName,
    projectDir,
    skipClipboard: true,
    source: "studio",
  });
  for (const warning of result.warnings) console.warn(`hyperframes:registry ${warning}`);
  const written = result.written;

  rewriteWrittenToHostViewport(projectDir, written);
  recordRewrittenInstall(projectDir, written);

  // The item's own file first, as add recorded it, since Studio mounts the first .html it gets.
  const root = realpath(projectDir);
  const primary = primaryInstalledTarget(item);
  const primaryPath = registryTargetPath(root, primary);
  const others = written
    .filter((abs) => abs !== primaryPath)
    .map((abs) => relative(root, abs).split(sep).join("/"));
  return {
    written: written.includes(primaryPath) ? [primary, ...others] : others,
    block: item,
  };
}

// Rewrite the viewport meta + inline width/height in every written .html to the
// host composition's dimensions, so an installed fragment matches the host
// canvas. Applies to ALL written files — including any .html a dependency ships,
// not just the requested block's — which is intentional. No-op when the host
// index.html is absent or carries no dimensions.
function rewriteWrittenToHostViewport(projectDir: string, written: string[]): void {
  const indexPath = join(projectDir, "index.html");
  if (!existsSync(indexPath)) return;
  const indexHtml = readFileSync(indexPath, "utf-8");
  const hostW = indexHtml.match(/data-width="(\d+)"/)?.[1];
  const hostH = indexHtml.match(/data-height="(\d+)"/)?.[1];
  if (!hostW || !hostH) return;

  for (const absPath of written) {
    if (!absPath.endsWith(".html")) continue;
    let content = readFileSync(absPath, "utf-8");
    content = content.replace(
      /(<meta\s+name="viewport"\s+content="width=)\d+(,\s*height=)\d+/i,
      `$1${hostW}$2${hostH}`,
    );
    content = content.replace(
      /(\bwidth:\s*)\d+(px;\s*\n?\s*height:\s*)\d+(px;)/g,
      (match, pre, mid, post) => {
        if (match.includes("1920") || match.includes("1080")) {
          return `${pre}${hostW}${mid}${hostH}${post}`;
        }
        return match;
      },
    );
    replaceFileAtomically(absPath, content, statSync(absPath).mode);
  }
}
