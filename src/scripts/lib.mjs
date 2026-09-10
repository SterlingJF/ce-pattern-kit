import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const assetsDir = fileURLToPath(new URL("../assets/", import.meta.url));
export const banner = "# --- CE pattern ---";
export const tokenPattern = /__CE_[A-Z_]+__/;

export const posix = (path) => path.split(sep).join("/");

export function refusal(path) {
  return new Error(
    `Refusing to overwrite ${path}. Use --into for another destination or follow references/update.md.`,
  );
}

export function parseArguments(argv, spec) {
  const options = { root: process.cwd(), positionals: [] };
  for (const flag of spec.flags ?? []) options[flag] = false;
  for (const [name, fallback] of Object.entries(spec.values ?? {}))
    options[name] = fallback;
  let index = 0;
  while (index < argv.length) {
    const argument = argv[index];
    if (argument === "--") {
      options.positionals.push(...argv.slice(index + 1));
      break;
    }
    if (argument === "--root") {
      options.root = resolve(argv[++index] ?? ".");
    } else if (argument.startsWith("--")) {
      const name = argument.slice(2);
      if ((spec.flags ?? []).includes(name)) options[name] = true;
      else if (name in (spec.values ?? {}))
        options[name] = argv[++index] ?? null;
      else throw new Error(`Unknown option ${argument}`);
    } else {
      options.positionals.push(argument);
    }
    index += 1;
  }
  for (const name of spec.required ?? []) {
    if (
      options[name] === null ||
      options[name] === undefined ||
      options[name] === ""
    ) {
      throw new Error(`--${name} is required`);
    }
  }
  return options;
}

export function render(text, tokens) {
  let output = text;
  for (const [name, value] of Object.entries(tokens)) {
    output = output.replaceAll(`__CE_${name}__`, value);
  }
  const leftover = output.match(tokenPattern);
  if (leftover) throw new Error(`Unrendered token ${leftover[0]}`);
  return output;
}

export function listFiles(directory) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(posix(relative(directory, path)));
    }
  };
  walk(directory);
  return files;
}

export class Plan {
  constructor(root) {
    this.root = root;
    this.writes = new Map();
    this.written = [];
  }

  add(path, content) {
    this.writes.set(path, content);
  }

  addTree(from, to, tokens = null, skip = []) {
    for (const file of listFiles(from)) {
      if (skip.includes(file)) continue;
      const text = readFileSync(join(from, file), "utf8");
      this.add(join(to, file), tokens ? render(text, tokens) : text);
    }
  }

  refuseCollisions() {
    for (const path of this.writes.keys()) {
      if (existsSync(path)) throw refusal(posix(relative(this.root, path)));
    }
  }

  commit() {
    for (const [path, content] of this.writes) {
      if (tokenPattern.test(content))
        throw new Error(`Unrendered token in ${path}`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
      this.written.push(posix(relative(this.root, path)));
    }
    return this.written;
  }
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function stringifyJson(value, indent = "") {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const scalars = value.every(
      (item) => item === null || typeof item !== "object",
    );
    const inline = `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
    if (scalars && inline.length + indent.length <= 80) return inline;
    return `[\n${value.map((item) => `${inner}${stringifyJson(item, inner)}`).join(",\n")}\n${indent}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return `{\n${entries
      .map(
        ([key, item]) =>
          `${inner}${JSON.stringify(key)}: ${stringifyJson(item, inner)}`,
      )
      .join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

export function jsonFile(value) {
  return `${stringifyJson(value)}\n`;
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, jsonFile(value));
}

export function editJson(path, edit) {
  const value = existsSync(path) ? readJson(path) : {};
  edit(value);
  writeJson(path, value);
}

export function ensureRootPackage(root, name = basename(root)) {
  const path = join(root, "package.json");
  if (existsSync(path)) return false;
  writeJson(path, {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {},
  });
  return true;
}

export const packageManagers = ["pnpm", "npm", "yarn", "bun"];

export function detectPackageManager(root) {
  const manifest = join(root, "package.json");
  if (existsSync(manifest)) {
    const field = readJson(manifest).packageManager;
    if (typeof field === "string") {
      const name = field.split("@")[0];
      if (packageManagers.includes(name)) return name;
    }
  }
  const lockfiles = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["package-lock.json", "npm"],
  ];
  for (const [file, name] of lockfiles) {
    if (existsSync(join(root, file))) return name;
  }
  return "npm";
}

export function managerCommands(name) {
  const table = {
    pnpm: {
      install: "pnpm install --ignore-scripts",
      addDev: "pnpm add -D -w",
      run: "pnpm run",
      dlx: "pnpm dlx",
    },
    npm: {
      install: "npm install --ignore-scripts",
      addDev: "npm install -D",
      run: "npm run",
      dlx: "npx --yes",
    },
    yarn: {
      install: "yarn install",
      addDev: "yarn add -D",
      run: "yarn run",
      dlx: "yarn dlx",
    },
    bun: {
      install: "bun install --ignore-scripts",
      addDev: "bun add -d",
      run: "bun run",
      dlx: "bunx",
    },
  };
  const commands = table[name];
  if (!commands)
    throw new Error(
      `Unknown package manager ${name}; expected one of ${packageManagers.join(", ")}`,
    );
  return commands;
}

export function workspaceDependency(name) {
  return name === "npm" ? "*" : "workspace:*";
}

export function addWorkspacePackage(root, directory, manager) {
  if (manager === "pnpm") {
    const path = join(root, "pnpm-workspace.yaml");
    if (!existsSync(path)) {
      writeFileSync(path, `packages:\n  - ${directory}\n`);
      return "pnpm-workspace.yaml";
    }
    const lines = readFileSync(path, "utf8").split("\n");
    const index = lines.findIndex((line) => /^packages:/.test(line));
    if (index === -1) throw new Error(`${path} has no packages key`);
    if (
      lines.some(
        (line) =>
          line.trim() === `- ${directory}` ||
          line.trim() === `- "${directory}"`,
      )
    ) {
      return null;
    }
    if (/^packages:\s*\[\s*\]\s*$/.test(lines[index]))
      lines[index] = "packages:";
    lines.splice(index + 1, 0, `  - ${directory}`);
    writeFileSync(path, lines.join("\n"));
    return "pnpm-workspace.yaml";
  }
  let changed = false;
  editJson(join(root, "package.json"), (pkg) => {
    const workspaces = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : Array.isArray(pkg.workspaces?.packages)
        ? pkg.workspaces.packages
        : null;
    if (workspaces === null) {
      pkg.workspaces = [directory];
      changed = true;
    } else if (!workspaces.includes(directory)) {
      workspaces.push(directory);
      changed = true;
    }
  });
  return changed ? "package.json" : null;
}

export function appendJustfileSection(root, section) {
  const path = join(root, "justfile");
  if (!existsSync(path)) {
    writeFileSync(path, `default:\n  @just --list\n\n${section}`);
    return "created";
  }
  const current = readFileSync(path, "utf8");
  if (current.includes(banner)) throw refusal("justfile (CE pattern section)");
  writeFileSync(path, `${current.replace(/\n*$/, "\n\n")}${section}`);
  return "appended";
}

export function configPath(root, tooling) {
  return join(root, tooling, "ce-pattern.json");
}

export function readConfig(root) {
  const candidates = [join(root, "tools", "ce-pattern", "ce-pattern.json")];
  for (const candidate of candidates) {
    if (existsSync(candidate))
      return { path: candidate, config: readJson(candidate) };
  }
  throw new Error(
    "tools/ce-pattern/ce-pattern.json not found; run install.mjs first",
  );
}

export function checkerRoots(config) {
  const roots = [];
  if (config.library) roots.push(config.library.dir);
  for (const consumer of config.consumers ?? []) roots.push(consumer.dir);
  return roots.length > 0 ? roots : ["components"];
}

export function setCheckerScript(root, config) {
  const tooling = config.tooling;
  editJson(join(root, "package.json"), (pkg) => {
    pkg.scripts ??= {};
    pkg.scripts["check:component-layers"] =
      `node --import tsx --test ${tooling}/component-layers.test.ts && tsx ${tooling}/check-component-layers.ts ${checkerRoots(config).join(" ")}`;
  });
}

export function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

export function report(written) {
  for (const path of written) console.log(`wrote ${path}`);
}

export function main(run) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
