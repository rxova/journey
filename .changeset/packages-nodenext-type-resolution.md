---
"@rxova/journey-core": patch
---

Fix type resolution for consumers on `moduleResolution: "node16"` / `"nodenext"`. The published
`.d.ts` files carried extensionless relative imports (`./helpers`, `../core/types`), which those
resolvers cannot follow — every entrypoint reported an internal resolution error. Relative
specifiers now carry explicit `.js` extensions, so the emitted declarations resolve. Bundler and
CJS consumers were unaffected.

The `attw` script that would have caught this was declared but never installed or run in CI;
`@arethetypeswrong/cli` is now a real dependency and `packaging:check` runs it.
