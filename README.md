# CE Pattern Kit

Toolkit for the CE Pattern, a minimal, rule-based structure for organizing UI components.

CE Pattern (stands for "core, element, pattern", read as _"see pattern"_) is the component
folder structure I use with my work, projects, and team. It classifies and places a component
file by what it imports and exports. This project carries the rules, a classifier that applies them,
and the component registry tooling.

**This project is meant to be vendored.** There is no npm package, and nothing in your repository
imports it at runtime. Copy the tooling into your repository, read it, and change it to match your
team's standards. The bundled agent skill handles the initial copy, configuration, and provenance;
after that, the vendored files are yours to maintain and make your own.

## Install with an agent skill

```bash
npx skills add SterlingJF/ce-pattern-kit --skill install-ce-pattern
```

Pin a revision with `SterlingJF/ce-pattern-kit#v0.1.0`. Then ask your agent to run
`/install-ce-pattern`; it interviews you (path, framework, registry, library directory and alias,
consumers), detects your package manager, and runs the scripts.

### Update an existing installation

Reinstall the skill at the new revision, then follow
`skills/install-ce-pattern/references/update.md`: a three-way merge of `tools/ce-pattern/` between
your copy, the base ref recorded in `UPSTREAM.md`, and the incoming ref. The library and consumers
are yours and are never merged.

### Manual installation

The scripts run by hand from the installed skill directory
(`.claude/skills/install-ce-pattern/` or `.agents/skills/install-ce-pattern/`) and use the package
manager they detect from your `packageManager` field or lockfile (pnpm, npm, yarn, or bun; pass
`--package-manager` to override):

```bash
node .claude/skills/install-ce-pattern/scripts/install.mjs
```

```bash
node .claude/skills/install-ce-pattern/scripts/scaffold-library.mjs --preset react-shadcn --dir components --alias @scope/components
```

```bash
node .claude/skills/install-ce-pattern/scripts/add-consumer.mjs --dir app --layers all --create --alias @scope/app
```

Add `oxc-parser` and `tsx` as dev dependencies with your package manager, at the versions in
`tools/ce-pattern/versions.json`, install with lifecycle scripts disabled, then record provenance.
A `react-shadcn` library pins `oxlint` and `@shadcn/lint` in its own `package.json`, so the same
install brings them:

```bash
node .claude/skills/install-ce-pattern/scripts/write-upstream.mjs --ref v0.1.0 --commit <sha>
```

Run `check:component-layers` with your package manager's run command, and on `react-shadcn` also
`check:tokens` and `lint:components`. Every script refuses to overwrite an existing destination
and prints one line per file it writes. Nothing runs Git.

## The Three Layers

```txt
src/
├── component-core/      # Untouched vendor components (e.g. Shadcn)
├── component-elements/  # Enriched UI vocabulary
└── component-patterns/  # Composed, purpose-specific combinations
```

| Layer        | What it is                                                    | Import → export                                   |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------- |
| **core**     | Vendor components                                             | Exact support edges below.                        |
| **elements** | Your UI vocabulary — local foundations and enriched variants. | 0-1 sources; at least as many exports as imports. |
| **patterns** | Composed, purpose-specific combinations.                      | 2+ sources; fewer exports than imports.           |

## Rules

Rules 1 to 6 place component files in layers; Rules 7 and 8 keep core stock and make every look a
token. The layer rules classify component implementations only. Colocated stories, story metadata,
and fixtures are treated as support artifacts rather than additional core capabilities.

### Rule 1 — Core is read-only

`component-core` contains only vendor files.
Nothing in core is hand-edited. If you need to change behaviour, wrap it in elements.
Imports emitted by the vendor may resolve to package support hooks or utilities; that does not move
the vendor file out of core.

### Rule 2 — Elements: zero or one source, same or more out

A file belongs in `component-elements` if and only if:

1. It imports from **at most one** component-layer source file (core or another elements file), and
2. For each kind (types/interfaces, functions/constants), it exports **at least as many** of that kind as it imported, and
3. Exports within each kind are **logically interchangeable** with what was imported — same kind, same contract. Locally-defined exports of the same kind count toward the total.

Zero sources means the element is a locally authored foundation rather than a wrapper around a core
or elements component. Whether the repository uses a component registry elsewhere does not change
that classification.

> A shadcn `Button` file that exports `ButtonPrimary`, `ButtonGhost`, and `ButtonLoading` is an element.
> Locally-defined exports of the same kind (e.g. a `BUTTON_SIZES` constant) also count toward the total.

Elements may chain: an elements file may wrap another elements file, as long as all conditions above still hold.

### Rule 3 — Patterns: multiple sources, fewer out

A file belongs in `component-patterns` if:

- It imports from **more than one** source, and
- It exports **fewer** things than it imports in total.

This applies regardless of whether the imports come from core, elements, or other patterns.
The collapse is the signal — you're combining parts into something specific.

> A `SearchBar` that imports `Input`, `Button`, and `Label` and exports only `SearchBar` is a pattern.
> Three things in, one thing out.

### Rule 4 — Patterns are sticky by default

Once a file is classified as a pattern, it **stays** a pattern.
The import/export ratio is not re-evaluated to reclassify it upward.
New imports or refactors don't move it to elements.

### Rule 5 — Dependencies only flow downward

| This layer... | May import from...       | May NOT import from... |
| ------------- | ------------------------ | ---------------------- |
| core          | vendor-declared imports  | elements, patterns     |
| elements      | core, elements           | patterns               |
| patterns      | core, elements, patterns | —                      |

Nothing in core or elements imports from patterns.

### Rule 6 — Prototypes are unsettled patterns

A **prototype** is a file in `component-patterns` placed there when a capability gap or new need has
been identified, but consumer-facing requirements and downstream use cases are not yet defined at
a UX or interaction design (IxD) level sufficient to:

- confidently place it in elements, or
- determine whether and what to pull from a vendor source into core.

A prototype's parts move out as they settle. Nothing waits for the whole file.

Prototypes resolve part by part. There are four valid paths:

1. **Swap parts out** — replace hand-built internals with core or elements components.
2. **Lift to elements** — if the prototype surfaces a genuinely distinct and user-focused capability with no vendor equivalent, extract that capability into a new element file.
3. **Pull from core** — if the vendor library now covers the capability, import it and remove the hand-built version.
4. **Reclassify to elements** — if on review the prototype turns out to be a single-source enrichment, move it to elements. Only valid if it doesn't import from other patterns.

A prototype that matures by relying on other patterns remains a pattern (Rule 4).

### Rule 7 — Core is never forked

Core holds the vendor's files as the vendor ships them, at the pinned release. A modified copy of a
vendor item, kept anywhere in the library and vendored into core, is a fork, and forks are not
allowed.

- Core is filled from the vendor's registry by item name only, never from a local path or a
  modified item.
- Core can be checked: comparing it against the pinned release finds nothing but the vendor's own
  formatting.
- A look or behaviour the vendor doesn't ship is built in elements (Rule 2) or set in the token
  map (Rule 8), not in core.

### Rule 8 — Looks come from the token map

One token map holds every design value: colours for light and dark, spacing, type, radii, motion,
elevation and blur. Components name tokens; they never carry raw values.

- **Only elements restyle core.** An element may change a core component's layout, spacing, type,
  colour, shape and effects, with token classes only.
- **Patterns and consumers only place core components.** They may set layout around a core
  component, never its look.
- **Effects are tokens too.** Shadows and blurs come from the map; blend modes are not used.
- **Classes are written out.** No raw colours, arbitrary values, inline styles, or class names
  built at runtime.
- **Native controls go through core.** A plain HTML element with a core equivalent, such as
  `<button>` or `<table>`, is replaced by the core component.

A value the map lacks is added to the map on purpose, then used. It is never written inline.

## Classification Quick Guide

When you're not sure where a new file belongs, ask in order:

```txt
1. Are the design requirements for this still being defined?
   └─ Yes → PATTERNS (prototype — see Rule 6)

2. Is it unmodified vendor code?
   └─ Yes → CORE

3. Does it import from zero or one component-layer source?
   └─ Yes → Does it have at least as many exports as it imported?
              └─ Yes, and each kind of export matches its imported kind → ELEMENTS
              └─ No (exports fewer) → PATTERNS
   └─ No (two or more sources) → PATTERNS
```

To change how a core component looks, add or reuse a token (Rule 8), then apply it in an element.
Never in core (Rule 7), never in a pattern.

## Why this system works

The rules are mechanical on purpose — component classification follows a count, not a judgment call.
Rules 7 and 8 are checked the same way: core against a diff from the registry, looks against a lint
that reads the theme generated from the token map.

The layers also self-document. A file in `component-elements` promises a stable, reusable UI vocabulary.
A file in `component-patterns` promises a purposeful composition of lower-layer pieces.

## Repository Map

```text
ce-pattern-kit/
├── src/                                 source of truth, laid out like the skill directory
│   ├── scripts/                         zero-dependency Node scripts: install, scaffold-library,
│   │                                    add-consumer, write-upstream, and their tests
│   └── assets/
│       ├── versions.json                every pin a target receives (oxc-parser, tsx, shadcn)
│       ├── tools/ce-pattern/            vendored verbatim: checker, CLI, tests, twelve fixture
│       │                                scenarios, rules document (rendered from this README),
│       │                                justfile fragment
│       └── presets/react-shadcn/        library package files with four tokens, a starter token
│                                        map, the Rule 8 lint config, the registry import, core
│                                        check and token generator scripts, their justfile fragment
├── skills/
│   ├── install-ce-pattern/              SKILL.md, references/, byte copies of src/scripts and src/assets
│   └── classify-component/              SKILL.md
├── tools/                               sync-skill-assets, render-rules, regenerate-example
├── examples/react-shadcn/               golden output of the scripts plus five sample layer files
├── justfile                             the operator interface
└── WORKING_NOTES.md                     (non-durable, local) decisions, rationale, verification
```

`src/scripts` and `src/assets` are copied into the install skill by `just sync_skill_assets`,
which first renders the vendored rules document from the sections above; `just
check_skill_assets` fails the gate when either differs, because only the skill directory reaches
a target.

## What Gets Installed

After a fresh install with the `react-shadcn` preset and one consumer:

```text
target/
├── tools/ce-pattern/
│   ├── component-layers.ts              the classifier library
│   ├── check-component-layers.ts        CLI: table per file, exit 1 on refusals
│   ├── component-layers.test.ts         node:test over the fixtures
│   ├── test-fixtures/component-layers/  twelve scenario trees
│   ├── README_COMPONENT_SYSTEM.md       the rules
│   ├── add-shadcn-items.mjs             registry import with the pinned CLI and alias rewrite
│   ├── check-shadcn-core.mjs            Rule 7: core compared with the pinned registry release
│   ├── versions.json  ce-pattern.json   pins; recorded choices (tooling dir, library, consumers)
│   └── UPSTREAM.md                      provenance: source, ref, commit, paths, deviations
├── components/                          @scope/components: package.json, tsconfig.json,
│   ├── components.json  styles.css      components.json, lib/utils.ts, index.ts,
│   ├── .oxlintrc.json                   the Rule 8 lint, pinned oxlint and @shadcn/lint
│   ├── tokens.json                      the token map: palette, light and dark roles, theme scales
│   ├── generated/tokens.css             its generated theme, imported by styles.css
│   ├── lib/utils.ts  index.ts
│   └── component-{core,elements,patterns}/   appear with their first file
├── app/                                 consumer: workspace dependency on the library;
│   └── src/component-core/index.ts      with --layers all, a barrel of named re-exports
├── justfile                             # --- CE pattern --- section appended or created
├── package.json                         check:component-layers, add:shadcn, check:shadcn-core,
│                                        generate:tokens, check:tokens, lint:components
└── pnpm-workspace.yaml or workspaces    library and consumers added, per your package manager
```

Layer directories in a consumer are checked by the same rules. Whether an app holds layers
at all is a per-repository choice; the pattern holds no opinion, and the skill asks. A
`components/` directory beside layer directories is reported as advice, never refused.

## Using it in a repository

A repository that already has layer directories adopts without scaffolding:

```bash
node .claude/skills/install-ce-pattern/scripts/install.mjs --roots components,app,site,blog
```

That vendors `tools/ce-pattern/` and wires `check:component-layers` over the named roots, writing
nothing into existing layers. Placing a new component is `/classify-component`: read the count,
place the file, run the check, act on the verdict line. A refusal names the rule and the count. An
advisory flags a pattern that would pass as an element; it never fails the gate.

Vendor registry items into core with `just add_shadcn_atoms button`, or `add:shadcn button`
through your package manager's run command. The script runs the pinned shadcn CLI, removes the
phantom `cn` dependency the registry declares, and rewrites `@/` imports to the library alias in
core, patterns, and `lib`. It holds core to Rule 7:

- **Item names only.** A local path, a URL or a `.json` item is refused, so a modified copy can't
  enter core.
- **No silent overwrite.** A dry run lists the files first; if any already exist and differ from
  the registry, nothing is written unless you pass `OVERWRITE=true` (`--overwrite`).
- **No partial vendor.** A listed file the CLI leaves unwritten fails the run.

`just check_shadcn_core` (`check:shadcn-core`) compares every file in `component-core` with the
pinned registry release through the CLI's own diff, ignoring the kit's import rewrites, and fails
on any other difference. It also fails while a `registry/` folder exists in the library, the
usual home of a fork. A drifted file is re-vendored with `just add_shadcn_atoms <name> true`; the
look it carried moves to an element or the token map.

### The token map

The `react-shadcn` preset gives the library `tokens.json`, a starter map with shadcn's neutral
palette, and `generated/tokens.css`, which `styles.css` imports. Edit the map, then run
`just generate_tokens`; `just check_tokens` fails when the generated file is out of date. Never
edit `generated/`.

```json
{
  "colors": {
    "primitives": {
      "white": "oklch(1 0 0)",
      "neutral-900": "oklch(0.145 0 0)"
    },
    "roles": { "background": { "light": "{white}", "dark": "{neutral-900}" } }
  },
  "theme": {
    "radius": { "lg": "0.625rem" },
    "spacing": { "control-height": "1.75rem" }
  }
}
```

- **Primitives** are raw values, written once.
- **Roles** are what components use. Each names a primitive for light and for dark, in braces, and
  becomes a Tailwind colour: `background` gives `bg-background`, switched by the `.dark` class.
- **Theme** groups use Tailwind's own namespaces (`spacing`, `radius`, `text`, `font`,
  `font-weight`, `leading`, `tracking`, `shadow`, `inset-shadow`, `drop-shadow`, `blur`, `ease`,
  `animate`, `breakpoint`, `container`, `aspect`), so `spacing.control-height` gives
  `h-control-height`. Values are CSS strings.

The generator refuses a role that names a missing primitive or lacks light or dark, an unknown
namespace, and a value that isn't a string. The lint reads the generated theme: a class from the
map passes, any other colour or class is refused.

**Inside a host app.** When the library renders inside another app's theme, such as an editor
plugin, add `host-vars.json` beside the map. It names the host's scoping selector and, for every
role, the host variable to follow, or `null` to keep the map's value:

```json
{
  "selector": ".my-plugin",
  "roles": { "background": "--background-primary", "destructive": null }
}
```

`null` is allowed only where the role's light and dark values are the same, because the host
decides light and dark. The generator writes `generated/host-vars.css`; import it after
`tokens.css`.

### Lint for Rule 8

The `react-shadcn` preset gives the library an oxlint config, `.oxlintrc.json`, running
[`@shadcn/lint`](https://github.com/shadcn-ui/lint). Run it with `just lint_components`, or
`lint:components` through your package manager's run command.

| Rule                            | Refuses                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shadcn/no-restyle`             | In patterns, any class on a core or elements component beyond layout, and any fixed height or size. In elements, anything beyond layout, spacing, type, colour, shape and effects, and blend modes. |
| `shadcn/no-raw-colors`          | Colours that aren't theme classes, such as hex or `rgb()`, in any string.                                                                                                                           |
| `shadcn/no-arbitrary-values`    | Bracketed values such as `w-[13px]`, in any string.                                                                                                                                                 |
| `shadcn/no-inline-styles`       | `style` props.                                                                                                                                                                                      |
| `shadcn/no-unknown-classes`     | Classes Tailwind and the theme don't define.                                                                                                                                                        |
| `shadcn/require-static-classes` | Classes on core and elements components that the linter can't read, such as `` `gap-${n}` ``.                                                                                                       |
| `react/forbid-elements`         | 25 plain HTML elements with a core equivalent, such as `<button>`, `<table>` and `<dialog>`.                                                                                                        |
| `no-restricted-imports`         | `@/` imports; layers are imported through the library alias.                                                                                                                                        |

`component-core` is ignored: it is the vendor's (Rules 1 and 7). Your own states and contracts are
additions to the config, not changes to core:

- **A state variant an element may set**, such as `data-selected:*`: add it to the elements
  override's `allow` list.
- **A component that owns more or less than its layer**: add a `contracts` entry with its name
  pattern and its own `allow` list.
- **A plain element with no core equivalent yet**: vendor one, or remove that tag from
  `react/forbid-elements` on purpose.

- **Add a consumer:** `add-consumer.mjs --dir <dir> --layers none|patterns|all`, then rerun the
  check. The roots list in `check:component-layers` follows `ce-pattern.json`.
- **Reclassify:** a pattern reported under Rule 6 path 4 moves to elements when its design is
  settled, and only then.
- **Update the vendored toolkit:** see [Update an existing installation](#update-an-existing-installation).

## Command Surface

In this repository:

| Recipe                  | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `install_frozen`        | Install exactly the lockfile, lifecycle scripts disabled         |
| `install_unlock`        | Resolve dependencies and permit lockfile changes                 |
| `check`                 | Every repository gate, in order                                  |
| `check_justfile_format` | `just --fmt --check` with two-space recipe bodies                |
| `format`                | Prettier and markdownlint fixes                                  |
| `typecheck`             | `tsc --noEmit` over scripts, checker, tools                      |
| `test`                  | Checker tests, script tests, golden test                         |
| `check_example`         | Classify, type-check and lint `examples/react-shadcn`            |
| `regenerate_example`    | Rerun the scripts into the example; layer files and barrels kept |
| `sync_skill_assets`     | Copy `src/scripts` and `src/assets` into the install skill       |
| `check_skill_assets`    | Fail when the skill's copy differs from `src`                    |
| `unstage_working_notes` | Drop staged working notes; the `pre-commit` hook calls it        |
| `scan_dependencies`     | osv-scanner over the lockfile                                    |
| `check_renovate_config` | Validate `renovate.json`                                         |

`just check` runs: Prettier, justfile format, Markdown lint, type-check, skill-asset sync, tests,
and the example's classification, type-checks and Rule 8 lint.

In a target repository, after install:

| Command                                              | Purpose                                              |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `just check_component_layers`                        | Vendored tests, then classification of every root    |
| `<pm> run check:component-layers`                    | The same through your package manager                |
| `just add_shadcn_atoms button`                       | Vendor registry items into core; alias imports fixed |
| `just check_shadcn_core`                             | Compare core with the registry (Rule 7)              |
| `<pm> run check:shadcn-core`                         | The same through your package manager                |
| `just generate_tokens`                               | Regenerate the theme from the token map (Rule 8)     |
| `just check_tokens`                                  | Fail when the generated theme is out of date         |
| `just lint_components`                               | Lint the library for Rule 8                          |
| `<pm> run lint:components`                           | The same through your package manager                |
| `<pm> run add:shadcn button`                         | The same through your package manager                |
| `tsx tools/ce-pattern/check-component-layers.ts a b` | Classify arbitrary roots                             |

## Limitations

- React is the only preset. Any other framework runs the framework-neutral core (layers, checker,
  rules, recipes) and the skill plans the rest with you, by hand, recorded as deviations.
- shadcn is the only registry with import tooling; `base-vega` is the tested style. Another
  registry or none is valid; core is then filled by hand.
- The checker parses TypeScript and JavaScript modules only. Single-file component formats such
  as `.vue` or `.svelte` are not classified.
- Namespace and default imports through a barrel count nothing; named imports are traced.
- The core check needs the network and runs the shadcn CLI once per core file, so it suits a
  pre-push hook or CI better than every save.
- Rule 8's lint ships with the `react-shadcn` preset only. `require-static-classes` reads classes
  on core and elements components, not on plain HTML elements.
- The token map covers colours and Tailwind's theme namespaces only; values with no namespace,
  such as durations, stay in your own CSS. No build setup: the library is source-consumed by its
  consumers.

## Development

For the toolkit itself:

```bash
pnpm install --ignore-scripts && pnpm exec husky && just check
```

`src/` is the source of truth. After any change under `src/assets`, or to the rules sections of
this README, run `just sync_skill_assets` and `just regenerate_example`, or `check` fails.
Renovate keeps `src/assets/versions.json` and the preset's `package.json` under the two-week
release-age gate. Record any osv-scanner ignore in `osv-scanner.toml` with a reason and an
`ignoreUntil`.

### Working Rules

- A `WORKING_NOTES.md` is seeded before any day-0, day-1, or day-2 activity, then read before and
  updated after every meaningful step. For a human to review and discard at any moment.
- Dependencies install with lifecycle scripts disabled and respect the two-week release-age gate.
- Husky hooks run locally: `pre-commit` unstages every `WORKING_NOTES.md` and
  `WORKING_NOTES.*.md`; `pre-push` runs `just check` and the tolerant dependency scan;
  `post-merge` reinstalls when the lockfile changed and scans again. A fresh clone activates them
  with `pnpm exec husky`. They are a convenience, not the gate.
- `src/` is the source of truth; `skills/install-ce-pattern/{scripts,assets}` is a synced copy
  and is never edited by hand.
- Scripts write files; prose never does. Anything a script cannot do deterministically is a
  deviation, recorded in the target's `UPSTREAM.md`.
- Code carries no comments beyond a one-line statement of intent.

## License

MIT
