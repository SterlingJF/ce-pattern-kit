import assert from "node:assert/strict";
import { test } from "node:test";

import {
  renderHostVars,
  renderTokens,
} from "../assets/presets/react-shadcn/generate-tokens.mjs";

const map = {
  colors: {
    primitives: {
      white: "oklch(1 0 0)",
      "neutral-900": "oklch(0.145 0 0)",
      "red-600": "oklch(0.577 0.245 27.325)",
    },
    roles: {
      background: { light: "{white}", dark: "{neutral-900}" },
      destructive: { light: "{red-600}", dark: "{red-600}" },
    },
  },
  theme: {
    radius: { lg: "0.625rem" },
    spacing: { "control-height": "1.75rem" },
  },
};

test("a token map renders palette, light and dark roles, and Tailwind theme entries", () => {
  assert.equal(
    renderTokens(map, "tokens.json"),
    [
      "/* Generated from tokens.json by generate-tokens.mjs. Do not edit. */",
      "",
      ":root {",
      "  --palette-white: oklch(1 0 0);",
      "  --palette-neutral-900: oklch(0.145 0 0);",
      "  --palette-red-600: oklch(0.577 0.245 27.325);",
      "  --background: var(--palette-white);",
      "  --destructive: var(--palette-red-600);",
      "}",
      "",
      ".dark {",
      "  --background: var(--palette-neutral-900);",
      "  --destructive: var(--palette-red-600);",
      "}",
      "",
      "@theme inline {",
      "  --color-background: var(--background);",
      "  --color-destructive: var(--destructive);",
      "}",
      "",
      "@theme {",
      "  --radius-lg: 0.625rem;",
      "  --spacing-control-height: 1.75rem;",
      "}",
      "",
    ].join("\n"),
  );
});

test("a role must name a primitive for both light and dark", () => {
  const broken = structuredClone(map);
  broken.colors.roles.background.dark = "{nope}";
  assert.throws(
    () => renderTokens(broken, "tokens.json"),
    /role background: dark names \{nope\}, which is not a primitive/,
  );
  const half = structuredClone(map);
  delete (half.colors.roles.background as { dark?: string }).dark;
  assert.throws(
    () => renderTokens(half, "tokens.json"),
    /role background needs light and dark/,
  );
});

test("theme entries use Tailwind's own namespaces and plain CSS values", () => {
  assert.throws(
    () => renderTokens({ ...map, theme: { corners: { lg: "6px" } } }, "t"),
    /theme namespace corners is not one Tailwind reads/,
  );
  assert.throws(
    () => renderTokens({ ...map, theme: { radius: { lg: 6 } } }, "t"),
    /theme radius\.lg must be a CSS value string/,
  );
});

test("a host map points each role at the host's variable, or keeps a value that never changes", () => {
  const host = {
    selector: ".host-root",
    roles: { background: "--background-primary", destructive: null },
  };
  assert.equal(
    renderHostVars(map, host, "host-vars.json"),
    [
      "/* Generated from host-vars.json by generate-tokens.mjs. Do not edit. */",
      "",
      ".host-root {",
      "  --background: var(--background-primary);",
      "  --destructive: var(--palette-red-600);",
      "}",
      "",
    ].join("\n"),
  );
});

test("a host map covers every role, and keeps a value only where light and dark agree", () => {
  assert.throws(
    () =>
      renderHostVars(
        map,
        { selector: ".h", roles: { background: "--bg" } },
        "h",
      ),
    /host map has no entry for role destructive/,
  );
  assert.throws(
    () =>
      renderHostVars(
        map,
        { selector: ".h", roles: { background: null, destructive: null } },
        "h",
      ),
    /role background maps to null, but its light and dark values differ/,
  );
});
