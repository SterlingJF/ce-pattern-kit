#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

import { managers } from "./add-shadcn-items.mjs";

const fileLine = /^├ (\S+) \((?:overwrite|create)\)/;
const changeLine = /^│ │ ([-+])(?![-+]{2} )(.*)$/;
const vendorNoise = [
  /^import \{ cn \} from "(cn|[@\w./-]+\/lib\/utils)"$/,
  /^"use client"$/,
  /^$/,
];

export function truncatedDiff(report) {
  return /Showing \d+ of \d+ files/.test(stripVTControlCharacters(report));
}

export function driftedFiles(report) {
  const drifted = new Set();
  let current;
  for (const line of stripVTControlCharacters(report).split("\n")) {
    const file = fileLine.exec(line);
    if (file) current = file[1];
    const change = changeLine.exec(line);
    if (!change || current === undefined) continue;
    const text = change[2].trim();
    if (!vendorNoise.some((noise) => noise.test(text))) drifted.add(current);
  }
  return [...drifted];
}

export function forkFolder(dir) {
  return existsSync(join(dir, "registry"))
    ? `${join(dir, "registry")} is not allowed: core is never forked (Rule 7). Change a look in an element or the token map.`
    : undefined;
}

function dryRunDiff(dir, dlx, cli, name, file) {
  const [command, ...args] = dlx;
  const result = spawnSync(
    command,
    [...args, cli, "add", name, "--dry-run", "--diff", ...(file ? [file] : [])],
    { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (result.status !== 0)
    throw new Error(
      `${cli} add --dry-run exited with ${result.status ?? "signal"}`,
    );
  return result.stdout;
}

export function checkShadcnCore(root) {
  const tooling = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(
    readFileSync(join(tooling, "ce-pattern.json"), "utf8"),
  );
  const versions = JSON.parse(
    readFileSync(join(tooling, "versions.json"), "utf8"),
  );
  if (!config.library)
    throw new Error("ce-pattern.json records no library; scaffold one first");
  const dir = resolve(root, config.library.dir);
  const fork = forkFolder(dir);
  if (fork) throw new Error(fork);
  const manager = managers[config.packageManager ?? "npm"];
  if (!manager)
    throw new Error(`Unknown package manager ${config.packageManager}`);
  const cli = `shadcn@${versions.presets["react-shadcn"].shadcn}`;
  const core = join(dir, "component-core");
  const names = existsSync(core)
    ? readdirSync(core)
        .filter((name) => name.endsWith(".tsx"))
        .map((name) => basename(name, ".tsx"))
    : [];
  const drifted = new Set();
  for (const name of names) {
    let report = dryRunDiff(dir, manager.dlx, cli, name);
    if (truncatedDiff(report))
      report = dryRunDiff(
        dir,
        manager.dlx,
        cli,
        name,
        `component-core/${name}.tsx`,
      );
    if (truncatedDiff(report))
      throw new Error(
        `${name}: the CLI cut its diff short, so the file cannot be checked`,
      );
    for (const file of driftedFiles(report)) drifted.add(file);
  }
  return [...drifted];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const drift = checkShadcnCore(process.cwd());
    for (const file of drift)
      console.error(`${file} differs from the registry`);
    if (drift.length > 0) {
      console.error(
        "component-core is the vendor's, never edited or forked (Rules 1 and 7). Re-vendor with `just add_shadcn_atoms '<names>' true`, and change the look in the token map or an element.",
      );
      process.exitCode = 1;
    } else console.log("component-core matches the registry.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
