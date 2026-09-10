# Install interview

Five rounds, each asked through the question tool with the reading inside the question, a
recommended option first, an open option always. Skip a round the detected path does not need.

## Round 1: Path

Reading to carry: `tools/ce-pattern/UPSTREAM.md` present means update; any `component-core`,
`component-elements`, or `component-patterns` directory present with no tooling directory means
adopt; a tooling directory with a library recorded means add-consumer is available; otherwise
fresh install. Adopt vendors only the tooling directory and edits scripts; it writes nothing into
existing layers. Ask: the repository root, and the path, with the detected one recommended.

## Round 2: Framework

Reading: the rules are framework-neutral, a count on imports and exports. The checker parses
TypeScript and JavaScript modules only, so single-file component formats such as `.vue` or
`.svelte` are not classified. React is the only framework with a preset today. Ask: React
(recommended), or name the framework. A named framework means the library is scaffolded with
`--preset none` and the rest is planned by hand in later rounds.

## Round 3: Registry

Reading: core holds vendor files that are never hand-edited; a registry is where they come from.
shadcn is the only registry with import tooling in the kit, and `base-vega` is the tested style;
`none` is valid and leaves core to be filled by hand from any source. Ask: shadcn with a style
(recommended, `base-vega`), none, or name the registry. A named registry is probed in the next
step: does its CLI write into a configurable directory, and what import alias does it emit.

## Round 4: Library

Reading: the library is a source-consumed workspace package; consumers depend on it through the
workspace protocol of the detected package manager (`workspace:*` for pnpm, yarn, and bun; `*`
for npm); its package name is the alias the checker resolves and the alias the registry import
rewrites to. Ask: the directory (recommended `components`) and the alias (recommended from
the root package name as `@<scope>/components`, else `@<repo>/components`).

## Round 5: Consumers

Reading: whether an app holds layers is the owner's choice per repo; the pattern holds no opinion.
A consumer may hold no layers, `component-patterns` only, or all three with `component-core` as a
barrel of named re-exports over the library. A `components/` directory beside the layers is
reported as advice, never refused. Ask, per consumer package: its directory, whether it exists or
is to be created, and `none | patterns | all`. Repeat until the owner says there are no more.

## After a non-preset answer

Run `install.mjs` and `scaffold-library.mjs --preset none`. Then, in turn: confirm whether the
framework's component files are modules the checker parses; confirm how the registry writes files
and what alias rewrite it needs; propose the hand-written files and the recipe wording; confirm;
write; record every hand-written file under Deviations in `UPSTREAM.md`.
