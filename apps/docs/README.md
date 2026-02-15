# Rxova Journey Docs

Documentation site for `@rxova/journey-core` and `@rxova/journey-react`, built with Docusaurus.

Production docs URL:

- `https://rxova.org/journey/`

## Tech Notes

- Docusaurus `url`: `https://rxova.org`
- Docusaurus `baseUrl`: `/journey/`
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

## Deploy

Deployment is automated on pushes to `main` that touch:

- `apps/docs/**`
- `.github/workflows/docs.yml`

The workflow builds docs and publishes `apps/docs/build` to `gh-pages`.
