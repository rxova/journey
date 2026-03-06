# Contributing

## Architecture Overview

Rxova Journey is a small monorepo with package and app workspaces:

- `packages/core`: headless journey state machine, types, and runtime logic.
- `packages/react`: React provider/hooks/renderer built on top of core.
- `packages/devtools-bridge`: bridge API for integrating machines with devtools.
- `apps/docs`: Docusaurus documentation site.
- `apps/demo`: local playground app for runtime integration checks.
- `apps/devtools`: browser extension app.
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
pnpm run version:major:check
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
- `pnpm run docs:api:check`
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
- Private app workspaces `apps-docs` and `apps-devtools` are also versioned with Changesets for docs/version tracking, but they are not published to npm.
- `apps-demo` remains ignored by Changesets.
- Docs history is tracked with Docusaurus docs version snapshots (`pnpm -C apps/docs run version:cut <version>`).
- Starting at `0.6.0`, treat the public API surface as stabilization baseline: `0.6.x` releases should be backward compatible by default.
- If a breaking change is unavoidable before `1.0.0`, call it out explicitly in the changeset and changelog so consumers can plan migrations.

## Browser Compatibility

Rxova Journey targets modern evergreen browsers and React 18+.
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
