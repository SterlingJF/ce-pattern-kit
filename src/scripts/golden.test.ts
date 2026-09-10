import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  exampleDir,
  generateExample,
  isUserOwned,
  listGenerated,
} from "../../tools/regenerate-example.mjs";

test("the scripts regenerate the golden example byte for byte", () => {
  const scratch = mkdtempSync(join(tmpdir(), "ce-pattern-golden-"));
  generateExample(scratch);
  const generated = listGenerated(scratch);
  assert.ok(generated.length > 20, `generated ${generated.length} files`);
  for (const file of generated) {
    if (isUserOwned(file)) continue;
    assert.equal(
      readFileSync(join(exampleDir, file), "utf8"),
      readFileSync(join(scratch, file), "utf8"),
      `differs: ${file}`,
    );
  }
  const extras = listGenerated(exampleDir).filter(
    (file) => !generated.includes(file) && !isUserOwned(file),
  );
  assert.deepEqual(extras, []);
  rmSync(scratch, { recursive: true, force: true });
});
