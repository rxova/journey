---
"@rxova/journey-core": patch
---

Fix type resolution for consumers on `moduleResolution: "node16"` / `"nodenext"`. The published
`.d.ts` and `.d.cts` files carried extensionless relative imports (`./helpers`, `../core/types`),
which those resolvers cannot follow — every entrypoint reported an internal resolution error.
Bundler and CJS consumers were unaffected, which is why it went unnoticed.

The published declarations now carry explicit `.js` extensions, added at build time by
`copy-types.ts` rather than written by hand, so source keeps its extensionless imports. The
rewrite resolves each specifier against the emitted declarations and throws if one does not
resolve, so a future directory import or dynamic `import()` type cannot silently reintroduce the
bug.

The `attw` script that would have caught this was declared but never installed or run in CI;
`@arethetypeswrong/cli` is now a real dependency and `packaging:check` runs it.
