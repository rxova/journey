# apps-devtools

## 0.6.0

### Minor Changes

- 01ef543: Version alignment release for Journey 0.6.0.
  - Aligns the Chrome DevTools app version with the 0.6.0 platform release.
  - Keeps the extension surface stable while consuming the current bridge/runtime stack.

### Patch Changes

- Updated dependencies [01ef543]
  - @rxova/journey-devtools-bridge@0.6.0

## 0.5.0

### Minor Changes

- 16db5e3: Platform-level DevTools refresh for Journey 0.5.0.
  - Reworked panel/store behavior for richer timeline inspection and snapshot diff handling.
  - Updated background/content/panel command flow to match the stabilized protocol model.
  - Expanded app-level test coverage across background/content/store/panel behaviors.

### Patch Changes

- Updated dependencies [16db5e3]
  - @rxova/journey-devtools-bridge@0.5.0

## 0.2.0

### Minor Changes

- 176007f: - Added full Chrome DevTools extension app
  - Added new bridge package with protocol + bridge runtime.
  - Added/expanded demo integration to exercise DevTools + bridge flows.
  - Added Devtool documentation section.
  - Updated docs UX in index.tsx, sidebars.ts, and search styling in styles.module.css.
  - Added CI/CD workflows for docs/devtools and Chrome Web Store publishing in devtools.yml, devtools-publish.yml, docs.yml.
  - Updated release/versioning config in config.json and scripts in package.json (pnpm run releases).
  - Updated README files across packages.

### Patch Changes

- Updated dependencies [176007f]
  - @rxova/journey-devtools-bridge@0.4.0
