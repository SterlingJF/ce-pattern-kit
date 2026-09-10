#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export const readmePath = `${root}README.md`;
export const rulesPath = `${root}src/assets/tools/ce-pattern/README_COMPONENT_SYSTEM.md`;
const start = "## The Three Layers";
const end = "## Repository Map";

export function renderRules(readme) {
  const from = readme.indexOf(`\n${start}`);
  const to = readme.indexOf(`\n${end}`);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`README must contain "${start}" followed by "${end}"`);
  }
  const body = readme.slice(from + 1, to).replace(/\s+$/, "");
  return `# The CE Pattern\n\nVendored from the SterlingJF/ce-pattern-kit README; edit it there.\n\n${body}\n`;
}

export function rulesDrift() {
  const expected = renderRules(readFileSync(readmePath, "utf8"));
  let current = "";
  try {
    current = readFileSync(rulesPath, "utf8");
  } catch {
    return "missing";
  }
  return current === expected ? null : "differs";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--check")) {
    const state = rulesDrift();
    if (state) {
      console.error(
        `README_COMPONENT_SYSTEM.md ${state} from the README rules; run \`just sync_skill_assets\`.`,
      );
      process.exit(1);
    }
    console.log("rules document matches the README");
  } else {
    writeFileSync(rulesPath, renderRules(readFileSync(readmePath, "utf8")));
    console.log("rules document rendered from the README");
  }
}
