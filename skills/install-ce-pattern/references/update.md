# Updating an installation

Local edits are owned policy, not drift to erase. An update is a reviewed three-way merge of
`tools/ce-pattern/`, never a directory replacement. The library and consumer packages are the
owner's and are not part of an update.

1. Scope and protect. Read `tools/ce-pattern/UPSTREAM.md` for the source, ref, and commit the
   installation came from. Capture a copy of the current tooling directory outside the repo. Do
   not reset, stash, commit, or clean anything.
2. Stage the three inputs. Local: the tooling directory as it is. Base: the kit at the ref recorded
   in `UPSTREAM.md`, vendored into a temp project with `npx skills add
SterlingJF/ce-pattern-kit#<ref> --skill install-ce-pattern` followed by `node
<skill>/scripts/install.mjs --root <temp>`. Incoming: the same steps at the new ref. If the base
   ref is `unknown`, there is no base; say so and do a conservative port instead of a merge.
3. Classify and merge, per file of the tooling directory. Unchanged upstream: keep local, including
   local deletions. Changed only upstream: take incoming. Changed only locally: keep local. Changed
   both ways: merge, or ask. Deleted upstream but changed locally: ask. `ce-pattern.json` and
   `UPSTREAM.md` are always local. A clean text merge is not evidence the rules still agree; read
   the checker's diff.
4. Reconcile scripts and pins. `check:component-layers` keeps the target's roots. Dependency pins
   move to the incoming `versions.json` only with the owner's approval and only if they clear the
   target's release-age gate.
5. Verify. `pnpm run check:component-layers` runs the vendored tests, then the classification. A
   new refusal after an update is a rule change; report it, do not suppress it.
6. Record. Rewrite `UPSTREAM.md` with the new ref and commit, the base used or `unknown`, and the
   deviations that survived. Hand the owner the diff and the commit command.
