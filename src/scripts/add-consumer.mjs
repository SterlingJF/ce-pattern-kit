#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  addWorkspacePackage,
  assetsDir,
  editJson,
  isDirectory,
  jsonFile,
  main,
  parseArguments,
  Plan,
  readConfig,
  readJson,
  report,
  setCheckerScript,
  workspaceDependency,
  writeJson,
} from "./lib.mjs";

const layerChoices = ["none", "patterns", "all"];

export function addConsumer(argv) {
  const options = parseArguments(argv, {
    flags: ["create"],
    values: { dir: null, layers: "none", alias: null },
    required: ["dir"],
  });
  if (!layerChoices.includes(options.layers)) {
    throw new Error(`--layers must be one of ${layerChoices.join(", ")}`);
  }
  const { path: configFile, config } = readConfig(options.root);
  if (!config.library)
    throw new Error("ce-pattern.json records no library; scaffold one first");
  if (
    (config.consumers ?? []).some((consumer) => consumer.dir === options.dir)
  ) {
    throw new Error(
      `ce-pattern.json already records the consumer ${options.dir}`,
    );
  }
  const consumerDir = join(options.root, options.dir);
  const plan = new Plan(options.root);
  if (options.create) {
    if (!options.alias) throw new Error("--alias is required with --create");
    if (isDirectory(consumerDir))
      throw new Error(
        `Refusing to overwrite ${options.dir}/. Drop --create to wire an existing package.`,
      );
    const preset = join(assetsDir, "presets", "react-shadcn");
    const presetPackage = readJson(join(preset, "package.json"));
    const react = config.library.preset === "react-shadcn";
    const devDependencies = react
      ? {
          "@types/react": presetPackage.devDependencies["@types/react"],
          "@types/react-dom": presetPackage.devDependencies["@types/react-dom"],
          react: presetPackage.devDependencies.react,
          "react-dom": presetPackage.devDependencies["react-dom"],
          typescript: presetPackage.devDependencies.typescript,
        }
      : { typescript: presetPackage.devDependencies.typescript };
    plan.add(
      join(consumerDir, "package.json"),
      jsonFile({
        name: options.alias,
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: { check: "tsc --noEmit" },
        dependencies: {
          [config.library.alias]: workspaceDependency(
            config.packageManager ?? "npm",
          ),
        },
        devDependencies,
      }),
    );
    const tsconfig = readJson(join(preset, "tsconfig.json"));
    tsconfig.compilerOptions.paths = { "@/*": ["./src/*"] };
    tsconfig.include = ["src/**/*.ts", "src/**/*.tsx"];
    if (!react) {
      delete tsconfig.compilerOptions.jsx;
      tsconfig.compilerOptions.types = [];
    }
    plan.add(join(consumerDir, "tsconfig.json"), jsonFile(tsconfig));
  } else if (!existsSync(join(consumerDir, "package.json"))) {
    throw new Error(
      `${options.dir}/package.json not found; pass --create to scaffold the package`,
    );
  }
  if (options.layers === "all") {
    plan.add(
      join(consumerDir, "src", "component-core", "index.ts"),
      "export {};\n",
    );
  }
  plan.refuseCollisions();
  const written = plan.commit();
  if (!options.create) {
    editJson(join(consumerDir, "package.json"), (pkg) => {
      pkg.dependencies ??= {};
      pkg.dependencies[config.library.alias] = workspaceDependency(
        config.packageManager ?? "npm",
      );
    });
    written.push(`${options.dir}/package.json`);
  }
  const workspaceFile = addWorkspacePackage(
    options.root,
    options.dir,
    config.packageManager ?? "npm",
  );
  if (workspaceFile) written.push(workspaceFile);
  config.consumers ??= [];
  config.consumers.push({
    dir: options.dir,
    alias:
      options.alias ?? readJson(join(consumerDir, "package.json")).name ?? null,
    layers: options.layers,
  });
  writeJson(configFile, config);
  setCheckerScript(options.root, config);
  written.push("package.json");
  return written;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(() => report(addConsumer(process.argv.slice(2))));
}
