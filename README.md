# `@rxova/journey` examples — standalone, version-pinned

**Generated branch. Do not send pull requests here; it is replaced wholesale after every
release.** The source of truth for every file is [`main`](https://github.com/rxova/journey/tree/main/examples).

Each directory under `examples/` is a self-contained Vite app that installs from npm, so it runs
on CodeSandbox, StackBlitz or a plain `npm install` without the monorepo around it. Compared with
`main`:

- `@rxova/journey-core`, `@rxova/journey-react` and `@rxova/journey-devtools-bridge` are pinned to
  the published versions instead of `workspace:^`.
- `src/demo/vite.ts` resolves those packages from `node_modules`. On `main` it aliases them at the
  workspace sources, four levels up, so no example needs a build first — paths that do not exist
  in a subtree checkout.
- `tsconfig.json` is self-contained rather than extending the repository's `tsconfig.base.json`.

## Run one

```bash
npm install
npm run dev
```

Open on CodeSandbox:
`https://codesandbox.io/p/github/rxova/journey/examples-pinned/examples/react-showcase-graph`
