#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseSync } from "oxc-parser";

// Rule 9: copy comes from the catalogue. Elements, patterns and consumer layers render no literal
// text; every language in the catalogue has the base language's keys and placeholders.

const userFacing = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
]);
const words = /\p{L}/u;
const supportSuffixes = [
  "stories",
  "story",
  "test",
  "spec",
  "fixture",
  "fixtures",
  "d",
];
const pluralSuffix = /_(zero|one|two|few|many|other)$/;
const placeholder = /\{\{\s*([^,}\s]+)[^}]*\}\}/g;

const lineAt = (source, offset) => source.slice(0, offset).split("\n").length;

function textOf(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return [node];
  if (node?.type === "TemplateLiteral") return [node];
  if (node?.type === "ConditionalExpression")
    return [...textOf(node.consequent), ...textOf(node.alternate)];
  if (node?.type === "LogicalExpression") return textOf(node.right);
  return [];
}

function literalValue(node) {
  if (node.type === "TemplateLiteral")
    return node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ");
  return node.value;
}

export function literalText(source, file) {
  const findings = [];
  const add = (node, text) => {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (!words.test(trimmed)) return;
    const offset = node.start + Math.max(0, text.search(/\S/));
    findings.push({ offset, line: lineAt(source, offset), text: trimmed });
  };
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (node.type === "JSXText") add(node, node.value);
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      for (const child of node.children) {
        if (child.type === "JSXExpressionContainer")
          for (const text of textOf(child.expression))
            add(text, literalValue(text));
      }
    }
    if (node.type === "JSXAttribute" && node.name.type === "JSXIdentifier") {
      if (userFacing.has(node.name.name) && node.value) {
        const values =
          node.value.type === "JSXExpressionContainer"
            ? textOf(node.value.expression)
            : textOf(node.value);
        for (const text of values) add(text, literalValue(text));
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && value && typeof value === "object") visit(value);
    }
  };
  visit(parseSync(file, source).program);
  return findings
    .sort((a, b) => a.offset - b.offset)
    .map(({ line, text }) => ({ line, text }));
}

function flatten(group, prefix, out, problems) {
  for (const [key, value] of Object.entries(group)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value && typeof value === "object" && !Array.isArray(value))
      flatten(value, path, out, problems);
    else problems.push(`${path} must be text or a group of keys`);
  }
  return out;
}

const names = (text) =>
  [...new Set([...text.matchAll(placeholder)].map((match) => match[1]))]
    .sort()
    .map((name) => `{{${name}}}`)
    .join(" ");

// Plural forms vary by language, so keys compare without their plural suffix.
function byBase(entries) {
  const grouped = new Map();
  for (const [key, text] of entries) {
    const base = key.replace(pluralSuffix, "");
    grouped.set(base, [...(grouped.get(base) ?? []), text]);
  }
  return grouped;
}

export function compareLocales(base, other) {
  const problems = [];
  const expected = byBase(flatten(base, "", new Map(), problems));
  const actual = byBase(flatten(other, "", new Map(), problems));
  if (problems.length > 0) return [...new Set(problems)];
  for (const [key, texts] of expected) {
    if (!actual.has(key)) {
      problems.push(`${key} is missing`);
      continue;
    }
    const want = names(texts.join(" "));
    for (const text of actual.get(key)) {
      if (names(text) !== want)
        problems.push(
          `${key} uses ${names(text) || "no placeholder"}, the base uses ${want || "none"}`,
        );
    }
  }
  for (const key of actual.keys())
    if (!expected.has(key)) problems.push(`${key} is not in the base language`);
  return problems;
}

function layerFiles(directory, support) {
  const files = [];
  const walk = (current, inLayer) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "component-core") continue;
        walk(
          path,
          inLayer || /^component-(elements|patterns)$/.test(entry.name),
        );
      } else if (
        inLayer &&
        /\.[cm]?[jt]sx$/.test(entry.name) &&
        !support.test(entry.name)
      ) {
        files.push(path);
      }
    }
  };
  if (existsSync(directory)) walk(directory, false);
  return files.sort();
}

const posix = (path) => path.split("\\").join("/");

export function checkCopy(root, tooling) {
  const config = JSON.parse(
    readFileSync(join(root, tooling, "ce-pattern.json"), "utf8"),
  );
  const copy = config.library?.copy;
  if (!copy?.dir || !copy?.base)
    throw new Error(
      'ce-pattern.json records no copy catalogue for the library; add "copy": { "dir": "<folder>", "base": "<language>" } to its library entry',
    );
  const support = new RegExp(
    `\\.(${[...supportSuffixes, ...(config.supportSuffixes ?? [])].join("|")})\\.[cm]?[jt]sx?$`,
  );
  const problems = [];
  const roots = [
    config.library.dir,
    ...(config.consumers ?? []).map((consumer) => consumer.dir),
  ];
  for (const dir of roots) {
    for (const file of layerFiles(resolve(root, dir), support)) {
      const name = posix(relative(root, file));
      for (const finding of literalText(readFileSync(file, "utf8"), file))
        problems.push(
          `${name}:${finding.line}: "${finding.text}" is literal text`,
        );
    }
  }
  const catalogue = resolve(root, config.library.dir, copy.dir);
  const baseFile = join(catalogue, `${copy.base}.json`);
  if (!existsSync(baseFile))
    throw new Error(
      `${posix(relative(root, baseFile))} does not exist; it is the base language`,
    );
  const base = JSON.parse(readFileSync(baseFile, "utf8"));
  for (const problem of compareLocales(base, base))
    problems.push(`${posix(relative(root, baseFile))}: ${problem}`);
  for (const entry of readdirSync(catalogue).sort()) {
    if (!entry.endsWith(".json") || entry === `${copy.base}.json`) continue;
    const file = join(catalogue, entry);
    for (const problem of compareLocales(
      base,
      JSON.parse(readFileSync(file, "utf8")),
    ))
      problems.push(`${posix(relative(root, file))}: ${problem}`);
  }
  return problems;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const tooling = relative(
      process.cwd(),
      dirname(fileURLToPath(import.meta.url)),
    );
    const problems = checkCopy(process.cwd(), tooling);
    for (const problem of problems) console.error(problem);
    if (problems.length > 0) {
      console.error(
        'Copy comes from the catalogue (Rule 9): add each text to the base language\'s file and render it with t("<key>"), in every language the catalogue holds.',
      );
      process.exitCode = 1;
    } else
      console.log(
        "Copy: every text comes from the catalogue, and every language matches the base.",
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
