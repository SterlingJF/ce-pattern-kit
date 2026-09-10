---
name: install-ce-pattern
description: Installs the CE pattern (core, elements, patterns) into a repository and keeps it there. Vendors the layer checker, its tests and fixtures, the rules document, and the registry import script into one tooling directory; scaffolds a shared component library on a preset or a bare package; wires consumer packages; records provenance; and updates an existing installation by three-way merge. Use when invoked via `/install-ce-pattern`, or when the user asks to set up, adopt, or update component layers, a shared component library, or the CE pattern in a repo.
---

# Install CE Pattern

The pattern is three layers decided by a count on imports and exports. The kit's scripts do every
file write on the golden path; this skill decides which scripts run, asks the owner what only the
owner can decide, and records what happened. The rules themselves live in
`assets/tools/ce-pattern/README_COMPONENT_SYSTEM.md`, vendored into the target as
`tools/ce-pattern/README_COMPONENT_SYSTEM.md`.

## Skill Terminology

- kit: this repository, `SterlingJF/ce-pattern-kit`. Never a runtime dependency of a target.
- pattern: the CE pattern, the six rules and the quick guide in the rules document.
- layer: one of `component-core`, `component-elements`, `component-patterns`, at a package root or under its `src/`.
- library: the shared component package the pattern organizes. A source-consumed workspace package on the golden path.
- consumer: any other workspace package that depends on the library. It may hold no layers, `component-patterns` only, or all three with `component-core` as a barrel over the library.
- preset: a framework and registry pairing the scripts scaffold deterministically. Today: `react-shadcn`. `none` scaffolds a bare package.
- tooling directory: `tools/ce-pattern/` in the target, the only place kit-owned files live. Holds the checker, CLI, tests, fixtures, rules document, `versions.json`, `ce-pattern.json`, `add-shadcn-items.mjs`, `UPSTREAM.md`.
- provenance: `UPSTREAM.md`, written by `write-upstream.mjs`, naming source, ref, commit, installed paths, and deviations.
- path: one of fresh install, adopt, add-consumer, update. Detection is mechanical (see Process).

## Rules

- Never run Git. Not to stage, commit, stash, reset, or clean. Hand the owner the commands instead.
- Scripts write files; the agent never hand-writes a file a script owns. On a non-preset framework or registry the agent writes by hand only what no script covers, and records each such file under Deviations.
- A refusal from a script means stop and ask. Never pass `--force`, never delete a destination to make a script run, never point `install.mjs` at a live installation to update it.
- Never replace the package manager. The scripts detect it from the `packageManager` field or the lockfile and record it in `ce-pattern.json`; every command in the hand-back uses that manager.
- Install dependencies with lifecycle scripts disabled, at the versions in `assets/versions.json`, unless the target already has the dependency, in which case its version stays and the vendored tests decide.
- Interview in turn through the question tool, one territory per question, the reading inside the question text, a recommended option first and an open option always. Rounds are in `references/interview.md`.
- Keep the owner's working note current if the repo keeps one; otherwise record decisions in the hand-back.

## Process

1. Choose the path. Read the repo's README and any agent instructions, run `git status` (read-only), then detect: `tools/ce-pattern/UPSTREAM.md` present means update, follow `references/update.md`; any layer directory present with no tooling directory means adopt; a tooling directory with a library recorded and a new package to wire means add-consumer; otherwise fresh install. State the detected path and confirm it in round 1.
2. Interview. Run the rounds in `references/interview.md` that the path needs. Record each answer.
3. Vendor. From the target root: `node <skill-directory>/scripts/install.mjs` (`--into <dir>` for another destination; `--roots a,b` on adopt so the check covers the existing layers; `--package-manager <name>` when detection is wrong or the repo has no lockfile yet). This writes the tooling directory, `ce-pattern.json` with the detected manager, and the `check:component-layers` script.
4. Scaffold the library (fresh install only). `node <skill-directory>/scripts/scaffold-library.mjs --preset react-shadcn|none --dir <dir> --alias <alias> [--style <style>]`. This renders the preset, adds the workspace entry, the justfile section, and the `add:shadcn` script.
5. Wire consumers. Per consumer: `node <skill-directory>/scripts/add-consumer.mjs --dir <dir> --layers none|patterns|all [--create --alias <alias>]`.
6. Dependencies. Add `oxc-parser` and `tsx` as dev dependencies at the root with the detected manager, at the versions under `tooling` in `assets/versions.json`, lifecycle scripts disabled (for pnpm: `pnpm add -D -w oxc-parser@<v> tsx@<v> --ignore-scripts`; npm: `npm install -D --ignore-scripts`; yarn: `yarn add -D`; bun: `bun add -d`). Then install so the library and consumers resolve.
7. Verify. Run `check:component-layers` with the manager's run command (the vendored tests, then the classification over every recorded root) and the target's own type-check. Fix a refusal by moving the file or its exports, never by editing the checker or the fixtures.
8. Provenance. `node <skill-directory>/scripts/write-upstream.mjs --ref <ref> --commit <sha>` with the ref and commit the skill was installed from (`skills-lock.json` records them). If either cannot be established, pass `unknown`.
9. Hand back. The list of files written, the deviations, the verification output, and the commands the owner runs next: install, the first registry import (`just add_shadcn_atoms button` or `add:shadcn button` through the manager's run command), the commit.

## Anti-patterns

- Replacing a directory to update it. An update is a three-way merge of `tools/ce-pattern/`; the library and consumers are the owner's and are never merged.
- Resolving remembered versions. Every pin comes from `assets/versions.json` or the preset's `package.json`, never from memory.
- Inventing a preset. A framework or registry the kit does not ship is handled by hand, confirmed round by round, and recorded as deviations; it is not written into `assets/presets/`.
- Deciding for the owner whether an app holds layers. The pattern holds no opinion; the answer is per repo and per consumer.

## Red flags

- A tooling directory exists without `UPSTREAM.md`: provenance is unknown. Stop and ask before any write.
- Layer directories exist but the package has no `name`: the checker cannot resolve the alias. Ask for the alias before vendoring.
- A `components/` directory beside layer directories in a consumer: the checker reports it as advice; raise it in the hand-back, do not move files unasked.

## Deliverable

A target repository with `tools/ce-pattern/` vendored and recorded in `UPSTREAM.md`, the library and consumers wired as the owner chose, `pnpm run check:component-layers` green, and a hand-back the owner can commit from.
