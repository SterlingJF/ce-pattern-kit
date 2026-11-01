# The CE Pattern

Vendored from the SterlingJF/ce-pattern-kit README; edit it there.

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
token; Rule 9 makes every text a catalogue entry. The layer rules classify component implementations only. Colocated stories, story metadata,
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

### Rule 9 — Copy comes from the catalogue

One catalogue holds every user-facing text, one file per language, keyed the same in each. It is
to words what the token map is to looks.

- **Components name keys; they never carry text.** Elements, patterns and consumers render
  `t("search.label")`, never `Search`. That covers text in markup and in what a person reads or
  hears: `aria-label`, `title`, `placeholder`, `alt` and `label`.
- **The base language is the contract.** A key used in code must exist in the base language, and
  every other language has the same keys and placeholders. Plural forms may differ by language.
- **Core keeps the vendor's text.** Labels that ship inside core are the vendor's (Rule 7). To
  change one, pass the catalogue's text into the core component from an element.
- **Sample data is not copy.** Names, IDs and dates that come from data are passed in, not
  catalogued.

A text the catalogue lacks is added to the base language first, then used.

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
Rules 7, 8 and 9 are checked the same way: core against a diff from the registry, looks against a
lint that reads the theme generated from the token map, and copy against the catalogue.

The layers also self-document. A file in `component-elements` promises a stable, reusable UI vocabulary.
A file in `component-patterns` promises a purposeful composition of lower-layer pieces.
