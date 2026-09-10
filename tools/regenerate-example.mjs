#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scripts = fileURLToPath(new URL("../src/scripts/", import.meta.url));
export const exampleDir = fileURLToPath(
  new URL("../examples/react-shadcn/", import.meta.url),
);

export const steps = [
  [
    "install.mjs",
    "--name",
    "react-shadcn-example",
    "--package-manager",
    "pnpm",
  ],
  [
    "scaffold-library.mjs",
    "--preset",
    "react-shadcn",
    "--dir",
    "components",
    "--alias",
    "@acme/components",
    "--style",
    "base-vega",
  ],
  [
    "add-consumer.mjs",
    "--dir",
    "app",
    "--layers",
    "all",
    "--create",
    "--alias",
    "@acme/app",
  ],
  ["write-upstream.mjs", "--ref", "example", "--commit", "example"],
];

export function generateExample(root) {
  mkdirSync(root, { recursive: true });
  for (const [script, ...args] of steps) {
    const result = spawnSync(
      "node",
      [join(scripts, script), "--root", root, ...args],
      { encoding: "utf8" },
    );
    if (result.status !== 0)
      throw new Error(`${script} failed:\n${result.stderr}`);
  }
}

export function listGenerated(root) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (entry.name === "node_modules") continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(relative(root, path).split(sep).join("/"));
    }
  };
  walk(root);
  return files;
}

export const isLayerFile = (file) =>
  /(^|\/)component-(core|elements|patterns)\//.test(file);

export const isUserOwned = (file) =>
  isLayerFile(file) || file === "components/index.ts";

export function regenerate() {
  const scratch = mkdtempSync(join(tmpdir(), "ce-pattern-example-"));
  generateExample(scratch);
  const generated = listGenerated(scratch);
  if (existsSync(exampleDir)) {
    for (const file of listGenerated(exampleDir)) {
      if (!generated.includes(file) && !isUserOwned(file))
        rmSync(join(exampleDir, file));
    }
  }
  for (const file of generated) {
    const target = join(exampleDir, file);
    if (isUserOwned(file) && existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(scratch, file), target);
  }
  rmSync(scratch, { recursive: true, force: true });
  return generated;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  for (const file of regenerate())
    console.log(`wrote examples/react-shadcn/${file}`);
}
