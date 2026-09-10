# Upstream

Provenance for the vendored CE pattern tooling. Updates follow the kit's `references/update.md`
as a three-way merge; this directory is never replaced wholesale.

## Source

- Repository: SterlingJF/ce-pattern-kit
- Ref: example
- Commit: example
- Skill: install-ce-pattern

## Installed paths

- Tooling: `tools/ce-pattern/`
- Library: `components/` (`@acme/components`, preset react-shadcn, style base-vega)
- Consumer: `app/` (layers all, `@acme/app`)

## Deviations

none

## Verification

```bash
pnpm run check:component-layers
```
