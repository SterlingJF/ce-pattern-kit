import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseArguments,
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
