import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseArguments,
  parsePlan,
  refuseOverwrites,
  rewriteAliasImports,
} from "../assets/presets/react-shadcn/add-shadcn-items.mjs";

const alias = "@acme/components";

test("alias imports are rewritten to the package alias", () => {
  const source = [
    'import { cn } from "@/lib/utils";',
    "import type { Props } from '@/component-core/button';",
    'import "@/styles.css";',
    'import { cn } from "cn";',
    'const text = "@/not-an-import";',
  ].join("\n");
  assert.equal(
    rewriteAliasImports(source, alias),
    [
      'import { cn } from "@acme/components/lib/utils";',
      "import type { Props } from '@acme/components/component-core/button';",
      'import "@acme/components/styles.css";',
      'import { cn } from "@acme/components/lib/utils";',
      'const text = "@/not-an-import";',
    ].join("\n"),
  );
});

test("comment lines are left alone", () => {
  const source = '// import { cn } from "@/lib/utils";\n  // from "cn"';
  assert.equal(rewriteAliasImports(source, alias), source);
});

test("arguments split names, flags, and the terminator", () => {
  const options = parseArguments([
    "--style",
    "base-vega",
    "--overwrite",
    "--",
    "button badge",
  ]);
  assert.deepEqual(options.names, ["button", "badge"]);
  assert.equal(options.style, "base-vega");
  assert.equal(options.overwrite, true);
  assert.throws(
    () => parseArguments(["--style", "x"]),
    /At least one registry item/,
  );
  assert.throws(() => parseArguments(["--bogus", "button"]), /Unknown option/);
});

test("a local path, a URL, or a JSON item is refused, since core is never forked", () => {
  for (const name of [
    "./registry/button.json",
    "button.json",
    "https://example.com/r/button.json",
    "registry/button",
  ]) {
    assert.throws(
      () => parseArguments([name]),
      /is not a registry item name: core is never forked \(Rule 7\)/,
      name,
    );
  }
  assert.deepEqual(parseArguments(["alert-dialog"]).names, ["alert-dialog"]);
});

const dryRun = [
  "◇ Checking registry.",
  "┌ Dry run",
  "│",
  "│ ~ component-core/button.tsx        overwrite",
  "│ + component-core/field.tsx         create",
  "│ = lib/utils.ts                     skip (identical)",
  "│",
  "│ 3 files, 1 dep",
  "└",
].join("\n");

test("the dry run's plan is read file by file", () => {
  assert.deepEqual(parsePlan(dryRun), [
    { path: "component-core/button.tsx", action: "overwrite" },
    { path: "component-core/field.tsx", action: "create" },
    { path: "lib/utils.ts", action: "skip" },
  ]);
  assert.deepEqual(
    parsePlan("\u001b[2m│ + component-core/kbd.tsx  create\u001b[0m"),
    [{ path: "component-core/kbd.tsx", action: "create" }],
  );
});

test("files that differ from the registry are not overwritten without --overwrite", () => {
  const plan = parsePlan(dryRun);
  assert.throws(
    () => refuseOverwrites(plan, false),
    /Nothing vendored: component-core\/button\.tsx already exist and differ from the registry/,
  );
  assert.doesNotThrow(() => refuseOverwrites(plan, true));
  assert.doesNotThrow(() =>
    refuseOverwrites(
      [{ path: "component-core/kbd.tsx", action: "create" }],
      false,
    ),
  );
});
