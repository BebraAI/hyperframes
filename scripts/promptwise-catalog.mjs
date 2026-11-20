// promptwise's say over the registry (registry/promptwise.json): which items Studio's catalog hides, and which ones
// the agent is offered first, with when and where to use each. promptwise-web/build.mjs filters the catalog it ships
// with it, and the CLI's build writes the agent's menu from it (dist/promptwise-catalog/catalog.md and catalog-all.md).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Where the rest of the catalog goes, beside the menu. */
export const ALL_FILE = "catalog-all.md";

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

/** One line on an item's shape: block or component, its size and length, and its variables if asked. */
function shape(item, withVariables = true) {
  const parts = [item.type === "hyperframes:block" ? "block" : "component"];
  if (item.dimensions) parts.push(`${item.dimensions.width}x${item.dimensions.height}`);
  if (item.duration) parts.push(`${Math.round(item.duration * 10) / 10}s`);
  const vars = withVariables ? (item.variables ?? []).map((v) => v.id) : [];
  if (vars.length) parts.push(`variables: ${vars.join(", ")}`);
  return parts.join(", ");
}

// Studio's catalog tabs, in its order, and the tag rule that puts an item in one: resolveBlockCategory and
// BLOCK_CATEGORIES in packages/core/src/registry/types.ts (this file runs before core is built; a test keeps them equal).
export const CATEGORIES = [
  ["captions", "Captions"],
  ["code-animation", "Code Animations"],
  ["vfx", "VFX"],
  ["transitions", "Transitions"],
  ["effects", "Effects"],
  ["text-effects", "Text Effects"],
  ["social", "Social"],
  ["data", "Data"],
  ["scenes", "Scenes"],
];

export function categoryOf(tags) {
  if (!tags || tags.length === 0) return "scenes";
  const set = new Set(tags);
  if (set.has("captions") || set.has("caption-style")) return "captions";
  if (set.has("code-animation")) return "code-animation";
  if (set.has("transition")) return "transitions";
  if (set.has("social") || set.has("overlay")) return "social";
  if (set.has("data") || set.has("chart") || set.has("map")) return "data";
  if (set.has("html-in-canvas") || set.has("webgl") || set.has("shader")) return "vfx";
  if (set.has("text-effect")) return "text-effects";
  if (set.has("effect") || set.has("grain") || set.has("vignette")) return "effects";
  return "scenes";
}

/** An item's description cut to its first sentence, at most about 120 characters. */
function brief(description) {
  const first = description.split(/(?<=[.!?])\s/)[0].trim();
  return first.length <= 120 ? first : `${first.slice(0, 117).replace(/\s+\S*$/, "")}...`;
}

/** The agent's menu (catalog.md): how to put an item in, then the items to reach for first with when to use each. */
export function catalogMenu(root) {
  const { use, items } = loadPromptwiseCatalog(root);
  const lines = [
    "# Ready-made catalog items",
    "",
    "The HyperFrames registry items to reach for first, each with when and where it fits. Each is ordinary source once",
    "installed: change it, cut it down, restyle it to the video's colours and fonts. When none of these fits, look in",
    `\`${ALL_FILE}\` next to this file: every other item the Timeline tab's catalog lists, by its tab.`,
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
  ];
  if (use.size) lines.push("", "## Reach for these first", "");
  for (const [name, note] of use) lines.push(`- \`${name}\` (${shape(items.get(name))}): ${note}`);
  return `${lines.join("\n")}\n`;
}

// Tags that say nothing about what an item is for: how it was built, or that it is one of many.
const PLAIN_TAGS = new Set([
  "deterministic",
  "motion-primitive",
  "video-primitive",
  "transition-primitive",
  "transitions-dev-port",
  "experiment",
  "showcase",
  "minimal",
  "youtube",
  "sfx",
]);

/**
 * What a search can find an item by beyond its words: the registry's `jobs` (its role in a video: demonstrate, reveal,
 * prove...) and its telling tags, so `grep -i 'prove\|chart'` finds an item whose description says neither.
 */
function keywords(item) {
  const jobs = Array.isArray(item.jobs) ? item.jobs : [];
  const tags = (item.tags ?? [])
    .filter((tag) => !PLAIN_TAGS.has(tag) && !jobs.includes(tag))
    .slice(0, 6);
  const parts = [];
  if (jobs.length) parts.push(`jobs: ${jobs.join(", ")}`);
  if (tags.length) parts.push(`tags: ${tags.join(", ")}`);
  return parts.length ? ` [${parts.join("; ")}]` : "";
}

/** The rest of the catalog (catalog-all.md): every item Studio lists that isn't offered first, by its catalog tab. */
export function catalogAll(root) {
  const { hidden, use, items } = loadPromptwiseCatalog(root);
  const lines = [
    "# The rest of the catalog",
    "",
    "Every other item the Timeline tab's catalog lists, by its tab, with the registry's own description and, in brackets,",
    "its jobs (its role in a video) and tags. Search it with grep (one item per line); don't read it whole. Install and",
    "mount one as catalog.md says. Items tagged webgl, webgpu or html-in-canvas can render blank here: check their",
    "frames, and say so if they do.",
  ];
  const rest = [...items.values()].filter((item) => !hidden.has(item.name) && !use.has(item.name));
  for (const [id, label] of CATEGORIES) {
    const inTab = rest.filter((item) => categoryOf(item.tags) === id);
    if (!inTab.length) continue;
    lines.push("", `## ${label}`, "");
    for (const item of inTab)
      lines.push(
        `- \`${item.name}\` (${shape(item, false)}): ${brief(item.description)}${keywords(item)}`,
      );
  }
  return `${lines.join("\n")}\n`;
}
