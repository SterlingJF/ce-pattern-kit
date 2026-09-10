#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const managers = {
  pnpm: {
    dlx: ["pnpm", "dlx"],
    install: ["pnpm", "install", "--no-frozen-lockfile", "--ignore-scripts"],
  },
  npm: {
    dlx: ["npx", "--yes"],
    install: ["npm", "install", "--ignore-scripts"],
  },
  yarn: { dlx: ["yarn", "dlx"], install: ["yarn", "install"] },
  bun: { dlx: ["bunx"], install: ["bun", "install", "--ignore-scripts"] },
};

const importPrefix = /((?:from|import)\s+["'])@\//g;
const cnImport = /((?:from|import)\s+["'])cn(["'])/g;

export function rewriteAliasImports(source, alias) {
  return source
    .split("\n")
    .map((line) =>
      /^\s*\/\//.test(line)
        ? line
        : line
            .replace(importPrefix, `$1${alias}/`)
            .replace(cnImport, `$1${alias}/lib/utils$2`),
    )
    .join("\n");
}

export function parseArguments(argv) {
  const options = {
    names: [],
    overwrite: false,
    style: null,
    root: process.cwd(),
  };
  let index = 0;
  while (index < argv.length) {
    const argument = argv[index];
    if (argument === "--") {
      options.names.push(...argv.slice(index + 1));
      break;
    }
    if (argument === "--overwrite") options.overwrite = true;
    else if (argument === "--style") options.style = argv[++index] ?? null;
    else if (argument === "--root")
      options.root = resolve(argv[++index] ?? ".");
    else if (argument.startsWith("--"))
      throw new Error(`Unknown option ${argument}`);
    else options.names.push(argument);
    index += 1;
  }
  options.names = options.names
    .flatMap((name) => name.split(/\s+/))
    .filter(Boolean);
  if (options.names.length === 0) {
    throw new Error("At least one registry item name is required, e.g. button");
  }
  return options;
}

function listSourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status ?? "signal"}`,
    );
  }
}

export function addShadcnItems(options) {
  const tooling = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(
    readFileSync(join(tooling, "ce-pattern.json"), "utf8"),
  );
  const versions = JSON.parse(
    readFileSync(join(tooling, "versions.json"), "utf8"),
  );
  const library = config.library;
  if (!library)
    throw new Error("ce-pattern.json records no library; scaffold one first");
  const libraryDir = resolve(options.root, library.dir);
  const style = options.style ?? library.style;
  const manifest = join(libraryDir, "components.json");
  const configured = JSON.parse(readFileSync(manifest, "utf8")).style;
  if (!configured) throw new Error(`${manifest} declares no style`);
  if (configured !== style) {
    throw new Error(
      `${manifest} declares style '${configured}', requested '${style}'`,
    );
  }
  const manager = managers[config.packageManager ?? "npm"];
  if (!manager)
    throw new Error(`Unknown package manager ${config.packageManager}`);
  const cli = `shadcn@${versions.presets["react-shadcn"].shadcn}`;
  const flags = ["--yes", ...(options.overwrite ? ["--overwrite"] : [])];
  run(
    manager.dlx[0],
    [...manager.dlx.slice(1), cli, "add", ...options.names, ...flags],
    libraryDir,
  );
  const packagePath = join(libraryDir, "package.json");
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  if (pkg.dependencies && "cn" in pkg.dependencies) {
    delete pkg.dependencies.cn;
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    run(manager.install[0], manager.install.slice(1), options.root);
    console.log(
      'Removed the npm package "cn" that the registry item declared; core imports resolve to lib/utils instead.',
    );
  }
  for (const folder of ["component-core", "component-patterns", "lib"]) {
    for (const file of listSourceFiles(join(libraryDir, folder))) {
      const source = readFileSync(file, "utf8");
      const rewritten = rewriteAliasImports(source, library.alias);
      if (rewritten !== source) writeFileSync(file, rewritten);
    }
  }
  console.log(
    `Vendored ${options.names.join(" ")} against ${style} with ${cli}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    addShadcnItems(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
