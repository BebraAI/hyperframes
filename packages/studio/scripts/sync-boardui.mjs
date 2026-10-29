#!/usr/bin/env node
// Copies promptwise's BoardUI components into src/boardui, the only place Studio's UI comes from.
// Usage: node packages/studio/scripts/sync-boardui.mjs <path to a bebraai checkout>
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(process.argv[2] ?? "", "apps/web");
if (!existsSync(join(web, "components/base"))) {
  console.error("usage: sync-boardui.mjs <bebraai checkout>");
  process.exit(1);
}
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../src/boardui");

const COMPONENTS = [
  "badges",
  "buttons",
  "checkbox",
  "divider",
  "dropdown",
  "empty-state",
  "input",
  "kbd",
  "menu",
  "modal",
  "popover",
  "radio",
  "segmented-control",
  "select",
  "slider",
  "switch",
  "tabs",
  "textarea",
  "toast",
  "tooltip",
];
const FILES = [
  ...COMPONENTS.map((name) => `components/base/${name}`),
  "components/foundations/direction",
  "components/foundations/icons",
  "components/icons.tsx",
  "utils/cx.ts",
  "utils/directional-icon.ts",
  "utils/use-dismiss-on-outside-press.ts",
  "styles/theme.css",
  "styles/typography.css",
];

rmSync(out, { recursive: true, force: true });
for (const path of FILES) cpSync(join(web, path), join(out, path), { recursive: true });

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

for (const file of files(out).filter((f) => /\.tsx?$/.test(f))) {
  const source = readFileSync(file, "utf8")
    .replace(/from "next\/link"/g, 'from "@/next-link"')
    .replace(/from "@\/([^"]+)"/g, (_, target) => {
      const rel = relative(dirname(file), join(out, target));
      return `from "${rel.startsWith(".") ? rel : `./${rel}`}"`;
    });
  writeFileSync(file, source);
}
// Studio clears Tailwind's palette and reuses some ramp names for its own tokens, so BoardUI's ramps move to
// --bui-* (filled from Tailwind's defaults, as BoardUI expects), and its dark mode follows Studio's data-theme.
const RAMP =
  /--color-((?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+)/g;
const tailwind = new Map(
  [
    ...readFileSync(resolve(web, "../../node_modules/tailwindcss/theme.css"), "utf8").matchAll(
      /--color-([a-z]+-\d+):\s*([^;]+);/g,
    ),
  ].map((m) => [m[1], m[2]]),
);
const themePath = join(out, "styles/theme.css");
const theme = readFileSync(themePath, "utf8")
  .replace(RAMP, "--bui-$1")
  .replace(/^\.dark\b/gm, ':root:not([data-theme="paper"])');
const defined = new Set([...theme.matchAll(/(--bui-[a-z]+-\d+):/g)].map((m) => m[1]));
const missing = [...new Set([...theme.matchAll(/var\((--bui-([a-z]+-\d+))\)/g)].map((m) => m[2]))]
  .filter((name) => !defined.has(`--bui-${name}`))
  .sort();
writeFileSync(
  themePath,
  `${theme}\n:root {\n${missing.map((name) => `  --bui-${name}: ${tailwind.get(name)};`).join("\n")}\n}\n`,
);

// Studio has no Next router, so BoardUI's links are plain anchors.
writeFileSync(
  join(out, "next-link.tsx"),
  'import type { ComponentProps } from "react";\n\nexport default function Link(props: ComponentProps<"a">) {\n  return <a {...props} />;\n}\n',
);
console.log(`boardui: synced ${FILES.length} paths from ${web}`);
