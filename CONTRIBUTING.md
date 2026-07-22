# Contributing

## Architecture Overview

Rxova Journey is a small monorepo with package and app workspaces:

- `packages/core`: headless journey state machine, types, and runtime logic.
- `packages/react`: React provider/hooks/renderer built on top of core.
- `packages/devtools-bridge`: bridge API for integrating machines with devtools.
- `apps/docs`: Astro Starlight documentation site.
- `apps/demo`: local playground app for runtime integration checks.
- `apps/devtools`: browser extension app.
- `packages/*/scripts`: build pipelines for each package.

If you are unsure where a change belongs, start in `packages/core` for
state-machine behavior and in `packages/react` for React-specific API or
rendering.

## Development Workflow

### Requirements

- Node.js `>= 22.13.0` (pnpm 11 requires it; `.nvmrc` pins 24)
- pnpm (see `packageManager` in `package.json`)

### Install

```bash
pnpm install
```

### Common Commands

Task running goes through [Turborepo](https://turborepo.dev): `build`,
`typecheck`, `size` and `publint` fan out across the workspaces, and Turbo
caches each one on a content hash of the files that feed it. A re-run with
nothing changed replays in milliseconds.

```bash
pnpm run verify        # the whole gate, in order — same list CI runs
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run docs          # docs dev server on http://localhost:4321
pnpm run docs:build
pnpm run dev           # demo app
```

### Package-Scoped Commands

```bash
# Core only
pnpm --filter @rxova/journey-core run build

# React only
pnpm --filter @rxova/journey-react run test
```

### Pre-PR Checklist

`pnpm run verify` covers all of it, and the pre-push hook runs it for you. It is
one ordered list defined in `scripts/verify.js`, so the local gate and CI cannot
drift:

1. `audit:check` — dependency advisories
2. `dedupe:check` — duplicate dependency graph entries
3. `format:check`
4. `lint`
5. `version:major:check`
6. `docs:api:check`, `docs:release-notes:check`
7. `typecheck`, `typecheck:tests`, `test`
8. `build`, `size`, `publint`
9. `pack:smoke`

Commits run `lint-staged` only — the full gate is on push, because a gate slow
enough to invite `--no-verify` stops being a gate.

- `pnpm run size`
- Ensure a changeset exists for user-facing changes. If your PR is docs/CI-only/tooling that doesn't affect the packages, add the `skip-changeset` label.

## How To Add A Feature

1. Decide which package owns the change (`core` vs `react`).
2. Update types and runtime behavior in `packages/*/src`.
3. Add or update tests in `packages/*/test` (and `test/` when appropriate).
4. Update docs and examples if the API changes.
5. Run `pnpm run size` to ensure size budgets still pass.
6. If this is user-facing, add a changeset with `pnpm run changeset`.

## Release Process

Releases are automated with Changesets and GitHub Actions.

### Local Steps

1. Create a changeset:
   - Recommended (package-scoped): `pnpm run changeset:pkg -- <package> <patch|minor|major> "<summary>"`
   - Optional interactive: `pnpm run changeset` (if used, keep one package per changeset file).
2. Run release versioning + publish pipeline locally (optional):
   - `pnpm run releases`

### Publish Flow

1. Merge changes to `main`.
2. The Release workflow opens/updates a release PR with version bumps and changelog updates.
3. Merge the release PR to publish to npm.

### Versioning Policy

- `@rxova/journey-core`, `@rxova/journey-react`, and `@rxova/journey-devtools-bridge` are independently versioned with Changesets.
- Their major versions must stay aligned (`pnpm run version:major:check` enforces this in CI).
- Private app workspaces `@rxova/journey-docs` and `apps-devtools` are also versioned with Changesets for docs/version tracking, but they are not published to npm.
- `apps-demo` remains ignored by Changesets.
- The upcoming `1.0.0-rc` line is the contract-freeze point for the current runtime model.
- During the `1.0.0-rc` line, only bug fixes, docs fixes, and release-blocking contract fixes should land.
- If a public contract change is unavoidable during the RC line, call it out explicitly in the changeset, changelog, and migration docs before cutting the next RC.
- After `1.0.0`, documented public APIs follow semver.

## Browser Compatibility

Rxova Journey targets modern evergreen browsers and React 18.2+ (the first release with
`useSyncExternalStore`'s final semantics). CI runs the suite against both 18.2 and the latest 19.
If you need legacy browser support (for example, older Safari or IE11),
you must provide your own transpilation and polyfills in your app build.

## Rules

- Keep runtime dependency count at zero.
- Keep `react` as peer dependency only.
- Add TSDoc summaries for public callable exports (entrypoint exports) and keep `pnpm run docs:api:check` passing.
- Add or update tests for behavior changes.
- Keep transition logic declarative in flow definitions.
- Run `pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build` before opening PR.
- Follow Conventional Commits (`commitlint` is enforced on pull requests).
