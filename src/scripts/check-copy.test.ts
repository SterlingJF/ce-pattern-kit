import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  checkCopy,
  compareLocales,
  literalText,
} from "../assets/presets/react-shadcn/check-copy.mjs";

const texts = (source: string) =>
  literalText(source, "x.tsx").map((finding: { text: string }) => finding.text);

test("text written into markup is literal copy", () => {
  assert.deepEqual(
    texts(
      'export const A = () => <p>Save changes <b>{"now"}</b> {ok ? "Yes" : `No`}</p>;',
    ),
    ["Save changes", "now", "Yes", "No"],
  );
});

test("user-facing attributes are copy, classes and keys are not", () => {
  assert.deepEqual(
    texts(
      'export const A = () => <input aria-label="Search" title={"Find"} placeholder="Type" className="px-2 text-sm" type="text" data-state="open" />;',
    ),
    ["Search", "Find", "Type"],
  );
});

test("text from the catalogue, numbers and punctuation pass", () => {
  assert.deepEqual(
    texts(
      'export const A = () => <p aria-label={t("search.label")}>{t("search.go")} · {count} / 3 {"→"}</p>;',
    ),
    [],
  );
});

test("findings carry their line", () => {
  const [finding] = literalText(
    "export const A = () => (\n  <p>\n    Hello\n  </p>\n);",
    "x.tsx",
  );
  assert.equal(finding.line, 3);
});

test("a language may use its own plural forms but not its own keys or placeholders", () => {
  const base = {
    search: {
      go: "Go",
      results_one: "{{count}} result",
      results_other: "{{count}} results",
    },
    greeting: "Hello {{name}}",
  };
  assert.deepEqual(
    compareLocales(base, {
      search: {
        go: "Aller",
        results_one: "{{count}} résultat",
        results_many: "{{count}} résultats",
        results_other: "{{count}} résultats",
      },
      greeting: "Bonjour {{name}}",
    }),
    [],
  );
  assert.deepEqual(
    compareLocales(base, {
      search: { results_other: "{{total}} résultats" },
      greeting: "Bonjour {{name}}",
      farewell: "Au revoir",
    }),
    [
      "search.go is missing",
      "search.results uses {{total}}, the base uses {{count}}",
      "farewell is not in the base language",
    ],
  );
});

test("a catalogue value that is neither text nor a group is refused", () => {
  assert.deepEqual(compareLocales({ a: 1 }, { a: 1 }), [
    "a must be text or a group of keys",
  ]);
});

const project = () => {
  const root = mkdtempSync(join(tmpdir(), "ce-copy-"));
  const write = (path: string, text: string) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write(
    "tools/ce-pattern/ce-pattern.json",
    JSON.stringify({
      library: { dir: "ui", copy: { dir: "src/copy", base: "en" } },
      consumers: [{ dir: "app" }],
      supportSuffixes: ["gallery"],
    }),
  );
  write("ui/src/copy/en.json", '{ "go": "Go" }');
  write("ui/src/copy/fr.json", '{ "go": "Aller", "stop": "Arrêt" }');
  write(
    "ui/src/component-core/button.tsx",
    "export const B = () => <button>Click</button>;",
  );
  write(
    "ui/src/component-elements/go.tsx",
    'export const G = () => <b>{t("go")}</b>;',
  );
  write(
    "ui/src/component-elements/go.gallery.tsx",
    "export const S = () => <p>Specimen</p>;",
  );
  write(
    "app/src/component-patterns/hero.tsx",
    "export const H = () => (\n  <h1>Welcome</h1>\n);",
  );
  return root;
};

test("the check reads the catalogue and roots from ce-pattern.json and skips core and support files", () => {
  assert.deepEqual(checkCopy(project(), "tools/ce-pattern"), [
    'app/src/component-patterns/hero.tsx:2: "Welcome" is literal text',
    "ui/src/copy/fr.json: stop is not in the base language",
  ]);
});

test("the check refuses a library that records no catalogue", () => {
  const root = mkdtempSync(join(tmpdir(), "ce-copy-"));
  mkdirSync(join(root, "tools/ce-pattern"), { recursive: true });
  writeFileSync(
    join(root, "tools/ce-pattern/ce-pattern.json"),
    JSON.stringify({ library: { dir: "ui" }, consumers: [] }),
  );
  assert.throws(
    () => checkCopy(root, "tools/ce-pattern"),
    /ce-pattern\.json records no copy catalogue for the library/,
  );
});
