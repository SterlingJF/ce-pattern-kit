import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const library = fileURLToPath(
  new URL("../../examples/react-shadcn/components/", import.meta.url),
);

const probes = {
  "component-patterns/probe-restyle.tsx": `import { Button } from "@acme/components/component-core/button";
export function ProbeRestyle() {
  return <Button className="px-4">Go</Button>;
}
`,
  "component-patterns/probe-raw.tsx": `export function ProbeRaw() {
  return (
    <div className="w-[13px]" style={{ color: "red" }}>
      <button type="button">Go</button>
    </div>
  );
}
`,
  "component-patterns/probe-dynamic.tsx": `import { Button } from "@acme/components/component-core/button";
export function ProbeDynamic({ gap }: { gap: number }) {
  return <Button className={\`flex gap-\${gap}\`}>Go</Button>;
}
`,
  "component-elements/probe-element.tsx": `import { Button } from "@acme/components/component-core/button";
export function ProbeElement() {
  return <Button className="px-4">Go</Button>;
}
`,
  "component-elements/probe-theme.tsx": `import { Button } from "@acme/components/component-core/button";
export function ProbeTheme() {
  return <Button className="bg-primary rounded-lg">Go</Button>;
}
`,
  "component-elements/probe-off-theme.tsx": `import { Button } from "@acme/components/component-core/button";
export function ProbeOffTheme() {
  return <Button className="bg-brand rounded-corner">Go</Button>;
}
`,
  "component-elements/probe-blend.tsx": `import { Button } from "@acme/components/component-core/button";
export function ProbeBlend() {
  return <Button className="mix-blend-multiply">Go</Button>;
}
`,
};

const findings = (): Array<{ file: string; rule: string }> => {
  for (const [file, text] of Object.entries(probes)) {
    mkdirSync(join(library, file, ".."), { recursive: true });
    writeFileSync(join(library, file), text);
  }
  try {
    const result = spawnSync(
      join(library, "node_modules/.bin/oxlint"),
      ["--format", "json", ...Object.keys(probes)],
      { cwd: library, encoding: "utf8" },
    );
    const report: {
      diagnostics: Array<{ code: string; filename: string }>;
    } = JSON.parse(result.stdout);
    return report.diagnostics.map((diagnostic) => ({
      file: diagnostic.filename,
      rule: diagnostic.code,
    }));
  } finally {
    for (const file of Object.keys(probes)) rmSync(join(library, file));
  }
};

const rulesFor = (
  found: Array<{ file: string; rule: string }>,
  file: string,
): Array<string> =>
  found
    .filter((each) => each.file.endsWith(file))
    .map((each) => each.rule)
    .sort();

test("the lint preset enforces Rule 8 by layer", () => {
  const found = findings();
  assert.deepEqual(rulesFor(found, "probe-restyle.tsx"), [
    "shadcn(no-restyle)",
  ]);
  assert.deepEqual(rulesFor(found, "probe-raw.tsx"), [
    "react(forbid-elements)",
    "shadcn(no-arbitrary-values)",
    "shadcn(no-inline-styles)",
  ]);
  assert.deepEqual(rulesFor(found, "probe-dynamic.tsx"), [
    "shadcn(require-static-classes)",
  ]);
  assert.deepEqual(rulesFor(found, "probe-element.tsx"), []);
  assert.deepEqual(rulesFor(found, "probe-blend.tsx"), ["shadcn(no-restyle)"]);
});

test("the lint reads the theme generated from the token map", () => {
  const found = findings();
  assert.deepEqual(rulesFor(found, "probe-theme.tsx"), []);
  assert.deepEqual(rulesFor(found, "probe-off-theme.tsx"), [
    "shadcn(no-raw-colors)",
    "shadcn(no-restyle)",
    "shadcn(no-unknown-classes)",
  ]);
});
