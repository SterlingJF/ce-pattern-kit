---
name: classify-component
description: Places a component file in the right CE pattern layer by the count on its imports and exports, runs the vendored layer checker, reads the verdict for that file, and resolves a refusal or an advisory by the rules' own paths, including Rule 8 lint refusals on how a component looks and Rule 9 copy refusals on literal text. Use when invoked via `/classify-component`, or when the user asks where a component belongs, whether a file is an element or a pattern, or how to fix a layer check, styling lint or copy check failure.
---

# Classify Component

Classification is a count, not a judgment. A source is a file in one of the three layers; `lib/`,
generated files, packages, and files with a support suffix (`.test`, `.stories` and the like, plus any the project lists in `ce-pattern.json` `supportSuffixes`) are support and never count. The checker in `tools/ce-pattern/`
does the counting; this skill reads its verdict and acts on it.

## Skill Terminology

- source: a layer file the component imports from, directly or through a barrel.
- kind: types or values; the checker compares exports to imports per kind.
- refusal: a Rule 2 or Rule 5 violation; the check exits non-zero.
- advisory: a pattern that would pass Rule 2 in place, with one source (Rule 6 path 4) or none (a prototype candidate); reported only where the package has an elements layer, never failing.
- prototype: a file placed in patterns while its design is unsettled (Rule 6).
- copy refusal: a Rule 9 finding from `check:copy`, literal text in an element, pattern or consumer layer, or a language whose keys differ from the base.
- lint refusal: a Rule 8 finding from `lint:components`, such as a restyled core component in a pattern, a raw colour, or a class the theme doesn't define.

## Rules

- Ask in the quick guide's order: design still being defined, then patterns; unmodified vendor code, then core; zero or one component-layer source with at least as many exports per kind, then elements; otherwise patterns.
- Never edit or fork core (Rules 1 and 7). Enrich in elements, compose in patterns.
- A look is a token (Rule 8): restyle a core component only in an element, with token classes; a pattern only places it.
- Rule 4 is sticky: a pattern stays a pattern when its counts drift; only Rule 6 path 4 moves it up, and only when its design is settled.
- Never pad exports to pass a count. A bundle object re-exporting the imports is the tell.

## Process

1. Read the file's imports and exports and count sources and kinds by hand once, to predict the layer.
2. Place the file where the count says, named by the layer's convention in that repo.
3. Run `pnpm run check:component-layers` and read the row for the file: sources, in t/v, out t/v, verdict.
4. On a refusal, act on the message: two sources or fewer exports means move to patterns; an upward import means move the file down or the dependency up; a missing file means fix the path.
5. On an advisory, read which one: "single-source enrichment" means the file is an element once its design is settled; "no layer source" means a hand-built file, a prototype until its parts move out along Rule 6 or it is reclassified. Leave either unless the design is settled, then move to elements and re-run.
6. If the file sets classes on core or elements components, run `lint:components` and act on it: a `no-restyle` refusal in a pattern means the look moves into an element; a raw colour, arbitrary value, or unknown class means the value becomes a token in `tokens.json` first, then `generate:tokens`, then its class. Never loosen the lint config to pass.
7. If the file renders text, run `check:copy`: a literal-text refusal means the text becomes a key in the base language's catalogue file first, then `t("<key>")` from `useCopy()` (Rule 9). Never catalogue sample data, and never silence the check.
8. Report the verdict line and what moved.

## Anti-patterns

- Tallying by hand instead of running the checker after placing the file.
- Editing the checker, the fixtures, or the lint config to make a file pass.
- Editing `component-core` or `generated/` to change a look (Rules 1, 7 and 8).
- Re-exporting imported parts to raise the export count.

## Deliverable

The file in its layer with a clean verdict line from the checker, and a one-line note of what moved and why.
