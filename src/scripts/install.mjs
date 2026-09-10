#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assetsDir,
  detectPackageManager,
  ensureRootPackage,
  isDirectory,
  jsonFile,
  main,
  managerCommands,
  parseArguments,
  Plan,
  posix,
  report,
  setCheckerScript,
  writeJson,
} from "./lib.mjs";

export function install(argv) {
  const options = parseArguments(argv, {
    values: {
      into: "tools/ce-pattern",
      roots: "",
      name: null,
      "package-manager": null,
    },
  });
  if (!isDirectory(options.root))
    throw new Error(`${options.root} is not a directory`);
  const tooling = posix(options.into).replace(/\/+$/, "");
  const target = join(options.root, tooling);
  const plan = new Plan(options.root);
  plan.addTree(join(assetsDir, "tools", "ce-pattern"), target);
  plan.add(join(target, "versions.json"), jsonFile(readVersions()));
  plan.refuseCollisions();
  const written = plan.commit();
  const packageManager =
    options["package-manager"] ?? detectPackageManager(options.root);
  managerCommands(packageManager);
  const config = { tooling, packageManager, library: null, consumers: [] };
  if (options.roots) config.roots = options.roots.split(",").filter(Boolean);
  writeJson(join(target, "ce-pattern.json"), config);
  written.push(`${tooling}/ce-pattern.json`);
  if (ensureRootPackage(options.root, options.name ?? undefined))
    written.push("package.json");
  setCheckerScript(options.root, withRoots(config));
  return written;
}

function readVersions() {
  return JSON.parse(readFileSync(join(assetsDir, "versions.json"), "utf8"));
}

function withRoots(config) {
  if (!config.roots) return config;
  return {
    ...config,
    library: { dir: config.roots[0] },
    consumers: config.roots.slice(1).map((dir) => ({ dir })),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(() => report(install(process.argv.slice(2))));
}
