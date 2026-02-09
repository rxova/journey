# Contributing

## Setup

```bash
npm install
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

## Rules

- Keep runtime dependency count at zero.
- Keep `react` as peer dependency only.
- Add or update tests for behavior changes.
- Keep transition logic declarative in flow definitions.
- Run `npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build` before opening PR.
- Follow Conventional Commits (`commitlint` is enforced on pull requests).
