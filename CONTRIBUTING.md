# Contributing

## Architecture Overview

Rxova Journey is a small monorepo with package and app workspaces:

- `packages/core`: framework-agnostic journey state machine, types, and runtime logic.
- `packages/react`: React bindings — one bundle per machine — built on top of core.
- `packages/devtools-bridge`: bridge API for integrating machines with devtools.
- `apps/docs`: Astro Starlight documentation site.
- `apps/demo`: local playground app for runtime integration checks.
- `apps/devtools`: browser extension app.
- `packages/*/scripts`: build pipelines for each package (esbuild, then `tsc` for the declarations).
- `scripts/`: the repository's own scripts and their tests — the docs release-notes sync, the
  Chrome Web Store publisher, and the two helpers the package builds call (`clean-paths`,
  `copy-types`).

### Shared setup

The repo tooling comes from [rxova/shared](https://github.com/rxova/shared), declared once in the
root `package.json` and never in a workspace package:

- [`@rxova/repo-config`](https://github.com/rxova/shared/tree/main/packages/repo-config): the
  `rxova-repo-config` bin (the `verify` gate, changesets, pack smoke, TSDoc, banned-docs and
  major-version checks, all configured under `repoConfig` in the root `package.json`) and the
  ESLint, Prettier, lint-staged, commitlint, changelog, Vitest, Knip and tsconfig presets.
- [`@rxova/ts-utils`](https://github.com/rxova/shared/tree/main/packages/ts-utils): runtime helpers
  (`shallowEqual`, `useIsomorphicLayoutEffect`, `isPlainObject`) that esbuild inlines into each
  package's bundle, so the published packages keep zero dependencies.
- CI calls the shared reusable workflows and actions at `@main`; only the graph (which jobs run,
  and when) and the docs and devtools workflows live here.

Runtime helpers whose semantics differ from `@rxova/ts-utils` stay in the package that uses them,
under `src/internal/`: the development-warning helpers (`NODE_ENV=test` is quiet, and the
environment is read through `globalThis` rather than a literal `process.env`), the devtools
origin checks, the array-accepting `isRecord`, and the transport serializers. Their tests reach
them through each package's `/testing` alias.

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
one ordered list, `repoConfig.verify.steps` in the root `package.json`, run by
`rxova-repo-config verify` from [`@rxova/repo-config`](https://github.com/rxova/shared/tree/main/packages/repo-config),
so the local gate and CI cannot drift. `pnpm run verify --only lint,format` runs a subset:

1. `audit:check` — dependency advisories
2. `dedupe:check` — duplicate dependency graph entries
3. `sherif:check` — one version of each dependency across the workspace
4. `knip:check` — unused files, exports and dependencies
5. `format:check`
6. `lint`
7. `version:major:check` (`rxova-repo-config check-majors`)
8. `docs:banned:check` (`rxova-repo-config check-banned`, the names in `repoConfig.docs.banned`),
   `changeset:overrides:check` (`rxova-repo-config lint-changesets`)
9. `docs:api:check` (`rxova-repo-config check-tsdoc`), `docs:release-notes:check`
10. `typecheck`, `test` — each package's own suite with its per-file 95% coverage gate — and the
    root scripts' `typecheck:scripts` and `test:scripts`
11. `build`, `size`, `publint`
12. `pack:smoke` (`rxova-repo-config pack-smoke`, per published package)

Commits run `lint-staged` and the typecheck and test tasks, which Turbo replays from cache for
anything the commit did not touch; the full gate is on push, because a gate slow enough to invite
`--no-verify` stops being a gate.

- `pnpm run size`
- Ensure a changeset exists for user-facing changes, one package per changeset file. CI (`rxova-repo-config check-changeset`) requires one whenever a published package's shipped files change; tests and Markdown inside a package do not count. If your PR changes a package without publishing anything (a dev-dependency bump, say), add the `skip-changeset` label or `[skip-changeset]` to the title.
- **If you changed behavior, change the prose in the same PR.** A `minor` or `major` changeset that
  touches `packages/*/src` should almost always come with a diff under `apps/docs/src/content/docs/**` or a
  package `README.md`. Check three things no linter can:
  1. **Earlier changesets in `.changeset/` still true?** They all land in one changelog entry, so a
     later change that supersedes an earlier one must edit that earlier file, not just add its own.
  2. **Does any doc still teach the old behavior?** Grep for the option or API you changed.
  3. **Did you replace a pattern?** If the new API exists to fix a flaw in an old one, the docs
     recommending the old one must change, or the fix ships invisible.

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
   - Recommended (package-scoped): `pnpm run changeset:pkg <package> <patch|minor|major> "<summary>"`
     (`rxova-repo-config add-changeset`; `core`, `react` and `devtools-bridge` name the published packages)
   - Optional interactive: `pnpm run changeset` (if used, keep one package per changeset file).
2. Run release versioning + publish pipeline locally (optional):
   - `pnpm run releases` (`changeset:version` is `rxova-repo-config version` — the bump, the root
     version following core, the lockfile — then the docs release-notes sync)

### Publish Flow

1. Merge changes to `main`.
2. The Release workflow (`release.yml`, which calls the shared `changesets-release.yml`) opens or
   updates a release PR with version bumps and changelog updates.
3. Merge the release PR to publish to npm.

### Versioning Policy

- `@rxova/journey-core`, `@rxova/journey-react`, and `@rxova/journey-devtools-bridge` are independently versioned with Changesets.
- Their major versions must stay aligned (`pnpm run version:major:check` enforces this in CI).
- Private app workspaces `@rxova/journey-docs` and `apps-devtools` are also versioned with Changesets for docs/version tracking, but they are not published to npm.
- `apps-demo` remains ignored by Changesets.
- `1.0.0` is GA: the `rc` prerelease line is closed. Entering prerelease mode again
  (`changeset pre enter <tag>`) is a deliberate act, reserved for the run-up to the next major.
- A breaking change needs a `major` changeset on every package it touches, a mapping entry in the
  migration guide, and the prose updated in the same PR. Core, React and the bridge share a major,
  so a `major` on one usually means a `major` on all three (`pnpm run version:major:check`).
- After `1.0.0`, documented public APIs follow semver.

## Browser Compatibility

Rxova Journey targets modern evergreen browsers and React 18.2+ (the first release with
`useSyncExternalStore`'s final semantics). CI runs the suite against both 18.2 (the shared
`react-minimum-version` workflow, which pins React at the root and in `packages/react`) and the
latest 19.
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
