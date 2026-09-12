---
name: classify-component
description: Places a component file in the right CE pattern layer by the count on its imports and exports, runs the vendored layer checker, reads the verdict for that file, and resolves a refusal or an advisory by the rules' own paths. Use when invoked via `/classify-component`, or when the user asks where a component belongs, whether a file is an element or a pattern, or how to fix a layer check failure.
---

# Classify Component

Classification is a count, not a judgment. A source is a file in one of the three layers; `lib/`,
generated files, and packages are support and never count. The checker in `tools/ce-pattern/`
does the counting; this skill reads its verdict and acts on it.

## Skill Terminology

- source: a layer file the component imports from, directly or through a barrel.
- kind: types or values; the checker compares exports to imports per kind.
- refusal: a Rule 2 or Rule 5 violation; the check exits non-zero.
- advisory: a pattern that would pass Rule 2 in place, with one source (Rule 6 path 4) or none (a prototype candidate); reported only where the package has an elements layer, never failing.
- prototype: a file placed in patterns while its design is unsettled (Rule 6).

## Rules

- Ask in the quick guide's order: design still being defined, then patterns; unmodified vendor code, then core; zero or one component-layer source with at least as many exports per kind, then elements; otherwise patterns.
- Never edit core. Enrich in elements, compose in patterns.
- Rule 4 is sticky: a pattern stays a pattern when its counts drift; only Rule 6 path 4 moves it up, and only when its design is settled.
- Never pad exports to pass a count. A bundle object re-exporting the imports is the tell.

## Process

1. Read the file's imports and exports and count sources and kinds by hand once, to predict the layer.
2. Place the file where the count says, named by the layer's convention in that repo.
3. Run `pnpm run check:component-layers` and read the row for the file: sources, in t/v, out t/v, verdict.
4. On a refusal, act on the message: two sources or fewer exports means move to patterns; an upward import means move the file down or the dependency up; a missing file means fix the path.
5. On an advisory, read which one: "single-source enrichment" means the file is an element once its design is settled; "no layer source" means a hand-built file, a prototype until its parts move out along Rule 6 or it is reclassified. Leave either unless the design is settled, then move to elements and re-run.
6. Report the verdict line and what moved.

## Anti-patterns

- Tallying by hand instead of running the checker after placing the file.
- Editing the checker or the fixtures to make a file pass.
- Re-exporting imported parts to raise the export count.

## Deliverable

The file in its layer with a clean verdict line from the checker, and a one-line note of what moved and why.
