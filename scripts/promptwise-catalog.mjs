// promptwise's say over the registry (registry/promptwise.json): which items Studio's catalog hides, and which ones
// the agent is offered first, with when and where to use each. promptwise-web/build.mjs filters the catalog it ships
// with it, and the CLI's build writes the agent's menu (dist/promptwise-catalog.md) from it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TYPE_DIRS = { "hyperframes:block": "blocks", "hyperframes:component": "components" };

/** The registry's blocks and components by name, each with its registry-item.json. */
function registryItems(root) {
  const registry = JSON.parse(readFileSync(join(root, "registry", "registry.json"), "utf8"));
  const items = new Map();
  for (const entry of registry.items) {
    const dir = TYPE_DIRS[entry.type];
    if (!dir) continue;
    const file = join(root, "registry", dir, entry.name, "registry-item.json");
    items.set(entry.name, JSON.parse(readFileSync(file, "utf8")));
  }
  return items;
}

/**
 * registry/promptwise.json, checked: every name is a block or component of the registry, none is both hidden and
 * offered, and each offer says something. Throws with every problem at once, so one fix-up covers them.
 */
export function loadPromptwiseCatalog(root) {
  const path = join(root, "registry", "promptwise.json");
  const items = registryItems(root);
  if (!existsSync(path)) return { hidden: new Set(), use: new Map(), items };
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const hidden = new Set(raw.hidden ?? []);
  const use = new Map(Object.entries(raw.use ?? {}));
  const problems = [];
  for (const name of hidden)
    if (!items.has(name)) problems.push(`hidden: no block or component "${name}"`);
  for (const [name, note] of use) {
    if (!items.has(name)) problems.push(`use: no block or component "${name}"`);
    if (hidden.has(name)) problems.push(`use: "${name}" is also hidden`);
    if (typeof note !== "string" || !note.trim()) problems.push(`use: "${name}" says nothing`);
  }
  if (problems.length)
    throw new Error(`registry/promptwise.json:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  return { hidden, use, items };
}

/** The registry items Studio's catalog lists: every block and component that isn't hidden. */
export function visibleCatalog(root) {
  const { hidden, items } = loadPromptwiseCatalog(root);
  return [...items.values()].filter((item) => !hidden.has(item.name));
}

/** One line on an item's shape: block or component, its size and length, its variables. */
function shape(item) {
  const parts = [item.type === "hyperframes:block" ? "block" : "component"];
  if (item.dimensions) parts.push(`${item.dimensions.width}x${item.dimensions.height}`);
  if (item.duration) parts.push(`${Math.round(item.duration * 10) / 10}s`);
  const vars = (item.variables ?? []).map((v) => v.id);
  if (vars.length) parts.push(`variables: ${vars.join(", ")}`);
  return parts.join(", ");
}

/** The agent's menu: the offered items, in the file's order, with when to use each and how to put it in. */
export function catalogMenu(root) {
  const { use, items } = loadPromptwiseCatalog(root);
  const lines = [
    "# Ready-made catalog items",
    "",
    "These are the HyperFrames registry items to reach for first. Each is ordinary source once installed: change it,",
    "cut it down, restyle it to the video's colours and fonts.",
    "",
    "- Install in the project folder: `hyperframes add <name> --json` (needs the network). It prints the files it",
    "  wrote and a mount snippet.",
    "- A block installs to `compositions/<name>.html`: mount it in `index.html` with `data-composition-src`, the",
    "  block's own `data-composition-id`, `data-start`, `data-duration` and `data-track-index`, as the snippet shows.",
    "- A component installs to `compositions/components/<name>.html`: copy its markup, style and script into the",
    "  scene and follow its comment block.",
    "- Set an item's variables for one mount with `data-variable-values` on its host (`add --vars '{...}'` writes it).",
    "  Point its colour and font variables at the brand's.",
    "- A 16:9 block in a 9:16 video (or the other way) needs its layout checked: look with preview_timeline.",
    "- Then `hyperframes check`, and look at the frames.",
    "",
    "Anything else in the registry can be installed the same way when nothing here fits.",
    "",
  ];
  for (const [name, note] of use) {
    const item = items.get(name);
    lines.push(`- \`${name}\` (${shape(item)}): ${note}`);
  }
  return `${lines.join("\n")}\n`;
}
