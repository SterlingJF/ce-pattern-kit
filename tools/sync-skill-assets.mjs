#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  readmePath,
  renderRules,
  rulesDrift,
  rulesPath,
} from "./render-rules.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const skill = join(root, "skills", "install-ce-pattern");
const pairs = [
  [
    join(root, "src", "scripts"),
    join(skill, "scripts"),
    (file) => /\.test\.ts$/.test(file),
  ],
  [join(root, "src", "assets"), join(skill, "assets"), () => false],
];

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(relative(directory, path).split(sep).join("/"));
    }
  };
  walk(directory);
  return files.sort();
}

export function drift() {
  const findings = [];
  const rules = rulesDrift();
  if (rules)
    findings.push(
      `rules document ${rules} from the README (src/assets/tools/ce-pattern/README_COMPONENT_SYSTEM.md)`,
    );
  for (const [from, to, excluded] of pairs) {
    const source = listFiles(from).filter((file) => !excluded(file));
    const copy = listFiles(to);
    for (const file of source) {
      if (!copy.includes(file))
        findings.push(`missing in skill: ${relative(root, join(to, file))}`);
      else if (
        !readFileSync(join(from, file)).equals(readFileSync(join(to, file)))
      ) {
        findings.push(`differs: ${relative(root, join(to, file))}`);
      }
    }
    for (const file of copy) {
      if (!source.includes(file))
        findings.push(`stale in skill: ${relative(root, join(to, file))}`);
    }
  }
  return findings;
}

export function sync() {
  writeFileSync(rulesPath, renderRules(readFileSync(readmePath, "utf8")));
  for (const [from, to, excluded] of pairs) {
    rmSync(to, { recursive: true, force: true });
    for (const file of listFiles(from)) {
      if (excluded(file)) continue;
      mkdirSync(dirname(join(to, file)), { recursive: true });
      cpSync(join(from, file), join(to, file));
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--check")) {
    const findings = drift();
    for (const finding of findings) console.error(finding);
    if (findings.length > 0) {
      console.error(
        "Run `just sync_skill_assets` to refresh the skill's bundled copy.",
      );
      process.exit(1);
    }
    console.log("skill assets match src");
  } else {
    sync();
    console.log("skill assets synced from src");
  }
}
