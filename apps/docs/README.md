# Rxova Journey Docs

Documentation site for `@rxova/journey-core`, `@rxova/journey-react`, `@rxova/journey-devtools-bridge`, and Chrome DevTools docs, built with Docusaurus.

Production docs URL:

- `https://rxova.org/`

## Tech Notes

- Docusaurus `url`: `https://rxova.org`
- Docusaurus `baseUrl`: `/`
- Custom domain CNAME: `rxova.org`
- Deploys via GitHub Actions workflow: `.github/workflows/docs.yml`

## Install

From repository root:

```bash
pnpm install --frozen-lockfile
```

## Run Locally

```bash
pnpm -C apps/docs start
```

## Build

```bash
pnpm -C apps/docs build
```

Static output is generated in `apps/docs/build`.

This build is the authoritative docs validation gate in CI. The docs app also has local editor TypeScript support, but release validation for the site is the Docusaurus build itself.

## Docs Versioning

Freeze each docs instance into its own versioned snapshot:

```bash
pnpm -C apps/docs run version:cut:core <version>
pnpm -C apps/docs run version:cut:react <version>
pnpm -C apps/docs run version:cut:bridge <version>
pnpm -C apps/docs run version:cut:chrome-devtools <version>
```

Example:

```bash
pnpm -C apps/docs run version:cut:core 0.6.0
pnpm -C apps/docs run version:cut:react 0.7.0
pnpm -C apps/docs run version:cut:bridge 0.6.0
pnpm -C apps/docs run version:cut:chrome-devtools 0.3.0
```

This creates plugin-scoped version files/directories, for example:

- `apps/docs/core_versions.json`
- `apps/docs/react_versions.json`
- `apps/docs/bridge_versions.json`
- `apps/docs/chrome-devtools_versions.json`
- `apps/docs/core_versioned_docs/version-<version>/...`
- `apps/docs/core_versioned_sidebars/version-<version>-sidebars.json`

Current docs labels are synced from package versions (`0.x.y`) so the selector/chip can show latest patch (for example `0.6.2`) while older snapshots remain fixed (for example `0.5.0`).

Sync docs labels:

```bash
pnpm run docs:version-labels:sync
```

Check labels are up to date:

```bash
pnpm run docs:version-labels:check
```

## Release Notes In Docs

Per-package release notes pages are generated from changelog files:

- Core: `packages/core/CHANGELOG.md` -> `apps/docs/docs/core/releases.md`
- React: `packages/react/CHANGELOG.md` -> `apps/docs/docs/react/releases.md`
- Bridge: `packages/devtools-bridge/CHANGELOG.md` -> `apps/docs/docs/bridge/releases.md`
- Chrome DevTools: `apps/devtools/CHANGELOG.md` -> `apps/docs/docs/devtool/releases.md`

Sync generated release docs:

```bash
pnpm run docs:release-notes:sync
```

Check they are up to date:

```bash
pnpm run docs:release-notes:check
```

## API Docs Quality Gate

Public callable exports (from package `src/index.ts` entrypoints) must include TSDoc summaries.

Check TSDoc coverage:

```bash
pnpm run docs:api:check
```

Check that the docs site itself still builds:

```bash
pnpm run docs:check
```

## Deploy

Deployment is automated on pushes to `main` that touch:

- `apps/docs/**`
- `apps/devtools/**`
- `packages/**`
- top-level workspace files (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`)
- top-level tooling files (`tsconfig*.json`, `vitest.config.ts`, `eslint.config.ts`)
- `.github/workflows/docs.yml`

The workflow builds docs and publishes `apps/docs/build` to `gh-pages`.
