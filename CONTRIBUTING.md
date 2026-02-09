# Contributing

## Setup

```bash
npm install
npm run test
npm run build
```

## Rules

- Keep runtime dependency count at zero.
- Keep `react` as peer dependency only.
- Add or update tests for behavior changes.
- Keep transition logic declarative in flow definitions.
- Run `npm run typecheck && npm run test && npm run build` before opening PR.
