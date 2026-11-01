#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { renderTokens } from "../assets/presets/react-shadcn/generate-tokens.mjs";
import {
  Plan,
  appendJustfileSection,
  presetBanner,
  assetsDir,
  editJson,
  main,
  managerCommands,
  parseArguments,
  readConfig,
  readJson,
  render,
  report,
  workspaceRun,
  writeJson,
} from "./lib.mjs";

const declaration = /--([\w-]+)\s*:\s*([^;]+);/g;

function declarations(css, selector) {
  const escaped = selector.replace(/[.]/g, "\\.");
  const block = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(
    css,
  );
  return new Map(
    block
      ? [...block[1].matchAll(declaration)].map((m) => [m[1], m[2].trim()])
      : [],
  );
}

export function tokensFromCss(css) {
  const light = declarations(css, ":root");
  const dark = declarations(css, ".dark");
  const primitives = {};
  const roles = {};
  const others = [];
  for (const [role, value] of light) {
    if (!dark.has(role)) {
      others.push(role);
      continue;
    }
    if (value === dark.get(role)) {
      primitives[role] = value;
      roles[role] = { light: `{${role}}`, dark: `{${role}}` };
    } else {
      primitives[`${role}-light`] = value;
      primitives[`${role}-dark`] = dark.get(role);
      roles[role] = { light: `{${role}-light}`, dark: `{${role}-dark}` };
    }
  }
  return { map: { colors: { primitives, roles } }, others };
}

export function addStyling(argv) {
  const options = parseArguments(argv, {
    values: { dir: null, alias: null },
  });
  const { path: configFile, config } = readConfig(options.root);
  const dir = options.dir ?? config.library?.dir ?? "components";
  const libraryDir = join(options.root, dir);
  const manifestPath = join(libraryDir, "components.json");
  if (!existsSync(manifestPath))
    throw new Error(
      `${dir}/components.json not found: add-styling needs a shadcn library. Pass --dir for another directory.`,
    );
  const manifest = readJson(manifestPath);
  const packagePath = join(libraryDir, "package.json");
  const library = readJson(packagePath);
  const alias = options.alias ?? config.library?.alias ?? library.name;
  if (!alias) throw new Error(`${dir}/package.json has no name; pass --alias`);
  const cssName = manifest.tailwind?.css ?? "styles.css";
  const cssPath = join(libraryDir, cssName);
  const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";
  const { map, others } = tokensFromCss(css);
  const preset = join(assetsDir, "presets", "react-shadcn");
  const tokensSource =
    Object.keys(map.colors.roles).length > 0
      ? map
      : JSON.parse(readFileSync(join(preset, "tokens.json"), "utf8"));
  const manager = config.packageManager ?? "npm";
  const tokens = {
    ALIAS: alias,
    STYLE: manifest.style ?? "base-vega",
    LIBRARY_DIR: dir,
    RUN: managerCommands(manager).run,
  };
  const plan = new Plan(options.root);
  plan.add(
    join(libraryDir, ".oxlintrc.json"),
    render(readFileSync(join(preset, ".oxlintrc.json"), "utf8"), tokens),
  );
  plan.add(
    join(libraryDir, "tokens.json"),
    `${JSON.stringify(tokensSource, null, 2)}\n`,
  );
  plan.add(
    join(libraryDir, "generated", "tokens.css"),
    renderTokens(tokensSource, "tokens.json"),
  );
  for (const file of ["check-shadcn-core.mjs", "generate-tokens.mjs"])
    plan.add(
      join(options.root, config.tooling, file),
      readFileSync(join(preset, file), "utf8"),
    );
  const importer = join(options.root, config.tooling, "add-shadcn-items.mjs");
  if (!existsSync(importer))
    plan.add(
      importer,
      readFileSync(join(preset, "add-shadcn-items.mjs"), "utf8"),
    );
  plan.refuseCollisions();
  if (library.scripts?.lint)
    throw new Error(
      `${dir}/package.json already has a lint script ("${library.scripts.lint}"). Rename it, or run "oxlint --deny-warnings ." from it, then rerun.`,
    );
  const written = plan.commit();
  const pins = readJson(join(preset, "package.json")).devDependencies;
  editJson(packagePath, (pkg) => {
    pkg.scripts ??= {};
    pkg.scripts.lint = "oxlint --deny-warnings .";
    pkg.devDependencies ??= {};
    for (const name of ["@shadcn/lint", "oxlint"])
      pkg.devDependencies[name] ??= pins[name];
  });
  written.push(`${dir}/package.json`);
  const libraryEntry = { dir, alias };
  editJson(join(options.root, "package.json"), (pkg) => {
    pkg.scripts ??= {};
    pkg.scripts["add:shadcn"] ??= `node ${config.tooling}/add-shadcn-items.mjs`;
    pkg.scripts["check:shadcn-core"] =
      `node ${config.tooling}/check-shadcn-core.mjs`;
    pkg.scripts["generate:tokens"] =
      `node ${config.tooling}/generate-tokens.mjs`;
    pkg.scripts["check:tokens"] =
      `node ${config.tooling}/generate-tokens.mjs --check`;
    pkg.scripts["lint:components"] = workspaceRun(
      manager,
      libraryEntry,
      "lint",
    );
  });
  written.push("package.json");
  const fragment = render(
    readFileSync(join(preset, "justfile.ce"), "utf8"),
    tokens,
  );
  const justfile = appendJustfileSection(
    options.root,
    `${presetBanner("react-shadcn")}\n${fragment}`,
    presetBanner("react-shadcn"),
  );
  written.push(`justfile (${justfile})`);
  config.library ??= {
    dir,
    alias,
    preset: "react-shadcn",
    style: manifest.style ?? null,
  };
  writeJson(configFile, config);
  const notes = [];
  const kept = Object.keys(map.colors.roles);
  if (kept.length > 0)
    notes.push(
      `${cssName} still declares ${kept.map((role) => `--${role}`).join(", ")}: replace those declarations, and any --color-* mapping for them, with @import "./generated/tokens.css";`,
    );
  else
    notes.push(
      `${cssName} declared no :root and .dark roles, so tokens.json starts from the kit's neutral palette; import ./generated/tokens.css from it.`,
    );
  for (const name of others)
    notes.push(
      `--${name} is not a colour role (no .dark value); keep it in ${cssName}, or add it to tokens.json under a theme namespace.`,
    );
  return { written, notes };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(() => {
    const { written, notes } = addStyling(process.argv.slice(2));
    report(written);
    for (const note of notes) console.log(`next: ${note}`);
  });
}
