import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { BLOCK_CATEGORIES, resolveBlockCategory } from "../packages/core/src/registry/types.ts";
import {
  CATEGORIES,
  catalogAll,
  catalogMenu,
  categoryOf,
  loadPromptwiseCatalog,
  visibleCatalog,
} from "./promptwise-catalog.mjs";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** A registry with a block `a` and components `b` and `c`, and the given promptwise.json. */
function fixture(promptwise) {
  const root = mkdtempSync(join(tmpdir(), "promptwise-catalog-"));
  const items = [
    {
      name: "a",
      description: "A block. It closes.",
      type: "hyperframes:block",
      dir: "blocks",
      dimensions: { width: 1080, height: 1920 },
      duration: 4.5,
    },
    {
      name: "b",
      description: "A component.",
      type: "hyperframes:component",
      dir: "components",
      variables: [{ id: "accent" }],
    },
    {
      name: "c",
      description: "Another.",
      type: "hyperframes:component",
      dir: "components",
      jobs: ["prove"],
      tags: ["deterministic", "bars", "prove", "proof"],
    },
  ];
  mkdirSync(join(root, "registry"));
  writeFileSync(
    join(root, "registry", "registry.json"),
    JSON.stringify({ items: items.map(({ name, type }) => ({ name, type })) }),
  );
  for (const { dir, ...item } of items) {
    mkdirSync(join(root, "registry", dir, item.name), { recursive: true });
    writeFileSync(
      join(root, "registry", dir, item.name, "registry-item.json"),
      JSON.stringify(item),
    );
  }
  if (promptwise)
    writeFileSync(join(root, "registry", "promptwise.json"), JSON.stringify(promptwise));
  return root;
}

test("this repository's promptwise.json names real items", () => {
  const { hidden, use } = loadPromptwiseCatalog(REPO);
  assert.ok(use.size > 0);
  const listed = new Set(visibleCatalog(REPO).map((item) => item.name));
  for (const name of hidden) assert.ok(!listed.has(name), name);
  for (const name of use.keys()) assert.match(catalogMenu(REPO), new RegExp(`\`${name}\``));
});

test("the catalog leaves out hidden items and keeps the rest in the registry's order", () => {
  const root = fixture({ hidden: ["b"], use: {} });
  assert.deepEqual(
    visibleCatalog(root).map((item) => item.name),
    ["a", "c"],
  );
});

test("without promptwise.json nothing is hidden or offered", () => {
  const root = fixture();
  assert.equal(visibleCatalog(root).length, 3);
  assert.doesNotMatch(catalogMenu(root), /^- `/m);
  const all = catalogAll(root);
  assert.match(all, /## Scenes\n\n- `a` \(block, 1080x1920, 4.5s\): A block\.\n/);
  assert.match(
    all,
    /- `b` \(component\): A component\.\n- `c` \(component\): Another\. \[jobs: prove; tags: bars, proof\]\n/,
  );
});

test("the menu gives each offered item its shape and note, in the file's order", () => {
  const root = fixture({ use: { b: "For accents.", a: "As an outro." } });
  const first = catalogMenu(root).split("## Reach for these first\n")[1].split("\n## ")[0];
  const offers = first.split("\n").filter((line) => line.startsWith("- `"));
  assert.deepEqual(offers, [
    "- `b` (component, variables: accent): For accents.",
    "- `a` (block, 1080x1920, 4.5s): As an outro.",
  ]);
});

test("every mistake in promptwise.json is reported at once", () => {
  const root = fixture({ hidden: ["a", "nope"], use: { a: "x", ghost: "y", c: " " } });
  assert.throws(
    () => loadPromptwiseCatalog(root),
    (error) =>
      error.message.includes('hidden: no block or component "nope"') &&
      error.message.includes('use: "a" is also hidden') &&
      error.message.includes('use: no block or component "ghost"') &&
      error.message.includes('use: "c" says nothing'),
  );
});

test("the menu holds only the offered items; the rest holds every other visible one, by tab", () => {
  const root = fixture({ hidden: ["c"], use: { b: "For accents." } });
  const menu = catalogMenu(root);
  assert.match(menu, /## Reach for these first\n\n- `b` [^\n]*\n$/);
  assert.match(menu, /`catalog-all\.md`/);
  assert.doesNotMatch(menu, /`a`|`c`/);
  const all = catalogAll(root);
  assert.match(all, /## Scenes\n\n- `a` \(block, 1080x1920, 4.5s\): A block\.\n$/);
  assert.doesNotMatch(all, /`b`|`c`/);
});

test("the menu's tabs are Studio's: same order, same tag rule", () => {
  assert.deepEqual(
    CATEGORIES,
    BLOCK_CATEGORIES.map((c) => [c.id, c.label]),
  );
  const { items } = loadPromptwiseCatalog(REPO);
  for (const item of items.values())
    assert.equal(categoryOf(item.tags), resolveBlockCategory(item.tags), item.name);
  assert.equal(categoryOf(undefined), resolveBlockCategory(undefined));
});
