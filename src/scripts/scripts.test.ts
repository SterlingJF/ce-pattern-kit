import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL("./", import.meta.url));

const run = (script: string, root: string, ...args: string[]) => {
  const result = spawnSync(
    "node",
    [join(scripts, script), "--root", root, ...args],
    {
      encoding: "utf8",
    },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const scratch = (): string => mkdtempSync(join(tmpdir(), "ce-pattern-"));
const pnpmRoot = (): string => {
  const root = scratch();
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  return root;
};
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));

test("install vendors the tooling directory and wires the check script", () => {
  const root = scratch();
  const result = run("install.mjs", root);
  assert.equal(result.status, 0, result.stderr);
  for (const file of [
    "tools/ce-pattern/component-layers.ts",
    "tools/ce-pattern/check-component-layers.ts",
    "tools/ce-pattern/component-layers.test.ts",
    "tools/ce-pattern/README_COMPONENT_SYSTEM.md",
    "tools/ce-pattern/justfile.ce",
    "tools/ce-pattern/versions.json",
    "tools/ce-pattern/ce-pattern.json",
    "tools/ce-pattern/test-fixtures/component-layers/valid/package.json",
  ]) {
    assert.ok(existsSync(join(root, file)), file);
  }
  const pkg = json(join(root, "package.json"));
  assert.equal(
    pkg.scripts["check:component-layers"],
    "node --import tsx --test tools/ce-pattern/component-layers.test.ts && tsx tools/ce-pattern/check-component-layers.ts components",
  );
  assert.deepEqual(json(join(root, "tools/ce-pattern/ce-pattern.json")), {
    tooling: "tools/ce-pattern",
    packageManager: "npm",
    library: null,
    consumers: [],
  });
  const again = run("install.mjs", root);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /Refusing to overwrite tools\/ce-pattern\//);
});

test("install respects --into and --roots on an existing package", () => {
  const root = scratch();
  writeFileSync(
    join(root, "package.json"),
    '{ "name": "existing", "scripts": { "check": "true" } }\n',
  );
  const result = run(
    "install.mjs",
    root,
    "--into",
    "vendor/ce",
    "--roots",
    "ui,web",
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(root, "vendor/ce/component-layers.ts")));
  const pkg = json(join(root, "package.json"));
  assert.equal(pkg.name, "existing");
  assert.equal(pkg.scripts.check, "true");
  assert.match(
    pkg.scripts["check:component-layers"],
    /vendor\/ce\/check-component-layers\.ts ui web$/,
  );
});

test("scaffold-library renders the react-shadcn preset and wires the workspace", () => {
  const root = pnpmRoot();
  assert.equal(run("install.mjs", root).status, 0);
  const result = run(
    "scaffold-library.mjs",
    root,
    "--alias",
    "@acme/components",
  );
  assert.equal(result.status, 0, result.stderr);
  const pkg = json(join(root, "components/package.json"));
  assert.equal(pkg.name, "@acme/components");
  assert.deepEqual(
    Object.keys(
      json(join(root, "components/tsconfig.json")).compilerOptions.paths,
    ),
    ["@/*", "@acme/components/*"],
  );
  assert.equal(
    json(join(root, "components/components.json")).style,
    "base-vega",
  );
  assert.ok(existsSync(join(root, "components/lib/utils.ts")));
  assert.ok(existsSync(join(root, "tools/ce-pattern/add-shadcn-items.mjs")));
  const justfile = readFileSync(join(root, "justfile"), "utf8");
  assert.match(justfile, /^default:\n  @just --list/);
  assert.match(justfile, /# --- CE pattern ---/);
  assert.match(justfile, /check_component_layers:/);
  assert.match(
    justfile,
    /add_shadcn_atoms UI_NAME OVERWRITE='false' BASE='base-vega'/,
  );
  assert.equal(
    readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
    "packages:\n  - components\n",
  );
  const rootPkg = json(join(root, "package.json"));
  assert.equal(
    rootPkg.scripts["add:shadcn"],
    "node tools/ce-pattern/add-shadcn-items.mjs",
  );
  assert.match(
    rootPkg.scripts["check:component-layers"],
    /check-component-layers\.ts components$/,
  );
  assert.deepEqual(
    json(join(root, "tools/ce-pattern/ce-pattern.json")).library,
    {
      dir: "components",
      alias: "@acme/components",
      preset: "react-shadcn",
      style: "base-vega",
    },
  );
  const again = run(
    "scaffold-library.mjs",
    root,
    "--alias",
    "@acme/components",
  );
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already records a library/);
});

test("scaffold-library appends to an existing justfile and workspace, and refuses a second section", () => {
  const root = pnpmRoot();
  writeFileSync(
    join(root, "justfile"),
    "default:\n  @just --list\n\n# --- Workspace ---\ncheck:\n  pnpm run check\n",
  );
  writeFileSync(
    join(root, "pnpm-workspace.yaml"),
    "packages:\n  - apps/*\n\nminimumReleaseAge: 20160\n",
  );
  assert.equal(run("install.mjs", root).status, 0);
  const result = run(
    "scaffold-library.mjs",
    root,
    "--preset",
    "none",
    "--dir",
    "ui",
    "--alias",
    "@acme/ui",
  );
  assert.equal(result.status, 0, result.stderr);
  const justfile = readFileSync(join(root, "justfile"), "utf8");
  assert.match(
    justfile,
    /# --- Workspace ---\ncheck:\n  pnpm run check\n\n# --- CE pattern ---/,
  );
  assert.doesNotMatch(justfile, /add_shadcn_atoms/);
  assert.equal(
    readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
    "packages:\n  - ui\n  - apps/*\n\nminimumReleaseAge: 20160\n",
  );
  assert.ok(existsSync(join(root, "ui/README.md")));
  assert.equal(readFileSync(join(root, "ui/index.ts"), "utf8"), "export {};\n");
  assert.ok(!existsSync(join(root, "tools/ce-pattern/add-shadcn-items.mjs")));
});

test("add-consumer creates a package with the workspace dependency and a core barrel", () => {
  const root = pnpmRoot();
  assert.equal(run("install.mjs", root).status, 0);
  assert.equal(
    run("scaffold-library.mjs", root, "--alias", "@acme/components").status,
    0,
  );
  const result = run(
    "add-consumer.mjs",
    root,
    "--dir",
    "app",
    "--layers",
    "all",
    "--create",
    "--alias",
    "@acme/app",
  );
  assert.equal(result.status, 0, result.stderr);
  const pkg = json(join(root, "app/package.json"));
  assert.equal(pkg.name, "@acme/app");
  assert.equal(pkg.dependencies["@acme/components"], "workspace:*");
  assert.equal(pkg.devDependencies.react, "19.2.8");
  assert.equal(
    readFileSync(join(root, "app/src/component-core/index.ts"), "utf8"),
    "export {};\n",
  );
  assert.deepEqual(json(join(root, "app/tsconfig.json")).include, [
    "src/**/*.ts",
    "src/**/*.tsx",
  ]);
  assert.match(
    readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
    /  - app\n  - components\n/,
  );
  assert.match(
    json(join(root, "package.json")).scripts["check:component-layers"],
    /components app$/,
  );
  assert.deepEqual(
    json(join(root, "tools/ce-pattern/ce-pattern.json")).consumers,
    [{ dir: "app", alias: "@acme/app", layers: "all" }],
  );
});

test("add-consumer wires an existing package without touching its other fields", () => {
  const root = pnpmRoot();
  assert.equal(run("install.mjs", root).status, 0);
  assert.equal(
    run("scaffold-library.mjs", root, "--alias", "@acme/components").status,
    0,
  );
  const site = join(root, "site");
  spawnSync("mkdir", ["-p", site]);
  writeFileSync(
    join(site, "package.json"),
    '{ "name": "@acme/site", "dependencies": { "astro": "7.0.0" } }\n',
  );
  const result = run(
    "add-consumer.mjs",
    root,
    "--dir",
    "site",
    "--layers",
    "patterns",
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(json(join(site, "package.json")).dependencies, {
    astro: "7.0.0",
    "@acme/components": "workspace:*",
  });
  assert.ok(!existsSync(join(site, "src")));
  assert.deepEqual(
    json(join(root, "tools/ce-pattern/ce-pattern.json")).consumers,
    [{ dir: "site", alias: "@acme/site", layers: "patterns" }],
  );
});

test("write-upstream records source, paths, and deviations", () => {
  const root = pnpmRoot();
  assert.equal(run("install.mjs", root).status, 0);
  assert.equal(
    run("scaffold-library.mjs", root, "--alias", "@acme/components").status,
    0,
  );
  assert.equal(
    run(
      "add-consumer.mjs",
      root,
      "--dir",
      "app",
      "--layers",
      "all",
      "--create",
      "--alias",
      "@acme/app",
    ).status,
    0,
  );
  const result = run(
    "write-upstream.mjs",
    root,
    "--ref",
    "v0.1.0",
    "--commit",
    "abc123",
  );
  assert.equal(result.status, 0, result.stderr);
  const upstream = readFileSync(
    join(root, "tools/ce-pattern/UPSTREAM.md"),
    "utf8",
  );
  assert.match(
    upstream,
    /- Repository: SterlingJF\/ce-pattern-kit\n- Ref: v0.1.0\n- Commit: abc123\n- Skill: install-ce-pattern/,
  );
  assert.match(
    upstream,
    /- Library: `components\/` \(`@acme\/components`, preset react-shadcn, style base-vega\)/,
  );
  assert.match(upstream, /- Consumer: `app\/` \(layers all, `@acme\/app`\)/);
  assert.match(upstream, /## Deviations\n\nnone/);
  assert.match(upstream, /pnpm run check:component-layers/);
  assert.equal(run("write-upstream.mjs", root).status, 1);
});

test("no written file carries an unrendered token", () => {
  const root = pnpmRoot();
  run("install.mjs", root);
  run(
    "scaffold-library.mjs",
    root,
    "--alias",
    "@acme/components",
    "--style",
    "base-vega",
  );
  run(
    "add-consumer.mjs",
    root,
    "--dir",
    "app",
    "--layers",
    "all",
    "--create",
    "--alias",
    "@acme/app",
  );
  const grep = spawnSync("grep", ["-rl", "__CE_", root], { encoding: "utf8" });
  assert.equal(grep.stdout.trim(), "");
});

const managerCases: [string, () => string, string, string][] = [
  ["npm", scratch, "*", "npm run"],
  [
    "yarn",
    () => {
      const root = scratch();
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "t", "packageManager": "yarn@4.0.0" }\n',
      );
      return root;
    },
    "workspace:*",
    "yarn run",
  ],
  [
    "bun",
    () => {
      const root = scratch();
      writeFileSync(join(root, "bun.lock"), "");
      return root;
    },
    "workspace:*",
    "bun run",
  ],
];

for (const [manager, seed, dependency, runCommand] of managerCases) {
  test(`${manager} targets get a workspaces field, ${dependency} dependencies, and ${runCommand}`, () => {
    const root = seed();
    assert.equal(run("install.mjs", root).status, 0);
    assert.equal(
      json(join(root, "tools/ce-pattern/ce-pattern.json")).packageManager,
      manager,
    );
    assert.equal(
      run("scaffold-library.mjs", root, "--alias", "@acme/components").status,
      0,
    );
    assert.equal(
      run(
        "add-consumer.mjs",
        root,
        "--dir",
        "app",
        "--layers",
        "patterns",
        "--create",
        "--alias",
        "@acme/app",
      ).status,
      0,
    );
    assert.equal(run("write-upstream.mjs", root, "--ref", "v0.1.0").status, 0);
    assert.ok(!existsSync(join(root, "pnpm-workspace.yaml")));
    assert.deepEqual(json(join(root, "package.json")).workspaces, [
      "components",
      "app",
    ]);
    assert.equal(
      json(join(root, "app/package.json")).dependencies["@acme/components"],
      dependency,
    );
    assert.match(
      readFileSync(join(root, "tools/ce-pattern/UPSTREAM.md"), "utf8"),
      new RegExp(`${runCommand} check:component-layers`),
    );
  });
}

test("--package-manager overrides detection and no release policy reaches a target", () => {
  const root = scratch();
  assert.equal(run("install.mjs", root, "--package-manager", "pnpm").status, 0);
  assert.equal(
    json(join(root, "tools/ce-pattern/ce-pattern.json")).packageManager,
    "pnpm",
  );
  assert.equal(
    run("scaffold-library.mjs", root, "--alias", "@acme/components").status,
    0,
  );
  assert.equal(
    readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
    "packages:\n  - components\n",
  );
  const grep = spawnSync("grep", ["-rl", "minimumReleaseAge", root], {
    encoding: "utf8",
  });
  assert.equal(grep.stdout.trim(), "");
  assert.equal(
    run("install.mjs", scratch(), "--package-manager", "cargo").status,
    1,
  );
});
