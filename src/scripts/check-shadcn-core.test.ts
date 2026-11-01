import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  driftedFiles,
  forkFolder,
  summary,
  truncatedDiff,
} from "../assets/presets/react-shadcn/check-shadcn-core.mjs";

const report = (body: string) =>
  [
    "├ component-core/button.tsx (overwrite)",
    "│ ┌──────────",
    "│ │ --- a/component-core/button.tsx",
    "│ │ +++ b/component-core/button.tsx",
    body,
    "│ └──────────",
  ].join("\n");

test("the kit's own vendoring rewrites are not drift", () => {
  const body = [
    '│ │ -import { cn } from "@acme/components/lib/utils"',
    '│ │ +import { cn } from "cn"',
    '│ │ +"use client"',
    "│ │ +",
  ].join("\n");
  assert.deepEqual(driftedFiles(report(body)), []);
});

test("a changed class is drift", () => {
  const body = [
    '│ │ -  "rounded-md px-2",',
    '│ │ +  "rounded-lg px-2.5",',
  ].join("\n");
  assert.deepEqual(driftedFiles(report(body)), ["component-core/button.tsx"]);
});

test("a registry folder in the library is refused, since core is never forked", () => {
  const dir = mkdtempSync(join(tmpdir(), "core-check-"));
  try {
    assert.equal(forkFolder(dir), undefined);
    mkdirSync(join(dir, "registry"));
    assert.match(
      forkFolder(dir) ?? "",
      /registry is not allowed: core is never forked \(Rule 7\)/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a diff the CLI cut short cannot pass as clean", () => {
  assert.equal(
    truncatedDiff(
      "Showing 5 of 30 files. Use --diff <path> to view a specific file.",
    ),
    true,
  );
  assert.equal(truncatedDiff(report('│ │ +"use client"')), false);
});

test("the verdict names the folder and how many files it checked", () => {
  assert.equal(
    summary("src/component-core", 8, []),
    "src/component-core: 8 files match the registry.",
  );
  assert.equal(
    summary("component-core", 0, []),
    "component-core holds no core files, so nothing was checked.",
  );
});
