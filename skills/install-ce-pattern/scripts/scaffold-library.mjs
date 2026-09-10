#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  Plan,
  jsonFile,
  addWorkspacePackage,
  appendJustfileSection,
  assetsDir,
  editJson,
  isDirectory,
  main,
  parseArguments,
  readConfig,
  render,
  report,
  setCheckerScript,
  writeJson,
} from "./lib.mjs";

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
  const tokens = {
    ALIAS: options.alias,
    STYLE: options.style,
    LIBRARY_DIR: options.dir,
  };
  const plan = new Plan(options.root);
  const sections = [
    readFileSync(join(assetsDir, "tools", "ce-pattern", "justfile.ce"), "utf8"),
  ];
  if (options.preset === "react-shadcn") {
    const preset = join(assetsDir, "presets", "react-shadcn");
    plan.addTree(preset, libraryDir, tokens, [
      "justfile.ce",
      "add-shadcn-items.mjs",
    ]);
    plan.add(
      join(options.root, config.tooling, "add-shadcn-items.mjs"),
      readFileSync(join(preset, "add-shadcn-items.mjs"), "utf8"),
    );
    sections.push(
      render(readFileSync(join(preset, "justfile.ce"), "utf8"), tokens),
    );
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
  const justfile = appendJustfileSection(options.root, sections.join(""));
  written.push(`justfile (${justfile})`);
  const workspaceFile = addWorkspacePackage(
    options.root,
    options.dir,
    config.packageManager ?? "npm",
  );
  if (workspaceFile) written.push(workspaceFile);
  if (options.preset === "react-shadcn") {
    editJson(join(options.root, "package.json"), (pkg) => {
      pkg.scripts ??= {};
      pkg.scripts["add:shadcn"] = `node ${config.tooling}/add-shadcn-items.mjs`;
    });
  }
  config.library = {
    dir: options.dir,
    alias: options.alias,
    preset: options.preset,
    style: options.preset === "react-shadcn" ? options.style : null,
  };
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
