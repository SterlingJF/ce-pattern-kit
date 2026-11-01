#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  Plan,
  jsonFile,
  addWorkspacePackage,
  appendJustfileSection,
  presetBanner,
  assetsDir,
  editJson,
  isDirectory,
  main,
  managerCommands,
  parseArguments,
  readConfig,
  render,
  report,
  setCheckerScript,
  workspaceRun,
  writeJson,
} from "./lib.mjs";
import { renderTokens } from "../assets/presets/react-shadcn/generate-tokens.mjs";

const presets = ["react-shadcn", "none"];

export function scaffoldLibrary(argv) {
  const options = parseArguments(argv, {
    values: {
      preset: "react-shadcn",
      dir: "components",
      alias: null,
      style: "base-vega",
    },
    required: ["alias"],
  });
  if (!presets.includes(options.preset)) {
    throw new Error(`--preset must be one of ${presets.join(", ")}`);
  }
  const { path: configFile, config } = readConfig(options.root);
  if (config.library)
    throw new Error(
      `ce-pattern.json already records a library at ${config.library.dir}`,
    );
  const libraryDir = join(options.root, options.dir);
  if (isDirectory(libraryDir))
    throw new Error(
      `Refusing to overwrite ${options.dir}/. Use --dir for another destination or follow references/update.md.`,
    );
  const manager = config.packageManager ?? "npm";
  const tokens = {
    ALIAS: options.alias,
    STYLE: options.style,
    LIBRARY_DIR: options.dir,
    RUN: managerCommands(manager).run,
  };
  const plan = new Plan(options.root);
  let section = null;
  if (options.preset === "react-shadcn") {
    const preset = join(assetsDir, "presets", "react-shadcn");
    const tooling = [
      "add-shadcn-items.mjs",
      "check-copy.mjs",
      "check-shadcn-core.mjs",
      "generate-tokens.mjs",
    ];
    plan.addTree(preset, libraryDir, tokens, ["justfile.ce", ...tooling]);
    plan.add(
      join(libraryDir, "generated", "tokens.css"),
      renderTokens(
        JSON.parse(readFileSync(join(preset, "tokens.json"), "utf8")),
        "tokens.json",
      ),
    );
    for (const file of tooling) {
      plan.add(
        join(options.root, config.tooling, file),
        readFileSync(join(preset, file), "utf8"),
      );
    }
    section = `${presetBanner(options.preset)}\n${render(readFileSync(join(preset, "justfile.ce"), "utf8"), tokens)}`;
  } else {
    plan.add(
      join(libraryDir, "package.json"),
      jsonFile({
        name: options.alias,
        version: "0.1.0",
        private: true,
        type: "module",
        exports: { ".": "./index.ts" },
      }),
    );
    plan.add(join(libraryDir, "index.ts"), "export {};\n");
    plan.add(
      join(libraryDir, "README.md"),
      `# ${options.alias}\n\nShared component library on the CE pattern. The rules live in \`${config.tooling}/README_COMPONENT_SYSTEM.md\`.\n`,
    );
  }
  plan.refuseCollisions();
  const written = plan.commit();
  if (section) {
    const justfile = appendJustfileSection(
      options.root,
      section,
      presetBanner(options.preset),
    );
    written.push(`justfile (${justfile})`);
  }
  const workspaceFile = addWorkspacePackage(options.root, options.dir, manager);
  if (workspaceFile) written.push(workspaceFile);
  if (options.preset === "react-shadcn") {
    editJson(join(options.root, "package.json"), (pkg) => {
      pkg.scripts ??= {};
      pkg.scripts["add:shadcn"] = `node ${config.tooling}/add-shadcn-items.mjs`;
      pkg.scripts["check:shadcn-core"] =
        `node ${config.tooling}/check-shadcn-core.mjs`;
      pkg.scripts["generate:tokens"] =
        `node ${config.tooling}/generate-tokens.mjs`;
      pkg.scripts["check:tokens"] =
        `node ${config.tooling}/generate-tokens.mjs --check`;
      pkg.scripts["lint:components"] = workspaceRun(manager, options, "lint");
      pkg.scripts["check:copy"] = `node ${config.tooling}/check-copy.mjs`;
    });
  }
  config.library = {
    dir: options.dir,
    alias: options.alias,
    preset: options.preset,
    style: options.preset === "react-shadcn" ? options.style : null,
  };
  if (options.preset === "react-shadcn")
    config.library.copy = { dir: "copy", base: "en" };
  writeJson(configFile, config);
  setCheckerScript(options.root, config);
  written.push("package.json");
  return written;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(() => report(scaffoldLibrary(process.argv.slice(2))));
}
