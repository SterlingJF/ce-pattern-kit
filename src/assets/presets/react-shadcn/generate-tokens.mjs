#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const namespaces = [
  "spacing",
  "radius",
  "text",
  "font",
  "font-weight",
  "leading",
  "tracking",
  "shadow",
  "inset-shadow",
  "drop-shadow",
  "blur",
  "ease",
  "animate",
  "breakpoint",
  "container",
  "aspect",
];
const reference = /^\{([\w-]+)\}$/;

const header = (source) =>
  `/* Generated from ${source} by generate-tokens.mjs. Do not edit. */\n`;

const block = (selector, lines) =>
  `\n${selector} {\n${lines.map((line) => `  ${line}`).join("\n")}\n}\n`;

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRoles(map) {
  const primitives = map.colors?.primitives;
  const roles = map.colors?.roles;
  if (!isObject(primitives) || !isObject(roles))
    throw new Error("colors needs primitives and roles objects");
  const pick = (role, scheme, value) => {
    const name = reference.exec(value ?? "")?.[1];
    if (name === undefined || !(name in primitives))
      throw new Error(
        `role ${role}: ${scheme} names ${value}, which is not a primitive`,
      );
    return name;
  };
  return Object.entries(roles).map(([role, scheme]) => {
    if (!isObject(scheme) || !("light" in scheme) || !("dark" in scheme))
      throw new Error(`role ${role} needs light and dark`);
    return {
      role,
      light: pick(role, "light", scheme.light),
      dark: pick(role, "dark", scheme.dark),
    };
  });
}

function themeLines(theme = {}) {
  if (!isObject(theme)) throw new Error("theme must be an object");
  return Object.entries(theme).flatMap(([namespace, scale]) => {
    if (!namespaces.includes(namespace))
      throw new Error(
        `theme namespace ${namespace} is not one Tailwind reads; use one of ${namespaces.join(", ")}`,
      );
    return Object.entries(scale).map(([name, value]) => {
      if (typeof value !== "string")
        throw new Error(
          `theme ${namespace}.${name} must be a CSS value string`,
        );
      return `--${namespace}-${name}: ${value};`;
    });
  });
}

export function renderTokens(map, source) {
  const roles = resolveRoles(map);
  const primitives = Object.entries(map.colors.primitives).map(
    ([name, value]) => `--palette-${name}: ${value};`,
  );
  const scale = themeLines(map.theme);
  return [
    header(source),
    block(":root", [
      ...primitives,
      ...roles.map(({ role, light }) => `--${role}: var(--palette-${light});`),
    ]),
    block(
      ".dark",
      roles.map(({ role, dark }) => `--${role}: var(--palette-${dark});`),
    ),
    block(
      "@theme inline",
      roles.map(({ role }) => `--color-${role}: var(--${role});`),
    ),
    scale.length > 0 ? block("@theme", scale) : "",
  ].join("");
}

export function renderHostVars(map, host, source) {
  if (
    !isObject(host) ||
    typeof host.selector !== "string" ||
    !isObject(host.roles)
  )
    throw new Error("the host map needs a selector and a roles object");
  const lines = resolveRoles(map).map(({ role, light, dark }) => {
    if (!(role in host.roles))
      throw new Error(`host map has no entry for role ${role}`);
    const variable = host.roles[role];
    if (variable === null) {
      if (light !== dark)
        throw new Error(
          `role ${role} maps to null, but its light and dark values differ`,
        );
      return `--${role}: var(--palette-${light});`;
    }
    if (typeof variable !== "string" || !variable.startsWith("--"))
      throw new Error(
        `host map: role ${role} must name a CSS variable or null`,
      );
    return `--${role}: var(${variable});`;
  });
  for (const role of Object.keys(host.roles))
    if (!(role in map.colors.roles))
      throw new Error(`host map names role ${role}, which the token map lacks`);
  return [header(source), block(host.selector, lines)].join("");
}

function outputs(libraryDir) {
  const tokensPath = join(libraryDir, "tokens.json");
  const map = JSON.parse(readFileSync(tokensPath, "utf8"));
  const files = [
    [
      join(libraryDir, "generated", "tokens.css"),
      renderTokens(map, "tokens.json"),
    ],
  ];
  const hostPath = join(libraryDir, "host-vars.json");
  if (existsSync(hostPath)) {
    const host = JSON.parse(readFileSync(hostPath, "utf8"));
    files.push([
      join(libraryDir, "generated", "host-vars.css"),
      renderHostVars(map, host, "host-vars.json"),
    ]);
  }
  return files;
}

export function generateTokens(root, check = false) {
  const tooling = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(
    readFileSync(join(tooling, "ce-pattern.json"), "utf8"),
  );
  if (!config.library)
    throw new Error("ce-pattern.json records no library; scaffold one first");
  const libraryDir = resolve(root, config.library.dir);
  const stale = [];
  for (const [path, text] of outputs(libraryDir)) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    if (current === text) continue;
    if (check) stale.push(path);
    else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      console.log(`wrote ${path}`);
    }
  }
  if (stale.length > 0)
    throw new Error(
      `${stale.join(", ")} is out of date with the token map. Run generate:tokens; never edit generated files (Rule 8).`,
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    generateTokens(process.cwd(), process.argv.includes("--check"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
