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
`tools/ce-pattern/versions.json`, install with lifecycle scripts disabled, then record provenance:

```bash
node .claude/skills/install-ce-pattern/scripts/write-upstream.mjs --ref v0.1.0 --commit <sha>
```

Run `check:component-layers` with your package manager's run command. Every script refuses to
overwrite an existing destination and prints one line per file it writes. Nothing runs Git.

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

The layer rules classify component implementations only. Colocated stories, story metadata, and fixtures
are treated as support artifacts rather than additional core capabilities.

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

## Why this system works

The rules are mechanical on purpose — component classification follows a count, not a judgment call.

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
│       └── presets/react-shadcn/        library package files with three tokens, the registry
│                                        import script, its justfile fragment
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
│   ├── versions.json  ce-pattern.json   pins; recorded choices (tooling dir, library, consumers)
│   └── UPSTREAM.md                      provenance: source, ref, commit, paths, deviations
├── components/                          @scope/components: package.json, tsconfig.json,
│   ├── components.json  styles.css      components.json, lib/utils.ts, index.ts
│   ├── lib/utils.ts  index.ts
│   └── component-{core,elements,patterns}/   appear with their first file
├── app/                                 consumer: workspace dependency on the library;
│   └── src/component-core/index.ts      with --layers all, a barrel of named re-exports
├── justfile                             # --- CE pattern --- section appended or created
├── package.json                         check:component-layers, add:shadcn
└── pnpm-workspace.yaml or workspaces    library and consumers added, per your package manager
```

Layer directories in a consumer are checked by the same six rules. Whether an app holds layers
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
core, patterns, and `lib`.

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
| `check_example`         | Classify and type-check `examples/react-shadcn`                  |
| `regenerate_example`    | Rerun the scripts into the example; layer files and barrels kept |
| `sync_skill_assets`     | Copy `src/scripts` and `src/assets` into the install skill       |
| `check_skill_assets`    | Fail when the skill's copy differs from `src`                    |
| `unstage_working_notes` | Drop staged working notes; the `pre-commit` hook calls it        |
| `scan_dependencies`     | osv-scanner over the lockfile                                    |
| `check_renovate_config` | Validate `renovate.json`                                         |

`just check` runs: Prettier, justfile format, Markdown lint, type-check, skill-asset sync, tests,
and the example's classification and type-checks.

In a target repository, after install:

| Command                                              | Purpose                                              |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `just check_component_layers`                        | Vendored tests, then classification of every root    |
| `<pm> run check:component-layers`                    | The same through your package manager                |
| `just add_shadcn_atoms button`                       | Vendor registry items into core; alias imports fixed |
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
- No visual tokens, theming, or build setup. The library is source-consumed by its consumers.

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
