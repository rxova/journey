# Contributing

## Architecture Overview

Rxova Journey is a small monorepo with two packages and shared tooling:

- `packages/core`: headless journey state machine, types, and runtime logic.
- `packages/react`: React provider/hooks/renderer built on top of core.
- `packages/*/scripts`: build pipelines for each package.

If you are unsure where a change belongs, start in `packages/core` for
state-machine behavior and in `packages/react` for React-specific API or
rendering.

## Development Workflow

### Requirements

- Node.js `>= 20.11.0`
- pnpm (see `packageManager` in `package.json`)

### Install

```bash
pnpm install
```

### Common Commands

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

### Package-Scoped Commands

```bash
# Core only
pnpm --filter @rxova/journey-core run build

# React only
pnpm --filter @rxova/journey-react run test
```

### Pre-PR Checklist

- `pnpm run format:check`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`
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
   - `pnpm run changeset`
   - Select affected package(s) and bump type (patch/minor/major).

### Publish Flow

1. Merge changes to `main`.
2. The Release workflow opens/updates a release PR with version bumps and changelog updates.
3. Merge the release PR to publish to npm.

### Versioning Policy

- Packages are versioned independently.
- If only `@rxova/journey-react` changes, bump React only.
- If `@rxova/journey-core` changes, core is bumped and React receives a patch bump to update its dependency range when needed.

## Browser Compatibility

Rxova Journey targets modern evergreen browsers and React 18+.
If you need legacy browser support (for example, older Safari or IE11),
you must provide your own transpilation and polyfills in your app build.

## Rules

- Keep runtime dependency count at zero.
- Keep `react` as peer dependency only.
- Add or update tests for behavior changes.
- Keep transition logic declarative in flow definitions.
- Run `pnpm run format:check && pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build` before opening PR.
- Follow Conventional Commits (`commitlint` is enforced on pull requests).
